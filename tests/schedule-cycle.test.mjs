import {applyAction,completeTaskField} from '../src/actions.mjs';
import {fieldTaskUrgency} from '../src/land-map.mjs';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {scheduleCycleProgress} from '../src/task-history.mjs';
import {renderWorkspace,renderScheduledAgenda,taskNextDueLabel} from '../src/workspace.mjs';
import DEMO from '../data/demo.json' with {type:'json'};

const FARM={id:'land',name:'Land',crop:'Rice',plots:[{id:'f1',name:'Field 1',crop:'Rice'},{id:'f2',name:'Field 2',crop:'Rice'}]};
const TASK={id:'a',scheduleId:'cycle',farmId:'land',plotId:'f1',title:'Water',category:'Water',dueDate:'2030-01-01',time:'08:00',repeat:'daily',endDate:'2030-01-03',done:true,completedAt:'2030-01-01T09:30:00+08:00'};

test('cycle progress includes all fields and future occurrences through the end date',()=>{
 const tasks=[TASK,{...TASK,id:'b',plotId:'f2',done:false},{...TASK,id:'c',dueDate:'2030-01-02',done:false,repeatFromId:'a'}];
 assert.deepEqual(scheduleCycleProgress(tasks,FARM.plots),{done:1,total:6,percent:17});
 const state={...structuredClone(DEMO),farms:[FARM],tasks,notifications:[]};
 assert.match(renderWorkspace('/notifications',state),/aria-valuemax="6" aria-valuenow="1"/);
 assert.match(renderScheduledAgenda(FARM,tasks,'2030-01-03'),/aria-valuemax="6" aria-valuenow="1"/);
});
test('history logs every completed occurrence per field, newest first',()=>{
 const latest={...TASK,id:'second',dueDate:'2030-01-02',completedAt:'2030-01-02T10:30:00+08:00',repeatFromId:'a'};
 const pending={...TASK,id:'next',done:false,dueDate:'2030-01-03',completedAt:undefined,repeatFromId:'second'};
 const otherField={...TASK,id:'other-field',plotId:'f2'};
 const unrelated={...TASK,id:'unrelated',farmId:'another-land',title:'Other land task'};
 const state={...structuredClone(DEMO),farms:[{...FARM,area:2,location:'Perak'}],tasks:[TASK,latest,pending,otherField,unrelated]};
 const before=JSON.stringify(state.tasks);
 const html=renderWorkspace('/farm/land/history',state);
 assert.equal((html.match(/class="notification-field-row"/g)??[]).length,3);
 assert.match(html,/data-id="second"/);
 assert.match(html,/data-id="a"/);
 assert.ok(html.indexOf('data-id="second"') < html.indexOf('data-id="a"'));
 assert.match(html,/data-id="other-field"/);
 assert.doesNotMatch(html,/data-id="next"|Other land task|data-task-done="false"|schedule-history-record|task-round-date/);
 assert.match(html,/View full calendar/);
 assert.match(html,/Completed ·/);
 const land=renderWorkspace('/farm/land',state);
 const completed=land.slice(land.indexOf('<h2>Completed</h2>'));
 const stack=html.match(/<details class="notification-task-stack"[\s\S]*?<\/details>/)?.[0];
 assert.ok(stack);
 assert.ok(completed.includes(stack));
 assert.equal(JSON.stringify(state.tasks),before);
});

test('history with only pending tasks shows an empty completed history',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[{...TASK,done:false,completedAt:undefined}]};
 const html=renderWorkspace('/farm/land/history',state);
 assert.match(html,/No task history yet\./);
 assert.doesNotMatch(html,/notification-task-stack|data-task-done/);
});
test('one-time tasks finish at 100 percent; unbounded cycles have no invented percentage',()=>{
 assert.deepEqual(scheduleCycleProgress([{...TASK,repeat:'none'}],FARM.plots),{done:1,total:1,percent:100});
 assert.equal(scheduleCycleProgress([{...TASK,endDate:''}],FARM.plots).percent,null);
});
test('land schedule puts history below the agenda without repeating completed cycles',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[TASK]};
 const html=renderWorkspace('/farm/land/schedule',state);
 assert.doesNotMatch(html,/class="schedule-completed"|class="schedule-utility"/);
 assert.match(html,/class="button button-secondary schedule-history-button" href="\/farm\/land\/history"/);
 assert.ok(html.indexOf('schedule-history-button')>html.indexOf('data-agenda>'));
 assert.match(html,/View history/);
});

test('recurring countdown targets the next occurrence rather than cycle end',()=>{
 const now=new Date('2030-01-01T12:00:00');
 const pending={...TASK,done:false,time:'15:00'};
 assert.equal(taskNextDueLabel(pending,now),'Due in 3 hours');
 assert.equal(taskNextDueLabel({...pending,time:'12:20'},now),'Due in 20 minutes');
 assert.equal(taskNextDueLabel({...pending,time:'12:00'},now),'Due now');
 assert.equal(taskNextDueLabel({...pending,time:'08:00'},now),'Overdue');
 assert.equal(taskNextDueLabel(TASK,now),'Due in 20 hours');
 assert.equal(taskNextDueLabel({...TASK,endDate:'2030-01-01'},now),'Completed');
 assert.equal(taskNextDueLabel({...pending,dueDate:'2030-01-03'},now),'Due in 2 days');
 assert.match(taskNextDueLabel({...TASK,repeat:'none'},now),/08:00/);
});

test('land previews use expandable cycle groups for upcoming and completed tasks',()=>{
 const farm={...FARM,area:2,location:'Penang'};
 const state={...structuredClone(DEMO),farms:[farm],tasks:[TASK,{...TASK,id:'next',done:false,dueDate:'2030-01-02'}]};
 const html=renderWorkspace('/farm/land',state);
 const preview=html.slice(html.indexOf('Next on your land'));
 assert.equal((preview.match(/class="land-task-preview"/g)??[]).length,2);
 assert.equal((preview.match(/class="notification-task-stack"/g)??[]).length,2);
 assert.match(preview,/role="progressbar"/);
 assert.match(preview,/href="\/farm\/land\/history"/);
 assert.doesNotMatch(preview,/class="card task-list"/);
});

test('whole-land actions cannot complete multiple fields and detail offers individual controls',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[{...TASK,id:'whole',plotId:'',done:false,dueDate:'2000-01-01',repeat:'none'}]};
 const result=applyAction(state,'toggle-task','whole');
 assert.equal(state.tasks[0].done,false);
 assert.equal(result.redirect,'/farm/land/tasks/whole');
 const detail=renderWorkspace('/farm/land/tasks/whole',state);
 assert.match(detail,/data-plot-id="f1"/);
 assert.match(detail,/data-plot-id="f2"/);
 assert.doesNotMatch(detail,/data-action="toggle-task"/);
 completeTaskField(state,'whole','f1');
 completeTaskField(state,'whole','f1');
 assert.equal(state.tasks.find(task=>task.plotId==='f1').done,true);
 assert.equal(state.tasks.find(task=>task.plotId==='f2').done,false);
 assert.equal(fieldTaskUrgency(state.tasks,'land','f2').pending,1);
 assert.equal(fieldTaskUrgency(state.tasks,'land','f1').pending,0);
 completeTaskField(state,'whole','f2');
 assert.equal(state.tasks.filter(task=>task.done).length,2);
});

test('completed previews show completion timestamps without countdowns or cycle progress',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[TASK]};
 const html=renderWorkspace('/farm/land',state);
 const completed=html.slice(html.indexOf('<h2>Completed</h2>'));
 assert.match(completed,/Completed ·/);
 assert.doesNotMatch(completed,/Due in|task-round-date|role="progressbar"/);
 assert.match(completed,/notification-field-row/);
});


test('completed rows separate the field title from its secondary completion time',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[TASK]};
 for (const route of ['/farm/land','/farm/land/history','/notifications']) {
  const html=renderWorkspace(route,state);
  assert.match(html, /class="notification-field-name"[^>]*><span>Field 1<\/span><small class="row-subtitle"><time datetime="2030-01-01T09:30:00\+08:00">[^<]+<\/time><\/small><\/a>/);
 }
});


test('history has a compact accessible calendar shortcut and borderless completed layout',()=>{
 const state={...structuredClone(DEMO),farms:[FARM],tasks:[TASK]};
 const html=renderWorkspace('/farm/land/history',state);
 assert.match(html,/class="schedule-history-page"/);
 assert.match(html,/class="icon-button history-calendar-shortcut" href="\/farm\/land\/schedule" aria-label="View full calendar"/);
 assert.match(html,/<section class="schedule-history-list" aria-labelledby="history-completed-title"><h2 id="history-completed-title">Completed<\/h2>/);
 assert.doesNotMatch(html,/class="(?:card|button button-secondary)/);
 state.tasks=[];
 const empty=renderWorkspace('/farm/land/history',state);
 assert.match(empty,/class="schedule-history-empty"/);
 assert.match(empty,/Completed tasks will appear here\./);
});

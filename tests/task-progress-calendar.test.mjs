import assert from 'node:assert/strict';
import {test} from 'node:test';
import DEMO from '../data/demo.json' with {type:'json'};
import {submitForm, completeTaskField} from '../src/actions.mjs';
import {currentTaskRounds,hasPendingTasksOnDate,tasksOnCalendarDate} from '../src/task-history.mjs';
import {renderScheduledAgenda,renderWorkspace} from '../src/workspace.mjs';

const TASK = {id:'first',scheduleId:'watering',farmId:'land',plotId:'f1',title:'Water crops',category:'Water',dueDate:'2026-09-29',time:'08:00',repeat:'daily',endKind:'date',endDate:'2026-10-06',done:false};
const FARM = {id:'land',name:'Land',crop:'Rice',plots:[{id:'f1',name:'Field 1',crop:'Rice'},{id:'f2',name:'Field 2',crop:'Rice'}]};
const stateWith = (tasks) => ({...structuredClone(DEMO),farms:[structuredClone(FARM)],tasks,notifications:[]});

test('daily projection spans all eight inclusive dates without mutating storage',()=>{
  const tasks = [structuredClone(TASK)];
  for (const date of ['2026-09-29','2026-09-30','2026-10-01','2026-10-02','2026-10-03','2026-10-04','2026-10-05','2026-10-06']) assert.equal(tasksOnCalendarDate(tasks,date).length,1,date);
  assert.deepEqual(tasksOnCalendarDate(tasks,'2026-09-28'),[]);
  assert.deepEqual(tasksOnCalendarDate(tasks,'2026-10-07'),[]);
  assert.equal(tasks.length,1);
  const html = renderScheduledAgenda(FARM,tasks,'2026-10-02');
  assert.match(html,/data-task-date="2026-10-02"/);
  assert.match(html,/Scheduled later/);
  assert.doesNotMatch(html,/data-plot-id="f1" aria-label/); // Projected completion is disabled.
});

test('current round includes completed fields but excludes their next occurrences',()=>{
  const state = stateWith([{...TASK,dueDate:'2000-01-01',endDate:'2000-01-03'},{...TASK,id:'second',plotId:'f2',dueDate:'2000-01-01',endDate:'2000-01-03'}]);
  completeTaskField(state,'first','f1');
  let round = currentTaskRounds(state.tasks)[0];
  assert.equal(round.length,2);
  assert.equal(round.filter((task)=>task.done).length,1);
  assert.match(renderWorkspace('/notifications',state),/aria-valuemax="6" aria-valuenow="1"/);
  completeTaskField(state,'second','f2');
  round = currentTaskRounds(state.tasks)[0];
  assert.equal(round.length,2);
  assert.ok(round.every((task)=>!task.done && task.dueDate==='2000-01-02'));
  assert.equal(tasksOnCalendarDate(state.tasks,'2000-01-02').length,2);
});

test('scheduler and notification stacks share the same progress and field controls',()=>{
  const state = stateWith([{...TASK,done:true},{...TASK,id:'second',plotId:'f2'}]);
  const notifications = renderWorkspace('/notifications',state).match(/<details class="notification-task-stack"[^]*?<\/details>/)[0];
  assert.ok(renderWorkspace('/schedule',state).includes(notifications));
  assert.match(notifications,/1 of 16 field tasks completed/);
  assert.doesNotMatch(notifications,/class="card/);
});

test('new repeats require an end, one-time tasks and existing open-ended schedules remain supported',()=>{
  const state = stateWith([]);
  const fields = {...TASK,repeat:'custom',repeatUnit:'days',repeatInterval:'1',endKind:'never',endDate:''};
  delete fields.id;
  assert.throws(()=>submitForm(state,'task',fields),/end date/);
  assert.equal(state.tasks.length,0);
  submitForm(state,'task',{...fields,repeat:'none'});
  assert.throws(()=>submitForm(state,'task',{...fields,id:state.tasks[0].id}),/end date/);
  state.tasks.push({...TASK,id:'legacy',endKind:'never',endDate:''});
  submitForm(state,'task',{...fields,id:'legacy'});
  const newForm = renderWorkspace('/schedule',state);
  assert.doesNotMatch(newForm,/name="endKind" value="never"/);
  assert.match(renderWorkspace('/farm/land/tasks/legacy',state),/name="endKind" value="never" checked/);
});

test('minute, hourly, multi-day and monthly projections preserve timing and final date',()=>{
  const task = {...TASK,dueDate:'2032-02-29',time:'23:45',endDate:'2032-03-03',repeat:'custom'};
  assert.equal(tasksOnCalendarDate([{...task,repeatUnit:'minutes',repeatInterval:30}],'2032-03-01')[0].time,'00:15');
  assert.equal(tasksOnCalendarDate([{...task,repeatUnit:'hours',repeatInterval:6}],'2032-03-01')[0].time,'05:45');
  assert.equal(tasksOnCalendarDate([{...task,repeatUnit:'days',repeatInterval:2}],'2032-03-01').length,0);
  assert.equal(tasksOnCalendarDate([{...task,repeatUnit:'days',repeatInterval:2}],'2032-03-02')[0].time,'23:45');
  const monthly = {...TASK,dueDate:'2031-01-31',repeat:'monthly',repeatAnchorDay:31,endDate:'2031-03-31'};
  assert.equal(tasksOnCalendarDate([monthly],'2031-02-28').length,1);
  assert.equal(tasksOnCalendarDate([monthly],'2031-03-31').length,1);
  assert.equal(tasksOnCalendarDate([{...task,repeatUnit:'minutes',repeatInterval:1}],'2032-03-03').length,1440);
});


test('calendar markers and paged agendas stay bounded for minute repeats over long schedules',()=>{
  const task = {...TASK,repeat:'custom',repeatUnit:'minutes',repeatInterval:1,endDate:'2040-12-31'};
  assert.equal(hasPendingTasksOnDate([task],'2040-12-31'),true);
  assert.equal(hasPendingTasksOnDate([task],'2041-01-01'),false);
  const html = renderScheduledAgenda(FARM,[task],'2035-02-01');
  assert.equal((html.match(/role="progressbar"/g) ?? []).length,10);
  assert.match(html,/data-schedule-more/);
  assert.equal((renderScheduledAgenda(FARM,[task],'2035-02-01',20).match(/role="progressbar"/g) ?? []).length,20);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { applyAction } from '../src/actions.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { renderNotificationBell } from '../src/shell.mjs';

const createState = () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land-test',name:'Land 1',crop:'Rice',plots:Array.from({length:5},(_,i)=>({id:`field-${i+1}`,name:`Field ${i+1}`,crop:'Rice'}))}];
  state.tasks = [{id:'t1',farmId:'land-test',plotId:'field-1',title:'Fertilize crops',category:'Fertilizer',dueDate:'2030-01-01',time:'08:00',done:true},{id:'t2',farmId:'land-test',plotId:'field-2',title:'Fertilize crops',category:'Fertilizer',dueDate:'2030-01-01',time:'08:00',done:false}];
  state.notifications = [{id:'n1',title:'Update',body:'Saved',date:'2030-01-01',read:false}];
  return state;
};
test('pending and completed fields have separate task stacks',()=>{
  const html=renderWorkspace('/notifications',createState());
  assert.equal((html.match(/<details class="notification-task-stack" data-schedule-group/g)??[]).length,2);
  assert.match(html,/<h2>Pending<\/h2>/);
  assert.match(html,/<h2>Completed<\/h2>/);
  assert.match(html,/1 of 2 completed/);
  assert.match(html,/1 of 1 completed/);
  assert.match(html,/Field 1/);
  assert.match(html,/Field 2/);
  assert.match(html,/Completed/);
  assert.match(html,/Scheduled later/);
});
test('whole land expands into all five fields without manufacturing tasks',()=>{
  const state=createState();
  state.tasks=[{...state.tasks[1],plotId:''}];
  const html=renderWorkspace('/notifications',state);
  for(let i=1;i<=5;i++) assert.ok(html.includes(`Field ${i}`));
  assert.match(html,/0 of 5 completed/);
  assert.equal(state.tasks.length,1);
});
test('unread bell clears after marking notifications read',()=>{
  const state=createState();
  assert.match(renderNotificationBell(state),/has-unread/);
  assert.match(renderNotificationBell(state),/1 unread/);
  applyAction(state,'mark-notifications-read');
  assert.doesNotMatch(renderNotificationBell(state),/has-unread|notification-bell-count/);
});

test('individual tick marks only its notification read and disappears afterwards',()=>{
  const state=createState();
  state.notifications.push({...state.notifications[0],id:'n2'});
  assert.match(renderWorkspace('/notifications',state),/data-action="mark-notification-read" data-id="n1"/);
  applyAction(state,'mark-notification-read','n1');
  applyAction(state,'mark-notification-read','n1');
  assert.equal(state.notifications[0].read,true);
  assert.equal(state.notifications[1].read,false);
  const html=renderWorkspace('/notifications',state);
  assert.doesNotMatch(html,/data-action="mark-notification-read" data-id="n1"/);
  assert.match(html,/data-action="mark-notification-read" data-id="n2"/);
  assert.match(renderNotificationBell(state),/1 unread/);
});

test('notification status distinguishes completed, overdue, due soon and future tasks',async()=>{
  const {notificationTaskStatus}=await import('../src/workspace.mjs');
  const task=createState().tasks[1];
  const now=new Date('2030-01-01T08:00:00');
  assert.equal(notificationTaskStatus({...task,done:true},now),'completed');
  assert.equal(notificationTaskStatus({...task,time:'07:00'},now),'overdue');
  assert.equal(notificationTaskStatus({...task,time:'09:00'},now),'soon');
  assert.equal(notificationTaskStatus({...task,time:'15:00'},now),'upcoming');
});

test('whole-land completion affects only the selected field and supports stale repeat clicks',async()=>{
  const {completeTaskField}=await import('../src/actions.mjs');
  const {fieldTaskUrgency}=await import('../src/land-map.mjs');
  const state=createState();
  state.tasks=[{...state.tasks[1],id:'whole',plotId:'',dueDate:'2000-01-01',repeat:'none'}];
  completeTaskField(state,'whole','field-3');
  completeTaskField(state,'whole','field-3');
  assert.equal(state.tasks.length,5);
  assert.equal(state.tasks.filter((task)=>task.done).length,1);
  assert.equal(state.tasks.find((task)=>task.plotId==='field-3').done,true);
  assert.equal(fieldTaskUrgency(state.tasks,'land-test','field-1').urgency,'overdue');
  assert.equal(fieldTaskUrgency(state.tasks,'land-test','field-3').pending,0);
  assert.match(renderWorkspace('/notifications',state),/1 of 5 completed/);
  for(const field of ['field-1','field-2','field-4','field-5']) completeTaskField(state,'whole',field);
  assert.equal(state.tasks.filter((task)=>task.done).length,5);
  assert.match(renderWorkspace('/notifications',state),/5 of 5 completed/);
});

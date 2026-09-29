import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderFieldSchedules } from '../src/field-care.mjs';
import { latestCompletedTasks } from '../src/task-history.mjs';
import { renderScheduledAgenda, renderWorkspace } from '../src/workspace.mjs';

const TASK = {id:'first',farmId:'land',plotId:'field',title:'Water crops',category:'Water',dueDate:'2030-01-01',time:'08:00',done:true,repeat:'daily'};
const TASKS = [TASK, {...TASK,id:'second',repeatFromId:'first',dueDate:'2030-01-02'}, {...TASK,id:'third',repeatFromId:'second',dueDate:'2030-01-03',done:false}];

test('recurrence history keeps only latest completion without merging independent tasks', () => {
  const separate = {...TASK,id:'independent'};
  assert.deepEqual(latestCompletedTasks([...TASKS,separate]).map((task) => task.id), ['second','independent']);
  assert.equal(TASKS.length,3);
  assert.deepEqual(latestCompletedTasks([]),[]);
});

test('notifications separate next recurrence from completed occurrences', () => {
  const state = {...structuredClone(INITIAL_STATE),tasks:structuredClone(TASKS),notifications:[],farms:[{id:'land',name:'Land',crop:'Rice',plots:[{id:'field',name:'Field',crop:'Rice'}]}]};
  const html = renderWorkspace('/notifications',state);
  const [pending,completed] = html.split('class="notification-completed"');
  assert.match(pending, /data-id="third"/);
  assert.doesNotMatch(pending,/data-id="second"|data-id="first"/);
  assert.match(completed,/data-id="second"/);
  assert.doesNotMatch(completed,/data-id="third"/);
  assert.match(completed,/data-id="first"/);
});

test('map popup lists latest completed work separately and keeps next task pending', () => {
  const html = renderFieldSchedules(TASKS,'land','field',new Date('2030-01-03T08:00:00'));
  assert.match(html,/<h3>Pending<\/h3>/);
  assert.match(html,/data-care-task="third"/);
  const completed = html.split('field-care-completed')[1];
  assert.match(completed,/Completed/);
  assert.match(completed,/2030-01-02/);
  assert.doesNotMatch(completed,/2030-01-01|2030-01-03|data-care-complete/);
});

test('short recurring schedules display one active round while preserving partial completion', () => {
  const farm = {id:'land', name:'Land', plots:[{id:'one',name:'Field 1',crop:'Rice'},{id:'two',name:'Field 2',crop:'Rice'}]};
  const base = {...TASK, scheduleId:'cycle', repeat:'custom', repeatInterval:30, repeatUnit:'minutes', endDate:'2030-01-01'};
  const tasks = [
    {...base,id:'one-done',plotId:'one',done:true,completedAt:'2030-01-01T08:00:00'},
    {...base,id:'two-pending',plotId:'two',done:false},
    {...base,id:'one-next',plotId:'one',done:false,time:'08:30',repeatFromId:'one-done'},
  ];
  const html = renderScheduledAgenda(farm,tasks,'2030-01-01');
  assert.equal((html.match(/data-schedule-group/g) ?? []).length,1);
  assert.match(html,/Field 1/);
  assert.match(html,/Field 2/);
  assert.match(html,/data-id="two-pending"/);
  assert.doesNotMatch(html,/data-id="one-next"/);
  assert.equal(tasks.length,3);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderFieldSchedules } from '../src/field-care.mjs';
import { latestCompletedTasks } from '../src/task-history.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

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
  assert.doesNotMatch(completed,/data-id="third"|data-id="first"/);
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

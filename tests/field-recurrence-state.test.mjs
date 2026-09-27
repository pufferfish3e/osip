import assert from 'node:assert/strict';
import { test } from 'node:test';
import { completeFieldSchedule, renderFieldSchedules } from '../src/field-care.mjs';
import { canCompleteTask } from '../src/actions.mjs';
import { fieldTaskUrgency, renderFieldTaskMarker } from '../src/land-map.mjs';

const FIELD = { id: 'plot-1', name: 'Field 1', crop: 'Rice', area: 1 };
const TASK = { id: 'original', farmId: 'farm-1', plotId: FIELD.id, title: 'Check water', category: 'Water', dueDate: '2000-06-20', time: '08:00', done: false, reminder: false, repeat: 'custom', repeatUnit: 'days', repeatInterval: 1 };
const NOW = new Date('2000-06-20T09:00:00');

test('completed daily occurrence and its future recurrence agree in marker and popup', () => {
  const state = { farms:[{id:'farm-1',plots:[FIELD]}], tasks: [structuredClone(TASK)] };
  completeFieldSchedule(state, 'farm-1', FIELD.id, TASK.id);
  const next = state.tasks.at(-1);
  assert.equal(fieldTaskUrgency(state.tasks, 'farm-1', FIELD.id, NOW).urgency, 'upcoming');
  const marker = renderFieldTaskMarker(FIELD, state.tasks, 'farm-1', NOW);
  assert.match(marker, /Scheduled later/);
  assert.doesNotMatch(marker, /is-task-complete|All done today!/);
  const popup = renderFieldSchedules(state.tasks, 'farm-1', FIELD.id, NOW);
  assert.match(popup, /Next occurrence · Scheduled later/);
  assert.match(popup, /2000-06-21/);
  assert.match(popup, /<h3>.*Completed<\/h3>/);
  assert.match(popup, new RegExp(`data-care-task="${next.id}"`));
  assert.doesNotMatch(popup, /data-care-complete=|data-care-task="original"/);
});

test('minute recurrence offers completion inside the two-hour window', () => {
  const state = { farms:[{id:'farm-1',plots:[FIELD]}], tasks: [{ ...TASK, repeatUnit: 'minutes', repeatInterval: 30 }] };
  completeFieldSchedule(state, 'farm-1', FIELD.id, TASK.id);
  const before = new Date('2000-06-20T08:10:00');
  assert.equal(fieldTaskUrgency(state.tasks, 'farm-1', FIELD.id, before).urgency, 'soon');
  assert.match(renderFieldSchedules(state.tasks, 'farm-1', FIELD.id, before), /data-care-complete=/);
  const after = new Date('2000-06-20T08:31:00');
  assert.equal(fieldTaskUrgency(state.tasks, 'farm-1', FIELD.id, after).urgency, 'overdue');
  assert.match(renderFieldSchedules(state.tasks, 'farm-1', FIELD.id, after), /Next occurrence · Overdue/);
  assert.match(renderFieldSchedules(state.tasks, 'farm-1', FIELD.id, after), /data-care-complete=/);
});

test('finished nonrecurring work is read-only instead of opening schedule setup', () => {
  const tasks = [{ ...TASK, repeat: 'none', done: true }];
  assert.equal(fieldTaskUrgency(tasks, 'farm-1', FIELD.id, NOW).urgency, 'complete');
  const popup = renderFieldSchedules(tasks, 'farm-1', FIELD.id, NOW);
  assert.match(popup, /<h3>.*Completed<\/h3>/);
  assert.doesNotMatch(popup, /data-care-complete|data-care-schedule/);
});

test('task becomes available exactly two hours before its local scheduled time', () => {
  assert.equal(canCompleteTask(TASK, new Date('2000-06-20T05:59:59')), false);
  assert.equal(canCompleteTask(TASK, new Date('2000-06-20T06:00:00')), true);
  assert.equal(canCompleteTask(TASK, NOW), true);
  assert.equal(canCompleteTask({ ...TASK, done:true }, NOW), false);
  assert.equal(canCompleteTask({ ...TASK, dueDate:'invalid' }, NOW), false);
});

test('future occurrence is greyed out and its actions disabled', () => {
  const html = renderFieldSchedules([TASK], 'farm-1', FIELD.id, new Date('2000-06-19T09:00:00'));
  assert.match(html, /is-task-unavailable/);
  assert.match(html, /disabled>Scheduled later/);
  assert.match(html, /data-care-skip="original" disabled/);
  assert.doesNotMatch(html, /data-care-complete/);
  const available = renderFieldSchedules([TASK], 'farm-1', FIELD.id, new Date('2000-06-20T06:00:00'));
  assert.match(available, /data-care-complete="original"/);
  assert.doesNotMatch(available, /is-task-unavailable/);
});

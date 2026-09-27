import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction } from '../src/actions.mjs';
import { completeFieldSchedule, fieldCareState, recordFieldCare, renderFieldSchedules } from '../src/field-care.mjs';
import { createStore } from '../src/store.mjs';

const createTask = (overrides = {}) => ({ id: 'care-1', farmId: 'farm-1', plotId: 'plot-1', title: 'Feed crop', category: 'Fertilizer', dueDate: '2026-09-01', time: '08:00', done: false, reminder: false, ...overrides });

test('care state distinguishes no record, actual completion and overdue plans', () => {
  assert.deepEqual(fieldCareState([], 'farm-1', 'plot-1', 'Fertilizer'), { last: '', next: undefined, isOverdue: false });
  const completed = createTask({ done: true, completedAt: '2026-09-20T08:00:00Z' });
  const plan = createTask({ id: 'care-2', dueDate: '2026-09-26', reminder: true });
  const care = fieldCareState([completed, plan], 'farm-1', 'plot-1', 'Fertilizer', '2026-09-27');
  assert.equal(care.last, completed.completedAt);
  assert.equal(care.next.id, 'care-2');
  assert.equal(care.isOverdue, true);
  assert.equal(fieldCareState([completed], 'farm-1', 'plot-2', 'Fertilizer').last, '');
  assert.equal(fieldCareState([completed], 'farm-1', 'plot-1', 'Pesticide').last, '');
});

test('whole-land work applies to its fields without inferring completion from a due date', () => {
  const task = createTask({ plotId: '', done: true });
  assert.equal(fieldCareState([task], 'farm-1', 'plot-1', 'Fertilizer').last, '');
  task.completedAt = '2026-09-20T08:00:00Z';
  assert.equal(fieldCareState([task], 'farm-1', 'plot-2', 'Fertilizer').last, task.completedAt);
});

test('recording care persists without enabling reminders and rejects invalid fields', () => {
  const records = new Map();
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const store = createStore(storage);
  store.update((state) => {
    state.farms = [{ id:'farm-1', name:'Land 1', crop:'Rice', area:1, unit:'ha', location:'Perak', plantedAt:'', plots:[{ id:'plot-1', name:'Field 1', crop:'Rice', area:1, plantedAt:'' }] }];
  });
  store.update((state) => recordFieldCare(state, 'farm-1', 'plot-1', 'Pesticide'));
  const task = createStore(storage).getState().tasks.at(-1);
  assert.equal(task.done, true);
  assert.equal(task.reminder, false);
  assert.equal(task.repeat, 'none');
  assert.ok(Number.isFinite(Date.parse(task.completedAt)));
  const count = store.getState().tasks.length;
  store.update((state) => recordFieldCare(state, 'farm-1', 'plot-1', 'Pesticide'));
  assert.equal(store.getState().tasks.length, count);
  assert.throws(() => recordFieldCare(store.getState(), 'farm-1', 'missing', 'Pesticide'));
});

test('completion records the actual timestamp and recurring occurrences start uncompleted', () => {
  const state = { tasks: [createTask({ repeat: 'weekly' })] };
  applyAction(state, 'toggle-task', 'care-1');
  assert.ok(Number.isFinite(Date.parse(state.tasks[0].completedAt)));
  assert.equal(state.tasks[1].completedAt, undefined);
  assert.equal(state.tasks[1].done, false);
  applyAction(state, 'toggle-task', 'care-1');
  assert.equal(state.tasks[0].completedAt, undefined);
});

test('plot schedule setup is optional and only starts after choosing setup', async () => {
  const { renderFieldScheduleChoice } = await import('../src/field-care.mjs');
  const html = renderFieldScheduleChoice();
  assert.match(html, /data-care-schedule/);
  assert.match(html, /data-care-close[^>]*>Not now/);
  assert.doesNotMatch(html, /data-care-record|data-care-remind/);
});

test('field schedules show each pending crop-bound task with complete and skip', () => {
  const tasks = [createTask(), createTask({ id: 'second', category: 'Pesticide' }), createTask({ id: 'other', plotId: 'plot-2' }), createTask({ id: 'done', done: true })];
  const html = renderFieldSchedules(tasks, 'farm-1', 'plot-1');
  assert.equal((html.match(/data-care-complete=/g) ?? []).length, 2);
  assert.equal((html.match(/data-care-skip=/g) ?? []).length, 2);
  assert.doesNotMatch(html, /data-care-task="other"|data-care-task="done"/);
});

test('field completion is scoped, idempotent and creates a recurring occurrence', () => {
  const state = { tasks: [createTask({ repeat: 'weekly' })] };
  assert.throws(() => completeFieldSchedule(state, 'farm-1', 'plot-2', 'care-1'));
  completeFieldSchedule(state, 'farm-1', 'plot-1', 'care-1');
  completeFieldSchedule(state, 'farm-1', 'plot-1', 'care-1');
  assert.equal(state.tasks[0].done, true);
  assert.equal(state.tasks.length, 2);
  assert.equal(state.tasks[1].plotId, 'plot-1');
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import { applyAction, submitForm } from '../src/actions.mjs';
import { createStore } from '../src/store.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { taskRepeatLabel } from '../src/schedule.mjs';

const FIELDS = { farmId: DEMO.farms[0].id, title: 'Check water', dueDate: '2032-02-29', time: '23:45', category: 'Water', repeat: 'custom', reminder: 'on' };

test('custom intervals cross midnight and leap-day boundaries with date and time preserved', () => {
  for (const [repeatUnit, repeatInterval, date, time] of [['minutes', 30, '2032-03-01', '00:15'], ['hours', 6, '2032-03-01', '05:45'], ['days', 2, '2032-03-02', '23:45']]) {
    const state = structuredClone(DEMO);
    submitForm(state, 'task', { ...FIELDS, repeatUnit, repeatInterval: String(repeatInterval) });
    const original = state.tasks.at(-1);
    applyAction(state, 'toggle-task', original.id);
    const next = state.tasks.at(-1);
    assert.equal(next.dueDate, date);
    assert.equal(next.time, time);
    assert.equal(next.repeatInterval, repeatInterval);
    assert.equal(next.repeatUnit, repeatUnit);
    assert.equal(next.reminder, true);
    applyAction(state, 'toggle-task', original.id);
    applyAction(state, 'toggle-task', original.id);
    assert.equal(state.tasks.filter((task) => task.repeatFromId === original.id).length, 1);
  }
});

test('custom interval state survives saving and reloading', () => {
  const storage = new Map();
  const adapter = { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
  const store = createStore(adapter, DEMO, 'demo');
  store.update((state) => submitForm(state, 'task', { ...FIELDS, repeatUnit: 'hours', repeatInterval: '3' }));
  const restored = createStore(adapter, DEMO, 'demo');
  assert.equal(restored.getState().tasks.at(-1).repeatUnit, 'hours');
  assert.equal(restored.getState().tasks.at(-1).repeatInterval, 3);
});

test('invalid intervals and seconds are rejected without creating tasks', () => {
  for (const repeatInterval of ['0', '-1', '1.5', '1000', 'NaN']) {
    assert.throws(() => submitForm(structuredClone(DEMO), 'task', { ...FIELDS, repeatUnit: 'days', repeatInterval }), /interval/);
  }
  assert.throws(() => submitForm(structuredClone(DEMO), 'task', { ...FIELDS, repeatUnit: 'seconds', repeatInterval: '1' }), /interval/);
});

test('custom repeat controls and readable labels replace the new-task preset list', () => {
  const html = renderWorkspace(`/farm/${DEMO.farms[0].id}/schedule`, DEMO);
  assert.match(html, /name="repeatInterval" min="1" max="999"/);
  assert.match(html, /name="repeatUnit"/);
  assert.match(html, /value="minutes"/);
  assert.match(html, /value="hours"/);
  assert.match(html, /value="days"/);
  assert.doesNotMatch(html, /name="repeat" value="weekly"/);
  assert.equal(taskRepeatLabel({ repeat: 'custom', repeatUnit: 'hours', repeatInterval: 3 }), 'Every 3 hours');
  assert.equal(taskRepeatLabel({ repeat: 'custom', repeatUnit: 'days', repeatInterval: 1 }), 'Every 1 day');
  assert.equal(taskRepeatLabel({ repeat: 'weekly' }), 'Weekly');
});

test('existing weekly and monthly schedules keep their timing and can still be edited', () => {
  for (const [repeat, date] of [['weekly', '2031-02-07'], ['monthly', '2031-02-28']]) {
    const state = structuredClone(DEMO);
    submitForm(state, 'task', { ...FIELDS, dueDate: '2031-01-31', repeat });
    const task = state.tasks.at(-1);
    const html = renderWorkspace(`/farm/${task.farmId}/tasks/${task.id}`, state);
    assert.match(html, new RegExp(`name="repeat" value="${repeat}" checked`));
    applyAction(state, 'toggle-task', task.id);
    assert.equal(state.tasks.at(-1).dueDate, date);
    assert.equal(state.tasks.at(-1).time, FIELDS.time);
  }
});

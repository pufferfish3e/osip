import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderFieldTaskMarker, fieldTaskUrgency } from '../src/land-map.mjs';

const FIELD = { id: 'field-1', name: 'Field <1>', crop: 'Rice', area: 1 };
const NOW = new Date('2030-06-20T12:00:00');
const BASE = { farmId: 'farm-1', plotId: FIELD.id, dueDate: '2030-06-20', time: '14:00', done: false };

test('map marker reflects current completion and tasks remaining rather than invented points', () => {
  const html = renderFieldTaskMarker(FIELD, [{ ...BASE }, { ...BASE, done: true }], 'farm-1', NOW);
  assert.match(html, /--task-progress:50%/);
  assert.match(html, /1 of 2 done today/);
  assert.match(html, /field-task-badge/);
  assert.match(html, /Field &lt;1&gt;/);
  assert.doesNotMatch(html, /is-task-overdue|is-task-complete/);
});

test('completed work earns a check while an empty field stays neutral', () => {
  const complete = renderFieldTaskMarker(FIELD, [{ ...BASE, done: true }], 'farm-1', NOW);
  assert.match(complete, /is-task-complete/);
  assert.match(complete, /All done today!/);
  assert.match(complete, /--task-progress:100%/);
  const empty = renderFieldTaskMarker(FIELD, [], 'farm-1', NOW);
  assert.match(empty, /No tasks today/);
  assert.doesNotMatch(empty, /is-task-complete/);
});

test('overdue work stands out and other fields, farms and future work do not inflate progress', () => {
  const html = renderFieldTaskMarker(FIELD, [{ ...BASE, time: '08:00' }, { ...BASE, plotId: 'field-2' }, { ...BASE, farmId: 'other' }, { ...BASE, dueDate: '2030-06-21' }], 'farm-1', NOW);
  assert.match(html, /is-task-overdue/);
  assert.match(html, /0 of 1 done today/);
});


test('urgency and outline color follow the nearest unfinished task', () => {
  for (const [offsetMinutes, urgency] of [[-1, 'overdue'], [0, 'soon'], [120, 'soon'], [121, 'upcoming']]) {
    const due = new Date(NOW.getTime() + offsetMinutes * 60 * 1000);
    const time = [due.getHours(), due.getMinutes()].map((value) => String(value).padStart(2, '0')).join(':');
    const state = fieldTaskUrgency([{ ...BASE, time }], 'farm-1', FIELD.id, NOW);
    assert.equal(state.urgency, urgency);
    const html = renderFieldTaskMarker(FIELD, [{ ...BASE, time }], 'farm-1', NOW);
    assert.ok(html.includes(`--task-state-color:${state.color}`));
    assert.ok(html.includes(`is-task-${urgency}`));
  }
  assert.equal(fieldTaskUrgency([], 'farm-1', FIELD.id, NOW).urgency, 'idle');
  assert.equal(fieldTaskUrgency([{ ...BASE, done: true }], 'farm-1', FIELD.id, NOW).urgency, 'complete');
});

test('a more urgent unfinished task overrides a completed or later task', () => {
  const tasks = [{ ...BASE, done: true }, { ...BASE, dueDate: '2030-06-21' }, { ...BASE, time: '11:59' }];
  assert.equal(fieldTaskUrgency(tasks, 'farm-1', FIELD.id, NOW).urgency, 'overdue');
  assert.equal(fieldTaskUrgency([{ ...BASE, done: true }, { ...BASE, time: '13:00' }], 'farm-1', FIELD.id, NOW).urgency, 'soon');
  const colors = ['idle', 'complete', 'soon', 'overdue', 'upcoming'].map((urgency) => {
    const task = urgency === 'idle' ? [] : [{ ...BASE, done: urgency === 'complete', time: urgency === 'soon' ? '13:00' : urgency === 'overdue' ? '11:00' : '16:00' }];
    return fieldTaskUrgency(task, 'farm-1', FIELD.id, NOW).color;
  });
  assert.equal(new Set(colors).size, 5);
});

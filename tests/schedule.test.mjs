import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { calendarDate, calendarDays, renderCalendar } from '../src/schedule.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('calendar weeks span month and year boundaries without UTC date shifts', () => {
  assert.deepEqual(calendarDays('2027-01-01', '2027-01', false), ['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03']);
  assert.equal(calendarDate(new Date(2026, 8, 26, 0, 5)), '2026-09-26');
});

test('expanded calendar covers every day including leap February and six-week months', () => {
  const leap = calendarDays('2028-02-01', '2028-02', true);
  assert.ok(leap.includes('2028-02-29'));
  const january = calendarDays('2027-01-01', '2027-01', true);
  assert.ok(january.includes('2027-01-31'));
  assert.equal(calendarDays('2026-08-01', '2026-08', true).length, 42);
});

test('shared calendar exposes selected date and task markers with accessible labels', () => {
  const html = renderCalendar('2026-09-26', '2026-09', true, ['2026-09-26']);
  assert.match(html, /data-calendar-date="2026-09-26" aria-pressed="true"/);
  assert.match(html, /Tasks to do/);
  assert.match(html, /data-calendar-move="-1"/);
});

test('schedule has one task entry point and a five-step sheet using the calendar picker', () => {
  const html = renderWorkspace('/farm/farm-1/schedule', structuredClone(INITIAL_STATE));
  assert.match(html, /data-schedule-calendar/);
  assert.match(html, /data-task-picker/);
  assert.equal((html.match(/data-task-step/g) ?? []).length, 5);
  assert.equal((html.match(/data-form="task"/g) ?? []).length, 1);
  assert.match(html, /data-plan-task/);
  assert.doesNotMatch(html, /name="dueDate" type="date"/);
});

test('task detail offers guided editing with saved values and explicit deletion', () => {
  const state = structuredClone(INITIAL_STATE);
  const task = state.tasks[0];
  const html = renderWorkspace(`/farm/${task.farmId}/tasks/${task.id}`, state);
  assert.match(html, /data-plan-task/);
  assert.match(html, /data-action="delete-task"/);
  assert.equal((html.match(/data-task-step/g) ?? []).length, 5);
  assert.ok(html.includes(`name="id" value="${task.id}"`));
  assert.ok(html.includes(`value="${task.dueDate}"`));
  assert.ok(html.includes(`value="${task.time}"`));
  assert.match(html, /Save changes/);
});

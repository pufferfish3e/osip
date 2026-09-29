import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('notification center lists incomplete tasks even with reminders off and avoids duplicates', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id:'land', name:'Land 1', crop:'Rice', location:'Perak', plots:[] }];
  state.tasks = [{ id:'task', farmId:'land', title:'Water plants', dueDate:'2030-01-01', time:'08:00', category:'Water', done:false, reminder:false }];
  state.notifications = [{ id:'reminder-task-2030-01-01-08:00', title:'Water plants', body:'Due', date:'2030-01-01', read:false }];
  const html = renderWorkspace('/notifications', state);
  assert.match(html, /href="\/farm\/land\/tasks\/task"/);
  assert.equal((html.match(/class="row-title task-status-title"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<h2 class="row-title">Water plants/);
  assert.match(html, /data-action="toggle-task" data-id="task"/);
  applyAction(state, 'toggle-task', 'task');
  assert.equal(state.tasks[0].done, true);
  state.notifications = [];
  assert.doesNotMatch(renderWorkspace('/notifications', state), /Water plants/);
  applyAction(state, 'toggle-task', 'task');
  assert.equal(state.tasks[0].done, false);
  assert.match(renderWorkspace('/notifications', state), /Water plants/);
});

test('updates have compact unread indicators, newest first, and read action', () => {
  const state = structuredClone(INITIAL_STATE);
  state.tasks = [];
  state.notifications = [
    { id:'old', title:'Older update', body:'Saved record', date:'2026-09-26', read:true },
    { id:'new', title:'Latest update', body:'Saved booking', date:'2026-09-27', read:false },
  ];
  const html = renderWorkspace('/notifications', state);
  assert.ok(html.indexOf('Latest update') < html.indexOf('Older update'));
  assert.equal((html.match(/class="notification-unread"/g) ?? []).length, 1);
  assert.match(html, /data-action="mark-notifications-read"/);
  assert.doesNotMatch(html, /badge-blue|button-secondary/);
  applyAction(state, 'mark-notifications-read');
  assert.doesNotMatch(renderWorkspace('/notifications', state), /class="notification-unread"/);
});

test('booking updates use the scheduled task disclosure layout', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [];
  state.tasks = [];
  state.notifications = [{ id:'note-1', title:'Booking request saved', body:'Spraying with Pilot. Saved on this device.', date:'2026-09-29T03:00:00Z', read:false }];
  const html = renderWorkspace('/notifications', state);
  assert.match(html, /<details class="notification-task-stack notification-update-stack is-unread" data-notification-stack="note-1"><summary>/);
  assert.match(html, /<strong>Booking request saved<\/strong>/);
  assert.match(html, /<div class="notification-task-fields notification-update-fields"><p>Spraying with Pilot\. Saved on this device\.<\/p>/);
  assert.match(html, /data-action="mark-notification-read" data-id="note-1"/);
  assert.doesNotMatch(html, /notification-item|notification-icon/);
});

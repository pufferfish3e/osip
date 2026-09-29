import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type:'json' };
import { renderWorkspace } from '../src/workspace.mjs';

const renderTask = (done) => {
  const state = structuredClone(DEMO);
  const farm = state.farms[0];
  state.tasks = [{ id:'layout-task', farmId:farm.id, plotId:farm.plots[0]?.id, title:'Inspect crop', dueDate:'2026-09-28', time:'08:00', category:'General', reminder:false, done }];
  return renderWorkspace(`/farm/${farm.id}/tasks/layout-task`, state);
};

test('task details use compact semantic rows and retain edit/delete controls', () => {
  const html = renderTask(false);
  assert.match(html, /<dl class="task-detail-list">/);
  assert.match(html, /<dt>Date<\/dt>/);
  assert.match(html, /<dt>Time<\/dt><dd>08:00/);
  assert.match(html, /<dt>Field<\/dt>/);
  assert.match(html, /data-plan-task/);
  assert.match(html, /task-detail-delete" data-action="delete-task"/);
  assert.match(html, /data-action="toggle-task"/);
  assert.doesNotMatch(html, /stat-grid/);
});

test('completed task shows status and keeps editable details without a fake action', () => {
  const html = renderTask(true);
  assert.match(html, /task-detail-status/);
  assert.match(html, /Completed/);
  assert.doesNotMatch(html, /data-action="toggle-task"|Reopen task/);
  assert.match(html, /data-plan-task/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('field with no work has one compact empty state and no planting placeholder', () => {
  const state = structuredClone(INITIAL_STATE);
  state.tasks = [];
  state.farms[0].plots[0].plantedAt = '';
  const html = renderWorkspace('/farm/farm-1/plots/plot-1', state);
  assert.equal((html.match(/Your schedule is clear/g) ?? []).length, 1);
  assert.equal((html.match(/Not recorded/g) ?? []).length, 0);
  assert.match(html, /plot-land-work-link/);
  assert.match(html, /0 tasks to do/);
  assert.match(html, /data-plan-task/);
});

test('field and land tasks retain their separate lists and hide empty copy', () => {
  const state = structuredClone(INITIAL_STATE);
  const base = { farmId: 'farm-1', dueDate: '2026-10-01', time: '08:00', category: 'General', done: false, reminder: false };
  state.tasks = [{ ...base, id: 'field-task', plotId: 'plot-1', title: 'Field inspection' }, { ...base, id: 'land-task', title: 'Land inspection' }];
  const html = renderWorkspace('/farm/farm-1/plots/plot-1', state);
  assert.doesNotMatch(html, /Your schedule is clear/);
  assert.match(html, /Field inspection/);
  assert.match(html, /Land inspection/);
  assert.match(html, /1 tasks to do/);
});

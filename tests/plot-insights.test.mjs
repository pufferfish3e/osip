import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const ROUTE = '/farm/farm-1/plots/plot-1';

test('whole-farm plot shows boundary, real area share and farm-wide pending work', () => {
  const state = structuredClone(INITIAL_STATE);
  const html = renderWorkspace(ROUTE, state);
  assert.match(html, /data-farm-map="farm-1"/);
  assert.match(html, /100% of farm area/);
  assert.match(html, /Days since planting/);
  assert.match(html, /Farm-wide work/);
  assert.doesNotMatch(html, /yield|crop health/i);
  state.tasks.forEach((task) => { task.done = true; });
  assert.doesNotMatch(renderWorkspace(ROUTE, state), /data-action="toggle-task"/);
});

test('partial plot shows correct share without claiming a farm boundary is its own', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms[0].plots[0].area = 2.1;
  state.farms[0].plots.push({ ...state.farms[0].plots[0], id: 'plot-2' });
  const html = renderWorkspace(ROUTE, state);
  assert.match(html, /50% of farm area/);
  assert.doesNotMatch(html, /data-farm-map/);
});

test('missing, invalid and future planting dates do not create misleading ages', () => {
  const state = structuredClone(INITIAL_STATE);
  for (const date of ['', 'invalid', '2026-02-30']) {
    state.farms[0].plots[0].plantedAt = date;
    assert.match(renderWorkspace(ROUTE, state), /Not recorded/);
  }
  state.farms[0].plots[0].plantedAt = '2099-01-01';
  assert.match(renderWorkspace(ROUTE, state), /Days until planting/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import { renderWorkspace } from '../src/workspace.mjs';

test('land has a visible task action connected to its existing task sheet', () => {
  const farm = DEMO.farms[0];
  const html = renderWorkspace(`/farm/${farm.id}`, DEMO);
  assert.match(html, /class="button" data-plan-task>/);
  assert.doesNotMatch(html, /data-plan-task hidden/);
  assert.match(html, /Schedule task/);
  assert.ok(html.indexOf('land-task-actions') < html.indexOf('land-summary'));
  assert.match(html, new RegExp(`data-schedule="${farm.id}"`));
  assert.match(html, new RegExp(`name="farmId" value="${farm.id}"`));
  assert.match(html, /name="plotIds"/);
  assert.equal((html.match(/class="task-sheet"/g) ?? []).length, 1);
  assert.equal((html.match(/Open schedule/g) ?? []).length, 1);
});

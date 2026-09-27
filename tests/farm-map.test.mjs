import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const BOUNDARY = [[4.6, 101.1], [4.6, 101.101], [4.601, 101.101]];

test('farm overview offers a regional map and boundary drawing controls', () => {
  const html = renderWorkspace('/farm/farm-1', structuredClone(INITIAL_STATE)).match(/<section class="farm-map"[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(html, /Perak · Regional map|<iframe|Boundaries stay|Open in OpenStreetMap/);
  assert.match(html, /role="toolbar"/);
  assert.match(html, /data-farm-map="farm-1"/);
  for (const action of ['locate', 'edit', 'center', 'save', 'undo', 'clear', 'cancel']) assert.ok(html.includes(`data-land-action="${action}"`));
  assert.match(html, /data-land-action="new"[^>]*aria-label="Add field"[^>]*>[\s\S]*?#plus/);
  assert.match(html, /data-land-action="edit"[^>]*aria-label="Edit field"[^>]*>[\s\S]*?#pencil/);
  assert.match(html, /data-land-action="center"[^>]*>[\s\S]*?#crosshair/);
  assert.match(html, /data-land-canvas/);
  assert.match(html, /data-land-tools hidden/);
  assert.match(html, /class="sr-only" role="status"/);
});

test('saved farm offers editing without exposing boundary coordinates in HTML', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms[0].boundary = BOUNDARY;
  const html = renderWorkspace('/farm/farm-1', state).match(/<section class="farm-map"[\s\S]*?<\/section>/)[0];
  assert.match(html, /data-field-details hidden role="dialog"/);
  assert.match(html, /Edit field/);
  assert.doesNotMatch(html, /101\.101/);
});

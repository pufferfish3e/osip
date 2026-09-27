import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('selecting land opens its boundary editor directly with matrix save and land deletion', () => {
  const html = renderWorkspace('/farm/farm-1', INITIAL_STATE);
  assert.match(html, /data-land-editor="farm-1"/);
  assert.match(html, /data-point-action="add"/);
  assert.match(html, /data-point-action="move"/);
  assert.match(html, /data-point-action="remove"/);
  assert.match(html, /Save and choose field dimensions/);
  assert.match(html, /data-point-action="delete-land"/);
  assert.doesNotMatch(html, /data-land-action="new"/);
  assert.doesNotMatch(html, /data-farm-map/);
});
test('field details do not offer manual field creation', () => {
  const state=structuredClone(INITIAL_STATE);
  state.farms[0].plots[0].boundary=[[4,101],[4,101.002],[4.002,101.002],[4.002,101]];
  assert.doesNotMatch(renderWorkspace('/farm/farm-1/plots/plot-1', state), /data-land-action="new"/);
});

test('add land uses map controls without coordinate inputs or a point dropdown', () => {
  const html = renderWorkspace('/farm/new', INITIAL_STATE);
  assert.match(html, /Create point/);
  assert.match(html, /Update point/);
  assert.match(html, /Delete point/);
  assert.doesNotMatch(html, /data-point-select|data-point-lat|data-point-lng|data-point-action="coordinates"/);
});

test('completed land shows its field map without setup or field editing controls', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms[0].plots[0].boundary = [[4,101],[4,101.002],[4.002,101.002],[4.002,101]];
  const html = renderWorkspace('/farm/farm-1', state);
  assert.match(html, /data-land-overview="true"/);
  assert.match(html, /data-map-type/);
  assert.match(html, /href="\/farm\/farm-1\/edit"/);
  assert.doesNotMatch(html, /data-land-editor|data-point-action|data-land-action|data-land-step/);
  assert.match(renderWorkspace('/farm/farm-1/edit', state), /data-land-editor="farm-1"/);
});

test('land without fields or with unfinished crops retains setup controls', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms[0].plots[0].boundary = [[4,101],[4,101.002],[4.002,101.002],[4.002,101]];
  state.farms[0].plots[0].crop = '';
  assert.match(renderWorkspace('/farm/farm-1', state), /data-land-editor/);
  state.farms[0].plots = [];
  assert.match(renderWorkspace('/farm/farm-1', state), /data-land-editor/);
});

test('land summary uses field and crop counts and matching crop emoji', () => {
  const state = structuredClone(INITIAL_STATE);
  const html = renderWorkspace('/farm/farm-1', state);
  assert.match(html, /land-summary/);
  assert.match(html, /field-list-emoji[^>]*>🌾/);
  assert.match(html, /Crop types/);
  assert.doesNotMatch(html, />Tasks to do<|>Completed</);
});

test('land editor uses two steps without manual location entry', () => {
  for (const route of ['/farm/new', '/farm/farm-1/edit']) {
    const html = renderWorkspace(route, INITIAL_STATE);
    assert.match(html, />1 \/ 2<\/p>/);
    assert.match(html, /name="name"/);
    assert.doesNotMatch(html, /name="location"|data-land-step="2"/);
  }
});

test('completed land groups map type and accessible edit pencil without a separate edit link', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms[0].plots[0].boundary = [[4,101],[4,101.002],[4.002,101.002],[4.002,101]];
  const html = renderWorkspace('/farm/farm-1', state);
  assert.match(html, /land-overview-controls[\s\S]*data-map-type[\s\S]*land-overview-edit/);
  assert.match(html, /class="icon-button land-overview-edit" href="\/farm\/farm-1\/edit" aria-label="Edit land"/);
  assert.equal((html.match(/href="\/farm\/farm-1\/edit"/g) ?? []).length, 1);
  assert.doesNotMatch(html, />Edit land<\/a>/);
});

test('land cards use photo overlays, pill links and different parcel images', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms.push({ ...state.farms[0], id: 'second-land', name: 'Second parcel' });
  const html = renderWorkspace('/farm', state);
  assert.match(html, /learning-photo-card farm-card/);
  assert.ok(html.includes('/assets/farm.jpg'));
  assert.ok(html.includes('/assets/crops.jpg'));
  assert.match(html, /View my land/);
  assert.match(html, /href="\/farm\/second-land"/);
});

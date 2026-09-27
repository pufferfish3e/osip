import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderHome } from '../src/home.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('weather opens independently of land records, including legacy links', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [];
  const html = renderWorkspace('/weather', state);
  assert.match(html, /forecast-panel/);
  assert.match(html, /href="\/"/);
  assert.doesNotMatch(html, /href="\/farm/);
  assert.equal(renderWorkspace('/weather/farm-1', state), html);
});

test('home weather card uses the general route', () => {
  const html = renderHome(structuredClone(INITIAL_STATE));
  assert.match(html, /weather-preview card" href="\/weather"/);
  assert.doesNotMatch(html, /href="\/weather\//);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import NEW_USER from '../data/newuser.json' with { type: 'json' };
import { renderWorkspace } from '../src/workspace.mjs';
import { renderHome } from '../src/home.mjs';
import { renderDiscover } from '../src/discover.mjs';

test('weather replaces calculator shortcuts on home and services', () => {
  for (const html of [renderHome(DEMO), renderDiscover('/services', DEMO)]) {
    assert.match(html, /href="\/weather"/);
    assert.doesNotMatch(html, /href="\/tools"/);
  }
});
test('weather shortcut works with existing land or an empty account', () => {
  for (const state of [DEMO, NEW_USER]) {
    const html = renderWorkspace('/weather', state);
    assert.match(html, /forecast-panel/);
    assert.match(html, /Sample forecast · not live/);
    assert.doesNotMatch(html, /Farm not found|undefined/);
  }
});

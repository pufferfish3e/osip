import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { INITIAL_STATE, PILOTS } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('pilot catalogue removes the sample notice and groups matching and search controls', () => {
  const html = renderDiscover('/services/pilots', INITIAL_STATE);
  assert.doesNotMatch(html, /Sample pilots|Requests stay on this device/);
  assert.match(html, /class="pilot-catalog-controls"><div class="search-field">[\s\S]*data-search="pilots"[\s\S]*class="icon-button pilot-search-match" data-match-open aria-label="Find my pilot"/);
  assert.equal((html.match(/data-match-open/g) ?? []).length, 1);
  assert.doesNotMatch(html, /class="button" data-match-open/);
  assert.match(html, /data-pilot-wizard/);
  for (const pilot of PILOTS) assert.ok(html.includes(pilot.name));
});

test('catalogue search preserves bottom spacing and keeps the matching icon visible', () => {
  assert.match(STYLES, /\.pilot-catalog-controls\s*\{[^}]*margin-bottom:24px;/);
  assert.match(STYLES, /\.pilot-search-match\s*\{[^}]*flex-shrink:0;/);
});

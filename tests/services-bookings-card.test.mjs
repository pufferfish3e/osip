import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';

test('services shows an image booking card and omits the weather shortcut', () => {
  const html = renderDiscover('/services', INITIAL_STATE);
  assert.match(html, /class="media-card learning-photo-card services-feature-card" href="\/bookings"/);
  assert.match(html, /\/assets\/drone.jpg/);
  assert.match(html, /Your bookings/);
  assert.match(html, /View bookings/);
  assert.doesNotMatch(html, /href="\/weather"/);
  assert.match(html, /href="\/services\/pilots"/);
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createMapLayer } from '../src/land-map.mjs';

test('street and satellite allow closer zoom without requesting unsupported tile levels', () => {
  const captured = [];
  const leaflet = { tileLayer: (url, options) => { captured.push({ url, options }); return {}; } };
  createMapLayer(leaflet, 'street');
  createMapLayer(leaflet, 'satellite');
  for (const { options } of captured) {
    assert.equal(options.maxZoom, 22);
    assert.equal(options.maxNativeZoom, 19);
    assert.ok(options.attribution);
  }
});

test('land maps explicitly enable pinch, wheel, and button zoom', () => {
  for (const name of ['land-map', 'land-editor', 'land-setup']) {
    const source = readFileSync(new URL(`../src/${name}.mjs`, import.meta.url), 'utf8');
    assert.match(source, /scrollWheelZoom: true, touchZoom: true, zoomControl: true/);
  }
});

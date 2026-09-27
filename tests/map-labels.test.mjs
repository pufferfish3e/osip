import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { fieldCareLabel } from '../src/field-care.mjs';

const TASK = { id: 'care', farmId: 'land', plotId: 'field', title: 'Fertilize', category: 'Fertilizer', dueDate: '2099-01-01', time: '08:00', done: false, reminder: true };

test('empty field care produces no unexplained placeholders', () => {
  assert.equal(fieldCareLabel([], 'land', 'field'), '');
});

test('scheduled care spells out the category and keeps its status accessible', () => {
  const html = fieldCareLabel([TASK], 'land', 'field');
  assert.match(html, /Fertilizer ◷/);
  assert.match(html, /aria-label="Fertilizer · Scheduled"/);
  assert.doesNotMatch(html, />F |P —/);
});

test('land maps remove only Leaflet branding and retain provider attribution', () => {
  for (const name of ['land-map', 'land-editor', 'land-setup']) {
    const source = readFileSync(new URL(`../src/${name}.mjs`, import.meta.url), 'utf8');
    assert.match(source, /attributionControl\?\.setPrefix\(false\)/);
    assert.doesNotMatch(source, /attributionControl:\s*false/);
  }
  const layers = readFileSync(new URL('../src/land-map.mjs', import.meta.url), 'utf8');
  assert.match(layers, /attribution:.*Esri/);
  assert.match(layers, /attribution:.*OpenStreetMap/);
});

test('field markers use crop-only pills with accessible field names and glass fallback', () => {
  const source = readFileSync(new URL('../src/land-map.mjs', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(source, /aria-label="\$\{escapeHtml\(field.name\)\}/);
  assert.match(source, /<span aria-hidden="true">\$\{cropEmoji\(field.crop\)\}<\/span>/);
  assert.doesNotMatch(source, /<strong>\$\{cropEmoji\(field.crop\)\}/);
  assert.match(styles, /\.field-care-label\.leaflet-tooltip[^}]*border-radius:999px/);
  assert.match(styles, /prefers-reduced-transparency:reduce/);
  assert.match(styles, /\.field-care-map-button[^}]*min-height:44px/);
});

test('overview controls use an opaque surface while crop labels retain glass styling', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.land-map-toolbar\.land-overview-controls[^}]*background:#fff;[^}]*backdrop-filter:none/);
  assert.match(styles, /\.field-care-label\.leaflet-tooltip[^}]*backdrop-filter:blur\(14px\)/);
});

test('expand-map icon has no rounded border', () => {
  const styles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(styles, /\.land-overview-controls \.land-map-expand \{ border:0; border-radius:0; \}/);
});

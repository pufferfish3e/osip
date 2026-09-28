import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { splitLand, saveLandGrid } from '../src/land-grid.mjs';
import { fieldAreaHectares } from '../src/field-boundary.mjs';
import { createStore } from '../src/store.mjs';
import { renderLandSetup } from '../src/land-setup.mjs';
import { setLocale } from '../src/i18n.mjs';
import DEMO from '../data/demo.json' with {type:'json'};
const QUAD = [[4,101],[4,101.004],[4.002,101.003],[4.003,101]];

test('6 × 1 and 3 × 2 cover a skewed parcel with equal local projected areas', () => {
  for (const [columns, rows] of [[6,1],[3,2],[1,6],[1,1]]) {
    const fields = splitLand(QUAD, columns, rows);
    assert.equal(fields.length, columns * rows);
    const areas = fields.map(fieldAreaHectares);
    const total = fieldAreaHectares(QUAD);
    assert.ok(Math.abs(areas.reduce((sum, value) => sum + value, 0) - total) / total < 0.00001);
    areas.forEach((value) => assert.ok(Math.abs(value - total / fields.length) / value < 0.00001));
    fields.forEach((field) => field.forEach(([lat,lng]) => { assert.ok(lat >= 4 && lat <= 4.003); assert.ok(lng >= 101 && lng <= 101.004); }));
  }
});
test('invalid subdivisions and incomplete crop assignment cannot create land', () => {
  for (const counts of [[0,1],[-1,1],[1.5,2],[101,1],[NaN,1]]) assert.throws(() => splitLand(QUAD,...counts));
  const state = { farms: [] };
  assert.throws(() => saveLandGrid(state, {name:'North',location:'Perak',boundary:QUAD,columns:6,rows:1,crops:['Rice']}));
  assert.equal(state.farms.length,0);
});
test('multiple land parcels and independent crops persist without changing existing records', () => {
  const records = new Map(); const storage = {getItem:(key)=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
  const store = createStore(storage,DEMO,'demo'); const before = store.getState();
  store.update((state) => saveLandGrid(state,{name:'North',location:'Perak',boundary:QUAD,columns:6,rows:1,crops:['Rice','Coconut','Rice','Vegetables','Oil palm','Beans']}));
  const reloaded = createStore(storage,DEMO,'demo').getState();
  assert.equal(reloaded.farms.length,before.farms.length+1);
  assert.deepEqual(reloaded.farms[0],before.farms[0]);
  assert.deepEqual(reloaded.farms.at(-1).plots.map((field)=>field.crop),['Rice','Coconut','Rice','Vegetables','Oil palm','Beans']);
  assert.deepEqual(reloaded.tasks,before.tasks);
});
test('setup exposes map, grid dimensions and translated crop controls', () => {
  try { for (const locale of ['en','ms','zh-Hans']) { setLocale(locale); const html=renderLandSetup(); assert.match(html,/name="columns"/); assert.match(html,/name="rows"/); assert.match(html,/data-grid-crop="Rice"/); if(locale!=='en') assert.doesNotMatch(html,/>Add land</); } } finally {setLocale('en');}
});

test('field editing cannot move a field outside a bounded land parcel', async () => {
  const { saveFieldBoundary } = await import('../src/field-boundary.mjs');
  const state = { farms: [] };
  const id = saveLandGrid(state,{name:'North',location:'Perak',boundary:QUAD,columns:1,rows:1,crops:['Rice']});
  const plot = state.farms[0].plots[0];
  assert.throws(() => saveFieldBoundary(state,id,{plotId:plot.id,name:plot.name,crop:plot.crop,boundary:QUAD.map(([lat,lng])=>[lat+0.1,lng])}), /inside your land/);
});

test('farmer onboarding continues to land selection without making an empty parcel', async () => {
  const { submitForm } = await import('../src/actions.mjs');
  const { INITIAL_STATE } = await import('../src/data.mjs');
  const state = structuredClone(INITIAL_STATE);
  const count = state.farms.length;
  const result = submitForm(state,'land-onboarding',{name:'A farmer'});
  assert.equal(result.redirect,'/farm/new');
  assert.equal(state.farms.length,count);
  assert.equal(state.profile.role,'farmer');
});


test('land setup derives rough coordinates without asking for a location', () => {
  assert.doesNotMatch(renderLandSetup(), /name="location"/);
  const state = { farms: [] };
  saveLandGrid(state, { name: '', boundary: QUAD, columns: 1, rows: 1, crops: ['Rice'] });
  assert.equal(state.farms[0].location, '4.00125, 101.00175');
  assert.deepEqual(state.farms[0].boundary.length, 4);
});

test('dimensions follow the map with compact controls and one continue action', () => {
  const html = renderLandSetup();
  assert.ok(html.indexOf('data-grid-map') < html.indexOf('data-grid-details'));
  assert.match(html, /land-grid-map-tools/);
  assert.match(html, /land-grid-dimensions/);
  assert.match(html, /data-grid-count/);
  assert.match(html, /data-grid-submit>Continue/);
  assert.doesNotMatch(html, /Columns × rows:|Map areas are estimates/);
});

test('dimension preview draws each field and reports invalid counts', () => {
  const source = readFileSync(new URL('../src/land-setup.mjs', import.meta.url), 'utf8');
  const start = source.indexOf('  const redraw = () => {');
  const end = source.indexOf('  const refresh =', start);
  let columns = 3;
  const polygons = [];
  const count = { textContent: '' };
  const error = { textContent: '' };
  const context = {
    Error,
    draft: { points: QUAD, isAssigning: false }, layers: { clearLayers: () => { polygons.length = 0; } },
    leaflet: { circleMarker: () => ({ addTo() {} }), polygon: (points) => ({ addTo() { polygons.push(points); } }) },
    form: { elements: { namedItem: (name) => ({ value: name === 'columns' ? columns : 2 }) } },
    panel: { querySelector: () => count }, error, splitLand, t: (text) => text,
  };
  runInNewContext(`${source.slice(start, end)} globalThis.preview = redraw;`, context);
  context.preview();
  assert.equal(count.textContent, '6');
  assert.equal(polygons.length, 7);
  columns = 0;
  context.preview();
  assert.equal(count.textContent, '—');
  assert.match(error.textContent, /whole rows and columns/);
});

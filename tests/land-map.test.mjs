import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cropEmoji, labelFieldCrop, initializeLandMap, savedMapType, saveMapType } from '../src/land-map.mjs';
import { normalizeFieldBoundary } from '../src/field-boundary.mjs';
import { createStore } from '../src/store.mjs';

class ElementStub {
  constructor(action = '') { this.dataset = { landAction: action }; this.disabled = false; this.hidden = false; this.textContent = ''; }
  closest(selector) { return selector === '[data-field-crop-choice]' ? null : this; }
  setAttribute(name, value) { this[name] = value; }
  replaceChildren() {}
  focus() {}
}
const BOUNDARY = [[4.6, 101.1], [4.6, 101.101], [4.601, 101.101], [4.601, 101.1]];

const createHarness = (store, isOverview = false) => {
  const elements = new Map();
  const listeners = new Map();
  const polygons = [];
  const tiles = [];
  const removed = [];
  const map = { setView: () => map, removeLayer: (item) => removed.push(item), on: (name, handler) => listeners.set(name, handler), off: (name) => listeners.delete(name), fitBounds: () => {}, getCenter: () => ({ lat: 4.6, lng: 101.1 }), remove: () => {}, invalidateSize: () => map };
  const layer = { addTo: () => layer, clearLayers: () => {}, on: () => {}, bindTooltip: () => layer };
  const panel = { dataset: { farmMap: 'farm-1', landOverview: String(isOverview) }, querySelector: (selector) => {
    if (!elements.has(selector)) elements.set(selector, new ElementStub());
    return elements.get(selector);
  }, querySelectorAll: () => [], dispatchEvent: () => {}, addEventListener: (name, handler) => listeners.set(`panel-${name}`, handler), removeEventListener: (name) => listeners.delete(`panel-${name}`) };
  const leaflet = { map: () => map, tileLayer: (url, options) => { const tile = { ...layer, url, options }; tile.addTo = () => tile; tiles.push(tile); return tile; }, layerGroup: () => layer, circleMarker: () => layer, latLngBounds: (points) => points, polygon: (points, options) => { polygons.push({ points: structuredClone(points), options }); return layer; } };
  const dispose = initializeLandMap(panel, store, leaflet);
  return { elements, polygons, tiles, removed, listeners, dispose, switchMap: (value) => { const target = new ElementStub(); target.value = value; target.matches = (selector) => selector === '[data-map-type]'; listeners.get('panel-change')({ target }); }, click: (action) => listeners.get('panel-click')({ target: new ElementStub(action), stopPropagation: () => {} }), add: (point) => listeners.get('click')({ latlng: { lat: point[0], lng: point[1] } }) };
};

test('editor saves, highlights, reloads, undoes and cancels boundary edits', () => {
  const previous = { Element: globalThis.Element, HTMLElement: globalThis.HTMLElement, HTMLButtonElement: globalThis.HTMLButtonElement, document: globalThis.document };
  Object.assign(globalThis, { Element: ElementStub, HTMLElement: ElementStub, HTMLButtonElement: ElementStub, document: { createElement: () => new ElementStub() } });
  try {
    const records = new Map();
    const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
    const store = createStore(storage);
    const editor = createHarness(store);
    editor.click('edit');
      editor.click('clear');
    BOUNDARY.forEach(editor.add);
    assert.equal(editor.elements.get('[data-land-action="save"]').disabled, false);
    editor.click('undo');
    assert.equal(editor.elements.get('[data-land-action="save"]').disabled, false);
    editor.add(BOUNDARY[3]);
    editor.click('next');
    assert.equal(editor.elements.get('[data-field-title]').textContent, 'What do you call it?');
    editor.elements.get('[data-field-name]').value = '';
    editor.click('next');
    assert.equal(editor.elements.get('[data-field-error]').textContent, 'Enter a field name.');
    editor.elements.get('[data-field-name]').value = 'Main plot';
    editor.click('next');
    editor.click('back');
    assert.equal(editor.elements.get('[data-field-name]').value, 'Main plot');
    editor.click('next'); editor.click('next');
    assert.equal(editor.elements.get('[data-field-title]').textContent, 'Looks right?');
    editor.click('save');
    assert.deepEqual(store.getState().farms[0].plots[0].boundary, normalizeFieldBoundary(BOUNDARY));
    assert.equal(editor.polygons.at(-1).options.color, '#225e42');
    editor.click('edit'); editor.click('clear'); editor.click('cancel');
    assert.deepEqual(editor.polygons.at(-1).points, normalizeFieldBoundary(BOUNDARY));
    editor.dispose();
    const restored = createHarness(createStore(storage));
    assert.deepEqual(restored.polygons.at(-1).points, normalizeFieldBoundary(BOUNDARY));
    assert.equal(restored.polygons.at(-1).options.color, '#225e42');
    restored.click('new');
    const secondBoundary = BOUNDARY.map(([lat, lng]) => [lat, lng + 0.002]);
    secondBoundary.forEach(restored.add);
    restored.click('next');
    restored.elements.get('[data-field-name]').value = 'East field';
    restored.click('next');
    restored.elements.get('[data-field-crop]').value = 'Coconut';
    restored.click('next'); restored.click('save');
    const savedFarm = createStore(storage).getState().farms[0];
    assert.equal(savedFarm.plots.length, 2);
    assert.deepEqual(savedFarm.plots[0].boundary, normalizeFieldBoundary(BOUNDARY));
    assert.deepEqual(savedFarm.plots[1].boundary, normalizeFieldBoundary(secondBoundary));
    assert.equal(savedFarm.plots[1].crop, 'Coconut');
    restored.dispose();
  } finally { Object.assign(globalThis, previous); }
});

test('map buttons, zoom labels, and editing status follow both translated locales', async () => {
  const { setLocale, t } = await import('../src/i18n.mjs');
  const previous = { Element: globalThis.Element, HTMLElement: globalThis.HTMLElement, HTMLButtonElement: globalThis.HTMLButtonElement, document: globalThis.document };
  Object.assign(globalThis, { Element: ElementStub, HTMLElement: ElementStub, HTMLButtonElement: ElementStub, document: { createElement: () => new ElementStub() } });
  try {
    for (const locale of ['ms', 'zh-Hans']) {
      setLocale(locale);
      const store = createStore({ getItem: () => null, setItem: () => {} });
      const editor = createHarness(store);
      assert.equal(editor.elements.get('[data-land-status]').className, 'sr-only');
      assert.equal(editor.elements.get('.leaflet-control-zoom-in')['aria-label'], t('Zoom in'));
      editor.click('edit');
      editor.click('clear');
      BOUNDARY.forEach(editor.add);
      assert.equal(editor.elements.get('[data-field-corners]').textContent, t('{count} corners. Mark 3–100 points in boundary order; tap a marked corner to move it.', { count: 4 }));
      editor.click('next'); editor.click('next'); editor.click('next');
    editor.click('save');
      assert.equal(editor.elements.get('[data-field-name]').value, 'Main plot');
      editor.dispose();
    }
  } finally { setLocale('en'); Object.assign(globalThis, previous); }
});

test('map type switching replaces only the basemap and preserves a boundary draft', () => {
  const previous = { Element: globalThis.Element, HTMLElement: globalThis.HTMLElement, HTMLButtonElement: globalThis.HTMLButtonElement, HTMLSelectElement: globalThis.HTMLSelectElement, document: globalThis.document };
  Object.assign(globalThis, { Element: ElementStub, HTMLElement: ElementStub, HTMLButtonElement: ElementStub, HTMLSelectElement: ElementStub, document: { createElement: () => new ElementStub() } });
  try {
    const store = createStore({ getItem: () => null, setItem: () => {} });
    const before = store.getState();
    const editor = createHarness(store);
    editor.click('edit');
    const shape = structuredClone(editor.polygons.at(-1).points);
    editor.switchMap('satellite');
    assert.match(editor.tiles.at(-1).url, /World_Imagery/);
    assert.match(editor.tiles.at(-1).options.attribution, /Esri/);
    assert.ok(editor.removed.includes(editor.tiles[0]));
    editor.switchMap('street');
    assert.match(editor.tiles.at(-1).url, /tile.openstreetmap.org/);
    assert.deepEqual(editor.polygons.at(-1).points, shape);
    assert.deepEqual(store.getState(), { ...before, settings: { ...before.settings, mapType: 'street' } });
    editor.dispose();
  } finally { Object.assign(globalThis, previous); }
});

test('overview draws saved field boundaries without mounting editing inputs or handlers', () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = ElementStub;
  try {
    const store = createStore({ getItem: () => null, setItem: () => {} });
    store.update((state) => { state.farms[0].plots[0].boundary = BOUNDARY; });
    const before = structuredClone(store.getState());
    const overview = createHarness(store, true);
    assert.deepEqual(overview.polygons.at(-1).points, BOUNDARY);
    assert.equal(overview.polygons.at(-2).options.color, '#ffffff');
    assert.equal(overview.polygons.at(-2).options.fill, false);
    assert.ok(overview.polygons.at(-2).options.weight > overview.polygons.at(-1).options.weight);
    assert.equal(overview.polygons.at(-1).options.color, '#075bea');
    assert.equal(overview.polygons.at(-1).options.opacity, 1);
    assert.deepEqual([...overview.listeners.keys()], ['panel-change', 'panel-click', 'panel-keydown']);
    assert.equal(overview.elements.has('[data-field-name]'), false);
    assert.deepEqual(store.getState(), before);
    overview.dispose();
  } finally { globalThis.HTMLElement = previous; }
});

test('crop emoji matching is stable, multilingual and uses a neutral unknown fallback', () => {
  for (const [crop, emoji] of [['Rice', '🌾'], ['Padi', '🌾'], ['水稻', '🌾'], ['Coconut', '🥥'], ['Kelapa sawit', '🌴'], ['Oil palm', '🌴'], ['Vegetables', '🥬'], ['Red chilli', '🌶️'], ['番茄', '🍅'], ['Jagung', '🌽'], ['Other', '🌱'], ['Unknown crop', '🌱'], ['riceweed', '🌱']]) {
    assert.equal(cropEmoji(crop), emoji);
    assert.equal(cropEmoji(crop), cropEmoji(crop));
  }
});

test('crop labels stay centred, allow map gestures and escape custom names', () => {
  let captured;
  const polygon = { bindTooltip: (content, options) => { captured = { content, options }; return polygon; } };
  labelFieldCrop(polygon, '<img src=x onerror="bad()">');
  assert.doesNotMatch(captured.content, /<img/);
  assert.match(captured.content, /&lt;img/);
  assert.equal(captured.options.direction, 'center');
  assert.equal(captured.options.permanent, true);
  assert.equal(captured.options.interactive, false);
  captured = undefined;
  labelFieldCrop(polygon, '');
  assert.equal(captured, undefined);
});

test('map preference persists across reloads and repeated selection does not recreate layers', () => {
  const previous = globalThis.HTMLElement;
  globalThis.HTMLElement = ElementStub;
  try {
    const records = new Map();
    const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
    const store = createStore(storage);
    assert.equal(savedMapType(store), 'street');
    assert.equal(saveMapType(store, 'satellite'), true);
    assert.equal(saveMapType(store, 'satellite'), false);
    assert.equal(saveMapType(store, 'invalid'), false);
    const restored = createStore(storage);
    assert.equal(savedMapType(restored), 'satellite');
    const overview = createHarness(restored, true);
    assert.match(overview.tiles[0].url, /World_Imagery/);
    const boundaries = structuredClone(overview.polygons);
    overview.switchMap('street');
    assert.equal(savedMapType(restored), 'street');
    assert.match(overview.tiles.at(-1).url, /tile.openstreetmap.org/);
    assert.deepEqual(overview.polygons, boundaries);
    const count = overview.tiles.length;
    overview.switchMap('street');
    assert.equal(overview.tiles.length, count);
    overview.dispose();
    assert.equal(overview.listeners.size, 0);
  } finally { globalThis.HTMLElement = previous; }
});

test('editor accepts a fifth corner and restores all points when editing', () => {
  const previous = { Element: globalThis.Element, HTMLElement: globalThis.HTMLElement, HTMLButtonElement: globalThis.HTMLButtonElement, document: globalThis.document };
  Object.assign(globalThis, { Element: ElementStub, HTMLElement: ElementStub, HTMLButtonElement: ElementStub, document: { createElement: () => new ElementStub() } });
  try {
    const records = new Map();
    const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
    const store = createStore(storage);
    const editor = createHarness(store);
    editor.click('edit');
    editor.click('clear');
    const boundary = [...BOUNDARY, [4.6005, 101.0995]];
    boundary.forEach(editor.add);
    assert.equal(editor.elements.get('[data-land-action="save"]').disabled, false);
    editor.click('save');
    assert.deepEqual(store.getState().farms[0].plots[0].boundary, boundary);
    editor.click('edit');
    assert.match(editor.elements.get('[data-field-corners]').textContent, /5 corners/);
    editor.dispose();
  } finally {
    Object.assign(globalThis, previous);
  }
});

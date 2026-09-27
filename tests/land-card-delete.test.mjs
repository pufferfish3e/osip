import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import { renderWorkspace } from '../src/workspace.mjs';
import { initializeLandCardDeletion } from '../src/land-editor.mjs';
import { createStore } from '../src/store.mjs';
import { deleteLandRecord } from '../src/land-records.mjs';

class ButtonStub {
  constructor(dataset = {}, attribute = '') { this.dataset = dataset; this.attribute = attribute; }
  closest() { return this; }
  hasAttribute(name) { return name === this.attribute; }
}

test('land trash buttons are accessible siblings of links, with one confirmation sheet', () => {
  const html = renderWorkspace('/farm', DEMO);
  assert.equal((html.match(/data-land-card-delete=/g) ?? []).length, DEMO.farms.length);
  assert.match(html, /<\/a><button type="button" class="land-card-delete"/);
  assert.match(html, /aria-label="Delete /);
  assert.equal((html.match(/data-card-delete-sheet/g) ?? []).length, 1);
  assert.match(html, /data-card-delete-cancel autofocus/);
  assert.match(html, /This cannot be undone/);
});

test('opening or cancelling never deletes; only modal confirmation persists deletion', () => {
  const previous = { window: globalThis.window, Element: globalThis.Element };
  const seed = structuredClone(DEMO);
  seed.bookings = [];
  const records = new Map();
  const store = createStore({ getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) }, seed, 'demo');
  const text = new Map();
  const listeners = new Map();
  const sheet = { open: false, style: { removeProperty() {} }, addEventListener: (name, fn) => listeners.set(`sheet-${name}`, fn), querySelector: (selector) => {
    if (!text.has(selector)) text.set(selector, { textContent: '' });
    return text.get(selector);
  }, showModal() { this.open = true; }, close() { this.open = false; listeners.get('sheet-close')?.(); } };
  const list = { querySelector: () => sheet, addEventListener: (name, fn) => listeners.set(name, fn) };
  const root = { querySelector: () => list, dispatchEvent: () => {} };
  const click = (button) => listeners.get('click')({ target: button, preventDefault() {}, stopPropagation() {} });
  try {
    globalThis.window = { gsap: null, matchMedia: () => ({ matches: true }) };
    globalThis.Element = ButtonStub;
    initializeLandCardDeletion(root, store);
    const id = seed.farms[0].id;
    const confirm = new ButtonStub({}, 'data-card-delete-confirm');
    click(confirm);
    assert.equal(store.getState().farms.length, seed.farms.length);
    click(new ButtonStub({ landCardDelete: id }));
    assert.equal(sheet.open, true);
    assert.equal(store.getState().farms.length, seed.farms.length);
    click(new ButtonStub({}, 'data-card-delete-cancel'));
    assert.equal(sheet.open, false);
    assert.equal(store.getState().farms.length, seed.farms.length);
    click(new ButtonStub({ landCardDelete: id }));
    click(confirm);
    assert.equal(sheet.open, false);
    assert.ok(!store.getState().farms.some((land) => land.id === id));
    assert.ok(!store.getState().tasks.some((task) => task.farmId === id));
    const restored = createStore({ getItem: (key) => records.get(key) ?? null, setItem() {} }, seed, 'demo');
    assert.ok(!restored.getState().farms.some((land) => land.id === id));
  } finally { Object.assign(globalThis, previous); }
});

test('existing booking safeguard leaves the land intact', () => {
  const state = structuredClone(DEMO);
  const id = state.farms[0].id;
  state.bookings = [{ farmId: id }];
  assert.throws(() => deleteLandRecord(state, id), /booking records/);
  assert.ok(state.farms.some((land) => land.id === id));
});

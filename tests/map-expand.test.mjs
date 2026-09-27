import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { initializeExpandedMap } from '../src/land-map.mjs';

test('built icon sprite includes both fullscreen control states', () => {
  const sprite = readFileSync(new URL('../assets/icons.svg', import.meta.url), 'utf8');
  assert.match(sprite, /<symbol id="arrows-maximize"/);
  assert.match(sprite, /<symbol id="arrows-minimize"/);
});

const createHarness = (panelOverrides = {}) => {
  const listeners = new Map();
  const attributes = new Map();
  let isExpanded = false;
  let resizeCount = 0;
  const button = { setAttribute: (key, value) => attributes.set(key, value), focus: () => {}, innerHTML: '' };
  const panel = {
    querySelector: () => button,
    classList: { toggle: (name, value) => { isExpanded = value; } },
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: (name) => listeners.delete(name),
    ...panelOverrides,
  };
  const close = initializeExpandedMap(panel, { invalidateSize: () => { resizeCount += 1; } });
  return { listeners, attributes, close, expanded: () => isExpanded, resizes: () => resizeCount };
};

test('expand control fills the map, updates accessible state and closes with Escape', () => {
  const harness = createHarness();
  harness.listeners.get('click')({ target: { closest: () => true }, preventDefault: () => {} });
  assert.equal(harness.expanded(), true);
  assert.equal(harness.attributes.get('aria-expanded'), 'true');
  assert.equal(harness.attributes.get('aria-label'), 'Close expanded map');
  harness.listeners.get('keydown')({ key: 'Escape', preventDefault: () => {} });
  assert.equal(harness.expanded(), false);
  assert.equal(harness.resizes(), 2);
  harness.close();
  assert.equal(harness.listeners.size, 0);
});

test('GSAP animates expansion and collapse and removes its placeholder on completion', () => {
  const previousGsap = globalThis.gsap;
  const previousDocument = globalThis.document;
  const tweens = [];
  let isFullscreen = false;
  let removed = false;
  const compact = { left:20, top:100, width:320, height:400 };
  const full = { left:0, top:0, width:400, height:800 };
  globalThis.gsap = { fromTo: (target, from, to) => { tweens.push({ from, to }); return { kill: () => {} }; } };
  globalThis.document = { createElement: () => ({ style:{}, setAttribute: () => {}, getBoundingClientRect: () => compact, remove: () => { removed = true; } }) };
  try {
    const harness = createHarness({
      style:{ removeProperty: () => {} }, before: () => {},
      getBoundingClientRect: () => isFullscreen ? full : compact,
      classList:{ add: () => { isFullscreen = true; }, toggle: (name, value) => { isFullscreen = value; } },
    });
    const click = () => harness.listeners.get('click')({ target:{ closest: () => true }, preventDefault: () => {} });
    click();
    assert.equal(tweens[0].from.scaleX, 0.8);
    assert.equal(tweens[0].to.scaleX, 1);
    tweens[0].to.onComplete();
    assert.equal(removed, false);
    click();
    assert.equal(tweens[1].to.scaleX, 0.8);
    tweens[1].to.onComplete();
    assert.equal(isFullscreen, false);
    assert.equal(removed, true);
    harness.close();
  } finally {
    globalThis.gsap = previousGsap;
    globalThis.document = previousDocument;
  }
});

test('leaving an expanded map removes expanded state and event handlers', () => {
  const harness = createHarness();
  harness.listeners.get('click')({ target: { closest: () => true }, preventDefault: () => {} });
  harness.close();
  assert.equal(harness.expanded(), false);
  assert.equal(harness.listeners.size, 0);
});

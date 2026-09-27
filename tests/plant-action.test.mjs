import assert from 'node:assert/strict';
import { test } from 'node:test';

import { INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { getMode, initializePlantAction, renderPlantAction } from '../src/plant-action.mjs';
import { renderShell } from '../src/shell.mjs';

const MOBILE_DESTINATIONS = ['/', '/farm', '/services', '/learn'];

/** @param {string} path @returns {Record<string,{innerHTML:string}>} */
const renderNavigation = (path) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const elements = { '#sidebar': { innerHTML: '' }, '#topbar': { innerHTML: '' }, '#bottom-nav': { innerHTML: '' } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: (selector) => elements[selector] } });
  try {
    renderShell(path, INITIAL_STATE);
    return elements;
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
};

test('mobile navigation places the Camera action between Farm and Services', () => {
  const mobile = renderNavigation('/')['#bottom-nav'].innerHTML;
  const destinations = [...mobile.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]);
  const labels = [...mobile.matchAll(/<span>([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(destinations, MOBILE_DESTINATIONS);
  assert.deepEqual(labels, ['Home', 'My land', 'Services', 'Learn']);
  assert.ok(mobile.indexOf('href="/farm"') < mobile.indexOf('data-plant-action'));
  assert.ok(mobile.indexOf('data-plant-action') < mobile.indexOf('href="/services"'));
  assert.match(mobile, /class="plant-action-label"[^>]*>Camera<\/span>/);
});

test('navigation highlights plant tools and retains shop-to-Services selection', () => {
  assert.match(renderNavigation('/plant-help/camera')['#bottom-nav'].innerHTML, /plant-action is-active/);
  const mobile = renderNavigation('/shop')['#bottom-nav'].innerHTML;
  assert.equal((mobile.match(/aria-current="page"/g) ?? []).length, 1);
  assert.ok(mobile.includes('href="/services" aria-current="page"'));
});

class FakeElement {}
class FakeButton extends FakeElement {
  dataset = { mode: 'camera' };
  attributes = new Map();
  disc = { innerHTML: '' };
  label = { textContent: '' };
  closest() { return this; }
  setAttribute(name, value) { this.attributes.set(name, value); }
  querySelector(selector) { return selector === '.plant-action-disc' ? this.disc : this.label; }
}

/** @returns {{dispatch:Function,advance:Function,replace:Function,cleanup:Function,opened:string[],button:FakeButton,dispose:Function}} */
const gestureFixture = () => {
  const originals = new Map(['Element', 'HTMLButtonElement', 'setTimeout', 'clearTimeout'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const timers = new Map();
  const listeners = new Map();
  const opened = [];
  let now = 0;
  let nextTimer = 1;
  let button = new FakeButton();
  Object.defineProperty(globalThis, 'Element', { configurable: true, value: FakeElement });
  Object.defineProperty(globalThis, 'HTMLButtonElement', { configurable: true, value: FakeButton });
  globalThis.setTimeout = (callback, delay) => { const id = nextTimer++; timers.set(id, { callback, due: now + delay }); return id; };
  globalThis.clearTimeout = (id) => { timers.delete(id); };
  const root = { contains: (target) => target === button, addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name) => listeners.delete(name) };
  const dispatch = (type, fields = {}) => {
    const event = { target: button, pointerId: 1, isPrimary: true, button: 0, clientX: 0, clientY: 0, repeat: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...fields };
    listeners.get(type)?.(event);
    return event;
  };
  const cleanup = initializePlantAction({ root, onOpen: (mode) => opened.push(mode) });
  if (getMode() !== 'camera') dispatch('keydown', { key: 'ArrowLeft' });
  return {
    dispatch, opened, cleanup,
    get button() { return button; },
    replace: () => { button = new FakeButton(); },
    advance: (elapsed) => { now += elapsed; for (const [id, timer] of timers) if (timer.due <= now) { timers.delete(id); timer.callback(); } },
    dispose: () => { cleanup(); for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); } },
  };
};

test('a short tap opens Camera exactly once through the native click', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('pointerdown'); fixture.advance(100); fixture.dispatch('pointerup');
    assert.deepEqual(fixture.opened, []);
    fixture.dispatch('click'); fixture.advance(1000);
    assert.deepEqual(fixture.opened, ['camera']);
  } finally { fixture.dispose(); }
});

test('a hold switches mode without opening and suppresses its synthetic click', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('pointerdown'); fixture.advance(550);
    assert.equal(getMode(), 'search');
    assert.equal(fixture.button.label.textContent, 'Search');
    fixture.dispatch('pointerup'); fixture.dispatch('click');
    assert.deepEqual(fixture.opened, []);
    fixture.dispatch('pointerdown'); fixture.dispatch('pointerup'); fixture.dispatch('click');
    assert.deepEqual(fixture.opened, ['search']);
  } finally { fixture.dispose(); }
});

test('pointer cancellation, leaving the navbar, and movement cancel the hold and ensuing click', () => {
  for (const [type, fields] of [['pointercancel', {}], ['pointerleave', {}], ['pointermove', { clientX: 13 }]]) {
    const fixture = gestureFixture();
    try {
      fixture.dispatch('pointerdown'); fixture.dispatch(type, fields); fixture.advance(600);
      fixture.dispatch('pointerup'); fixture.dispatch('click');
      assert.equal(getMode(), 'camera');
      assert.deepEqual(fixture.opened, []);
    } finally { fixture.dispose(); }
  }
});

test('secondary and simultaneous pointers cannot start or finish a hold', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('pointerdown', { isPrimary: false }); fixture.advance(600);
    fixture.dispatch('pointerdown', { button: 2 }); fixture.advance(600);
    assert.equal(getMode(), 'camera');
    fixture.dispatch('pointerdown');
    fixture.dispatch('pointerdown', { pointerId: 2, isPrimary: false });
    fixture.advance(600); fixture.dispatch('pointerup'); fixture.dispatch('click');
    assert.equal(getMode(), 'camera');
    assert.deepEqual(fixture.opened, []);
  } finally { fixture.dispose(); }
});

test('rerendered nodes cannot finish an old hold and delegation works on the replacement', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('pointerdown'); fixture.replace(); fixture.advance(600);
    fixture.dispatch('click');
    assert.equal(getMode(), 'camera');
    assert.deepEqual(fixture.opened, []);
    fixture.dispatch('pointerdown'); fixture.dispatch('pointerup'); fixture.dispatch('click');
    assert.deepEqual(fixture.opened, ['camera']);
  } finally { fixture.dispose(); }
});

test('arrow and context-menu keyboard shortcuts switch without opening, while native activation opens', () => {
  const fixture = gestureFixture();
  try {
    assert.equal(fixture.dispatch('keydown', { key: 'ArrowRight' }).defaultPrevented, true);
    assert.equal(getMode(), 'search');
    fixture.dispatch('keydown', { key: 'F10', shiftKey: true });
    assert.equal(getMode(), 'camera');
    assert.deepEqual(fixture.opened, []);
    fixture.dispatch('keydown', { key: 'Enter' }); fixture.dispatch('click', { detail: 0 });
    fixture.dispatch('keydown', { key: ' ' }); fixture.dispatch('click', { detail: 0 });
    assert.deepEqual(fixture.opened, ['camera', 'camera']);
    assert.equal(fixture.dispatch('keydown', { key: 'Enter', repeat: true }).defaultPrevented, true);
    assert.equal(fixture.dispatch('contextmenu').defaultPrevented, true);
  } finally { fixture.dispose(); }
});

test('mode survives rendering and cleanup removes pending timers and listeners', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('keydown', { key: 'ArrowRight' });
    assert.match(renderPlantAction('/plant-help'), /data-mode="search"/);
    fixture.dispatch('pointerdown'); fixture.cleanup(); fixture.advance(600); fixture.dispatch('click');
    assert.equal(getMode(), 'search');
    assert.deepEqual(fixture.opened, []);
  } finally { fixture.dispose(); }
});

test('assistive activation can open the selected tool after a hold without another pointer gesture', () => {
  const fixture = gestureFixture();
  try {
    fixture.dispatch('pointerdown'); fixture.advance(550); fixture.dispatch('pointerup');
    fixture.dispatch('click', { detail: 0 });
    assert.deepEqual(fixture.opened, ['search']);
  } finally { fixture.dispose(); }
});

test('desktop Learn and Plant help remain reachable from the sidebar', () => {
  const sidebar = renderNavigation('/learn')['#sidebar'].innerHTML;
  assert.match(sidebar, /href="\/learn"/);
  assert.match(sidebar, /href="\/plant-help"/);
});

test('the learning screen keeps guides and courses without the redundant Plant help card', () => {
  const learning = renderDiscover('/learn', INITIAL_STATE);
  assert.doesNotMatch(learning, /href="\/plant-help"/);
  assert.doesNotMatch(learning, /Photo or search/);
  assert.match(learning, /href="\/learn\/knowledge"/);
  assert.match(learning, /href="\/learn\/courses"/);
});

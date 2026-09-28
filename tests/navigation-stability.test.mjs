import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';
import { INITIAL_STATE } from '../src/data.mjs';
import { setLocale } from '../src/i18n.mjs';
import { renderShell, updateNotificationBell } from '../src/shell.mjs';

const element = (href = '') => {
  const attributes = new Map([['href', href]]);
  const classes = new Set();
  return {
    writes: 0, markup: '', children: [],
    get innerHTML() { return this.markup; },
    set innerHTML(value) { this.markup = value; this.writes += 1; },
    classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), contains: (name) => classes.has(name) },
    getAttribute: (name) => attributes.get(name),
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
    append(child) { this.children.push(child); child.remove = () => { this.children = this.children.filter((item) => item !== child); }; },
    querySelector(selector) { return this.children.find((child) => `.${child.className}` === selector) ?? null; },
  };
};

test('route and unread changes retain shell controls; profile and language changes still render', () => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const roots = Object.fromEntries(['#sidebar', '#topbar', '#bottom-nav'].map((key) => [key, element()]));
  const messages = element('/messages');
  const bell = element('/notifications');
  const camera = element();
  camera.mode = 'search';
  const links = ['/', '/farm', '/schedule', '/learn', '/pilot'].map(element);
  for (const selector of ['#sidebar', '#bottom-nav']) {
    roots[selector].querySelectorAll = () => links;
    roots[selector].querySelector = () => selector === '#bottom-nav' ? camera : null;
  }
  roots['#topbar'].querySelector = () => messages;
  const document = { querySelector: (selector) => selector === '.notification-bell' ? bell : roots[selector], createElement: () => element() };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: document });
  const state = structuredClone(INITIAL_STATE);
  state.notifications = [];
  try {
    setLocale('en');
    renderShell('/', state);
    for (const path of ['/messages', '/notifications', '/farm/land-1/tasks', '/plant-help/camera', '/']) renderShell(path, structuredClone(state));
    assert.deepEqual(Object.values(roots).map((root) => root.writes), [1, 1, 1]);
    assert.equal(camera.mode, 'search');
    assert.equal(links[0].getAttribute('aria-current'), 'page');
    assert.equal(links[1].getAttribute('aria-current'), undefined);
    renderShell('/farm/land-1/tasks', state);
    assert.equal(links[2].getAttribute('aria-current'), 'page');
    assert.equal(links[1].classList.contains('is-active'), false);
    renderShell('/messages', state);
    assert.equal(messages.getAttribute('aria-label'), 'Close messages');
    state.notifications = [{ id: 'test', read: false }];
    renderShell('/notifications', state);
    assert.equal(messages.getAttribute('aria-label'), 'Messages');
    assert.equal(bell.getAttribute('aria-label'), 'Close notifications');
    assert.equal(bell.children[0].textContent, '1');
    assert.equal(bell.classList.contains('has-unread'), true);
    state.notifications[0].read = true;
    updateNotificationBell(state, '/messages');
    assert.equal(bell.children.length, 0);
    assert.equal(bell.classList.contains('has-unread'), false);
    assert.deepEqual(Object.values(roots).map((root) => root.writes), [1, 1, 1]);
    state.profile.name = 'Updated name';
    renderShell('/messages', state);
    assert.match(roots['#sidebar'].markup, /Updated name/);
    setLocale('ms');
    renderShell('/messages', state);
    assert.deepEqual(Object.values(roots).map((root) => root.writes), [3, 3, 3]);
  } finally {
    setLocale('en');
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});

test('tapping the current route preserves content; query and route changes navigate once', () => {
  const source = readFileSync(new URL('../src/browser-app.mjs', import.meta.url), 'utf8');
  const navigation = source.match(/const navigate = [\s\S]*?\n\};/)[0];
  const calls = [];
  const location = { pathname: '/messages', search: '' };
  const context = vm.createContext({
    window: { location, scrollTo: () => calls.push('scroll') },
    history: { pushState: (_state, _title, path) => { calls.push(path); const url = new URL(path, 'https://aura.test'); location.pathname = url.pathname; location.search = url.search; } },
    render: () => calls.push('render'), MAIN: { querySelector: () => ({ focus: () => calls.push('focus') }) },
  });
  vm.runInContext(`let activeSearch = 'keep', activeFilter = 'keep', lastCalculation = 'keep'; ${navigation}\nnavigate('/messages');`, context);
  assert.deepEqual(calls, []);
  assert.equal(vm.runInContext('activeSearch', context), 'keep');
  // Saving an account or deleting a task can redirect to the current route;
  // those mutations must still refresh the content without adding history.
  vm.runInContext("navigate('/messages', { refresh: true });", context);
  assert.deepEqual(calls, ['render', 'scroll', 'focus']);
  assert.match(source, /navigate\(result.redirect, \{ refresh: true \}\)/);
  calls.length = 0;
  vm.runInContext("navigate('/messages?filter=unread'); navigate('/messages?filter=unread'); navigate('/notifications');", context);
  assert.deepEqual(calls, ['/messages?filter=unread', 'render', 'scroll', 'focus', '/notifications', 'render', 'scroll', 'focus']);
});

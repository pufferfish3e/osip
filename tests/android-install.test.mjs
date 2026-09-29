import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installApp, initializePwa } from '../src/pwa.mjs';
import { setLocale } from '../src/i18n.mjs';

const handlers = new Map();
const instructions = { textContent: '' };
const dialog = {
  open: false,
  querySelector: () => instructions,
  showModal() { this.open = true; },
};

globalThis.document = {
  readyState: 'loading',
  images: [],
  querySelector: () => dialog,
};
globalThis.window = {
  location: { href: 'https://aura.example/', origin: 'https://aura.example' },
  matchMedia: () => ({ matches: false }),
  setTimeout: (callback) => setTimeout(callback, 0),
  addEventListener: (name, callback) => handlers.set(name, callback),
};
Object.defineProperty(globalThis, 'navigator', {
  configurable: true,
  value: {
    userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/125.0',
    serviceWorker: {
      controller: null,
      addEventListener: () => {},
      async register(path) {
        assert.equal(path, '/sw.js');
        return { waiting: null, addEventListener: () => {} };
      },
    },
  },
});

test('Android registers offline support even when the page load event never fires', async () => {
  const messages = [];
  await initializePwa((message) => messages.push(message));
  assert.equal(messages.length, 0);
  assert.ok(handlers.has('beforeinstallprompt'));
});

test('Android uses the browser prompt when available, then gives Chrome instructions', async () => {
  let prompted = 0;
  let prevented = 0;
  handlers.get('beforeinstallprompt')({
    preventDefault() { prevented++; },
    async prompt() { prompted++; },
    userChoice: Promise.resolve({ outcome: 'accepted' }),
  });
  const messages = [];
  await installApp((message) => messages.push(message));
  assert.equal(prevented, 1);
  assert.equal(prompted, 1);
  assert.deepEqual(messages, ['Installation requested.']);
  await installApp(() => {});
  assert.equal(prompted, 1, 'The one-use browser prompt must not be reused');
  assert.equal(dialog.open, true);
  assert.match(instructions.textContent, /Chrome.*three-dot menu.*Install app/);
  assert.match(instructions.textContent, /Open in Chrome first/);
});

test('fallback instructions follow the selected app language', async () => {
  setLocale('ms');
  await installApp(() => {});
  assert.match(instructions.textContent, /Buka dalam Chrome dahulu/);
  setLocale('zh-Hans');
  await installApp(() => {});
  assert.match(instructions.textContent, /在 Chrome 中打开/);
  setLocale('en');
});

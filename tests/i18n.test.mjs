import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import DEMO from '../data/demo.json' with { type: 'json' };
import { SUPPLEMENTAL_TRANSLATIONS } from '../src/locales/supplemental.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderHome } from '../src/home.mjs';
import { getFormatLocale, getLocale, LanguagePersistenceError, loadLocale, saveLocale, setLocale, SUPPORTED_LOCALES, t } from '../src/i18n.mjs';
import { CORE_TRANSLATIONS } from '../src/locales/core.mjs';
import { DISCOVER_TRANSLATIONS } from '../src/locales/discover.mjs';
import { PLANT_TRANSLATIONS } from '../src/locales/plant.mjs';
import { WORKSPACE_TRANSLATIONS } from '../src/locales/workspace.mjs';
import { renderShell } from '../src/shell.mjs';
import { escapeHtml, friendlyDate, money, pageHeading } from '../src/ui.mjs';

const DICTIONARIES = [CORE_TRANSLATIONS, WORKSPACE_TRANSLATIONS, DISCOVER_TRANSLATIONS, PLANT_TRANSLATIONS, SUPPLEMENTAL_TRANSLATIONS];
const TEST_DATE = '2026-10-01';
const UNSAFE_NAME = '<img src=x onerror="alert(1)">';

afterEach(() => setLocale('en'));

/** @param {string|null} initial @returns {import('../src/i18n.mjs').LocaleStorage} */
const createStorage = (initial = null) => {
  const values = new Map(initial === null ? [] : [['osip-language', initial]]);
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
};

/** @param {string} value @returns {string[]} */
const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();

/** @param {import('../src/store.mjs').AppState} state @returns {Record<string,{innerHTML:string}>} */
const renderNavigation = (state) => {
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const elements = { '#sidebar': { innerHTML: '' }, '#topbar': { innerHTML: '' }, '#bottom-nav': { innerHTML: '' } };
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { querySelector: (selector) => elements[selector] } });
  try {
    renderShell('/learn', state);
    return elements;
  } finally {
    if (originalDocument) Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
};

test('all three supported locales use native names and invalid choices do not change the active locale', () => {
  assert.deepEqual(SUPPORTED_LOCALES, [{ code: 'en', label: 'English' }, { code: 'ms', label: 'Bahasa Melayu' }, { code: 'zh-Hans', label: '中文' }]);
  assert.equal(getLocale(), 'en');
  assert.equal(setLocale('ms'), 'ms');
  assert.equal(getFormatLocale(), 'ms-MY');
  for (const invalid of ['zh', 'fr', '', null, {}, '__proto__']) assert.throws(() => setLocale(invalid), RangeError);
  assert.equal(getLocale(), 'ms');
  setLocale('zh-Hans');
  assert.equal(getFormatLocale(), 'zh-Hans-MY');
});

test('locale preference persists under its own key and safely falls back for missing or invalid saved values', () => {
  const storage = createStorage();
  assert.equal(saveLocale(storage, 'zh-Hans'), 'zh-Hans');
  assert.equal(storage.getItem('osip-language'), 'zh-Hans');
  assert.equal(loadLocale(storage), 'zh-Hans');
  assert.equal(getLocale(), 'zh-Hans');
  for (const invalid of [null, 'invalid', 'zh', '<script>']) assert.equal(loadLocale(createStorage(invalid)), 'en');
  assert.equal(loadLocale(null), 'en');
});

test('failed persistence reports a typed error instead of pretending the language was saved', () => {
  const cause = new Error('Storage is blocked');
  const storage = { getItem: () => null, setItem: () => { throw cause; } };
  assert.throws(() => saveLocale(storage, 'ms'), (error) => error instanceof LanguagePersistenceError && error.cause === cause);
  assert.throws(() => saveLocale(null, 'ms'), LanguagePersistenceError);
  assert.throws(() => saveLocale(createStorage(), 'fr'), RangeError);
});

test('read failures are reported and restore a usable English interface', () => {
  const messages = [];
  const originalWarn = console.warn;
  console.warn = (...args) => { messages.push(args); };
  try {
    setLocale('ms');
    const storage = { getItem: () => { throw new Error('Read blocked'); }, setItem: () => {} };
    assert.equal(loadLocale(storage), 'en');
    assert.equal(messages.length, 1);
    assert.match(messages[0][0], /could not read the saved language/);
    assert.equal(messages[0][1].message, 'Read blocked');
  } finally {
    console.warn = originalWarn;
  }
});

test('translation lookup falls back to English, interpolates named values, and ignores prototype properties', () => {
  assert.equal(t('Good morning, {name}', { name: 'Aina' }), 'Good morning, Aina');
  setLocale('ms');
  assert.equal(t('Home'), 'Utama');
  assert.equal(t('Good morning, {name}', { name: 'Aina' }), 'Selamat pagi, Aina');
  assert.equal(t('Unknown label {count}', { count: 0 }), 'Unknown label 0');
  assert.equal(t('Unknown label {count}'), 'Unknown label {count}');
  assert.equal(t('constructor'), 'constructor');
  assert.equal(t('toString'), 'toString');
  assert.equal(t('Good morning, {name}', Object.create({ name: 'inherited' })), 'Selamat pagi, {name}');
});

test('every dictionary has matching Malay and Chinese keys with preserved interpolation placeholders', () => {
  for (const dictionary of DICTIONARIES) {
    assert.deepEqual(Object.keys(dictionary.ms).sort(), Object.keys(dictionary['zh-Hans']).sort());
    for (const locale of ['ms', 'zh-Hans']) {
      for (const [source, translation] of Object.entries(dictionary[locale])) {
        assert.equal(typeof translation, 'string', source);
        assert.ok(translation.trim(), source);
        assert.deepEqual(placeholders(translation), placeholders(source), `${locale}: ${source}`);
      }
    }
  }
});

test('shared English source labels have consistent translations across dictionary modules', () => {
  for (const locale of ['ms', 'zh-Hans']) {
    const translations = new Map();
    for (const dictionary of DICTIONARIES) {
      for (const [source, translation] of Object.entries(dictionary[locale])) {
        if (translations.has(source)) assert.equal(translation, translations.get(source), `${locale}: ${source}`);
        translations.set(source, translation);
      }
    }
  }
});

test('home labels change language while names, entered crop text, task titles, and canonical routes stay intact', () => {
  const state = structuredClone(DEMO);
  state.profile.name = 'Home';
  state.farms[0].name = 'Home';
  state.farms[0].crop = 'My custom crop';
  state.farms[0].plots.forEach((plot) => { plot.crop = 'My custom crop'; });
  state.profile.role = 'farmer';
  state.profile.hasChosenRole = true;
  state.farms[0].isDemo = false;
  state.tasks[0].title = 'Learn';
  for (const [locale, label] of [['ms', 'Kawasan tanaman anda'], ['zh-Hans', '你的种植面积']]) {
    setLocale(locale);
    const html = renderHome(state);
    assert.ok(html.includes(label));
    assert.match(html, /Home/);
    assert.match(html, /·<\/span> My custom crop/);
    assert.match(html, /class="row-title">Learn<\/strong>/);
    assert.match(html, /href="\/learn\/courses"/);
    assert.match(html, /href="\/farm"/);
    assert.equal(state.settings.language, 'en');
  }
});

test('translated shell keeps four destinations and its centre action, accessible selection, and unmodified account names', () => {
  const state = structuredClone(DEMO);
  state.profile.name = 'Home';
  setLocale('zh-Hans');
  const html = renderNavigation(state);
  assert.match(html['#sidebar'].innerHTML, /<strong>Home<\/strong>/);
  assert.deepEqual([...html['#bottom-nav'].innerHTML.matchAll(/<a\b[^>]*href="([^"]+)"/g)].map((match) => match[1]), ['/', '/farm', '/schedule', '/learn']);
  assert.match(html['#bottom-nav'].innerHTML, /相机。长按切换为搜索。/);
  assert.match(html['#sidebar'].innerHTML, /<span>学习<\/span>/);
  assert.match(html['#topbar'].innerHTML, /<span class="sr-only">切换语言<\/span><select data-language-select>/);
  assert.match(html['#topbar'].innerHTML, /value="zh-Hans" lang="zh-Hans" selected/);
});

test('translation interpolation remains plaintext and user data is escaped at render boundaries', () => {
  setLocale('ms');
  assert.ok(t('Good morning, {name}', { name: UNSAFE_NAME }).includes(UNSAFE_NAME));
  const state = structuredClone(DEMO);
  state.farms[0].name = UNSAFE_NAME;
  const html = renderHome(state);
  assert.ok(html.includes(escapeHtml(UNSAFE_NAME)));
  assert.doesNotMatch(html, /<img src=x|onerror="alert\(1\)"/);
  assert.match(pageHeading('Home', 'Home', 'Services'), /<h1[^>]*>Home<\/h1>/);
  assert.match(pageHeading('Home', 'Home', 'Services'), /<p class="eyebrow">Home<\/p>/);
});

test('compact language display keeps the full native option and accessible control label', () => {
  setLocale('ms');
  const html = renderNavigation(INITIAL_STATE)['#topbar'].innerHTML;
  assert.match(html, /<span class="sr-only">Tukar bahasa<\/span><select data-language-select>/);
  assert.match(html, /value="ms" lang="ms" selected>Bahasa Melayu<\/option>/);
  assert.match(html, /<span class="language-current" aria-hidden="true">Melayu<svg/);
});

test('date and currency formatting follow the active locale', () => {
  for (const locale of ['en', 'ms', 'zh-Hans']) {
    setLocale(locale);
    assert.equal(friendlyDate(TEST_DATE), new Intl.DateTimeFormat(getFormatLocale(), { month: 'short', day: 'numeric' }).format(new Date(`${TEST_DATE}T12:00:00`)));
    assert.equal(money(1234.5), new Intl.NumberFormat(getFormatLocale(), { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(1234.5));
  }
  assert.equal(friendlyDate('invalid'), '日期待定');
});

test('completed task accessibility labels are translated',()=>{
 setLocale('ms');
 assert.equal(t('Completed {title}',{title:'Water'}),'Selesai: Water');
 setLocale('zh-Hans');
 assert.equal(t('Completed {title}',{title:'Water'}),'已完成：Water');
});

import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';

import { ActionError, applyAction, collectReminders, submitForm } from '../src/actions.mjs';
import { INITIAL_STATE, PILOTS, PRODUCTS } from '../src/data.mjs';
import { setLocale, t } from '../src/i18n.mjs';
import { WORKSPACE_TRANSLATIONS } from '../src/locales/workspace.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

/** @typedef {import('../src/store.mjs').AppState} AppState */

const FIXTURE_DATE = '2026-10-01';
const USER_TEXT = 'Preferences <img src=x onerror=alert(1)>';
const ROUTES = ['/onboarding/role', '/onboarding/farmer', '/onboarding/pilot', '/onboarding/pilot/verification', '/farm', '/farm/farm-1', '/farm/farm-1/schedule', '/weather/farm-1', '/bookings', '/bookings/local-booking', '/bookings/local-booking/chat', '/messages', '/pilot', '/pilot/availability', '/pilot/profile', '/account', '/account/settings', '/notifications', '/orders', '/orders/local-order', '/checkout/local-order/payment'];

/** @returns {AppState} */
const createState = () => {
  const state = structuredClone(INITIAL_STATE);
  state.profile.name = USER_TEXT;
  state.profile.roles = ['farmer', 'pilot'];
  state.farms[0].name = USER_TEXT;
  state.tasks[0].title = USER_TEXT;
  state.bookings = [{ id: 'local-booking', providerId: PILOTS[0].id, type: 'pilot', title: USER_TEXT, date: FIXTURE_DATE, time: '09:00', farmId: 'farm-1', status: 'requested', notes: USER_TEXT, price: 65, conversation: [{ id: 'message-1', sender: 'you', text: USER_TEXT, date: FIXTURE_DATE }] }];
  state.orders = [{ id: 'local-order', items: [{ productId: PRODUCTS[0].id, quantity: 2 }], total: PRODUCTS[0].price * 2, status: 'unpaid', date: FIXTURE_DATE }];
  return state;
};

afterEach(() => setLocale('en'));

test('each workspace route renders in both languages without mutating records', () => {
  const state = createState();
  const original = structuredClone(state);
  for (const locale of ['ms', 'zh-Hans']) {
    setLocale(locale);
    for (const path of ROUTES) {
      const html = renderWorkspace(path, state);
      assert.equal(typeof html, 'string', path);
      assert.doesNotMatch(html, /\b(?:undefined|NaN)\b/, path);
      assert.doesNotMatch(html, /<img src=x/, path);
      assert.doesNotMatch(html, /\{(?:count|name|title|date|time|direction|id)\}/, path);
    }
  }
  assert.deepEqual(state, original);
});

test('user record names and locations matching UI dictionary keys are not translated', () => {
  setLocale('zh-Hans');
  const state = createState();
  state.farms[0].name = 'Preferences';
  state.farms[0].location = 'Home';
  const html = renderWorkspace('/farm/farm-1', state);
  assert.match(html, /class="eyebrow">Home<\/p>/);
  assert.match(html, /class="page-title" tabindex="-1">Preferences<\/h1>/);
});

test('Preferences translates labels, selects the active locale and keeps canonical values', () => {
  setLocale('ms');
  const html = renderWorkspace('/account/settings', createState());
  assert.match(html, /Bahasa/);
  assert.match(html, /Simpan pilihan/);
  assert.match(html, /value="ms" selected>Bahasa Melayu/);
  assert.match(html, /value="zh-Hans" >中文/);
  assert.match(html, /value="ha" selected>Hektar/);
  assert.doesNotMatch(html, /Additional languages/);
});

test('Chinese task forms localize options and accessibility names without changing values or user text', () => {
  setLocale('zh-Hans');
  const state = createState();
  const html = renderWorkspace('/farm/farm-1/schedule', state);
  assert.match(html, /农场日程/);
  assert.match(html, /value="Crop care" >作物养护/);
  assert.match(html, /aria-label="完成Preferences &lt;img/);
  assert.match(html, /Preferences &lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(html, /name="dueDate" type="date"/);
});

test('weather language includes wind direction, rain chance and forecast periods', () => {
  setLocale('ms');
  const html = renderWorkspace('/weather/farm-1', createState());
  assert.match(html, /Angin dari Timur laut/);
  assert.match(html, /Hari akan datang/);
  assert.match(html, /40% hujan/);
  assert.match(html, /Ramalan contoh/);
  assert.doesNotMatch(html, /Wind conditions|From Northeast|Partly cloudy|% rain/);
});

test('saving preferences preserves locale IDs and never overwrites records with translations', () => {
  const state = createState();
  setLocale('ms');
  const result = submitForm(state, 'settings', { name: USER_TEXT, units: 'acre', language: 'zh-Hans' });
  assert.equal(state.settings.language, 'zh-Hans');
  assert.equal(state.settings.unit, 'acre');
  assert.equal(state.profile.name, USER_TEXT);
  assert.equal(result.message, t('Profile saved.'));
  submitForm(state, 'settings', { name: USER_TEXT, units: 'ha', language: 'unsupported' });
  assert.equal(state.settings.language, 'ms');
});

test('localized action feedback retains canonical task category and message text', () => {
  setLocale('zh-Hans');
  const state = createState();
  const result = applyAction(state, 'toggle-task', state.tasks[0].id);
  assert.equal(result.message, '任务已完成。');
  assert.equal(state.tasks[0].title, USER_TEXT);
  assert.equal(state.tasks[0].category, 'Soil');
  const message = submitForm(state, 'message', { bookingId: 'local-booking', message: USER_TEXT });
  assert.match(message.message, /消息已保存到本地/);
  assert.equal(state.bookings[0].conversation.at(-1).text, USER_TEXT);
  assert.throws(() => submitForm(state, 'farm', { name: '' }), (error) => error instanceof ActionError && error.message === '请输入姓名。');
  assert.throws(() => applyAction(state, 'toggle-task', 'missing'), /未找到任务/);
});

test('stored reminders change their labels with the locale while keeping task titles intact', () => {
  const state = createState();
  state.tasks[0].dueDate = '2020-01-01';
  state.tasks[0].time = '08:00';
  collectReminders(state, new Date('2026-01-01T12:00:00Z'));
  const original = structuredClone(state.notifications);
  setLocale('zh-Hans');
  const html = renderWorkspace('/notifications', state);
  assert.match(html, /到期时间/);
  assert.match(html, /Preferences &lt;img/);
  assert.deepEqual(state.notifications, original);
});

test('workspace translations preserve every interpolation placeholder in both languages', () => {
  const placeholders = (value) => [...value.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1]).sort();
  const locales = Object.values(WORKSPACE_TRANSLATIONS);
  assert.deepEqual(Object.keys(locales[0]), Object.keys(locales[1]));
  for (const dictionary of locales) {
    for (const [source, translation] of Object.entries(dictionary)) {
      assert.ok(translation.trim());
      assert.deepEqual(placeholders(translation), placeholders(source), source);
    }
  }
});

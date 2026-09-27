import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ActionError, applyAction, collectReminders, submitForm } from '../src/actions.mjs';
import { COURSES, INITIAL_STATE, PILOTS, PRODUCTS } from '../src/data.mjs';
import { createStore, PersistenceError, STORAGE_KEY } from '../src/store.mjs';

/** @typedef {import('../src/store.mjs').AppState} AppState */
/** @typedef {import('../src/store.mjs').AppStore} AppStore */
/** @typedef {Record<string,string|string[]>} Fields */

const TEST_TIME = '11:00';
const PAST_DATE = '2000-01-01';
const FIXED_NOW = new Date('2030-06-20T12:00:00');
const TASK_FIELDS = { farmId: 'farm-1', title: 'Check irrigation', dueDate: '2030-06-20', time: '08:00', category: 'Water', reminder: 'on' };

/** @returns {AppState} */
const freshState = () => structuredClone(INITIAL_STATE);

/** @param {number} days @returns {string} */
const futureDate = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

/** @returns {Fields} */
const pilotBookingFields = () => ({ providerId: PILOTS[0].id, farmId: INITIAL_STATE.farms[0].id, date: futureDate(2), time: TEST_TIME, notes: 'Map the main plot.' });

/** @param {AppState} state @returns {AppState['bookings'][number]} */
const addBooking = (state) => {
  submitForm(state, 'pilot-booking', pilotBookingFields());
  return state.bookings[state.bookings.length - 1];
};

/** @returns {{store:AppStore,stored:()=>string|undefined,failWrites:()=>void}} */
const memoryStore = () => {
  /** @type {Map<string,string>} */
  const values = new Map();
  let shouldFail = false;
  /** @type {import('../src/store.mjs').StorageAdapter} */
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (shouldFail) throw new Error('Storage quota exceeded.');
      values.set(key, value);
    },
  };
  return { store: createStore(storage), stored: () => values.get(STORAGE_KEY), failWrites: () => { shouldFail = true; } };
};

test('dual-role onboarding preserves both roles and continues to the pilot form', () => {
  const state = freshState();
  applyAction(state, 'choose-role', '', 'both');
  const result = submitForm(state, 'farmer-onboarding', { name: 'Nur', farmName: 'River field', crop: 'Rice', area: '2.5', location: 'Kedah' });
  assert.deepEqual(state.profile.roles, ['farmer', 'pilot']);
  assert.equal(state.profile.name, 'Nur');
  assert.equal(state.profile.onboarded, true);
  assert.equal(state.farms.at(-1).area, 0);
  assert.equal(result.redirect, '/onboarding/pilot');
});

test('switching into an unconfigured role and invalid role selection are rejected', () => {
  const state = freshState();
  assert.throws(() => applyAction(state, 'switch-role', '', 'pilot'), ActionError);
  assert.throws(() => applyAction(state, 'choose-role', '', 'administrator'), ActionError);
  assert.equal(state.profile.role, 'farmer');
});

test('plots save crop records and optional planting dates within the farm area', () => {
  const state = freshState();
  state.farms[0].plots = [];
  submitForm(state, 'plot', { farmId: 'farm-1', name: 'East field', crop: 'Rice', area: '2.1', plantedAt: '' });
  submitForm(state, 'plot', { farmId: 'farm-1', name: 'West field', crop: 'Rice', area: '2.1', plantedAt: '2026-06-01' });
  const plots = state.farms[0].plots;
  assert.equal(plots.length, 2);
  assert.equal(plots[0].name, 'East field');
  assert.equal(plots[0].area, 2.1);
  assert.equal(plots[0].plantedAt, '');
  assert.equal(plots[1].plantedAt, '2026-06-01');
  assert.notEqual(plots[0].id, plots[1].id);
});

test('combined plot areas cannot exceed their farm and rejected additions are atomic', () => {
  const { store } = memoryStore();
  const before = store.getState();
  assert.throws(() => store.update((draft) => {
    submitForm(draft, 'plot', { farmId: 'farm-1', name: 'Overflow field', crop: 'Rice', area: '0.1', plantedAt: '' });
  }), ActionError);
  assert.deepEqual(store.getState(), before);
});

test('plot forms reject non-positive areas, unknown farms and impossible planting dates', () => {
  const state = freshState();
  state.farms[0].plots = [];
  const fields = { farmId: 'farm-1', name: 'East field', crop: 'Rice', area: '1', plantedAt: '' };
  assert.throws(() => submitForm(state, 'plot', { ...fields, area: '0' }), ActionError);
  assert.throws(() => submitForm(state, 'plot', { ...fields, area: '-1' }), ActionError);
  assert.throws(() => submitForm(state, 'plot', { ...fields, farmId: 'missing' }), ActionError);
  assert.throws(() => submitForm(state, 'plot', { ...fields, plantedAt: '2026-02-30' }), ActionError);
  assert.equal(state.farms[0].plots.length, 0);
});

test('unsupported forms and actions cannot change local records', () => {
  const state = freshState();
  const before = structuredClone(state);
  assert.throws(() => submitForm(state, 'unrecognized', {}), ActionError);
  assert.throws(() => applyAction(state, 'unrecognized'), ActionError);
  assert.deepEqual(state, before);
});

test('a partially processed invalid form is rolled back by the store', () => {
  const { store, stored } = memoryStore();
  const before = store.getState();
  assert.throws(() => store.update((draft) => {
    submitForm(draft, 'pilot-onboarding', { name: 'Changed name', area: 'Penang', services: 'Mapping', equipment: 'Survey drone', rate: '-10' });
  }), ActionError);
  assert.deepEqual(store.getState(), before);
  assert.equal(stored(), undefined);
});

test('failed persistence never exposes successful action changes', () => {
  const { store, stored, failWrites } = memoryStore();
  store.update((draft) => { applyAction(draft, 'toggle-task', 'soil'); });
  const before = store.getState();
  const persistedBefore = stored();
  failWrites();
  assert.throws(() => store.update((draft) => { applyAction(draft, 'toggle-task', 'soil'); }), PersistenceError);
  assert.deepEqual(store.getState(), before);
  assert.equal(stored(), persistedBefore);
});

test('task edits reject missing tasks and a task belonging to another farm', () => {
  const { store } = memoryStore();
  store.update((draft) => { draft.farms.push({ ...draft.farms[0], id: 'farm-2', name: 'Other farm' }); });
  const before = store.getState();
  assert.throws(() => store.update((draft) => { submitForm(draft, 'task', { ...TASK_FIELDS, id: 'missing' }); }), ActionError);
  assert.throws(() => store.update((draft) => { submitForm(draft, 'task', { ...TASK_FIELDS, farmId: 'farm-2', id: 'soil' }); }), ActionError);
  assert.deepEqual(store.getState(), before);
});

test('task input rejects impossible calendar dates, invalid time and missing farms', () => {
  const state = freshState();
  const invalidFields = [
    { ...TASK_FIELDS, dueDate: '2030-02-30' },
    { ...TASK_FIELDS, time: '25:30' },
    { ...TASK_FIELDS, farmId: 'missing' },
  ];
  for (const fields of invalidFields) assert.throws(() => submitForm(state, 'task', fields), ActionError);
  assert.deepEqual(state.tasks, INITIAL_STATE.tasks);
});

test('editing a completed task preserves completion and updates its reminder', () => {
  const state = freshState();
  applyAction(state, 'toggle-task', 'soil');
  submitForm(state, 'task', { ...TASK_FIELDS, id: 'soil', title: 'Updated soil note', reminder: '' });
  assert.equal(state.tasks[0].done, true);
  assert.equal(state.tasks[0].title, 'Updated soil note');
  assert.equal(state.tasks[0].reminder, false);
  assert.equal(state.tasks.length, INITIAL_STATE.tasks.length);
});

test('drone booking uses catalogue rate and farm area, ignoring forged prices', () => {
  const state = freshState();
  const result = submitForm(state, 'pilot-booking', { ...pilotBookingFields(), price: '0.01', rate: '0.01' });
  const booking = state.bookings[0];
  assert.equal(booking.price, PILOTS[0].rate * state.farms[0].area);
  assert.equal(booking.status, 'requested');
  assert.deepEqual(booking.conversation, []);
  assert.equal(result.redirect, `/bookings/${booking.id}`);
});

test('the selected pilot service is retained and unsupported services are rejected', () => {
  const state = freshState();
  const service = PILOTS[0].services[1];
  submitForm(state, 'pilot-booking', { ...pilotBookingFields(), service });
  assert.equal(state.bookings[0].service, service);
  assert.ok(state.bookings[0].title.includes(service));
  const emptyState = freshState();
  assert.throws(() => submitForm(emptyState, 'pilot-booking', { ...pilotBookingFields(), service: 'Unsupported service' }), ActionError);
  assert.equal(emptyState.bookings.length, 0);
  assert.equal(emptyState.notifications.length, 0);
});

test('course booking uses the advertised session and remains free despite forged prices', () => {
  const state = freshState();
  submitForm(state, 'course-booking', { providerId: COURSES[0].id, date: PAST_DATE, time: '01:00', price: '999' });
  const booking = state.bookings[0];
  assert.equal(booking.date, COURSES[0].date);
  assert.equal(booking.time, COURSES[0].time);
  assert.equal(booking.price, 0);
  assert.equal(booking.type, 'course');
});

test('duplicate active booking requests are rejected without creating notifications', () => {
  const state = freshState();
  const fields = pilotBookingFields();
  submitForm(state, 'pilot-booking', fields);
  const before = structuredClone(state);
  assert.throws(() => submitForm(state, 'pilot-booking', fields), /already have a request/);
  assert.deepEqual(state, before);
});

test('bookings reject past schedules and unknown providers or farms', () => {
  const state = freshState();
  const fields = pilotBookingFields();
  assert.throws(() => submitForm(state, 'pilot-booking', { ...fields, date: PAST_DATE }), /future booking time/);
  assert.throws(() => submitForm(state, 'pilot-booking', { ...fields, providerId: 'missing' }), ActionError);
  assert.throws(() => submitForm(state, 'pilot-booking', { ...fields, farmId: 'missing' }), ActionError);
  assert.equal(state.bookings.length, 0);
  assert.equal(state.notifications.length, 0);
});

test('rescheduling records a proposal and retains the agreed date and time', () => {
  const state = freshState();
  const booking = addBooking(state);
  const original = { date: booking.date, time: booking.time };
  const proposal = { date: futureDate(4), time: '14:00' };
  submitForm(state, 'reschedule', { bookingId: booking.id, ...proposal });
  assert.equal(booking.date, original.date);
  assert.equal(booking.time, original.time);
  assert.deepEqual(booking.rescheduleRequest, proposal);
  applyAction(state, 'cancel-booking', booking.id);
  assert.throws(() => submitForm(state, 'reschedule', { bookingId: booking.id, ...proposal }), /cannot be rescheduled/);
});

test('messages remain local, record the sender, and cannot attach to an unknown booking', () => {
  const state = freshState();
  const booking = addBooking(state);
  submitForm(state, 'message', { bookingId: booking.id, message: ' Please use the east gate. ', sender: 'pilot' });
  assert.equal(booking.conversation.length, 1);
  assert.equal(booking.conversation[0].sender, 'you');
  assert.equal(booking.conversation[0].text, 'Please use the east gate.');
  assert.ok(Number.isFinite(Date.parse(booking.conversation[0].date)));
  assert.throws(() => submitForm(state, 'message', { bookingId: 'missing', message: 'Hello' }), ActionError);
});

test('cart quantities, saved orders and payment simulation remain internally consistent', () => {
  const state = freshState();
  applyAction(state, 'add-cart', PRODUCTS[0].id);
  applyAction(state, 'cart-increment', PRODUCTS[0].id);
  applyAction(state, 'add-cart', PRODUCTS[1].id);
  applyAction(state, 'cart-decrement', PRODUCTS[1].id);
  assert.deepEqual(state.cart, [{ productId: PRODUCTS[0].id, quantity: 2 }]);
  applyAction(state, 'create-order');
  const order = state.orders[0];
  assert.equal(order.total, PRODUCTS[0].price * 2);
  assert.equal(order.status, 'unpaid');
  assert.equal(state.cart.length, 0);
  applyAction(state, 'demo-payment', order.id);
  assert.equal(order.status, 'demo-paid');
  assert.notEqual(order.status, 'paid');
  assert.throws(() => applyAction(state, 'create-order'), /cart is empty/);
});

test('cart quantity limits and unknown record actions fail without changing state', () => {
  const { store } = memoryStore();
  store.update((draft) => { draft.cart = [{ productId: PRODUCTS[0].id, quantity: 99 }]; });
  const before = store.getState();
  assert.throws(() => store.update((draft) => { applyAction(draft, 'cart-increment', PRODUCTS[0].id); }), /limit is 99/);
  for (const action of ['toggle-task', 'cancel-booking', 'demo-payment', 'add-cart', 'save-article']) {
    assert.throws(() => store.update((draft) => { applyAction(draft, action, 'missing'); }), ActionError);
  }
  assert.deepEqual(store.getState(), before);
});

test('credential references never self-approve pilots or enable live acceptance', () => {
  const state = freshState();
  submitForm(state, 'verification', { credentialReference: 'Demo reference', verification: 'approved' });
  assert.equal(state.pilot.verification, 'pending');
  assert.equal(state.pilot.credentialReference, 'Demo reference');
  assert.throws(() => applyAction(state, 'pilot-accept', 'request-1'), /connected booking service/);
  state.pilot.verification = 'approved';
  assert.throws(() => applyAction(state, 'pilot-accept', 'request-1'), /connected booking service/);
});

test('availability stores selected days and rejects reversed working hours', () => {
  const state = freshState();
  submitForm(state, 'availability', { days: ['Monday', 'Wednesday'], timeStart: '08:00', timeEnd: '16:00' });
  assert.deepEqual(state.pilot.availability, { days: ['Monday', 'Wednesday'], timeStart: '08:00', timeEnd: '16:00' });
  assert.throws(() => submitForm(state, 'availability', { days: ['Monday'], timeStart: '17:00', timeEnd: '08:00' }), /End time must be after/);
});

test('reminders are deduplicated and skip completed, disabled and future tasks', () => {
  const state = freshState();
  const task = { ...state.tasks[0], dueDate: '2030-06-20', time: '08:00', reminder: true, done: false };
  state.tasks = [task, { ...task, id: 'completed', done: true }, { ...task, id: 'disabled', reminder: false }, { ...task, id: 'future', dueDate: '2030-06-21' }];
  assert.equal(collectReminders(state, FIXED_NOW), true);
  assert.equal(state.notifications.length, 1);
  assert.equal(state.notifications[0].id, `reminder-${task.id}-${task.dueDate}-${task.time}`);
  assert.equal(collectReminders(state, FIXED_NOW), false);
  assert.equal(state.notifications.length, 1);
  applyAction(state, 'mark-notifications-read');
  assert.equal(state.notifications[0].read, true);
});

test('farmer onboarding needs no size and finishes at Home', () => {
  const { store } = memoryStore();
  store.update((state) => applyAction(state, 'choose-role', '', 'farmer'));
  let result;
  store.update((state) => { result = submitForm(state, 'farmer-onboarding', { name: 'Nur', farmName: 'River field', crop: 'Rice', location: 'Perak' }); });
  assert.equal(result.redirect, '/');
  assert.equal(store.getState().farms.at(-1).area, 0);
  assert.equal(store.getState().profile.onboarded, true);
});

test('pilot onboarding finishes at Home', () => {
  const state = freshState();
  applyAction(state, 'choose-role', '', 'pilot');
  const result = submitForm(state, 'pilot-onboarding', { name: 'Nur', area: 'Perak', services: 'Mapping', equipment: 'Survey drone', rate: '65' });
  assert.equal(result.redirect, '/');
  assert.equal(state.profile.onboarded, true);
});

test('daily and weekly repeats create one next occurrence after completion and survive reload', () => {
  for (const [repeat, expected] of [['daily', '2032-03-01'], ['weekly', '2032-03-07']]) {
    const { store, stored } = memoryStore();
    store.update((state) => submitForm(state, 'task', { ...TASK_FIELDS, dueDate: '2032-02-29', repeat }));
    const original = store.getState().tasks.at(-1);
    store.update((state) => applyAction(state, 'toggle-task', original.id));
    const next = store.getState().tasks.at(-1);
    assert.equal(next.dueDate, expected);
    assert.equal(next.done, false);
    assert.equal(next.repeat, repeat);
    assert.equal(next.repeatFromId, original.id);
    const restored = createStore({ getItem: () => stored() ?? null, setItem: () => {} });
    assert.equal(restored.getState().tasks.at(-1).repeat, repeat);
    assert.equal(next.reminder, true);
    store.update((state) => applyAction(state, 'toggle-task', original.id));
    store.update((state) => applyAction(state, 'toggle-task', original.id));
    assert.equal(store.getState().tasks.filter((task) => task.repeatFromId === original.id).length, 1);
  }
});

test('monthly repeats clamp short months and retain the original day for later months', () => {
  const state = freshState();
  submitForm(state, 'task', { ...TASK_FIELDS, dueDate: '2031-01-31', repeat: 'monthly' });
  applyAction(state, 'toggle-task', state.tasks.at(-1).id);
  assert.equal(state.tasks.at(-1).dueDate, '2031-02-28');
  applyAction(state, 'toggle-task', state.tasks.at(-1).id);
  assert.equal(state.tasks.at(-1).dueDate, '2031-03-31');
});

test('legacy tasks do not repeat and invalid frequencies cannot be saved', () => {
  const state = freshState();
  const count = state.tasks.length;
  applyAction(state, 'toggle-task', state.tasks[0].id);
  assert.equal(state.tasks.length, count);
  assert.throws(() => submitForm(state, 'task', { ...TASK_FIELDS, repeat: 'hourly' }), /repeat frequency/);
});

test('deleting a task persists, removes its reminders and preserves other occurrences', () => {
  const records = new Map();
  const storage = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  const store = createStore(storage);
  let taskId;
  store.update((state) => {
    submitForm(state, 'task', TASK_FIELDS);
    taskId = state.tasks.at(-1).id;
    state.tasks.push({ ...state.tasks.at(-1), id: 'next-occurrence', repeatFromId: taskId });
    state.notifications.push({ id: `reminder-${taskId}-date`, title: 'Task', body: 'Due', date: FIXED_NOW.toISOString(), read: false });
  });
  const before = store.getState();
  let result;
  store.update((state) => { result = applyAction(state, 'delete-task', taskId); });
  const saved = createStore(storage).getState();
  assert.equal(saved.tasks.length, before.tasks.length - 1);
  assert.ok(saved.tasks.some((task) => task.id === 'next-occurrence'));
  assert.ok(!saved.notifications.some((note) => note.id.startsWith(`reminder-${taskId}-`)));
  assert.equal(result.redirect, '/farm/farm-1/schedule');
  assert.throws(() => store.update((state) => applyAction(state, 'delete-task', taskId)), ActionError);
  assert.deepEqual(store.getState(), saved);
});

test('replayed task submissions create one event even after reload, while new submissions remain possible', () => {
  const records = new Map();
  const adapter = { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
  let store = createStore(adapter);
  const fields = { ...TASK_FIELDS, creationKey: 'same-submission', repeat: 'daily' };
  const initial = store.getState().tasks.length;
  store.update((state) => submitForm(state, 'task', fields));
  store = createStore(adapter);
  store.update((state) => submitForm(state, 'task', fields));
  assert.equal(store.getState().tasks.length, initial + 1);
  const task = store.getState().tasks.at(-1);
  store.update((state) => applyAction(state, 'toggle-task', task.id));
  store.update((state) => applyAction(state, 'toggle-task', task.id));
  store.update((state) => applyAction(state, 'toggle-task', task.id));
  assert.equal(store.getState().tasks.filter((item) => item.repeatFromId === task.id).length, 1);
  assert.equal(store.getState().tasks.at(-1).creationKey, undefined);
  store.update((state) => submitForm(state, 'task', { ...fields, creationKey: 'new-submission' }));
  assert.equal(store.getState().tasks.length, initial + 3);
});

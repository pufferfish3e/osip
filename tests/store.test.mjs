import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { INITIAL_STATE } from '../src/data.mjs';
import { PersistenceError, StateValidationError, STORAGE_KEY, createStore } from '../src/store.mjs';

/** @param {Record<string,string>} initial @returns {import('../src/store.mjs').StorageAdapter} */
const memoryStorage = (initial = {}) => {
  const records = new Map(Object.entries(initial));
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); },
  };
};

test('store starts from isolated demo records and persists complete state updates', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const snapshot = store.getState();
  snapshot.profile.name = 'Changed outside the store';
  assert.equal(store.getState().profile.name, INITIAL_STATE.profile.name);
  store.update((state) => { state.profile.name = 'Aina'; state.tasks[0].done = true; });
  const restored = createStore(storage);
  assert.equal(restored.getState().profile.name, 'Aina');
  assert.equal(restored.getState().tasks[0].done, true);
  assert.equal(restored.lastError, null);
});

test('original checklist completion migrates without removing the legacy record', () => {
  const legacy = JSON.stringify(['soil', 'water']);
  const storage = memoryStorage({ 'osip-checklist-v1': legacy });
  const store = createStore(storage);
  assert.deepEqual(store.getState().tasks.filter((task) => task.done).map((task) => task.id), ['soil', 'water']);
  store.update((state) => { state.tasks[1].done = true; });
  assert.equal(storage.getItem('osip-checklist-v1'), legacy);
  assert.equal(createStore(storage).getState().tasks.every((task) => task.done), true);
});

test('current state takes precedence over the original checklist', () => {
  const storage = memoryStorage({ 'osip-checklist-v1': JSON.stringify(['soil']) });
  const store = createStore(storage);
  store.update((state) => { state.tasks[0].done = false; });
  assert.equal(createStore(storage).getState().tasks[0].done, false);
});

test('corrupt data is reported and preserved while safe demo state is displayed', () => {
  for (const raw of ['not json', '{"version":100}', '{"version":2,"state":{}}']) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw });
    const store = createStore(storage);
    assert.ok(store.lastError instanceof PersistenceError);
    assert.deepEqual(store.getState(), INITIAL_STATE);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('invalid legacy data is reported rather than silently discarded', () => {
  const storage = memoryStorage({ 'osip-checklist-v1': '["unknown-task"]' });
  const store = createStore(storage);
  assert.ok(store.lastError instanceof PersistenceError);
  assert.equal(storage.getItem('osip-checklist-v1'), '["unknown-task"]');
});

test('a failed write does not change state or notify subscribers', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  storage.setItem = () => { throw new Error('Storage quota exceeded'); };
  assert.throws(() => store.update((state) => { state.profile.name = 'Unsaved name'; }), PersistenceError);
  assert.equal(store.getState().profile.name, INITIAL_STATE.profile.name);
  assert.equal(notifications, 0);
  assert.ok(store.lastError instanceof PersistenceError);
});

test('invalid updates roll back with a validation error', () => {
  const store = createStore(memoryStorage());
  assert.throws(() => store.update((state) => { state.cart.push({ productId: 'scout-drone', quantity: -1 }); }), StateValidationError);
  assert.throws(() => store.update((state) => { state.tasks[0].dueDate = '2026-02-31'; }), StateValidationError);
  assert.throws(() => store.update((state) => { state.farms[0].area = Number.NaN; }), StateValidationError);
  assert.deepEqual(store.getState(), INITIAL_STATE);
});

test('domain errors retain their identity and roll back before any write or notification', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const savedBefore = storage.getItem(STORAGE_KEY);
  const originalError = new Error('Choose a future booking time.');
  let notifications = 0;
  store.subscribe(() => { notifications += 1; });
  assert.throws(() => store.update((state) => {
    state.profile.name = 'Unsaved name';
    throw originalError;
  }), (error) => error === originalError);
  assert.equal(store.lastError, originalError);
  assert.deepEqual(store.getState(), INITIAL_STATE);
  assert.equal(storage.getItem(STORAGE_KEY), savedBefore);
  assert.equal(notifications, 0);
});

test('new records survive save and reload', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  store.update((state) => {
    state.bookings.push({ id: 'booking-1', type: 'pilot', providerId: 'azlan', title: 'Mapping', date: '2026-10-01', time: '09:00', farmId: 'farm-1', status: 'requested', notes: 'North plot', price: 65, conversation: [{ id: 'message-1', sender: 'farmer', text: 'Is morning available?', date: '2026-09-26T08:00:00Z' }] });
    state.savedArticles.push('soil-check');
    state.savedCalculations.push({ type: 'margin', title: 'Trial estimate', result: -12, unit: 'MYR', date: '2026-09-26' });
    state.cart.push({ productId: 'weather-meter', quantity: 1 });
  });
  const saved = createStore(storage).getState();
  assert.equal(saved.bookings[0].conversation[0].text, 'Is morning available?');
  assert.deepEqual(saved.savedArticles, ['soil-check']);
  assert.equal(saved.savedCalculations[0].result, -12);
});

test('listeners receive isolated snapshots and unsubscribe cleanly', () => {
  const store = createStore(memoryStorage());
  const names = [];
  const unsubscribe = store.subscribe((state) => { names.push(state.profile.name); state.profile.name = 'Listener mutation'; });
  store.update((state) => { state.profile.name = 'First'; });
  assert.equal(store.getState().profile.name, 'First');
  unsubscribe();
  store.update((state) => { state.profile.name = 'Second'; });
  assert.deepEqual(names, ['First']);
});

test('a retained draft cannot mutate committed state without a save', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  let retainedDraft;
  store.update((state) => { state.profile.name = 'Saved'; retainedDraft = state; });
  retainedDraft.profile.name = 'Unsaved';
  assert.equal(store.getState().profile.name, 'Saved');
  assert.equal(createStore(storage).getState().profile.name, 'Saved');
});

test('load failures are exposed without making the app shell throw', () => {
  const storage = memoryStorage();
  storage.getItem = () => { throw new Error('Storage access denied'); };
  const store = createStore(storage);
  assert.ok(store.lastError instanceof PersistenceError);
  assert.deepEqual(store.getState(), INITIAL_STATE);
});

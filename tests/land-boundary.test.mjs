import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { displayedLandBoundary, isLandBoundary, saveLandBoundary } from '../src/land-boundary.mjs';
import { createStore, StateValidationError } from '../src/store.mjs';

const BOUNDARY = [[4.6, 101.1], [4.6, 101.101], [4.601, 101.101], [4.601, 101.1]];
const memoryStorage = () => {
  const records = new Map();
  return { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => { records.set(key, value); } };
};

test('valid boundaries support either winding direction', () => {
  assert.equal(isLandBoundary(BOUNDARY), true);
  assert.equal(isLandBoundary([...BOUNDARY].reverse()), true);
});

test('rejects incomplete, duplicate, flat, crossing, and invalid coordinates', () => {
  const invalid = [[], BOUNDARY.slice(0, 2), [...BOUNDARY, BOUNDARY[0]], [[4, 101], [4, 102], [4, 103]],
    [BOUNDARY[0], BOUNDARY[2], BOUNDARY[1], BOUNDARY[3]], [[NaN, 101], ...BOUNDARY], [[86, 101], ...BOUNDARY],
    [[4, 179], [4, -179], [5, 179]], Array.from({ length: 101 }, (_, index) => [4, index])];
  for (const boundary of invalid) assert.equal(isLandBoundary(boundary), false);
});

test('boundary persists per farm, survives reload, and does not change recorded hectares', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  const originalArea = store.getState().farms[0].area;
  store.update((state) => saveLandBoundary(state, 'farm-1', BOUNDARY));
  const restored = createStore(storage);
  assert.deepEqual(restored.getState().farms[0].boundary, BOUNDARY);
  assert.equal(restored.getState().farms[0].area, originalArea);
  assert.equal(restored.lastError, null);
  const replacement = BOUNDARY.slice(0, 3);
  store.update((state) => saveLandBoundary(state, 'farm-1', replacement));
  assert.deepEqual(createStore(storage).getState().farms[0].boundary, replacement);
});

test('invalid boundary and failed persistence leave saved land untouched', () => {
  const storage = memoryStorage();
  const store = createStore(storage);
  store.update((state) => saveLandBoundary(state, 'farm-1', BOUNDARY));
  assert.throws(() => store.update((state) => { state.farms[0].boundary = []; }), StateValidationError);
  assert.deepEqual(store.getState().farms[0].boundary, BOUNDARY);
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => store.update((state) => saveLandBoundary(state, 'farm-1', BOUNDARY.slice(0, 3))), /Could not save/);
  assert.deepEqual(store.getState().farms[0].boundary, BOUNDARY);
  assert.throws(() => saveLandBoundary(store.getState(), 'missing', BOUNDARY), /Farm not found/);
});

test('existing demo farm gets a realistic rectangular outline without altering saved data', () => {
  const store = createStore(memoryStorage());
  const farm = store.getState().farms[0];
  const boundary = displayedLandBoundary(farm);
  assert.equal(isLandBoundary(boundary), true);
  assert.equal(boundary.length, 4);
  const hectares = (boundary[2][0] - boundary[0][0]) * (boundary[2][1] - boundary[0][1]) * 111320 ** 2 * Math.cos(boundary[0][0] * Math.PI / 180) / 10000;
  assert.ok(hectares > 4 && hectares < 4.4);
  assert.equal(farm.boundary, undefined);
  assert.deepEqual(displayedLandBoundary({ ...farm, isDemo: false }), []);
  assert.deepEqual(displayedLandBoundary({ ...farm, boundary: BOUNDARY }), BOUNDARY);
});

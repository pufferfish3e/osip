import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { fieldAreaHectares, fieldsOverlap, mappedFields, normalizeFieldBoundary, saveFieldBoundary } from '../src/field-boundary.mjs';
import { createStore, StateValidationError } from '../src/store.mjs';

const BOX = [[4, 101], [4, 101.002], [4.002, 101.002], [4.002, 101]];
const NEXT = BOX.map(([lat, lng]) => [lat, lng + 0.003]);
const createStorage = () => {
  const records = new Map();
  return { getItem: (key) => records.get(key) ?? null, setItem: (key, value) => records.set(key, value) };
};
const draft = (plotId, boundary, crop = 'Rice') => ({ plotId, boundary, crop, name: crop + ' field' });

test('four corners are stable regardless of click order or winding', () => {
  const expected = normalizeFieldBoundary(BOX);
  assert.deepEqual(normalizeFieldBoundary([...BOX].reverse()), expected);
  assert.deepEqual(normalizeFieldBoundary([BOX[0], BOX[2], BOX[1], BOX[3]]), expected);
  assert.ok(fieldAreaHectares(expected) > 4 && fieldAreaHectares(expected) < 5);
});

test('rejects duplicate, interior, collinear, missing, out-of-range and near-collapsed corners', () => {
  for (const points of [BOX.slice(0, 3), [...BOX, BOX[0]], [BOX[0], BOX[0], BOX[2], BOX[3]],
    [BOX[0], BOX[1], BOX[2], [4.001, 101.001]], [[4, 101], [4, 102], [4, 103], [4, 104]],
    [[90, 101], ...BOX.slice(1)], [[4, NaN], ...BOX.slice(1)], BOX.map(([lat, lng]) => [4 + (lat - 4) * 0.001, 101 + (lng - 101) * 0.001])]) {
    assert.throws(() => normalizeFieldBoundary(points));
  }
});

test('overlap catches containment and crossings while allowing shared edges', () => {
  assert.equal(fieldsOverlap(BOX, BOX), true);
  assert.equal(fieldsOverlap(BOX, NEXT), false);
  assert.equal(fieldsOverlap(BOX, BOX.map(([lat, lng]) => [lat, lng + 0.002])), false);
  assert.equal(fieldsOverlap(BOX, BOX.map(([lat, lng]) => [lat + 0.001, lng + 0.001])), true);
  assert.equal(fieldsOverlap(BOX, BOX.map(([lat, lng]) => [4.0005 + (lat - 4) / 2, 101.0005 + (lng - 101) / 2])), true);
});

test('independent crops and boundaries survive reload and editing one leaves the other intact', () => {
  const storage = createStorage();
  const store = createStore(storage);
  const originalArea = store.getState().farms[0].area;
  store.update((state) => saveFieldBoundary(state, 'farm-1', draft('plot-1', BOX)));
  assert.equal(store.getState().farms[0].area, originalArea);
  let id;
  store.update((state) => { id = saveFieldBoundary(state, 'farm-1', draft('', NEXT, 'Coconut')); });
  const restored = createStore(storage);
  assert.equal(restored.getState().farms[0].plots.length, 2);
  assert.equal(restored.getState().farms[0].plots[1].crop, 'Coconut');
  assert.equal(restored.getState().farms[0].plots[1].isAreaEstimated, true);
  const other = restored.getState().farms[0].plots[1];
  restored.update((state) => saveFieldBoundary(state, 'farm-1', draft('plot-1', BOX, 'Corn')));
  assert.deepEqual(restored.getState().farms[0].plots[1], other);
  assert.equal(mappedFields(restored.getState().farms[0]).length, 2);
  assert.equal(other.id, id);
});

test('overlap, invalid metadata and failed writes roll back without dropping fields', () => {
  const storage = createStorage();
  const store = createStore(storage);
  store.update((state) => saveFieldBoundary(state, 'farm-1', draft('plot-1', BOX)));
  const previous = store.getState();
  assert.throws(() => store.update((state) => saveFieldBoundary(state, 'farm-1', draft('', BOX))), /overlaps/);
  assert.throws(() => store.update((state) => saveFieldBoundary(state, 'farm-1', { ...draft('', NEXT), crop: '' })), /name and crop/);
  assert.throws(() => store.update((state) => { state.farms[0].plots[0].boundary = []; }), StateValidationError);
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => store.update((state) => saveFieldBoundary(state, 'farm-1', draft('', NEXT))), /Could not save/);
  assert.deepEqual(store.getState(), previous);
});

test('deleting a field persists and preserves farm tasks, other fields and total area', async () => {
  const { deleteField } = await import('../src/field-boundary.mjs');
  const storage = createStorage();
  const store = createStore(storage);
  const before = store.getState();
  const farm = before.farms[0];
  store.update((state) => deleteField(state, farm.id, farm.plots[0].id));
  const restored = createStore(storage).getState();
  assert.equal(restored.farms[0].plots.length, 0);
  assert.equal(restored.farms[0].area, farm.area);
  assert.deepEqual(restored.tasks, before.tasks);
  assert.throws(() => store.update((state) => deleteField(state, farm.id, 'missing')), /Field not found/);
});

test('failed deletion persistence keeps the field intact', async () => {
  const { deleteField } = await import('../src/field-boundary.mjs');
  const storage = createStorage();
  const store = createStore(storage);
  const before = store.getState();
  storage.setItem = () => { throw new Error('Storage full'); };
  assert.throws(() => store.update((state) => deleteField(state, before.farms[0].id, before.farms[0].plots[0].id)), /Could not save/);
  assert.deepEqual(store.getState(), before);
});

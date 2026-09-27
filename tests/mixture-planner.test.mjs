import assert from 'node:assert/strict';
import { test } from 'node:test';
import { prepareMixture, renderMixturePlanner, saveFieldRecipe } from '../src/mixture-planner.mjs';
import { createStore } from '../src/store.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
const RECIPE = { product: 'Label example', crop: 'Rice', purpose: 'Target from label', kind: 'pesticide', source: 'Product label', fieldId: 'plot-1', area: 2, volume: 100, tank: 16, rate: 2, basis: 'ml-l' };
test('label units scale by selected field area and calibrated volume', () => {
  assert.deepEqual(prepareMixture(RECIPE), { amount: 400, unit: 'mL', finished: 200 });
  assert.equal(prepareMixture({ ...RECIPE, basis: 'ml-ha', rate: 500 }).amount, 1000);
  assert.equal(prepareMixture({ ...RECIPE, basis: 'g-ha', rate: 500 }).unit, 'g');
  assert.equal(prepareMixture({ ...RECIPE, basis: 'percent-vv', rate: 0.2 }).amount, 400);
  assert.deepEqual(prepareMixture({ ...RECIPE, basis: 'percent-wv', rate: 0.2 }), { amount: 400, unit: 'g', finished: 200 });
  assert.equal(prepareMixture({ ...RECIPE, basis: 'g-100l', rate: 20 }).amount, 40);
});
test('invalid area, ambiguous units and impossible dilutions are rejected', () => {
  for (const invalid of [{ area: 0 }, { volume: NaN }, { basis: 'percent-active' }, { basis: 'percent-vv', rate: 100 }, { rate: 1000 }, { tank: -1 }]) assert.throws(() => prepareMixture({ ...RECIPE, ...invalid }));
});
test('configuration saves to one field and persists across reload', () => {
  let stored;
  const storage = { getItem: () => stored ?? null, setItem: (key, value) => { stored = value; } };
  const store = createStore(storage);
  store.update((state) => saveFieldRecipe(state, RECIPE));
  const reloaded = createStore(storage).getState();
  assert.deepEqual(reloaded.farms[0].plots[0].mixtureConfig, RECIPE);
  assert.ok(reloaded.farms[0].plots.slice(1).every((field) => !field.mixtureConfig));
  assert.throws(() => saveFieldRecipe(reloaded, { ...RECIPE, fieldId: 'missing' }));
});
test('planner offers fields, both mixture types, sources and custom label percentages without keypad', () => {
  const html = renderMixturePlanner(INITIAL_STATE);
  for (const text of ['name="fieldId"', 'fertiliser', 'percent-vv', 'percent-wv', 'Save configuration to this field', 'sismarp']) assert.ok(html.includes(text));
  assert.doesNotMatch(html, /calculator-keypad/);
});

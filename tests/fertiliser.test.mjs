import assert from 'node:assert/strict';
import { test } from 'node:test';

import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { fertiliserFromFields, fertiliserLabel, renderFertiliserSummary } from '../src/fertiliser.mjs';

const tomorrow = () => { const date = new Date(); date.setDate(date.getDate() + 1); return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-'); };
const farmState = () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id: 'farm-f', name: 'Test land', location: 'Perak', crop: 'Rice', area: 2, unit: 'ha', plantedAt: '', plots: [{ id: 'plot-a', name: 'Field 1', gridNumber: 1, crop: 'Rice', area: 1 }] }];
  state.tasks = [];
  return state;
};
const taskFields = (extra) => ({ farmId: 'farm-f', plotIds: ['plot-a'], title: 'Top dressing', dueDate: tomorrow(), time: '08:00', category: 'Fertilizer', repeat: 'none', ...extra });

test('a fertiliser choice needs a product; the amount is optional', () => {
  assert.deepEqual(fertiliserFromFields({ fertiliserProduct: 'NPK 15-15-15', fertiliserAmount: '2', fertiliserUnit: 'bag' }), { product: 'NPK 15-15-15', amount: 2, unit: 'bag' });
  assert.deepEqual(fertiliserFromFields({ fertiliserProduct: 'other', fertiliserOther: ' Nitrophoska Blue ', fertiliserAmount: '' }), { product: 'Nitrophoska Blue' });
  assert.throws(() => fertiliserFromFields({ fertiliserProduct: '' }), /Choose which fertiliser/);
  assert.throws(() => fertiliserFromFields({ fertiliserProduct: 'other', fertiliserOther: '' }), /Choose which fertiliser/);
  assert.throws(() => fertiliserFromFields({ fertiliserProduct: 'Urea (46-0-0)', fertiliserAmount: '-1' }), /amount above 0/);
  assert.equal(fertiliserLabel({ product: 'Urea (46-0-0)', amount: 25, unit: 'kg' }), 'Urea (46-0-0) · 25 kg');
  assert.equal(fertiliserLabel({ product: 'NPK 15-15-15', amount: 1, unit: 'bag' }), 'NPK 15-15-15 · 1 bag');
});

test('each fertiliser schedule on the same field keeps its own product', () => {
  const state = farmState();
  submitForm(state, 'task', taskFields({ fertiliserProduct: 'NPK 15-15-15', fertiliserAmount: '2', fertiliserUnit: 'bag' }));
  submitForm(state, 'task', taskFields({ title: 'Early boost', fertiliserProduct: 'Urea (46-0-0)', fertiliserAmount: '25', fertiliserUnit: 'kg' }));
  assert.deepEqual(state.tasks.map((task) => task.fertiliser), [{ product: 'NPK 15-15-15', amount: 2, unit: 'bag' }, { product: 'Urea (46-0-0)', amount: 25, unit: 'kg' }]);
  state.tasks[0].done = true;
  const summary = renderFertiliserSummary(state.tasks, 'farm-f', 'plot-a', (date) => date);
  assert.match(summary, /NPK 15-15-15 · 2 bags/);
  assert.match(summary, /Applied 1 time/);
  assert.match(summary, /Urea \(46-0-0\) · 25 kg/);
  assert.match(summary, /Not applied yet/);
});

test('fertiliser details are dropped when a task stops being a fertiliser task, and other tasks never get them', () => {
  const state = farmState();
  submitForm(state, 'task', taskFields({ fertiliserProduct: 'NPK 15-15-15' }));
  const task = state.tasks[0];
  submitForm(state, 'task', taskFields({ id: task.id, category: 'Water', fertiliserProduct: 'NPK 15-15-15' }));
  assert.equal(task.category, 'Water');
  assert.equal(task.fertiliser, undefined);
  submitForm(state, 'task', taskFields({ title: 'Irrigate', category: 'Water', fertiliserProduct: 'Urea (46-0-0)' }));
  assert.equal(state.tasks.at(-1).fertiliser, undefined);
});

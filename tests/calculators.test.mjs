import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { CalculationError, calculateCost, calculateMargin, convertArea } from '../src/calculators.mjs';

const AREA_TOLERANCE = 1e-10;

test('area conversions use the international acre and round-trip correctly', () => {
  assert.equal(convertArea(1, 'ha', 'm2'), 10000);
  assert.equal(convertArea(1, 'acre', 'm2'), 4046.8564224);
  assert.ok(Math.abs(convertArea(convertArea(4.2, 'ha', 'acre'), 'acre', 'ha') - 4.2) < AREA_TOLERANCE);
  assert.equal(convertArea(0, 'm2', 'ha'), 0);
});

test('area conversions reject unknown units and invalid quantities', () => {
  for (const value of [-1, Number.NaN, Number.POSITIVE_INFINITY, '12', null]) {
    assert.throws(() => convertArea(value, 'ha', 'acre'), CalculationError);
  }
  assert.throws(() => convertArea(1, 'hectare', 'm2'), CalculationError);
  assert.throws(() => convertArea(1, 'ha', '__proto__'), CalculationError);
});

test('input cost multiplies the supplied area, quantity per area, and unit price', () => {
  assert.equal(calculateCost(4.2, 10, 6), 252);
  assert.equal(calculateCost(0, 10, 6), 0);
  assert.equal(calculateCost(4.2, 0, 6), 0);
  assert.throws(() => calculateCost(1, -5, 2), CalculationError);
  assert.throws(() => calculateCost(1, 5, '2'), CalculationError);
});

test('margin supports losses while requiring non-negative revenue and costs', () => {
  assert.equal(calculateMargin(1800, 1250), 550);
  assert.equal(calculateMargin(0, 1250), -1250);
  assert.equal(calculateMargin(1250, 1250), 0);
  assert.throws(() => calculateMargin(-1, 0), CalculationError);
  assert.throws(() => calculateMargin(1, Number.NaN), CalculationError);
});

test('overflow never returns an infinite estimate', () => {
  assert.throws(() => convertArea(Number.MAX_VALUE, 'ha', 'm2'), CalculationError);
  assert.throws(() => calculateCost(Number.MAX_VALUE, 2, 2), CalculationError);
});

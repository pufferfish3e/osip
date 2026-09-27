import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculatorInput, emptyCalculator, renderKeypadCalculator } from '../src/keypad-calculator.mjs';
const run = (keys) => keys.reduce(calculatorInput, emptyCalculator());
test('keypad supports arithmetic, decimals, sign, percentages and correction', () => {
  assert.equal(run(['2','+','3','=']).result, 5);
  assert.equal(run(['9','÷','3','=']).result, 3);
  assert.equal(run(['0','.','1','+','0','.','2','=']).result, .3);
  assert.equal(run(['5','±','×','2','=']).result, -10);
  assert.equal(run(['5','0','%','=']).result, .5);
  assert.equal(run(['1','2','⌫','3','=']).result, 13);
  assert.equal(run(['9','C']).display, '0');
  assert.equal(run(['2','+','×','3','=']).result, 6);
  assert.equal(run(['2','+','3','=','7']).display, '7');
  assert.throws(() => run(['2','÷','0','=']), /zero/);
});
test('calculator opens directly with twenty keys and saved icon', () => {
  const html = renderKeypadCalculator();
  assert.equal((html.match(/data-keypad-key=/g) ?? []).length, 20);
  assert.match(html, /href="\/tools\/saved"/);
  assert.match(html, /data-keypad-save disabled/);
  assert.doesNotMatch(html, /Area converter|Gross margin/);
});

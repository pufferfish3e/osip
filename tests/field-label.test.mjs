import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { renderFieldPreview } from '../src/field-preview.mjs';
import { fieldLabel } from '../src/ui.mjs';

const square = (latitude, longitude) => [[latitude, longitude], [latitude, longitude + 1], [latitude - 1, longitude + 1], [latitude - 1, longitude]];
const plots = [
  { id: 'a', name: 'Field 1', gridNumber: 1, crop: 'Rice', boundary: square(2, 0) },
  { id: 'b', name: 'Field 2', gridNumber: 2, crop: 'Rice', boundary: square(2, 1) },
  { id: 'c', name: 'Field 3', gridNumber: 3, crop: 'Durian', boundary: square(1, 0) },
  { id: 'd', name: 'North block', gridNumber: 4, crop: 'Chilli', boundary: square(1, 1) },
];

test('split-land fields are named after their crop, numbered only when crops repeat', () => {
  assert.deepEqual(plots.map((plot) => fieldLabel(plot, plots)), ['Rice 1', 'Rice 2', 'Durian', 'North block']);
  assert.equal(fieldLabel({ ...plots[0] }, plots), 'Rice 1');
  assert.equal(fieldLabel({ id: 'e', name: 'Field 5', gridNumber: 5, crop: '' }, plots), 'Field 5');
  assert.equal(fieldLabel({ id: 'f', name: 'Main plot', crop: 'Rice' }, plots), 'Main plot');
});

test('field preview highlights the chosen field inside its land', () => {
  const farm = { boundary: [[2, 0], [2, 2], [0, 2], [0, 0]], plots };
  const svg = renderFieldPreview(farm, 'c');
  assert.equal((svg.match(/field-preview-other/g) ?? []).length, 3);
  assert.equal((svg.match(/field-preview-selected/g) ?? []).length, 1);
  assert.match(svg, /field-preview-land/);
  assert.match(svg, /aria-hidden="true"/);
  assert.equal(renderFieldPreview({ plots: [{ id: 'x', boundary: [] }] }, 'x'), '');
});

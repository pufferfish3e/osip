import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderPlantHelp } from '../src/plant-help.mjs';

test('plant search and photo pages omit the redundant learning link', () => {
  for (const route of ['/plant-help', '/plant-help/camera']) {
    assert.doesNotMatch(renderPlantHelp(route), /Browse all learning|href="\/learn"/);
  }
});

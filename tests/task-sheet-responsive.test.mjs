import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { renderTaskTimePicker } from '../src/schedule.mjs';

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('task sheet constrains native time input and its containers on mobile', () => {
  assert.match(STYLES, /\.task-sheet form,\.task-sheet \[data-task-step\],\.task-sheet \.field \{ min-width:0; max-width:100%;/);
  assert.match(STYLES, /\.input,\.field input,\.field select,\.field textarea \{ width:100%;/);
  assert.match(renderTaskTimePicker('14:35'), /<label class="field">Time<input class="input" type="time" name="time" value="14:35" required><\/label>/);
  assert.doesNotMatch(renderTaskTimePicker(), /time-wheel|type="hidden"/);
});

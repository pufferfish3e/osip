import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('task sheet constrains native time input and its containers on mobile', () => {
  assert.match(STYLES, /\.task-sheet form,\.task-sheet \[data-task-step\],\.task-sheet \.field \{ min-width:0; max-width:100%;/);
  assert.match(STYLES, /\.task-sheet input\[type="time"\] \{[^}]*width:100%; min-width:0; max-width:100%; box-sizing:border-box;[^}]*appearance:none/);
  assert.match(STYLES, /::-webkit-date-and-time-value \{ min-width:0; text-align:left;/);
});

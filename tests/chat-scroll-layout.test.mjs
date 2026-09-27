import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('chat confines scrolling to message history and fixes header and composer layout', async () => {
  const css = await readFile(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /#main:has\(\.chat-screen\) \{[^}]*position:fixed;[^}]*overflow:hidden;/);
  assert.match(css, /\.chat-screen \{ height:100%; min-height:0; overflow:hidden;/);
  assert.match(css, /\.chat-history \{ min-height:0; overflow-y:auto;[^}]*overscroll-behavior:contain;/);
  assert.match(css, /\.chat-composer \{ position:static; flex-shrink:0;/);
});

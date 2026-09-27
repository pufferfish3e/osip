import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

test('app module imports are included in the server allowlist and offline cache', async () => {
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const visited = new Set();
  const visit = async (path) => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = await readFile(new URL(`..${path}`, import.meta.url), 'utf8');
    assert.ok(server.includes(`'${path}'`), `Server missing ${path}`);
    assert.ok(worker.includes(`'${path}'`), `Offline cache missing ${path}`);
    for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
      await visit(new URL(match[1], `https://app.test${path}`).pathname);
    }
  };
  await visit('/app.js');
});

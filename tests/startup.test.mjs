import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { createAppServer } from '../server.mjs';

const ROOT = new URL('../', import.meta.url);

test('every named startup import exists on its source module', async () => {
  const source = await readFile(new URL('src/browser-app.mjs', ROOT), 'utf8');
  const imports = [...source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g)];
  assert.ok(imports.length > 0);
  for (const [, names, path] of imports) {
    const module = await import(new URL(path, new URL('src/browser-app.mjs', ROOT)));
    for (const binding of names.split(',')) {
      const name = binding.trim().split(/\s+as\s+/)[0];
      assert.ok(Object.hasOwn(module, name), `${path} must export ${name} for startup`);
    }
  }
});

test('the server can deliver every JavaScript module needed to start the app', async (context) => {
  const server = createAppServer();
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  context.after(async () => await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const queue = ['/src/browser-app.mjs'];
  const visited = new Set();
  while (queue.length) {
    const path = queue.shift();
    if (visited.has(path)) continue;
    visited.add(path);
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, `${path} is required at startup`);
    assert.match(response.headers.get('content-type'), path.endsWith('.json') ? /application\/json/ : /javascript/);
    const source = await response.text();
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)) {
      if (dependency.startsWith('.')) queue.push(new URL(dependency, new URL(path, origin)).pathname);
    }
  }
  assert.ok(visited.has('/src/land-map.mjs'));
  assert.ok(visited.has('/src/land-boundary.mjs'));
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { createAppServer } from '../server.mjs';

test('server serves JSON seeds and their browser module with correct content types', async () => {
  const server = createAppServer();
  const handler = server.listeners('request')[0];
  for (const path of ['/data/active.json','/data/demo.json','/data/newuser.json','/src/storage-seed.mjs']) {
    let status;
    let headers;
    let content;
    const response = {
      writeHead:(code, values) => { status = code; headers = values; },
      end:(value) => { content = value; },
    };
    await handler({ method:'GET', url:path }, response);
    assert.equal(status, 200, path);
    assert.match(headers['Content-Type'], path.endsWith('.json') ? /application\/json/ : /text\/javascript/);
    assert.ok(content.length);
    if (path.endsWith('.json')) assert.doesNotThrow(() => JSON.parse(content.toString()));
  }
});

test('Vercel import activates the listener without changing local direct startup', () => {
  const source = readFileSync(new URL('../server.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(IS_DIRECT_ENTRY \|\| process.env.VERCEL === '1'\)/);
  assert.match(source, /process.env.PORT \?\? DEFAULT_PORT/);
});

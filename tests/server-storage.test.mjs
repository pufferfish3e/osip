import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

import { createAppServer } from '../server.mjs';

test('server serves JSON seeds and their browser module with correct content types', async () => {
  const server = createAppServer();
  const handler = server.listeners('request')[0];
  for (const path of ['/data/active.json','/data/demo.json','/data/newuser.json','/src/storage-seed.mjs','/src/task-history.mjs']) {
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

test('task history is included in the offline shell', () => {
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(source, /const SHELL_FILES = \[[\s\S]*?'\/src\/task-history\.mjs'/);
});

test('Vercel import activates the listener without changing local direct startup', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(source, /APP_SERVER.listen\(PORT\)/);
  assert.match(source, /process.env.PORT/);
  assert.doesNotMatch(source, /document|localStorage|browser-app/);
});

test('Vercel-selected app entry starts a server without browser globals', () => {
  const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
  let listenedPort;
  runInNewContext(source, {
    process:{ env:{ PORT:'3000' } }, console,
    createAppServer:() => ({ on:() => {}, listen:(port) => { listenedPort = port; } }),
  });
  assert.equal(listenedPort, 3000);
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(page, /src="\/src\/browser-app.mjs"/);
  assert.doesNotMatch(page, /src="\/app.js"/);
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import DEMO from '../data/demo.json' with { type: 'json' };
import { renderDiscover } from '../src/discover.mjs';
import { renderHome } from '../src/home.mjs';

test('all pesticide calculator routes are inactive', () => {
  for (const path of ['/tools', '/tools/spray', '/tools/options', '/tools/products', '/tools/tank']) {
    assert.equal(renderDiscover(path, DEMO), null, path);
  }
});

test('home and services no longer advertise the disabled calculator', () => {
  for (const html of [renderHome(DEMO), renderDiscover('/services', DEMO)]) {
    assert.doesNotMatch(html, /href="\/tools"|Pesticide calculator/);
  }
  assert.match(renderDiscover('/tools/area', DEMO), /Area converter/);
});

test('calculator browser integration and sidebar link remain commented for restoration', async () => {
  const browser = await readFile(new URL('../src/browser-app.mjs', import.meta.url), 'utf8');
  assert.match(browser, /\/\/ import \{ initializeMixturePlanner \}/);
  assert.match(browser, /\/\/   disposeSprayCalculator = initializeMixturePlanner/);
  const shell = await readFile(new URL('../src/shell.mjs', import.meta.url), 'utf8');
  assert.match(shell, /\/\* Pesticide calculator disabled;[^]*?<a href="\/tools">[^]*?\*\/ ''/);
});

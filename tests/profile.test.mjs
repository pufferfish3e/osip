import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

import { INITIAL_STATE } from '../src/data.mjs';
import { setLocale } from '../src/i18n.mjs';
import { localizeDemoState, profilePhoto } from '../src/ui.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const PROFILE_NAME = 'Ambitious Ahmad';
const PHOTO_PATH = '/assets/profile-ahmad.jpg';
const MAX_PHOTO_BYTES = 30_000;

test('account keeps the requested name and local portrait across languages', () => {
  try {
    for (const locale of ['en', 'ms', 'zh-Hans']) {
      setLocale(locale);
      const html = renderWorkspace('/account', structuredClone(INITIAL_STATE));
      assert.ok(html.includes(PROFILE_NAME));
      assert.ok(html.includes(profilePhoto()));
    }
  } finally { setLocale('en'); }
});

test('legacy default account displays the new name while custom names remain intact', () => {
  const state = structuredClone(INITIAL_STATE);
  state.profile.name = 'Farmer';
  assert.equal(localizeDemoState(state).profile.name, PROFILE_NAME);
  assert.equal(state.profile.name, 'Farmer');
  state.profile.name = 'Aina';
  assert.equal(localizeDemoState(state).profile.name, 'Aina');
});

test('portrait is a small local JPEG included in static serving and offline caching', async () => {
  const [photo, server, worker] = await Promise.all([
    readFile(new URL(`..${PHOTO_PATH}`, import.meta.url)),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
    readFile(new URL('../sw.js', import.meta.url), 'utf8'),
  ]);
  assert.equal(photo.subarray(0, 3).toString('hex'), 'ffd8ff');
  assert.ok(photo.length < MAX_PHOTO_BYTES);
  assert.ok(server.includes(`'${PHOTO_PATH}'`));
  assert.ok(worker.includes(`'${PHOTO_PATH}'`));
});

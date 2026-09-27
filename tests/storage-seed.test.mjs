import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import DEMO from '../data/demo.json' with { type:'json' };
import NEW_USER from '../data/newuser.json' with { type:'json' };
import { createStore, StateValidationError } from '../src/store.mjs';

const storage = () => {
  const values = new Map();
  return { getItem:(key) => values.get(key) ?? null, setItem:(key, value) => { values.set(key, value); } };
};

test('JSON templates seed complete localStorage state with empty new-user collections', () => {
  const disk = storage();
  const demo = createStore(disk, DEMO, 'demo');
  const fresh = createStore(disk, NEW_USER, 'newuser');
  assert.ok(demo.getState().farms.length);
  assert.equal(fresh.getState().profile.name, '');
  for (const key of ['farms','tasks','bookings','cart','orders','savedArticles','savedCalculations','notifications']) assert.deepEqual(fresh.getState()[key], []);
  assert.ok(disk.getItem('osip-state-v2'));
  assert.ok(disk.getItem('osip-state-v2-newuser'));
});

test('switching seed profiles preserves each saved state without changing templates', () => {
  const disk = storage();
  createStore(disk, DEMO, 'demo').update((state) => { state.profile.name = 'Demo changes'; });
  createStore(disk, NEW_USER, 'newuser').update((state) => { state.profile.name = 'New farmer'; });
  assert.equal(createStore(disk, DEMO, 'demo').getState().profile.name, 'Demo changes');
  assert.equal(createStore(disk, NEW_USER, 'newuser').getState().profile.name, 'New farmer');
  assert.equal(NEW_USER.profile.name, '');
  assert.equal(DEMO.profile.name, 'Ambitious Ahmad');
});

test('invalid seed data fails explicitly and does not overwrite saved records', () => {
  const disk = storage();
  createStore(disk, DEMO, 'demo');
  const before = disk.getItem('osip-state-v2');
  assert.throws(() => createStore(disk, {}, 'demo'), StateValidationError);
  assert.equal(disk.getItem('osip-state-v2'), before);
});

test('offline shell includes both templates and the selector', () => {
  const source = readFileSync(new URL('../sw.js', import.meta.url), 'utf8');
  for (const path of ['/data/demo.json','/data/newuser.json','/data/active.json','/src/storage-seed.mjs']) assert.ok(source.includes(path));
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import NEW_USER from '../data/newuser.json' with { type: 'json' };
import { isProfilePhoto, prepareProfilePhoto } from '../src/profile-photo.mjs';
import { createStore } from '../src/store.mjs';
import { profilePhoto } from '../src/ui.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const PHOTO = 'data:image/jpeg;base64,/9j/AAAA';

test('only bounded local JPEG pictures and the demo asset are accepted', () => {
  assert.ok(isProfilePhoto(PHOTO));
  assert.ok(isProfilePhoto(undefined));
  for (const photo of ['https://example.com/photo.jpg', 'data:image/svg+xml;base64,AAAA', PHOTO + '"', PHOTO + 'A'.repeat(200000)]) assert.equal(isProfilePhoto(photo), false);
  assert.match(profilePhoto({ photo: PHOTO }), /data:image\/jpeg/);
});

test('photo persists through reload without changing onboarding or name', () => {
  const saved = new Map();
  const storage = { getItem: (key) => saved.get(key) ?? null, setItem: (key, value) => saved.set(key, value) };
  const store = createStore(storage, NEW_USER, 'newuser');
  store.update((state) => { state.profile.photo = PHOTO; });
  const reloaded = createStore(storage, NEW_USER, 'newuser').getState();
  assert.equal(reloaded.profile.photo, PHOTO);
  assert.equal(reloaded.profile.name, '');
  assert.equal(reloaded.profile.onboarded, false);
  assert.throws(() => store.update((state) => { state.profile.photo = 'https://example.com'; }));
  assert.equal(store.getState().profile.photo, PHOTO);
});

test('upload is optional in both onboarding roles and account', () => {
  for (const path of ['/onboarding/farmer', '/onboarding/pilot', '/account']) {
    const html = renderWorkspace(path, structuredClone(NEW_USER));
    assert.match(html, /data-profile-photo/);
    assert.match(html, /Profile picture \(optional\)/);
    assert.doesNotMatch(html, /type="file"[^>]*required/);
  }
});

test('unsupported and oversized uploads are rejected before decoding', async () => {
  await assert.rejects(prepareProfilePhoto({ type: 'image/svg+xml', size: 10 }), /JPEG/);
  await assert.rejects(prepareProfilePhoto({ type: 'image/jpeg', size: 16 * 1024 * 1024 }), /15 MB/);
});

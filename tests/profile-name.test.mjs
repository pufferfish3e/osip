import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderHome } from '../src/home.mjs';
import { createStore } from '../src/store.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('explicit first and last names persist and greetings use the entire first name', () => {
  let saved = null;
  const storage = {getItem:()=>saved,setItem:(_key,value)=>{saved=value;}};
  const store = createStore(storage);
  store.update((state) => { submitForm(state,'land-onboarding',{firstName:'Nur Aisyah',lastName:'Ahmad'}); });
  const state = createStore(storage).getState();
  assert.equal(state.profile.name,'Nur Aisyah Ahmad');
  assert.equal(state.profile.firstName,'Nur Aisyah');
  assert.equal(state.profile.lastName,'Ahmad');
  assert.match(renderHome(state),/morning, Nur Aisyah|day, Nur Aisyah/);
  for (const path of ['/auth/sign-up','/onboarding/farmer','/onboarding/pilot','/account/settings']) {
    const html=renderWorkspace(path,state);
    assert.ok(html.indexOf('name="firstName"') < html.indexOf('name="lastName"'));
    assert.match(html,/name="firstName"/);
  }
});
test('legacy profiles remain usable and missing split names are rejected', () => {
  const state=structuredClone(INITIAL_STATE);
  assert.doesNotThrow(()=>renderHome(state));
  assert.throws(()=>submitForm(state,'profile',{firstName:'Ahmad',lastName:''}));
  submitForm(state,'settings',{name:'Ahmad Ali',units:'ha',language:'en'});
  assert.equal(state.profile.firstName,'Ahmad');
});

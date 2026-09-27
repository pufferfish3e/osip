import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { DraftError, clearDraft, readDraft, saveDraft } from '../src/drafts.mjs';

const FARM_DRAFT_KEY = 'osip-onboarding-draft-v1:farmer-onboarding';

/** @param {Record<string,string>} initial @returns {import('../src/drafts.mjs').DraftStorage} */
const memoryStorage = (initial = {}) => {
  const records = new Map(Object.entries(initial));
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => { records.set(key, value); },
    removeItem: (key) => { records.delete(key); },
  };
};

test('a missing onboarding draft returns null', () => {
  assert.equal(readDraft(memoryStorage(), 'farmer-onboarding'), null);
});

test('partial onboarding progress survives a save and read without changing string values', () => {
  const storage = memoryStorage();
  const fields = { name: 'Aina', farmName: 'North field', area: '4.20', crop: '', location: 'Town & district' };
  saveDraft(storage, 'farmer-onboarding', fields);
  assert.deepEqual(readDraft(storage, 'farmer-onboarding'), fields);
  assert.equal(storage.getItem(FARM_DRAFT_KEY), JSON.stringify(fields));
});

test('farmer, pilot, and verification drafts use independent keys', () => {
  const storage = memoryStorage();
  saveDraft(storage, 'farmer-onboarding', { name: 'Farmer' });
  saveDraft(storage, 'pilot-onboarding', { name: 'Pilot', services: 'Mapping', rate: '65' });
  saveDraft(storage, 'verification', { credentialReference: 'demo-reference' });
  assert.equal(readDraft(storage, 'farmer-onboarding').name, 'Farmer');
  assert.equal(readDraft(storage, 'pilot-onboarding').name, 'Pilot');
  assert.equal(readDraft(storage, 'verification').credentialReference, 'demo-reference');
});

test('clearing one draft preserves other drafts and unrelated application records', () => {
  const storage = memoryStorage({ 'osip-state-v2': 'existing app record' });
  saveDraft(storage, 'farmer-onboarding', { name: 'Farmer' });
  saveDraft(storage, 'pilot-onboarding', { name: 'Pilot' });
  clearDraft(storage, 'farmer-onboarding');
  assert.equal(readDraft(storage, 'farmer-onboarding'), null);
  assert.equal(readDraft(storage, 'pilot-onboarding').name, 'Pilot');
  assert.equal(storage.getItem('osip-state-v2'), 'existing app record');
});

test('unsupported form keys cannot read, save, or clear application data', () => {
  const storage = memoryStorage();
  assert.throws(() => readDraft(storage, 'account'), DraftError);
  assert.throws(() => saveDraft(storage, '__proto__', { name: 'Test' }), DraftError);
  assert.throws(() => clearDraft(storage, 'osip-state-v2'), DraftError);
});

test('unsupported fields and non-text values are rejected before storage changes', () => {
  const storage = memoryStorage();
  saveDraft(storage, 'farmer-onboarding', { name: 'Saved name' });
  const invalidFields = [
    { name: 'New name', password: 'must-not-save' }, { upload: { name: 'document.pdf' } },
    { name: 42 }, { crop: ['Rice'] }, { equipment: 'Wrong form' }, [], null,
  ];
  for (const fields of invalidFields) assert.throws(() => saveDraft(storage, 'farmer-onboarding', fields), DraftError);
  assert.deepEqual(readDraft(storage, 'farmer-onboarding'), { name: 'Saved name' });
});

test('corrupt and malformed stored drafts throw while preserving their original records', () => {
  for (const raw of ['broken json', 'null', '[]', '{"name":8}', '{"password":"private"}']) {
    const storage = memoryStorage({ [FARM_DRAFT_KEY]: raw });
    assert.throws(() => readDraft(storage, 'farmer-onboarding'), DraftError);
    assert.equal(storage.getItem(FARM_DRAFT_KEY), raw);
  }
});

test('storage read, write, and clear failures expose a visible error and cause', () => {
  const storage = memoryStorage();
  const originalError = new Error('Storage is unavailable');
  storage.getItem = () => { throw originalError; };
  storage.setItem = () => { throw originalError; };
  storage.removeItem = () => { throw originalError; };
  const isVisibleError = (error) => error instanceof DraftError && error.cause === originalError && error.message.length > 0;
  assert.throws(() => readDraft(storage, 'farmer-onboarding'), isVisibleError);
  assert.throws(() => saveDraft(storage, 'pilot-onboarding', { name: 'Pilot' }), isVisibleError);
  assert.throws(() => clearDraft(storage, 'verification'), isVisibleError);
});

test('mutating returned fields does not change a persisted draft', () => {
  const storage = memoryStorage();
  saveDraft(storage, 'farmer-onboarding', { name: 'Saved name' });
  const draft = readDraft(storage, 'farmer-onboarding');
  draft.name = 'Unsaved name';
  assert.equal(readDraft(storage, 'farmer-onboarding').name, 'Saved name');
});

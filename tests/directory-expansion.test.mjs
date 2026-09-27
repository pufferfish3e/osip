import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { test } from 'node:test';
import { EXPERTS } from '../src/expert-data.mjs';
import { PILOTS } from '../src/data.mjs';
import { renderExperts } from '../src/expert-ui.mjs';
import { renderPilotReviews } from '../src/pilot-matcher.mjs';

test('expanded directories have unique identities and mostly separate experts and pilots', () => {
  assert.equal(EXPERTS.length, 28);
  assert.equal(PILOTS.length, 11);
  assert.equal(new Set(EXPERTS.map((profile) => profile.id)).size, EXPERTS.length);
  assert.equal(new Set(PILOTS.map((profile) => profile.id)).size, PILOTS.length);
  const pilots = new Set(PILOTS.map((profile) => profile.name));
  assert.ok(EXPERTS.filter((profile) => pilots.has(profile.name)).length <= 3);
  assert.ok(new Set(EXPERTS.map((profile) => profile.area)).size >= 6);
  assert.ok(EXPERTS.every((profile) => profile.crops.length && profile.topics.length && profile.languages.length));
});

test('all portraits are available locally and new pilots have no fabricated reviews', async () => {
  for (const path of new Set([...EXPERTS, ...PILOTS].map((profile) => profile.portrait))) {
    await access(new URL(`..${path}`, import.meta.url));
  }
  for (const pilot of PILOTS.slice(3)) {
    assert.equal(pilot.isDemo, true);
    assert.equal(pilot.reviewCount, 0);
    assert.deepEqual(pilot.reviews, []);
    assert.match(renderPilotReviews(pilot), /No reviews yet/);
    assert.match(pilot.available, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('expert subheader remains removed from listing and profiles', () => {
  assert.doesNotMatch(renderExperts(), /Demo profiles · Chats stay on this device/);
  for (const expert of EXPERTS) {
    const html = renderExperts(expert.id);
    assert.match(html, /data-form="expert-chat"/);
    assert.doesNotMatch(html, /Expert not found|Demo profiles · Chats stay on this device/);
  }
});

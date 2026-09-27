import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { test } from 'node:test';
import { EXPERTS } from '../src/expert-data.mjs';
import { PILOTS } from '../src/data.mjs';

const ROOT = new URL('../', import.meta.url);

test('every expert and pilot has an existing portrait available online and offline', () => {
  const server = readFileSync(new URL('server.mjs', ROOT), 'utf8');
  const worker = readFileSync(new URL('sw.js', ROOT), 'utf8');
  for (const person of [...EXPERTS, ...PILOTS]) {
    assert.doesNotMatch(person.portrait, /avatar-default/);
    assert.ok(statSync(new URL(person.portrait.slice(1), ROOT)).size > 1000, person.name);
    assert.ok(server.includes(`'${person.portrait}'`), `${person.name}: server asset missing`);
    assert.ok(worker.includes(`'${person.portrait}'`), `${person.name}: offline asset missing`);
  }
});

test('new fictional directory portraits are distinct', () => {
  const portraits = [...EXPERTS, ...PILOTS].map((person) => person.portrait).filter((path) => path.endsWith('.jpg'));
  assert.equal(portraits.length, 33);
  assert.equal(new Set(portraits).size, portraits.length);
  const hashes = portraits.map((path) => {
    const bytes = readFileSync(new URL(path.slice(1), ROOT));
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    assert.ok(bytes.length < 250000, `${path}: portrait is too large for a directory card`);
    return createHash('sha256').update(bytes).digest('hex');
  });
  assert.equal(new Set(hashes).size, portraits.length);
});

import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { searchServices, renderServiceResults, renderDiscover } from '../src/discover.mjs';
import { setLocale } from '../src/i18n.mjs';
import { INITIAL_STATE } from '../src/data.mjs';

afterEach(() => setLocale('en'));

test('search covers pilots and products with phrases, synonyms and intent', () => {
  assert.ok(searchServices('aerial survey').some((item) => item.kind === 'pilot'));
  assert.deepEqual(searchServices('hire drone spray').map((item) => item.id), ['maya']);
  assert.deepEqual(searchServices('buy batteries').map((item) => item.id), ['field-battery']);
  assert.ok(searchServices('drone').some((item) => item.kind === 'shop'));
  assert.ok(searchServices('drone').some((item) => item.kind === 'pilot'));
  assert.equal(searchServices('Maya')[0].id, 'maya');
  assert.deepEqual(searchServices('impossiblekeyword'), []);
  assert.deepEqual(searchServices('   '), []);
});

test('Malay and Chinese synonyms match across the same catalogue', () => {
  setLocale('ms');
  assert.deepEqual(searchServices('beli bateri').map((item) => item.id), ['field-battery']);
  assert.ok(searchServices('pemetaan').some((item) => item.kind === 'pilot'));
  setLocale('zh-Hans');
  assert.deepEqual(searchServices('购买电池').map((item) => item.id), ['field-battery']);
  assert.ok(searchServices('无人机测绘').some((item) => item.kind === 'pilot'));
});

test('services exposes one cross-catalogue search with safe empty results', () => {
  assert.match(renderDiscover('/services', INITIAL_STATE), /data-service-search/);
  assert.match(renderServiceResults('buy batteries'), /href="\/shop\/products\/field-battery"/);
  assert.doesNotMatch(renderServiceResults('<script>alert(1)</script>'), /<script>/);
});

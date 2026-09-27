import assert from 'node:assert/strict';
import { test, afterEach } from 'node:test';
import { searchServices, renderServiceResults, renderDiscover } from '../src/discover.mjs';
import { setLocale } from '../src/i18n.mjs';
import { INITIAL_STATE, PILOTS, PRODUCTS } from '../src/data.mjs';

afterEach(() => setLocale('en'));

test('search covers pilots and products with phrases, synonyms and intent', () => {
  assert.ok(searchServices('aerial survey').some((item) => item.kind === 'pilot'));
  assert.deepEqual(searchServices('hire drone spray').map((item) => item.id), ['maya']);
  assert.equal(searchServices('buy batteries')[0].id, 'field-battery');
  assert.ok(searchServices('drone').some((item) => item.kind === 'shop'));
  assert.ok(searchServices('drone').some((item) => item.kind === 'pilot'));
  assert.equal(searchServices('Maya')[0].id, 'maya');
  assert.deepEqual(searchServices('impossiblekeyword'), []);
  assert.deepEqual(searchServices('   '), []);
});

test('Malay and Chinese synonyms match across the same catalogue', () => {
  setLocale('ms');
  assert.ok(searchServices('beli bateri').some((item) => item.id === 'field-battery'));
  assert.ok(searchServices('pemetaan').some((item) => item.kind === 'pilot'));
  setLocale('zh-Hans');
  assert.ok(searchServices('购买电池').some((item) => item.id === 'field-battery'));
  assert.ok(searchServices('无人机测绘').some((item) => item.kind === 'pilot'));
});

test('services exposes one cross-catalogue search with safe empty results', () => {
  assert.match(renderDiscover('/services', INITIAL_STATE), /data-service-search/);
  assert.match(renderServiceResults('buy batteries'), /href="\/shop\/products\/field-battery"/);
  assert.doesNotMatch(renderServiceResults('<script>alert(1)</script>'), /<script>/);
});

test('pilot catalogue uses portrait cards with reviews, rates and searchable equipment', () => {
 const html = renderDiscover('/services/pilots', INITIAL_STATE);
 for (const pilot of PILOTS) {
  assert.ok(html.includes(pilot.portrait));
  assert.ok(html.includes(pilot.equipment.toLowerCase()));
  assert.ok(html.includes(`(${pilot.reviewCount})`));
  assert.ok(html.includes(`/services/pilots/${pilot.id}`));
 }
 assert.equal((html.match(/pilot-catalog-card/g) ?? []).length, PILOTS.length);
 assert.doesNotMatch(html, /badge badge-blue/);
});

test('shop uses pilot-style cards with distinct product images and labelled cart actions', () => {
  const html = renderDiscover('/shop', INITIAL_STATE);
  assert.equal((html.match(/pilot-portrait-card pilot-catalog-card shop-product-card/g) ?? []).length, PRODUCTS.length);
  for (const image of ['/assets/drone.jpg', '/assets/shop-power.jpg', '/assets/shop-weather.jpg']) assert.ok(html.includes(image));
  assert.equal((html.match(/data-action="add-cart"/g) ?? []).length, 3);
  assert.match(html, /aria-label="Add Field power kit to cart"/);
});

test('services entry cards share the photo overlay style with distinct images and pill links', () => {
  const html = renderDiscover('/services', INITIAL_STATE);
  assert.equal((html.match(/learning-photo-card services-feature-card/g) ?? []).length, 2);
  assert.ok(html.includes('/assets/shop-power.jpg'));
  assert.ok(html.includes(PILOTS[0].portrait));
  assert.match(html, /href="\/services\/pilots"/);
  assert.match(html, /href="\/shop"/);
});

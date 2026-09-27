import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { applyAction } from '../src/actions.mjs';
import { INITIAL_STATE, PRODUCTS } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { REAL_PRODUCTS } from '../src/real-products.mjs';

test('real equipment carries model, supplier, dated price and regional evidence', () => {
  assert.equal(REAL_PRODUCTS.length, 4);
  assert.equal(new Set(PRODUCTS.map((product) => product.id)).size, PRODUCTS.length);
  for (const product of REAL_PRODUCTS) {
    assert.equal(product.isDemo, false);
    assert.ok(product.price > 0);
    assert.equal(new URL(product.sourceUrl).hostname, 'ag.dji.com');
    assert.equal(new URL(product.supplierUrl).hostname, 'rcflyzone.com.my');
    assert.match(product.checkedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(existsSync(new URL(`..${product.image}`, import.meta.url)));
  }
});

test('shop shows real model details and distinguishes regional evidence and draft checkout', () => {
  const shop = renderDiscover('/shop', INITIAL_STATE);
  assert.match(shop, /DJI AGRAS T25/);
  assert.match(shop, /DJI AGRAS T100/);
  for (const product of REAL_PRODUCTS) {
    const detail = renderDiscover(`/shop/products/${product.id}`, INITIAL_STATE);
    assert.ok(detail.includes(product.supplierUrl));
    assert.ok(detail.includes(product.sourceUrl));
    assert.ok(detail.includes(product.regionalSourceUrl));
    assert.match(detail, /local drafts only/);
    assert.match(detail, /Illustrative field image/);
    assert.doesNotMatch(detail, /Sample product/);
  }
});

test('real models can be added to the existing cart without changing legacy product identities', () => {
  const state = structuredClone(INITIAL_STATE);
  applyAction(state, 'add-cart', REAL_PRODUCTS[0].id);
  assert.deepEqual(state.cart, [{ productId:REAL_PRODUCTS[0].id, quantity:1 }]);
  assert.ok(PRODUCTS.some((product) => product.id === 'scout-drone' && product.isDemo));
});

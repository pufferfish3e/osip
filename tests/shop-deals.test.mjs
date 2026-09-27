import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderDiscover } from '../src/discover.mjs';
import { INITIAL_STATE, PRODUCTS } from '../src/data.mjs';
import { parseDealOffers, renderShopOffers } from '../src/shop-deals.mjs';

test('saved offers appear immediately and custom lower-price search is available', () => {
  const product = PRODUCTS.find((item) => item.supplierUrl);
  const html = renderDiscover(`/shop/products/${product.id}`, INITIAL_STATE);
  assert.match(html, /shop-offer/);
  assert.ok(html.includes(product.supplierUrl));
  assert.match(html, /No rating available/);
  assert.doesNotMatch(html, /data-find-deals|data-action="add-cart"|Illustrative field image|Confirm current price/);
});

test('offers sort by price and show only supplied reputation figures', () => {
  const html = renderShopOffers([{ retailer:'Expensive', price:20, url:'https://example.com/a' }, { retailer:'Cheaper', price:10, url:'https://example.com/b', rating:4.8, reviewCount:100 }]);
  assert.ok(html.indexOf('Cheaper') < html.indexOf('Expensive'));
  assert.match(html, /★ 4.8 · 100/);
  assert.match(html, /No rating available/);
  assert.doesNotMatch(renderShopOffers([{ retailer:'Bad', price:1, url:'javascript:alert(1)' }]), /href=/);
});

test('deal results exclude higher prices and require a listing citation', () => {
  const text = 'DEAL: T25 | SELLER: Seller | PRICE: MYR 40,000 | MATCH: exact | CONDITION: new | RATING: 4.8 | REVIEWS: 20 [1]';
  const result = { text, citations:[{url:'https://example.com/product', title:'Listing',start:text.length-3,end:text.length}] };
  assert.equal(parseDealOffers(result, 47500)[0].price, 40000);
  assert.equal(parseDealOffers(result, 47500)[0].rating, 4.8);
  assert.equal(parseDealOffers(result, 30000).length, 0);
  assert.equal(parseDealOffers({...result,citations:[]},47500).length,0);
});

test('lower-price comparisons reject similar and used offers', () => {
  const offer = (match, condition) => {
    const text = `DEAL: Product | SELLER: Seller | PRICE: MYR 20 | MATCH: ${match} | CONDITION: ${condition} | RATING: unknown | REVIEWS: unknown [1]`;
    return {text,citations:[{url:'https://example.com/product',title:'Listing',start:text.length-3,end:text.length}]};
  };
  assert.equal(parseDealOffers(offer('similar','new'),100).length,0);
  assert.equal(parseDealOffers(offer('exact','used'),100).length,0);
  const parsed = parseDealOffers(offer('exact','new'),100);
  assert.equal(parsed.length,1);
  assert.equal(parsed[0].rating,undefined);
});

test('provider match notes and seller ratings without review totals remain readable', () => {
  const text = 'DEAL: VEODA TL160B | SELLER: Corated | PRICE: MYR 115 | MATCH: exact (model TL160B) | CONDITION: new | RATING: 4.9 | REVIEWS: unknown [1]';
  const result = {text,citations:[{url:'https://example.com/product',title:'Listing',start:text.length-3,end:text.length}]};
  const offers = parseDealOffers(result,130);
  assert.equal(offers.length,1);
  assert.equal(offers[0].rating,4.9);
  assert.equal(offers[0].reviewCount,undefined);
  assert.match(renderShopOffers(offers), /★ 4.9/);
  assert.doesNotMatch(renderShopOffers(offers), /0 reviews/);
});

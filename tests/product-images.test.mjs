import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sourceProductImage, attachProductImages } from '../server/product-images.mjs';

test('product images come from supported cited page metadata', async () => {
  const source = 'https://www.harvest-agro.com/product/roundup/';
  const fetchImpl = async () => new Response('<meta property="og:image" content="/images/product.jpg">', { headers: { 'content-type': 'text/html' } });
  assert.equal(await sourceProductImage(source, fetchImpl), 'https://www.harvest-agro.com/images/product.jpg');
  const result = await attachProductImages({ text: 'Example', citations: [{ url: source, title: 'Product', start: 0, end: 7 }] }, fetchImpl);
  assert.equal(result.images[0].source, source);
});

test('private and unsupported URLs never trigger a fetch; missing metadata remains optional', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls += 1; return new Response('No image', { headers: { 'content-type': 'text/html' } }); };
  assert.equal(await sourceProductImage('https://127.0.0.1/private', fetchImpl), null);
  assert.equal(await sourceProductImage('https://unknown.example/product', fetchImpl), null);
  assert.equal(calls, 0);
  assert.equal(await sourceProductImage('https://www.harvest-agro.com/product/roundup/', fetchImpl), null);
});

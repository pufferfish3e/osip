import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { ARTICLES } from '../src/data.mjs';

test('practical articles have distinct local photo content available to the server and offline cache', async () => {
  const articles = ARTICLES.filter((article) => article.plantGuideSlug);
  assert.equal(new Set(articles.map((article) => article.image)).size, articles.length);
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  const worker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  const hashes = [];
  for (const article of articles) {
    assert.ok(server.includes(article.image));
    assert.ok(worker.includes(article.image));
    const photo = await readFile(new URL(`..${article.image}`, import.meta.url));
    assert.equal(photo[0], 255);
    assert.equal(photo[1], 216);
    hashes.push(createHash('sha256').update(photo).digest('hex'));
  }
  assert.equal(new Set(hashes).size, articles.length);
});

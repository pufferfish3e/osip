import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { ARTICLES, INITIAL_STATE, loadArticleCatalogue } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';

test('startup does not depend on the large legacy article catalogue', () => {
  const seen = new Set();
  const visit = (url) => {
    if (seen.has(url.href)) return;
    seen.add(url.href);
    const source = readFileSync(url, 'utf8');
    for (const [, dependency] of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) visit(new URL(dependency, url));
  };
  visit(new URL('../src/browser-app.mjs', import.meta.url));
  assert.ok(![...seen].some((url) => url.endsWith('/article-catalogue.mjs')));
});

test('legacy article details load on demand once and retain their links', async () => {
  const before = ARTICLES.length;
  const { ARTICLE_CATALOGUE } = await import('../src/article-catalogue.mjs');
  const article = ARTICLE_CATALOGUE[0];
  assert.match(renderDiscover(`/learn/knowledge/${article.slug}`, INITIAL_STATE), /data-load-article-catalogue/);
  await Promise.all([loadArticleCatalogue(), loadArticleCatalogue()]);
  assert.equal(ARTICLES.length, before + ARTICLE_CATALOGUE.length);
  assert.ok(renderDiscover(`/learn/knowledge/${article.slug}`, INITIAL_STATE).includes(article.sourceUrl));
  assert.match(renderDiscover('/learn/knowledge/missing-guide', INITIAL_STATE), /Guide not found/);
});

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { test } from 'node:test';

import { ARTICLES, INITIAL_STATE } from '../src/data.mjs';
import { localizeLearningArticle, malaysiaLibraryArticles, matchArticles } from '../src/article-library.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { setLocale } from '../src/i18n.mjs';

const LIBRARY = malaysiaLibraryArticles(ARTICLES);

test('first batch contains 20 readable Malaysia-focused guides, with no uncurated imports', () => {
  assert.equal(LIBRARY.length,20);
  assert.ok(LIBRARY.every((article) => article.region === 'MY'));
  assert.equal(new Set(LIBRARY.map((article) => article.slug)).size,20);
  assert.ok(LIBRARY.every((article) => !article.id.startsWith('open-')));
  for (const article of LIBRARY) {
    assert.ok(article.sections.length >= 3);
    assert.ok(article.sections.reduce((count,section) => count + section.body.split(/\s+/).length,0) >= 130);
    assert.ok(existsSync(new URL(`..${article.image}`,import.meta.url)));
    assert.match(article.malaysiaSourceUrl ?? article.sourceUrl, /doa.gov.my|met.gov.my|PMC6213496/);
  }
});

test('all 20 guides render local-language content and working detail routes', () => {
  try {
    for (const locale of ['en','ms','zh-Hans']) {
      setLocale(locale);
      for (const article of LIBRARY) {
        const copy = localizeLearningArticle(article);
        const html = renderDiscover(`/learn/knowledge/${article.slug}`, INITIAL_STATE);
        assert.ok(html.includes(copy.title));
        assert.ok(copy.sections.every((section) => section.body.length > 25));
        assert.ok(html.includes(copy.sections.at(-1).body));
        assert.doesNotMatch(html,/Guide not found|Loading article/);
        if (locale !== 'en') assert.notEqual(copy.title,article.title);
      }
    }
  } finally { setLocale('en'); }
});

test('common problem searches work in one library and within topic categories', () => {
  assert.ok(matchArticles(LIBRARY,'Pests','aphid').some((article) => article.plantGuideSlug === 'aphids'));
  assert.ok(matchArticles(LIBRARY,'Pests','kutu daun').some((article) => article.plantGuideSlug === 'aphids'));
  assert.ok(matchArticles(LIBRARY,'Pests','蓟马').some((article) => article.slug === 'my-chilli-thrips'));
  assert.ok(matchArticles(LIBRARY,'Disease','durian').some((article) => article.slug === 'my-durian-canker'));
  assert.ok(matchArticles(LIBRARY,'Water','monsoon').length);
  assert.equal(matchArticles(LIBRARY,'Soil','aphid').length,0);
});

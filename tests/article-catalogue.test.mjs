import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARTICLE_CATALOGUE } from '../src/article-catalogue.mjs';
import { EXTENSION_ARTICLES } from '../src/extension-articles.mjs';
import { ARTICLES, INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { renderArticleLibrary } from '../src/article-library.mjs';

const TOPICS = ['Soil','Water','Pests','Harvest','Technology','Drones','Sustainability','Crop production'];
test('each requested topic contains at least 100 authentic, unique DOI records', () => {
  for (const topic of TOPICS) {
    const records = ARTICLE_CATALOGUE.filter((article) => article.topics.includes(topic));
    assert.ok(records.length >= 100, `${topic}: ${records.length}`);
    assert.equal(new Set(records.map((article) => article.doi.toLowerCase())).size,records.length);
  }
  assert.equal(new Set(ARTICLE_CATALOGUE.map((article) => article.id)).size,ARTICLE_CATALOGUE.length);
});
test('every imported article has source metadata without fabricated text or review claims', () => {
  for (const article of [...ARTICLE_CATALOGUE,...EXTENSION_ARTICLES]) {
    assert.ok(article.title.trim()); assert.ok(article.source.trim());
    assert.equal(new URL(article.sourceUrl).protocol,'https:');
    assert.equal(article.isDemo,false); assert.equal(article.reviewedAt,'');
    assert.deepEqual(article.sections,[]); assert.equal(article.readTime,0);
    assert.ok(article.checkedAt);
    if (article.kind === 'research') assert.ok(article.sourceUrl.includes(encodeURI(article.doi).replace(/\?/g,'%3F')) || article.sourceUrl.startsWith('https://doi.org/'));
  }
});
test('catalogue detail links to originals instead of sample guidance or copied full text', () => {
  const article=ARTICLES.find((record)=>record.kind==='research');
  const html=renderDiscover(`/learn/knowledge/${article.slug}`,INITIAL_STATE);
  assert.ok(html.includes(article.sourceUrl));
  assert.doesNotMatch(html,/Agricultural review pending|0 min read/);
  assert.match(html,/access may require a subscription/);
  assert.match(renderArticleLibrary(),/data-library-more/);
  assert.match(renderArticleLibrary(),/data-library-search/);
});

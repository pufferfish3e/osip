import { setLocale } from '../src/i18n.mjs';
import { PLANT_GUIDES, localizePlantGuide } from '../src/plant-guides.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARTICLE_CATALOGUE } from '../src/article-catalogue.mjs';
import { EXTENSION_ARTICLES } from '../src/extension-articles.mjs';
import { ARTICLES, INITIAL_STATE, loadArticleCatalogue } from '../src/data.mjs';
import { renderDiscover, renderPublicationArticle } from '../src/discover.mjs';
import { matchArticles, renderArticleLibrary } from '../src/article-library.mjs';

const TOPICS = ['Soil','Water','Pests','Harvest','Technology','Drones','Sustainability','Crop production'];
await loadArticleCatalogue();
test('each requested topic contains at least 100 distinct original publication links', () => {
  for (const topic of TOPICS) {
    const records = ARTICLES.filter((article) => !article.isDemo && article.topics?.includes(topic));
    assert.ok(records.length >= 100, `${topic}: ${records.length}`);
    assert.equal(new Set(records.map((article) => article.sourceUrl.toLowerCase())).size,records.length);
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
  const article=ARTICLES.find((record)=>record.kind==='research' && !record.contentPath);
  const html=renderDiscover(`/learn/knowledge/${article.slug}`,INITIAL_STATE);
  assert.ok(html.includes(article.sourceUrl));
  assert.doesNotMatch(html,/Agricultural review pending|0 min read/);
  assert.match(html,/access may require a subscription/);
  assert.match(renderArticleLibrary(),/data-library-more/);
  assert.match(renderArticleLibrary(),/data-library-search/);
});

test('topic and publisher searches filter the complete catalogue, including overlapping topics', () => {
  const imported=ARTICLES.filter((article)=>!article.isDemo);
  const drones=matchArticles(imported,'Drones','');
  assert.ok(drones.length >= 100);
  const publisher=matchArticles(imported,'Drones','Penn State');
  assert.ok(publisher.length>0);
  assert.ok(publisher.every((article)=>article.source.includes('Penn State')));
  assert.equal(matchArticles(imported,'Drones','unfindablezzzz').length,0);
});

test('publication reader renders available body safely before its source citation', () => {
  const article = {...ARTICLE_CATALOGUE[0], readTime: 2, sections: [{title: 'Field observations', body: 'Check <leaves> & record symptoms.'}]};
  const html = renderPublicationArticle(article, false);
  assert.match(html, /<h2>Field observations<\/h2>/);
  assert.match(html, /Check &lt;leaves&gt; &amp; record symptoms./);
  assert.ok(html.indexOf('Field observations') < html.indexOf('Read original'));
  assert.doesNotMatch(html, /access may require a subscription/);
  assert.match(html, /2 min read/);
});

test('ten practical articles contain complete existing guide text in every supported language', () => {
  const practical = ARTICLES.filter((article) => article.plantGuideSlug);
  assert.equal(practical.length, PLANT_GUIDES.length);
  try {
    for (const locale of ['en', 'ms', 'zh-Hans']) {
      setLocale(locale);
      for (const article of practical) {
        const guide = localizePlantGuide(PLANT_GUIDES.find((item) => item.slug === article.plantGuideSlug), locale);
        const html = renderDiscover(`/learn/knowledge/${article.slug}`, INITIAL_STATE);
        assert.ok(html.includes(guide.title));
        assert.ok(html.includes(guide.whenToGetHelp));
        assert.equal(article.sections.length, 3);
        assert.ok(article.sections.every((section) => section.body.length > 80));
        assert.doesNotMatch(html, /access may require a subscription/);
      }
    }
  } finally { setLocale('en'); }
});

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';
import { loadArticleContent, renderArticleBlock, validateArticleContent } from '../src/article-reader.mjs';
import { OPEN_ARTICLES, OPEN_ARTICLE_FILES } from '../src/open-articles.mjs';
import { renderArticleLibrary } from '../src/article-library.mjs';
import { renderPublicationArticle } from '../src/discover.mjs';
import { setLocale, t } from '../src/i18n.mjs';

test('article reader escapes publication text and rejects foreign figure URLs', () => {
  assert.equal(renderArticleBlock({type:'paragraph',text:'<script>alert(1)</script>'},0), '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>');
  assert.equal(renderArticleBlock({type:'figure',src:'https://evil.test/a.jpg'},0),'');
  assert.match(renderArticleBlock({type:'heading',level:99,text:'Methods'},2), /<h4 id="article-section-2">/);
  assert.match(renderArticleBlock({type:'figure',src:'/content/articles/PMC123-figure-1.jpg',caption:'Yield < control'},0), /Yield &lt; control/);
  assert.match(renderArticleBlock({type:'equation',text:'x < y'},0), /<code>x &lt; y<\/code>/);
  assert.throws(() => validateArticleContent({blocks: [{type:'table',rows:[42]}]}));
});

test('article loader validates path, HTTP failures and empty content', async () => {
  await assert.rejects(loadArticleContent('/api/secrets'), /Invalid article path/);
  await assert.rejects(loadArticleContent('/content/articles/PMC123.json', async () => new Response('',{status:503})), /503/);
  await assert.rejects(loadArticleContent('/content/articles/PMC123.json', async () => Response.json({blocks:[]})), /missing/);
  const expected = [{type:'paragraph',text:'A complete paragraph.'}];
  assert.deepEqual(await loadArticleContent('/content/articles/PMC123.json',async () => Response.json({blocks:expected})),expected);
});

test('imported articles have local bodies, usable licences and existing figures', () => {
  assert.ok(OPEN_ARTICLES.length > 0);
  assert.equal(new Set(OPEN_ARTICLES.map((article) => article.id)).size, OPEN_ARTICLES.length);
  for (const article of OPEN_ARTICLES) {
    assert.match(article.licenseUrl, /^https:\/\/creativecommons.org\/(licenses\/by\/|publicdomain\/zero\/)/);
    assert.ok(article.wordCount >= 700);
    const source = readFileSync(new URL(`..${article.contentPath}`,import.meta.url),'utf8');
    assert.equal(createHash('sha256').update(source).digest('hex'), article.contentHash);
    const payload = JSON.parse(source);
    const blocks = validateArticleContent(payload);
    assert.ok(blocks.filter((block) => block.type === 'paragraph').length > 3);
    for (const block of blocks.filter((item) => item.type === 'figure')) {
      assert.ok(OPEN_ARTICLE_FILES.includes(block.src));
      assert.ok(existsSync(new URL(`..${block.src}`,import.meta.url)));
      const image = readFileSync(new URL(`..${block.src}`,import.meta.url));
      assert.ok(image.subarray(0, 2).equals(Buffer.from([0xff, 0xd8])) || image.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47])));
    }
  }
});

test('article tables retain headers and cell spans without rendering markup', () => {
  const html = renderArticleBlock({type:'table',caption:'Results',rows:[[{text:'<input>',colSpan:2,rowSpan:1,isHeader:true}]],footnote:'Values are means.'},0);
  assert.match(html, /<th colspan="2" rowspan="1">&lt;input&gt;<\/th>/);
  assert.match(html, /Values are means/);
});

test('library stays unified without practical and research mode controls', () => {
  const html = renderArticleLibrary();
  assert.doesNotMatch(html, /data-library-mode/);
  assert.match(html, /data-library-search/);
  assert.match(html, /data-library-topics/);
});

test('imported reader keeps source attribution and localizes its surrounding controls', () => {
  try {
    for (const locale of ['en','ms','zh-Hans']) {
      setLocale(locale);
      const article = OPEN_ARTICLES[0];
      const html = renderPublicationArticle(article,false);
      assert.ok(html.includes(article.contentPath));
      assert.ok(html.includes(article.sourceUrl));
      assert.ok(html.includes(article.licenseUrl));
      assert.ok(html.includes(t('Original article in English')));
      assert.ok(html.includes(t('Loading article…')));
      assert.doesNotMatch(html, /access may require a subscription/);
    }
  } finally { setLocale('en'); }
});

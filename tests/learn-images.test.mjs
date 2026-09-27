import { strict as assert } from 'node:assert';
import { readFile } from 'node:fs/promises';
import { afterEach, test } from 'node:test';

import { ARTICLES, INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { setLocale } from '../src/i18n.mjs';

const MAX_HERO_BYTES = 350_000;
const MAX_THUMBNAIL_BYTES = 30_000;
const LOCALES = ['en', 'ms', 'zh-Hans'];

/** @param {string} path @returns {Promise<Buffer>} */
const readAsset = async (path) => readFile(new URL(`..${path}`, import.meta.url));

afterEach(() => setLocale('en'));

test('existing editorial photographs retain local JPEG assets within budget', async () => {
  const illustrated = ARTICLES.filter((article) => article.image);
  assert.equal(new Set(illustrated.map((article) => article.image)).size, illustrated.length);
  assert.equal(new Set(illustrated.map((article) => article.thumbnail)).size, illustrated.length);
  for (const article of illustrated) {
    const [hero, thumbnail] = await Promise.all([readAsset(article.image), readAsset(article.thumbnail)]);
    for (const image of [hero, thumbnail]) assert.equal(image.subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.ok(hero.length < MAX_HERO_BYTES, `${article.id} hero exceeds byte budget`);
    assert.ok(thumbnail.length < MAX_THUMBNAIL_BYTES, `${article.id} thumbnail exceeds byte budget`);
    assert.ok(thumbnail.length < hero.length, `${article.id} must use a smaller mobile asset`);
  }
});

test('external article lists avoid invented photographs and lazy-load their results', () => {
  for (const locale of LOCALES) {
    setLocale(locale);
    const list=renderDiscover('/learn/knowledge',INITIAL_STATE);
    assert.match(list,/data-article-library/);
    assert.doesNotMatch(list,/src=""|srcset=""/);
    for (const article of ARTICLES.filter((record)=>record.image)) {
      const detail=renderDiscover(`/learn/knowledge/${article.slug}`,INITIAL_STATE);
      assert.ok(detail.includes(`src="${article.image}"`));
    }
  }
});
test('Learn features retain links and bookmarks without claiming publisher photographs', () => {
  const state=structuredClone(INITIAL_STATE);
  state.savedArticles=ARTICLES.map((article)=>article.id);
  const html=renderDiscover('/learn',state);
  for (const article of ARTICLES.slice(0,2)) {
    assert.ok(html.includes(`href="/learn/knowledge/${article.slug}"`));
    assert.ok(html.includes(`data-action="save-article" data-id="${article.id}" aria-pressed="true"`));
  }
  assert.match(renderDiscover('/learn/saved',state),/data-saved-only="true"/);
});

test('featured knowledge cards use local photographs instead of book placeholders', async () => {
  const html = renderDiscover('/learn', INITIAL_STATE);
  assert.doesNotMatch(html, /library-topic-art|#book["']/);
  assert.equal((html.match(/class="article-picture"/g) ?? []).length, 2);
  assert.match(html, /src="\/assets\/drone.jpg"/);
  const image = await readAsset('/assets/drone.jpg');
  assert.equal(image.subarray(0, 3).toString('hex'), 'ffd8ff');
});

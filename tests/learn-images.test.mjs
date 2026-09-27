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

test('each Learn article has distinct local JPEG hero and mobile thumbnail assets within budget', async () => {
  assert.equal(new Set(ARTICLES.map((article) => article.image)).size, ARTICLES.length);
  assert.equal(new Set(ARTICLES.map((article) => article.thumbnail)).size, ARTICLES.length);
  for (const article of ARTICLES) {
    const [hero, thumbnail] = await Promise.all([readAsset(article.image), readAsset(article.thumbnail)]);
    for (const image of [hero, thumbnail]) assert.equal(image.subarray(0, 3).toString('hex'), 'ffd8ff');
    assert.ok(hero.length < MAX_HERO_BYTES, `${article.id} hero exceeds byte budget`);
    assert.ok(thumbnail.length < MAX_THUMBNAIL_BYTES, `${article.id} thumbnail exceeds byte budget`);
    assert.ok(thumbnail.length < hero.length, `${article.id} must use a smaller mobile asset`);
  }
});

test('Learn lists use responsive decorative thumbnails and details retain the full article photograph', () => {
  for (const locale of LOCALES) {
    setLocale(locale);
    const list = renderDiscover('/learn/knowledge', INITIAL_STATE);
    assert.equal((list.match(/class="article-picture"/g) ?? []).length, ARTICLES.length);
    for (const article of ARTICLES) {
      assert.ok(list.includes(`media="(max-width: 639px)" srcset="${article.thumbnail}"`));
      assert.ok(list.includes(`src="${article.image}" alt="" loading="lazy"`));
      const detail = renderDiscover(`/learn/knowledge/${article.slug}`, INITIAL_STATE);
      assert.ok(detail.includes(`src="${article.image}"`));
      assert.ok(!detail.includes(article.thumbnail));
    }
  }
});

test('home and saved Learn cards keep article links, bookmarks and photo thumbnails together', () => {
  const state = structuredClone(INITIAL_STATE);
  state.savedArticles = ARTICLES.map((article) => article.id);
  for (const path of ['/learn', '/learn/saved']) {
    const html = renderDiscover(path, state);
    const visibleArticles = path === '/learn' ? ARTICLES.slice(0, 2) : ARTICLES;
    for (const article of visibleArticles) {
      assert.ok(html.includes(`href="/learn/knowledge/${article.slug}"`));
      assert.ok(html.includes(`srcset="${article.thumbnail}"`));
      assert.ok(html.includes(`data-action="save-article" data-id="${article.id}" aria-pressed="true"`));
    }
  }
});

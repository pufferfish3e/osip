import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { renderLearningArticleCard } from '../src/article-library.mjs';
import { ARTICLES, COURSES, INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('learning cards share photo styling while preserving bookmark and publication links', () => {
  for (const article of ARTICLES.slice(0, 2)) {
    const html = renderLearningArticleCard(article, true);
    assert.match(html, /learning-photo-card/);
    assert.match(html, /learning-photo-save/);
    assert.match(html, /aria-pressed="true"/);
    assert.ok(html.includes(`/learn/knowledge/${article.slug}`));
    assert.ok(html.includes(article.source));
    assert.match(html, /Read guide/);
    assert.match(html, /loading="lazy"/);
  }
});

test('course photo cards keep free pricing and course destinations', () => {
  const html = renderDiscover('/learn/courses', INITIAL_STATE);
  assert.equal((html.match(/course-photo-card/g) ?? []).length, COURSES.length);
  for (const course of COURSES) assert.ok(html.includes(`/learn/courses/${course.id}`));
  assert.match(html, />Free</);
  assert.match(html, /View course/);
  assert.match(STYLES, /\.learning-photo-card::after[^}]*linear-gradient/);
  assert.match(STYLES, /\.learning-photo-card h3[^}]*overflow-wrap:anywhere/);
});

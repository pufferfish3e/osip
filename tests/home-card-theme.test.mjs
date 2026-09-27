import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { INITIAL_STATE, NEWS, WEATHER } from '../src/data.mjs';
import { renderHome, selectFeaturedField } from '../src/home.mjs';

const STYLES = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('home weather keeps forecast values and link with the shared weather theme', () => {
  const html = renderHome(INITIAL_STATE);
  assert.match(html, /href="\/weather\/farm-1"/);
  assert.ok(html.includes(`${WEATHER.temperature}°`));
  assert.ok(html.includes(WEATHER.location));
  assert.match(html, /Sample forecast · not live/);
  assert.match(html, /weather-sun" aria-hidden="true">⛅/);
  assert.match(STYLES, /\.forecast-panel,\.weather-preview\.card[^}]*linear-gradient/);
});

test('land overview has borderless left blur with reduced-transparency fallback', () => {
  assert.match(STYLES, /\.farm-overview\s*\{[^}]*border:0/);
  assert.match(STYLES, /\.farm-overview::before[^}]*backdrop-filter:blur\(12px\)[^}]*mask-image:linear-gradient\(90deg/);
  assert.match(STYLES, /prefers-reduced-transparency:reduce[^}]*\.farm-overview::before/);
});

test('soil feature uses a landscape photo card and opens the soil guide', () => {
  const html = renderHome(INITIAL_STATE);
  assert.match(html, /knowledge-feature learning-photo-card/);
  assert.match(html, /href="\/learn\/knowledge\/getting-to-know-your-soil"/);
  assert.match(STYLES, /\.knowledge-feature\.learning-photo-card[^}]*aspect-ratio:2 \/ 1/);
  assert.match(STYLES, /\.knowledge-feature\.learning-photo-card[^}]*width:100%; min-width:0/);
});

test('empty schedule shows one task button and home previews the newest story', () => {
  const state = structuredClone(INITIAL_STATE);
  state.tasks = [];
  const html = renderHome(state);
  assert.doesNotMatch(html, /A clear schedule|class="card task-list"/);
  assert.equal((html.match(/Add a task<\/a>/g) ?? []).length, 1);
  const latest = [...NEWS].sort((a, b) => b.date.localeCompare(a.date))[0];
  assert.ok(html.includes(`/news/${latest.slug}`));
  assert.ok(html.includes(latest.title));
  assert.match(html, /home-story-card/);
});

 test('home grid allows mobile sections to shrink below intrinsic card width', () => {
  assert.match(STYLES, /\.home-lower \{[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(STYLES, /\.home-lower > section \{ min-width:0;/);
});

test('home story keeps section spacing and soil card has mobile padding', () => {
  assert.match(STYLES, /\.home-lower \+ \.home-story \{ margin-top:30px;/);
  assert.match(STYLES, /@media \(max-width:759px\) \{ \.knowledge-feature\.learning-photo-card \.knowledge-copy \{ padding:24px;/);
});

test('featured field uses most unfinished tasks and stable ties', () => {
  const state = structuredClone(INITIAL_STATE);
  const farm = state.farms[0];
  farm.plots = [{ ...farm.plots[0], id: 'first', name: 'First', area: 1 }, { ...farm.plots[0], id: 'second', name: 'Busy field', area: 2 }];
  state.tasks = [{ ...INITIAL_STATE.tasks[0], id: 'a', farmId: farm.id, plotId: 'second', done: false }, { ...INITIAL_STATE.tasks[0], id: 'b', farmId: farm.id, plotId: 'first', done: true }];
  assert.equal(selectFeaturedField(state).field.id, 'second');
  const html = renderHome(state);
  assert.match(html, /Busy field/);
  assert.ok(html.includes(`class="photo-button" href="/farm/${farm.id}"`));
  state.tasks = [];
  assert.equal(selectFeaturedField(state).field.id, 'first');
  state.farms = [];
  assert.equal(selectFeaturedField(state), undefined);
});

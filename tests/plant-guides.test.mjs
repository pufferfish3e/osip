import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { findPlantGuide, PLANT_GUIDES, searchPlantGuides } from '../src/plant-guides.mjs';

/** @param {string} query @param {'Pests'|'Disease'|'Growing conditions'|'all'} [category] @returns {string[]} */
const slugsFor = (query, category = 'all') => searchPlantGuides(query, category).map((guide) => guide.slug);

test('all ten plant guides have stable, unique routes and useful cited content', () => {
  assert.equal(PLANT_GUIDES.length, 10);
  assert.equal(new Set(PLANT_GUIDES.map((guide) => guide.slug)).size, PLANT_GUIDES.length);
  for (const guide of PLANT_GUIDES) {
    assert.match(guide.slug, /^[a-z]+(?:-[a-z]+)*$/);
    assert.ok(guide.title && guide.summary && guide.whenToGetHelp);
    assert.ok(guide.symptoms.length >= 2 && guide.actions.length >= 3);
    assert.ok(guide.keywords.length && guide.crops.length && guide.sources.length);
    assert.ok(guide.sources.every((source) => source.title && new URL(source.url).protocol === 'https:'));
  }
});

test('blank search returns all guides or the selected category without exposing array order to mutation', () => {
  const results = searchPlantGuides('  ');
  assert.deepEqual(results, PLANT_GUIDES);
  assert.notEqual(results, PLANT_GUIDES);
  assert.deepEqual(slugsFor('', 'Disease'), ['rice-blast']);
  assert.ok(searchPlantGuides('', 'Growing conditions').every((guide) => guide.category === 'Growing conditions'));
});

test('pests search returns pest guides, including rice and vegetable pests', () => {
  const results = searchPlantGuides('pests');
  assert.equal(results.length, 6);
  assert.ok(results.every((guide) => guide.category === 'Pests'));
  assert.ok(slugsFor('pest').includes('rice-planthoppers'));
});

test('yellow leaves prioritises the symptom guide and tolerates case, accents and punctuation', () => {
  assert.equal(slugsFor('yellow leaves')[0], 'yellow-leaves');
  assert.deepEqual(slugsFor('  YÉLLOW, LÉAVES! '), slugsFor('yellow leaves'));
  assert.equal(slugsFor('my leaves are yellow')[0], 'yellow-leaves');
  assert.equal(slugsFor('yellowing leaf')[0], 'yellow-leaves');
});

test('holes finds chewing pests while multi-term searches narrow the results', () => {
  assert.ok(slugsFor('holes').includes('caterpillars'));
  assert.ok(slugsFor('holes').includes('snails'));
  assert.equal(slugsFor('cabbage holes')[0], 'caterpillars');
  assert.deepEqual(slugsFor('white winding trails'), ['leafminers']);
});

test('crop and category constraints compose with symptom searches', () => {
  const riceResults = slugsFor('rice', 'Pests');
  assert.ok(riceResults.includes('rice-planthoppers'));
  assert.ok(riceResults.includes('snails'));
  assert.ok(!riceResults.includes('rice-blast'));
  assert.deepEqual(slugsFor('rice spots'), ['rice-blast']);
  assert.deepEqual(slugsFor('rice pests'), riceResults);
});

test('search requires every meaningful term and returns no results for unknown problems', () => {
  assert.deepEqual(slugsFor('quantum engine'), []);
  assert.deepEqual(slugsFor('rice quantum'), []);
  assert.deepEqual(slugsFor('aphids', 'Disease'), []);
  assert.deepEqual(slugsFor('the and my'), []);
  assert.deepEqual(slugsFor('<script>alert(1)</script>'), []);
});

test('common names, local keywords and water symptoms reach the relevant guide', () => {
  assert.equal(slugsFor('white flies')[0], 'whiteflies');
  assert.equal(slugsFor('kutu daun')[0], 'aphids');
  assert.equal(slugsFor('siput gondang')[0], 'snails');
  assert.equal(slugsFor('waterlogged')[0], 'waterlogging');
  assert.equal(slugsFor('dry soil')[0], 'water-stress');
});

test('findPlantGuide resolves exact camera result slugs and rejects unknown routes', () => {
  assert.equal(findPlantGuide('aphids'), PLANT_GUIDES[0]);
  assert.equal(findPlantGuide('not-a-guide'), undefined);
  assert.equal(findPlantGuide('__proto__'), undefined);
  assert.equal(findPlantGuide('APHIDS'), undefined);
});

test('search ranking does not reorder the shared guide catalogue', () => {
  const before = PLANT_GUIDES.map((guide) => guide.slug);
  searchPlantGuides('snails');
  searchPlantGuides('yellow leaves');
  assert.deepEqual(PLANT_GUIDES.map((guide) => guide.slug), before);
});

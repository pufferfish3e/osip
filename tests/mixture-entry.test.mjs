import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import NEW_USER from '../data/newuser.json' with { type: 'json' };
import { renderMixturePlanner, renderPesticideOptions, mixtureSteps, renderFormulaOptions, formulaSentence, cachedFormulaOptions, productMatches, renderProductMatches, renderProductMatchPage } from '../src/mixture-planner.mjs';

test('new users can start a formula and see an honest empty library', () => {
  const html = renderMixturePlanner(NEW_USER);
  assert.match(html, /data-mixture-new/);
  assert.match(html, /No saved formulas yet/);
  assert.doesNotMatch(html, /data-mixture-existing=/);
});

test('saved field formulas are offered by product and field without inventing presets', () => {
  const state = structuredClone(DEMO);
  const field = state.farms[0].plots[0];
  field.mixtureConfig = { product: 'Saved <label>', source: 'Actual product label' };
  const html = renderMixturePlanner(state);
  assert.ok(html.includes(`data-mixture-existing="${field.id}"`));
  assert.match(html, /Saved &lt;label&gt;/);
  assert.ok(html.includes(field.name));
  assert.match(html, /name="confirmed" required/);
});


test('guided screens separate field, crop, problem, label and equipment decisions', () => {
  const html = renderMixturePlanner(NEW_USER);
  const steps = [...html.matchAll(/data-mixture-step="(\d+)" hidden>(.*?)<\/div>/gs)];
  assert.equal(steps.length, 11);
  for (const [name, number] of [['fieldId', 0], ['crop', 1], ['purpose', 3], ['product', 4], ['source', 5], ['rate', 6], ['tank', 7], ['volume', 8]]) {
    assert.ok(steps[number][2].includes(`name="${name}"`));
  }
  assert.match(html, /data-mixture-path="label"/);
  assert.match(html, /data-mixture-path="find"/);
  assert.doesNotMatch(html, /Target pest, condition or nutrient goal/);
});


test('research has a full-page results area and a return to the label calculator', () => {
  const html = renderPesticideOptions(DEMO);
  assert.match(html, /data-pesticide-options/);
  assert.match(html, /data-options-results/);
  assert.match(html, /href="\/tools\?resume=1"/);
  assert.doesNotMatch(html, /data-mixture-planner|task-sheet/);
});


test('known field crops skip crop entry in both paths; missing crops still ask', () => {
  for (const shouldFind of [true, false]) {
    const steps = mixtureSteps('Rice', shouldFind);
    assert.deepEqual(steps.slice(0, 2), [0, 2]);
    assert.ok(!steps.includes(1));
    assert.deepEqual(mixtureSteps('', shouldFind).slice(0, 3), [0, 1, 2]);
    assert.deepEqual(mixtureSteps('  ', shouldFind).slice(0, 3), [0, 1, 2]);
  }
});


test('formula options distinguish the selectable name, fit and benefit', () => {
  const text = 'OPTION: Example candidate | WHY: Relevant crop | HELPS: Addresses the target [source]';
  const start = text.indexOf('[source]');
  const html = renderFormulaOptions({ text, citations: [{ url: 'https://example.org/label', title: 'Label source', start, end: text.length }] });
  assert.match(html, /data-formula-name="Example candidate"/);
  assert.doesNotMatch(html, /Why it fits/);
  assert.match(html, /Relevant crop/);
  assert.doesNotMatch(html, /How it helps/);
  assert.match(html, /Addresses the target/);
  assert.match(html, /data-formula-source="https:\/\/example.org\/label"/);
  assert.match(renderPesticideOptions(NEW_USER), /Never mind, I have a formula/);
});


test('options page hides repeated form and provides generation failure fallback without preview controls', () => {
  const html = renderPesticideOptions(NEW_USER);
  assert.match(html, /data-options-form hidden/);
  assert.match(html, /Unable to generate options/);
  assert.match(html, /Never mind, I have a formula/);
  assert.doesNotMatch(html, /data-options-preview|data-options-edit|Preview a response/);
});


test('options header is concise and keeps a short label-check note', () => {
  const html = renderPesticideOptions(NEW_USER);
  assert.doesNotMatch(html, /Explore the findings|does not confirm product registration/);
  assert.match(html, /AI suggestions. Check the product label before use./);
});


test('formula explanations have punctuation without duplicating existing stops', () => {
  assert.equal(formulaSentence('Fits rice weeds'), 'Fits rice weeds.');
  assert.equal(formulaSentence('Already complete.'), 'Already complete.');
  assert.equal(formulaSentence('Helps the target ('), 'Helps the target.');
  assert.match(renderPesticideOptions(NEW_USER), /Formula options/);
});

test('language rerenders share pending and completed AI requests without requerying', async () => {
  let calls = 0;
  let resolve;
  const pending = new Promise((done) => { resolve = done; });
  const request = () => { calls += 1; return pending; };
  const first = cachedFormulaOptions('same-field-crop-problem', request);
  const second = cachedFormulaOptions('same-field-crop-problem', request);
  assert.equal(first, second);
  resolve({ text: 'Stored response', citations: [] });
  await first;
  assert.equal((await cachedFormulaOptions('same-field-crop-problem', request)).text, 'Stored response');
  assert.equal(calls, 1);
});


test('product entry offers photo and natural description instead of a product-name text field', () => {
  const html = renderMixturePlanner(NEW_USER);
  assert.match(html, /data-product-description/);
  assert.match(html, /type="file"[^>]+data-product-photo/);
  assert.match(html, /data-product-matches/);
  assert.match(html, /type="hidden" name="product"/);
});


test('product matching provides up to four distinct sourced products and alternate-method retry', () => {
  const paragraphs = Array.from({ length: 5 }, (_, index) => `OPTION: Brand ${index} | WHY: Packaging detail | HELPS: Formulation detail [source]`);
  const text = paragraphs.join('\n\n');
  let cursor = 0;
  const citations = paragraphs.map((paragraph) => { const start = cursor + paragraph.indexOf('[source]'); cursor += paragraph.length + 2; return { url: 'https://example.org/product', title: 'Product page', start, end: start + '[source]'.length }; });
  const products = productMatches({ text, citations });
  assert.equal(products.length, 4);
  assert.equal(products[0].name, 'Brand 0');
  const html = renderProductMatches(products);
  assert.equal((html.match(/data-product-choice/g) ?? []).length, 4);
  assert.match(html, /None of these is mine/);
  assert.match(html, /data-product-retry-photo/);
  assert.match(html, /data-product-retry-description/);
});


test('product matches render outside the onboarding sheet', () => {
  const html = renderProductMatchPage();
  assert.match(html, /Which product is yours/);
  assert.match(html, /data-product-page/);
  assert.doesNotMatch(html, /data-mixture-planner|onboarding-sheet|<dialog/);
});

test('photo candidates show images and titles without reasoning or source clutter', () => {
  const products = Array.from({ length: 10 }, (_, index) => ({ name: `Brand ${index}`, detail: 'Hidden reasoning', source: 'https://example.org/product', image: 'https://example.org/product.jpg' }));
  const html = renderProductMatches(products, true);
  assert.match(html, /product-photo-grid/);
  assert.equal((html.match(/data-product-choice/g) ?? []).length, 10);
  assert.equal((html.match(/data-product-image/g) ?? []).length, 10);
  assert.doesNotMatch(html, /Hidden reasoning|>Source</);
  assert.match(html, /None of these is mine/);
});

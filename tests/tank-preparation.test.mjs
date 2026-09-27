import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { prepareMixture, renderTankPreparation, renderMixtureReview } from '../src/mixture-planner.mjs';
import { setLocale } from '../src/i18n.mjs';

const RECIPE = { product: 'Example product', crop: 'Rice', purpose: 'Weeds', kind: 'pesticide', basis: 'ml-ha', rate: 500, tank: 16, source: 'https://example.org/label', fieldId: 'plot-1', area: 2, volume: 100 };

test('tank page separates full and partial loads with correct liquid units', () => {
  assert.deepEqual(prepareMixture(RECIPE), { amount: 1000, unit: 'mL', finished: 200 });
  const html = renderTankPreparation(RECIPE);
  assert.match(html, /80 mL/);
  assert.match(html, /13 tank loads/);
  assert.match(html, /Final load: 8 L · 40 mL product/);
  assert.match(html, /Top up to 16 L/);
  assert.doesNotMatch(html, /role="dialog"|onboarding-sheet/);
});

test('small fields use a partial first load and solid products retain mass units', () => {
  const html = renderTankPreparation({ ...RECIPE, area: 0.05, basis: 'g-ha' });
  assert.match(html, /25 g/);
  assert.match(html, /Top up to 5 L/);
  assert.match(html, /1 tank loads/);
});

test('tank references are escaped and cannot become script links', () => {
  const html = renderTankPreparation({ ...RECIPE, product: '<script>', source: 'javascript:alert(1)' });
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /href="javascript:/);
  assert.match(html, /Not independently verified/);
  assert.match(html, /Illustrative colours/);
  assert.doesNotMatch(html, /99%|100% confidence/);
});

test('tank preparation validates impossible liquid amounts and handles missing drafts', () => {
  assert.throws(() => prepareMixture({ ...RECIPE, rate: 100000 }), /Product volume/);
  assert.throws(() => renderTankPreparation({ ...RECIPE, rate: 0 }), /positive label rate/);
  assert.match(renderTankPreparation(null), /Prepare a calculation first/);
});

test('tank language changes translate presentation without changing quantities', () => {
  try {
    setLocale('ms');
    const html = renderTankPreparation(RECIPE);
    assert.match(html, /Penyediaan tangki/);
    assert.match(html, /80 mL/);
    assert.match(html, /Belum disahkan secara bebas/);
  } finally { setLocale('en'); }
});


test('review groups field, label and equipment with readable units and escaped values', () => {
  const html = renderMixtureReview({ ...RECIPE, source: '<script>label</script>', rate: 0.000001 }, 'Land 1 · Field 2');
  assert.match(html, /<h3>Field<\/h3>/);
  assert.match(html, /<h3>Product label<\/h3>/);
  assert.match(html, /<h3>Tank settings<\/h3>/);
  assert.match(html, /<dt>Area<\/dt><dd>2 ha<\/dd>/);
  assert.match(html, /0.000001 mL product \/ ha/);
  assert.doesNotMatch(html, /ml-ha|<script>/);
  assert.match(html, /&lt;script&gt;label/);
  assert.match(html, /Land 1 · Field 2/);
  assert.doesNotMatch(renderMixtureReview({ ...RECIPE, purpose: '' }, 'Field'), /What problem are you treating/);
});

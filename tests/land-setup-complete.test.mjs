import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import { renderWorkspace } from '../src/workspace.mjs';

test('land setup completion confirms saved fields before opening the map', () => {
  const farm = DEMO.farms[0];
  const html = renderWorkspace(`/farm/${farm.id}/setup-complete`, structuredClone(DEMO));
  assert.match(html, /You’re all set\./);
  assert.ok(html.includes(`${farm.plots.length} ${farm.plots.length === 1 ? 'field' : 'fields'} ready`));
  assert.ok(html.includes(`href="/farm/${farm.id}"`));
  assert.match(html, /Want to plan your first task/);
  assert.match(html, /schedule\?plan=1/);
  assert.match(html, /Skip for now/);
  assert.match(html, /land-setup-confirmation/);
  assert.match(html, /onboarding-role-actions/);
  assert.doesNotMatch(html, /data-farm-map/);
  assert.match(renderWorkspace('/farm/missing/setup-complete', structuredClone(DEMO)), /Farm not found/);
});

test('successful field setup opens confirmation', () => {
  const source = readFileSync(new URL('../src/browser-app.mjs', import.meta.url), 'utf8');
  assert.ok(source.includes('navigate(`${url.pathname}${url.search}`)'));
  assert.match(source, /land-grid-saved[^\n]+\/setup-complete/);
});

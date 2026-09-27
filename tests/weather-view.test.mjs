import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE, WEATHER } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { setLocale, t } from '../src/i18n.mjs';

test('weather shows three data-driven trends and clearly identifies seeded weather', () => {
  for (const locale of ['en', 'ms', 'zh-Hans']) {
    setLocale(locale);
    const html = renderWorkspace('/weather/farm-1', INITIAL_STATE);
    assert.equal((html.match(/class="forecast-metric"/g) ?? []).length, 3);
    assert.equal((html.match(/viewBox="0 0 200 64"/g) ?? []).length, 3);
    assert.ok(html.includes(t('Sample forecast · not live')));
    assert.ok(html.includes(t('From {direction}', { direction: t('Northeast') })));
    assert.doesNotMatch(html, /NaN|undefined/);
  }
  setLocale('en');
  for (const hour of WEATHER.hourly) {
    assert.ok(Number.isFinite(hour.windSpeed));
    assert.ok(hour.humidity >= 0 && hour.humidity <= 100);
  }
});

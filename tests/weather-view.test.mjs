import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE, WEATHER } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { setLocale, t } from '../src/i18n.mjs';

test('weather shows three trends from a supplied forecast', () => {
  const forecast = { ...WEATHER, updatedAt:'2026-09-29T11:00', daily:WEATHER.daily.map((day, index) => ({ ...day, date:new Date(Date.UTC(2026,8,29+index)).toISOString().slice(0,10) })) };
  for (const locale of ['en', 'ms', 'zh-Hans']) {
    setLocale(locale);
    const html = renderWorkspace('/weather/farm-1', INITIAL_STATE, forecast, 'ready', 'Perak');
    assert.equal((html.match(/class="forecast-metric"/g) ?? []).length, 3);
    assert.equal((html.match(/viewBox="0 0 200 64"/g) ?? []).length, 3);
    assert.ok(html.includes('Open-Meteo'));
    assert.doesNotMatch(html, /Sample forecast/);
    assert.ok(html.includes(t('From {direction}', { direction: t('Northeast') })));
    assert.doesNotMatch(html, /NaN|undefined/);
  }
  setLocale('en');
  for (const hour of WEATHER.hourly) {
    assert.ok(Number.isFinite(hour.windSpeed));
    assert.ok(hour.humidity >= 0 && hour.humidity <= 100);
  }
});

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { renderBookingWeather } from '../src/booking-weather.mjs';
import { fetchDailyOutlook, flightOutlook, parseDailyOutlook } from '../src/weather.mjs';

const day = (values) => ({ date: '2026-10-15', condition: 'Cloudy', high: 31, rainChance: 10, windSpeed: 8, gusts: 14, ...values });

test('daily outlook keeps complete days and rounds readings', () => {
  const days = parseDailyOutlook({ daily: {
    time: ['2026-10-14', '2026-10-15', 'bad'], weather_code: [63, 1, 0], temperature_2m_max: [30.6, 31.2, 30],
    precipitation_probability_max: [80, null, 10], wind_speed_10m_max: [12.4, 9, 9], wind_gusts_10m_max: [20.5, 18, 18],
  } });
  assert.deepEqual(days, [{ date: '2026-10-14', condition: 'Rain', high: 31, rainChance: 80, windSpeed: 12, gusts: 21 }]);
  assert.throws(() => parseDailyOutlook({}), /Forecast data is unavailable/);
});

test('flight outlook warns about rain wash-off before wind drift', () => {
  assert.deepEqual(flightOutlook(day({})), { level: 'good', reason: 'clear' });
  assert.deepEqual(flightOutlook(day({ rainChance: 35 })), { level: 'caution', reason: 'rain' });
  assert.deepEqual(flightOutlook(day({ windSpeed: 15 })), { level: 'caution', reason: 'wind' });
  assert.deepEqual(flightOutlook(day({ windSpeed: 20 })), { level: 'warning', reason: 'wind' });
  assert.deepEqual(flightOutlook(day({ gusts: 35 })), { level: 'warning', reason: 'wind' });
  assert.deepEqual(flightOutlook(day({ rainChance: 60, windSpeed: 25 })), { level: 'warning', reason: 'rain' });
});

test('daily outlook request covers the whole seven-day booking window', async () => {
  let requested;
  const fetchImpl = async (url) => { requested = new URL(url); return { ok: true, json: async () => ({ daily: { time: [] } }) }; };
  assert.deepEqual(await fetchDailyOutlook({ label: 'Farm', latitude: 4.6, longitude: 101.1 }, fetchImpl), []);
  assert.equal(requested.searchParams.get('forecast_days'), '9');
  assert.match(requested.searchParams.get('daily'), /wind_gusts_10m_max/);
});

test('booking weather shows the selected day and an honest fallback', () => {
  const warning = renderBookingWeather('ready', day({ rainChance: 80 }));
  assert.match(warning, /data-level="warning"/);
  assert.match(warning, /Rain likely/);
  assert.match(warning, /80%/);
  assert.match(renderBookingWeather('ready', undefined), /Forecast not available yet for this day/);
  assert.match(renderBookingWeather('offline', undefined), /Connect to see the weather/);
  assert.match(renderBookingWeather('error', undefined), /data-level="none"/);
});

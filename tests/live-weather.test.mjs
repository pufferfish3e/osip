import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchLiveWeather, parseWeather, selectWeatherLocation } from '../src/weather.mjs';
import { renderHome } from '../src/home.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { INITIAL_STATE } from '../src/data.mjs';

const payload = {
  current: { time:'2026-09-29T11:15', temperature_2m:29.6, relative_humidity_2m:81, wind_speed_10m:12.4, wind_direction_10m:48, weather_code:2 },
  hourly: { time:Array.from({length:8}, (_, hour)=>`2026-09-29T${String(hour+11).padStart(2,'0')}:00`), wind_speed_10m:[11,12,13,14,15,16,17,18], precipitation_probability:[20,30,40,50,60,70,80,90], relative_humidity_2m:[80,79,78,77,76,75,74,73] },
  daily: { time:Array.from({length:7}, (_, day)=>`2026-10-0${day+1}`), temperature_2m_max:[31,32,33,34,35,36,37], temperature_2m_min:[23,24,25,26,27,28,29], precipitation_probability_max:[20,30,40,50,60,70,80] },
};

test('live weather uses the mapped land centroid and real hourly and daily values', async () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id:'land-1', name:'My land', crop:'Rice', plots:[], location:'My field', isDemo:false, boundary:[[4,101],[4,102],[5,102],[5,101]] }];
  const location = selectWeatherLocation(state, '/weather/land-1');
  assert.equal(location.latitude, 4.5);
  assert.equal(location.longitude, 101.5);
  const weather = await fetchLiveWeather(location, async (url) => {
    assert.equal(url.hostname, 'api.open-meteo.com');
    assert.equal(url.searchParams.get('latitude'), '4.5');
    assert.match(url.searchParams.get('hourly'), /precipitation_probability/);
    return Response.json(payload);
  });
  assert.equal(weather.temperature, 30);
  assert.equal(weather.rainChance, 20);
  assert.equal(weather.daily[6].high, 37);
  assert.equal(weather.hourly[2].windSpeed, 13);
  const html = renderWorkspace('/weather/land-1', state, weather, 'ready', location.label);
  assert.equal((html.match(/class="forecast-metric"/g) ?? []).length, 3);
  assert.match(html, /Open-Meteo/);
  assert.match(html, /13:00/);
  assert.doesNotMatch(html, /Sample forecast|NaN|undefined/);
  assert.match(renderHome(state, weather, 'ready', location.label), /30°/);
});

test('text locations geocode within Malaysia and missing forecast values fail closed', async () => {
  const location = { label:'Kedah' };
  let calls = 0;
  const weather = await fetchLiveWeather(location, async (url) => {
    calls += 1;
    if (calls === 1) {
      assert.equal(url.hostname, 'geocoding-api.open-meteo.com');
      assert.equal(url.searchParams.get('countryCode'), 'MY');
      return Response.json({ results:[{ latitude:6.1, longitude:100.4 }] });
    }
    assert.equal(url.searchParams.get('longitude'), '100.4');
    return Response.json(payload);
  });
  assert.equal(weather.location, 'Kedah');
  assert.throws(() => parseWeather({ ...payload, hourly:{ ...payload.hourly, precipitation_probability:[] } }, 'Kedah'), /unavailable/);
  const empty = renderWorkspace('/weather', INITIAL_STATE);
  assert.match(empty, /Loading forecast/);
  assert.doesNotMatch(empty, /Sample forecast|29°|forecast-metric/);
});

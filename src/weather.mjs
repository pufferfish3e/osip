const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const PERAK = { latitude: 4.5975, longitude: 101.0901, label: 'Perak' };
const WEATHER_CODES = new Map([[0, 'Sunny'], [1, 'Partly cloudy'], [2, 'Partly cloudy'], [3, 'Cloudy']]);
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
/** @typedef {{location:string,updatedAt:string,temperature:number,condition:string,humidity:number,windSpeed:number,windDirection:string,rainChance:number,hourly:{time:string,windSpeed:number,rainChance:number,humidity:number}[],daily:{date:string,high:number,low:number,rainChance:number}[]}} Weather */

/** @param {import('./store.mjs').AppState} state @param {string} path */
export function selectWeatherLocation(state, path = '') {
  const farmId = path.match(/^\/weather\/([^/]+)$/)?.[1];
  const farm = state.farms.find((item) => item.id === farmId)
    ?? state.farms.find((item) => item.isDemo === false)
    ?? state.farms[0];
  const label = farm?.location?.trim() || PERAK.label;
  const boundary = farm?.boundary;
  if (Array.isArray(boundary) && boundary.length && boundary.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) {
    return { label, latitude: boundary.reduce((sum, point) => sum + point[0], 0) / boundary.length, longitude: boundary.reduce((sum, point) => sum + point[1], 0) / boundary.length };
  }
  const coordinates = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/.exec(label);
  if (coordinates) {
    const latitude = Number(coordinates[1]), longitude = Number(coordinates[2]);
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { label, latitude, longitude };
  }
  return { label };
}

export const weatherLocationKey = (location) => `${location.label}|${location.latitude ?? ''}|${location.longitude ?? ''}`;

const condition = (code) => {
  if (WEATHER_CODES.has(code)) return WEATHER_CODES.get(code);
  if ([45, 48].includes(code)) return 'Cloudy';
  if (code >= 51 && code <= 77) return 'Rain';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code >= 95 && code <= 99) return 'Thunderstorms';
  return 'Cloudy';
};
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const rounded = (value) => Math.round(value);

/** @param {Record<string,unknown>} payload @param {string} label */
export function parseWeather(payload, label) {
  const current = payload?.current, hourly = payload?.hourly, daily = payload?.daily;
  if (typeof current?.time !== 'string' || !/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(current.time)
    || ![current.temperature_2m, current.relative_humidity_2m, current.wind_speed_10m, current.wind_direction_10m, current.weather_code].every(finite)
    || !Array.isArray(hourly?.time) || !Array.isArray(daily?.time)) throw new Error('Forecast data is unavailable.');
  const index = hourly.time.findIndex((time) => time?.slice(0, 13) === current.time.slice(0, 13));
  const hours = Array.from({ length: 6 }, (_, offset) => index + offset).map((position) => ({
    time: hourly.time[position], windSpeed: hourly.wind_speed_10m?.[position], rainChance: hourly.precipitation_probability?.[position], humidity: hourly.relative_humidity_2m?.[position],
  }));
  const days = daily.time.slice(0, 7).map((time, position) => ({
    date: time, high: daily.temperature_2m_max?.[position], low: daily.temperature_2m_min?.[position], rainChance: daily.precipitation_probability_max?.[position],
  }));
  if (index < 0 || hours.some((hour) => typeof hour.time !== 'string' || ![hour.windSpeed, hour.rainChance, hour.humidity].every(finite))
    || days.length < 7 || days.some((day) => !/^\d{4}-\d\d-\d\d$/.test(day.date) || ![day.high, day.low, day.rainChance].every(finite))) throw new Error('Forecast data is unavailable.');
  return {
    location: label, updatedAt: current.time, temperature: rounded(current.temperature_2m), condition: condition(current.weather_code),
    humidity: rounded(current.relative_humidity_2m), windSpeed: rounded(current.wind_speed_10m),
    windDirection: DIRECTIONS[Math.round(((current.wind_direction_10m % 360) + 360) % 360 / 45) % 8],
    rainChance: rounded(hours[0].rainChance),
    hourly: hours.map((hour) => ({ time: hour.time.slice(11, 16), windSpeed: rounded(hour.windSpeed), rainChance: rounded(hour.rainChance), humidity: rounded(hour.humidity) })),
    daily: days.map((day) => ({ ...day, high: rounded(day.high), low: rounded(day.low), rainChance: rounded(day.rainChance) })),
  };
}

/** @param {{label:string,latitude?:number,longitude?:number}} location @param {typeof fetch} [fetchImpl] @param {AbortSignal} [signal] */
export async function fetchLiveWeather(location, fetchImpl = fetch, signal) {
  const requestSignal = AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(12000)]);
  let { latitude, longitude } = location;
  if (!finite(latitude) || !finite(longitude)) {
    if (location.label === PERAK.label) ({ latitude, longitude } = PERAK);
    else {
      const geocode = new URL(GEOCODING_URL);
      geocode.search = new URLSearchParams({ name: location.label.split(',')[0].trim(), count: '1', countryCode: 'MY' });
      const found = await fetchImpl(geocode, { signal: requestSignal });
      if (!found.ok) throw new Error('Forecast location is unavailable.');
      const place = (await found.json()).results?.[0];
      if (!finite(place?.latitude) || !finite(place?.longitude)) throw new Error('Forecast location is unavailable.');
      ({ latitude, longitude } = place);
    }
  }
  const url = new URL(FORECAST_URL);
  url.search = new URLSearchParams({ latitude: String(latitude), longitude: String(longitude), timezone: 'auto', forecast_days: '7',
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m',
    hourly: 'wind_speed_10m,precipitation_probability,relative_humidity_2m',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_probability_max' });
  const response = await fetchImpl(url, { signal: requestSignal });
  if (!response.ok) throw new Error('Forecast data is unavailable.');
  return parseWeather(await response.json(), location.label);
}

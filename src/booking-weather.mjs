import { t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';
import { fetchDailyOutlook, flightOutlook, selectWeatherLocation, weatherLocationKey } from './weather.mjs';

/** @typedef {import('./weather.mjs').DayOutlook} DayOutlook */
/** @typedef {'loading'|'ready'|'offline'|'error'} OutlookStatus */
const OUTLOOK_MAX_AGE = 30 * 60 * 1000;
/** @type {Map<string,{days:DayOutlook[],checkedAt:number}>} */
const OUTLOOKS = new Map();

const COPY = {
  good: { clear: ['Good day to fly', 'Low rain and wind expected.'] },
  caution: { rain: ['Showers possible', 'Morning slots are usually drier.'], wind: ['Breezy', 'Morning is usually calmer.'] },
  warning: { rain: ['Rain likely', 'Spray may wash off. Try another day.'], wind: ['Strong wind', 'Spray may drift. Try another day.'] },
};
const SYMBOLS = { clear: 'sun', rain: 'cloud-rain', wind: 'wind' };

/** @param {OutlookStatus} status @param {DayOutlook|undefined} day @returns {string} */
export function renderBookingWeather(status, day) {
  if (status === 'ready' && day) {
    const { level, reason } = flightOutlook(day);
    const [title, detail] = COPY[level][reason];
    return `<div class="booking-weather" data-level="${level}"><span class="booking-weather-symbol">${icon(SYMBOLS[reason], 22)}</span><span class="booking-weather-copy"><strong>${esc(t(title))}</strong><span>${esc(t(detail))}</span></span><span class="booking-weather-stats"><span>${icon('droplet', 16)}<span class="sr-only">${esc(t('Rain chance'))}</span>${day.rainChance}%</span><span>${icon('wind', 16)}<span class="sr-only">${esc(t('Wind speed'))}</span>${day.windSpeed}<small>${esc(t('km/h'))}</small></span><span>${icon('temperature', 16)}<span class="sr-only">${esc(t('High'))}</span>${day.high}°</span></span></div>`;
  }
  const message = status === 'loading' ? 'Checking the weather…' : status === 'offline' ? 'Connect to see the weather for this day.' : status === 'error' ? 'Weather is unavailable right now.' : 'Forecast not available yet for this day.';
  return `<div class="booking-weather" data-level="none"><span class="booking-weather-symbol">${icon('cloud', 22)}</span><span class="booking-weather-copy"><span>${esc(t(message))}</span></span></div>`;
}

/** @param {HTMLElement} calendar @param {DayOutlook[]} days @returns {void} */
const markCalendar = (calendar, days) => {
  for (const button of calendar.querySelectorAll('[data-calendar-date]')) {
    const day = days.find((item) => item.date === button.dataset.calendarDate);
    const level = day && !button.disabled ? flightOutlook(day).level : '';
    if (level === 'good' || !level) delete button.dataset.weather;
    else button.dataset.weather = level;
  }
};

/** Shows the forecast for the selected booking date and flags risky days on the calendar.
 * @param {HTMLElement} root @param {import('./store.mjs').AppState} state @param {{gsap?:any,prefersReducedMotion:()=>boolean}} motion
 * @returns {{update:()=>void}} */
export function initializeBookingWeather(root, state, motion) {
  const panel = root.querySelector('[data-booking-weather]');
  const form = root.querySelector('form');
  const calendar = root.querySelector('[data-booking-calendar]');
  if (!panel || !form || !calendar) return { update: () => {} };
  let status = /** @type {OutlookStatus} */ ('loading');
  let days = /** @type {DayOutlook[]} */ ([]);
  let key = '';
  let shown = '';
  const update = () => {
    const date = form.elements.date.value;
    const day = days.find((item) => item.date === date);
    const html = renderBookingWeather(status, day);
    markCalendar(calendar, status === 'ready' ? days : []);
    if (html === shown) return;
    shown = html;
    panel.innerHTML = html;
    if (motion.gsap && !motion.prefersReducedMotion()) motion.gsap.fromTo(panel.firstElementChild, { autoAlpha: 0, y: 6 }, { autoAlpha: 1, y: 0, duration: 0.24, ease: 'power2.out', clearProps: 'all' });
  };
  const load = () => {
    const location = selectWeatherLocation(state, `/weather/${form.elements.farmId.value}`);
    const requestKey = weatherLocationKey(location);
    key = requestKey;
    const cached = OUTLOOKS.get(requestKey);
    if (cached && Date.now() - cached.checkedAt < OUTLOOK_MAX_AGE) { status = 'ready'; days = cached.days; update(); return; }
    if (navigator.onLine === false) { status = 'offline'; days = []; update(); return; }
    status = 'loading'; days = []; update();
    void fetchDailyOutlook(location).then((result) => {
      OUTLOOKS.set(requestKey, { days: result, checkedAt: Date.now() });
      if (key !== requestKey) return;
      status = 'ready'; days = result; update();
    }).catch((error) => {
      if (key !== requestKey) return;
      console.warn('Could not load booking forecast.', error);
      status = navigator.onLine === false ? 'offline' : 'error'; days = []; update();
    });
  };
  form.elements.farmId.addEventListener('change', load);
  load();
  return { update };
}

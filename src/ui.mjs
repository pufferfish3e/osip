import { INITIAL_STATE } from './data.mjs';
import { getFormatLocale, t } from './i18n.mjs';

/** @param {unknown} value @returns {string} */
export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

/** @param {string} name @param {number} size @returns {string} */
export function icon(name, size = 22) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><use href="/assets/icons.svg#${escapeHtml(name)}"></use></svg>`;
}

/** @param {string} eyebrow @param {string} title @param {string} description @returns {string} */
export function pageHeading(eyebrow, title, description = '') {
  return `<header class="page-heading"><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="page-title" tabindex="-1">${escapeHtml(title)}</h1>${description ? `<p class="page-description">${escapeHtml(description)}</p>` : ''}</header>`;
}

/** @param {string} title @param {string} description @param {string} href @param {string} label @returns {string} */
export function emptyState(title, description, href = '', label = '') {
  return `<section class="empty-state card card-pad">${icon('plant-2', 36)}<h2>${escapeHtml(t(title))}</h2><p class="muted">${escapeHtml(t(description))}</p>${href ? `<a class="button" href="${escapeHtml(href)}">${escapeHtml(t(label))}</a>` : ''}</section>`;
}

/** @param {number} amount @returns {string} */
export function money(amount) {
  return new Intl.NumberFormat(getFormatLocale(), { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(amount);
}

/** @param {string} value @returns {string} */
export function friendlyDate(value) {
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.valueOf()) ? t('Date to confirm') : new Intl.DateTimeFormat(getFormatLocale(), { month: 'short', day: 'numeric' }).format(date);
}

/** Translate only untouched demo fields; custom records and persisted data stay unchanged.
 * @param {import('./store.mjs').AppState} state @returns {import('./store.mjs').AppState}
 */
export function localizeDemoState(state) {
  const demo = INITIAL_STATE.farms[0];
  const farms = state.farms.map((farm) => {
    if (farm.id !== demo?.id || farm.isDemo === false) return { ...farm, crop: farm.crop.split(', ').map((crop) => t(crop)).join(', '), plots: farm.plots.map((plot) => ({ ...plot, name: Number.isInteger(plot.gridNumber) && plot.name === `Field ${plot.gridNumber}` ? t('Field {number}', { number: plot.gridNumber }) : plot.name, crop: t(plot.crop) })) };
    const localized = { ...farm };
    for (const key of ['name', 'location', 'crop']) if (farm[key] === demo[key]) localized[key] = t(farm[key]);
    if (farm.name === demo.name) localized.name = t('Sungai Dua land');
    if (['Penang, Malaysia · demo location', 'Bagan Datuk, Perak · demo location'].includes(farm.location)) localized.location = t(demo.location);
    localized.plots = farm.plots.map((plot) => {
      const original = demo.plots.find((item) => item.id === plot.id);
      if (!original) return plot;
      return { ...plot, name: plot.name === original.name ? t(plot.name) : plot.name, crop: plot.crop === original.crop ? t(plot.crop) : plot.crop };
    });
    return localized;
  });
  const tasks = state.tasks.map((task) => {
    const original = INITIAL_STATE.tasks.find((item) => item.id === task.id && item.farmId === task.farmId);
    return original && task.title === original.title ? { ...task, title: t(task.title) } : task;
  });
  const profile = state.profile.name === 'Farmer'
    ? { ...state.profile, name: INITIAL_STATE.profile.name } : state.profile;
  const notifications = state.notifications.map((notification) => {
    const original = INITIAL_STATE.tasks.find((task) => notification.id.startsWith(`reminder-${task.id}-`) && notification.title === task.title);
    return original ? { ...notification, title: t(notification.title) } : notification;
  });
  return { ...state, farms, tasks, profile, notifications };
}

/** @returns {string} */
export function profilePhoto() {
  return '<img class="profile-photo" src="/assets/profile-ahmad.jpg" alt="" width="256" height="256">';
}

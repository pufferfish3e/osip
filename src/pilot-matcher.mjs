import { pilotBookingDateRange } from './booking-dates.mjs';
import { PILOTS } from './data.mjs';
import { t } from './i18n.mjs';
import { calendarDate, nextCalendarView, renderCalendar } from './schedule.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const MATCH_WEIGHTS = { service: 40, area: 30, date: 15, budget: 15 };
const MATCH_DELAY_MS = 1400;
const DEMO_SCORE_MIN = 72;
const DEMO_SCORE_RANGE = 24;
const MATCH_REQUESTS = new WeakMap();
let previousPilotId = '';

/** @param {Preferences} preferences @param {string} previous @param {()=>number} random @returns {ReturnType<typeof matchPilots>[number]|undefined} */
export function demoPilotMatch(preferences, previous = '', random = Math.random) {
  const candidates = matchPilots(preferences);
  const alternatives = candidates.filter((match) => match.pilot.id !== previous);
  const pool = alternatives.length ? alternatives : candidates;
  const selected = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
  return selected ? { ...selected, score:DEMO_SCORE_MIN + Math.floor(random() * DEMO_SCORE_RANGE), isDemoScore:true } : undefined;
}

/** @param {string[]} selected @param {string} value @param {string} [exclusive] @returns {string[]} */
export function togglePilotPreference(selected, value, exclusive = '') {
  if (selected.includes(value)) return selected.filter((item) => item !== value);
  if (value === exclusive) return [value];
  return [...selected.filter((item) => item !== exclusive), value];
}

/** @param {HTMLDialogElement} dialog @param {ReturnType<typeof demoPilotMatch>} match @param {()=>Promise<void>} wait @returns {Promise<void>} */
export async function revealPilotMatch(dialog, match, wait = () => new Promise((resolve) => setTimeout(resolve, MATCH_DELAY_MS))) {
  let motion;
  const request = Symbol('pilot-match');
  MATCH_REQUESTS.set(dialog, request);
  try {
    dialog.innerHTML = `<button class="icon-button pilot-match-close" data-result-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button><div class="pilot-match-loading" role="status">${icon('loader-2', 32)}<h2>${esc(t('Finding your pilot…'))}</h2><p>${esc(t('Demo matching'))}</p></div>`;
    dialog.showModal();
    if (globalThis.gsap && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) motion = globalThis.gsap.to(dialog.querySelector('.pilot-match-loading > svg'), { rotation:360, duration:1, repeat:-1, ease:'none' });
    await wait();
    if (MATCH_REQUESTS.get(dialog) === request && dialog.isConnected && dialog.open) dialog.innerHTML = renderPilotMatch(match);
  } finally {
    motion?.kill();
  }
}
/** @typedef {{service:string|string[],area:string|string[],date:string|string[],budget:number|number[]}} Preferences */
/** @param {Preferences} preferences @returns {Array<{pilot:(typeof PILOTS)[number],score:number,dateMatches:boolean,budgetMatches:boolean}>} */
export function matchPilots(preferences) {
  const services = [].concat(preferences.service).filter(Boolean);
  const areas = [].concat(preferences.area).filter(Boolean);
  const dates = [].concat(preferences.date).filter(Boolean);
  const budgets = [].concat(preferences.budget);
  const budget = budgets.includes(0) ? 0 : Math.max(0, ...budgets);
  return PILOTS.filter((pilot) => services.length && areas.length && services.every((service) => pilot.services.includes(service)) && areas.some((area) => pilot.serviceArea.split(' & ').includes(area))).map((pilot) => {
    const dateMatches = !dates.length || dates.some((date) => pilot.available <= date);
    const budgetMatches = !budget || pilot.rate <= budget;
    const possible = MATCH_WEIGHTS.service + MATCH_WEIGHTS.area + (dates.length ? MATCH_WEIGHTS.date : 0) + (budget ? MATCH_WEIGHTS.budget : 0);
    const earned = MATCH_WEIGHTS.service + MATCH_WEIGHTS.area + (dates.length && dateMatches ? MATCH_WEIGHTS.date : 0) + (budget && budgetMatches ? MATCH_WEIGHTS.budget : 0);
    return { pilot, score: Math.round(earned / possible * 100), dateMatches, budgetMatches };
  }).sort((a, b) => b.score - a.score || a.pilot.rate - b.pilot.rate || a.pilot.id.localeCompare(b.pilot.id));
}
/** @param {string} name @param {string[]} values @returns {string} */
const choices = (name, values) => `<div class="chips pilot-preference-options">${values.map((value) => `<button type="button" class="chip" data-preference="${name}" data-value="${value}" aria-pressed="false">${esc(t(value))}</button>`).join('')}</div>`;
/** @param {string} key @returns {string} */
const otherPreference = (key) => `<label class="field" data-pilot-other-label="${key}" hidden><span>${esc(t('Other'))}</span><input class="input" name="other${key}" type="text" maxlength="80" data-pilot-other="${key}"></label>`;
/** @param {string[]} selected @param {string} other @returns {string[]} */
export function resolvePilotOther(selected, other) {
  return [...new Set(selected.map((value) => value === 'Other' ? other.trim().slice(0,80) : value).filter(Boolean))];
}
/** @returns {string} */
export function renderPilotMatcher() {
  return `<dialog class="task-sheet pilot-preference-sheet" data-pilot-wizard aria-labelledby="pilot-wizard-title"><form novalidate><div class="task-sheet-heading"><span data-match-progress></span><button type="button" class="icon-button" data-match-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button></div><h2 id="pilot-wizard-title" data-match-heading></h2><div data-match-step="0">${choices('service', ['Mapping', 'Crop survey', 'Spraying', 'Other'])}${otherPreference('service')}</div><div data-match-step="1" hidden>${choices('area', ['Perak', 'Kedah', 'Other'])}${otherPreference('area')}</div><div data-match-step="2" hidden><input type="hidden" name="date" value=""><p>${esc(t('Preferred date'))}</p><div data-pilot-date-picker>${renderCalendar('', calendarDate(new Date()).slice(0, 7), true, [], false, pilotBookingDateRange().minimumDate, pilotBookingDateRange().maximumDate)}</div><button type="button" class="button button-secondary" data-pilot-flexible aria-pressed="true">${esc(t('Leave blank for flexible dates.'))}</button></div><div data-match-step="3" hidden>${choices('budget', ['60', '75', '100', 'Any budget'])}</div><p role="alert" data-match-error></p><div class="task-sheet-actions"><button type="button" class="button button-secondary" data-match-back>${esc(t('Back'))}</button><button type="submit" class="button" data-match-next>${esc(t('Continue'))}</button></div><button type="button" class="pilot-catalog-shortcut" data-match-close>${esc(t('Browse all pilots'))}</button></form></dialog><dialog class="pilot-match-dialog" data-pilot-match aria-label="${esc(t('Your pilot match'))}"></dialog>`;
}
/** @param {(typeof PILOTS)[number]} pilot @returns {string} */
export function renderPilotReviews(pilot) {
  if (!pilot.reviewCount) return `<span class="muted">${esc(t('No reviews yet.'))}</span>`;
  const stars = Array.from({length:5}, (_,position) => `<span class="expert-star" style="--star-fill:${Math.round(Math.min(1,Math.max(0,pilot.rating-position))*100)}%">${icon('star',16)}</span>`).join('');
  return `<p class="expert-rating" aria-label="${esc(t('Reviews'))}: ${pilot.rating} / 5"><span class="expert-stars" aria-hidden="true">${stars}</span><strong>${pilot.rating} <span>(${pilot.reviewCount})</span></strong></p>`;
}
/** @param {(typeof PILOTS)[number]} pilot @returns {string} */
export function renderPilotPills(pilot) {
  return `<div class="expert-glass-pills">${[pilot.serviceArea,...pilot.services].map((label)=>`<span>${esc(t(label))}</span>`).join('')}</div>`;
}
/** @param {(typeof PILOTS)[number]} pilot @returns {string} */
export function pilotDescription(pilot) {
  return t('Provides {services} in {area}, using a {equipment}.', {services:pilot.services.map((service)=>t(service)).join(' · '),area:t(pilot.serviceArea),equipment:t(pilot.equipment)});
}
/** @param {ReturnType<typeof matchPilots>[number]|undefined} match @returns {string} */
export function renderPilotMatch(match) {
  const close = `<button class="icon-button pilot-match-close" data-result-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button>`;
  if (!match) return `${close}<div class="pilot-match-body"><h2>${esc(t('No pilot fits this service and area yet.'))}</h2><button class="button" data-match-retry>${esc(t('Change preferences'))}</button><button class="pilot-catalog-shortcut" data-result-close>${esc(t('Browse all pilots'))}</button></div>`;
  const { pilot, score } = match;
  return `<article class="pilot-portrait-card expert-result-card"><img class="pilot-match-cover" src="${esc(pilot.portrait)}" alt="">
    <div class="expert-result-heading"><span>${score}% ${esc(t(match.isDemoScore ? 'Demo match' : 'Preference match'))}</span><button class="icon-button" data-result-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button></div>
    <div class="pilot-match-body"><h2>${esc(pilot.name)}</h2>${renderPilotPills(pilot)}
    <p class="expert-bio">${esc(pilotDescription(pilot))}</p>${renderPilotReviews(pilot)}
    <div class="pilot-match-footer"><a class="button" href="/services/pilots/${esc(pilot.id)}">${esc(t('View pilot'))}${icon('arrow-up-right',18)}</a></div>
    <button class="pilot-catalog-shortcut" data-match-retry>${esc(t('Change preferences'))}</button></div></article>`;
};
/** @param {HTMLElement} wizard @param {HTMLInputElement} input @param {string} today @returns {void} */
export function initializePilotDatePicker(wizard, input, today = calendarDate(new Date())) {
  const picker = wizard.querySelector('[data-pilot-date-picker]');
  const flexible = wizard.querySelector('[data-pilot-flexible]');
  const { minimumDate, maximumDate } = pilotBookingDateRange(new Date(`${today}T12:00:00`));
  let selectedDates = input.value.split(',').filter(Boolean);
  let month = (selectedDates[0] || today).slice(0, 7);
  let isExpanded = true;
  const draw = () => {
    picker.innerHTML = renderCalendar(selectedDates[0] || '', month, isExpanded, [], true, minimumDate, maximumDate);
    picker.querySelectorAll('[data-calendar-date]').forEach((button) => { button.disabled = (button.dataset.calendarDate < minimumDate || button.dataset.calendarDate > maximumDate); button.setAttribute('aria-pressed', String(selectedDates.includes(button.dataset.calendarDate))); });
    flexible.setAttribute('aria-pressed', String(!input.value));
  };
  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.calendarDate && (button.dataset.calendarDate < minimumDate || button.dataset.calendarDate > maximumDate)) return;
    const next = nextCalendarView({ selected:selectedDates[0] || '', month, isExpanded }, { ...button.dataset, shouldToggle:button.hasAttribute('data-calendar-expand') }, today);
    if (button.dataset.calendarDate) selectedDates = togglePilotPreference(selectedDates, button.dataset.calendarDate);
    input.value = selectedDates.join(','); month = next.month; isExpanded = next.isExpanded;
    draw();
    const selector = button.hasAttribute('data-calendar-expand') ? '[data-calendar-expand]' : button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    picker.querySelector(selector)?.focus({ preventScroll:true });
  });
  flexible.addEventListener('click', () => { selectedDates = []; input.value = ''; draw(); });
  draw();
}

/** @param {HTMLElement} root @returns {void} */
export function initializePilotMatcher(root) {
  const wizard = root.querySelector('[data-pilot-wizard]');
  if (!(wizard instanceof HTMLDialogElement)) return;
  const result = root.querySelector('[data-pilot-match]');
  const form = wizard.querySelector('form');
  const headings = ['What do you need help with?', 'Where is your land?', 'When do you need a pilot?', 'Budget per hectare (RM)'];
  const preferences = { service: [], area: [], date: [], budget: [] };
  let step = 0;
  const update = () => {
    wizard.querySelectorAll('[data-match-step]').forEach((element) => { element.hidden = Number(element.dataset.matchStep) !== step; });
    wizard.querySelector('[data-match-heading]').textContent = t(headings[step]);
    wizard.querySelector('[data-match-progress]').textContent = `${step + 1} / 4`;
    wizard.querySelector('[data-match-back]').hidden = step === 0;
    wizard.querySelector('[data-match-next]').textContent = t(step === 3 ? 'Find my pilot' : 'Continue');
    wizard.querySelector('[data-match-error]').textContent = '';
    const heading = wizard.querySelector('[data-match-heading]');
    heading.tabIndex = -1;
    if (wizard.open) heading.focus({ preventScroll: true });
  };
  root.querySelector('[data-match-open]').addEventListener('click', () => { update(); wizard.showModal(); });
  wizard.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-match-close')) { wizard.close(); root.querySelector('[data-search="pilots"]')?.focus({ preventScroll: true }); }
    if (button.hasAttribute('data-match-back')) { step = Math.max(0, step - 1); update(); }
    if (button.dataset.preference) {
      const key = button.dataset.preference;
      const value = button.dataset.value;
      preferences[key] = togglePilotPreference(preferences[key], value, key === 'budget' ? 'Any budget' : '');
      const otherLabel = wizard.querySelector(`[data-pilot-other-label="${key}"]`);
      if (otherLabel) otherLabel.hidden = !preferences[key].includes('Other');
      wizard.querySelectorAll(`[data-preference="${key}"]`).forEach((choice) => choice.setAttribute('aria-pressed', String(preferences[key].includes(choice.dataset.value))));
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!wizard.open) return;
    if ((step === 0 && !preferences.service.length) || (step === 1 && !preferences.area.length) || (step === 3 && !preferences.budget.length)) { wizard.querySelector('[data-match-error]').textContent = t('Choose an option to continue.'); return; }
    const otherKey = step === 0 ? 'service' : step === 1 ? 'area' : '';
    if (otherKey && preferences[otherKey].includes('Other') && !form.elements[`other${otherKey}`].value.trim()) {
      wizard.querySelector('[data-match-error]').textContent = t('Please enter a short description.');
      form.elements[`other${otherKey}`].focus();
      return;
    }
    if (step < 3) { step += 1; update(); return; }
    preferences.date = form.elements.date.value.split(',').filter(Boolean);
    const match = demoPilotMatch({...preferences, service:resolvePilotOther(preferences.service, form.elements.otherservice.value), area:resolvePilotOther(preferences.area, form.elements.otherarea.value), budget: preferences.budget.map((value) => Number(value) || 0)}, previousPilotId);
    previousPilotId = match?.pilot.id ?? previousPilotId;
    wizard.close();
    try { await revealPilotMatch(result, match); }
    catch (error) { console.error('Pilot demo matching failed.', error); result.close(); wizard.showModal(); wizard.querySelector('[data-match-error]').textContent = t('Choose an option to continue.'); }
  });
  result.addEventListener('click', (event) => {
    if (event.target.closest('[data-result-close]')) result.close();
    if (event.target.closest('[data-match-retry]')) { result.close(); step = 0; update(); wizard.showModal(); }
  });
  initializePilotDatePicker(wizard, form.elements.date);
  update(); wizard.showModal();
}

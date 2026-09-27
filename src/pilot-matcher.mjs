import { PILOTS } from './data.mjs';
import { t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const MATCH_WEIGHTS = { service: 40, area: 30, date: 15, budget: 15 };
/** @typedef {{service:string,area:string,date:string,budget:number}} Preferences */
/** @param {Preferences} preferences @returns {Array<{pilot:(typeof PILOTS)[number],score:number,dateMatches:boolean,budgetMatches:boolean}>} */
export function matchPilots(preferences) {
  return PILOTS.filter((pilot) => pilot.services.includes(preferences.service) && pilot.serviceArea.split(' & ').includes(preferences.area)).map((pilot) => {
    const dateMatches = !preferences.date || pilot.available <= preferences.date;
    const budgetMatches = !preferences.budget || pilot.rate <= preferences.budget;
    const possible = MATCH_WEIGHTS.service + MATCH_WEIGHTS.area + (preferences.date ? MATCH_WEIGHTS.date : 0) + (preferences.budget ? MATCH_WEIGHTS.budget : 0);
    const earned = MATCH_WEIGHTS.service + MATCH_WEIGHTS.area + (preferences.date && dateMatches ? MATCH_WEIGHTS.date : 0) + (preferences.budget && budgetMatches ? MATCH_WEIGHTS.budget : 0);
    return { pilot, score: Math.round(earned / possible * 100), dateMatches, budgetMatches };
  }).sort((a, b) => b.score - a.score || a.pilot.rate - b.pilot.rate || a.pilot.id.localeCompare(b.pilot.id));
}
/** @param {string} name @param {string[]} values @returns {string} */
const choices = (name, values) => `<div class="pilot-preference-options">${values.map((value) => `<button type="button" class="button button-secondary" data-preference="${name}" data-value="${value}" aria-pressed="false">${esc(t(value))}</button>`).join('')}</div>`;
/** @returns {string} */
export function renderPilotMatcher() {
  return `<dialog class="task-sheet pilot-preference-sheet" data-pilot-wizard aria-labelledby="pilot-wizard-title"><form novalidate><div class="task-sheet-heading"><span data-match-progress></span><button type="button" class="icon-button" data-match-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button></div><h2 id="pilot-wizard-title" data-match-heading></h2><div data-match-step="0">${choices('service', ['Mapping', 'Crop survey', 'Spraying'])}</div><div data-match-step="1" hidden>${choices('area', ['Perak', 'Kedah', 'Other'])}</div><div data-match-step="2" hidden><label class="field">${esc(t('Preferred date'))}<input class="input" type="date" name="date"></label><p class="muted">${esc(t('Leave blank for flexible dates.'))}</p></div><div data-match-step="3" hidden>${choices('budget', ['60', '75', '100', 'Any budget'])}</div><p role="alert" data-match-error></p><div class="task-sheet-actions"><button type="button" class="button button-secondary" data-match-back>${esc(t('Back'))}</button><button type="submit" class="button" data-match-next>${esc(t('Continue'))}</button></div><button type="button" class="pilot-catalog-shortcut" data-match-close>${esc(t('Browse all pilots'))}</button></form></dialog><dialog class="pilot-match-dialog" data-pilot-match aria-label="${esc(t('Your pilot match'))}"></dialog>`;
}
/** @param {(typeof PILOTS)[number]} pilot @returns {string} */
export function renderPilotReviews(pilot) {
  return `<details class="pilot-review-preview"><summary aria-label="${esc(t('Reviews'))}"><span aria-hidden="true">★</span> ${pilot.rating} <span>(${pilot.reviewCount})</span></summary><div><strong>${esc(t('Sample reviews'))}</strong>${pilot.reviews.map((review) => `<blockquote><span aria-hidden="true">★★★★★</span><p>${esc(t(review))}</p></blockquote>`).join('')}</div></details>`;
}
/** @param {ReturnType<typeof matchPilots>[number]|undefined} match @returns {string} */
export function renderPilotMatch(match) {
  const close = `<button class="icon-button pilot-match-close" data-result-close aria-label="${esc(t('Cancel'))}">${icon('x')}</button>`;
  if (!match) return `${close}<div class="pilot-match-body"><h2>${esc(t('No pilot fits this service and area yet.'))}</h2><button class="button" data-match-retry>${esc(t('Change preferences'))}</button><button class="pilot-catalog-shortcut" data-result-close>${esc(t('Browse all pilots'))}</button></div>`;
  const { pilot, score, dateMatches, budgetMatches } = match;
  return `${close}<article class="pilot-portrait-card"><img class="pilot-match-cover" src="${esc(pilot.portrait)}" alt=""><div class="pilot-match-body">
    <h2>${esc(pilot.name)}</h2><p class="pilot-match-specialty">${esc(t(pilot.serviceArea))}</p>
    <div class="pilot-match-footer"><div class="pilot-match-stats">${renderPilotReviews(pilot)}<span class="pilot-match-percent">${score}% ${esc(t('Match'))}</span></div><a class="button" href="/services/pilots/${esc(pilot.id)}">${esc(t('View pilot'))}${icon('arrow-up-right', 18)}</a></div>
    <details class="pilot-match-details"><summary>${esc(t('Match details'))}</summary><p>RM ${pilot.rate} / ${esc(t(pilot.rateUnit))}</p><p>${esc(t('Service and area match. Date and budget refine the score.'))}</p>${!dateMatches ? `<p>${esc(t('Available after your preferred date.'))}</p>` : ''}${!budgetMatches ? `<p>${esc(t('Starting rate exceeds your budget.'))}</p>` : ''}<p>${esc(t('A preference score, not confirmed availability.'))}</p><p>${esc(t('Sample pilot · AI-generated portrait'))}</p></details>
    <button class="pilot-catalog-shortcut" data-match-retry>${esc(t('Change preferences'))}</button></div></article>`;
};
/** @param {HTMLElement} root @returns {void} */
export function initializePilotMatcher(root) {
  const wizard = root.querySelector('[data-pilot-wizard]');
  if (!(wizard instanceof HTMLDialogElement)) return;
  const result = root.querySelector('[data-pilot-match]');
  const form = wizard.querySelector('form');
  const headings = ['What do you need help with?', 'Where is your land?', 'When do you need a pilot?', 'Budget per hectare (RM)'];
  const preferences = { service: '', area: '', date: '', budget: 0 };
  let step = 0;
  let hasBudget = false;
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
      preferences[key] = key === 'budget' ? Number(button.dataset.value) || 0 : button.dataset.value;
      if (key === 'budget') hasBudget = true;
      wizard.querySelectorAll(`[data-preference="${key}"]`).forEach((choice) => choice.setAttribute('aria-pressed', String(choice === button)));
    }
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!wizard.open) return;
    if ((step === 0 && !preferences.service) || (step === 1 && !preferences.area) || (step === 3 && !hasBudget)) { wizard.querySelector('[data-match-error]').textContent = t('Choose an option to continue.'); return; }
    if (step === 2 && !form.elements.date.reportValidity()) return;
    if (step < 3) { step += 1; update(); return; }
    preferences.date = form.elements.date.value;
    wizard.close(); result.innerHTML = renderPilotMatch(matchPilots(preferences)[0]); result.showModal();
  });
  result.addEventListener('click', (event) => {
    if (event.target.closest('[data-result-close]')) result.close();
    if (event.target.closest('[data-match-retry]')) { result.close(); step = 0; update(); wizard.showModal(); }
  });
  const today = new Date();
  form.elements.date.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  update(); wizard.showModal();
}

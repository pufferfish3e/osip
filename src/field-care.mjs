import { applyAction } from './actions.mjs';
import { getFormatLocale, t } from './i18n.mjs';
import { fieldTaskUrgency } from './land-map.mjs';
import { calendarDate, taskRepeatLabel } from './schedule.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const CARE_TYPES = ['Fertilizer', 'Pesticide'];
const SHEET_OPEN_SECONDS = 0.28;
const SHEET_CLOSE_SECONDS = 0.18;
/** @param {HTMLDialogElement} sheet @param {typeof window.gsap} gsap @param {()=>boolean} reducedMotion @returns {{open:()=>void,close:(afterClose?:()=>void)=>void,isClosing:()=>boolean}} */
export function createFieldCareMotion(sheet, gsap, reducedMotion) {
  let isClosing = false;
  const reset = () => {
    gsap?.killTweensOf(sheet);
    for (const property of ['transform', 'opacity', '--care-backdrop-opacity']) sheet.style.removeProperty(property);
    isClosing = false;
  };
  sheet.addEventListener('close', () => { if (!sheet.open) reset(); });
  return {
    isClosing: () => isClosing,
    open: () => {
      if (sheet.open) return;
      reset();
      sheet.showModal();
      if (!gsap || reducedMotion()) return;
      gsap.fromTo(sheet, {y: 32, opacity: 0, '--care-backdrop-opacity': 0}, {y: 0, opacity: 1, '--care-backdrop-opacity': 1, duration: SHEET_OPEN_SECONDS, ease: 'power3.out', overwrite: true});
    },
    close: (afterClose = () => {}) => {
      if (!sheet.open || isClosing) return;
      isClosing = true;
      const finish = () => { sheet.close(); reset(); afterClose(); };
      if (!gsap || reducedMotion()) { finish(); return; }
      gsap.to(sheet, {y: 24, opacity: 0, '--care-backdrop-opacity': 0, duration: SHEET_CLOSE_SECONDS, ease: 'power2.in', overwrite: true, onComplete: finish});
    },
  };
}
/** @param {import('./store.mjs').Task[]} tasks @param {string} farmId @param {string} plotId @param {string} category @param {string} [today] @returns {{last:string,next:import('./store.mjs').Task|undefined,isOverdue:boolean}} */
export function fieldCareState(tasks, farmId, plotId, category, today = calendarDate(new Date())) {
  const relevant = tasks.filter((task) => task.farmId === farmId && (task.plotId === plotId || !task.plotId) && task.category === category);
  const last = relevant.filter((task) => task.done && task.completedAt).map((task) => task.completedAt).sort().at(-1) ?? '';
  const next = relevant.filter((task) => !task.done).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`))[0];
  return { last, next, isOverdue: Boolean(next && next.dueDate < today) };
}
/** @param {import('./store.mjs').Task[]} tasks @param {string} farmId @param {string} plotId @returns {string} */
export function fieldCareLabel(tasks, farmId, plotId) {
  return CARE_TYPES.map((category) => {
    const care = fieldCareState(tasks, farmId, plotId, category);
    const state = care.next ? care.isOverdue ? 'Overdue' : 'Scheduled' : care.last ? 'Recorded' : 'No record';
    if (!care.next && !care.last) return '';
    const symbol = care.next ? care.isOverdue ? '!' : '◷' : '✓';
    return `<span class="field-care-tag ${care.isOverdue ? 'is-overdue' : ''}" title="${esc(t(category))} · ${esc(t(state))}" aria-label="${esc(t(category))} · ${esc(t(state))}"><span aria-hidden="true">${esc(t(category))} ${symbol}</span></span>`;
  }).join('');
}
/** @returns {string} */
export function renderFieldCareSheet() {
  return `<dialog class="field-care-sheet" data-field-care-sheet aria-labelledby="field-care-heading"><header><h2 id="field-care-heading"></h2><button type="button" class="icon-button" data-care-close aria-label="${esc(t('Close'))}">${icon('x', 20)}</button></header><div data-care-content></div><p data-care-error role="alert"></p></dialog>`;
}
/** @returns {string} */
export function renderFieldScheduleChoice() {
  return `<section class="field-care-section"><h3>${esc(t('Set up a schedule for this field?'))}</h3><p>${esc(t('Choose pesticide or fertiliser reminders. You can also leave this field without a schedule.'))}</p><div class="field-care-actions"><button type="button" class="button" data-care-schedule>${esc(t('Set up a schedule'))}</button><button type="button" class="button button-secondary" data-care-close>${esc(t('Not now'))}</button></div></section>`;
}
/** @param {import('./store.mjs').Task[]} tasks @param {string} farmId @param {string} plotId @param {Date} [now] @returns {string} */
export function renderFieldSchedules(tasks, farmId, plotId, now = new Date()) {
  const assigned = tasks.filter((task) => task.farmId === farmId && task.plotId === plotId);
  const pending = assigned.filter((task) => !task.done).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`));
  const last = assigned.filter((task) => task.done).sort((first, second) => (second.completedAt ?? `${second.dueDate}T${second.time}`).localeCompare(first.completedAt ?? `${first.dueDate}T${first.time}`))[0];
  const completed = last ? `<section class="field-care-section field-care-completed"><h3>${icon('circle-check', 18)} ${esc(t('Latest completion'))}</h3><p>${esc(last.title)} · ${esc(t('Completed'))}</p></section>` : '';
  if (!pending.length) return completed || renderFieldScheduleChoice();
  return pending.map((task) => renderFieldTaskOccurrence(task, farmId, plotId, now)).join('') + completed;
}
/** @param {import('./store.mjs').Task} task @param {string} farmId @param {string} plotId @param {Date} now @returns {string} */
const renderFieldTaskOccurrence = (task, farmId, plotId, now) => {
  const state = fieldTaskUrgency([task], farmId, plotId, now);
  const status = t({ upcoming: 'Scheduled later', soon: 'Due within 2 hours', overdue: 'Overdue' }[state.urgency]);
  const canComplete = new Date(`${task.dueDate}T${task.time}`) <= now;
  const action = canComplete ? `<button type="button" class="button" data-care-complete="${esc(task.id)}">${esc(t('Complete'))}</button>` : `<a class="button button-secondary" href="/farm/${esc(farmId)}/tasks/${esc(task.id)}">${esc(t('View task'))}</a>`;
  return `<section class="field-care-section" data-care-task="${esc(task.id)}"><h3>${esc(task.title)}</h3><p class="field-care-occurrence">${esc(task.repeatFromId ? t('Next occurrence') : status)}${task.repeatFromId ? ` · ${esc(status)}` : ''}</p><p>${esc(t(task.category))} · ${esc(task.dueDate)} · ${esc(task.time)}</p>${task.repeat && task.repeat !== 'none' ? `<p>${esc(taskRepeatLabel(task))}</p>` : ''}<div class="field-care-actions">${action}<button type="button" class="button button-secondary" data-care-skip="${esc(task.id)}">${esc(t('Not now'))}</button></div></section>`;
};
/** @param {import('./store.mjs').AppState} state @param {string} farmId @param {string} plotId @param {string} taskId @returns {void} */
export function completeFieldSchedule(state, farmId, plotId, taskId) {
  const task = state.tasks.find((item) => item.id === taskId && item.farmId === farmId && item.plotId === plotId);
  if (!task) throw new Error('Field schedule not found');
  if (!task.done) applyAction(state, 'toggle-task', taskId);
}
/** @param {import('./store.mjs').AppState} state @param {string} farmId @param {string} plotId @param {string} category @returns {void} */
export function recordFieldCare(state, farmId, plotId, category) {
  const farm = state.farms.find((item) => item.id === farmId);
  if (!CARE_TYPES.includes(category) || !farm?.plots.some((item) => item.id === plotId)) throw new Error('Field not found');
  const next = state.tasks.filter((task) => task.farmId === farmId && task.plotId === plotId && task.category === category && !task.done).sort((first, second) => first.dueDate.localeCompare(second.dueDate))[0];
  if (next && next.dueDate <= calendarDate(new Date())) { applyAction(state, 'toggle-task', next.id); return; }
  if (state.tasks.some((task) => task.farmId === farmId && task.plotId === plotId && task.category === category && task.done && task.completedAt && calendarDate(new Date(task.completedAt)) === calendarDate(new Date()))) return;
  state.tasks.push({ id: `task-${crypto.randomUUID()}`, farmId, plotId, category, title: category, dueDate: calendarDate(new Date()), time: '08:00', done: true, completedAt: new Date().toISOString(), reminder: false, repeat: 'none' });
}
/** @param {import('./store.mjs').Task[]} tasks @param {string} farmId @param {string} plotId @returns {string} */
const renderCareChoices = (tasks, farmId, plotId) => CARE_TYPES.map((category) => {
  const care = fieldCareState(tasks, farmId, plotId, category);
  const last = care.last ? new Date(care.last).toLocaleDateString(getFormatLocale()) : t('No record');
  const next = care.next ? `${t(care.isOverdue ? 'Overdue' : 'Scheduled')} · ${care.next.dueDate}` : t('Reminders off');
  return `<section class="field-care-section"><h3>${esc(t(category))}</h3><p>${esc(t('Last recorded'))} · ${esc(last)}</p><p>${esc(next)}</p><div class="field-care-actions"><button type="button" class="button" data-care-record="${category}">${esc(t('Done today'))}</button>${care.next ? `<a class="button button-secondary" href="/farm/${esc(farmId)}/tasks/${esc(care.next.id)}">${esc(t('Manage reminder'))}</a>` : `<button type="button" class="button button-secondary" data-care-remind="${category}">${esc(t('Set reminder'))}</button>`}</div></section>`;
}).join('');
/** @param {HTMLElement} root @param {HTMLDialogElement} sheet @param {string} plotId @param {string} category @param {()=>void} reopen @returns {void} */
const openCareReminder = (root, sheet, plotId, category, reopen) => {
  try {
    root.querySelector('[data-plan-task]').click();
    const form = root.querySelector('[data-form="task"]');
    for (const input of form.querySelectorAll('[name="plotIds"]')) input.checked = input.value === plotId;
    form.elements.category.value = category;
    form.elements.title.value = t(category); form.elements.reminder.checked = true;
  } catch (error) {
    console.error('Could not open field reminder.', error);
    reopen();
    sheet.querySelector('[data-care-error]').textContent = t('Could not save land.');
  }
};
/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {void} */
export function initializeFieldCare(root, store) {
  const sheet = root.querySelector('[data-field-care-sheet]');
  if (!(sheet instanceof HTMLDialogElement)) return;
  const motion = createFieldCareMotion(sheet, window.gsap, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  sheet.addEventListener('cancel', (event) => { event.preventDefault(); motion.close(); });
  let farmId = '';
  let plotId = '';
  sheet.addEventListener('field-care-open', (event) => {
    if (sheet.open) return;
    farmId = event.detail.farmId; plotId = event.detail.plotId;
    const field = store.getState().farms.find((farm) => farm.id === farmId)?.plots.find((plot) => plot.id === plotId);
    if (!field) return;
    sheet.querySelector('h2').textContent = field.name;
    sheet.querySelector('[data-care-error]').textContent = '';
    sheet.querySelector('[data-care-content]').innerHTML = renderFieldSchedules(store.getState().tasks, farmId, plotId);
    motion.open();
  });
  sheet.addEventListener('click', (event) => {
    if (motion.isClosing()) return;
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button) return;
    if (button.hasAttribute('data-care-close')) { motion.close(); return; }
    if (button.hasAttribute('data-care-schedule')) {
      sheet.querySelector('[data-care-content]').innerHTML = renderCareChoices(store.getState().tasks, farmId, plotId);
      return;
    }
    try {
      if (button.dataset.careComplete || button.dataset.careSkip) {
        if (button.dataset.careComplete) {
          store.update((state) => completeFieldSchedule(state, farmId, plotId, button.dataset.careComplete));
          sheet.querySelector('[data-care-content]').innerHTML = renderFieldSchedules(store.getState().tasks, farmId, plotId);
        } else button.closest('[data-care-task]')?.remove();
        if (!sheet.querySelector('[data-care-task]')) motion.close(() => root.dispatchEvent(new CustomEvent('land-field-saved', { bubbles: true })));
        return;
      }
      if (button.dataset.careRecord) {
        store.update((state) => recordFieldCare(state, farmId, plotId, button.dataset.careRecord));
        motion.close(() => root.dispatchEvent(new CustomEvent('land-field-saved', { bubbles: true })));
      }
      if (button.dataset.careRemind) {
        motion.close(() => openCareReminder(root, sheet, plotId, button.dataset.careRemind, motion.open));
      }
    } catch (error) { sheet.querySelector('[data-care-error]').textContent = error instanceof Error ? error.message : t('Could not save land.'); }
  });
}

import { getFormatLocale, t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const DAYS_PER_WEEK = 7;
const SELECTED_DATES = new Map();
/** @param {Date} date @returns {string} */
export const calendarDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** @param {string} value @returns {Date} */
const parseDate = (value) => new Date(`${value}T12:00:00`);
/** @param {string} selected @param {string} month @param {boolean} isExpanded @returns {string[]} */
export const calendarDays = (selected, month, isExpanded) => {
  const start = parseDate(isExpanded ? `${month}-01` : selected);
  start.setDate(start.getDate() - (start.getDay() + 6) % DAYS_PER_WEEK);
  const count = isExpanded ? Math.ceil(((parseDate(`${month}-01`).getDay() + 6) % DAYS_PER_WEEK + new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()) / DAYS_PER_WEEK) * DAYS_PER_WEEK : DAYS_PER_WEEK;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start); day.setDate(day.getDate() + index); return calendarDate(day);
  });
};
/** @param {string} selected @param {string} month @param {boolean} isExpanded @param {string[]} marked @param {boolean} [canExpand] @returns {string} */
export const renderCalendar = (selected, month, isExpanded, marked = [], canExpand = true) => {
  const heading = parseDate(`${month}-01`).toLocaleDateString(getFormatLocale(), { month: 'long', year: 'numeric' });
  const weekdays = calendarDays('2026-09-21', '2026-09', false).map((date) => `<span>${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { weekday: 'short' }))}</span>`).join('');
  const monthHeading = canExpand ? `<button type="button" data-calendar-expand aria-expanded="${isExpanded}">${esc(heading)} ${icon('chevron-down', 16)}</button>` : `<span>${esc(heading)}</span>`;
  return `<div class="calendar-heading"><button type="button" data-calendar-move="-1" aria-label="${esc(t('Previous'))}">${icon('chevron-left', 20)}</button>${monthHeading}<button type="button" data-calendar-move="1" aria-label="${esc(t('Next'))}">${icon('chevron-right', 20)}</button></div><div class="calendar-weekdays" aria-hidden="true">${weekdays}</div><div class="calendar-days">${calendarDays(selected, month, isExpanded).map((date) => `<button type="button" data-calendar-date="${date}" aria-pressed="${date === selected}" aria-label="${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { dateStyle: 'full' }))}${marked.includes(date) ? `, ${esc(t('Tasks to do'))}` : ''}" class="${date.slice(0, 7) !== month ? 'calendar-outside' : ''}"><span>${parseDate(date).getDate()}</span>${marked.includes(date) ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div>`;
};

/** @param {HTMLElement} root @returns {void} */
export function initializeSchedule(root) {
  const panel = root.querySelector('[data-schedule]');
  if (!panel) return;
  const today = calendarDate(new Date());
  const rows = [...panel.querySelectorAll('[data-agenda] [data-task-date]')];
  const marked = rows.filter((row) => row.dataset.taskDone === 'false').map((row) => row.dataset.taskDate);
  const dialog = panel.querySelector('.task-sheet');
  const form = dialog.querySelector('form');
  const picker = dialog.querySelector('[data-task-picker]');
  const calendar = panel.querySelector('[data-schedule-calendar]');
  let selected = form.elements.dueDate.value || SELECTED_DATES.get(panel.dataset.schedule) || today;
  let month = selected.slice(0, 7);
  let isExpanded = false;
  let step = 0;
  const updateAgenda = () => {
    SELECTED_DATES.set(panel.dataset.schedule, selected);
    if (!calendar) return;
    calendar.innerHTML = renderCalendar(selected, month, isExpanded, marked);
    panel.querySelector('[data-agenda-title]').textContent = parseDate(selected).toLocaleDateString(getFormatLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    let count = 0;
    rows.forEach((row) => { row.hidden = row.dataset.taskDate !== selected; if (!row.hidden) count += 1; });
    panel.querySelector('[data-agenda-empty]').hidden = count !== 0;
  };
  const updateStep = () => {
    dialog.querySelectorAll('[data-task-step]').forEach((item, index) => { item.hidden = index !== step; });
    dialog.querySelector('[data-task-back]').hidden = step === 0;
    dialog.querySelector('[data-task-next]').hidden = step === 4;
    dialog.querySelector('[type="submit"]').hidden = step !== 4;
    dialog.querySelector('[data-task-progress]').textContent = `${step + 1} / 5`;
    const heading = dialog.querySelectorAll('[data-task-step]')[step].querySelector('h2');
    dialog.setAttribute('aria-label', heading.textContent);
    dialog.removeAttribute('aria-labelledby');
    heading.tabIndex = -1;
    if (dialog.open) heading.focus({ preventScroll: true });
    if (step === 4) renderTaskReview(form, dialog);
  };
  const drawPicker = () => { picker.innerHTML = renderCalendar(form.elements.dueDate.value, form.elements.dueDate.value.slice(0, 7), true, marked, false); };
  calendar?.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.calendarDate) { selected = button.dataset.calendarDate; month = selected.slice(0, 7); }
    if (button.hasAttribute('data-calendar-expand')) isExpanded = !isExpanded;
    if (button.dataset.calendarMove) {
      const date = parseDate(isExpanded ? `${month}-01` : selected);
      if (isExpanded) date.setMonth(date.getMonth() + Number(button.dataset.calendarMove));
      else date.setDate(date.getDate() + DAYS_PER_WEEK * Number(button.dataset.calendarMove));
      month = calendarDate(date).slice(0, 7); if (!isExpanded) selected = calendarDate(date);
    }
    updateAgenda();
  });
  bindTaskSheet(panel, dialog, form, picker, marked, () => { step = 0; form.reset(); form.dataset.creationKey = crypto.randomUUID(); delete form.dataset.submitted; if (!form.elements.id) form.elements.dueDate.value = selected; drawPicker(); updateStep(); }, () => {
    const input = step === 1 ? form.elements.title : step === 2 ? form.elements.time : null;
    if (input && !input.reportValidity()) return;
    step = Math.min(4, step + 1); updateStep();
  }, () => { step = Math.max(0, step - 1); updateStep(); });
  form.addEventListener('submit', () => { SELECTED_DATES.set(panel.dataset.schedule, form.elements.dueDate.value); });
  updateAgenda();
}

/** @param {HTMLFormElement} form @param {HTMLDialogElement} dialog @returns {void} */
const renderTaskReview = (form, dialog) => {
  const values = [form.elements.title.value, parseDate(form.elements.dueDate.value).toLocaleDateString(getFormatLocale(), { dateStyle: 'long' }), form.elements.time.value, t(form.elements.category.value), t({ none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[form.elements.repeat.value])];
  values.push(form.elements.plotId?.selectedOptions[0]?.textContent ?? t('Whole land'));
  dialog.querySelectorAll('[data-task-review]').forEach((item, index) => { item.textContent = values[index]; });
};
/** @param {HTMLElement} panel @param {HTMLDialogElement} dialog @param {HTMLFormElement} form @param {HTMLElement} picker @param {string[]} marked @param {()=>void} open @param {()=>void} next @param {()=>void} back @returns {void} */
const bindTaskSheet = (panel, dialog, form, picker, marked, open, next, back) => {
  let pickerMonth = '';
  panel.querySelector('[data-plan-task]').addEventListener('click', () => { open(); pickerMonth = form.elements.dueDate.value.slice(0, 7); dialog.showModal(); });
  dialog.querySelector('[data-task-close]').addEventListener('click', () => dialog.close());
  dialog.querySelector('[data-task-next]').addEventListener('click', next);
  dialog.querySelector('[data-task-back]').addEventListener('click', back);
  form.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !dialog.querySelector('[data-task-next]').hidden) { event.preventDefault(); next(); } });
  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.calendarDate) { form.elements.dueDate.value = button.dataset.calendarDate; pickerMonth = button.dataset.calendarDate.slice(0, 7); }
    if (button.dataset.calendarMove) { const date = parseDate(`${pickerMonth}-01`); date.setMonth(date.getMonth() + Number(button.dataset.calendarMove)); pickerMonth = calendarDate(date).slice(0, 7); }
    picker.innerHTML = renderCalendar(form.elements.dueDate.value, pickerMonth, true, marked, false);
  });
};

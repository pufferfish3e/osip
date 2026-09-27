import { getFormatLocale, t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const DAYS_PER_WEEK = 7;
/** @param {import('./store.mjs').Task} task @returns {string} */
export function taskRepeatLabel(task) {
  if (task.repeat === 'custom') return t('Every {count} {unit}', { count: task.repeatInterval, unit: t(task.repeatInterval === 1 ? { minutes: 'minute', hours: 'hour', days: 'day' }[task.repeatUnit] : task.repeatUnit) });
  return t({ none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[task.repeat ?? 'none']);
}

const SELECTED_DATES = new Map();
const CALENDAR_VIEWS = new Map();

/** @param {{selected:string,month:string,isExpanded:boolean}} view @param {{calendarDate?:string,calendarMove?:string,shouldToggle?:boolean}} action @param {string} fallback @returns {{selected:string,month:string,isExpanded:boolean}} */
export const nextCalendarView = (view, action, fallback = calendarDate(new Date())) => {
  const next = { ...view };
  if (action.calendarDate) { next.selected = action.calendarDate; next.month = next.selected.slice(0, 7); }
  if (action.shouldToggle) {
    next.isExpanded = !next.isExpanded;
    next.month = (next.selected || fallback).slice(0, 7);
  }
  if (action.calendarMove) {
    const date = parseDate(next.isExpanded ? `${next.month}-01` : next.selected || fallback);
    if (next.isExpanded) date.setMonth(date.getMonth() + Number(action.calendarMove));
    else date.setDate(date.getDate() + DAYS_PER_WEEK * Number(action.calendarMove));
    next.month = calendarDate(date).slice(0, 7);
    if (!next.isExpanded) next.selected = calendarDate(date);
  }
  return next;
};
/** @param {Date} date @returns {string} */
export const calendarDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
/** @param {string} value @returns {Date} */
const parseDate = (value) => new Date(`${value}T12:00:00`);
/** @param {string} selected @param {string} month @param {boolean} isExpanded @returns {string[]} */
export const calendarDays = (selected, month, isExpanded) => {
  const start = parseDate(isExpanded ? `${month}-01` : selected || calendarDate(new Date()));
  start.setDate(start.getDate() - (start.getDay() + 6) % DAYS_PER_WEEK);
  const count = isExpanded ? Math.ceil(((parseDate(`${month}-01`).getDay() + 6) % DAYS_PER_WEEK + new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate()) / DAYS_PER_WEEK) * DAYS_PER_WEEK : DAYS_PER_WEEK;
  return Array.from({ length: count }, (_, index) => {
    const day = new Date(start); day.setDate(day.getDate() + index); return calendarDate(day);
  });
};
/** @param {string} selected @param {string} month @param {boolean} isExpanded @param {string[]} marked @param {boolean} [canExpand] @param {string} [minimumDate] @returns {string} */
export const renderCalendar = (selected, month, isExpanded, marked = [], canExpand = true, minimumDate = '') => {
  const heading = parseDate(`${month}-01`).toLocaleDateString(getFormatLocale(), { month: 'long', year: 'numeric' });
  const weekdays = calendarDays('2026-09-21', '2026-09', false).map((date) => `<span>${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { weekday: 'short' }))}</span>`).join('');
  const monthHeading = canExpand ? `<button type="button" data-calendar-expand aria-expanded="${isExpanded}">${esc(heading)} ${icon('chevron-down', 16)}</button>` : `<span>${esc(heading)}</span>`;
  return `<div class="calendar-heading"><button type="button" data-calendar-move="-1" aria-label="${esc(t('Previous'))}">${icon('chevron-left', 20)}</button>${monthHeading}<button type="button" data-calendar-move="1" aria-label="${esc(t('Next'))}">${icon('chevron-right', 20)}</button></div><div class="calendar-weekdays" aria-hidden="true">${weekdays}</div><div class="calendar-days">${calendarDays(selected, month, isExpanded).map((date) => `<button type="button" data-calendar-date="${date}" ${minimumDate && date < minimumDate ? 'disabled' : ''} aria-pressed="${date === selected}" aria-label="${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { dateStyle: 'full' }))}${marked.includes(date) ? `, ${esc(t('Tasks to do'))}` : ''}" class="${date.slice(0, 7) !== month ? 'calendar-outside' : ''}"><span>${parseDate(date).getDate()}</span>${marked.includes(date) ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div>`;
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
  const previousView = CALENDAR_VIEWS.get(panel.dataset.schedule);
  let month = previousView?.month ?? selected.slice(0, 7);
  let isExpanded = previousView?.isExpanded ?? false;
  let step = 0;
  const updateAgenda = () => {
    SELECTED_DATES.set(panel.dataset.schedule, selected);
    CALENDAR_VIEWS.set(panel.dataset.schedule, { selected, month, isExpanded });
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
    ({ selected, month, isExpanded } = nextCalendarView({ selected, month, isExpanded }, { ...button.dataset, shouldToggle:button.hasAttribute('data-calendar-expand') }));
    updateAgenda();
    const selector = button.hasAttribute('data-calendar-expand') ? '[data-calendar-expand]' : button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    calendar.querySelector(selector)?.focus({ preventScroll:true });
  });
  bindTaskSheet(panel, dialog, form, picker, marked, () => { step = 0; form.reset(); form.dataset.creationKey = crypto.randomUUID(); delete form.dataset.submitted; if (!form.elements.id) form.elements.dueDate.value = selected; drawPicker(); updateStep(); }, () => {
    const input = step === 1 ? form.elements.title : step === 2 ? form.elements.time : null;
    if (input && !input.reportValidity()) return;
    if (step === 3 && form.elements.repeat.value === 'custom' && !form.elements.repeatInterval.reportValidity()) return;
    step = Math.min(4, step + 1); updateStep();
  }, () => { step = Math.max(0, step - 1); updateStep(); });
  form.addEventListener('submit', () => { SELECTED_DATES.set(panel.dataset.schedule, form.elements.dueDate.value); });
  updateAgenda();
}

/** @param {HTMLFormElement} form @param {HTMLDialogElement} dialog @returns {void} */
const renderTaskReview = (form, dialog) => {
  const values = [form.elements.title.value, parseDate(form.elements.dueDate.value).toLocaleDateString(getFormatLocale(), { dateStyle: 'long' }), form.elements.time.value, t(form.elements.category.value), taskRepeatLabel({ repeat: form.elements.repeat.value, repeatInterval: Number(form.elements.repeatInterval.value), repeatUnit: form.elements.repeatUnit.value })];
  values.push([...form.querySelectorAll('[name="plotIds"]:checked')].map((input) => input.nextElementSibling.textContent).join(', ') || t('Whole land'));
  dialog.querySelectorAll('[data-task-review]').forEach((item, index) => { item.textContent = values[index]; });
};
/** @param {HTMLElement} panel @param {HTMLDialogElement} dialog @param {HTMLFormElement} form @param {HTMLElement} picker @param {string[]} marked @param {()=>void} open @param {()=>void} next @param {()=>void} back @returns {void} */
const bindTaskSheet = (panel, dialog, form, picker, marked, open, next, back) => {
  const updateRepeat = () => {
    const isCustom = form.elements.repeat.value === 'custom';
    form.querySelector('[data-repeat-custom]').hidden = !isCustom;
    form.elements.repeatInterval.disabled = !isCustom;
    form.elements.repeatUnit.disabled = !isCustom;
  };
  updateRepeat();
  form.addEventListener('reset', () => { queueMicrotask(updateRepeat); });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'repeat') updateRepeat();
    if (event.target.name !== 'plotIds') return;
    const inputs = [...form.querySelectorAll('[name="plotIds"]')];
    if (event.target.checked) inputs.filter((input) => event.target.value ? !input.value : input !== event.target).forEach((input) => { input.checked = false; });
    if (!inputs.some((input) => input.checked)) inputs.find((input) => !input.value).checked = true;
  });
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

/** @param {HTMLElement} root @returns {void} */
export function initializeBookingCalendar(root) {
  const panel = root.querySelector('[data-booking-date]');
  if (!panel) return;
  const input = panel.querySelector('input[name="date"]');
  const calendar = panel.querySelector('[data-booking-calendar]');
  const minimumDate = calendarDate(new Date());
  let view = {selected:input.value || minimumDate,month:(input.value || minimumDate).slice(0,7),isExpanded:true};
  const draw = () => { calendar.innerHTML = renderCalendar(view.selected,view.month,true,[],false,minimumDate); input.value=view.selected; };
  calendar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    view = nextCalendarView(view,button.dataset);
    draw();
    const selector = button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    calendar.querySelector(selector)?.focus({preventScroll:true});
  });
  draw();
}

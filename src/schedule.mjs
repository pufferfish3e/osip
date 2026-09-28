import { pilotBookingDateRange } from './booking-dates.mjs';
import { createRecordId } from './record-id.mjs';
import { hasPendingTasksOnDate } from './task-history.mjs';
import { getFormatLocale, t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const DAYS_PER_WEEK = 7;
const AGENDA_PAGE_SIZE = 10;
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
/** @param {string} selected @param {string} month @param {boolean} isExpanded @param {string[]} marked @param {boolean} [canExpand] @param {string} [minimumDate] @param {string} [maximumDate] @returns {string} */
export const renderCalendar = (selected, month, isExpanded, marked = [], canExpand = true, minimumDate = '', maximumDate = '') => {
  const heading = parseDate(`${month}-01`).toLocaleDateString(getFormatLocale(), { month: 'long', year: 'numeric' });
  const weekdays = calendarDays('2026-09-21', '2026-09', false).map((date) => `<span>${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { weekday: 'short' }))}</span>`).join('');
  const monthHeading = canExpand ? `<button type="button" data-calendar-expand aria-expanded="${isExpanded}">${esc(heading)} ${icon('chevron-down', 16)}</button>` : `<span>${esc(heading)}</span>`;
  return `<div class="calendar-heading"><button type="button" data-calendar-move="-1" aria-label="${esc(t('Previous'))}">${icon('chevron-left', 20)}</button>${monthHeading}<button type="button" data-calendar-move="1" aria-label="${esc(t('Next'))}">${icon('chevron-right', 20)}</button></div><div class="calendar-weekdays" aria-hidden="true">${weekdays}</div><div class="calendar-days">${calendarDays(selected, month, isExpanded).map((date) => `<button type="button" data-calendar-date="${date}" ${(minimumDate && date < minimumDate) || (maximumDate && date > maximumDate) ? 'disabled' : ''} aria-pressed="${date === selected}" aria-label="${esc(parseDate(date).toLocaleDateString(getFormatLocale(), { dateStyle: 'full' }))}${marked.includes(date) ? `, ${esc(t('Tasks to do'))}` : ''}" class="${date.slice(0, 7) !== month ? 'calendar-outside' : ''}"><span>${parseDate(date).getDate()}</span>${marked.includes(date) ? '<i aria-hidden="true"></i>' : ''}</button>`).join('')}</div>`;
};

/** @param {HTMLElement} root @param {{tasks?:import('./store.mjs').Task[],renderAgenda?:(date:string,limit:number)=>string,onAgendaRendered?:()=>void}} [options] @returns {void} */
export function initializeSchedule(root, options = {}) {
  const panel = root.querySelector('[data-schedule]');
  if (!panel) return;
  const today = calendarDate(new Date());
  const rows = [...panel.querySelectorAll('[data-agenda] [data-task-date]')];
  let marked = rows.filter((row) => row.dataset.taskDone === 'false').map((row) => row.dataset.taskDate);
  const dialog = panel.querySelector('.task-sheet');
  const form = dialog.querySelector('form');
  const syncTimeWheels = initializeTaskTimePicker(form);
  const picker = dialog.querySelector('[data-task-picker]');
  const calendar = panel.querySelector('[data-schedule-calendar]');
  let selected = form.elements.dueDate.value || SELECTED_DATES.get(panel.dataset.schedule) || today;
  const previousView = CALENDAR_VIEWS.get(panel.dataset.schedule);
  let month = previousView?.month ?? selected.slice(0, 7);
  let isExpanded = previousView?.isExpanded ?? false;
  let step = 0;
  let agendaLimit = AGENDA_PAGE_SIZE;
  const updateAgenda = () => {
    SELECTED_DATES.set(panel.dataset.schedule, selected);
    CALENDAR_VIEWS.set(panel.dataset.schedule, { selected, month, isExpanded });
    if (!calendar) return;
    if (options.tasks) marked = calendarDays(selected,month,isExpanded).filter((date) => hasPendingTasksOnDate(options.tasks,date));
    calendar.innerHTML = renderCalendar(selected, month, isExpanded, marked);
    panel.querySelector('[data-agenda-title]').textContent = parseDate(selected).toLocaleDateString(getFormatLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
    let count = 0;
    if (options.renderAgenda) {
      const agenda = panel.querySelector('[data-agenda]');
      agenda.innerHTML = options.renderAgenda(selected,agendaLimit);
      count = agenda.querySelectorAll('[data-task-date]').length;
      options.onAgendaRendered?.();
    } else {
      rows.forEach((row) => { row.hidden = row.dataset.taskDate !== selected; if (!row.hidden) count += 1; });
      panel.querySelectorAll('[data-agenda] [data-schedule-group]').forEach((group) => { group.hidden = ![...group.querySelectorAll('[data-task-date]')].some((row) => !row.hidden); });
    }
    panel.querySelector('[data-agenda-empty]').hidden = count !== 0;
  };
  const updateStep = () => {
    dialog.querySelectorAll('[data-task-step]').forEach((item, index) => { item.hidden = index !== step; });
    dialog.querySelector('[data-task-back]').hidden = step === 0;
    dialog.querySelector('[data-task-next]').hidden = step === 5;
    dialog.querySelector('[type="submit"]').hidden = step !== 5;
    dialog.querySelector('[data-task-progress]').textContent = `${form.elements.repeat.value === 'none' && step === 5 ? 5 : step + 1} / ${form.elements.repeat.value === 'none' ? 5 : 6}`;
    const heading = dialog.querySelectorAll('[data-task-step]')[step].querySelector('h2');
    dialog.setAttribute('aria-label', heading.textContent);
    dialog.removeAttribute('aria-labelledby');
    heading.tabIndex = -1;
    if (dialog.open) heading.focus({ preventScroll: true });
    if (step === 2) syncTimeWheels();
    if (step === 5) renderTaskReview(form, dialog);
  };
  const pickerMarks = (month) => options.tasks ? markedTaskDates(options.tasks,month) : marked;
  const drawPicker = () => { const month = form.elements.dueDate.value.slice(0,7); picker.innerHTML = renderCalendar(form.elements.dueDate.value, month, true, pickerMarks(month), false, calendarDate(new Date())); };
  panel.querySelector('[data-agenda]')?.addEventListener('click', (event) => {
    if (!event.target.closest('[data-schedule-more]')) return;
    agendaLimit += AGENDA_PAGE_SIZE;
    updateAgenda();
    panel.querySelector('[data-schedule-more]')?.focus({preventScroll:true});
  });
  calendar?.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    agendaLimit = AGENDA_PAGE_SIZE;
    ({ selected, month, isExpanded } = nextCalendarView({ selected, month, isExpanded }, { ...button.dataset, shouldToggle:button.hasAttribute('data-calendar-expand') }));
    updateAgenda();
    const selector = button.hasAttribute('data-calendar-expand') ? '[data-calendar-expand]' : button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    calendar.querySelector(selector)?.focus({ preventScroll:true });
  });
  bindTaskSheet(panel, dialog, form, picker, pickerMarks, () => { step = 0; form.reset(); form.dataset.creationKey = createRecordId(); delete form.dataset.submitted; if (!form.elements.id) form.elements.dueDate.value = selected < calendarDate(new Date()) ? calendarDate(new Date()) : selected; drawPicker(); updateStep(); }, () => {
    const scheduled = new Date(`${form.elements.dueDate.value}T${form.elements.time.value}`).getTime();
    if ((step === 0 && form.elements.dueDate.value < calendarDate(new Date())) || (step === 2 && scheduled < Date.now())) {
      let error = dialog.querySelector('[data-task-time-error]');
      if (!error) { error = document.createElement('p'); error.dataset.taskTimeError = ''; error.setAttribute('role','alert'); }
      dialog.querySelectorAll('[data-task-step]')[step].append(error);
      error.textContent = t('Choose a future task date and time.');
      return;
    }
    dialog.querySelector('[data-task-time-error]')?.remove();
    const input = step === 1 ? form.elements.title : step === 2 ? form.elements.time : null;
    if (input && !input.reportValidity()) return;
    if (step === 3 && form.elements.repeat.value === 'custom' && !form.elements.repeatInterval.reportValidity()) return;
    if (step === 4 && form.elements.endKind.value !== 'never' && !validateTaskEndDate(form)) return;
    step = step === 3 && form.elements.repeat.value === 'none' ? 5 : Math.min(5, step + 1); updateStep();
  }, () => { step = step === 5 && form.elements.repeat.value === 'none' ? 3 : Math.max(0, step - 1); updateStep(); });
  form.addEventListener('submit', () => { SELECTED_DATES.set(panel.dataset.schedule, form.elements.dueDate.value); });
  updateAgenda();
}

/** @param {HTMLFormElement} form @param {HTMLDialogElement} dialog @returns {void} */
const renderTaskReview = (form, dialog) => {
  const values = [form.elements.title.value, parseDate(form.elements.dueDate.value).toLocaleDateString(getFormatLocale(), { dateStyle: 'long' }), form.elements.time.value, t(form.elements.category.value), taskRepeatLabel({ repeat: form.elements.repeat.value, repeatInterval: Number(form.elements.repeatInterval.value), repeatUnit: form.elements.repeatUnit.value })];
  values.push([...form.querySelectorAll('[name="plotIds"]:checked')].map((input) => input.nextElementSibling.textContent).join(', ') || t('Whole land'));
  values.push(form.elements.repeat.value === 'none' ? t('One-time task') : form.elements.endKind.value === 'never' ? t('No end date') : `${t(form.elements.endKind.value === 'harvest' ? 'Until harvest' : 'Ends')} · ${form.elements.endDate.value}`);
  dialog.querySelectorAll('[data-task-review]').forEach((item, index) => { item.textContent = values[index]; });
};
/** @param {string} date @param {string} minimumDate @returns {boolean} */
export const isTaskEndDateValid = (date, minimumDate) => /^\d{4}-\d{2}-\d{2}$/.test(date) && calendarDate(parseDate(date)) === date && date >= minimumDate;

/** @param {HTMLFormElement} form @returns {boolean} */
const validateTaskEndDate = (form) => {
  const isValid = isTaskEndDateValid(form.elements.endDate.value, form.elements.dueDate.value);
  const error = form.querySelector('[data-end-date-error]');
  error.hidden = isValid;
  error.textContent = isValid ? '' : t('Choose a date on or after your first task.');
  if (!isValid) form.querySelector('[data-task-end-picker] button:not(:disabled)')?.focus();
  return isValid;
};

/** @param {HTMLFormElement} form @returns {void} */
const renderTaskEndCalendar = (form) => {
  const picker = form.querySelector('[data-task-end-picker]');
  const fallback = form.elements.dueDate.value || calendarDate(new Date());
  if (picker.dataset.minimum !== fallback) { delete picker.dataset.month; picker.dataset.minimum = fallback; }
  const month = picker.dataset.month ?? (form.elements.endDate.value || fallback).slice(0, 7);
  picker.innerHTML = renderCalendar(form.elements.endDate.value, month, true, [], false, fallback);
};

/** @param {HTMLFormElement} form @returns {void} */
export function initializeTaskEndCalendar(form) {
  const picker = form.querySelector('[data-task-end-picker]');
  picker.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button || button.disabled) return;
    if (button.dataset.calendarDate) {
      form.elements.endDate.value = button.dataset.calendarDate;
      picker.dataset.month = button.dataset.calendarDate.slice(0, 7);
      form.querySelector('[data-end-date-error]').hidden = true;
    }
    if (button.dataset.calendarMove) {
      const month = picker.dataset.month ?? (form.elements.endDate.value || form.elements.dueDate.value).slice(0, 7);
      const date = parseDate(`${month}-01`);
      date.setMonth(date.getMonth() + Number(button.dataset.calendarMove));
      picker.dataset.month = calendarDate(date).slice(0, 7);
    }
    renderTaskEndCalendar(form);
    const selector = button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    picker.querySelector(selector)?.focus({preventScroll:true});
  });
  renderTaskEndCalendar(form);
}

/** @param {HTMLFormElement} form @returns {void} */
const updateScheduleEnd = (form) => {
  const isEnding = form.elements.repeat.value !== 'none' && form.elements.endKind.value !== 'never';
  form.querySelector('[data-end-date]').hidden = !isEnding;
  form.elements.endDate.disabled = !isEnding;
  renderTaskEndCalendar(form);
  const isHarvest = form.elements.endKind.value === 'harvest';
  form.querySelector('[data-end-date-label]').textContent = t(isHarvest ? 'Expected harvest' : 'End date');
  form.querySelector('[data-harvest-note]').hidden = !isEnding || !isHarvest;
};

/** @param {HTMLElement} panel @param {HTMLDialogElement} dialog @param {HTMLFormElement} form @param {HTMLElement} picker @param {string[]} marked @param {()=>void} open @param {()=>void} next @param {()=>void} back @returns {void} */
const bindTaskSheet = (panel, dialog, form, picker, pickerMarks, open, next, back) => {
  const updateRepeat = () => {
    const isCustom = form.elements.repeat.value === 'custom';
    form.querySelector('[data-repeat-custom]').hidden = !isCustom;
    form.elements.repeatInterval.disabled = !isCustom;
    form.elements.repeatUnit.disabled = !isCustom;
    updateScheduleEnd(form);
  };
  initializeTaskEndCalendar(form);
  updateRepeat();
  form.addEventListener('reset', () => { queueMicrotask(() => { delete form.querySelector('[data-task-end-picker]').dataset.month; form.querySelector('[data-end-date-error]').hidden = true; updateRepeat(); }); });
  form.addEventListener('change', (event) => {
    if (event.target.name === 'repeat') updateRepeat();
    if (['endKind', 'dueDate'].includes(event.target.name)) updateScheduleEnd(form);
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
    updateScheduleEnd(form);
    picker.innerHTML = renderCalendar(form.elements.dueDate.value, pickerMonth, true, pickerMarks(pickerMonth), false, calendarDate(new Date()));
  });
};

/** @param {HTMLElement} root @returns {void} */
export function initializeBookingCalendar(root) {
  const panel = root.querySelector('[data-booking-date]');
  if (!panel) return;
  const input = panel.querySelector('input[name="date"]');
  const calendar = panel.querySelector('[data-booking-calendar]');
  const { minimumDate, maximumDate } = pilotBookingDateRange();
  let view = {selected:input.value || minimumDate,month:(input.value || minimumDate).slice(0,7),isExpanded:true};
  const draw = () => { calendar.innerHTML = renderCalendar(view.selected,view.month,true,[],false,minimumDate,maximumDate); input.value=view.selected; };
  calendar.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || button.disabled) return;
    if (button.dataset.calendarDate && (button.dataset.calendarDate < minimumDate || button.dataset.calendarDate > maximumDate)) return;
    view = nextCalendarView(view,button.dataset);
    draw();
    const selector = button.dataset.calendarDate ? `[data-calendar-date="${button.dataset.calendarDate}"]` : `[data-calendar-move="${button.dataset.calendarMove}"]`;
    calendar.querySelector(selector)?.focus({preventScroll:true});
  });
  draw();
}

const TIME_WHEEL_ROW_HEIGHT = 44;
/** @param {string} [value] @returns {string} */
export function renderTaskTimePicker(value = '08:00') {
  const wheels = ['Hour','Minute'].map((label,index)=>{
    const count = index === 0 ? 24 : 60;
    return `<div class="time-wheel-column"><span>${esc(t(label))}</span><div class="time-wheel" data-time-wheel="${index}" role="spinbutton" tabindex="0" aria-label="${esc(t(label))}" aria-valuemin="0" aria-valuemax="${count-1}" aria-valuenow="${Number(value.split(':')[index])}">${Array.from({length:count},(_,number)=>`<div class="time-wheel-option" data-time-value="${number}" aria-hidden="true">${String(number).padStart(2,'0')}</div>`).join('')}</div></div>`;
  }).join('');
  return `<fieldset class="alarm-time-picker"><legend class="sr-only">${esc(t('Time'))}</legend><input type="hidden" name="time" value="${esc(value)}">${wheels}<span class="alarm-time-format">24h</span></fieldset>`;
}
/** @param {HTMLFormElement} form @returns {()=>void} */
const initializeTaskTimePicker = (form) => {
  const wheels = [...form.querySelectorAll('[data-time-wheel]')];
  const sync = () => wheels.forEach((wheel,index)=>{
    const value = Number(form.elements.time.value.split(':')[index]);
    wheel.scrollTop = value * TIME_WHEEL_ROW_HEIGHT;
    wheel.setAttribute('aria-valuenow',String(value));
  });
  wheels.forEach((wheel,index)=>{
    const select = (value) => {
      const parts = form.elements.time.value.split(':');
      parts[index] = String(value).padStart(2,'0');
      form.elements.time.value = parts.join(':');
      wheel.setAttribute('aria-valuenow',String(value));
    };
    wheel.addEventListener('scroll',()=>{
      if (wheel.clientHeight) select(Math.round(wheel.scrollTop / TIME_WHEEL_ROW_HEIGHT));
    },{passive:true});
    wheel.addEventListener('click',(event)=>{
      const option = event.target.closest('[data-time-value]');
      if (option) { select(Number(option.dataset.timeValue)); sync(); }
    });
    wheel.addEventListener('keydown',(event)=>{
      if (!['ArrowUp','ArrowDown','Home','End'].includes(event.key)) return;
      event.preventDefault();
      const max = index === 0 ? 23 : 59;
      const current = Number(wheel.getAttribute('aria-valuenow'));
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? max : current + (event.key === 'ArrowUp' ? -1 : 1);
      select(Math.max(0,Math.min(max,next))); sync();
    });
  });
  return sync;
};

/** @param {import('./store.mjs').Task[]} tasks @param {string} month @returns {string[]} */
export function markedTaskDates(tasks,month) {
  return calendarDays(`${month}-01`,month,true).filter((date)=>hasPendingTasksOnDate(tasks,date));
}

import { pilotBookingDateRange } from './booking-dates.mjs';
import { createRecordId } from './record-id.mjs';
import { scheduleCycleProgress, nextTaskOccurrence, currentTaskRounds, taskScheduleGroups, tasksOnCalendarDate, completedTaskRounds } from './task-history.mjs';
import { EXPERTS } from './expert-data.mjs';
import { canCompleteTask } from './actions.mjs';
import { renderFieldCareSheet } from './field-care.mjs';
import { landCover } from './land-covers.mjs';
import { cropEmoji, fieldTaskUrgency } from './land-map.mjs';
import { isLandBoundary } from './land-boundary.mjs';
import { renderLandEditor } from './land-editor.mjs';
import { renderLandSetup } from './land-setup.mjs';
import { calendarDate, renderTaskTimePicker, taskRepeatLabel } from './schedule.mjs';
import { COURSES, PILOTS, PRODUCTS, WEATHER } from './data.mjs';
import { getFormatLocale, getLocale, SUPPORTED_LOCALES, t } from './i18n.mjs';
import { escapeHtml as esc, localizeDemoState, icon, pageHeading, emptyState, profilePhoto } from './ui.mjs';

/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {AppState['farms'][number] & {isDemo?:boolean}} Farm */
/** @typedef {AppState['tasks'][number]} Task */
/** @typedef {AppState['bookings'][number] & {direction?:string,rescheduleRequest?:{date:string,time:string}}} Booking */
/** @typedef {AppState['orders'][number]} Order */

const AGENDA_PAGE_SIZE = 10;
const TASK_CATEGORIES = ['General', 'Water', 'Irrigation', 'Crop care', 'Fertilizer', 'Pesticide', 'Harvest', 'Soil', 'Other'];
const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const OPEN_BOOKING_STATUSES = ['requested', 'confirmed', 'accepted'];
const WIND_DIRECTIONS = { N: 'North', NE: 'Northeast', E: 'East', SE: 'Southeast', S: 'South', SW: 'Southwest', W: 'West', NW: 'Northwest' };

/** @param {string} href @param {string} label @param {string} [className] @returns {string} */
const link = (href, label, className = 'button button-secondary') => `<a class="${className}" href="${esc(href)}">${label}</a>`;

/** @param {string} href @param {string} label @returns {string} */
const back = (href, label) => link(href, `${icon('arrow-left', 18)} ${esc(label)}`, 'back-link');

/** @param {string} status @returns {string} */
const badge = (status) => `<span class="badge ${['confirmed', 'completed', 'approved'].includes(status) ? 'badge-green' : 'badge-amber'}">${esc(t(status === 'demo-paid' ? 'Simulated payment' : (status.charAt(0).toUpperCase() + status.slice(1)).replaceAll('-', ' ')))}</span>`;

/** @param {string} date @returns {string} */
const dateLabel = (date) => {
  if (!date) return t('Date to be agreed');
  const parsed = new Date(`${date.slice(0, 10)}T12:00:00`);
  return Number.isNaN(parsed.getTime()) ? t('Date unavailable') : parsed.toLocaleDateString(getFormatLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
};

/** @param {number} amount @returns {string} */
const money = (amount) => new Intl.NumberFormat(getFormatLocale(), { style: 'currency', currency: 'MYR', maximumFractionDigits: 2 }).format(Number.isFinite(amount) ? amount : 0);

/** @param {{label:string,name:string,type?:string,value?:string|number,required?:boolean,placeholder?:string,min?:string,max?:string,step?:string}} options @returns {string} */
const field = ({ label, name, type = 'text', value = '', required = true, placeholder = '', min, max, step }) => `<label class="field"><span>${esc(t(label))}</span><input class="input" name="${esc(name)}" type="${esc(type)}" value="${esc(String(value))}" ${required ? 'required' : ''} ${placeholder ? `placeholder="${esc(t(placeholder))}"` : ''} ${min !== undefined ? `min="${esc(min)}"` : ''} ${max !== undefined ? `max="${esc(max)}"` : ''} ${step !== undefined ? `step="${esc(step)}"` : ''} ${type === 'text' ? 'maxlength="120"' : ''}></label>`;

/** @param {string} name @param {string} label @param {string[]} values @param {string} selected @returns {string} */
const select = (name, label, values, selected) => `<label class="field"><span>${esc(t(label))}</span><select class="input" name="${esc(name)}">${values.map((value) => `<option value="${esc(value)}" ${value === selected ? 'selected' : ''}>${esc(t(value))}</option>`).join('')}</select></label>`;

/** @param {string} name @param {string} label @param {boolean} isChecked @returns {string} */
const checkbox = (name, label, isChecked) => `<label class="checkbox-field"><input type="checkbox" name="${esc(name)}" ${isChecked ? 'checked' : ''}><span>${esc(t(label))}</span></label>`;

/** @param {string} name @param {string} label @param {string} [value] @returns {string} */
const textarea = (name, label, value = '') => `<label class="field"><span>${esc(t(label))}</span><textarea class="input" name="${esc(name)}" rows="3" maxlength="2000" required>${esc(value)}</textarea></label>`;

/** @param {string} text @param {string} [iconName] @returns {string} */
const notice = (text, iconName = 'alert-circle') => `<p class="notice">${icon(iconName, 20)}<span>${esc(t(text))}</span></p>`;

/** @param {string} title @param {string} href @returns {string} */
const missing = (title, href) => `${pageHeading(t('Not found'), t(title), t('This record is not available in this device’s workspace.'))}${emptyState('Let’s take you back', 'Open an existing record from the list.', href, 'Back to the list')}`;

/** @param {string} title @param {string} body @param {string} [action] @returns {string} */
const section = (title, body, action = '') => `<section><div class="section-heading"><h2>${esc(t(title))}</h2>${action}</div>${body}</section>`;

/** @param {string} name @param {string} value @returns {string} */
const hidden = (name, value) => `<input type="hidden" name="${esc(name)}" value="${esc(value)}">`;

/** @param {string} label @param {string} value @param {string} [detail] @returns {string} */
const stat = (label, value, detail = '') => `<div class="stat"><span class="muted">${esc(t(label))}</span><strong>${esc(value)}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`;

/** @param {Farm} farm @param {AppState} state @returns {string} */
const farmCard = (farm, state) => {
  const remainingTasks = state.tasks.filter((task) => task.farmId === farm.id && !task.done).length;
  return `<div class="farm-card-wrap"><a class="media-card learning-photo-card farm-card" href="/farm/${esc(farm.id)}"><img class="media-image" src="${esc(landCover(farm, state.farms.findIndex((land) => land.id === farm.id)))}" alt="" width="1200" height="800" loading="lazy"><div class="learning-photo-body"><div class="farm-card-heading"><h2>${esc(farm.name)}</h2></div><p class="farm-card-meta learning-photo-meta">${farm.isDemo || farm.id === 'farm-1' ? `${esc(t('Land'))} · ` : ''}${esc(farm.crop)} · ${esc(String(farm.area))} ${esc(t(farm.unit ?? 'ha'))} · ${esc(t(remainingTasks === 1 ? '{count} task' : '{count} tasks', { count: remainingTasks }))}</p><div class="learning-photo-footer"><span class="button">${esc(t('View my land'))}${icon('arrow-up-right', 18)}</span></div></div></a><button type="button" class="land-card-delete" data-land-card-delete="${esc(farm.id)}" aria-label="${esc(t('Delete {name}', { name: farm.name }))}" title="${esc(t('Delete land'))}">${icon('trash', 22)}</button></div>`;
};

/** @returns {string} */
const renderLandCardDeleteSheet = () => `<dialog class="task-sheet land-card-delete-sheet" data-card-delete-sheet aria-labelledby="card-delete-title" aria-describedby="card-delete-description"><div class="land-delete-symbol" aria-hidden="true">${icon('trash', 28)}</div><h2 id="card-delete-title" data-card-delete-title>${esc(t('Delete land'))}</h2><p id="card-delete-description">${esc(t('Delete this land, its fields and scheduled tasks? This cannot be undone.'))}</p><p role="alert" data-card-delete-error></p><div class="land-card-delete-actions"><button type="button" class="button button-secondary" data-card-delete-cancel autofocus>${esc(t('Cancel'))}</button><button type="button" class="button land-card-delete-confirm" data-card-delete-confirm>${esc(t('Delete land'))}</button></div></dialog>`;

/** @param {AppState} state @returns {string} */
const renderFarms = (state) => `${pageHeading('', t('My land'))}<div class="section-stack" data-land-list><div class="card-grid">${state.farms.map((farm) => farmCard(farm, state)).join('')}</div><a class="button" href="/farm/new">${icon('plus', 18)} ${esc(t('Add land'))}</a>${renderLandCardDeleteSheet()}</div>`;

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
/** @param {Farm} farm @param {Task} task @returns {string} */
const taskAssignment = (farm, task) => {
  const assigned = farm.plots.find((plot) => plot.id === task.plotId);
  return assigned ? `${assigned.name} · ${assigned.crop}` : t('Whole land');
};
const taskList = (farm, tasks, isBare = false) => tasks.length ? `<div class="${isBare ? 'list schedule-field-list' : 'card list'}">${tasks.map((task) => `<div class="list-row ${canCompleteTask(task) ? '' : 'is-task-unavailable'}" data-task-date="${esc(task.dueDate)}" data-task-done="${task.done}"><button class="task-check task-status-control ${task.done ? 'is-complete' : ''}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" ${canCompleteTask(task) ? '' : 'disabled'} aria-label="${esc(t(task.done ? 'Completed {title}' : 'Complete {title}', { title: task.title }))}" aria-pressed="${task.done}">${task.done ? icon('check', 16) : ''}</button><a class="row-copy" href="/farm/${esc(farm.id)}/tasks/${esc(task.id)}"><span class="row-title task-status-title"><span class="sr-only">${esc(t(task.done ? 'Completed' : 'Pending'))}: </span><span>${esc(task.title)}</span></span><span class="row-subtitle">${esc(farm.plots.find((plot) => plot.id === task.plotId)?.name ?? t('Whole land'))}</span></a><button type="button" class="icon-button task-delete" data-action="delete-task" data-id="${esc(task.id)}" aria-label="${esc(t('Delete task'))}" title="${esc(t('Delete task'))}">${icon('trash', 18)}</button></div>`).join('')}</div>` : `<div class="task-empty">${icon('calendar', 28)}<p>${esc(t('No tasks available right now.'))}</p></div>`;

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
const scheduleTree = (farm, tasks) => currentTaskRounds(tasks).map((round) => renderTaskNotificationStack(farm,round,tasks)).join('');

/** @param {Farm} farm @param {Task[]} tasks @param {string} date @param {number} [limit] @returns {string} */
export function renderScheduledAgenda(farm,tasks,date,limit = AGENDA_PAGE_SIZE) {
  const rounds = taskScheduleGroups(tasksOnCalendarDate(tasks,date)).map((group) => {
    const ordered = [...group].sort((first,second) => first.time.localeCompare(second.time));
    const active = ordered.find((task) => !task.done) ?? ordered[ordered.length - 1];
    return ordered.filter((task) => task.time === active.time);
  }).sort((a,b) => a[0].time.localeCompare(b[0].time));
  const visible = rounds.slice(0,limit).map((round) => renderTaskNotificationStack(farm,round,tasks)).join('');
  return visible + (rounds.length > limit ? `<button type="button" class="button button-secondary" data-schedule-more>${esc(t('Show more rounds'))}</button>` : '');
}

/** @param {Task|undefined} task @returns {string} */
const scheduleEndPicker = (task) => `<fieldset class="task-repeat-picker"><legend class="sr-only">${esc(t('When should it end?'))}</legend>${[['date','On a date'],['harvest','Until harvest'],...(task?.repeat && task.repeat !== 'none' && !task.endDate ? [['never','No end date']] : [])].map(([value,label]) => `<label class="task-repeat-choice"><input type="radio" name="endKind" value="${value}" ${(task?.repeat && task.repeat !== 'none' ? task.endKind ?? 'date' : 'date') === value ? 'checked' : ''}><span>${esc(t(label))}</span></label>`).join('')}</fieldset><section class="form-stack" data-end-date hidden><h3 id="task-end-date-label" data-end-date-label>${esc(t('End date'))}</h3><input type="hidden" name="endDate" value="${esc(task?.endDate ?? '')}"><div data-task-end-picker role="group" aria-labelledby="task-end-date-label"></div><p class="muted" data-end-date-error role="alert" hidden></p></section><p class="muted" data-harvest-note hidden>${esc(t('Enter your expected harvest date. This schedule stops on that date.'))}</p>`;

/** @param {Task|undefined} task @returns {string} */
const repeatPicker = (task) => {
  const repeat = task?.repeat ?? 'none';
  const options = [['none', 'Never'], ['custom', 'Custom interval']];
  if (['daily', 'weekly', 'monthly'].includes(repeat)) options.push([repeat, { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[repeat]]);
  return `<fieldset class="task-repeat-picker"><legend>${esc(t('Repeat'))}</legend>${options.map(([value, label]) => `<label class="task-repeat-choice"><input type="radio" name="repeat" value="${value}" ${repeat === value ? 'checked' : ''}><span>${esc(t(label))}</span></label>`).join('')}</fieldset><div class="task-repeat-custom" data-repeat-custom ${repeat === 'custom' ? '' : 'hidden'}><label class="field">${esc(t('Every'))}<input class="input" type="number" name="repeatInterval" min="1" max="999" step="1" required value="${task?.repeatInterval ?? 1}"></label>${select('repeatUnit', 'Time unit', ['minutes', 'hours', 'days'], task?.repeatUnit ?? 'days')}</div><p class="muted task-repeat-note">${esc(t('The next occurrence is created when you complete this task.'))}</p>`;
};

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
const plotsList = (farm, tasks) => {
  const plots = farm.plots ?? [];
  return plots.length ? `<div class="field-card-scroll" aria-label="${esc(t('Your fields'))}">${plots.map((plot) => `<a class="field-summary-card" href="/farm/${esc(farm.id)}/plots/${esc(plot.id)}"><span class="field-card-crop" aria-hidden="true">${cropEmoji(plot.crop)}</span><span class="row-copy"><span class="row-title">${esc(plot.name)}</span><span class="row-subtitle">${esc(plot.crop)} · ${esc(String(plot.area))} ${esc(t('ha'))}</span>${fieldReminder(plot.id, tasks)}</span></a>`).join('')}</div>` : emptyState('No fields recorded yet', 'Your land’s crop and area are saved above.');
};

const LAND_COMPLETED_PREVIEW_LIMIT = 4;
/** @param {Farm} farm @param {Task[]} tasks @param {number} [limit] @returns {string} */
const completedTaskList = (farm, tasks, limit = Infinity) => completedTaskRounds(tasks)
  .slice(0, limit).map((group) => renderTaskNotificationStack(farm, group, tasks)).join('');

/** @param {Farm} farm @param {AppState} state @returns {string} */
const renderFarm = (farm, state) => {
  const tasks = state.tasks.filter((task) => task.farmId === farm.id);
  const completedTasks = tasks.filter((task) => task.done);
  const isSetupComplete = farm.plots.length > 0 && farm.plots.every((plot) => isLandBoundary(plot.boundary) && plot.crop?.trim());
  const landView = isSetupComplete ? renderLandOverview(farm) : renderLandEditor(farm, true);
  return `${back('/farm', t('All land'))}${pageHeading(farm.location, farm.name, `${farm.crop}${farm.isDemo || farm.id === 'farm-1' ? ` · ${t('Land')}` : ''}`)}<div data-schedule="${esc(farm.id)}"><div class="toolbar land-task-actions"><button type="button" class="button" data-plan-task>${icon('plus', 18)} ${esc(t('Schedule task'))}</button>${link(`/farm/${farm.id}/schedule`, esc(t('Open schedule')), 'button button-secondary')}</div>${renderTaskSheet(farm)}${renderFieldCareSheet()}</div>${landView}<div class="card card-pad land-summary"><div class="stat-grid">${stat('Total area', `${farm.area} ${t(farm.unit ?? 'ha')}`)}${stat('Fields', String(farm.plots.length))}${stat('Crop types', String(new Set(farm.plots.map((plot) => plot.crop.trim().toLowerCase()).filter(Boolean)).size))}</div><div class="toolbar">${link(`/weather`, `${icon('cloud', 18)} ${esc(t('Local weather'))}`)}</div></div>${section('Your fields', `<div class="section-stack">${plotsList(farm, tasks)}</div>`)}${section('Next on your land', `<div class="land-task-preview">${scheduleTree(farm, tasks) || `<p class="muted">${esc(t('Your schedule is clear'))}</p>`}</div>`, link(`/farm/${farm.id}/schedule`, esc(t('View all')), 'link'))}${completedTasks.length ? section('Completed', `<div class="land-task-preview">${completedTaskList(farm, tasks, LAND_COMPLETED_PREVIEW_LIMIT)}</div>`, link(`/farm/${farm.id}/history`, esc(t('View all')), 'link')) : ''}`;
};

const MILLISECONDS_PER_DAY = 86400000;
const PERCENT_SCALE = 100;

/** @param {string} plantedAt @returns {number|null} */
const plantingAge = (plantedAt) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(plantedAt)) return null;
  const planted = Date.parse(`${plantedAt}T00:00:00Z`);
  if (!Number.isFinite(planted) || new Date(planted).toISOString().slice(0, 10) !== plantedAt) return null;
  const today = new Date();
  const current = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((current - planted) / MILLISECONDS_PER_DAY);
};

/** @param {Farm} farm @param {import('./store.mjs').Plot} plot @returns {string} */
const plotInsights = (farm, plot) => {
  const share = farm.area > 0 ? Math.min(PERCENT_SCALE, Math.max(0, plot.area / farm.area * PERCENT_SCALE)) : 0;
  const percentage = Math.round(share);
  const age = plantingAge(plot.plantedAt);
  const ageValue = age === null ? '—' : String(Math.abs(age));
  const areaNote = plot.isAreaEstimated ? t('Estimated from mapped boundary') : t('Of {area} ha recorded for this land', { area: farm.area });
  const ageLabel = age !== null && age < 0 ? 'Days until planting' : 'Days since planting';
  return `<div class="plot-insights"><section class="card card-pad plot-area-insight"><div class="plot-area-ring" style="--plot-share:${share}%" role="img" aria-label="${esc(t('{percent}% of land area', { percent: percentage }))}"><strong>${percentage}<small>%</small></strong></div><div><h2>${esc(t('Land area share'))}</h2><p class="plot-insight-value">${esc(String(plot.area))} <small>${esc(t('ha'))}</small></p><p class="muted">${esc(areaNote)}</p></div></section>${age === null ? '' : `<section class="plot-age-insight"><span class="plot-age-icon" aria-hidden="true">${icon('calendar', 22)}</span><div><span class="muted">${esc(t(age === null ? 'Planted' : ageLabel))}</span>${age === null ? `<p class="plot-age-missing">${esc(t('Not recorded'))}</p>` : `<strong class="plot-insight-value">${esc(ageValue)} <small>${esc(t('days'))}</small></strong><span class="muted">${esc(dateLabel(plot.plantedAt))}</span>`}</div></section>`}</div>`;
};

/** @param {Farm} farm @param {string} plotId @param {AppState} state @returns {string} */
const renderPlot = (farm, plotId, state) => {
  const plot = (farm.plots ?? []).find((item) => item.id === plotId);
  if (!plot) return missing('Plot not found', `/farm/${farm.id}`);
  const tasks = state.tasks.filter((task) => task.farmId === farm.id && !task.done && !task.plotId).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`));
  const hasMappedPlot = plot.boundary?.length || (farm.plots.length === 1 && plot.area === farm.area);
  const map = hasMappedPlot ? section('Field boundary', renderFarmMap(farm, plot.id)) : '';
  return `${back(`/farm/${farm.id}`, farm.name)}${pageHeading('', plot.name, `${plot.crop} · ${farm.location}`)}${map}${plotInsights(farm, plot)}${renderPlotCare(farm, plot, state, tasks)}`;
};

/** @param {Farm} farm @param {import('./store.mjs').Plot} plot @param {AppState} state @param {Task[]} landTasks @returns {string} */
const renderPlotCare = (farm, plot, state, landTasks) => {
  const fieldTasks = state.tasks.filter((task) => task.farmId === farm.id && task.plotId === plot.id && !task.done).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`));
  const content = fieldTasks.length ? taskList(farm, fieldTasks) : `<div class="plot-care-empty"><span aria-hidden="true">${icon('circle-check', 24)}</span><div><strong>${esc(t('Your schedule is clear'))}</strong><p>${esc(t('Plan your next field task.'))}</p></div></div>`;
  return `<div class="plot-care" data-schedule="${esc(farm.id)}"><section class="plot-care-panel"><header><h2>${esc(t('Field care'))}</h2><span class="plot-care-count">${fieldTasks.length}</span></header>${content}<button type="button" class="button plot-care-plan" data-plan-task>${icon('plus', 18)} ${esc(t('Plan a task'))}</button></section>${renderTaskSheet(farm, undefined, plot.id)}</div><section class="plot-land-work"><a href="/farm/${esc(farm.id)}/schedule" class="plot-land-work-link"><span class="plot-age-icon" aria-hidden="true">${icon('calendar', 22)}</span><span><strong>${esc(t('Land-wide work'))}</strong><span class="muted">${esc(t('{count} tasks to do', { count: landTasks.length }))}</span></span>${icon('chevron-right', 20)}</a>${landTasks.length ? taskList(farm, landTasks.slice(0, 3)) : ''}</section>`;
};

/** @param {Farm} farm @param {AppState} state @returns {string} */
const renderSchedule = (farm, state) => {
  const tasks = state.tasks.filter((task) => task.farmId === farm.id).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`));
  const today = calendarDate(new Date());
  const overdue = currentTaskRounds(tasks).filter((round) => round[0].dueDate < today).flat();
  return `${back(`/farm/${farm.id}`, farm.name)}${pageHeading('', t('Land schedule'), farm.name)}<div class="land-schedule-view" data-schedule="${esc(farm.id)}"><section class="schedule-calendar card card-pad" aria-label="${esc(t('Land schedule'))}" data-schedule-calendar></section><div class="toolbar schedule-agenda-heading"><h2 data-agenda-title></h2><button type="button" class="button" data-plan-task>${icon('plus', 18)} ${esc(t('Plan a task'))}</button></div><div data-agenda>${scheduleTree(farm, tasks)}</div><p class="muted" data-agenda-empty hidden>${esc(t(tasks.length ? 'No tasks on this date. Choose a highlighted date to see your scheduled tasks.' : 'Your schedule is clear'))}</p>${overdue.length ? section('Overdue', scheduleTree(farm, overdue)) : ''}<a class="button button-secondary schedule-history-button" href="/farm/${esc(farm.id)}/history">${icon('clock',18)}${esc(t('View history'))}</a>${renderTaskSheet(farm)}</div>`;
};

/** @param {string} plotId @param {Task[]} tasks @returns {string} */
const fieldReminder = (plotId, tasks) => {
  const next = tasks.filter((task) => task.plotId === plotId && !task.done).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`))[0];
  return `<span class="row-subtitle">${next ? `${esc(next.title)}` : esc(t('No field tasks scheduled'))}</span>`;
};

/** @param {Farm} farm @param {string} plotId @returns {string} */
const fieldSelection = (farm, plotId) => `<fieldset class="task-field-selection"><legend>${esc(t('Field'))}</legend><div class="task-field-pills">${[{ id: '', name: t('Whole land') }, ...farm.plots].map((plot) => `<label class="task-field-pill"><input type="checkbox" name="plotIds" value="${esc(plot.id)}" ${plot.id === plotId ? 'checked' : ''}><span>${esc(plot.name)}</span></label>`).join('')}</div></fieldset>`;

/** @param {Farm} farm @param {Task} [task] @param {string} [plotId] @returns {string} */
const renderTaskSheet = (farm, task, plotId = task?.plotId ?? '') => `<dialog class="task-sheet" aria-labelledby="task-sheet-title"><form data-form="task">${hidden('farmId', farm.id)}${hidden('dueDate', task?.dueDate ?? '')}${task ? hidden('id', task.id) : ''}<div class="task-sheet-heading"><span class="muted" data-task-progress></span><button type="button" class="icon-button" data-task-close aria-label="${esc(t('Cancel'))}">${icon('x', 20)}</button></div><div data-task-step><h2 id="task-sheet-title">${esc(t('Choose a date'))}</h2><div data-task-picker></div></div><div data-task-step hidden><h2>${esc(t('What needs doing?'))}</h2>${field({ label: 'Task name', name: 'title', value: task?.title ?? '', placeholder: 'e.g. Check irrigation channels' })}${select('category', 'Category', TASK_CATEGORIES, task?.category ?? 'General')}${fieldSelection(farm, plotId)}</div><div data-task-step hidden><h2>${esc(t('Choose a time'))}</h2>${renderTaskTimePicker(task?.time ?? '08:00')}${checkbox('reminder', 'Show a reminder in my notifications', task?.reminder ?? true)}</div><div data-task-step hidden><h2>${esc(t('Does this repeat?'))}</h2>${repeatPicker(task)}</div><div data-task-step hidden data-task-end-step><h2>${esc(t('When should it end?'))}</h2>${scheduleEndPicker(task)}</div><div data-task-step hidden><h2>${esc(t('Review your task'))}</h2><dl class="field-review">${['Task name', 'Date', 'Time', 'Category', 'Repeat', 'Field', 'Ends'].map((label) => `<div><dt>${esc(t(label))}</dt><dd data-task-review></dd></div>`).join('')}</dl><p class="muted">${esc(t('In-app reminders only. Background alerts are not connected.'))}</p></div><div class="task-sheet-actions"><button type="button" class="button button-secondary" data-task-back hidden>${esc(t('Back'))}</button><button type="button" class="button" data-task-next>${esc(t('Continue'))}</button><button type="submit" class="button" hidden>${esc(t(task ? 'Save changes' : 'Add to schedule'))}</button></div></form></dialog>`;

/** @param {Farm} farm @param {Task} task @returns {string} */
const renderTask = (farm, task) => {
  const rows = [['Date', dateLabel(task.dueDate)], ['Time', task.time], ['Field', taskAssignment(farm, task)]];
  const status = task.done ? `<span class="task-detail-status">${icon('circle-check',16)}${esc(t('Completed'))}</span>` : '';
  const complete = !task.plotId && farm.plots.length ? farm.plots.map((plot) => renderTaskFieldRow(farm, task, plot)).join('') : task.done ? '' : `<button class="button button-secondary" data-action="toggle-task" data-id="${esc(task.id)}" ${canCompleteTask(task) ? '' : 'disabled'}>${esc(t('Mark complete'))}</button>`;
  return `<section class="task-detail-page">${back(`/farm/${farm.id}/schedule`, t('Land schedule'))}${pageHeading(t(task.category), task.title, farm.name)}${status}<div data-schedule="${esc(farm.id)}"><dl class="task-detail-list">${rows.map(([label,value]) => `<div><dt>${esc(t(label))}</dt><dd>${esc(value)}</dd></div>`).join('')}</dl><div class="task-detail-actions"><button class="button" data-plan-task>${icon('pencil',18)}${esc(t('Edit task'))}</button>${complete}</div><button class="task-detail-delete" data-action="delete-task" data-id="${esc(task.id)}">${icon('trash',18)}${esc(t('Delete task'))}</button>${renderTaskSheet(farm, task)}</div></section>`;
};

/** @param {number[]} values @returns {string} */
const weatherTrend = (values) => {
  const minimum = Math.min(...values) - 4;
  const range = Math.max(...values) - minimum + 4;
  const points = values.map((value, index) => [8 + index * 184 / (values.length - 1), 54 - (value - minimum) / range * 44]);
  const path = points.reduce((result, point, index) => {
    if (!index) return `M ${point.join(' ')}`;
    const previous = points[index - 1];
    const middle = (previous[0] + point[0]) / 2;
    return `${result} C ${middle} ${previous[1]}, ${middle} ${point[1]}, ${point.join(' ')}`;
  }, '');
  return `<svg viewBox="0 0 200 64" aria-hidden="true"><path d="${path}" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="${points[0][0]}" cy="${points[0][1]}" r="4" fill="currentColor"/></svg>`;
};
/** @param {string} label @param {string} symbol @param {number} value @param {string} unit @param {number[]} values @param {string} [detail] @returns {string} */
const weatherMetric = (label, symbol, value, unit, values, detail = '') => `<section class="forecast-metric"><div class="forecast-metric-value"><h2>${icon(symbol, 18)}${esc(t(label))}</h2><p><strong>${value}</strong><span>${esc(t(unit))}</span></p>${detail ? `<span class="forecast-detail">${esc(detail)}</span>` : ''}</div><div class="forecast-trend">${weatherTrend(values)}<div class="forecast-times"><span>${esc(t('Now'))}</span><span>12:00</span><span>15:00</span></div><span class="sr-only">${WEATHER.hourly.map((hour, index) => `${esc(t(hour.time))}: ${values[index]} ${esc(t(unit))}`).join('; ')}</span></div></section>`;
/** @param {Farm} farm @returns {string} */
const renderWeather = () => `${back('/', t('Home'))}<div class="forecast-panel"><header class="forecast-hero"><div><h1>${esc(t(WEATHER.location))}</h1><p class="forecast-temperature">${WEATHER.temperature}<span>°C</span></p><p>${esc(t(WEATHER.condition))}</p><p>${esc(t('High'))}: ${WEATHER.daily[0].high}° · ${esc(t('Low'))}: ${WEATHER.daily[0].low}°</p></div><span class="forecast-symbol" aria-hidden="true">⛅</span></header><p class="forecast-source">${esc(t('Sample forecast · not live'))}</p><div class="forecast-metrics">${weatherMetric('Wind speed', 'wind', WEATHER.windSpeed, 'km/h', WEATHER.hourly.map((hour) => hour.windSpeed), t('From {direction}', { direction: t(WIND_DIRECTIONS[WEATHER.windDirection]) }))}${weatherMetric('Rain chance', 'cloud-rain', WEATHER.rainChance, '%', WEATHER.hourly.map((hour) => hour.rainChance))}${weatherMetric('Humidity', 'droplet', WEATHER.humidity, '%', WEATHER.hourly.map((hour) => hour.humidity))}</div><div class="forecast-days">${WEATHER.daily.map((day) => `<div><span>${esc(t(day.day))}</span>${icon(day.rainChance > 50 ? 'cloud-rain' : 'cloud', 22)}<span>${day.high}° <span class="forecast-low">${day.low}°</span></span></div>`).join('')}</div></div>`;

/** Only app-generated titles are translated; custom booking titles stay untouched.
 * @param {Booking} booking @returns {string}
 */
const bookingTitle = (booking) => {
  const provider = (booking.type === 'course' ? COURSES : PILOTS).find((item) => item.id === booking.providerId);
  if (booking.type === 'course') return provider?.title === booking.title ? t(provider.title) : booking.title;
  const original = `${booking.service} with ${provider?.name}`;
  return provider && booking.service && booking.title === original
    ? t('{service} with {name}', { service: t(booking.service), name: provider.name }) : booking.title;
};

/** @param {AppState['notifications'][number]} notification @param {AppState} state @returns {{title:string,body:string}} */
const notificationCopy = (notification, state) => {
  if (notification.id.startsWith('reminder-')) {
    const match = /^Due (\d{4}-\d{2}-\d{2}) at (\d{2}:\d{2})$/.exec(notification.body);
    return { title: notification.title, body: match ? t('Due {date} at {time}', { date: dateLabel(match[1]), time: match[2] }) : notification.body };
  }
  const savedSuffix = ['. Saved on this device.', '. Local demo only.'].find((suffix) => notification.body.endsWith(suffix));
  if (notification.title === 'Booking request saved' && savedSuffix) {
    const title = notification.body.slice(0, -savedSuffix.length);
    const booking = state.bookings.find((item) => item.title === title);
    return { title: t(notification.title), body: t('{title}. Saved on this device.', { title: booking ? bookingTitle(booking) : title }) };
  }
  if (notification.title === 'Schedule change saved') return { title: t(notification.title), body: t(notification.body) };
  return { title: notification.title, body: notification.body };
};

/** @param {Booking} booking @returns {string} */
const bookingRow = (booking) => `<section class="booking-list-item"><a class="list-row" href="/bookings/${esc(booking.id)}"><span class="row-icon">${icon(booking.type === 'course' ? 'school' : 'drone')}</span><span class="row-copy"><span class="row-title">${esc(bookingTitle(booking))}</span><span class="row-subtitle">${esc(dateLabel(booking.date))} · ${esc(booking.time)}</span></span><span class="row-end">${badge(booking.status)}${icon('chevron-right', 16)}</span></a>${OPEN_BOOKING_STATUSES.includes(booking.status) ? `<div class="booking-list-actions"><details class="booking-reschedule"><summary>${icon('calendar', 18)} ${esc(t('Reschedule'))}${icon('chevron-down', 18)}</summary>${rescheduleForm(booking)}</details><button type="button" class="booking-cancel" data-action="cancel-booking" data-id="${esc(booking.id)}">${esc(t('Cancel booking'))}</button></div>` : ''}</section>`;

/** @param {AppState} state @returns {string} */
const renderBookings = (state) => `${pageHeading(t('Your plans, together'), t('Bookings'), '')}<div class="toolbar">${link('/services/pilots', `${icon('drone', 18)} ${esc(t('Find a pilot'))}`, 'button')}${link('/learn/courses', `${icon('school', 18)} ${esc(t('Browse courses'))}`)}</div>${state.bookings.length ? `<div class="card list">${state.bookings.map(bookingRow).join('')}</div>` : emptyState('Nothing booked yet', 'Find a pilot for your next job or make time to learn a new technique.', '/services/pilots', 'Explore drone pilots')}`;

/** @param {Booking} booking @returns {string} */
const rescheduleForm = (booking) => `<form class="form-stack booking-reschedule-form" data-form="reschedule">${hidden('bookingId', booking.id)}<div class="form-grid">${booking.type === 'pilot' ? `<label class="field">${esc(t('Preferred date'))}<input class="input" type="date" name="date" value="${esc(booking.date)}" min="${pilotBookingDateRange().minimumDate}" max="${pilotBookingDateRange().maximumDate}" required></label>` : field({ label: 'Preferred date', name: 'date', type: 'date', value: booking.date })}${field({ label: 'Preferred time', name: 'time', type: 'time', value: booking.time })}</div><p class="muted">${esc(t('The agreed time changes only after the provider confirms.'))}</p><button type="submit" class="button button-secondary">${esc(t('Request schedule change'))}</button></form>`;

/** @param {Booking} booking @param {AppState} state @returns {string} */
const renderBooking = (booking, state) => {
  const farm = state.farms.find((item) => item.id === booking.farmId);
  const pilot = PILOTS.find((item) => item.id === booking.providerId);
  const isActive = OPEN_BOOKING_STATUSES.includes(booking.status);
  const amount = booking.type === 'course' ? t('Free') : money(booking.price);
  /** @param {string} label @param {string} value @returns {string} */
  const detail = (label, value) => `<div class="booking-receipt-row"><dt>${esc(t(label))}</dt><dd>${esc(value)}</dd></div>`;
  return `${back('/bookings', t('All bookings'))}<article class="booking-receipt"><header class="booking-receipt-hero"><span class="booking-receipt-icon" aria-hidden="true">${icon(booking.type === 'course' ? 'school' : 'drone', 28)}</span><h1 class="page-title" tabindex="-1">${esc(bookingTitle(booking))}</h1><p class="booking-receipt-amount">${esc(amount)}</p><p class="muted">${esc(t(booking.type === 'course' ? 'Course fee' : 'Estimate'))}</p>${badge(booking.status)}</header><dl class="booking-receipt-details">${detail('Date', dateLabel(booking.date))}${detail('Time', booking.time)}${pilot ? detail('Provider', pilot.name) : ''}${farm ? detail('Land', farm.name) : ''}</dl>${booking.notes ? `<p class="booking-receipt-note">${esc(booking.notes)}</p>` : ''}${booking.rescheduleRequest ? `<p class="booking-receipt-note muted">${esc(t('Schedule change requested: {date} at {time}. Awaiting provider confirmation.', { date: dateLabel(booking.rescheduleRequest.date), time: booking.rescheduleRequest.time }))}</p>` : ''}<div class="booking-receipt-actions">${isActive ? `<details class="booking-reschedule"><summary>${icon('calendar', 18)} ${esc(t('Reschedule'))}${icon('chevron-down', 18)}</summary>${rescheduleForm(booking)}</details><button class="booking-cancel" data-action="cancel-booking" data-id="${esc(booking.id)}">${esc(t('Cancel booking'))}</button>` : `<div class="booking-inactive-actions"><button class="button button-secondary" disabled>${icon('calendar', 18)} ${esc(t('Reschedule'))}</button><button class="button button-secondary" disabled>${esc(t('Cancel booking'))}</button></div>`}</div><footer class="booking-receipt-footer"><p>${esc(t('Reference {id}', { id: booking.id }))}</p><p>${esc(t('No provider contacted or reservation made.'))}</p></footer></article>`;
};

/** @param {Booking} booking @returns {string} */
const conversationName = (booking) => booking.name ?? (booking.type === 'course' ? COURSES.find((course) => course.id === booking.providerId)?.instructor : PILOTS.find((pilot) => pilot.id === booking.providerId)?.name) ?? bookingTitle(booking);
/** @param {Booking} booking @returns {string} */
const conversationAvatar = (booking) => {
  const expert = EXPERTS.find((item) => item.id === booking.expertId);
  const pilot = booking.type === 'pilot' ? PILOTS.find((item) => item.id === booking.providerId) : undefined;
  return `<img class="chat-avatar" src="${esc(expert?.portrait ?? pilot?.portrait ?? '/assets/avatar-default.svg')}" alt="" width="50" height="50">`;
};
/** @param {Booking} booking @returns {string} */
const renderChat = (booking) => {
  const name = conversationName(booking);
  const messages = booking.conversation ?? [];
  return `<section class="chat-screen" data-chat-id="${esc(booking.id)}"><header class="chat-header"><a class="icon-button" href="/messages" aria-label="${esc(t('Messages'))}">${icon('arrow-left',22)}</a>${conversationAvatar(booking)}<div class="row-copy"><h1>${esc(name)}</h1></div>${booking.name ? '' : `<a class="icon-button" href="/bookings/${esc(booking.id)}" aria-label="${esc(t('Booking details'))}">${icon('calendar',22)}</a>`}</header><div class="message-list chat-history" role="log" aria-label="${esc(t('Conversation'))}" aria-live="polite">${messages.length ? messages.map((message) => `<article class="message-bubble ${message.sender === 'you' ? 'message-own' : 'message-received'}"><span class="sr-only">${esc(message.sender === 'you' ? t('You') : message.sender)}</span><p>${esc(message.text)}</p><time datetime="${esc(message.date)}">${esc(dateLabel(message.date))}</time></article>`).join('') : `<div class="empty-state">${icon('message-circle',40)}<h2>${esc(t('Start a conversation'))}</h2></div>`}<div class="chat-typing message-bubble message-received" data-chat-typing role="status" hidden><span class="chat-typing-dots" aria-hidden="true"><span></span><span></span><span></span></span><span class="sr-only">${esc(name)} ${esc(t('is typing'))}</span></div></div><form class="chat-composer" data-form="message">${hidden(booking.name ? 'chatId' : 'bookingId', booking.id)}<label class="sr-only" for="chat-message">${esc(t('Your message'))}</label><textarea id="chat-message" name="message" rows="1" maxlength="2000" required placeholder="${esc(t('Your message'))}"></textarea><button class="icon-button" type="submit" aria-label="${esc(t('Save message'))}">${icon('arrow-up',22)}</button></form></section>`;
};
/** @param {AppState} state @returns {string} */
const renderMessages = (state) => {
  const bookings = [...state.bookings, ...(state.chats ?? []).map((chat) => ({ ...chat, title:chat.name, date:new Date().toISOString() }))].sort((a,b) => (b.conversation?.at(-1)?.date ?? b.date).localeCompare(a.conversation?.at(-1)?.date ?? a.date));
  return `${pageHeading('', t('Messages'))}<section class="inbox"><label class="search-field">${icon('search',20)}<input type="search" data-search="conversations" aria-label="${esc(t('Search conversations'))}" placeholder="${esc(t('Search conversations'))}"></label><div class="section-heading"><a class="link" href="/messages/new">${icon('plus',18)} ${esc(t('New chat'))}</a></div>${bookings.length ? `<div class="inbox-list">${bookings.map((booking) => {
    const name = conversationName(booking); const latest = booking.conversation?.at(-1);
    return `<a class="inbox-row" data-search-item data-topic="all" data-search-text="${esc(`${name} ${bookingTitle(booking)} ${latest?.text ?? ''}`.toLowerCase())}" href="${booking.name ? `/messages/${esc(booking.id)}` : `/bookings/${esc(booking.id)}/chat`}">${conversationAvatar(booking)}<span class="row-copy"><span class="inbox-row-heading"><strong>${esc(name)}</strong><time>${esc(dateLabel(latest?.date ?? booking.date))}</time></span><span class="inbox-preview">${latest?.sender === 'you' ? `${esc(t('You'))}: ` : ''}${esc(latest?.text ?? t(booking.name ? 'Start a conversation' : 'Start a conversation about this booking'))}</span></span></a>`;
  }).join('')}</div><p class="muted" data-search-empty hidden>${esc(t('No conversations found.'))}</p>` : emptyState('Your conversations will appear here', '', '/messages/new', 'New chat')}</section>`;
};

/** @param {AppState} state @returns {string} */
const renderRoles = (state) => `${pageHeading(t(''), t('How will you use Aura?'))}<div class="form-stack"><button class="role-card" data-action="choose-role" data-role="farmer">${icon('plant-2', 38)}<span class="row-copy"><span class="row-title">${esc(t('I’m a farmer'))}</span><span class="row-subtitle">${esc(t('Plan work and find expert help.'))}</span></span>${icon('arrow-right', 18)}</button><button class="role-card" data-action="choose-role" data-role="pilot">${icon('drone', 38)}<span class="row-copy"><span class="row-title">${esc(t('I’m a drone pilot'))}</span><span class="row-subtitle">${esc(t('Manage services and job requests.'))}</span></span>${icon('arrow-right', 18)}</button><button class="button button-secondary" data-action="choose-role" data-role="both">${esc(t('I do both'))}</button></div><p class="muted">${esc(t(state.profile.onboarded ? 'You can switch roles anytime.' : 'Saved on this device. Add another role anytime.'))}</p>`;

/** @returns {string} */
const profilePhotoUpload = () => `<div data-photo-upload><label class="field"><span>${esc(t('Profile picture (optional)'))}</span><input class="input" type="file" accept="image/jpeg,image/png,image/webp" data-profile-photo></label><p class="muted" role="status" aria-live="polite">${esc(t('You can add or change your photo anytime in My account.'))}</p></div>`;

/** @param {AppState} state @returns {string} */
const profileNameFields = (state) => {
  const [legacyFirst = '', ...legacyLast] = state.profile.name.trim().split(/\s+/);
  return `<span class="avatar">${profilePhoto(state.profile)}</span>${profilePhotoUpload()}${field({ label: 'First name', name: 'firstName', value: state.profile.firstName ?? legacyFirst })}${field({ label: 'Last name', name: 'lastName', value: state.profile.lastName ?? legacyLast.join(' ') })}`;
};

/** @param {AppState} state @returns {string} */
const renderFarmerOnboarding = (state) => `${back('/onboarding/role', t('Choose role'))}${pageHeading(t('Farmer setup'), t('Select your land'))}<form class="card card-pad form-stack" data-form="land-onboarding">${profileNameFields(state)}<button class="button" type="submit">${esc(t('Continue to land setup'))}</button></form>`;

/** @param {AppState} state @param {boolean} [isEditing] @returns {string} */
const pilotProfileForm = (state, isEditing = false) => `<form class="card card-pad form-stack" data-form="pilot-onboarding">${profileNameFields(state)}${field({ label: 'Service area', name: 'area', value: state.pilot.area, placeholder: 'e.g. Kedah and northern Perak' })}${field({ label: 'Services (separate with commas)', name: 'services', value: state.pilot.services.join(', '), placeholder: 'Spraying, mapping, surveying' })}${field({ label: 'Drone and equipment', name: 'equipment', value: state.pilot.equipment, placeholder: 'Model, tank capacity and supporting equipment' })}${field({ label: 'Starting rate (RM per hectare)', name: 'rate', type: 'number', min: '0', step: '0.01', value: state.pilot.rate || '' })}<p class="muted">${esc(t('Saved locally. Your profile is not published.'))}</p><button class="button" type="submit">${esc(t(isEditing ? 'Save pilot profile' : 'Save and continue'))} ${icon('arrow-right', 18)}</button></form>`;

/** @param {AppState} state @returns {string} */
const renderPilotOnboarding = (state) => `${back('/onboarding/role', t('Choose role'))}${pageHeading(t('Pilot setup'), t('Your work, your coverage'), '')}${pilotProfileForm(state)}`;

/** @param {AppState} state @returns {string} */
const renderVerification = (state) => `${back('/pilot/profile', t('Pilot profile'))}${pageHeading(t('Pilot credentials'), t('Build trust before take-off'), t('Record a credential reference for a future verification review.'))}<div class="toolbar">${badge(state.pilot.verification)}</div>${notice('Review is not connected. Your status stays pending.')}<form class="card card-pad form-stack" data-form="verification">${field({ label: 'Credential reference', name: 'credentialReference', value: state.pilot.credentialReference ?? '', placeholder: 'Use a non-sensitive reference' })}<p class="muted">${esc(t('Do not enter identity documents or sensitive personal information here.'))}</p><button class="button" type="submit">${esc(t('Save reference for review'))}</button></form>`;

/** @param {AppState} state @returns {string} */
const renderPilotHome = (state) => {
  const requests = state.bookings.filter((booking) => booking.direction === 'incoming' && booking.status === 'requested');
  return `${pageHeading(t('Your flight desk'), t('Pilot workspace'), '')}<div class="card card-pad"><div class="stat-grid">${stat('Incoming requests', String(requests.length))}${stat('Verification', t(state.pilot.verification.charAt(0).toUpperCase() + state.pilot.verification.slice(1).replaceAll('-', ' ')))}${stat('Starting rate', `${money(state.pilot.rate)} / ${t('ha')}`)}</div></div><div class="card list"><a class="list-row" href="/pilot/requests"><span class="row-icon">${icon('calendar')}</span><span class="row-copy"><span class="row-title">${esc(t('Job requests'))}</span><span class="row-subtitle">${esc(t('Review proposed dates and farm details'))}</span></span>${icon('chevron-right', 18)}</a><a class="list-row" href="/pilot/availability"><span class="row-icon">${icon('clock')}</span><span class="row-copy"><span class="row-title">${esc(t('Your availability'))}</span><span class="row-subtitle">${esc(t('Set the hours that work for you'))}</span></span>${icon('chevron-right', 18)}</a><a class="list-row" href="/pilot/profile"><span class="row-icon">${icon('user')}</span><span class="row-copy"><span class="row-title">${esc(t('Pilot profile'))}</span><span class="row-subtitle">${esc(t('Services, coverage and credentials'))}</span></span>${icon('chevron-right', 18)}</a></div>${state.pilot.verification !== 'approved' ? notice('Verification required before accepting jobs.') : ''}`;
};

/** @param {AppState} state @returns {string} */
const renderPilotRequests = (state) => {
  const requests = state.bookings.filter((booking) => booking.direction === 'incoming' && booking.status === 'requested');
  return `${back('/pilot', t('Pilot workspace'))}${pageHeading(t('New opportunities'), t('Job requests'), '')}${notice('Live job requests are not connected.')}${requests.length ? `<div class="card list">${requests.map((booking) => `<div class="list-row"><span class="row-copy"><a class="row-title" href="/bookings/${esc(booking.id)}">${esc(bookingTitle(booking))}</a><span class="row-subtitle">${esc(dateLabel(booking.date))} · ${esc(booking.time)}</span></span><button class="button button-small" data-action="pilot-accept" data-id="${esc(booking.id)}" ${state.pilot.verification !== 'approved' ? 'disabled aria-describedby="verification-required"' : ''}>${esc(t('Accept request'))}</button></div>`).join('')}</div>` : emptyState('No incoming requests', 'When booking services are connected, requests within your coverage will appear here.')}<p class="muted" id="verification-required">${esc(t('A verified pilot profile is required to accept jobs.'))}</p>`;
};

/** @param {AppState} state @returns {string} */
const renderAvailability = (state) => {
  const availability = state.pilot.availability;
  const selectedDays = availability.days;
  return `${back('/pilot', t('Pilot workspace'))}${pageHeading(t('Make time for your work'), t('Availability'), '')}<form class="card card-pad form-stack" data-form="availability"><fieldset class="field"><legend>${esc(t('Working days'))}</legend><div class="chips">${WEEK_DAYS.map((day) => `<label class="chip"><input type="checkbox" name="days" value="${day}" ${selectedDays.includes(day) ? 'checked' : ''}> ${esc(t(day.slice(0, 3)))}</label>`).join('')}</div></fieldset><div class="form-grid">${field({ label: 'Start time', name: 'timeStart', type: 'time', value: availability.timeStart })}${field({ label: 'Finish time', name: 'timeEnd', type: 'time', value: availability.timeEnd })}</div><button class="button" type="submit">${esc(t('Save availability'))}</button><p class="muted">${esc(t('Saved locally. This does not reserve or guarantee a live booking slot.'))}</p></form>`;
};

/** @param {AppState} state @returns {string} */
const renderPilotProfile = (state) => `${back('/pilot', t('Pilot workspace'))}${pageHeading(t('Your pilot profile'), state.profile.name || t('Make your introduction'), t('Keep your services, equipment and coverage up to date.'))}<div class="toolbar">${badge(state.pilot.verification)}${link('/onboarding/pilot/verification', esc(t('Credential review')), 'link')}</div>${pilotProfileForm(state, true)}`;

/** @param {AppState} state @param {boolean} isSignIn @returns {string} */
const renderAuth = (state, isSignIn) => `${pageHeading(t('Your Aura workspace'), t(isSignIn ? 'Welcome back' : 'Let’s get growing'), t('Start with a local profile on this device.'))}${notice('Local profile only. Secure cloud sign-in is not connected.')}<form class="card card-pad form-stack" data-form="profile">${profileNameFields(state)}<button class="button" type="submit">${esc(t('Continue on this device'))} ${icon('arrow-right', 18)}</button></form>${link('/onboarding/role', esc(t('Choose my role')), 'link')}`;

/** @param {AppState} state @returns {string} */
const renderAccount = (state) => `${pageHeading(t('A little about you'), t('My account'), '')}<div class="card card-pad"><div class="toolbar"><span class="avatar">${profilePhoto(state.profile)}</span><span class="row-copy"><h2>${esc(state.profile.name)}</h2><p class="muted">${esc(t(state.profile.role === 'pilot' ? 'Drone pilot workspace' : 'Farmer workspace'))}</p></span></div>${profilePhotoUpload()}<div class="chips">${state.profile.roles.map((role) => `<button class="chip ${state.profile.role === role ? 'chip-active' : ''}" data-action="switch-role" data-role="${esc(role)}" aria-pressed="${state.profile.role === role}">${esc(t(role === 'pilot' ? 'Drone pilot' : 'Farmer'))}</button>`).join('')}</div></div><div class="card list">${accountRow('/account/settings', 'settings', 'Preferences', 'Name, language and measurement units')}${accountRow('/onboarding/role', 'user', 'Roles and setup', 'Farm, fly, or do both')}${accountRow('/bookings', 'calendar', 'My bookings', 'Jobs and learning sessions')}${accountRow('/orders', 'shopping-bag', 'My orders', 'Purchase requests and payment status')}${accountRow('/notifications', 'bell', 'Notifications', 'Farm reminders and updates')}</div><button class="button button-secondary" type="button" data-action="install">${icon('device-mobile', 20)} ${esc(t('Add to home screen'))}</button>${notice('Saved on this device. Clearing site data removes your records.')}`;

/** @param {string} href @param {string} iconName @param {string} title @param {string} description @returns {string} */
const accountRow = (href, iconName, title, description) => `<a class="list-row" href="${href}"><span class="row-icon">${icon(iconName)}</span><span class="row-copy"><span class="row-title">${esc(t(title))}</span><span class="row-subtitle">${esc(t(description))}</span></span>${icon('chevron-right', 18)}</a>`;

/** @param {AppState} state @returns {string} */
const renderSettings = (state) => `${back('/account', t('My account'))}${pageHeading(t('Make it yours'), t('Preferences'), '')}<form class="card card-pad form-stack" data-form="settings">${profileNameFields(state)}<label class="field"><span>${esc(t('Preferred area unit'))}</span><select class="input" name="units"><option value="ha" ${state.settings.unit === 'ha' ? 'selected' : ''}>${esc(t('Hectares'))}</option><option value="acre" ${state.settings.unit === 'acre' ? 'selected' : ''}>${esc(t('Acres'))}</option></select></label><label class="field"><span>${esc(t('Language'))}</span><select class="input" name="language">${SUPPORTED_LOCALES.map(({ code, label }) => `<option value="${code}" ${getLocale() === code ? 'selected' : ''}>${label}</option>`).join('')}</select></label><button class="button" type="submit">${esc(t('Save preferences'))}</button></form>`;

/** @param {AppState} state @returns {string} */
/** @param {AppState} state @returns {string} */
const renderPendingNotifications = (state, tasks = state.tasks, isCompleted = false) => state.farms.map((farm) => {
  const assigned = tasks.filter((task) => task.farmId === farm.id);
  const groups = isCompleted ? completedTaskRounds(assigned) : currentTaskRounds(assigned);
  const stacks = groups.map((group) => renderTaskNotificationStack(farm,group,state.tasks)).join('');
  return stacks ? `<section><div class="section-heading"><h2>${esc(farm.name)}</h2></div>${stacks}</section>` : '';
}).join('');

const COUNTDOWN_MINUTE_MS = 60_000;
const COUNTDOWN_HOUR_MINUTES = 60;
const COUNTDOWN_DAY_MINUTES = 1_440;
/** @param {Task} task @param {Date} [now] @returns {string} */
export function taskNextDueLabel(task, now = new Date()) {
  if (!task.repeat || task.repeat === 'none') return `${dateLabel(task.dueDate)} · ${task.time}`;
  const next = task.done ? nextTaskOccurrence(task) : task;
  if (!next) return t('Completed');
  const remaining = new Date(`${next.dueDate}T${next.time}`).getTime() - now.getTime();
  if (!Number.isFinite(remaining)) return t('Scheduled');
  if (remaining < 0) return t('Overdue');
  if (remaining < COUNTDOWN_MINUTE_MS) return t('Due now');
  const minutes = Math.ceil(remaining / COUNTDOWN_MINUTE_MS);
  if (minutes < COUNTDOWN_HOUR_MINUTES) return t(minutes === 1 ? 'Due in 1 minute' : 'Due in {count} minutes', {count:minutes});
  const hours = Math.floor(minutes / COUNTDOWN_HOUR_MINUTES);
  if (minutes < COUNTDOWN_DAY_MINUTES) return t(hours === 1 ? 'Due in 1 hour' : 'Due in {count} hours', {count:hours});
  const days = Math.floor(minutes / COUNTDOWN_DAY_MINUTES);
  return t(days === 1 ? 'Due in 1 day' : 'Due in {count} days', {count:days});
}

/** @param {Task} task @returns {string} */
const taskCompletionLabel = (task) => {
  const timestamp = task.completedAt ? new Date(task.completedAt) : null;
  if (!timestamp || !Number.isFinite(timestamp.getTime())) return t('Completed');
  return `${t('Completed')} · ${timestamp.toLocaleString(getFormatLocale(), {dateStyle:'medium',timeStyle:'short'})}`;
};

const TASK_FIELDS_PREVIEW_LIMIT = 5;
/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
const renderTaskNotificationStack = (farm,tasks,allTasks = tasks) => {
  const rows = tasks.flatMap((task) => {
    const fields = task.plotId ? farm.plots.filter((plot) => plot.id === task.plotId) : farm.plots;
    return (fields.length ? fields : [{id:'',name:farm.name,crop:farm.crop}]).map((field) => ({task,field}));
  });
  const schedule = taskScheduleGroups(allTasks).find((group)=>group.some((item)=>item.id === tasks[0].id)) ?? tasks;
  const cycle = scheduleCycleProgress(schedule,farm.plots);
  const progress = cycle.total === null ? t('Cycle progress needs an end date') : t('Cycle: {done} of {total} field tasks completed',{done:cycle.done,total:cycle.total});
  const first = tasks[0];
  const isCompleted = tasks.every((task) => task.done);
  const latest = [...tasks].sort((a,b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))[0];
  /** @param {{task:Task,field:{id:string,name:string}}[]} items @returns {string} */
  const renderRows = (items) => items.map(({task,field}) => renderTaskFieldRow(farm,task,field,isCompleted)).join('');
  return `<details class="notification-task-stack" data-schedule-group data-notification-stack="${esc(JSON.stringify([farm.id,first.scheduleId ?? first.title,first.dueDate,first.time]))}"><summary><span class="row-icon">${icon('calendar',20)}</span><span class="row-copy"><strong>${esc(first.title)}</strong><span class="row-subtitle">${esc(isCompleted ? taskCompletionLabel(latest) : cycle.total === null ? progress : t('{percent}% of cycle complete',{percent:cycle.percent}))}</span>${isCompleted || cycle.total === null ? '' : `<span class="task-progress ${cycle.done === cycle.total ? 'is-complete' : ''}" role="progressbar" aria-label="${esc(first.title)}" aria-valuemin="0" aria-valuemax="${cycle.total}" aria-valuenow="${cycle.done}" aria-valuetext="${esc(progress)}"><span style="width:${cycle.percent}%"></span></span>`}</span>${icon('chevron-down',18)}</summary><div class="notification-task-fields">${isCompleted ? '' : `<p class="task-round-date">${esc(taskNextDueLabel(tasks.find((task) => !task.done) ?? first))}</p>`}${renderRows(rows.slice(0,TASK_FIELDS_PREVIEW_LIMIT))}${rows.length > TASK_FIELDS_PREVIEW_LIMIT ? `<details class="schedule-tree-more"><summary>${esc(t('Show all fields'))}</summary>${renderRows(rows.slice(TASK_FIELDS_PREVIEW_LIMIT))}</details>` : ''}</div></details>`;
};

/** @param {Farm} farm @param {Task & {isProjected?:boolean}} task @param {{id:string,name:string}} field @returns {string} */
const renderTaskFieldRow = (farm,task,field,isCompleted = false) => {
  const canComplete = !task.isProjected && canCompleteTask(task);
  const status = task.isProjected ? 'upcoming' : notificationTaskStatus(task);
  const label = task.done ? 'Completed' : canComplete ? 'Complete' : 'Scheduled later';
  return `<div class="notification-field-row" data-task-date="${esc(task.dueDate)}" data-task-done="${task.done}"><span class="notification-status-badge is-${status}" role="img" aria-label="${esc(t(task.isProjected ? 'Scheduled later' : notificationTaskStatusLabel(task)))}">${icon(task.done ? 'check' : 'clock',14)}</span><a class="notification-field-name" href="/farm/${esc(farm.id)}/tasks/${esc(task.id)}"><span>${esc(field.name)}</span>${isCompleted && task.completedAt ? `<small class="row-subtitle"><time datetime="${esc(task.completedAt)}">${esc(new Date(task.completedAt).toLocaleTimeString(getFormatLocale(),{hour:'2-digit',minute:'2-digit'}))}</time></small>` : ''}</a><button type="button" class="notification-complete" data-action="complete-task-field" data-id="${esc(task.id)}" data-plot-id="${esc(field.id)}" ${canComplete ? '' : 'disabled'} aria-label="${esc(t(task.done ? 'Completed {title}' : 'Complete {title}',{title:`${task.title} · ${field.name}`}))}">${esc(t(label))}</button></div>`;
};

const renderNotifications = (state) => {
  const pending = renderPendingNotifications(state);
  const completed = renderPendingNotifications(state, state.tasks.filter((task) => task.done), true);
  const pendingReminderIds = new Set(state.tasks.map((task) => `reminder-${task.id}-${task.dueDate}-${task.time}`));
  const notifications = state.notifications.filter((item) => !pendingReminderIds.has(item.id));
  const sortedNotifications = [...notifications].sort((first, second) => second.date.localeCompare(first.date));
  const updates = sortedNotifications.length ? `<section class="notification-updates"><header class="notification-section-header"><h2>${esc(t('Updates'))}</h2><button class="notification-read-action" data-action="mark-notifications-read" ${notifications.every((item) => item.read) ? 'disabled' : ''}>${esc(t('Mark all as read'))}</button></header><div class="notification-list">${sortedNotifications.map((notification) => `<article class="notification-item ${notification.read ? '' : 'is-unread'}"><span class="notification-icon" aria-hidden="true">${icon(notification.id.startsWith('reminder-') ? 'calendar' : 'bell', 20)}</span><div class="notification-copy"><h3>${esc(notificationCopy(notification, state).title)}</h3><p>${esc(notificationCopy(notification, state).body)}</p><time datetime="${esc(notification.date)}">${esc(dateLabel(notification.date))}</time></div>${notification.read ? '' : `<button type="button" class="icon-button notification-mark-read" data-action="mark-notification-read" data-id="${esc(notification.id)}" aria-label="${esc(t('Mark as read'))}" title="${esc(t('Mark as read'))}">${icon('check',20)}</button>`}</article>`).join('')}</div></section>` : '';
  return `<div class="notifications-page">${pageHeading('', t('Notifications'), '')}${pending ? `<section class="notification-pending"><header class="notification-section-header"><h2>${esc(t('Pending'))}</h2><button class="notification-read-action" data-action="mark-notifications-read" ${state.notifications.every((item)=>item.read) ? 'disabled' : ''}>${esc(t('Mark all as read'))}</button></header>${pending}</section>` : ''}${completed ? `<section class="notification-completed"><header class="notification-section-header"><h2>${esc(t('Completed'))}</h2></header>${completed}</section>` : ''}${updates}${!pending && !completed && !updates ? emptyState('You’re all caught up', 'Reminders and saved booking updates will appear here.') : ''}</div>`;
};

/** @param {Order['items']} items @returns {string} */
const orderItems = (items) => `<div class="card list">${items.map((item) => {
  const product = PRODUCTS.find((candidate) => candidate.id === item.productId);
  return `<div class="list-row"><span class="row-icon">${icon('shopping-bag')}</span><span class="row-copy"><span class="row-title">${esc(product ? t(product.name) : t('Unavailable product'))}</span><span class="row-subtitle">${esc(t('Quantity {count}', { count: item.quantity }))}</span></span><span class="row-end">${product ? esc(money(product.price * item.quantity)) : esc(t('Price unavailable'))}</span></div>`;
}).join('')}</div>`;

/** @param {AppState} state @returns {string} */
const renderOrders = (state) => `${pageHeading(t('Your purchases'), t('Orders'), '')}${state.orders.length ? `<div class="card list">${state.orders.map((order) => `<a class="list-row" href="/orders/${esc(order.id)}"><span class="row-icon">${icon('shopping-bag')}</span><span class="row-copy"><span class="row-title">${esc(t('Order {id}', { id: order.id }))}</span><span class="row-subtitle">${esc(dateLabel(order.date))} · ${esc(t('{count} items', { count: order.items.reduce((total, item) => total + item.quantity, 0) }))}</span></span><span class="row-end">${esc(money(order.total))}${badge(order.status)}</span></a>`).join('')}</div>` : emptyState('No orders yet', 'Explore equipment for the next stage of your farm.', '/shop', 'Visit the shop')}`;

/** @param {Order} order @returns {string} */
const renderOrder = (order) => `${back('/orders', t('All orders'))}${pageHeading(t('Order details'), t('Order {id}', { id: order.id }), t('Created {date}', { date: dateLabel(order.date) }))}<div class="toolbar">${badge(order.status)}<strong class="price">${esc(money(order.total))}</strong></div>${orderItems(order.items)}${notice('Order · not sent to a merchant.')}${order.status === 'unpaid' || order.status === 'pending' ? link(`/checkout/${order.id}`, esc(t('Review payment options')), 'button') : ''}`;

/** @param {AppState} state @returns {string} */
const renderCartCheckout = (state) => {
  if (!state.cart.length) return `${pageHeading(t('Checkout'), t('Your cart is empty'))}${emptyState('Find the right equipment', 'Add an item before checking out.', '/shop', 'Browse the shop')}`;
  const total = state.cart.reduce((sum, item) => sum + (PRODUCTS.find((product) => product.id === item.productId)?.price ?? 0) * item.quantity, 0);
  return `${back('/shop/cart', t('Shopping cart'))}${pageHeading(t('One last look'), t('Review your order'), t('Check the items before saving your order.'))}${orderItems(state.cart)}<div class="card card-pad"><div class="toolbar"><span>${esc(t('Total estimate'))}</span><strong class="price">${esc(money(total))}</strong></div><p class="muted">${esc(t('Delivery and any additional fees are not calculated in this preview.'))}</p><button class="button" data-action="create-order">${esc(t('Save unpaid order'))} ${icon('arrow-right', 18)}</button></div>${notice('Saved unpaid on your device. No charge or merchant order.')}`;
};

/** @param {Order} order @param {boolean} isPayment @returns {string} */
const renderCheckout = (order, isPayment) => {
  if (!isPayment) return `${back(`/orders/${order.id}`, t('Order details'))}${pageHeading(t('Checkout'), t('Review your order'), '')}<div class="card card-pad"><div class="toolbar"><span>${esc(t('Order {id}', { id: order.id }))}</span>${badge(order.status)}</div><p class="price">${esc(money(order.total))}</p>${link(`/checkout/${order.id}/payment`, `${icon('credit-card', 18)} ${esc(t('Payment options'))}`, 'button')}</div>${orderItems(order.items)}`;
  return `${back(`/checkout/${order.id}`, t('Order review'))}${pageHeading(t('Payment options'), t('Pay for your order'), t('Order {id}', { id: order.id }))}<div class="card card-pad form-stack"><div class="toolbar"><span>${esc(t('Amount'))}</span><strong class="price">${esc(money(order.total))}</strong></div>${badge(order.status)}<div class="payment-placeholder">${icon('qrcode', 56)}<h2>${esc(t('Scan to pay is not connected'))}</h2><p>${esc(t('Available when a payment provider is connected.'))}</p></div><p class="muted">${esc(t('Simulate a result below. No money moves.'))}</p><button class="button button-secondary" data-action="demo-payment" data-id="${esc(order.id)}" ${order.status === 'demo-paid' ? 'disabled' : ''}>${esc(t('Simulate successful payment'))}</button></div>${notice('No payable code or funds collected.')}`;
};

/** @param {Farm} farm @returns {string} */
const renderLandSetupComplete = (farm) => `${pageHeading('', t('You’re all set.'), t('Your land and fields are saved on this device.'))}<section class="card card-pad form-stack land-setup-confirmation"><h2>${esc(farm.name)}</h2><p class="muted">${esc(t(farm.plots.length === 1 ? '{count} field ready' : '{count} fields ready', { count: farm.plots.length }))}</p><h2>${esc(t('Want to plan your first task?'))}</h2><div class="onboarding-role-actions"><a class="button" href="/farm/${esc(farm.id)}/schedule?plan=1">${esc(t('Plan a task'))}</a><a class="button button-secondary" href="/farm/${esc(farm.id)}">${esc(t('Skip for now'))}</a></div></section>`;

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
const schedulerLand = (farm, tasks) => {
  const assignedTasks = tasks.filter((task) => task.farmId === farm.id);
  return `<section class="scheduler-land"><a class="list-row" href="/farm/${esc(farm.id)}/schedule"><span class="row-icon">${icon('calendar')}</span><span class="row-copy"><strong class="row-title">${esc(farm.name)}</strong><span class="row-subtitle">${esc(t(assignedTasks.length === 1 ? '{count} task' : '{count} tasks', { count: assignedTasks.length }))}</span></span>${icon('chevron-right', 18)}</a>${scheduleTree(farm,assignedTasks)}${assignedTasks.some((task) => task.done) ? `<details class="schedule-completed"><summary>${esc(t('Completed'))} ${icon('chevron-down',18)}</summary>${completedTaskRounds(assignedTasks).map((group) => renderTaskNotificationStack(farm,group,assignedTasks)).join('')}</details>` : ''}</section>`;
};

/** @param {AppState} state @returns {string} */
const renderScheduler = (state) => {
  if (state.farms.length === 1) return renderSchedule(state.farms[0], state);
  if (!state.farms.length) return `${pageHeading('', t('Scheduler'))}${emptyState('Add your land first', 'Create a land record to start scheduling tasks.', '/farm/new', 'Add land')}`;
  return `${pageHeading('', t('Scheduler'))}<div class="section-stack">${state.farms.map((farm) => schedulerLand(farm, state.tasks)).join('')}</div>`;
};

/** @param {string[]} parts @param {AppState} state @returns {string|null} */
const farmRoute = (parts, state) => {
  if (parts[0] === 'schedule' && parts.length === 1) return renderScheduler(state);
  if (parts[0] === 'weather' && parts.length === 1) return renderWeather();
  if (parts[0] === 'weather' && parts.length === 2) {
    return renderWeather();
  }
  if (parts[0] !== 'farm') return null;
  if (parts.length === 1) return renderFarms(state);
  if (parts[1] === 'new' && parts.length === 2) return renderLandEditor();
  const farm = state.farms.find((item) => item.id === parts[1]);
  if (!farm) return missing('Farm not found', '/farm');
  if (parts[2] === 'setup-complete' && parts.length === 3) return renderLandSetupComplete(farm);
  if (parts[2] === 'edit' && parts.length === 3) return renderLandEditor(farm);
  if (parts[2] === 'fields' && parts[3] === 'setup') return renderLandSetup(farm);
  if (parts.length === 2) return renderFarm(farm, state);
  if (parts[2] === 'history' && parts.length === 3) return renderLandHistory(farm,state);
  if (parts[2] === 'schedule' && parts.length === 3) return renderSchedule(farm, state);
  if (parts[2] === 'plots' && parts.length === 4) return renderPlot(farm, parts[3], state);
  if (parts[2] !== 'tasks' || parts.length !== 4) return null;
  const task = state.tasks.find((item) => item.id === parts[3] && item.farmId === farm.id);
  return task ? renderTask(farm, task) : missing('Task not found', `/farm/${farm.id}/schedule`);
};

/** @param {string[]} parts @param {AppState} state @returns {string|null} */
const bookingRoute = (parts, state) => {
  if (parts[0] === 'messages' && parts.length === 2) {
    if (parts[1] === 'new') return `${back('/messages', t('Messages'))}${pageHeading('', t('New chat'))}<form class="form-stack" data-form="conversation"><label class="field">${esc(t('Name'))}<input name="name" maxlength="100" required autocomplete="off"></label><button class="button" type="submit">${esc(t('Start a conversation'))}${icon('arrow-up-right',18)}</button></form>`;
    const chat = state.chats?.find((item) => item.id === parts[1]);
    return chat ? renderChat(chat) : missing('Conversation not found', '/messages');
  }
  if (parts[0] !== 'bookings') return null;
  if (parts.length === 1) return renderBookings(state);
  const booking = state.bookings.find((item) => item.id === parts[1]);
  if (!booking) return missing('Booking not found', '/bookings');
  if (parts.length === 2) return renderBooking(booking, state);
  return parts.length === 3 && parts[2] === 'chat' ? renderChat(booking) : null;
};

/** @param {string[]} parts @param {AppState} state @returns {string|null} */
const orderRoute = (parts, state) => {
  if (parts[0] !== 'orders' && parts[0] !== 'checkout') return null;
  if (parts[0] === 'orders' && parts.length === 1) return renderOrders(state);
  if (parts[0] === 'checkout' && parts[1] === 'cart' && parts.length === 2) return renderCartCheckout(state);
  const order = state.orders.find((item) => item.id === parts[1]);
  if (!order) return missing('Order not found', '/orders');
  if (parts[0] === 'orders') return parts.length === 2 ? renderOrder(order) : null;
  if (parts.length === 2) return renderCheckout(order, false);
  return parts.length === 3 && parts[2] === 'payment' ? renderCheckout(order, true) : null;
};

/** @param {string} path @param {AppState} state @returns {string|null} */
const fixedRoute = (path, state) => {
  const routes = {
    '/messages': renderMessages,
    '/onboarding/role': renderRoles,
    '/onboarding/farmer': renderFarmerOnboarding,
    '/onboarding/pilot': renderPilotOnboarding,
    '/onboarding/pilot/verification': renderVerification,
    '/pilot': renderPilotHome,
    '/pilot/requests': renderPilotRequests,
    '/pilot/availability': renderAvailability,
    '/pilot/profile': renderPilotProfile,
    '/account': renderAccount,
    '/account/settings': renderSettings,
    '/notifications': renderNotifications,
  };
  if (path === '/auth/sign-in' || path === '/auth/sign-up') return renderAuth(state, path === '/auth/sign-in');
  return Object.hasOwn(routes, path) ? routes[path](state) : null;
};

/** @param {string} path @param {AppState} state @returns {string|null} */
export function renderWorkspace(path, state) {
  state = localizeDemoState(state);
  const parts = path.split('/').filter(Boolean);
  return fixedRoute(path, state) ?? farmRoute(parts, state) ?? bookingRoute(parts, state) ?? orderRoute(parts, state);
}

/** @param {string} action @param {string} label @param {string} iconName @param {boolean} [isDisabled] @returns {string} */
const landMapButton = (action, label, iconName, isDisabled = false) => `<button type="button" class="land-map-button" data-land-action="${action}" aria-label="${esc(t(label))}" title="${esc(t(label))}" ${isDisabled ? 'disabled' : ''}>${icon(iconName, 20)}</button>`;

/** @param {Farm} farm @param {string} [plotId] @returns {string} */
const renderFarmMap = (farm, plotId = '') => `<section class="farm-map" data-farm-map="${esc(farm.id)}" data-plot-id="${esc(plotId)}" aria-label="${esc(t('Land map'))}"><div class="land-map-canvas" data-land-canvas aria-label="${esc(t('Interactive land map'))}"></div><div class="land-map-toolbar" role="toolbar" aria-label="${esc(t('Land map'))}">${landMapButton('locate', 'Use my location', 'map-pin')}<label class="map-type-control"><span class="sr-only">${esc(t('Map type'))}</span><select data-map-type aria-label="${esc(t('Map type'))}"><option value="street">${esc(t('Street'))}</option><option value="satellite">${esc(t('Satellite'))}</option></select></label>${landMapButton('edit', 'Edit field', 'pencil')}${landMapButton('delete', 'Delete field', 'trash')}<div class="land-map-tools" data-land-tools hidden>${landMapButton('center', 'Add corner at map center', 'crosshair')}${landMapButton('undo', 'Undo corner', 'arrow-left', true)}${landMapButton('clear', 'Start over', 'refresh')}${landMapButton('cancel', 'Cancel', 'x')}</div></div><div class="land-field-picker"><label><span class="sr-only">${esc(t('Select field'))}</span><select data-field-select aria-label="${esc(t('Select field'))}">${farm.plots.map((plot) => `<option value="${esc(plot.id)}" ${plot.id === plotId ? 'selected' : ''}>${esc(plot.name)} · ${esc(plot.crop)}</option>`).join('')}</select></label></div>${renderFieldSheet()}<dialog class="install-dialog" data-field-delete-dialog aria-labelledby="field-delete-title" aria-describedby="field-delete-copy"><h2 id="field-delete-title">${esc(t('Delete field'))}</h2><p id="field-delete-copy" data-field-delete-copy></p><div class="toolbar"><button class="button button-secondary" data-land-action="cancel-delete" autofocus>${esc(t('Cancel'))}</button><button class="button" data-land-action="confirm-delete">${esc(t('Delete field'))}</button></div></dialog><p class="sr-only" role="status" aria-live="polite" data-land-status></p></section>`;

/** @returns {string} */
const renderFieldSheet = () => `<div class="field-sheet" data-field-details hidden role="dialog" aria-modal="false" aria-labelledby="field-sheet-title"><div class="field-sheet-handle" aria-hidden="true"></div><div class="field-sheet-heading"><span class="muted" data-field-progress></span><button type="button" class="icon-button" data-land-action="cancel" aria-label="${esc(t('Cancel'))}">${icon('x', 20)}</button></div><h2 id="field-sheet-title" tabindex="-1" data-field-title></h2><div data-field-step="boundary"><p class="muted" data-field-corners></p></div><div data-field-step="name" hidden><label class="sr-only" for="field-sheet-name">${esc(t('Field name'))}</label><input id="field-sheet-name" class="input" data-field-name maxlength="80" autocomplete="off" placeholder="${esc(t('e.g. East field'))}"></div><div data-field-step="crop" hidden><div class="field-crop-choices">${['Rice', 'Coconut', 'Oil palm', 'Vegetables', 'Other'].map((crop) => `<button type="button" class="field-crop-choice" data-field-crop-choice="${crop}" aria-pressed="false">${esc(t(crop))}</button>`).join('')}</div><label data-field-other hidden><span class="sr-only">${esc(t('Crop'))}</span><input class="input" data-field-crop maxlength="80" autocomplete="off" placeholder="${esc(t('Crop name'))}"></label></div><div data-field-step="review" hidden><dl class="field-review"><div><dt>${esc(t('Field name'))}</dt><dd data-field-review-name></dd></div><div><dt>${esc(t('Crop'))}</dt><dd data-field-review-crop></dd></div><div><dt>${esc(t('Estimated area'))}</dt><dd data-field-review-area></dd></div></dl><p class="muted field-review-note">${esc(t('New field area is estimated from its corners and included in the farm total.'))}</p></div><p class="field-sheet-error" role="status" aria-live="polite" data-field-error hidden></p><div class="field-sheet-actions"><button type="button" class="button button-secondary" data-land-action="back" hidden>${esc(t('Back'))}</button><button type="button" class="button" data-land-action="next">${esc(t('Continue'))}</button><button type="button" class="button" data-land-action="save" hidden>${esc(t('Save field'))}</button></div></div>`;

/** @param {Farm} farm @returns {string} */
const renderLandOverview = (farm) => `<section class="farm-map" data-farm-map="${esc(farm.id)}" data-land-overview="true" aria-label="${esc(t('Land map'))}"><div class="land-map-canvas" data-land-canvas aria-label="${esc(t('Interactive land map'))}"></div><div class="land-map-toolbar land-overview-controls" role="toolbar" aria-label="${esc(t('Land map'))}"><label class="map-type-control"><span class="sr-only">${esc(t('Map type'))}</span><select data-map-type aria-label="${esc(t('Map type'))}"><option value="street">${esc(t('Street'))}</option><option value="satellite">${esc(t('Satellite'))}</option></select></label><a class="icon-button land-overview-edit" href="/farm/${esc(farm.id)}/edit" aria-label="${esc(t('Edit land'))}" title="${esc(t('Edit land'))}">${icon('pencil', 20)}</a><button type="button" class="icon-button land-map-expand" data-map-expand aria-expanded="false" aria-label="${esc(t('Expand map'))}" title="${esc(t('Expand map'))}">${icon('arrows-maximize', 20)}</button></div><p class="sr-only" role="status" data-land-status></p></section><p class="field-task-legend">${[['#075bea', 'Scheduled later'], ['#d99119', 'Due within 2 hours'], ['#d64747', 'Overdue'], ['#25875c', 'All done today!'], ['#87948e', 'No tasks today']].map(([color, label]) => `<span><i class="task-state-dot" style="--task-state-color:${color}" aria-hidden="true"></i>${esc(t(label))}</span>`).join('')}<span>${esc(t('Tap a crop to see its tasks'))}</span></p>`;

/** @param {ParentNode} root @returns {void} */
export function initializeChatComposer(root) {
  const textarea = root.querySelector('.chat-composer textarea');
  if (!textarea) return;
  textarea.addEventListener('keydown', (event) => {
    const keyboard = /** @type {KeyboardEvent} */ (event);
    if (keyboard.key !== 'Enter' || keyboard.shiftKey || keyboard.isComposing || keyboard.keyCode === 229 || keyboard.repeat) return;
    keyboard.preventDefault();
    if (!textarea.value.trim()) return;
    textarea.form?.requestSubmit();
  });
}

/** @param {Booking} booking @param {typeof fetch} [fetchImpl] @returns {Promise<string[]>} */
export async function requestChatReply(booking, fetchImpl = fetch) {
  if (booking.expertId) return [];
  const response = await fetchImpl('/api/mock-chat', {
    method:'POST', headers:{ 'Content-Type':'application/json' }, signal:AbortSignal.timeout(25000),
    body:JSON.stringify({ locale:getLocale(), providerId:booking.providerId, name:conversationName(booking), messages:booking.conversation.slice(-12).map(({ sender, text }) => ({ sender, text })) }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Could not get a reply.');
  if (!Array.isArray(payload.messages) || !payload.messages.length || payload.messages.length > 3 || payload.messages.some((text) => typeof text !== 'string' || !text.trim() || text.length > 2000)) throw new Error('The reply could not be read.');
  return payload.messages;
}

/** @param {Booking} booking @param {string} messageId @param {string[]} messages @returns {boolean} */
export function appendChatReply(booking, messageId, messages) {
  if (booking.conversation.at(-1)?.id !== messageId) return false;
  booking.conversation.push(...messages.map((text) => ({ id:createRecordId(), sender:conversationName(booking), text, date:new Date().toISOString() })));
  return true;
}

/** @param {HTMLElement} indicator @param {typeof import('gsap').gsap|undefined} gsap @returns {()=>void} */
export function animateChatTyping(indicator, gsap) {
  if (!indicator || indicator.hidden || !gsap) return () => {};
  const dots = indicator.querySelectorAll('.chat-typing-dots > span');
  const media = gsap.matchMedia();
  media.add('(prefers-reduced-motion: no-preference)', () => {
    gsap.fromTo(dots, {y:0,opacity:0.45}, {
      y:-4,opacity:1,duration:0.32,ease:'sine.inOut',
      stagger:{each:0.14,repeat:-1,yoyo:true,repeatDelay:0.12},
    });
  });
  return () => media.revert();
}

/** @param {HTMLElement} root @returns {void} */
export function initializeNotificationStacks(root) {
  root.querySelectorAll('.notification-task-stack, .schedule-tree, .schedule-completed').forEach((stack) => {
    if (stack.dataset.motionBound) return;
    stack.dataset.motionBound = 'true';
    stack.addEventListener('toggle', () => {
      const content = stack.querySelector('.notification-task-fields, .schedule-tree-fields, .schedule-field-list');
      window.gsap?.killTweensOf(content);
      if (stack.open && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        window.gsap?.fromTo(content,{opacity:0,y:-4},{opacity:1,y:0,duration:0.18,ease:'power2.out',clearProps:'opacity,transform'});
      }
    });
  });
}

/** @param {Task} task @param {Date} [now] @returns {string} */
export function notificationTaskStatus(task, now = new Date()) {
  return task.done ? 'completed' : fieldTaskUrgency([task],task.farmId,task.plotId,now).urgency;
}
/** @param {Task} task @returns {string} */
const notificationTaskStatusLabel = (task) => ({completed:'Completed',overdue:'Overdue',soon:'Due within 2 hours',upcoming:'Scheduled later',idle:'Pending'}[notificationTaskStatus(task)]);

/** @param {Farm} farm @param {AppState} state @returns {string} */
const renderLandHistory = (farm,state) => {
  const tasks = state.tasks.filter((task)=>task.farmId === farm.id);
  const records = completedTaskList(farm, tasks);
  const content = records ? `<section class="schedule-history-list" aria-labelledby="history-completed-title"><h2 id="history-completed-title">${esc(t('Completed'))}</h2>${records}</section>` : `<section class="schedule-history-empty">${icon('circle-check',32)}<h2>${esc(t('No task history yet.'))}</h2><p>${esc(t('Completed tasks will appear here.'))}</p></section>`;
  return `<div class="schedule-history-page">${back(`/farm/${farm.id}/schedule`,t('Land schedule'))}<div class="schedule-history-header">${pageHeading('',t('Schedule history'),farm.name)}<a class="icon-button history-calendar-shortcut" href="/farm/${esc(farm.id)}/schedule" aria-label="${esc(t('View full calendar'))}" title="${esc(t('View full calendar'))}">${icon('calendar',22)}</a></div>${content}</div>`;
};

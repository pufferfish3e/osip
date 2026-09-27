import { renderFieldCareSheet } from './field-care.mjs';
import { landCover } from './land-covers.mjs';
import { cropEmoji } from './land-map.mjs';
import { isLandBoundary } from './land-boundary.mjs';
import { renderLandEditor } from './land-editor.mjs';
import { renderLandSetup } from './land-setup.mjs';
import { calendarDate } from './schedule.mjs';
import { COURSES, PILOTS, PRODUCTS, WEATHER } from './data.mjs';
import { getFormatLocale, getLocale, SUPPORTED_LOCALES, t } from './i18n.mjs';
import { escapeHtml as esc, localizeDemoState, icon, pageHeading, emptyState, profilePhoto } from './ui.mjs';

/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {AppState['farms'][number] & {isDemo?:boolean}} Farm */
/** @typedef {AppState['tasks'][number]} Task */
/** @typedef {AppState['bookings'][number] & {direction?:string,rescheduleRequest?:{date:string,time:string}}} Booking */
/** @typedef {AppState['orders'][number]} Order */

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
  return `<a class="media-card learning-photo-card farm-card" href="/farm/${esc(farm.id)}"><img class="media-image" src="${esc(landCover(farm, state.farms.findIndex((land) => land.id === farm.id)))}" alt="" width="1200" height="800" loading="lazy"><div class="learning-photo-body"><div class="farm-card-heading"><h2>${esc(farm.name)}</h2></div><p class="farm-card-meta learning-photo-meta">${farm.isDemo || farm.id === 'farm-1' ? `${esc(t('Land'))} · ` : ''}${esc(farm.crop)} · ${esc(String(farm.area))} ${esc(t(farm.unit ?? 'ha'))} · ${esc(t(remainingTasks === 1 ? '{count} task' : '{count} tasks', { count: remainingTasks }))}</p><div class="learning-photo-footer"><span class="button">${esc(t('View my land'))}${icon('arrow-up-right', 18)}</span></div></div></a>`;
};

/** @param {AppState} state @returns {string} */
const renderFarms = (state) => `${pageHeading('', t('My land'))}<div class="section-stack"><div class="card-grid">${state.farms.map((farm) => farmCard(farm, state)).join('')}</div><a class="button" href="/farm/new">${icon('plus', 18)} ${esc(t('Add land'))}</a></div>`;

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
/** @param {Farm} farm @param {Task} task @returns {string} */
const taskAssignment = (farm, task) => {
  const assigned = farm.plots.find((plot) => plot.id === task.plotId);
  return assigned ? `${assigned.name} · ${assigned.crop}` : t('Whole land');
};
const taskList = (farm, tasks) => tasks.length ? `<div class="card list">${tasks.map((task) => `<div class="list-row" data-task-date="${esc(task.dueDate)}" data-task-done="${task.done}"><button class="task-check ${task.done ? 'is-complete' : ''}" type="button" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${esc(t(task.done ? 'Reopen {title}' : 'Complete {title}', { title: task.title }))}" aria-pressed="${task.done}">${task.done ? icon('check', 16) : ''}</button><a class="row-copy" href="/farm/${esc(farm.id)}/tasks/${esc(task.id)}"><span class="row-title">${esc(task.title)}</span><span class="row-subtitle">${esc(dateLabel(task.dueDate))} · ${esc(task.time)} · ${esc(t(task.category))} · ${esc(taskAssignment(farm, task))}${task.repeat && task.repeat !== 'none' ? ` · ${esc(t({ daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }[task.repeat]))}` : ''}</span></a>${task.reminder ? `<span class="muted" aria-label="${esc(t('Reminder enabled'))}">${icon('bell', 18)}</span>` : ''}</div>`).join('')}</div>` : emptyState('Your schedule is clear', 'Add a task below to plan your next job.');

/** @param {string} [repeat] @returns {string} */
const repeatPicker = (repeat = 'none') => `<fieldset class="task-repeat-picker"><legend>${esc(t('Repeat'))}</legend>${[['none', 'Never'], ['daily', 'Daily'], ['weekly', 'Weekly'], ['monthly', 'Monthly']].map(([value, label]) => `<label class="task-repeat-choice"><input type="radio" name="repeat" value="${value}" ${repeat === value ? 'checked' : ''}><span>${esc(t(label))}</span></label>`).join('')}</fieldset><p class="muted task-repeat-note">${esc(t('The next occurrence is created when you complete this task.'))}</p>`;

/** @param {Farm} farm @param {Task[]} tasks @returns {string} */
const plotsList = (farm, tasks) => {
  const plots = farm.plots ?? [];
  return plots.length ? `<div class="card list">${plots.map((plot) => `<a class="list-row" href="/farm/${esc(farm.id)}/plots/${esc(plot.id)}"><span class="row-icon field-list-emoji" aria-hidden="true">${cropEmoji(plot.crop)}</span><span class="row-copy"><span class="row-title">${esc(plot.name)}</span><span class="row-subtitle">${esc(plot.crop)} · ${esc(String(plot.area))} ${esc(t('ha'))}</span>${fieldReminder(plot.id, tasks)}</span>${icon('chevron-right', 18)}</a>`).join('')}</div>` : emptyState('No fields recorded yet', 'Your land’s crop and area are saved above.');
};

/** @param {Farm} farm @param {AppState} state @returns {string} */
const renderFarm = (farm, state) => {
  const tasks = state.tasks.filter((task) => task.farmId === farm.id);
  const remainingTasks = tasks.filter((task) => !task.done);
  const completedTasks = tasks.filter((task) => task.done);
  const isSetupComplete = farm.plots.length > 0 && farm.plots.every((plot) => isLandBoundary(plot.boundary) && plot.crop?.trim());
  const landView = isSetupComplete ? renderLandOverview(farm) : renderLandEditor(farm, true);
  return `${back('/farm', t('All land'))}${pageHeading(farm.location, farm.name, `${farm.crop}${farm.isDemo || farm.id === 'farm-1' ? ` · ${t('Land')}` : ''}`)}${landView}<div data-schedule="${esc(farm.id)}"><button type="button" data-plan-task hidden></button>${renderTaskSheet(farm)}${renderFieldCareSheet()}</div><div class="card card-pad land-summary"><div class="stat-grid">${stat('Total area', `${farm.area} ${t(farm.unit ?? 'ha')}`)}${stat('Fields', String(farm.plots.length))}${stat('Crop types', String(new Set(farm.plots.map((plot) => plot.crop.trim().toLowerCase()).filter(Boolean)).size))}</div><div class="toolbar">${link(`/farm/${farm.id}/schedule`, `${icon('calendar', 18)} ${esc(t('Open schedule'))}`, 'button')}${link(`/weather/${farm.id}`, `${icon('cloud', 18)} ${esc(t('Local weather'))}`)}</div></div>${section('Your fields', `<div class="section-stack">${plotsList(farm, tasks)}</div>`)}${section('Next on your land', taskList(farm, remainingTasks.slice(0, 4)), link(`/farm/${farm.id}/schedule`, esc(t('View all')), 'link'))}${completedTasks.length ? section('Completed', taskList(farm, completedTasks.slice(-4).reverse()), link(`/farm/${farm.id}/schedule`, esc(t('View all')), 'link')) : ''}`;
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
  const overdue = tasks.filter((task) => !task.done && task.dueDate < today);
  return `${back(`/farm/${farm.id}`, farm.name)}${pageHeading('', t('Land schedule'), farm.name)}<div data-schedule="${esc(farm.id)}"><section class="schedule-calendar card card-pad" aria-label="${esc(t('Land schedule'))}" data-schedule-calendar></section><div class="toolbar schedule-agenda-heading"><h2 data-agenda-title></h2><button type="button" class="button" data-plan-task>${icon('plus', 18)} ${esc(t('Plan a task'))}</button></div><div data-agenda>${tasks.length ? taskList(farm, tasks) : ''}</div><p class="muted" data-agenda-empty hidden>${esc(t(tasks.length ? 'No tasks on this date. Choose a highlighted date to see your scheduled tasks.' : 'Your schedule is clear'))}</p>${overdue.length ? section('Overdue', taskList(farm, overdue)) : ''}${renderTaskSheet(farm)}</div>`;
};

/** @param {string} plotId @param {Task[]} tasks @returns {string} */
const fieldReminder = (plotId, tasks) => {
  const next = tasks.filter((task) => task.plotId === plotId && !task.done).sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`))[0];
  return `<span class="row-subtitle">${next ? `${esc(next.title)} · ${esc(dateLabel(next.dueDate))} · ${esc(next.time)}` : esc(t('No field tasks scheduled'))}</span>`;
};

/** @param {Farm} farm @param {string} plotId @returns {string} */
const fieldSelection = (farm, plotId) => `<fieldset class="task-field-selection"><legend>${esc(t('Field'))}</legend><div class="task-field-pills">${[{ id: '', name: t('Whole land') }, ...farm.plots].map((plot) => `<label class="task-field-pill"><input type="checkbox" name="plotIds" value="${esc(plot.id)}" ${plot.id === plotId ? 'checked' : ''}><span>${esc(plot.name)}</span></label>`).join('')}</div></fieldset>`;

/** @param {Farm} farm @param {Task} [task] @param {string} [plotId] @returns {string} */
const renderTaskSheet = (farm, task, plotId = task?.plotId ?? '') => `<dialog class="task-sheet" aria-labelledby="task-sheet-title"><form data-form="task">${hidden('farmId', farm.id)}${hidden('dueDate', task?.dueDate ?? '')}${task ? hidden('id', task.id) : ''}<div class="task-sheet-heading"><span class="muted" data-task-progress></span><button type="button" class="icon-button" data-task-close aria-label="${esc(t('Cancel'))}">${icon('x', 20)}</button></div><div data-task-step><h2 id="task-sheet-title">${esc(t('Choose a date'))}</h2><div data-task-picker></div></div><div data-task-step hidden><h2>${esc(t('What needs doing?'))}</h2>${field({ label: 'Task name', name: 'title', value: task?.title ?? '', placeholder: 'e.g. Check irrigation channels' })}${select('category', 'Category', TASK_CATEGORIES, task?.category ?? 'General')}${fieldSelection(farm, plotId)}</div><div data-task-step hidden><h2>${esc(t('Choose a time'))}</h2>${field({ label: 'Time', name: 'time', type: 'time', value: task?.time ?? '08:00' })}${checkbox('reminder', 'Show a reminder in my notifications', task?.reminder ?? true)}</div><div data-task-step hidden><h2>${esc(t('Does this repeat?'))}</h2>${repeatPicker(task?.repeat ?? 'none')}</div><div data-task-step hidden><h2>${esc(t('Review your task'))}</h2><dl class="field-review">${['Task name', 'Date', 'Time', 'Category', 'Repeat', 'Field'].map((label) => `<div><dt>${esc(t(label))}</dt><dd data-task-review></dd></div>`).join('')}</dl><p class="muted">${esc(t('In-app reminders only. Background alerts are not connected.'))}</p></div><div class="task-sheet-actions"><button type="button" class="button button-secondary" data-task-back hidden>${esc(t('Back'))}</button><button type="button" class="button" data-task-next>${esc(t('Continue'))}</button><button type="submit" class="button" hidden>${esc(t(task ? 'Save changes' : 'Add to schedule'))}</button></div></form></dialog>`;

/** @param {Farm} farm @param {Task} task @returns {string} */
const renderTask = (farm, task) => `${back(`/farm/${farm.id}/schedule`, t('Land schedule'))}${pageHeading(t(task.category), task.title, farm.name)}<div data-schedule="${esc(farm.id)}"><div class="card card-pad"><div class="stat-grid">${stat('Date', task.dueDate)}${stat('Time', task.time)}${stat('Field', taskAssignment(farm, task))}</div></div><div class="toolbar"><button class="button" data-plan-task>${icon('pencil', 18)} ${esc(t('Edit task'))}</button><button class="button button-secondary" data-action="toggle-task" data-id="${esc(task.id)}">${esc(t(task.done ? 'Reopen task' : 'Mark complete'))}</button><button class="button button-secondary land-delete-button" data-action="delete-task" data-id="${esc(task.id)}">${icon('trash', 18)} ${esc(t('Delete task'))}</button></div>${renderTaskSheet(farm, task)}</div>`;

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
const renderWeather = (farm) => `${back(`/farm/${farm.id}`, farm.name)}<div class="forecast-panel"><header class="forecast-hero"><div><h1>${esc(t(WEATHER.location))}</h1><p class="forecast-temperature">${WEATHER.temperature}<span>°C</span></p><p>${esc(t(WEATHER.condition))}</p><p>${esc(t('High'))}: ${WEATHER.daily[0].high}° · ${esc(t('Low'))}: ${WEATHER.daily[0].low}°</p></div><span class="forecast-symbol" aria-hidden="true">⛅</span></header><p class="forecast-source">${esc(t('Sample forecast · not live'))}</p><div class="forecast-metrics">${weatherMetric('Wind speed', 'wind', WEATHER.windSpeed, 'km/h', WEATHER.hourly.map((hour) => hour.windSpeed), t('From {direction}', { direction: t(WIND_DIRECTIONS[WEATHER.windDirection]) }))}${weatherMetric('Rain chance', 'cloud-rain', WEATHER.rainChance, '%', WEATHER.hourly.map((hour) => hour.rainChance))}${weatherMetric('Humidity', 'droplet', WEATHER.humidity, '%', WEATHER.hourly.map((hour) => hour.humidity))}</div><div class="forecast-days">${WEATHER.daily.map((day) => `<div><span>${esc(t(day.day))}</span>${icon(day.rainChance > 50 ? 'cloud-rain' : 'cloud', 22)}<span>${day.high}° <span class="forecast-low">${day.low}°</span></span></div>`).join('')}</div></div>`;

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
const bookingRow = (booking) => `<a class="list-row" href="/bookings/${esc(booking.id)}"><span class="row-icon">${icon(booking.type === 'course' ? 'school' : 'drone')}</span><span class="row-copy"><span class="row-title">${esc(bookingTitle(booking))}</span><span class="row-subtitle">${esc(dateLabel(booking.date))} · ${esc(booking.time)}</span></span><span class="row-end">${badge(booking.status)}${icon('chevron-right', 16)}</span></a>`;

/** @param {AppState} state @returns {string} */
const renderBookings = (state) => `${pageHeading(t('Your plans, together'), t('Bookings'), '')}<div class="toolbar">${link('/services/pilots', `${icon('drone', 18)} ${esc(t('Find a pilot'))}`, 'button')}${link('/learn/courses', `${icon('school', 18)} ${esc(t('Browse courses'))}`)}</div>${state.bookings.length ? `<div class="card list">${state.bookings.map(bookingRow).join('')}</div>` : emptyState('Nothing booked yet', 'Find a pilot for your next job or make time to learn a new technique.', '/services/pilots', 'Explore drone pilots')}`;

/** @param {Booking} booking @returns {string} */
const rescheduleForm = (booking) => `<form class="card card-pad form-stack" data-form="reschedule">${hidden('bookingId', booking.id)}<h3>${esc(t('Propose another time'))}</h3><div class="form-grid">${field({ label: 'Preferred date', name: 'date', type: 'date', value: booking.date })}${field({ label: 'Preferred time', name: 'time', type: 'time', value: booking.time })}</div><p class="muted">${esc(t('The agreed time changes only after the provider confirms.'))}</p><button type="submit" class="button button-secondary">${esc(t('Request schedule change'))}</button></form>`;

/** @param {Booking} booking @param {AppState} state @returns {string} */
const renderBooking = (booking, state) => {
  const farm = state.farms.find((item) => item.id === booking.farmId);
  const pilot = PILOTS.find((item) => item.id === booking.providerId);
  const isActive = OPEN_BOOKING_STATUSES.includes(booking.status);
  return `${back('/bookings', t('All bookings'))}${pageHeading(t(booking.type === 'course' ? 'Course booking' : 'Drone booking'), bookingTitle(booking), t('Reference {id}', { id: booking.id }))}<div class="card card-pad form-stack"><div class="toolbar">${badge(booking.status)}<span class="muted">${esc(t('Booking'))}</span></div><div class="stat-grid">${stat('Date', dateLabel(booking.date))}${stat('Time', booking.time)}${stat(booking.type === 'course' ? 'Course fee' : 'Estimate', booking.type === 'course' ? t('Free') : money(booking.price))}</div>${farm ? `<p>${icon('map-pin', 18)} ${esc(farm.name)} · ${esc(farm.location)}</p>` : ''}${pilot ? `<p>${esc(t('With {name}', { name: pilot.name }))}</p>` : ''}${booking.notes ? `<p>${esc(booking.notes)}</p>` : ''}${booking.rescheduleRequest ? notice(t('Schedule change requested: {date} at {time}. Awaiting provider confirmation.', { date: dateLabel(booking.rescheduleRequest.date), time: booking.rescheduleRequest.time })) : ''}<div class="toolbar">${link(`/bookings/${booking.id}/chat`, `${icon('message-circle', 18)} ${esc(t('Open conversation'))}`, 'button')}${isActive ? `<button class="button button-secondary" data-action="cancel-booking" data-id="${esc(booking.id)}">${esc(t('Cancel booking'))}</button>` : ''}</div></div>${notice('No provider contacted or reservation made.')}${isActive ? rescheduleForm(booking) : ''}`;
};

/** @param {Booking} booking @returns {string} */
const conversationName = (booking) => PILOTS.find((pilot) => pilot.id === booking.providerId)?.name ?? bookingTitle(booking);
/** @returns {string} */
const conversationAvatar = () => '<img class="chat-avatar" src="/assets/avatar-default.svg" alt="" width="50" height="50">';
/** @param {Booking} booking @returns {string} */
const renderChat = (booking) => {
  const name = conversationName(booking);
  const messages = booking.conversation ?? [];
  return `<section class="chat-screen"><header class="chat-header"><a class="icon-button" href="/messages" aria-label="${esc(t('Messages'))}">${icon('arrow-left',22)}</a>${conversationAvatar()}<div class="row-copy"><h1>${esc(name)}</h1></div><a class="icon-button" href="/bookings/${esc(booking.id)}" aria-label="${esc(t('Booking details'))}">${icon('calendar',22)}</a></header><div class="message-list chat-history" role="log" aria-label="${esc(t('Booking conversation'))}" aria-live="polite">${messages.length ? messages.map((message) => `<article class="message-bubble ${message.sender === 'you' ? 'message-own' : 'message-received'}"><span class="sr-only">${esc(message.sender === 'you' ? t('You') : message.sender)}</span><p>${esc(message.text)}</p><time datetime="${esc(message.date)}">${esc(dateLabel(message.date))}</time></article>`).join('') : `<div class="empty-state">${icon('message-circle',40)}<h2>${esc(t('Start a conversation'))}</h2></div>`}</div><form class="chat-composer" data-form="message">${hidden('bookingId', booking.id)}<label class="sr-only" for="chat-message">${esc(t('Your message'))}</label><textarea id="chat-message" name="message" rows="1" maxlength="2000" required placeholder="${esc(t('Your message'))}"></textarea><button class="icon-button" type="submit" aria-label="${esc(t('Save message'))}">${icon('arrow-up',22)}</button></form></section>`;
};
/** @param {AppState} state @returns {string} */
const renderMessages = (state) => {
  const bookings = [...state.bookings].sort((a,b) => (b.conversation?.at(-1)?.date ?? b.date).localeCompare(a.conversation?.at(-1)?.date ?? a.date));
  return `${pageHeading('', t('Messages'))}<section class="inbox"><label class="search-field">${icon('search',20)}<input type="search" data-search="conversations" aria-label="${esc(t('Search conversations'))}" placeholder="${esc(t('Search conversations'))}"></label><div class="section-heading"><a class="link" href="/services/pilots">${icon('plus',18)} ${esc(t('Find a drone pilot'))}</a></div>${bookings.length ? `<div class="inbox-list">${bookings.map((booking) => {
    const name = conversationName(booking); const latest = booking.conversation?.at(-1);
    return `<a class="inbox-row" data-search-item data-topic="all" data-search-text="${esc(`${name} ${bookingTitle(booking)} ${latest?.text ?? ''}`.toLowerCase())}" href="/bookings/${esc(booking.id)}/chat">${conversationAvatar()}<span class="row-copy"><span class="inbox-row-heading"><strong>${esc(name)}</strong><time>${esc(dateLabel(latest?.date ?? booking.date))}</time></span><span class="inbox-preview">${latest?.sender === 'you' ? `${esc(t('You'))}: ` : ''}${esc(latest?.text ?? t('Start a conversation about this booking'))}</span></span></a>`;
  }).join('')}</div><p class="muted" data-search-empty hidden>${esc(t('No conversations found.'))}</p>` : emptyState('Your conversations will appear here', 'Create a booking request to open its conversation.', '/services/pilots', 'Find a drone pilot')}</section>`;
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
const renderNotifications = (state) => `${pageHeading(t('Stay one step ahead'), t('Notifications'), '')}${notice('Reminders appear while Aura is open. No background alerts.')}<div class="toolbar"><button class="button button-secondary" data-action="mark-notifications-read" ${state.notifications.every((item) => item.read) ? 'disabled' : ''}>${esc(t('Mark all as read'))}</button></div>${state.notifications.length ? `<div class="card list">${state.notifications.map((notification) => `<article class="list-row"><span class="row-icon">${icon('bell')}</span><div class="row-copy"><h2 class="row-title">${esc(notificationCopy(notification, state).title)}</h2><p class="row-subtitle">${esc(notificationCopy(notification, state).body)}</p><time class="muted" datetime="${esc(notification.date)}">${esc(dateLabel(notification.date))}</time></div>${notification.read ? '' : `<span class="badge badge-blue">${esc(t('New'))}</span>`}</article>`).join('')}</div>` : emptyState('You’re all caught up', 'Reminders and saved booking updates will appear here.')}`;

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

/** @param {string[]} parts @param {AppState} state @returns {string|null} */
const farmRoute = (parts, state) => {
  if (parts[0] === 'weather' && parts.length === 2) {
    const farm = state.farms.find((item) => item.id === parts[1]);
    return farm ? renderWeather(farm) : missing('Farm not found', '/farm');
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
  if (parts[2] === 'schedule' && parts.length === 3) return renderSchedule(farm, state);
  if (parts[2] === 'plots' && parts.length === 4) return renderPlot(farm, parts[3], state);
  if (parts[2] !== 'tasks' || parts.length !== 4) return null;
  const task = state.tasks.find((item) => item.id === parts[3] && item.farmId === farm.id);
  return task ? renderTask(farm, task) : missing('Task not found', `/farm/${farm.id}/schedule`);
};

/** @param {string[]} parts @param {AppState} state @returns {string|null} */
const bookingRoute = (parts, state) => {
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
const renderLandOverview = (farm) => `<section class="farm-map" data-farm-map="${esc(farm.id)}" data-land-overview="true" aria-label="${esc(t('Land map'))}"><div class="land-map-canvas" data-land-canvas aria-label="${esc(t('Interactive land map'))}"></div><div class="land-map-toolbar land-overview-controls" role="toolbar" aria-label="${esc(t('Land map'))}"><label class="map-type-control"><span class="sr-only">${esc(t('Map type'))}</span><select data-map-type aria-label="${esc(t('Map type'))}"><option value="street">${esc(t('Street'))}</option><option value="satellite">${esc(t('Satellite'))}</option></select></label><a class="icon-button land-overview-edit" href="/farm/${esc(farm.id)}/edit" aria-label="${esc(t('Edit land'))}" title="${esc(t('Edit land'))}">${icon('pencil', 20)}</a><button type="button" class="icon-button land-map-expand" data-map-expand aria-expanded="false" aria-label="${esc(t('Expand map'))}" title="${esc(t('Expand map'))}">${icon('arrows-maximize', 20)}</button></div><p class="sr-only" role="status" data-land-status></p></section><p class="field-care-legend">F · ${esc(t('Fertilizer'))} &nbsp; P · ${esc(t('Pesticide'))} <span>✓ ${esc(t('Recorded'))} · ◷ ${esc(t('Scheduled'))} · ! ${esc(t('Overdue'))} · — ${esc(t('No record'))}</span></p>`;

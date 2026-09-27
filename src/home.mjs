import { NEWS, WEATHER } from './data.mjs';
import { convertArea } from './calculators.mjs';
import { getFormatLocale, t } from './i18n.mjs';
import { escapeHtml as esc, localizeDemoState, icon, friendlyDate } from './ui.mjs';

const QUICK_ACTIONS = [
  ['/services/pilots', 'drone', 'Book a pilot'],
  ['/learn/courses', 'school', 'Find a course'],
  // ['/tools', 'calculator', 'Pesticide calculator'],
];

/** @param {import('./store.mjs').AppState} state @returns {{farm:import('./store.mjs').Farm,count:number}|undefined} */
export function selectFeaturedLand(state) {
  let selected;
  for (const farm of state.farms) {
    const count = state.tasks.filter((task) => !task.done && task.farmId === farm.id).length;
    if (!selected || count > selected.count) selected = { farm, count };
  }
  return selected;
}

/** @param {import('./store.mjs').AppState} state @returns {string} */
const farmOverview = (state) => {
  const featured = selectFeaturedLand(state);
  const farm = featured?.farm ?? state.farms[0];
  const crops = [...new Set(farm?.plots.map((plot) => plot.crop).filter(Boolean) ?? [])].join(', ') || farm?.crop;
  const unit = state.settings.unit === 'acre' ? 'acre' : 'ha';
  const area = convertArea(farm?.area ?? 0, 'ha', unit);
  return `<section class="farm-overview"><img src="/assets/farm.jpg" alt="${esc(t('Aerial view of rice fields'))}" fetchpriority="high"><div class="farm-overview-content"><div class="flex items-center justify-between gap-3"><span class="photo-label">${icon('plant-2', 16)} ${esc(farm?.name ?? t('My land'))}</span><span class="photo-label">${esc(t(farm?.isDemo || farm?.id === 'farm-1' ? 'Land' : 'My land'))}</span></div><div class="farm-total"><p>${esc(t('Your growing space'))}</p><h2>${area.toLocaleString(getFormatLocale(), { maximumFractionDigits: 2 })}<span>${esc(t(unit))}</span></h2><p>${featured ? `${featured.count} ${esc(t('Tasks'))}` : esc(t('{count} land parcel', { count: farm ? 1 : 0 }))} <span aria-hidden="true">·</span> ${esc(crops ?? t('Ready for a new season'))}</p></div><a class="photo-button" href="${farm ? `/farm/${esc(farm.id)}` : '/farm'}">${esc(t('View my land'))} ${icon('arrow-up-right', 18)}</a></div></section>`;
};

/** @param {string} farmId @returns {string} */
const weatherCard = () => `<a class="weather-preview card" href="/weather"><div class="flex items-center justify-between"><span class="eyebrow">${esc(t('Weather'))}</span>${icon('arrow-up-right', 20)}</div><p class="weather-location">${esc(t(WEATHER.location))}</p><div class="weather-current"><strong>${WEATHER.temperature}°</strong><span class="weather-sun" aria-hidden="true">⛅</span></div><p class="weather-condition">${esc(t(WEATHER.condition))}</p><div class="weather-metrics"><span>${icon('wind', 18)} ${esc(t('Northeast {speed} km/h', { speed: WEATHER.windSpeed }))}</span><span>${icon('droplet', 18)} ${esc(t('{chance}% rain', { chance: WEATHER.rainChance }))}</span></div><p class="weather-caption">${esc(t('Sample forecast · not live'))}</p></a>`;

/** @param {import('./store.mjs').AppState} state @returns {string} */
const scheduleSection = (state) => {
  const tasks = [...state.tasks].sort((first, second) => `${first.dueDate}${first.time}`.localeCompare(`${second.dueDate}${second.time}`)).slice(0, 3);
  if (!tasks.length) return `<section class="home-schedule"><div class="section-heading"><h2>${esc(t('On your schedule'))}</h2></div><a class="button" href="${state.farms.length ? `/farm/${esc(state.farms[0].id)}/schedule` : '/farm/new'}">${icon('plus', 19)} ${esc(t('Add a task'))}</a></section>`;
  return `<section class="home-schedule"><div class="section-heading"><h2>${esc(t('On your schedule'))}</h2><a class="link" href="/farm/${esc(state.farms[0]?.id ?? 'farm-1')}/schedule">${esc(t('See all'))} ${icon('chevron-right', 16)}</a></div><div class="card task-list">${tasks.length ? tasks.map((task) => `<div class="task-row ${task.done ? 'is-done' : ''}"><button class="task-check" data-action="toggle-task" data-id="${esc(task.id)}" aria-label="${esc(t(task.done ? 'Reopen {title}' : 'Complete {title}', { title: task.title }))}" aria-pressed="${task.done}">${task.done ? icon('check', 16) : ''}</button><a class="row-copy" href="/farm/${esc(task.farmId)}/tasks/${esc(task.id)}"><strong class="row-title">${esc(task.title)}</strong><span class="row-subtitle">${esc(t(task.category))} <span aria-hidden="true">·</span> ${friendlyDate(task.dueDate)}</span></a><span class="task-time">${esc(task.time)}</span></div>`).join('') : `<p class="card-pad muted">${esc(t('A clear schedule. Add your next field task.'))}</p>`}<a class="add-task" href="/farm/${esc(state.farms[0]?.id ?? 'farm-1')}/schedule">${icon('plus', 19)} ${esc(t('Add a task'))}</a></div></section>`;
};

/** @returns {string} */
const learnSection = () => `<section class="home-learn"><div class="section-heading"><h2>${esc(t('Grow your know-how'))}</h2><a class="link" href="/learn">${esc(t('Explore'))} ${icon('chevron-right', 16)}</a></div><a class="knowledge-feature learning-photo-card" href="/learn/knowledge/getting-to-know-your-soil"><div class="knowledge-copy"><p class="eyebrow">${esc(t('Field notes · 4 min read'))}</p><h3>${esc(t('Better farming starts below the surface.'))}</h3><span class="button">${esc(t('Get to know your soil'))} ${icon('arrow-up-right', 18)}</span></div><img src="/assets/crops.jpg" alt="${esc(t('Rice growing on green terraces'))}" loading="lazy"></a></section>`;

/** @returns {string} */
const latestStory = () => {
  const story = [...NEWS].sort((first, second) => second.date.localeCompare(first.date))[0];
  if (!story) return '';
  return `<section class="home-story"><div class="section-heading"><h2>${esc(t('Latest stories'))}</h2><a class="link" href="/news">${esc(t('See all'))}${icon('chevron-right', 16)}</a></div><a class="media-card learning-photo-card home-story-card" href="/news/${esc(story.slug)}"><img class="media-image" src="${esc(story.image)}" alt="" loading="lazy" width="1200" height="800"><div class="learning-photo-body"><p class="learning-photo-meta">${esc(t(story.category))} · ${friendlyDate(story.date)}</p><h3>${esc(t(story.title))}</h3><p class="learning-photo-meta">${esc(t(story.summary))}</p><div class="learning-photo-footer"><span class="button">${esc(t('Read story'))}${icon('arrow-up-right', 18)}</span></div></div></a></section>`;
};

/** @param {import('./store.mjs').AppState} inputState @returns {string} */
export function renderHome(inputState) {
  inputState = localizeDemoState(inputState);
  const realFarms = inputState.farms.filter((farm) => farm.isDemo === false || (!farm.isDemo && farm.id !== 'farm-1'));
  const state = realFarms.length ? { ...inputState, farms: realFarms, tasks: inputState.tasks.filter((task) => realFarms.some((farm) => farm.id === task.farmId)) } : inputState;
  const date = new Intl.DateTimeFormat(getFormatLocale(), { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const hasChosenRole = state.profile.hasChosenRole ?? state.profile.onboarded;
  const greeting = t(new Date().getHours() < 12 ? 'Good morning, {name}' : 'Good day, {name}', { name: state.profile.firstName ?? state.profile.name.trim().split(/\s+/)[0] });
  const heading = hasChosenRole
    ? `<header class="home-heading"><div><p class="eyebrow">${date}</p><h1 tabindex="-1">${esc(greeting)}</h1>${!state.profile.onboarded ? `<a class="link" href="/onboarding/${state.profile.role}">${esc(t('Finish your setup'))} ${icon('arrow-right', 16)}</a>` : ''}</div><a class="button button-secondary desktop-only" href="/farm">${icon('plant-2', 18)} ${esc(t('My land'))}</a></header>`
    : `<header class="home-heading home-welcome"><div><h1 tabindex="-1">${esc(t('Make yourself at home'))}</h1><p class="muted">${esc(t('Set up your farmer or pilot profile.'))}</p></div><a class="button" href="/onboarding/role">${esc(t('Choose role'))} ${icon('arrow-right', 18)}</a></header>`;
  return `${heading}<div class="overview-grid">${farmOverview(state)}${weatherCard()}</div><div class="quick-actions" aria-label="${esc(t('Quick actions'))}">${QUICK_ACTIONS.map(([href, symbol, label]) => `<a href="${href}" class="quick-action"><span>${icon(symbol, 25)}</span>${esc(t(label))}</a>`).join('')}</div><div class="home-lower">${scheduleSection(state)}${learnSection()}</div>${latestStory()}`;
}

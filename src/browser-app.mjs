import { createRecordId } from './record-id.mjs';
import { initializeExpertMatcher } from './expert-ui.mjs';
import { initializeShopDeals } from './shop-deals.mjs';
import { initializeProfilePicture } from './profile-photo.mjs';
// import { initializeMixturePlanner } from './mixture-planner.mjs';
import { initializeArticleReader, initializeArticleTranslation } from './article-reader.mjs';
import { createFieldCareMotion, initializeFieldCare, renderFieldSchedules } from './field-care.mjs';
import { initializePilotMatcher } from './pilot-matcher.mjs';
import { initializeArticleLibrary } from './article-library.mjs';
import { initializeKeypadCalculator } from './keypad-calculator.mjs';
import { initializeLandCardDeletion, initializeLandEditor } from './land-editor.mjs';
import { initializeLandSetup } from './land-setup.mjs';
import { applyAction, canCompleteTask, completeTaskField, collectReminders, submitForm } from './actions.mjs';
import { calculateCost, calculateMargin, convertArea } from './calculators.mjs';
import { renderDiscover, renderServiceResults } from './discover.mjs';
import { clearDraft, readDraft, saveDraft } from './drafts.mjs';
import { initializeLandMap } from './land-map.mjs';
import { renderHome } from './home.mjs';
import { fetchLiveWeather, selectWeatherLocation, weatherLocationKey } from './weather.mjs';
import { loadArticleCatalogue } from './data.mjs';
import { getFormatLocale, getLocale, loadLocale, saveLocale, setLocale, t } from './i18n.mjs';
import { captureFormState, initializeLocalizedValidation, localizeDocument, restoreFormState } from './language.mjs';
import { initializePlantAction } from './plant-action.mjs';
import { searchPlantGuides } from './plant-guides.mjs';
import { renderPlantWebResult, searchPlantWeb } from './plant-web.mjs';
import { renderPlantHelp, renderPlantResults } from './plant-help.mjs';
import { createPlantPhotoController, renderPhotoState } from './plant-photo.mjs';
import { applyUpdate, initializePwa, installApp } from './pwa.mjs';
import { initializeBookingCalendar, initializeSchedule } from './schedule.mjs';
import { renderShell, updateNotificationBell } from './shell.mjs';
import { createStore } from './store.mjs';
import { emptyState, escapeHtml as esc, icon } from './ui.mjs';
import { animateChatTyping, appendChatReply, initializeChatComposer, initializeNotificationStacks, renderScheduledAgenda, renderWorkspace, requestChatReply } from './workspace.mjs';

const STORE = createStore();
try { loadLocale(localStorage); }
catch (error) { console.warn('Aura language storage is unavailable; using English.', error); loadLocale(null); }
const CAN_AUTO_SAVE = !STORE.lastError;
const MAIN = document.querySelector('#main');
const PHOTO = createPlantPhotoController({ onChange: (state) => {
  const panel = MAIN.querySelector('[data-plant-camera]');
  if (!panel) return;
  panel.innerHTML = renderPhotoState(state);
  if (state.status === 'success') panel.querySelector('#plant-summary-title')?.focus({ preventScroll: true });
} });
const TOAST_DURATION = 4200;
const REMINDER_INTERVAL = 60000;
const DRAFT_FORMS = ['farmer-onboarding', 'pilot-onboarding', 'verification'];
const PENDING_CHATS = new Set();
const WEATHER_MAX_AGE = 10 * 60 * 1000;
let weatherView = { key:'', data:null, status:'loading', checkedAt:0 };
let weatherRequest = null;
let toastTimer = 0;
let animationContext = null;
let disposeChatTyping = () => {};
let disposeLandMap = () => {};
let lastCalculation = null;
let activeFilter = 'all';
let activeSearch = '';
let plantQuery = '';
let plantWebRequest = null;
let articleRequest = null;
// let disposeSprayCalculator = () => {};
let plantCategory = 'all';
let openTopbarRoute = null;

/** @param {string} message @returns {void} */
const toast = (message) => {
  if (!message) return;
  const element = document.querySelector('#toast');
  clearTimeout(toastTimer);
  element.dataset.i18n = message;
  element.textContent = t(message);
  element.hidden = false;
  toastTimer = window.setTimeout(() => { element.hidden = true; }, TOAST_DURATION);
};
/** @param {unknown} error @returns {void} */
const reportError = (error) => {
  console.error('Aura action failed', error);
  toast(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
};
/** @returns {void} */
const initializeCourseBookingSheet = () => {
  const sheet = MAIN.querySelector('[data-course-booking-sheet]');
  if (!(sheet instanceof HTMLDialogElement)) return;
  const close = () => navigate(`/learn/courses/${encodeURIComponent(sheet.dataset.courseId)}`);
  sheet.querySelector('[data-course-booking-close]').addEventListener('click', close);
  sheet.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  sheet.showModal();
  sheet.querySelector('[data-course-booking-close]').focus({ preventScroll: true });
};
/** @returns {void} */
const initializePilotBookingSheet = () => {
  const sheet = MAIN.querySelector('[data-pilot-booking-sheet]');
  if (!(sheet instanceof HTMLDialogElement)) return;
  const form = sheet.querySelector('form');
  const fields = [...form.querySelectorAll('label.field, [data-booking-services], [data-booking-date]')];
  const motion = createFieldCareMotion(sheet, window.gsap, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let step = 0;
  const showStep = () => {
    fields.forEach((field, index) => { field.hidden = index !== step; });
    form.querySelector('[data-booking-progress]').textContent = `${step + 1} / ${fields.length}`;
    form.querySelector('[data-booking-back]').hidden = step === 0;
    form.querySelector('[data-booking-next]').hidden = step === fields.length - 1;
    form.querySelector('[type="submit"]').hidden = step !== fields.length - 1;
    fields[step].querySelector('input:not([type="hidden"]),select,textarea,button[aria-pressed="true"]')?.focus({ preventScroll:true });
  };
  form.addEventListener('invalid', (event) => {
    const index = fields.findIndex((field) => field.contains(event.target));
    if (index >= 0) { step = index; showStep(); }
  }, true);
  form.addEventListener('input', () => { form.querySelector('[data-booking-error]').hidden = true; });
  const close = () => motion.close(() => navigate(`/services/pilots/${encodeURIComponent(sheet.dataset.pilotId)}`));
  form.querySelector('[data-booking-close]').addEventListener('click', close);
  sheet.addEventListener('cancel', (event) => { event.preventDefault(); close(); });
  form.querySelector('[data-booking-next]').addEventListener('click', () => {
    const input = fields[step].querySelector('input,select,textarea');
    if (fields[step].hasAttribute('data-booking-services')) input.setCustomValidity(fields[step].querySelector(':checked') ? '' : t('Choose at least one service.'));
    if (!input.reportValidity()) return;
    step += 1; showStep();
  });
  form.querySelector('[data-booking-back]').addEventListener('click', () => { step -= 1; showStep(); });
  form.querySelector('[data-booking-services]').addEventListener('change', (event) => { form.querySelector('[data-booking-services] input').setCustomValidity(''); });
  initializeBookingCalendar(sheet);
  motion.open(); showStep();
};
/** @param {boolean} shouldAnimate @returns {void} */
const render = (shouldAnimate = false) => {
  const openNotificationStacks = new Set([...MAIN.querySelectorAll('[data-notification-stack][open]')].map((item)=>item.dataset.notificationStack));
  disposeChatTyping();
  plantWebRequest?.abort();
  articleRequest?.abort();
  articleRequest = new AbortController();
  const disposePreviousLandMap = disposeLandMap;
  disposeLandMap = () => {};
  disposePreviousLandMap();
//   disposeSprayCalculator();
  animationContext?.revert();
  const state = STORE.getState();
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const hasWeather = (path === '/' && state.profile.role !== 'pilot') || path === '/weather' || path.startsWith('/weather/');
  const weatherLocation = hasWeather ? selectWeatherLocation(state, path) : null;
  const weatherKey = weatherLocation ? weatherLocationKey(weatherLocation) : '';
  if (weatherLocation && weatherView.key !== weatherKey) {
    weatherRequest?.controller.abort();
    weatherRequest = null;
    weatherView = { key:weatherKey, data:null, status:'loading', checkedAt:0 };
  }
  if (path !== '/plant-help/camera') PHOTO.reset(false);
  renderShell(path, state);
  localizeDocument(document);
  MAIN.innerHTML = path === '/' ? (state.profile.role === 'pilot' ? renderWorkspace('/pilot', state) : renderHome(state, weatherView.data, weatherView.status, weatherLocation?.label)) : renderPlantHelp(path, plantQuery, plantCategory) ?? renderWorkspace(path, state, weatherView.data, weatherView.status, weatherLocation?.label) ?? renderDiscover(path, state) ?? emptyState('This page is not here', 'Choose a destination from the navigation.', '/', 'Go home');
  if (hasWeather && weatherLocation && !weatherRequest && Date.now() - weatherView.checkedAt >= (weatherView.status === 'error' ? 60000 : WEATHER_MAX_AGE)) {
    const controller = new AbortController();
    const pending = { key:weatherKey, controller };
    weatherRequest = pending;
    weatherView.checkedAt = Date.now();
    void fetchLiveWeather(weatherLocation, fetch, controller.signal).then((data) => {
      if (weatherRequest !== pending) return;
      weatherView = { key:weatherKey, data, status:'ready', checkedAt:Date.now() };
      if (location.pathname === '/' || location.pathname.startsWith('/weather')) render();
    }).catch((error) => {
      if (weatherRequest !== pending || controller.signal.aborted) return;
      console.error('Could not load forecast.', error);
      weatherView = { key:weatherKey, data:null, status:'error', checkedAt:Date.now() };
      if (location.pathname === '/' || location.pathname.startsWith('/weather')) render();
    }).finally(() => { if (weatherRequest === pending) weatherRequest = null; });
  }
  const cataloguePanel = MAIN.querySelector('[data-load-article-catalogue]');
  if (cataloguePanel) void loadArticleCatalogue().then(() => {
    if (cataloguePanel.isConnected) render();
  }).catch((error) => {
    if (cataloguePanel.isConnected) { cataloguePanel.textContent = t('Could not connect. Check your connection or search the guides.'); reportError(error); }
  });
  const photoPanel = MAIN.querySelector('[data-plant-camera]');
  if (photoPanel) photoPanel.innerHTML = renderPhotoState(PHOTO.getState());
  const landPanel = MAIN.querySelector('[data-farm-map]');
  if (landPanel) disposeLandMap = initializeLandMap(landPanel, STORE, window.L);
  const gridPanel = MAIN.querySelector('[data-land-setup]');
  if (gridPanel) disposeLandMap = initializeLandSetup(gridPanel, STORE, window.L);
  const recordPanel = MAIN.querySelector('[data-land-editor]');
  if (recordPanel) disposeLandMap = initializeLandEditor(recordPanel, STORE, window.L);
  initializeLandCardDeletion(MAIN, STORE);
  initializeProfilePicture(MAIN, STORE);
  const scheduleFarm = state.farms.find((farm) => farm.id === MAIN.querySelector('[data-schedule]')?.dataset.schedule);
  const scheduleTasks = state.tasks.filter((task) => task.farmId === scheduleFarm?.id);
  initializeSchedule(MAIN, scheduleFarm ? {tasks:scheduleTasks,renderAgenda:(date,limit) => renderScheduledAgenda(scheduleFarm,scheduleTasks,date,limit),onAgendaRendered:() => initializeNotificationStacks(MAIN)} : {});
  if (new URLSearchParams(window.location.search).get('plan') === '1') {
    const planner = MAIN.querySelector('[data-plan-task]');
    if (planner) { planner.click(); history.replaceState({}, '', window.location.pathname); }
  }
  initializeFieldCare(MAIN, STORE);
  initializeShopDeals(MAIN);
  initializePilotMatcher(MAIN);
  initializeExpertMatcher(MAIN);
  initializeArticleLibrary(MAIN, state);
  void initializeArticleReader(MAIN, articleRequest.signal).catch((error) => console.error('Article reader failed.', error));
  void initializeArticleTranslation(MAIN, articleRequest.signal).catch((error) => console.error('Article translation failed.', error));
  initializeKeypadCalculator(MAIN, STORE);
//   disposeSprayCalculator = initializeMixturePlanner(MAIN, STORE);
  initializeCourseBookingSheet();
  initializePilotBookingSheet();
  initializeChatComposer(MAIN);
  MAIN.querySelectorAll('[data-notification-stack]').forEach((item)=>{ item.open = openNotificationStacks.has(item.dataset.notificationStack); });
  initializeNotificationStacks(MAIN);
  const chat = MAIN.querySelector('[data-chat-id]');
  if (chat) {
    const isTyping = PENDING_CHATS.has(chat.dataset.chatId);
    chat.querySelector('[data-chat-typing]').hidden = !isTyping;
    disposeChatTyping = animateChatTyping(chat.querySelector('[data-chat-typing]'), window.gsap);
    chat.querySelector('.chat-composer button').disabled = isTyping;
    if (isTyping) chat.querySelector('[data-chat-typing]').scrollIntoView({ block:'nearest' });
  }
  restoreFormDraft();
  initializeMobileOnboarding(path);
  document.title = `${MAIN.querySelector('h1,h2')?.textContent ?? t('Your field companion')} — Aura`;
  if (!shouldAnimate || !window.gsap || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  animationContext = window.gsap.context(() => {
    window.gsap.from(MAIN.children, { y: 8, opacity: 0, duration: 0.25, stagger: 0.025, ease: 'power2.out', clearProps: 'transform,opacity' });
  }, MAIN);
};
/** @param {string} symbol @returns {HTMLElement} */
const createOnboardingVisual = (symbol) => {
  const visual = document.createElement('div');
  visual.className = 'onboarding-step-visual'; visual.setAttribute('aria-hidden', 'true');
  visual.innerHTML = icon(symbol, 96); MAIN.append(visual);
  return visual;
};
/** @returns {void} */
const initializeMobileRoles = () => {
  const isMobile = window.matchMedia('(max-width: 759px)').matches;
  const visual = isMobile ? createOnboardingVisual('user') : null;
  const choices = [...MAIN.querySelectorAll('[data-action="choose-role"]')];
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'button'; next.textContent = t('Continue');
  next.dataset.action = 'choose-role'; next.disabled = true;
  for (const choice of choices) {
    delete choice.dataset.action;
    choice.setAttribute('aria-pressed', 'false');
    choice.addEventListener('click', () => {
      choices.forEach((item) => item.setAttribute('aria-pressed', String(item === choice)));
      next.dataset.role = choice.dataset.role; next.disabled = false;
      if (visual) visual.innerHTML = icon(choice.dataset.role === 'pilot' ? 'drone' : 'plant-2', 96);
    });
  }
  const actions = document.createElement('div');
  actions.className = 'onboarding-role-actions';
  actions.append(choices.find((choice) => choice.dataset.role === 'both'), next);
  const sheet = MAIN.querySelector('.form-stack');
  sheet.append(actions);
  if (isMobile) {
    MAIN.classList.add('is-role-onboarding');
    sheet.prepend(MAIN.querySelector('.page-heading'));
  }
};

/** @param {string} path @returns {void} */
const initializeMobileOnboarding = (path) => {
  MAIN.classList.remove('is-role-onboarding', 'onboarding-sheet');
  // MAIN.classList.toggle('is-product-results', path === '/tools/products');
  MAIN.classList.remove('is-product-results');
  const isSetupComplete = path.endsWith('/setup-complete');
  MAIN.classList.toggle('mobile-onboarding', isSetupComplete || path.startsWith('/onboarding/') || path.startsWith('/auth/'));
  if (path === '/onboarding/role') { initializeMobileRoles(); return; }
  if (!window.matchMedia('(max-width: 759px)').matches) return;
//   if (path === '/tools') {
//     MAIN.classList.add('is-role-onboarding');
//     createOnboardingVisual('calculator');
//     MAIN.querySelector('[data-mixture-planner]').prepend(MAIN.querySelector('.page-heading'));
//     return;
//   }
  if (isSetupComplete) {
    MAIN.classList.add('is-role-onboarding');
    createOnboardingVisual('check');
    MAIN.querySelector('.land-setup-confirmation').prepend(MAIN.querySelector('.page-heading'));
    return;
  }
  if (!['/onboarding/farmer', '/onboarding/pilot', '/auth/sign-in', '/auth/sign-up'].includes(path)) return;
  const form = MAIN.querySelector('form[data-form]');
  if (!form) return;
  const visual = createOnboardingVisual('user');
  MAIN.querySelector('.page-heading')?.classList.add('sr-only');
  const fields = [...form.querySelectorAll('label.field')];
  const submit = form.querySelector('button[type="submit"]');
  const progress = document.createElement('p');
  progress.className = 'muted onboarding-progress';
  const controls = document.createElement('div');
  controls.className = 'onboarding-controls';
  const backButton = document.createElement('button');
  backButton.type = 'button'; backButton.className = 'button button-secondary'; backButton.textContent = t('Back');
  const nextButton = document.createElement('button');
  nextButton.type = 'button'; nextButton.className = 'button'; nextButton.textContent = t('Continue');
  controls.append(backButton, nextButton, submit);
  form.prepend(progress); form.append(controls); form.classList.add('onboarding-sheet');
  let step = 0;
  const showStep = () => {
    fields.forEach((field, index) => { field.hidden = index !== step; });
    progress.textContent = `${step + 1} / ${fields.length}`;
    const symbols = { name: 'user', firstName: 'user', lastName: 'user', farmName: 'plant-2', location: 'map-pin', crop: 'leaf', area: 'map', services: 'drone', equipment: 'drone', rate: 'wallet' };
    visual.innerHTML = icon(symbols[fields[step].querySelector('input').name] ?? 'user', 96);
    backButton.hidden = step === 0; nextButton.hidden = step === fields.length - 1;
    submit.hidden = step !== fields.length - 1;
  };
  const advance = () => {
    if (!fields[step].querySelector('input').reportValidity()) return;
    step += 1; showStep(); fields[step].querySelector('input').focus({ preventScroll: true });
  };
  nextButton.addEventListener('click', advance);
  backButton.addEventListener('click', () => { step = Math.max(0, step - 1); showStep(); });
  form.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && step < fields.length - 1) { event.preventDefault(); advance(); }
  });
  showStep();
};

/** @param {string} path @param {{refresh?:boolean}} options @returns {void} */
const navigate = (path, { refresh = false } = {}) => {
  const isCurrentPath = `${window.location.pathname}${window.location.search}` === path;
  if (isCurrentPath && !refresh) return;
  if (!isCurrentPath) history.pushState({}, '', path);
  activeSearch = '';
  activeFilter = 'all';
  lastCalculation = null;
  render(true);
  window.scrollTo({ top: 0, behavior: 'instant' });
  (MAIN.querySelector('h1') ?? MAIN).focus({ preventScroll: true });
};
/** @returns {void} */
const filterCards = () => {
  const cards = [...MAIN.querySelectorAll('[data-search-item]')];
  for (const card of cards) card.hidden = !(activeFilter === 'all' || card.dataset.topic === activeFilter) || !card.dataset.searchText.includes(activeSearch);
  const empty = MAIN.querySelector('[data-search-empty]');
  if (empty) empty.hidden = cards.some((card) => !card.hidden);
  MAIN.querySelectorAll('[data-action="filter"]').forEach((button) => {
    const isActive = button.dataset.filter === activeFilter;
    button.setAttribute('aria-pressed', String(isActive));
    button.classList.toggle('chip-active', isActive);
  });
};
/** @returns {void} */
const updatePlantSearch = () => {
  plantWebRequest?.abort();
  const results = MAIN.querySelector('[data-plant-results]');
  if (!results) return;
  results.innerHTML = renderPlantResults(plantQuery, plantCategory);
  MAIN.querySelectorAll('[data-plant-category]').forEach((button) => {
    const isSelected = button.dataset.plantCategory === plantCategory;
    button.classList.toggle('chip-active', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
};
/** @returns {Promise<void>} */
const runPlantWebSearch = async () => {
  const panel = MAIN.querySelector('[data-plant-web-panel]');
  const button = MAIN.querySelector('[data-plant-web-search]');
  if (!panel || !plantQuery.trim() || button?.disabled) return;
  plantWebRequest?.abort();
  const request = new AbortController(); plantWebRequest = request;
  const query = plantQuery.trim();
  if (button) button.disabled = true;
  panel.innerHTML = `<p class="muted plant-web-loading" role="status">${esc(t('Searching the web…'))}</p>`;
  try {
    const result = await searchPlantWeb(query, getLocale(), AbortSignal.any([request.signal, AbortSignal.timeout(35000)]));
    if (!request.signal.aborted && panel.isConnected) panel.innerHTML = renderPlantWebResult(result);
  } catch (error) {
    if (request.signal.aborted || !panel.isConnected) return;
    console.warn('Plant web search failed.', error instanceof Error ? error.name : 'Unknown error');
    const message = navigator.onLine === false ? t('You’re offline. Web search needs an internet connection.') : error instanceof Error ? t(error.message) : t('Web search is unavailable. Please try again.');
    panel.innerHTML = `<p class="plant-web-error" role="status">${esc(message)}</p>`;
  } finally { if (button?.isConnected) button.disabled = false; }
};

/** @param {HTMLElement} button @returns {Promise<void>} */
const handlePhotoAction = async (button) => {
  const action = button.dataset.photoAction;
  if (action === 'camera' || action === 'library') MAIN.querySelector(`[data-plant-photo="${action}"]`)?.click();
  if (action === 'analyze') await PHOTO.analyze();
  if (action === 'cancel') PHOTO.cancel();
  if (action === 'translate') await PHOTO.localize();
};
/** @param {import('./src/actions.mjs').ActionResult} result @returns {void} */
const finishAction = (result) => {
  const active = document.activeElement;
  const action = active?.dataset?.action;
  const id = active?.dataset?.id;
  if (result.redirect) navigate(result.redirect, { refresh: true }); else render();
  if (!result.redirect && action) {
    const selector = `[data-action="${CSS.escape(action)}"]${id ? `[data-id="${CSS.escape(id)}"]` : ''}`;
    MAIN.querySelector(selector)?.focus({ preventScroll: true });
  }
  toast(result.message);
};
/** @param {HTMLElement} button @returns {Promise<void>} */
const handleAction = async (button) => {
  const { action, id = '', role = '' } = button.dataset;
  if (action === 'delete-task' && !window.confirm(t('Delete this task? Other scheduled occurrences will stay.'))) return;
  if (action === 'install') return await installApp(toast);
  if (action === 'update-app') return applyUpdate();
  if (action === 'filter') { activeFilter = button.dataset.filter; filterCards(); return; }
  if (action === 'save-calculation') {
    if (!lastCalculation) return toast('Calculate a result first.');
    STORE.update((state) => { state.savedCalculations.unshift(structuredClone(lastCalculation)); });
    button.disabled = true;
    return toast('Calculation saved.');
  }
  let result;
  STORE.update((state) => { result = action === 'complete-task-field' ? completeTaskField(state,id,button.dataset.plotId ?? '') : applyAction(state, action, id, role); });
  finishAction(result);
  if (action === 'save-article') {
    const input = MAIN.querySelector('[data-search]');
    if (input) input.value = activeSearch;
    filterCards();
  }
};
/** @param {MouseEvent} event @returns {Promise<void>} */
const onClick = async (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-action]');
  try {
    const photoButton = event.target.closest('[data-photo-action]');
    if (photoButton) { event.preventDefault(); await handlePhotoAction(photoButton); return; }
    if (event.target.closest('[data-plant-web-search]')) { await runPlantWebSearch(); return; }
    const category = event.target.closest('[data-plant-category]');
    if (category) { plantCategory = category.dataset.plantCategory; updatePlantSearch(); return; }
    if (event.target.closest('[data-plant-clear]')) {
      plantQuery = ''; plantCategory = 'all';
      const input = MAIN.querySelector('[data-plant-search]');
      if (input) { input.value = ''; input.focus(); }
      updatePlantSearch(); return;
    }
    if (button && !button.disabled) { event.preventDefault(); await handleAction(button); return; }
    const link = event.target.closest('a[href]');
    if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0 || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin || url.hash) return;
    event.preventDefault();
    const topbarRoute = link.dataset.topbarToggle;
    if (topbarRoute) {
      if (location.pathname === url.pathname) {
        const openedHere = openTopbarRoute === url.pathname;
        openTopbarRoute = null;
        if (openedHere) history.back();
        else navigate('/');
      } else {
        openTopbarRoute = url.pathname;
        navigate(url.pathname);
      }
      return;
    }
    openTopbarRoute = null;
    navigate(`${url.pathname}${url.search}`);
  } catch (error) { reportError(error); }
};
/** @param {HTMLFormElement} form @returns {Record<string,string|string[]>} */
const fieldsFrom = (form) => {
  const data = new FormData(form);
  const fields = Object.fromEntries(data);
  if (form.dataset.form === 'pilot-booking') fields.service = data.getAll('service').map(String);
  if (form.dataset.form === 'task') fields.plotIds = data.getAll('plotIds').map(String);
  if (form.dataset.form === 'availability') fields.days = data.getAll('days').map(String);
  return fields;
};
/** @returns {void} */
const restoreFormDraft = () => {
  const form = MAIN.querySelector('form[data-form]');
  if (!form || !DRAFT_FORMS.includes(form.dataset.form)) return;
  try {
    const draft = readDraft(localStorage, form.dataset.form);
    for (const [name, value] of Object.entries(draft ?? {})) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) field.value = value;
    }
  } catch (error) { reportError(error); }
};
/** @param {Event} event @returns {void} */
const persistFormDraft = (event) => {
  if (!(event.target instanceof Element)) return;
  const form = event.target.closest('form[data-form]');
  if (!form || !DRAFT_FORMS.includes(form.dataset.form)) return;
  try { saveDraft(localStorage, form.dataset.form, fieldsFrom(form)); }
  catch (error) { reportError(error); }
};
/** @param {HTMLFormElement} form @param {Record<string,string|string[]>} fields @returns {void} */
const showCalculation = (form, fields) => {
  const kind = form.dataset.kind;
  let result;
  let unit;
  if (kind === 'area') { result = convertArea(Number(fields.value), fields.from, fields.to); unit = fields.to; }
  else if (kind === 'cost') { result = calculateCost(Number(fields.area), Number(fields.rate), Number(fields.unitCost)); unit = 'MYR'; }
  else { result = calculateMargin(Number(fields.revenue), Number(fields.cost)); unit = 'MYR'; }
  const title = { area: 'Area conversion', cost: 'Input cost', margin: 'Simple margin' }[kind];
  lastCalculation = { id: createRecordId(), type: kind, title, inputs: fields, result, unit, date: new Date().toISOString() };
  renderCalculation();
};
/** @returns {void} */
const renderCalculation = () => {
  const panel = document.querySelector('#calculation-result');
  if (!panel || !lastCalculation) return;
  const { result, title, unit } = lastCalculation;
  const isSaved = STORE.getState().savedCalculations.some((item) => item.id === lastCalculation.id);
  const formatted = new Intl.NumberFormat(getFormatLocale(), { maximumFractionDigits: 4 }).format(result);
  panel.innerHTML = `<p class="muted">${esc(t(title))}</p><p class="calculation-value">${formatted} <span>${esc(t(unit === 'MYR' ? 'RM' : unit))}</span></p><button class="button button-secondary" data-action="save-calculation" ${isSaved ? 'disabled' : ''}>${icon('bookmark', 18)} ${esc(t('Save result'))}</button>`;
};
/** @param {string} locale @returns {void} */
const changeLanguage = (locale) => {
  const snapshot = captureFormState(MAIN);
  const position = window.scrollY;
  setLocale(locale);
  let persistenceError = null;
  try { saveLocale(localStorage, getLocale()); }
  catch (error) { persistenceError = error; }
  render();
  restoreFormState(MAIN, snapshot);
  void PHOTO.localize();
  filterCards();
  renderCalculation();
  window.scrollTo({ top: position, behavior: 'instant' });
  document.querySelector('[data-language-select]')?.focus({ preventScroll: true });
  if (persistenceError) reportError(persistenceError);
};
/** @param {string} title @returns {void} */
const showEventCreated = (title) => {
  const dialog = document.createElement('dialog');
  dialog.className = 'task-sheet event-created-sheet';
  dialog.setAttribute('aria-labelledby', 'event-created-title');
  dialog.innerHTML = `<div class="event-created-icon">${icon('check', 28)}</div><h2 id="event-created-title">${esc(t('Event created'))}</h2><p>${esc(title)}</p><button class="button" autofocus>${esc(t('Done'))}</button>`;
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { dialog.remove(); MAIN.querySelector('[data-plan-task]')?.focus(); }, { once: true });
  MAIN.append(dialog);
  dialog.showModal();
};
/** @param {SubmitEvent} event @returns {void} */
const onSubmit = async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || !form.dataset.form) return;
  event.preventDefault();
  if (form.dataset.submitted === 'true' || !form.isConnected || !form.reportValidity()) return;
  if (['task', 'pilot-booking', 'course-booking'].includes(form.dataset.form)) {
    form.dataset.submitted = 'true';
    form.querySelector('[type="submit"]').disabled = true;
  }
  try {
    if (form.dataset.form === 'plant-search') {
      updatePlantSearch();
      if (plantQuery.trim() && !searchPlantGuides(plantQuery, plantCategory).length) await runPlantWebSearch();
      return;
    }
    const fields = fieldsFrom(form);
    if (form.dataset.form === 'message' && PENDING_CHATS.has(fields.chatId ?? fields.bookingId)) return;
    if (form.dataset.form === 'task') fields.creationKey = form.dataset.creationKey ?? (form.dataset.creationKey = createRecordId());
    if (form.dataset.form === 'calculator') return showCalculation(form, fields);
    let result;
    STORE.update((state) => { result = submitForm(state, form.dataset.form, fields); });
    if (form.dataset.form === 'settings') {
      changeLanguage(STORE.getState().settings.language);
      result.message = t('Profile saved.');
    }
    if (DRAFT_FORMS.includes(form.dataset.form)) {
      try { clearDraft(localStorage, form.dataset.form); }
      catch (error) { console.error('Could not clear completed onboarding draft', error); }
    }
    finishAction(result);
    if (form.dataset.form === 'message') {
      const state = STORE.getState();
      const conversation = fields.chatId ? state.chats?.find((item) => item.id === fields.chatId) : state.bookings.find((item) => item.id === fields.bookingId);
      if (conversation && !conversation.expertId) await replyToConversation(conversation);
    }
    checkReminders();
    if (form.dataset.form === 'task' && !fields.id) showEventCreated(String(fields.title));
  } catch (error) {
    delete form.dataset.submitted;
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = false;
    const bookingError = form.querySelector('[data-booking-error]');
    if (bookingError) {
      bookingError.textContent = t(error instanceof Error ? error.message : 'Something went wrong. Please try again.');
      bookingError.hidden = false;
      bookingError.focus();
    }
    reportError(error);
  }
};
/** @returns {void} */
const checkReminders = () => {
  if (!CAN_AUTO_SAVE) return;
  const draft = STORE.getState();
  if (!collectReminders(draft)) return;
  try {
    STORE.update((state) => { state.notifications = draft.notifications; });
    if (location.pathname === '/notifications') render();
    else updateNotificationBell(STORE.getState(), location.pathname);
    toast('A farm task is due. Check notifications.');
  }
  catch (error) { reportError(error); }
};

initializeLocalizedValidation(document);
document.addEventListener('land-record-saved', (event) => { navigate(event.detail.path); });
document.addEventListener('land-grid-saved', (event) => { navigate(`/farm/${event.detail.id}/setup-complete`); });
document.addEventListener('land-field-saved', () => { render(); });
document.addEventListener('land-field-deleted', (event) => { navigate(`/farm/${encodeURIComponent(event.detail.farmId)}`); toast('Field deleted.'); });
document.addEventListener('click', onClick);
initializePlantAction({ root: document.querySelector('#bottom-nav'), onOpen: (mode) => {
  try {
    navigate(mode === 'camera' ? '/plant-help/camera' : '/plant-help');
    if (mode === 'camera') MAIN.querySelector('[data-plant-photo="camera"]')?.click();
    else MAIN.querySelector('[data-plant-search]')?.focus({ preventScroll: true });
  } catch (error) { reportError(error); }
} });
document.addEventListener('submit', onSubmit);
document.addEventListener('input', persistFormDraft);
document.addEventListener('change', persistFormDraft);
document.addEventListener('change', (event) => {
  if (!(event.target instanceof HTMLSelectElement) || !event.target.hasAttribute('data-language-select')) return;
  try { changeLanguage(event.target.value); }
  catch (error) { reportError(error); }
});
document.addEventListener('change', async (event) => {
  if (!(event.target instanceof HTMLInputElement) || !event.target.hasAttribute('data-plant-photo')) return;
  const file = event.target.files?.[0];
  if (!file) return;
  try { await PHOTO.choose(file); }
  catch (error) { reportError(error); }
});
document.addEventListener('input', (event) => {
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-service-search')) {
    const query = event.target.value.trim();
    const results = MAIN.querySelector('[data-service-results]');
    results.hidden = !query;
    results.innerHTML = query ? renderServiceResults(query) : '';
    MAIN.querySelector('[data-service-browse]').hidden = Boolean(query);
    return;
  }
  if (event.target instanceof HTMLInputElement && event.target.hasAttribute('data-plant-search')) {
    plantQuery = event.target.value;
    updatePlantSearch(); return;
  }
  if (!(event.target instanceof HTMLInputElement) || !event.target.hasAttribute('data-search')) return;
  activeSearch = event.target.value.trim().toLowerCase();
  filterCards();
});
window.addEventListener('popstate', () => { openTopbarRoute = null; render(true); (MAIN.querySelector('h1') ?? MAIN).focus(); });
for (const name of ['online', 'offline']) window.addEventListener(name, () => {
  document.querySelector('#connection-status').textContent = t(navigator.onLine ? 'Your field companion' : 'Offline · saved on this device');
  toast(navigator.onLine ? 'You’re back online.' : 'Offline. Your saved workspace is still available.');
});
render(true);
if (STORE.lastError) {
  const notice = document.querySelector('#app-notice');
  notice.textContent = STORE.lastError.message;
  notice.hidden = false;
}
checkReminders();
window.setInterval(() => {
  checkReminders();
  const tasks = STORE.getState().tasks;
  MAIN.querySelectorAll('[data-action="toggle-task"], [data-care-complete]').forEach((button) => {
    const task = tasks.find((item) => item.id === (button.dataset.id ?? button.dataset.careComplete));
    if (!task) return;
    button.disabled = !canCompleteTask(task);
    button.closest('.list-row, .task-row')?.classList.toggle('is-task-unavailable', button.disabled);
  });
  const careSheet = MAIN.querySelector('[data-field-care-sheet][open]');
  const fieldTask = careSheet?.querySelector('[data-care-task]');
  const task = tasks.find((item) => item.id === fieldTask?.dataset.careTask);
  if (task) careSheet.querySelector('[data-care-content]').innerHTML = renderFieldSchedules(tasks, task.farmId, task.plotId);
}, REMINDER_INTERVAL);
void initializePwa(toast);

/** @param {import('./store.mjs').Booking | {id:string,name:string,conversation:import('./store.mjs').Message[]}} conversation @returns {Promise<void>} */
async function replyToConversation(conversation) {
  const messageId = conversation.conversation.at(-1)?.id;
  PENDING_CHATS.add(conversation.id);
  render();
  try {
    const replies = await requestChatReply(conversation);
    STORE.update((state) => {
      const current = [...state.bookings, ...(state.chats ?? [])].find((item) => item.id === conversation.id);
      if (current) appendChatReply(current, messageId, replies);
    });
  } finally {
    PENDING_CHATS.delete(conversation.id);
    if ([`/bookings/${conversation.id}/chat`, `/messages/${conversation.id}`, '/messages'].includes(location.pathname)) {
      const composer = MAIN.querySelector('.chat-composer textarea');
      const draft = composer?.value ?? '';
      const hasFocus = document.activeElement === composer;
      render();
      const nextComposer = MAIN.querySelector('.chat-composer textarea');
      if (nextComposer) {
        nextComposer.value = draft;
        if (hasFocus) nextComposer.focus({ preventScroll:true });
      }
    }
  }
}

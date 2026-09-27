import { initializePilotMatcher } from './src/pilot-matcher.mjs';
import { initializeArticleLibrary } from './src/article-library.mjs';
import { initializeKeypadCalculator } from './src/keypad-calculator.mjs';
import { initializeSprayCalculator } from './src/spray-calculator.mjs';
import { initializeLandEditor } from './src/land-editor.mjs';
import { initializeLandSetup } from './src/land-setup.mjs';
import { applyAction, collectReminders, submitForm } from './src/actions.mjs';
import { calculateCost, calculateMargin, convertArea } from './src/calculators.mjs';
import { renderDiscover, renderServiceResults } from './src/discover.mjs';
import { clearDraft, readDraft, saveDraft } from './src/drafts.mjs';
import { initializeLandMap } from './src/land-map.mjs';
import { renderHome } from './src/home.mjs';
import { getFormatLocale, getLocale, loadLocale, saveLocale, setLocale, t } from './src/i18n.mjs';
import { captureFormState, initializeLocalizedValidation, localizeDocument, restoreFormState } from './src/language.mjs';
import { initializePlantAction } from './src/plant-action.mjs';
import { searchPlantGuides } from './src/plant-guides.mjs';
import { renderPlantWebResult, searchPlantWeb } from './src/plant-web.mjs';
import { renderPlantHelp, renderPlantResults } from './src/plant-help.mjs';
import { createPlantPhotoController, renderPhotoState } from './src/plant-photo.mjs';
import { applyUpdate, initializePwa, installApp } from './src/pwa.mjs';
import { initializeSchedule } from './src/schedule.mjs';
import { renderShell } from './src/shell.mjs';
import { createStore } from './src/store.mjs';
import { emptyState, escapeHtml as esc, icon } from './src/ui.mjs';
import { renderWorkspace } from './src/workspace.mjs';

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
let toastTimer = 0;
let animationContext = null;
let disposeLandMap = () => {};
let lastCalculation = null;
let activeFilter = 'all';
let activeSearch = '';
let plantQuery = '';
let plantWebRequest = null;
let disposeSprayCalculator = () => {};
let plantCategory = 'all';

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
/** @param {boolean} shouldAnimate @returns {void} */
const render = (shouldAnimate = false) => {
  plantWebRequest?.abort();
  disposeLandMap();
  disposeSprayCalculator();
  animationContext?.revert();
  const state = STORE.getState();
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path !== '/plant-help/camera') PHOTO.reset(false);
  renderShell(path, state);
  localizeDocument(document);
  MAIN.innerHTML = path === '/' ? (state.profile.role === 'pilot' ? renderWorkspace('/pilot', state) : renderHome(state)) : renderPlantHelp(path, plantQuery, plantCategory) ?? renderWorkspace(path, state) ?? renderDiscover(path, state) ?? emptyState('This page is not here', 'Choose a destination from the navigation.', '/', 'Go home');
  const photoPanel = MAIN.querySelector('[data-plant-camera]');
  if (photoPanel) photoPanel.innerHTML = renderPhotoState(PHOTO.getState());
  const landPanel = MAIN.querySelector('[data-farm-map]');
  if (landPanel) disposeLandMap = initializeLandMap(landPanel, STORE, window.L);
  const gridPanel = MAIN.querySelector('[data-land-setup]');
  if (gridPanel) disposeLandMap = initializeLandSetup(gridPanel, STORE, window.L);
  const recordPanel = MAIN.querySelector('[data-land-editor]');
  if (recordPanel) disposeLandMap = initializeLandEditor(recordPanel, STORE, window.L);
  initializeSchedule(MAIN);
  initializePilotMatcher(MAIN);
  initializeArticleLibrary(MAIN, state);
  initializeKeypadCalculator(MAIN, STORE);
  disposeSprayCalculator = initializeSprayCalculator(MAIN);
  initializeCourseBookingSheet();
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
  MAIN.classList.remove('is-role-onboarding');
  MAIN.classList.toggle('mobile-onboarding', path.startsWith('/onboarding/') || path.startsWith('/auth/'));
  if (path === '/onboarding/role') { initializeMobileRoles(); return; }
  if (!window.matchMedia('(max-width: 759px)').matches) return;
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

/** @param {string} path @returns {void} */
const navigate = (path) => {
  if (window.location.pathname !== path) history.pushState({}, '', path);
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
};
/** @param {import('./src/actions.mjs').ActionResult} result @returns {void} */
const finishAction = (result) => {
  const active = document.activeElement;
  const action = active?.dataset?.action;
  const id = active?.dataset?.id;
  if (result.redirect) navigate(result.redirect); else render();
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
  STORE.update((state) => { result = applyAction(state, action, id, role); });
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
    navigate(url.pathname);
  } catch (error) { reportError(error); }
};
/** @param {HTMLFormElement} form @returns {Record<string,string|string[]>} */
const fieldsFrom = (form) => {
  const data = new FormData(form);
  const fields = Object.fromEntries(data);
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
  lastCalculation = { id: crypto.randomUUID(), type: kind, title, inputs: fields, result, unit, date: new Date().toISOString() };
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
  if (form.dataset.form === 'task') {
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
    if (form.dataset.form === 'task') fields.creationKey = form.dataset.creationKey ?? (form.dataset.creationKey = crypto.randomUUID());
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
    checkReminders();
    if (form.dataset.form === 'task' && !fields.id) showEventCreated(String(fields.title));
  } catch (error) {
    delete form.dataset.submitted;
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = false;
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
    toast('A farm task is due. Check notifications.');
  }
  catch (error) { reportError(error); }
};

initializeLocalizedValidation(document);
document.addEventListener('land-record-saved', (event) => { navigate(event.detail.path); });
document.addEventListener('land-grid-saved', (event) => { navigate(`/farm/${event.detail.id}`); });
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
window.addEventListener('popstate', () => { render(true); (MAIN.querySelector('h1') ?? MAIN).focus(); });
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
window.setInterval(checkReminders, REMINDER_INTERVAL);
await initializePwa(toast);

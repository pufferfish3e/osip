import { t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

/** @typedef {'camera'|'search'} PlantActionMode */
/** @typedef {{pointerId:number,x:number,y:number,button:HTMLButtonElement,timer:ReturnType<typeof setTimeout>|null}} Gesture */
/** @typedef {{root:HTMLElement,onOpen:(mode:PlantActionMode)=>void,gesture:Gesture|null,shouldSuppressClick:boolean}} ActionContext */
const HOLD_DURATION = 550;
const MOVE_TOLERANCE = 12;
const SWITCH_DURATION = 0.18;
const ACTION_SELECTOR = '[data-plant-action]';
/** @type {PlantActionMode} */
let activeMode = 'camera';

/** @returns {PlantActionMode} */
export function getMode() {
  return activeMode;
}

/** @returns {string} */
const actionLabel = () => t(activeMode === 'camera' ? 'Camera. Hold to switch to Search.' : 'Search. Hold to switch to Camera.');

/** @param {string} path @returns {string} */
export function renderPlantAction(path) {
  return `<button class="nav-item plant-action ${path.startsWith('/plant-help') ? 'is-active' : ''}" type="button" data-plant-action data-mode="${activeMode}" aria-label="${esc(actionLabel())}" aria-describedby="plant-action-hint"><span class="plant-action-disc">${icon(activeMode, 25)}</span><span class="plant-action-label" aria-live="polite">${esc(t(activeMode === 'camera' ? 'Camera' : 'Search'))}</span></button><span id="plant-action-hint" class="sr-only">${esc(t('Tap to open. Hold or use arrow keys to switch tools.'))}</span>`;
}

/** @param {ActionContext} context @param {Event} event @returns {HTMLButtonElement|null} */
const eventButton = (context, event) => {
  const target = event.target;
  if (!(target instanceof Element)) return null;
  const button = target.closest(ACTION_SELECTOR);
  return button instanceof HTMLButtonElement && context.root.contains(button) ? button : null;
};

/** @param {ActionContext} context @param {boolean} shouldSuppress @returns {void} */
const cancelGesture = (context, shouldSuppress = true) => {
  const timer = context.gesture?.timer;
  if (timer !== null && timer !== undefined) clearTimeout(timer);
  context.gesture = null;
  context.shouldSuppressClick = shouldSuppress;
};

/** @param {HTMLButtonElement} button @param {boolean} shouldAnimate @returns {void} */
const switchMode = (button, shouldAnimate) => {
  activeMode = activeMode === 'camera' ? 'search' : 'camera';
  button.dataset.mode = activeMode;
  button.setAttribute('aria-label', actionLabel());
  const label = button.querySelector('.plant-action-label');
  const disc = button.querySelector('.plant-action-disc');
  if (label) label.textContent = t(activeMode === 'camera' ? 'Camera' : 'Search');
  if (disc) disc.innerHTML = icon(activeMode, 25);
  const canAnimate = shouldAnimate && !globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (disc && canAnimate && globalThis.gsap) globalThis.gsap.fromTo(disc, { scale: 0.9 }, { scale: 1, duration: SWITCH_DURATION, ease: 'power2.out', overwrite: true, clearProps: 'transform' });
};

/** @param {ActionContext} context @param {PointerEvent} event @returns {void} */
const pointerDown = (context, event) => {
  if (event.isPrimary === false || context.gesture) { cancelGesture(context); return; }
  if (event.button !== 0) return;
  const button = eventButton(context, event);
  if (!button) return;
  context.shouldSuppressClick = false;
  /** @type {Gesture} */
  const gesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, button, timer: null };
  context.gesture = gesture;
  gesture.timer = setTimeout(() => {
    if (context.gesture !== gesture || !context.root.contains(button)) { cancelGesture(context); return; }
    context.shouldSuppressClick = true;
    gesture.timer = null;
    switchMode(button, true);
  }, HOLD_DURATION);
};

/** @param {ActionContext} context @param {PointerEvent} event @returns {void} */
const pointerMove = (context, event) => {
  const gesture = context.gesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MOVE_TOLERANCE) cancelGesture(context);
};

/** @param {ActionContext} context @param {PointerEvent} event @returns {void} */
const pointerUp = (context, event) => {
  const gesture = context.gesture;
  if (!gesture || gesture.pointerId !== event.pointerId) return;
  cancelGesture(context, context.shouldSuppressClick || !context.root.contains(gesture.button));
};

/** @param {ActionContext} context @param {MouseEvent} event @returns {void} */
const clickAction = (context, event) => {
  if (!eventButton(context, event)) return;
  event.preventDefault();
  if ((context.shouldSuppressClick && event.detail !== 0) || event.button > 0) return;
  cancelGesture(context, false);
  context.onOpen(activeMode);
};

/** @param {ActionContext} context @param {KeyboardEvent} event @returns {void} */
const keyAction = (context, event) => {
  const button = eventButton(context, event);
  if (!button) return;
  if (event.key === 'Enter' || event.key === ' ') {
    cancelGesture(context, false);
    if (event.repeat) event.preventDefault();
    return;
  }
  if (!['ArrowLeft', 'ArrowRight'].includes(event.key) && !(event.key === 'F10' && event.shiftKey)) return;
  event.preventDefault();
  cancelGesture(context, false);
  if (!event.repeat) switchMode(button, false);
};

/** @param {{root:HTMLElement,onOpen:(mode:PlantActionMode)=>void}} options @returns {()=>void} */
export function initializePlantAction({ root, onOpen }) {
  /** @type {ActionContext} */
  const context = { root, onOpen, gesture: null, shouldSuppressClick: false };
  const listeners = {
    pointerdown: (event) => pointerDown(context, event),
    pointermove: (event) => pointerMove(context, event),
    pointerup: (event) => pointerUp(context, event),
    pointercancel: () => cancelGesture(context),
    pointerleave: () => { if (context.gesture) cancelGesture(context); },
    click: (event) => clickAction(context, event),
    keydown: (event) => keyAction(context, event),
    contextmenu: (event) => { if (eventButton(context, event)) event.preventDefault(); },
  };
  for (const [name, listener] of Object.entries(listeners)) root.addEventListener(name, listener);
  return () => {
    cancelGesture(context);
    for (const [name, listener] of Object.entries(listeners)) root.removeEventListener(name, listener);
  };
}

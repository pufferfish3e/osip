import { t } from './i18n.mjs';
import { escapeHtml as esc } from './ui.mjs';

/** @typedef {(message:string)=>void} Toast */
let installPrompt = null;
let workerRegistration = null;

const installInstructions = () => {
  const agent = navigator.userAgent || '';
  if (/Android/i.test(agent)) return t('On Android, open Aura in Chrome, tap the three-dot menu, then tap Install app or Add to Home screen. If you opened Aura inside another app, choose Open in Chrome first.');
  if (/iPhone|iPad|iPod/i.test(agent)) return t('On iPhone, open Aura in Safari, tap Share, then Add to Home Screen.');
  return t('Open your browser menu and choose Install app or Add to Home screen.');
};

const cacheViewedPhotos = () => {
  const paths = [...new Set([...document.images].filter((image) => image.complete && image.naturalWidth).map((image) => {
    const url = new URL(image.currentSrc || image.src, window.location.href);
    return url.origin === window.location.origin ? url.pathname : '';
  }))].filter(Boolean);
  navigator.serviceWorker.controller?.postMessage({ type: 'CACHE_VIEWED_PHOTOS', paths });
};

/** @param {Toast} toast @returns {Promise<void>} */
export async function installApp(toast) {
  if (window.matchMedia('(display-mode: standalone)').matches) return toast('Aura is already installed.');
  if (!installPrompt) {
    const dialog = document.querySelector('#install-dialog');
    dialog.querySelector('[data-install-instructions]').textContent = installInstructions();
    if (!dialog.open) dialog.showModal();
    return;
  }
  try {
    const prompt = installPrompt;
    installPrompt = null; // The browser only allows this prompt to be used once.
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === 'accepted') toast('Installation requested.');
  } catch (error) {
    console.error('Install failed', error);
    toast('Installation could not start. Try your browser menu.');
  }
}
/** @returns {void} */
const offerUpdate = () => {
  const notice = document.querySelector('#app-notice');
  notice.hidden = false;
  notice.innerHTML = `<span data-i18n="A new version is ready.">${esc(t('A new version is ready.'))}</span> <button class="link" data-action="update-app" data-i18n="Refresh app">${esc(t('Refresh app'))}</button>`;
};
/** @returns {void} */
export function applyUpdate() {
  workerRegistration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
/** @param {Toast} toast @returns {Promise<void>} */
export async function initializePwa(toast) {
  window.addEventListener('beforeinstallprompt', (event) => { event.preventDefault(); installPrompt = event; });
  window.addEventListener('appinstalled', () => { installPrompt = null; });
  if (!('serviceWorker' in navigator)) return;
  try {
    // Registration must not wait for remote photos or slow page resources: on
    // Android, that could postpone the browser's install prompt indefinitely.
    // The caller has already rendered the first screen; yield once to paint it.
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    workerRegistration = await navigator.serviceWorker.register('/sw.js');
    if (workerRegistration.waiting) offerUpdate();
    workerRegistration.addEventListener('updatefound', () => {
      const installing = workerRegistration.installing;
      installing?.addEventListener('statechange', () => {
        if (installing.state === 'installed' && navigator.serviceWorker.controller) offerUpdate();
      });
    });
    let hasController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hasController) window.location.reload();
      else cacheViewedPhotos();
      hasController = true;
    });
    // Images loaded before the first worker took control still need offline copies.
    if (hasController) cacheViewedPhotos();
  } catch (error) {
    console.error('Offline setup failed', error);
    toast('Offline setup did not finish. Reopen the app when connected.');
  }
}

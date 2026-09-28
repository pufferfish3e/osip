import { t } from './i18n.mjs';
import { escapeHtml as esc } from './ui.mjs';

/** @typedef {(message:string)=>void} Toast */
let installPrompt = null;
let workerRegistration = null;

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
  if (!installPrompt) return document.querySelector('#install-dialog').showModal();
  try {
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') toast('Installation requested.');
    installPrompt = null;
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
  if (!('serviceWorker' in navigator)) return;
  try {
    // Let the visible page and its images finish before the offline installation
    // competes for bandwidth. Yield once when idle callbacks are unavailable.
    if (document.readyState !== 'complete') await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
    await new Promise((resolve) => {
      if ('requestIdleCallback' in window) window.requestIdleCallback(resolve, { timeout: 2000 });
      else window.setTimeout(resolve, 0);
    });
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

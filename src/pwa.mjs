import { t } from './i18n.mjs';
import { escapeHtml as esc } from './ui.mjs';

/** @typedef {(message:string)=>void} Toast */
let installPrompt = null;
let workerRegistration = null;

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
      hasController = true;
    });
  } catch (error) {
    console.error('Offline setup failed', error);
    toast('Offline setup did not finish. Reopen the app when connected.');
  }
}

import { getLocale, SUPPORTED_LOCALES, t } from './i18n.mjs';
import { renderPlantAction } from './plant-action.mjs';
import { escapeHtml as esc, localizeDemoState, icon, profilePhoto } from './ui.mjs';

const NAV_ITEMS = [['/', 'home', 'Home'], ['/farm', 'plant-2', 'My land'], ['/schedule', 'calendar', 'Scheduler'], ['/learn', 'book', 'Learn']];
const SHORT_LANGUAGE_LABELS = { en: 'English', ms: 'Melayu', 'zh-Hans': '中文' };
const SHELL_VIEWS = new WeakMap();

/** @param {string} path @param {string} href @returns {boolean} */
const isSelected = (path, href) => {
  const isSchedule = /^\/farm\/[^/]+\/(schedule|tasks)(?:\/|$)/.test(path);
  if (href === '/schedule') return path === '/schedule' || isSchedule;
  if (href === '/farm' && isSchedule) return false;
  return href === '/' ? path === '/' : path.startsWith(href);
};

/** @param {string} path @param {boolean} isMobile @returns {string} */
const navigation = (path, isMobile = false) => (isMobile ? [...NAV_ITEMS.slice(0, 2), ['/plant-help', '', ''], ...NAV_ITEMS.slice(2)] : NAV_ITEMS).map(([href, symbol, title]) => isMobile && href === '/plant-help' ? renderPlantAction(path) : `<a class="nav-item ${isSelected(path, href) ? 'is-active' : ''}" href="${href}" ${isSelected(path, href) ? 'aria-current="page"' : ''}>${icon(symbol, 23)}<span>${esc(t(title))}</span></a>`).join('');

/** @returns {string} */
const languagePicker = () => `<label class="language-picker"><span class="sr-only">${esc(t('Change language'))}</span><select data-language-select>${SUPPORTED_LOCALES.map(({ code, label }) => `<option value="${code}" lang="${code}" ${getLocale() === code ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="language-current" aria-hidden="true">${SHORT_LANGUAGE_LABELS[getLocale()]}${icon('chevron-down', 14)}</span></label>`;

/** @param {string} path @param {import('./store.mjs').AppState} state @returns {void} */
export function renderShell(path, state) {
  const topbar = document.querySelector('#topbar');
  const view = [getLocale(), state.profile.name, state.profile.role, state.profile.photo];
  const previousView = SHELL_VIEWS.get(topbar);
  if (previousView && view.every((value, index) => value === previousView[index])) {
    // Route changes update state on the existing controls, preserving decoded
    // images, keyboard focus, and the camera button's current mode.
    for (const selector of ['#sidebar', '#bottom-nav']) {
      const root = document.querySelector(selector);
      for (const link of root.querySelectorAll('a.nav-item[href]')) {
        const selected = isSelected(path, link.getAttribute('href'));
        link.classList.toggle('is-active', selected);
        if (selected) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
      }
      root.querySelector('[data-plant-action]')?.classList.toggle('is-active', path.startsWith('/plant-help'));
    }
    topbar.querySelector('[data-topbar-toggle="messages"]').setAttribute('aria-label', t(path === '/messages' ? 'Close messages' : 'Messages'));
    updateNotificationBell(state, path);
    return;
  }
  state = localizeDemoState(state);
  document.querySelector('#sidebar').innerHTML = `<a class="brand" href="/" aria-label="${esc(t('Aura home'))}"><img src="/assets/mark.svg" alt="" width="34" height="34">aura<span>®</span></a><p class="sidebar-caption">${esc(t('A little closer to your land.'))}</p><nav class="desktop-nav" aria-label="${esc(t('Main navigation'))}">${navigation(path)}${state.profile.role === 'pilot' ? `<a class="nav-item ${path.startsWith('/pilot') ? 'is-active' : ''}" href="/pilot">${icon('drone', 23)}<span>${esc(t('Pilot workspace'))}</span></a>` : ''}</nav><div class="sidebar-secondary">${/* Pesticide calculator disabled; restore this link with its route.
<a href="/tools">${icon('calculator', 20)} ${esc(t('Pesticide calculator'))}</a>
*/ ''}<a href="/services">${icon('drone',20)} ${esc(t('Services'))}</a><a href="/weather">${icon('cloud', 20)} ${esc(t('Weather'))}</a><a href="/plant-help">${icon('camera', 20)} ${esc(t('Plant help'))}</a><a href="/bookings">${icon('calendar', 20)} ${esc(t('My bookings'))}</a><a href="/news">${icon('leaf', 20)} ${esc(t('Latest stories'))}</a><a href="/messages">${icon('message-circle', 20)} ${esc(t('Messages'))}</a></div><div class="sidebar-bottom"><button data-action="install" class="install-card">${icon('device-mobile', 24)}<span><strong>${esc(t('Take Aura to the field'))}</strong><small>${esc(t('Install your farm companion'))}</small></span>${icon('arrow-up-right', 18)}</button><a class="sidebar-profile" href="/account"><span class="avatar">${profilePhoto(state.profile)}</span><span class="row-copy"><strong>${esc(state.profile.name)}</strong><small>${esc(t(state.profile.role === 'pilot' ? 'Drone pilot account' : 'Farmer account'))}</small></span>${icon('settings', 20)}</a></div>`;
  document.querySelector('#topbar').innerHTML = `<a class="mobile-brand" href="/" aria-label="${esc(t('Aura home'))}"><img src="/assets/mark.svg" alt="" width="30" height="30">aura<span>®</span></a><div class="topbar-context"><span id="connection-status">${esc(t(navigator.onLine ? 'Your field companion' : 'Offline · saved on this device'))}</span></div><div class="topbar-actions">${languagePicker()}<a class="icon-button" href="/messages" data-topbar-toggle="messages" aria-label="${esc(t(path === '/messages' ? 'Close messages' : 'Messages'))}">${icon('message-circle')}</a>${renderNotificationBell(state, path)}<a href="/account" class="avatar small-avatar" aria-label="${esc(t('Your account'))}">${profilePhoto(state.profile)}</a></div>`;
  document.querySelector('#bottom-nav').innerHTML = navigation(path, true);
  SHELL_VIEWS.set(topbar, view);
}

/** Update unread status without replacing the focused bell or its SVG. */
export function updateNotificationBell(state, path = '') {
  const bell = document.querySelector('.notification-bell');
  if (!bell) return;
  const count = state.notifications.filter((item) => !item.read).length;
  bell.classList.toggle('has-unread', count > 0);
  bell.setAttribute('aria-label', notificationLabel(count, path));
  let badge = bell.querySelector('.notification-bell-count');
  if (!count) { badge?.remove(); return; }
  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'notification-bell-count';
    badge.setAttribute('aria-hidden', 'true');
    bell.append(badge);
  }
  badge.textContent = count > 99 ? '99+' : String(count);
}

const notificationLabel = (count, path) => `${t(path === '/notifications' ? 'Close notifications' : 'Notifications')}${path !== '/notifications' && count ? ` · ${t('{count} unread', {count})}` : ''}`;

/** @param {import('./store.mjs').AppState} state @param {string} [path] @returns {string} */
export function renderNotificationBell(state, path = '') {
  const count = state.notifications.filter((item)=>!item.read).length;
  return `<a class="icon-button notification-bell ${count ? 'has-unread' : ''}" href="/notifications" data-topbar-toggle="notifications" aria-label="${esc(notificationLabel(count, path))}">${icon('bell')}${count ? `<span class="notification-bell-count" aria-hidden="true">${count > 99 ? '99+' : count}</span>` : ''}</a>`;
}

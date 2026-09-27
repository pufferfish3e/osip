import { getLocale, SUPPORTED_LOCALES, t } from './i18n.mjs';
import { renderPlantAction } from './plant-action.mjs';
import { escapeHtml as esc, localizeDemoState, icon, profilePhoto } from './ui.mjs';

const NAV_ITEMS = [['/', 'home', 'Home'], ['/farm', 'plant-2', 'My land'], ['/services', 'drone', 'Services'], ['/learn', 'book', 'Learn']];
const SHORT_LANGUAGE_LABELS = { en: 'English', ms: 'Melayu', 'zh-Hans': '中文' };

/** @param {string} path @param {string} href @returns {boolean} */
const isSelected = (path, href) => href === '/' ? path === '/' : path.startsWith(href) || (href === '/services' && path.startsWith('/shop'));

/** @param {string} path @param {boolean} isMobile @returns {string} */
const navigation = (path, isMobile = false) => (isMobile ? [...NAV_ITEMS.slice(0, 2), ['/plant-help', '', ''], ...NAV_ITEMS.slice(2)] : NAV_ITEMS).map(([href, symbol, title]) => isMobile && href === '/plant-help' ? renderPlantAction(path) : `<a class="nav-item ${isSelected(path, href) ? 'is-active' : ''}" href="${href}" ${isSelected(path, href) ? 'aria-current="page"' : ''}>${icon(symbol, 23)}<span>${esc(t(title))}</span></a>`).join('');

/** @returns {string} */
const languagePicker = () => `<label class="language-picker"><span class="sr-only">${esc(t('Change language'))}</span><select data-language-select>${SUPPORTED_LOCALES.map(({ code, label }) => `<option value="${code}" lang="${code}" ${getLocale() === code ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="language-current" aria-hidden="true">${SHORT_LANGUAGE_LABELS[getLocale()]}${icon('chevron-down', 14)}</span></label>`;

/** @param {string} path @param {import('./store.mjs').AppState} state @returns {void} */
export function renderShell(path, state) {
  state = localizeDemoState(state);
  document.querySelector('#sidebar').innerHTML = `<a class="brand" href="/" aria-label="${esc(t('Aura home'))}"><img src="/assets/mark.svg" alt="" width="34" height="34">aura<span>®</span></a><p class="sidebar-caption">${esc(t('A little closer to your land.'))}</p><nav class="desktop-nav" aria-label="${esc(t('Main navigation'))}">${navigation(path)}${state.profile.role === 'pilot' ? `<a class="nav-item ${path.startsWith('/pilot') ? 'is-active' : ''}" href="/pilot">${icon('drone', 23)}<span>${esc(t('Pilot workspace'))}</span></a>` : ''}</nav><div class="sidebar-secondary"><a href="/plant-help">${icon('camera', 20)} ${esc(t('Plant help'))}</a><a href="/bookings">${icon('calendar', 20)} ${esc(t('My bookings'))}</a><a href="/news">${icon('leaf', 20)} ${esc(t('Latest stories'))}</a><a href="/messages">${icon('message-circle', 20)} ${esc(t('Messages'))}</a></div><div class="sidebar-bottom"><button data-action="install" class="install-card">${icon('device-mobile', 24)}<span><strong>${esc(t('Take Aura to the field'))}</strong><small>${esc(t('Install your farm companion'))}</small></span>${icon('arrow-up-right', 18)}</button><a class="sidebar-profile" href="/account"><span class="avatar">${profilePhoto(state.profile)}</span><span class="row-copy"><strong>${esc(state.profile.name)}</strong><small>${esc(t(state.profile.role === 'pilot' ? 'Drone pilot account' : 'Farmer account'))}</small></span>${icon('settings', 20)}</a></div>`;
  document.querySelector('#topbar').innerHTML = `<a class="mobile-brand" href="/">aura<span>®</span></a><div class="topbar-context"><span id="connection-status">${esc(t(navigator.onLine ? 'Your field companion' : 'Offline · saved on this device'))}</span></div><div class="topbar-actions">${languagePicker()}<a class="icon-button" href="/messages" aria-label="${esc(t('Messages'))}">${icon('message-circle')}</a><a class="icon-button" href="/notifications" aria-label="${esc(t('Notifications'))}">${icon('bell')}</a><a href="/account" class="avatar small-avatar" aria-label="${esc(t('Your account'))}">${profilePhoto(state.profile)}</a></div>`;
  document.querySelector('#bottom-nav').innerHTML = navigation(path, true);
}

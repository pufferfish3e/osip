import { CORE_TRANSLATIONS } from './locales/core.mjs';
import { DISCOVER_TRANSLATIONS } from './locales/discover.mjs';
import { PLANT_TRANSLATIONS } from './locales/plant.mjs';
import { WORKSPACE_TRANSLATIONS } from './locales/workspace.mjs';

/** @typedef {'en'|'ms'|'zh-Hans'} Locale */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} LocaleStorage */

export const SUPPORTED_LOCALES = Object.freeze([
  { code: 'en', label: 'English' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'zh-Hans', label: '中文' },
]);
const LANGUAGE_STORAGE_KEY = 'osip-language';
const FORMAT_LOCALES = { en: 'en-MY', ms: 'ms-MY', 'zh-Hans': 'zh-Hans-MY' };
const TRANSLATIONS = {
  ms: { ...CORE_TRANSLATIONS.ms, ...WORKSPACE_TRANSLATIONS.ms, ...DISCOVER_TRANSLATIONS.ms, ...PLANT_TRANSLATIONS.ms },
  'zh-Hans': { ...CORE_TRANSLATIONS['zh-Hans'], ...WORKSPACE_TRANSLATIONS['zh-Hans'], ...DISCOVER_TRANSLATIONS['zh-Hans'], ...PLANT_TRANSLATIONS['zh-Hans'] },
};
/** @type {Locale} */
let activeLocale = 'en';

/** @param {unknown} value @returns {value is Locale} */
const isLocale = (value) => SUPPORTED_LOCALES.some(({ code }) => code === value);

/** @param {unknown} locale @returns {Locale} */
const requireLocale = (locale) => {
  if (!isLocale(locale)) throw new RangeError('Unsupported language preference.');
  return locale;
};

/** @returns {Locale} */
export function getLocale() {
  return activeLocale;
}

/** @param {unknown} locale @returns {Locale} */
export function setLocale(locale) {
  activeLocale = requireLocale(locale);
  return activeLocale;
}

/** @returns {string} */
export function getFormatLocale() {
  return FORMAT_LOCALES[activeLocale];
}

/** Text stays unescaped here so the rendering boundary can safely escape once.
 * @param {string} message @param {Record<string,string|number>} params @returns {string}
 */
export function t(message, params = {}) {
  const dictionary = activeLocale === 'en' ? null : TRANSLATIONS[activeLocale];
  const translation = dictionary && Object.hasOwn(dictionary, message) ? dictionary[message] : message;
  return translation.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (placeholder, name) => Object.hasOwn(params, name) ? String(params[name]) : placeholder);
}

/** @param {LocaleStorage|null|undefined} storage @returns {Locale} */
export function loadLocale(storage) {
  try {
    const saved = storage?.getItem(LANGUAGE_STORAGE_KEY);
    return setLocale(isLocale(saved) ? saved : 'en');
  } catch (error) {
    console.warn('Aura could not read the saved language; using English.', error);
    return setLocale('en');
  }
}

/** Distinguishes a displayed language change from a preference saved for later. */
export class LanguagePersistenceError extends Error {
  /** @param {unknown} cause */
  constructor(cause) {
    super('Could not save your language preference.', { cause });
    this.name = 'LanguagePersistenceError';
  }
}

/** @param {LocaleStorage|null|undefined} storage @param {unknown} locale @returns {Locale} */
export function saveLocale(storage, locale) {
  const validLocale = requireLocale(locale);
  try {
    if (!storage) throw new Error('Local device storage is unavailable.');
    storage.setItem(LANGUAGE_STORAGE_KEY, validLocale);
    return validLocale;
  } catch (error) {
    throw new LanguagePersistenceError(error);
  }
}

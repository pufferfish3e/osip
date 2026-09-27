import { getLocale, loadLocale, t } from './i18n.mjs';

/** @typedef {{key:string,value:string,isChecked:boolean,selected:string[]}} FieldSnapshot */
const FORM_SELECTOR = 'input:not([type="file"]):not([type="hidden"]),select,textarea';

/** @param {Element} root @returns {{fields:FieldSnapshot[],openDetails:boolean[]}} */
export function captureFormState(root) {
  const fields = [...root.querySelectorAll(FORM_SELECTOR)].map((field, index) => ({
    key: `${index}:${field.getAttribute('name') ?? ''}:${field.tagName}`,
    value: field.value,
    isChecked: Boolean(field.checked),
    selected: field.multiple ? [...field.selectedOptions].map((option) => option.value) : [],
  }));
  return { fields, openDetails: [...root.querySelectorAll('details')].map((detail) => detail.open) };
}

/** @param {Element} root @param {ReturnType<typeof captureFormState>} snapshot @returns {void} */
export function restoreFormState(root, snapshot) {
  const controls = [...root.querySelectorAll(FORM_SELECTOR)];
  for (const [index, field] of controls.entries()) {
    const saved = snapshot.fields[index];
    const key = `${index}:${field.getAttribute('name') ?? ''}:${field.tagName}`;
    if (!saved || saved.key !== key || field.name === 'language') continue;
    field.value = saved.value;
    if ('checked' in field) field.checked = saved.isChecked;
    if (field.multiple) for (const option of field.options) option.selected = saved.selected.includes(option.value);
  }
  [...root.querySelectorAll('details')].forEach((detail, index) => { detail.open = snapshot.openDetails[index] ?? false; });
}

/** @param {Document} document @returns {void} */
export function localizeDocument(document) {
  document.documentElement.lang = getLocale();
  for (const element of document.querySelectorAll('[data-i18n-content]')) element.setAttribute('content', t(element.dataset.i18nContent));
  for (const element of document.querySelectorAll('[data-i18n]')) element.textContent = t(element.dataset.i18n);
  for (const element of document.querySelectorAll('[data-i18n-label]')) element.setAttribute('aria-label', t(element.dataset.i18nLabel));
}

/** @param {Document} document @returns {void} */
export function initializeStaticLanguage(document) {
  try { loadLocale(localStorage); }
  catch (error) { console.warn('Language storage unavailable.', error); loadLocale(null); }
  localizeDocument(document);
}

/** @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} field @returns {void} */
export function localizeValidation(field) {
  field.setCustomValidity('');
  const validity = field.validity;
  if (validity.valid) return;
  let message = t('Please enter a valid value.');
  if (validity.valueMissing) message = t('Please complete this field.');
  else if (validity.rangeUnderflow) message = t('Use a value of at least {min}.', { min: field.getAttribute('min') ?? '' });
  else if (validity.rangeOverflow) message = t('Use a value no greater than {max}.', { max: field.getAttribute('max') ?? '' });
  else if (validity.patternMismatch || validity.stepMismatch) message = t('Please use the requested format.');
  field.setCustomValidity(message);
}

/** @param {Document} document @returns {void} */
export function initializeLocalizedValidation(document) {
  /** @param {EventTarget|null} field @returns {boolean} */
  const isField = (field) => field instanceof HTMLInputElement || field instanceof HTMLSelectElement || field instanceof HTMLTextAreaElement;
  document.addEventListener('invalid', (event) => { if (isField(event.target)) localizeValidation(event.target); }, true);
  document.addEventListener('input', (event) => { if (isField(event.target)) event.target.setCustomValidity(''); });
  document.addEventListener('change', (event) => { if (isField(event.target)) event.target.setCustomValidity(''); });
}

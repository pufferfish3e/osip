/** @typedef {'farmer-onboarding' | 'pilot-onboarding' | 'verification'} DraftKey */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void,removeItem:(key:string)=>void}} DraftStorage */

const DRAFT_PREFIX = 'osip-onboarding-draft-v1:';
const ALLOWED_FIELDS = Object.freeze({
  'farmer-onboarding': ['name', 'farmName', 'location', 'crop', 'area'],
  'pilot-onboarding': ['name', 'area', 'services', 'equipment', 'rate'],
  verification: ['credentialReference'],
});

/** A draft failure must be visible without overwriting the last saved progress. */
export class DraftError extends Error {
  /** @param {string} message @param {unknown} [cause] */
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'DraftError';
  }
}

/** @param {DraftKey} key @returns {string} */
const storageKey = (key) => {
  if (!Object.hasOwn(ALLOWED_FIELDS, key)) throw new DraftError('This form does not support saved onboarding progress.');
  return `${DRAFT_PREFIX}${key}`;
};

/** @param {DraftKey} key @param {unknown} fields @returns {Record<string,string>} */
const validateFields = (key, fields) => {
  if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) {
    throw new DraftError('Saved onboarding details must contain text fields.');
  }
  const entries = Object.entries(fields);
  if (!entries.every(([name, value]) => ALLOWED_FIELDS[key].includes(name) && typeof value === 'string')) {
    throw new DraftError('Only the supported onboarding text fields can be saved.');
  }
  return Object.fromEntries(entries);
};

/** @param {DraftStorage} storage @param {DraftKey} key @returns {Record<string,string>|null} */
export function readDraft(storage, key) {
  const scopedKey = storageKey(key);
  try {
    const raw = storage.getItem(scopedKey);
    return raw === null ? null : validateFields(key, JSON.parse(raw));
  } catch (cause) {
    throw new DraftError('Could not restore your onboarding draft. Your saved data has been kept.', cause);
  }
}

/** @param {DraftStorage} storage @param {DraftKey} key @param {Record<string,string>} fields @returns {void} */
export function saveDraft(storage, key, fields) {
  const scopedKey = storageKey(key);
  const validated = validateFields(key, fields);
  try {
    storage.setItem(scopedKey, JSON.stringify(validated));
  } catch (cause) {
    throw new DraftError('Could not save your onboarding progress on this device.', cause);
  }
}

/** @param {DraftStorage} storage @param {DraftKey} key @returns {void} */
export function clearDraft(storage, key) {
  const scopedKey = storageKey(key);
  try {
    storage.removeItem(scopedKey);
  } catch (cause) {
    throw new DraftError('Could not clear the saved onboarding draft on this device.', cause);
  }
}

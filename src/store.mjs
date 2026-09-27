import { isProfilePhoto } from './profile-photo.mjs';
import { INITIAL_STATE } from './data.mjs';
import { isFieldBoundary } from './field-boundary.mjs';
import { isLandBoundary } from './land-boundary.mjs';
import { STORAGE_PROFILE } from './storage-seed.mjs';

/** @typedef {'farmer' | 'pilot'} Role */
/** @typedef {{id:string,name:string,crop:string,area:number,plantedAt:string,boundary?:import('./land-boundary.mjs').LandPoint[],isAreaEstimated?:boolean,gridNumber?:number,mixtureConfig?:import('./mixture-planner.mjs').Recipe}} Plot */
/** @typedef {{id:string,name:string,location:string,crop:string,area:number,unit:string,plantedAt:string,plots:Plot[],isDemo?:boolean,coverImage?:string,boundary?:import('./land-boundary.mjs').LandPoint[]}} Farm */
/** @typedef {{id:string,farmId:string,plotId?:string,title:string,dueDate:string,time:string,category:string,done:boolean,reminder:boolean,repeat?:'none'|'daily'|'weekly'|'monthly',repeatAnchorDay?:number,repeatFromId?:string,completedAt?:string}} Task */
/** @typedef {{id:string,sender:string,text:string,date:string}} Message */
/** @typedef {{id:string,type:'pilot'|'course',providerId:string,title:string,date:string,time:string,farmId:string,status:string,notes:string,price:number,conversation:Message[],service?:string,direction?:string,rescheduleRequest?:{date:string,time:string}}} Booking */
/** @typedef {{productId:string,quantity:number}} CartItem */
/** @typedef {{id:string,items:CartItem[],total:number,status:string,date:string}} Order */
/** @typedef {{id?:string,type:string,title:string,inputs?:Record<string,unknown>,result:number,unit:string,date:string}} SavedCalculation */
/** @typedef {{id:string,title:string,body:string,date:string,read:boolean}} Notification */
/**
 * @typedef {object} AppState
 * @property {{name:string,firstName?:string,lastName?:string,photo?:string,role:Role,roles:Role[],onboarded:boolean,hasChosenRole?:boolean}} profile
 * @property {Farm[]} farms
 * @property {Task[]} tasks
 * @property {Booking[]} bookings
 * @property {CartItem[]} cart
 * @property {Order[]} orders
 * @property {string[]} savedArticles
 * @property {SavedCalculation[]} savedCalculations
 * @property {{services:string[],area:string,equipment:string,rate:number,credentialReference:string,availability:{days:string[],timeStart:string,timeEnd:string},verification:string}} pilot
 * @property {{unit:string,language:string,currency:string,mapType?:'street'|'satellite'}} settings
 * @property {Notification[]} notifications
 */
/** @typedef {{getItem:(key:string)=>string|null,setItem:(key:string,value:string)=>void}} StorageAdapter */
/** @typedef {(state:AppState)=>void} StoreListener */
/** @typedef {{getState:()=>AppState,update:(mutator:(state:AppState)=>void)=>void,subscribe:(listener:StoreListener)=>()=>void,readonly lastError:Error|null}} AppStore */

const DEMO_STORAGE_KEY = 'osip-state-v2';
export const STORAGE_KEY = STORAGE_PROFILE === 'demo' ? DEMO_STORAGE_KEY : `${DEMO_STORAGE_KEY}-newuser`;
const LEGACY_STORAGE_KEY = 'osip-checklist-v1';
const STATE_VERSION = 2;
const LEGACY_TASK_IDS = ['soil', 'crops', 'water'];
const ROLES = ['farmer', 'pilot'];
const ARRAY_FIELDS = ['farms', 'tasks', 'bookings', 'cart', 'orders', 'savedArticles', 'savedCalculations', 'notifications'];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Saved records that cannot satisfy the current local model are rejected. */
export class StateValidationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'StateValidationError';
  }
}

/** A persistence failure must remain distinguishable from a successful save. */
export class PersistenceError extends Error {
  /** @param {string} message @param {unknown} cause */
  constructor(message, cause) {
    super(message, { cause });
    this.name = 'PersistenceError';
  }
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

/** @param {boolean} isValid @param {string} message @returns {void} */
const requireValid = (isValid, message) => {
  if (!isValid) throw new StateValidationError(message);
};

/** @param {unknown} value @param {string[]} fields @returns {boolean} */
const hasStrings = (value, fields) => isRecord(value) && fields.every((field) => typeof value[field] === 'string');

/** @param {unknown} value @returns {value is number} */
const isAmount = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0;

/** @param {unknown} value @returns {value is string[]} */
const isStringList = (value) => Array.isArray(value) && value.every((item) => typeof item === 'string');

/** @param {unknown} value @returns {boolean} */
const isDate = (value) => {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

/** @param {unknown} value @param {(item:unknown)=>boolean} predicate @returns {boolean} */
const isListOf = (value, predicate) => Array.isArray(value) && value.every(predicate);

/** @param {unknown} value @returns {boolean} */
const isPlot = (value) => isRecord(value) && hasStrings(value, ['id', 'name', 'crop', 'plantedAt']) && isAmount(value.area)
  && (value.boundary === undefined || isFieldBoundary(value.boundary))
  && (value.isAreaEstimated === undefined || typeof value.isAreaEstimated === 'boolean');

/** @param {unknown} value @returns {boolean} */
const isFarm = (value) => isRecord(value) && hasStrings(value, ['id', 'name', 'location', 'crop', 'unit', 'plantedAt'])
  && isAmount(value.area) && isListOf(value.plots, isPlot)
  && (value.boundary === undefined || isLandBoundary(value.boundary));

/** @param {unknown} value @returns {boolean} */
const isTask = (value) => isRecord(value) && hasStrings(value, ['id', 'farmId', 'title', 'dueDate', 'time', 'category'])
  && isDate(value.dueDate) && typeof value.done === 'boolean' && typeof value.reminder === 'boolean'
  && (value.completedAt === undefined || (typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt))))
  && (value.plotId === undefined || typeof value.plotId === 'string')
  && (value.repeat === undefined || ['none', 'daily', 'weekly', 'monthly'].includes(value.repeat))
  && (value.repeatFromId === undefined || typeof value.repeatFromId === 'string')
  && (value.repeatAnchorDay === undefined || (Number.isInteger(value.repeatAnchorDay) && value.repeatAnchorDay >= 1 && value.repeatAnchorDay <= 31));

/** @param {unknown} value @returns {boolean} */
const isMessage = (value) => hasStrings(value, ['id', 'sender', 'text', 'date']);

/** @param {unknown} value @returns {boolean} */
const isBooking = (value) => isRecord(value) && hasStrings(value, ['id', 'providerId', 'title', 'date', 'time', 'farmId', 'status', 'notes'])
  && ['pilot', 'course'].includes(String(value.type)) && isAmount(value.price) && isDate(value.date) && isListOf(value.conversation, isMessage);

/** @param {unknown} value @returns {boolean} */
const isCartItem = (value) => isRecord(value) && hasStrings(value, ['productId']) && typeof value.quantity === 'number'
  && Number.isSafeInteger(value.quantity) && value.quantity > 0;

/** @param {unknown} value @returns {boolean} */
const isOrder = (value) => isRecord(value) && hasStrings(value, ['id', 'status', 'date'])
  && isAmount(value.total) && isListOf(value.items, isCartItem);

/** @param {unknown} value @returns {boolean} */
const isCalculation = (value) => isRecord(value) && hasStrings(value, ['type', 'title', 'unit', 'date'])
  && typeof value.result === 'number' && Number.isFinite(value.result);

/** @param {unknown} value @returns {boolean} */
const isNotification = (value) => isRecord(value) && hasStrings(value, ['id', 'title', 'body', 'date']) && typeof value.read === 'boolean';

/** @param {Record<string,unknown>} value @returns {void} */
const validateProfileAndSettings = (value) => {
  const { profile, settings } = value;
  requireValid(isRecord(profile) && hasStrings(profile, ['name', 'role']) && ROLES.includes(String(profile.role))
    && isStringList(profile.roles) && profile.roles.every((role) => ROLES.includes(role))
    && (profile.firstName === undefined || typeof profile.firstName === 'string')
    && (profile.lastName === undefined || typeof profile.lastName === 'string')
    && isProfilePhoto(profile.photo)
    && typeof profile.onboarded === 'boolean'
    && (profile.hasChosenRole === undefined || typeof profile.hasChosenRole === 'boolean'), 'Saved profile is invalid.');
  requireValid(hasStrings(settings, ['unit', 'language', 'currency']), 'Saved preferences are invalid.');
  requireValid(settings.mapType === undefined || ['street', 'satellite'].includes(settings.mapType), 'Saved preferences are invalid.');
};

/** @param {unknown} value @returns {void} */
const validatePilot = (value) => {
  requireValid(isRecord(value) && hasStrings(value, ['area', 'equipment', 'verification', 'credentialReference'])
    && isStringList(value.services) && isAmount(value.rate), 'Saved pilot profile is invalid.');
  if (!isRecord(value)) return;
  const availability = value.availability;
  requireValid(isRecord(availability) && isStringList(availability.days)
    && hasStrings(availability, ['timeStart', 'timeEnd']), 'Saved pilot availability is invalid.');
};

/** @param {unknown} value @returns {asserts value is AppState} */
const validateState = (value) => {
  requireValid(isRecord(value), 'Saved data must contain an Aura profile.');
  if (!isRecord(value)) return;
  requireValid(ARRAY_FIELDS.every((field) => Array.isArray(value[field])), 'Saved collections are missing.');
  validateProfileAndSettings(value);
  validatePilot(value.pilot);
  requireValid(isListOf(value.farms, isFarm), 'Saved farm records are invalid.');
  requireValid(isListOf(value.tasks, isTask), 'Saved tasks are invalid.');
  requireValid(isListOf(value.bookings, isBooking), 'Saved bookings are invalid.');
  requireValid(isListOf(value.cart, isCartItem), 'Saved cart is invalid.');
  requireValid(isListOf(value.orders, isOrder), 'Saved orders are invalid.');
  requireValid(isStringList(value.savedArticles), 'Saved guide selections are invalid.');
  requireValid(isListOf(value.savedCalculations, isCalculation), 'Saved calculations are invalid.');
  requireValid(isListOf(value.notifications, isNotification), 'Saved notifications are invalid.');
};

/** @param {string} raw @returns {AppState} */
const parseSavedState = (raw) => {
  /** @type {unknown} */
  const envelope = JSON.parse(raw);
  requireValid(isRecord(envelope) && envelope.version === STATE_VERSION, 'Saved data uses an unsupported Aura version.');
  if (!isRecord(envelope)) throw new StateValidationError('Saved data is invalid.');
  validateState(envelope.state);
  return /** @type {AppState} */ (envelope.state);
};

/** @param {string | null} raw @param {AppState} seed @returns {AppState} */
const migrateChecklist = (raw, seed) => {
  const state = structuredClone(seed);
  if (raw === null) return state;
  /** @type {unknown} */
  const checked = JSON.parse(raw);
  requireValid(isStringList(checked) && checked.every((id) => LEGACY_TASK_IDS.includes(id)), 'The original checklist could not be restored.');
  if (!isStringList(checked)) return state;
  state.tasks = state.tasks.map((task) => ({ ...task, done: checked.includes(task.id) }));
  return state;
};

/** @param {StorageAdapter | undefined} provided @param {AppState} seed @param {string} profile @returns {{storage:StorageAdapter|null,state:AppState,key:string,error:Error|null}} */
const loadState = (provided, seed, profile) => {
  let storage = provided ?? null;
  const key = profile === 'demo' ? DEMO_STORAGE_KEY : `${DEMO_STORAGE_KEY}-newuser`;
  try {
    storage = provided ?? globalThis.localStorage;
    if (!storage) throw new Error('Local device storage is unavailable.');
    const raw = storage.getItem(key);
    const state = raw === null ? migrateChecklist(profile === 'demo' ? storage.getItem(LEGACY_STORAGE_KEY) : null, seed) : parseSavedState(raw);
    if (raw === null) storage.setItem(key, JSON.stringify({ version:STATE_VERSION, state }));
    return { storage, state, key, error: null };
  } catch (cause) {
    return { storage, state: structuredClone(seed), key, error: new PersistenceError('Saved data could not be loaded. Default records are shown; previous storage has been kept.', cause) };
  }
};

/** @param {Set<StoreListener>} listeners @param {AppState} state @returns {void} */
const notifyListeners = (listeners, state) => {
  for (const listener of listeners) {
    try {
      listener(structuredClone(state));
    } catch (error) {
      console.error('Aura state listener failed after a successful save.', error);
    }
  }
};

/** @param {AppState} state @param {(draft:AppState)=>void} mutator @returns {AppState} */
const prepareUpdate = (state, mutator) => {
  const draft = structuredClone(state);
  /** @type {unknown} */
  const result = mutator(draft);
  requireValid(!(result instanceof Promise), 'State changes must be synchronous.');
  validateState(draft);
  return structuredClone(draft);
};

/** @param {StorageAdapter | undefined} storage @param {AppState} seed @param {string} profile @returns {AppStore} */
export function createStore(storage = undefined, seed = INITIAL_STATE, profile = STORAGE_PROFILE) {
  if (!['demo', 'newuser'].includes(profile)) throw new StateValidationError('Storage profile must be demo or newuser.');
  validateState(seed);
  const loaded = loadState(storage, seed, profile);
  let state = loaded.state;
  let lastError = loaded.error;
  /** @type {Set<StoreListener>} */
  const listeners = new Set();
  /** @param {(draft:AppState)=>void} mutator @returns {void} */
  const update = (mutator) => {
    let nextState;
    try {
      nextState = prepareUpdate(state, mutator);
    } catch (cause) {
      lastError = cause instanceof Error ? cause : new StateValidationError('This change could not be applied.');
      throw lastError;
    }
    try {
      if (!loaded.storage) throw new Error('Local device storage is unavailable.');
      loaded.storage.setItem(loaded.key, JSON.stringify({ version: STATE_VERSION, state: nextState }));
    } catch (cause) {
      lastError = new PersistenceError('Could not save changes on this device.', cause);
      throw lastError;
    }
    state = nextState;
    lastError = null;
    notifyListeners(listeners, state);
  };
  return {
    getState: () => structuredClone(state), update,
    subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    get lastError() { return lastError; },
  };
}

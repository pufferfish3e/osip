import { ARTICLES, COURSES, PILOTS, PRODUCTS } from './data.mjs';
import { getLocale, SUPPORTED_LOCALES, t } from './i18n.mjs';

/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {{redirect?:string,message:string}} ActionResult */
/** @typedef {Record<string,string|string[]>} Fields */
const FIELD_LABELS = { name: 'name', farmName: 'farm name', crop: 'crop', area: 'area', location: 'location', farmId: 'farm', dueDate: 'date', time: 'time', title: 'task title', category: 'category', providerId: 'provider', date: 'date', services: 'services', equipment: 'equipment', rate: 'rate', bookingId: 'booking', message: 'message', timeStart: 'start time', timeEnd: 'end time', credentialReference: 'credential reference', units: 'area unit' };

/** @param {string} key @returns {string} */
const fieldLabel = (key) => t(FIELD_LABELS[key] ?? key);

const MAX_QUANTITY = 99;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const ACTIVE_BOOKING_STATUSES = ['requested', 'accepted', 'confirmed'];

export class ActionError extends Error {
  /** @param {string} message */
  constructor(message) { super(t(message)); this.name = 'ActionError'; }
}
/** @param {string} prefix @returns {string} */
const makeId = (prefix) => `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
/** @returns {string} */
const timestamp = () => new Date().toISOString();
/** @param {Fields} fields @param {string} key @param {boolean} required @returns {string} */
const text = (fields, key, required = true) => {
  const value = String(fields[key] ?? '').trim();
  if (required && !value) throw new ActionError(t('Please enter {field}.', { field: fieldLabel(key) }));
  if (value.length > 2000) throw new ActionError('This entry is too long. Please shorten it.');
  return value;
};
/** @param {Fields} fields @param {string} key @param {number} min @returns {number} */
const amount = (fields, key, min = 0) => {
  const value = Number(text(fields, key));
  if (!Number.isFinite(value) || value < min) throw new ActionError(t('Enter a valid {field}.', { field: fieldLabel(key) }));
  return value;
};
/** @template T @param {T[]} items @param {(item:T)=>boolean} match @param {string} label @returns {T} */
const find = (items, match, label) => {
  const item = items.find(match);
  if (!item) throw new ActionError(t('{record} was not found.', { record: t(label) }));
  return item;
};
/** @param {string} date @param {string} time @returns {void} */
const validateSchedule = (date, time) => {
  const scheduled = new Date(`${date}T${time}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !TIME_PATTERN.test(time) || !Number.isFinite(scheduled.valueOf())) throw new ActionError('Choose a valid date and time.');
  const [year, month, day] = date.split('-').map(Number);
  if (scheduled.getFullYear() !== year || scheduled.getMonth() + 1 !== month || scheduled.getDate() !== day) throw new ActionError('This date does not exist.');
};
/** @param {AppState} state @param {string} title @param {string} body @returns {void} */
const notify = (state, title, body) => state.notifications.unshift({ id: makeId('note'), title, body, date: timestamp(), read: false });
/** @param {AppState} state @param {Fields} fields @param {boolean} isOnboarding @returns {ActionResult} */
const saveFarm = (state, fields, isOnboarding) => {
  const name = text(fields, isOnboarding ? 'farmName' : 'name');
  const crop = text(fields, 'crop');
  const area = isOnboarding ? 0 : amount(fields, 'area', 0.01);
  const farm = { id: makeId('farm'), name, crop, area, location: text(fields, 'location'), unit: 'ha', plantedAt: '', plots: [], isDemo: false };
  if (isOnboarding) {
    saveProfileName(state, fields);
    state.profile.onboarded = true;
    state.profile.hasChosenRole = true;
    state.profile.role = 'farmer';
    if (!state.profile.roles.includes('farmer')) state.profile.roles.push('farmer');
  }
  state.farms.push(farm);
  const redirect = isOnboarding ? (state.profile.roles.includes('pilot') ? '/onboarding/pilot' : '/') : `/farm/${farm.id}`;
  return { redirect, message: t('Farm saved on this device.') };
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const savePlot = (state, fields) => {
  const farm = find(state.farms, (item) => item.id === text(fields, 'farmId'), 'Farm');
  const area = amount(fields, 'area', 0.01);
  const allocated = farm.plots.reduce((sum, plot) => sum + plot.area, 0);
  if (area + allocated - farm.area > Number.EPSILON * Math.max(farm.area, 1) * 10) throw new ActionError('Plot areas cannot exceed the farm area.');
  const plantedAt = text(fields, 'plantedAt', false);
  if (plantedAt) validateSchedule(plantedAt, '12:00');
  const id = makeId('plot');
  farm.plots.push({ id, name: text(fields, 'name'), crop: text(fields, 'crop'), area, plantedAt });
  return { redirect: `/farm/${farm.id}/plots/${id}`, message: t('Plot saved.') };
};
/** @param {Fields} fields @param {import('./store.mjs').Farm} farm @param {string} fallback @returns {string[]} */
const selectedTaskFields = (fields, farm, fallback) => {
  if (fields.plotIds === undefined) return [fallback];
  if (!Array.isArray(fields.plotIds) || !fields.plotIds.length || fields.plotIds.some((id) => typeof id !== 'string')) throw new ActionError('Choose at least one field.');
  const ids = [...new Set(fields.plotIds)];
  for (const id of ids) if (id) find(farm.plots, (plot) => plot.id === id, 'Field');
  if (ids.includes('') && ids.length > 1) throw new ActionError('Choose whole land or individual fields.');
  return ids;
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const saveTask = (state, fields) => {
  const farmId = text(fields, 'farmId');
  const farm = find(state.farms, (farm) => farm.id === farmId, 'Farm');
  const dueDate = text(fields, 'dueDate');
  const time = text(fields, 'time');
  validateSchedule(dueDate, time);
  const id = text(fields, 'id', false);
  const creationKey = text(fields, 'creationKey', false);
  const prior = !id && creationKey ? state.tasks.find((task) => task.creationKey === creationKey && task.farmId === farmId) : null;
  if (prior) return { redirect: `/farm/${farmId}/schedule`, message: t('Event created') };
  const existing = id ? find(state.tasks, (task) => task.id === id && task.farmId === farmId, 'Task') : undefined;
  const plotId = fields.plotId === undefined ? existing?.plotId ?? '' : text(fields, 'plotId', false);
  const plotIds = selectedTaskFields(fields, farm, plotId);
  for (const selectedId of plotIds) if (selectedId) find(farm.plots, (plot) => plot.id === selectedId, 'Field');
  const repeat = text(fields, 'repeat', false) || existing?.repeat || 'none';
  if (!['none', 'daily', 'weekly', 'monthly'].includes(repeat)) throw new ActionError('Choose a valid repeat frequency.');
  const repeatAnchorDay = existing?.dueDate === dueDate ? (existing.repeatAnchorDay ?? Number(dueDate.slice(8))) : Number(dueDate.slice(8));
  const next = { ...(creationKey ? { creationKey } : {}), repeat, repeatAnchorDay, id: id || makeId('task'), farmId, plotId, title: text(fields, 'title'), dueDate, time, category: text(fields, 'category'), done: existing?.done ?? false, reminder: Boolean(fields.reminder) };
  for (const [index, selectedId] of plotIds.entries()) {
    const assigned = { ...next, plotId: selectedId, id: index === 0 ? next.id : makeId('task') };
    if (existing && index === 0) Object.assign(existing, assigned); else state.tasks.push(assigned);
  }
  return { redirect: `/farm/${farmId}/schedule`, message: t('Task saved. Reminders appear while the app is open.') };
};
/** @param {AppState} state @param {AppState['tasks'][number]} task @returns {void} */
const createNextOccurrence = (state, task) => {
  if (!task.repeat || task.repeat === 'none' || state.tasks.some((item) => item.repeatFromId === task.id)) return;
  const date = new Date(`${task.dueDate}T12:00:00`);
  if (task.repeat === 'monthly') {
    const anchor = task.repeatAnchorDay ?? date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + 1);
    date.setDate(Math.min(anchor, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  } else date.setDate(date.getDate() + (task.repeat === 'weekly' ? 7 : 1));
  const dueDate = [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  const { creationKey, completedAt, ...occurrence } = task;
  state.tasks.push({ ...occurrence, id: makeId('task'), dueDate, done: false, repeatFromId: task.id });
};

/** @param {AppState} state @param {Fields} fields @param {boolean} isCourse @returns {ActionResult} */
const saveBooking = (state, fields, isCourse) => {
  const providerId = text(fields, 'providerId');
  const provider = find(isCourse ? COURSES : PILOTS, (item) => item.id === providerId, 'Provider');
  const date = isCourse ? provider.date : text(fields, 'date');
  const time = isCourse ? provider.time : text(fields, 'time');
  validateSchedule(date, time);
  if (new Date(`${date}T${time}`) < new Date()) throw new ActionError('Choose a future booking time.');
  const farmId = isCourse ? '' : text(fields, 'farmId');
  const farm = isCourse ? null : find(state.farms, (item) => item.id === farmId, 'Farm');
  if (state.bookings.some((item) => item.providerId === providerId && item.farmId === farmId && item.date === date && item.time === time && ACTIVE_BOOKING_STATUSES.includes(item.status))) throw new ActionError('You already have a request for this session.');
  const id = makeId('booking');
  const service = isCourse ? '' : text(fields, 'service', false) || provider.services[0];
  if (!isCourse && !provider.services.includes(service)) throw new ActionError('Choose one of this pilot’s services.');
  const title = isCourse ? provider.title : `${service} with ${provider.name}`;
  state.bookings.push({ id, type: isCourse ? 'course' : 'pilot', service, providerId, title, date, time, farmId, status: 'requested', notes: text(fields, 'notes', false), price: isCourse ? provider.price : provider.rate * farm.area, conversation: [] });
  notify(state, 'Booking request saved', `${title}. Saved on this device.`);
  return { redirect: `/bookings/${id}`, message: t('Request saved locally. No provider contacted.') };
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const savePilot = (state, fields) => {
  saveProfileName(state, fields);
  state.profile.role = 'pilot';
  state.profile.onboarded = true;
  state.profile.hasChosenRole = true;
  if (!state.profile.roles.includes('pilot')) state.profile.roles.push('pilot');
  Object.assign(state.pilot, { area: text(fields, 'area'), services: text(fields, 'services').split(',').map((item) => item.trim()).filter(Boolean), equipment: text(fields, 'equipment'), rate: amount(fields, 'rate') });
  return { redirect: '/', message: t('Pilot profile saved locally.') };
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const saveMessage = (state, fields) => {
  const booking = find(state.bookings, (item) => item.id === text(fields, 'bookingId'), 'Booking');
  booking.conversation.push({ id: makeId('message'), sender: 'you', text: text(fields, 'message'), date: timestamp() });
  return { message: t('Message saved locally. Delivery is not connected.') };
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const requestReschedule = (state, fields) => {
  const booking = find(state.bookings, (item) => item.id === text(fields, 'bookingId'), 'Booking');
  if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) throw new ActionError('This booking cannot be rescheduled.');
  const date = text(fields, 'date');
  const time = text(fields, 'time');
  validateSchedule(date, time);
  if (new Date(`${date}T${time}`) < new Date()) throw new ActionError('Choose a future booking time.');
  booking.rescheduleRequest = { date, time };
  notify(state, 'Schedule change saved', 'Your original booking time stays unchanged until confirmed.');
  return { message: t('Proposed time saved. Original time unchanged.') };
};
/** @param {AppState} state @param {Fields} fields @returns {ActionResult} */
const saveAvailability = (state, fields) => {
  const timeStart = text(fields, 'timeStart');
  const timeEnd = text(fields, 'timeEnd');
  if (!TIME_PATTERN.test(timeStart) || !TIME_PATTERN.test(timeEnd) || timeStart >= timeEnd) throw new ActionError('End time must be after start time.');
  const days = Array.isArray(fields.days) ? fields.days : fields.days ? [fields.days] : [];
  state.pilot.availability = { days, timeStart, timeEnd };
  return { message: t('Availability saved locally.') };
};
/** @param {AppState} state @param {Fields} fields @returns {void} */
const saveProfileName = (state, fields) => {
  if (fields.firstName !== undefined || fields.lastName !== undefined) {
    const firstName = text(fields, 'firstName');
    const lastName = text(fields, 'lastName');
    Object.assign(state.profile, { firstName, lastName, name: `${firstName} ${lastName}` });
    return;
  }
  const name = text(fields, 'name');
  const [firstName, ...rest] = name.split(/\s+/);
  Object.assign(state.profile, { name, firstName, lastName: rest.join(' ') });
};
/** @param {AppState} state @param {string} form @param {Fields} fields @returns {ActionResult} */
export function submitForm(state, form, fields) {
  if (form === 'land-onboarding') {
    saveProfileName(state, fields);
    state.profile.onboarded = true;
    state.profile.hasChosenRole = true;
    state.profile.role = 'farmer';
    if (!state.profile.roles.includes('farmer')) state.profile.roles.push('farmer');
    return { redirect: '/farm/new', message: '' };
  }
  if (form === 'farmer-onboarding' || form === 'farm') return saveFarm(state, fields, form === 'farmer-onboarding');
  if (form === 'plot') return savePlot(state, fields);
  if (form === 'task') return saveTask(state, fields);
  if (form === 'pilot-booking' || form === 'course-booking') return saveBooking(state, fields, form === 'course-booking');
  if (form === 'pilot-onboarding') return savePilot(state, fields);
  if (form === 'message') return saveMessage(state, fields);
  if (form === 'reschedule') return requestReschedule(state, fields);
  if (form === 'availability') return saveAvailability(state, fields);
  if (form === 'verification') {
    state.pilot.credentialReference = text(fields, 'credentialReference');
    state.pilot.verification = 'pending';
    return { redirect: '/pilot', message: t('Reference saved. Verification requires a connected review service.') };
  }
  if (form === 'settings' || form === 'profile') {
    saveProfileName(state, fields);
    if (form === 'settings') Object.assign(state.settings, { unit: ['ha', 'acre'].includes(text(fields, 'units')) ? text(fields, 'units') : 'ha', language: SUPPORTED_LOCALES.some(({ code }) => code === fields.language) ? String(fields.language) : getLocale() });
    return { redirect: form === 'profile' ? '/onboarding/role' : '/account', message: t('Profile saved.') };
  }
  throw new ActionError('This form is unavailable.');
}
/** @param {AppState} state @param {string} id @param {number} change @returns {ActionResult} */
const adjustCart = (state, id, change) => {
  find(PRODUCTS, (item) => item.id === id, 'Product');
  const item = state.cart.find((entry) => entry.productId === id);
  if (!item && change > 0) state.cart.push({ productId: id, quantity: 1 });
  if (item) {
    if (item.quantity + change > MAX_QUANTITY) throw new ActionError(t('The limit is {count} per item.', { count: MAX_QUANTITY }));
    item.quantity += change;
    state.cart = state.cart.filter((entry) => entry.quantity > 0);
  }
  return { message: t(change > 0 ? 'Added to your cart.' : 'Cart updated.') };
};
/** @param {AppState} state @returns {ActionResult} */
const createOrder = (state) => {
  if (!state.cart.length) throw new ActionError('Your cart is empty.');
  const total = state.cart.reduce((sum, item) => sum + find(PRODUCTS, (product) => product.id === item.productId, 'Product').price * item.quantity, 0);
  const id = makeId('order');
  state.orders.push({ id, items: structuredClone(state.cart), total, status: 'unpaid', date: timestamp() });
  state.cart = [];
  return { redirect: `/checkout/${id}/payment`, message: t('Order saved. No payment taken.') };
};
/** @param {AppState} state @param {string} role @param {boolean} isSetup @returns {ActionResult} */
const chooseRole = (state, role, isSetup) => {
  if (!['farmer', 'pilot', 'both'].includes(role)) throw new ActionError('Choose a valid role.');
  if (isSetup) state.profile.hasChosenRole = true;
  if (isSetup) state.profile.roles = [...new Set([...(state.profile.onboarded ? state.profile.roles : []), ...(role === 'both' ? ['farmer', 'pilot'] : [role])])];
  if (!isSetup && !state.profile.roles.includes(role)) throw new ActionError('Set up this role first.');
  state.profile.role = role === 'pilot' ? 'pilot' : 'farmer';
  return { redirect: isSetup ? `/onboarding/${state.profile.role}` : state.profile.role === 'pilot' ? '/pilot' : '/', message: '' };
};
/** @param {AppState} state @param {string} action @param {string} id @param {string} role @returns {ActionResult} */
export function applyAction(state, action, id = '', role = '') {
  if (action === 'choose-role' || action === 'switch-role') return chooseRole(state, role, action === 'choose-role');
  if (action === 'create-order') return createOrder(state);
  if (['add-cart', 'cart-increment', 'cart-decrement'].includes(action)) return adjustCart(state, id, action === 'cart-decrement' ? -1 : 1);
  if (action === 'save-article') {
    find(ARTICLES, (item) => item.id === id, 'Guide');
    const isSaved = state.savedArticles.includes(id);
    state.savedArticles = isSaved ? state.savedArticles.filter((item) => item !== id) : [...state.savedArticles, id];
    return { message: t(isSaved ? 'Guide removed from saved.' : 'Guide saved for offline reading.') };
  }
  if (action === 'delete-task') {
    const task = find(state.tasks, (item) => item.id === id, 'Task');
    state.tasks = state.tasks.filter((item) => item.id !== id);
    state.notifications = state.notifications.filter((item) => !item.id.startsWith(`reminder-${id}-`));
    return { message: t('Task deleted.'), redirect: `/farm/${task.farmId}/schedule` };
  }
  if (action === 'toggle-task') {
    const task = find(state.tasks, (item) => item.id === id, 'Task');
    task.done = !task.done;
    if (task.done) task.completedAt = new Date().toISOString();
    else delete task.completedAt;
    if (task.done) createNextOccurrence(state, task);
    return { message: t(task.done ? 'Task complete.' : 'Task reopened.') };
  }
  if (action === 'cancel-booking') {
    const booking = find(state.bookings, (item) => item.id === id, 'Booking');
    if (!ACTIVE_BOOKING_STATUSES.includes(booking.status)) throw new ActionError('This booking cannot be cancelled.');
    booking.status = 'cancelled';
    return { message: t('Local booking cancelled.') };
  }
  if (action === 'demo-payment') {
    find(state.orders, (item) => item.id === id, 'Order').status = 'demo-paid';
    return { redirect: `/orders/${id}`, message: t('Payment simulated. No money moved.') };
  }
  if (action === 'mark-notifications-read') {
    state.notifications.forEach((item) => { item.read = true; });
    return { message: t('Notifications marked as read.') };
  }
  if (action === 'pilot-accept') throw new ActionError('Accepting jobs requires verified credentials and a connected booking service.');
  throw new ActionError('This action is unavailable.');
}
/** @param {AppState} state @param {Date} now @returns {boolean} */
export function collectReminders(state, now = new Date()) {
  let hasChanged = false;
  for (const task of state.tasks) {
    const id = `reminder-${task.id}-${task.dueDate}-${task.time}`;
    if (!task.reminder || task.done || new Date(`${task.dueDate}T${task.time}`) > now || state.notifications.some((item) => item.id === id)) continue;
    state.notifications.unshift({ id, title: task.title, body: `Due ${task.dueDate} at ${task.time}`, date: now.toISOString(), read: false });
    hasChanged = true;
  }
  return hasChanged;
}

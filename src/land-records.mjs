import { fieldAreaHectares, mappedFields } from './field-boundary.mjs';
import { isLandBoundary } from './land-boundary.mjs';
import { assignLandCover } from './land-covers.mjs';

/** @typedef {import('./land-boundary.mjs').LandPoint} Point */
const MAX_POINTS = 100;
const EPSILON = 1e-12;
const LOCATION_PRECISION = 5;
export class LandRecordError extends Error {
  /** @param {string} message */
  constructor(message) { super(message); this.name = 'LandRecordError'; }
}
/** @param {Point[]} points @param {'add'|'move'|'remove'} action @param {number} index @param {Point} [point] @returns {Point[]} */
export function editLandPoint(points, action, index, point) {
  const next = points.map((item) => [...item]);
  if (action !== 'add' && (!Number.isInteger(index) || index < 0 || index >= points.length)) throw new LandRecordError('Select a boundary point first.');
  if (action === 'remove') { next.splice(index, 1); return next; }
  if (!point || !point.every(Number.isFinite) || Math.abs(point[0]) > 85 || Math.abs(point[1]) > 180) throw new LandRecordError('Enter valid latitude and longitude.');
  if (action === 'add' && points.length >= MAX_POINTS) throw new LandRecordError('A land boundary can have up to 100 points.');
  if (action === 'add') next.splice(index < 0 ? next.length : index + 1, 0, [...point]);
  else next[index] = [...point];
  return next;
}
/** @param {Point} a @param {Point} b @param {Point} p @returns {number} */
const cross = (a, b, p) => (b[1] - a[1]) * (p[0] - a[0]) - (b[0] - a[0]) * (p[1] - a[1]);
/** @param {Point[]} polygon @param {Point} point @returns {boolean} */
const containsPoint = (polygon, point) => {
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]; const b = polygon[i];
    if (Math.abs(cross(a, b, point)) <= EPSILON && point[0] >= Math.min(a[0], b[0]) - EPSILON && point[0] <= Math.max(a[0], b[0]) + EPSILON && point[1] >= Math.min(a[1], b[1]) - EPSILON && point[1] <= Math.max(a[1], b[1]) + EPSILON) return true;
    if ((a[0] > point[0]) !== (b[0] > point[0]) && point[1] < (b[1] - a[1]) * (point[0] - a[0]) / (b[0] - a[0]) + a[1]) isInside = !isInside;
  }
  return isInside;
};
/** @param {Point[]} land @param {Point[]} field @returns {boolean} */
const containsField = (land, field) => field.every((point, index) => {
  const next = field[(index + 1) % field.length];
  if (!containsPoint(land, point) || !containsPoint(land, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2])) return false;
  return land.every((a, edge) => {
    const b = land[(edge + 1) % land.length];
    return !(cross(a, b, point) * cross(a, b, next) < -(EPSILON ** 2) && cross(point, next, a) * cross(point, next, b) < -(EPSILON ** 2));
  });
});
/** @param {import('./store.mjs').AppState} state @param {{id?:string,name:string,location?:string,boundary:Point[]}} draft @returns {string} */
export function saveLandRecord(state, draft) {
  if (draft.location?.trim() === '' || draft.name.length > 120 || (draft.location?.length ?? 0) > 120) throw new LandRecordError('Enter a location; names and locations can have up to 120 characters.');
  if (!isLandBoundary(draft.boundary)) throw new LandRecordError('Mark at least three distinct corners without crossing the boundary.');
  const existing = draft.id ? state.farms.find((land) => land.id === draft.id) : null;
  if (draft.id && !existing) throw new LandRecordError('Land not found.');
  const fields = existing ? mappedFields(existing) : [];
  if (fields.some((field) => field.boundary.length && !containsField(draft.boundary, field.boundary))) throw new LandRecordError('The land boundary must contain its existing fields.');
  const boundary = draft.boundary.map((point) => [...point]);
  const location = draft.location?.trim() ?? [0, 1].map((axis) => (boundary.reduce((sum, point) => sum + point[axis], 0) / boundary.length).toFixed(LOCATION_PRECISION)).join(', ');
  const area = Number(fieldAreaHectares(boundary).toFixed(4));
  if (area <= 0) throw new LandRecordError('This land boundary is too small.');
  if (existing) {
    for (const field of fields) { const plot = existing.plots.find((item) => item.id === field.id); if (!plot.boundary && field.boundary.length) plot.boundary = field.boundary; }
    Object.assign(existing, { name: draft.name.trim() || existing?.name || nextLandName(state), location, boundary, area }); return existing.id; }
  const id = `farm-${crypto.randomUUID()}`;
  const coverImage = assignLandCover(state.farms);
  state.farms.push({ id, name: draft.name.trim() || existing?.name || nextLandName(state), location, boundary, area, unit: 'ha', crop: '', plantedAt: '', plots: [], isDemo: false, coverImage });
  return id;
}
/** @param {import('./store.mjs').AppState} state @param {string} id @returns {void} */
export function deleteLandRecord(state, id) {
  if (!state.farms.some((land) => land.id === id)) throw new LandRecordError('Land not found.');
  for (const booking of state.bookings.filter((item) => item.farmId === id)) {
    booking.status = 'cancelled';
    delete booking.rescheduleRequest;
  }
  const taskIds = state.tasks.filter((task) => task.farmId === id).map((task) => task.id);
  state.farms = state.farms.filter((land) => land.id !== id);
  state.tasks = state.tasks.filter((task) => task.farmId !== id);
  state.notifications = state.notifications.filter((note) => !taskIds.some((taskId) => note.id.startsWith(`reminder-${taskId}-`)));
}

/** @param {import('./store.mjs').AppState} state @returns {string} */
export function nextLandName(state) {
  const names = new Set(state.farms.map((land) => land.name.trim().toLowerCase()));
  let number = 1;
  while (names.has(`land ${number}`)) number += 1;
  return `Land ${number}`;
}

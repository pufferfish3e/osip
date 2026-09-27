import { nextLandName } from './land-records.mjs';
import { fieldAreaHectares, normalizeFieldBoundary } from './field-boundary.mjs';

const MAX_FIELDS = 100;
const BISECTION_STEPS = 48;
const COORDINATE_PRECISION = 5;
/** @typedef {import('./land-boundary.mjs').LandPoint} Point */
/** @param {Point} a @param {Point} b @param {number} fraction @returns {Point} */
const lerp = (a, b, fraction) => [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction];
/** @param {Point[]} quad @param {number} start @param {number} end @returns {Point[]} */
const slice = (quad, start, end) => [lerp(quad[0], quad[1], start), lerp(quad[0], quad[1], end), lerp(quad[3], quad[2], end), lerp(quad[3], quad[2], start)];
/** @param {Point[]} points @returns {number} */
const area = (points) => Math.abs(points.reduce((sum, point, index) => {
  const next = points[(index + 1) % points.length];
  return sum + (point[0] - points[0][0]) * (next[1] - points[0][1]) - (next[0] - points[0][0]) * (point[1] - points[0][1]);
}, 0));
/** @param {Point[]} quad @param {number} count @returns {Point[][]} */
const divide = (quad, count) => {
  const cuts = [0];
  for (let index = 1; index < count; index += 1) {
    let low = 0; let high = 1;
    for (let iteration = 0; iteration < BISECTION_STEPS; iteration += 1) {
      const middle = (low + high) / 2;
      if (area(slice(quad, 0, middle)) / area(quad) < index / count) low = middle; else high = middle;
    }
    cuts.push((low + high) / 2);
  }
  cuts.push(1);
  return cuts.slice(0, -1).map((start, index) => slice(quad, start, cuts[index + 1]));
};
/** Equal areas in the local planar map projection; not surveyed boundaries.
 * @param {Point[]} boundary @param {number} columns @param {number} rows @returns {Point[][]}
 */
export function splitLand(boundary, columns, rows) {
  if (![columns, rows].every((value) => Number.isInteger(value) && value > 0) || columns * rows > MAX_FIELDS) throw new Error('Choose 1–100 fields using whole rows and columns.');
  const quad = normalizeFieldBoundary(boundary);
  const strips = divide([quad[3], quad[0], quad[1], quad[2]], rows);
  return strips.flatMap((strip) => divide([strip[1], strip[2], strip[3], strip[0]], columns)).map(normalizeFieldBoundary);
}
/** @param {import('./store.mjs').AppState} state @param {{id?:string,name:string,location?:string,boundary:Point[],columns:number,rows:number,crops:string[]}} draft @returns {string} */
export function saveLandGrid(state, draft) {
  const existing = draft.id ? state.farms.find((land) => land.id === draft.id) : null;
  if (draft.id && !existing) throw new Error('Land not found.');
  if (existing?.plots.length) throw new Error('This land already has fields. Edit them individually.');
  const fields = splitLand(draft.boundary, draft.columns, draft.rows);
  if (draft.name.length > 120 || (draft.location ?? '').length > 120) throw new Error('Names and locations can have up to 120 characters.');
  if (draft.crops.length !== fields.length || draft.crops.some((crop) => !crop.trim() || crop.length > 80)) throw new Error('Choose a crop for every field.');
  const id = existing?.id ?? `farm-${crypto.randomUUID()}`;
  const boundary = normalizeFieldBoundary(draft.boundary);
  const total = Number(fieldAreaHectares(boundary).toFixed(4));
  const center = [0, 1].map((axis) => (boundary.reduce((sum, point) => sum + point[axis], 0) / boundary.length).toFixed(COORDINATE_PRECISION));
  const location = draft.location?.trim() || existing?.location || center.join(', ');
  const record = { id, name: draft.name.trim() || existing?.name || nextLandName(state), location, crop: [...new Set(draft.crops)].join(', '), area: total, unit: 'ha', plantedAt: '', boundary, isDemo: false,
    plots: fields.map((shape, index) => ({ id: `plot-${crypto.randomUUID()}`, name: `Field ${index + 1}`, gridNumber: index + 1, crop: draft.crops[index], area: Number((total / fields.length).toFixed(4)), plantedAt: '', boundary: shape, isAreaEstimated: true })) };
  if (existing) Object.assign(existing, record); else state.farms.push(record);
  return id;
}

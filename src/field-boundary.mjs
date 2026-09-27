import { displayedLandBoundary, isLandBoundary } from './land-boundary.mjs';

/** @typedef {import('./land-boundary.mjs').LandPoint} LandPoint */
const FIELD_CORNERS = 4;
const METERS_PER_DEGREE = 111320;
const SQUARE_METERS_PER_HECTARE = 10000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const AREA_PRECISION = 100;
const MIN_FIELD_AREA = 0.001;
const MAX_FIELD_AREA = 100000;

/** @param {LandPoint} a @param {LandPoint} b @param {LandPoint} c @returns {number} */
const turn = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);

/** @param {LandPoint[]} points @returns {LandPoint[]} */
const halfHull = (points) => {
  /** @type {LandPoint[]} */
  const hull = [];
  for (const point of points) {
    while (hull.length >= 2 && turn(hull[hull.length - 2], hull[hull.length - 1], point) <= 0) hull.pop();
    hull.push(point);
  }
  return hull.slice(0, -1);
};

/** Order any four outer corners; reject repeated, collinear or interior points.
 * @param {LandPoint[]} points @returns {LandPoint[]}
 */
export function normalizeFieldBoundary(points) {
  if (points.length !== FIELD_CORNERS || !points.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite))) throw new Error('Mark four distinct outer corners.');
  const sorted = points.map((point) => [...point]).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const hull = [...halfHull(sorted), ...halfHull([...sorted].reverse())];
  if (hull.length !== FIELD_CORNERS || !isLandBoundary(hull)) throw new Error('Use four outer corners, with no duplicate or straight-line points.');
  const area = fieldAreaHectares(hull);
  if (area < MIN_FIELD_AREA || area > MAX_FIELD_AREA) throw new Error('The field is too small or too large. Zoom in and mark its corners again.');
  return hull;
}

/** Local planar estimate; suitable for field previews, not a cadastral survey.
 * @param {LandPoint[]} boundary @returns {number}
 */
export function fieldAreaHectares(boundary) {
  if (boundary.length < 3) return 0;
  const origin = boundary[0];
  const scale = Math.cos(origin[0] * DEGREES_TO_RADIANS);
  const projected = boundary.map((point) => [(point[1] - origin[1]) * scale, point[0] - origin[0]]);
  const area = projected.reduce((sum, point, index) => {
    const next = projected[(index + 1) % projected.length];
    return sum + point[0] * next[1] - next[0] * point[1];
  }, 0);
  return Math.abs(area) * METERS_PER_DEGREE ** 2 / (2 * SQUARE_METERS_PER_HECTARE);
}

/** @param {LandPoint[]} a @param {LandPoint[]} b @returns {boolean} */
export function fieldsOverlap(a, b) {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const next = polygon[(index + 1) % polygon.length];
      const axis = [next[1] - polygon[index][1], polygon[index][0] - next[0]];
      const project = (point) => point[0] * axis[0] + point[1] * axis[1];
      const first = a.map(project);
      const second = b.map(project);
      if (Math.max(...first) <= Math.min(...second) || Math.max(...second) <= Math.min(...first)) return false;
    }
  }
  return true;
}

/** @param {import('./store.mjs').Farm} farm @returns {import('./store.mjs').Plot[]} */
export function mappedFields(farm) {
  return farm.plots.map((plot) => ({ ...plot, boundary: plot.boundary ?? (farm.plots.length === 1 && plot.area === farm.area ? displayedLandBoundary(farm) : []) }));
}

/** @param {LandPoint[]} outer @param {LandPoint[]} inner @returns {boolean} */
const containsField = (outer, inner) => inner.every((point) => {
  const signs = outer.map((corner, index) => turn(corner, outer[(index + 1) % outer.length], point));
  return signs.every((value) => value >= -1e-12) || signs.every((value) => value <= 1e-12);
});

/** @typedef {{plotId:string,name:string,crop:string,boundary:LandPoint[]}} FieldDraft */
/** @param {import('./store.mjs').AppState} state @param {string} farmId @param {FieldDraft} draft @returns {string} */
export function saveFieldBoundary(state, farmId, draft) {
  const farm = state.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error('Farm not found.');
  const boundary = normalizeFieldBoundary(draft.boundary);
  if (isFourCornerField(farm.boundary) && !containsField(farm.boundary, boundary)) throw new Error('Keep every field inside your land boundary.');
  const name = draft.name.trim();
  const crop = draft.crop.trim();
  if (!name || !crop || name.length > 80 || crop.length > 80) throw new Error('Enter a field name and crop, up to 80 characters each.');
  const plot = farm.plots.find((item) => item.id === draft.plotId);
  if (draft.plotId && !plot) throw new Error('Field not found.');
  const others = mappedFields(farm).filter((item) => item.id !== draft.plotId && item.boundary?.length === FIELD_CORNERS);
  if (others.some((item) => fieldsOverlap(boundary, item.boundary))) throw new Error('This field overlaps another field. Adjust the corners before saving.');
  if (plot) { plot.boundary = boundary; plot.name = name; plot.crop = crop; return plot.id; }
  const id = `plot-${crypto.randomUUID()}`;
  const area = Math.max(1 / AREA_PRECISION, Math.round(fieldAreaHectares(boundary) * AREA_PRECISION) / AREA_PRECISION);
  for (const field of mappedFields(farm)) {
    const existing = farm.plots.find((item) => item.id === field.id);
    if (!existing.boundary && field.boundary.length === FIELD_CORNERS) existing.boundary = field.boundary;
  }
  farm.plots.push({ id, name, crop, area, plantedAt: '', boundary, isAreaEstimated: true });
  farm.area = Math.max(farm.area, farm.plots.reduce((sum, item) => sum + item.area, 0));
  return id;
}

/** @param {unknown} boundary @returns {boundary is LandPoint[]} */
export function isFourCornerField(boundary) {
  if (!isLandBoundary(boundary) || boundary.length !== FIELD_CORNERS) return false;
  try { normalizeFieldBoundary(boundary); return true; }
  catch (error) { if (error instanceof Error) return false; throw error; }
}

/** Remove a field without deleting farm-wide schedules or changing recorded farm area.
 * @param {import('./store.mjs').AppState} state @param {string} farmId @param {string} plotId @returns {void}
 */
export function deleteField(state, farmId, plotId) {
  const farm = state.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error('Farm not found.');
  const index = farm.plots.findIndex((item) => item.id === plotId);
  if (index < 0) throw new Error('Field not found.');
  farm.plots.splice(index, 1);
}

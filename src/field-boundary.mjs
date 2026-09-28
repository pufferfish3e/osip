import { createRecordId } from './record-id.mjs';
import { displayedLandBoundary, isLandBoundary } from './land-boundary.mjs';

/** @typedef {import('./land-boundary.mjs').LandPoint} LandPoint */
const MIN_FIELD_POINTS = 3;
const MAX_FIELD_POINTS = 100;
const GEOMETRY_EPSILON = 1e-12;
const METERS_PER_DEGREE = 111320;
const SQUARE_METERS_PER_HECTARE = 10000;
const DEGREES_TO_RADIANS = Math.PI / 180;
const AREA_PRECISION = 100;
const MIN_FIELD_AREA = 0.001;
const MAX_FIELD_AREA = 100000;

/** @param {LandPoint} a @param {LandPoint} b @param {LandPoint} c @returns {number} */
const turn = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);

/** Keep click order so inward corners are not replaced by a convex hull.
 * @param {LandPoint[]} points @returns {LandPoint[]}
 */
export function normalizeFieldBoundary(points) {
  if (!isLandBoundary(points)) throw new Error('Mark 3–100 distinct corners in boundary order without crossing edges.');
  const area = fieldAreaHectares(points);
  if (area < MIN_FIELD_AREA || area > MAX_FIELD_AREA) throw new Error('The field is too small or too large. Zoom in and mark its corners again.');
  return points.map((point) => [point[0], point[1]]);
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
const convexOverlap =(a, b) => {
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
};

/** @param {LandPoint[]} polygon @returns {LandPoint[][]} */
const triangulate = (polygon) => {
  const signedArea = polygon.reduce((sum, point, index) => sum + turn([0, 0], point, polygon[(index + 1) % polygon.length]), 0);
  const points = signedArea > 0 ? [...polygon] : [...polygon].reverse();
  const triangles = [];
  while (points.length > MIN_FIELD_POINTS) {
    const index = points.findIndex((point, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];
      if (turn(previous, point, next) <= 0) return false;
      return !points.some((candidate) => candidate !== previous && candidate !== point && candidate !== next
        && turn(previous, point, candidate) >= 0 && turn(point, next, candidate) >= 0 && turn(next, previous, candidate) >= 0);
    });
    if (index < 0) throw new Error('Could not validate this field shape. Adjust its corners.');
    triangles.push([points[(index + points.length - 1) % points.length], points[index], points[(index + 1) % points.length]]);
    points.splice(index, 1);
  }
  return [...triangles, points];
};

/** @param {LandPoint[]} a @param {LandPoint[]} b @returns {boolean} */
export function fieldsOverlap(a, b) {
  const first = triangulate(a);
  const second = triangulate(b);
  return first.some((triangle) => second.some((other) => convexOverlap(triangle, other)));
}

/** @param {import('./store.mjs').Farm} farm @returns {import('./store.mjs').Plot[]} */
export function mappedFields(farm) {
  return farm.plots.map((plot) => ({ ...plot, boundary: plot.boundary ?? (farm.plots.length === 1 && plot.area === farm.area ? displayedLandBoundary(farm) : []) }));
}

/** @param {LandPoint[]} polygon @param {LandPoint} point @returns {boolean} */
const containsPoint = (polygon, point) => {
  let isInside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const a = polygon[previous]; const b = polygon[index];
    if (Math.abs(turn(a, b, point)) <= GEOMETRY_EPSILON && point[0] >= Math.min(a[0], b[0]) && point[0] <= Math.max(a[0], b[0]) && point[1] >= Math.min(a[1], b[1]) && point[1] <= Math.max(a[1], b[1])) return true;
    if ((a[0] > point[0]) !== (b[0] > point[0]) && point[1] < (b[1] - a[1]) * (point[0] - a[0]) / (b[0] - a[0]) + a[1]) isInside = !isInside;
  }
  return isInside;
};

/** @param {LandPoint[]} outer @param {LandPoint[]} inner @returns {boolean} */
const containsField = (outer, inner) => inner.every((point, index) => {
  const next = inner[(index + 1) % inner.length];
  if (!containsPoint(outer, point) || !containsPoint(outer, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2])) return false;
  return outer.every((a, edge) => {
    const b = outer[(edge + 1) % outer.length];
    return !(turn(a, b, point) * turn(a, b, next) < 0 && turn(point, next, a) * turn(point, next, b) < 0);
  });
});

/** @typedef {{plotId:string,name:string,crop:string,boundary:LandPoint[]}} FieldDraft */
/** @param {import('./store.mjs').AppState} state @param {string} farmId @param {FieldDraft} draft @returns {string} */
export function saveFieldBoundary(state, farmId, draft) {
  const farm = state.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error('Farm not found.');
  const boundary = normalizeFieldBoundary(draft.boundary);
  if (isLandBoundary(farm.boundary) && !containsField(farm.boundary, boundary)) throw new Error('Keep every field inside your land boundary.');
  const name = draft.name.trim();
  const crop = draft.crop.trim();
  if (!name || !crop || name.length > 80 || crop.length > 80) throw new Error('Enter a field name and crop, up to 80 characters each.');
  const plot = farm.plots.find((item) => item.id === draft.plotId);
  if (draft.plotId && !plot) throw new Error('Field not found.');
  const others = mappedFields(farm).filter((item) => item.id !== draft.plotId && isFieldBoundary(item.boundary));
  if (others.some((item) => fieldsOverlap(boundary, item.boundary))) throw new Error('This field overlaps another field. Adjust the corners before saving.');
  if (plot) { plot.boundary = boundary; plot.name = name; plot.crop = crop; if (plot.isAreaEstimated) plot.area = Number(fieldAreaHectares(boundary).toFixed(4)); return plot.id; }
  const id = `plot-${createRecordId()}`;
  const area = Math.max(1 / AREA_PRECISION, Math.round(fieldAreaHectares(boundary) * AREA_PRECISION) / AREA_PRECISION);
  for (const field of mappedFields(farm)) {
    const existing = farm.plots.find((item) => item.id === field.id);
    if (!existing.boundary && isFieldBoundary(field.boundary)) existing.boundary = field.boundary;
  }
  farm.plots.push({ id, name, crop, area, plantedAt: '', boundary, isAreaEstimated: true });
  farm.area = Math.max(farm.area, farm.plots.reduce((sum, item) => sum + item.area, 0));
  return id;
}

/** @param {unknown} boundary @returns {boundary is LandPoint[]} */
export function isFieldBoundary(boundary) {
  if (!isLandBoundary(boundary)) return false;
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
  if (state.tasks.some((task) => task.farmId === farmId && task.plotId === plotId)) throw new Error('Move this field’s tasks to another field or the whole land before deleting it.');
  farm.plots.splice(index, 1);
}

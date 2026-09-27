/** @typedef {[number, number]} LandPoint Latitude, longitude. */
const MAX_BOUNDARY_POINTS = 100;
const MIN_BOUNDARY_POINTS = 3;
const GEOMETRY_EPSILON = 1e-12;

/** @param {unknown} point @returns {point is LandPoint} */
const isPoint = (point) => Array.isArray(point) && point.length === 2
  && point.every((value) => typeof value === 'number' && Number.isFinite(value))
  && Math.abs(point[0]) <= 85 && Math.abs(point[1]) <= 180;

/** @param {LandPoint} a @param {LandPoint} b @param {LandPoint} c @returns {number} */
const cross = (a, b, c) => (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);

/** @param {LandPoint} a @param {LandPoint} b @param {LandPoint} p @returns {boolean} */
const onSegment = (a, b, p) => Math.abs(cross(a, b, p)) <= GEOMETRY_EPSILON
  && p[0] >= Math.min(a[0], b[0]) && p[0] <= Math.max(a[0], b[0])
  && p[1] >= Math.min(a[1], b[1]) && p[1] <= Math.max(a[1], b[1]);

/** @param {LandPoint} a @param {LandPoint} b @param {LandPoint} c @param {LandPoint} d @returns {boolean} */
const intersects = (a, b, c, d) => (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)
  || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b);

/** @param {LandPoint[]} points @returns {boolean} */
const hasCrossingEdges = (points) => {
  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      if (second === first + 1 || (first === 0 && second === points.length - 1)) continue;
      if (intersects(points[first], points[(first + 1) % points.length], points[second], points[(second + 1) % points.length])) return true;
    }
  }
  return false;
};

/** @param {unknown} value @returns {value is LandPoint[]} */
export function isLandBoundary(value) {
  if (!Array.isArray(value) || value.length < MIN_BOUNDARY_POINTS || value.length > MAX_BOUNDARY_POINTS || !value.every(isPoint)) return false;
  if (new Set(value.map((point) => point.join(','))).size !== value.length) return false;
  if (Math.max(...value.map((point) => point[1])) - Math.min(...value.map((point) => point[1])) > 180) return false;
  const area = value.reduce((sum, point, index) => {
    const next = value[(index + 1) % value.length];
    return sum + point[1] * next[0] - next[1] * point[0];
  }, 0);
  return Math.abs(area) > GEOMETRY_EPSILON && !hasCrossingEdges(value);
}

/** @param {import('./store.mjs').AppState} state @param {string} farmId @param {LandPoint[]} boundary @returns {void} */
export function saveLandBoundary(state, farmId, boundary) {
  if (!isLandBoundary(boundary)) throw new Error('Mark at least three distinct corners without crossing the boundary.');
  const farm = state.farms.find((item) => item.id === farmId);
  if (!farm) throw new Error('Farm not found.');
  farm.boundary = boundary.map((point) => [point[0], point[1]]);
}

/** Illustrative rectangle of approximately 4.2 hectares, not surveyed land. */
const DEMO_LAND_BOUNDARY = [[3.9741, 100.79405], [3.9741, 100.79595], [3.9759, 100.79595], [3.9759, 100.79405]];

/** @param {import('./store.mjs').Farm} farm @returns {LandPoint[]} */
export function displayedLandBoundary(farm) {
  const boundary = farm.boundary ?? (farm.isDemo && farm.id === 'farm-1' ? DEMO_LAND_BOUNDARY : []);
  return boundary.map((point) => [point[0], point[1]]);
}

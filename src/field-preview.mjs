import { escapeHtml as esc } from './ui.mjs';

/** @typedef {[number,number]} Point */
const WIDTH = 136;
const HEIGHT = 64;
const PADDING = 6;

/** @param {unknown} shape @returns {shape is Point[]} */
const isShape = (shape) => Array.isArray(shape) && shape.length >= 3 && shape.every((point) => Array.isArray(point) && point.length === 2 && point.every(Number.isFinite));

/** A small, static picture of where one field sits inside its land; no map tiles, so it works offline.
 * @param {import('./store.mjs').Farm} farm @param {string} plotId @returns {string} */
export function renderFieldPreview(farm, plotId) {
  const plots = (farm.plots ?? []).filter((plot) => isShape(plot.boundary));
  const selected = plots.find((plot) => plot.id === plotId);
  if (!selected) return '';
  const land = isShape(farm.boundary) ? farm.boundary : null;
  const shapes = [...(land ? [land] : []), ...plots.map((plot) => plot.boundary)];
  const scale = Math.cos((shapes.flat().reduce((sum, point) => sum + point[0], 0) / shapes.flat().length) * Math.PI / 180);
  // Longitude is x (shrunk by latitude) and latitude is y, flipped so north is up.
  const project = ([latitude, longitude]) => [longitude * scale, -latitude];
  const projected = shapes.flat().map(project);
  const [minX, minY] = [0, 1].map((axis) => Math.min(...projected.map((point) => point[axis])));
  const [maxX, maxY] = [0, 1].map((axis) => Math.max(...projected.map((point) => point[axis])));
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const fit = Math.min((WIDTH - PADDING * 2) / ((maxX - minX) || size), (HEIGHT - PADDING * 2) / ((maxY - minY) || size));
  const offsetX = (WIDTH - (maxX - minX) * fit) / 2;
  const offsetY = (HEIGHT - (maxY - minY) * fit) / 2;
  const path = (shape) => shape.map(project).map(([x, y]) => `${(offsetX + (x - minX) * fit).toFixed(1)},${(offsetY + (y - minY) * fit).toFixed(1)}`).join(' ');
  const others = plots.filter((plot) => plot !== selected).map((plot) => `<polygon class="field-preview-other" points="${esc(path(plot.boundary))}"/>`).join('');
  return `<svg class="field-preview" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}" aria-hidden="true" focusable="false">${land ? `<polygon class="field-preview-land" points="${esc(path(land))}"/>` : ''}${others}<polygon class="field-preview-selected" points="${esc(path(selected.boundary))}"/></svg>`;
}

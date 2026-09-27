import { createFieldCareMotion } from './field-care.mjs';
import { normalizeFieldBoundary } from './field-boundary.mjs';
import { displayedLandBoundary } from './land-boundary.mjs';
import { createMapLayer, savedMapType, saveMapType } from './land-map.mjs';
import { deleteLandRecord, editLandPoint, saveLandRecord } from './land-records.mjs';
import { t } from './i18n.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const MAX_LAND_POINTS = 100;
const POINT_MOTION_SECONDS = 0.18;
const LAND_ZOOM = 16;
const POINT_RADIUS = 5;
const SELECTED_POINT_RADIUS = 7;
/** @typedef {import('./store.mjs').Farm} Land */
/** @param {string} name @param {string} label @param {string} value @returns {string} */
const input = (name, label, value) => `<label class="field">${esc(t(label))}<input class="input" name="${name}" value="${esc(value)}" ${name === 'name' ? '' : 'required'} maxlength="120"></label>`;
/** @param {Land} [land] @param {boolean} [isInline] @returns {string} */
export function renderLandEditor(land, isInline = false) {
  return `${isInline ? '' : pageHeading('', t(land ? 'Edit land' : 'Add land'))}<section class="land-record-editor" data-land-editor="${esc(land?.id ?? '')}"><p class="muted" data-land-progress aria-live="polite">1 / 2</p><div data-land-step="0"><div class="land-record-map-wrap"><div class="land-setup-map" data-record-map></div><div class="land-record-point-toolbar" role="toolbar" aria-label="${esc(t('Land map'))}">${[['locate', 'Use my location', 'map-pin'], ['add', 'Create point', 'plus'], ['move', 'Update point', 'pencil'], ['remove', 'Delete point', 'trash']].map(([action, label, symbol]) => `<button type="button" class="land-map-button" data-point-action="${action}" aria-label="${esc(t(label))}" title="${esc(t(label))}">${icon(symbol, 20)}</button>`).join('')}<label class="land-record-map-type"><span class="sr-only">${esc(t('Map type'))}</span><select data-record-map-type><option value="street">${esc(t('Street'))}</option><option value="satellite">${esc(t('Satellite'))}</option></select></label></div></div><p role="status" data-point-status></p></div><form class="form-stack" data-land-record-form novalidate><div data-land-step="1" hidden>${input('name', 'Land name', land?.name ?? '')}</div><p role="alert" data-record-error></p><div class="form-stack"><button type="button" class="button button-secondary" data-point-action="previous" hidden>${esc(t('Back'))}</button><button type="button" class="button" data-point-action="next">${esc(t('Continue'))}</button><button hidden type="submit" class="button" name="next" value="split">${esc(t('Save and choose field dimensions'))}</button><a class="button button-secondary" href="/farm${land ? `/${esc(land.id)}` : ''}">${esc(t('Cancel'))}</a>${land ? `<button type="button" class="button button-secondary land-delete-button" data-point-action="delete-land">${esc(t('Delete land'))}</button>` : ''}</div></form><dialog class="install-dialog" data-land-delete-dialog aria-labelledby="land-delete-heading"><h2 id="land-delete-heading">${esc(t('Delete land'))}</h2><p>${esc(t('Delete this land, its fields and scheduled tasks? Linked bookings will be cancelled. This cannot be undone.'))}</p><div class="toolbar"><button class="button button-secondary" data-point-action="cancel-delete" autofocus>${esc(t('Cancel'))}</button><button class="button" data-point-action="confirm-delete">${esc(t('Delete land'))}</button></div></dialog></section>`;
}
/** @typedef {{getLatLng:()=>{lat:number,lng:number},getRadius:()=>number,setLatLng:(point:number[])=>void,setRadius:(radius:number)=>void,setStyle:(style:object)=>void}} PointMarker */
/** @typedef {{isDisposed:boolean,step:number,stepMotion:{kill:()=>void}|null,markers:PointMarker[],polygon:{setLatLngs:(points:number[][])=>void}|null,motion:{kill:()=>void}|null,panel:HTMLElement,store:import('./store.mjs').AppStore,id:string,points:import('./land-boundary.mjs').LandPoint[],selected:number,isAdding:boolean,map:import('./land-map.mjs').LandMap,leaflet:import('./land-map.mjs').Leaflet,layers:import('./land-map.mjs').LayerGroup,base:import('./land-map.mjs').Layer}} Editor */
/** @param {Editor} editor @param {unknown} error @returns {void} */
const showError = (editor, error) => { editor.panel.querySelector('[data-record-error]').textContent = t(error instanceof Error ? error.message : 'Could not save land.'); };
/** @param {Editor} editor @returns {void} */
const updateShapes = (editor) => {
  editor.motion?.kill();
  const canAnimate = editor.markers.length === editor.points.length && editor.points.length > 0;
  while (editor.markers.length > editor.points.length) editor.layers.removeLayer(editor.markers.pop());
  editor.points.forEach((point, index) => {
    if (editor.markers[index]) return;
    editor.markers.push(editor.leaflet.circleMarker(point, { radius: POINT_RADIUS, weight: 2, color: '#fff', fillColor: '#075bea', fillOpacity: 1, bubblingMouseEvents: false }).addTo(editor.layers).on('click', () => { editor.selected = index; editor.isAdding = false; redraw(editor); }));
  });
  if (editor.points.length > 2 && !editor.polygon) editor.polygon = editor.leaflet.polygon(editor.points, { color: '#075bea', interactive: false }).addTo(editor.layers);
  if (editor.points.length < 3 && editor.polygon) { editor.layers.removeLayer(editor.polygon); editor.polygon = null; }
  const start = editor.markers.map((marker) => ({ point: marker.getLatLng(), radius: marker.getRadius() }));
  const progress = { value: 0 };
  const draw = () => {
    const points = editor.points.map((point, index) => [start[index].point.lat + (point[0] - start[index].point.lat) * progress.value, start[index].point.lng + (point[1] - start[index].point.lng) * progress.value]);
    editor.polygon?.setLatLngs(points);
    editor.markers.forEach((marker, index) => { marker.setLatLng(points[index]); marker.setRadius(start[index].radius + ((index === editor.selected ? SELECTED_POINT_RADIUS : POINT_RADIUS) - start[index].radius) * progress.value); marker.setStyle({ color: index === editor.selected ? '#075bea' : '#fff' }); });
  };
  if (canAnimate && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) editor.motion = window.gsap.to(progress, { value: 1, duration: POINT_MOTION_SECONDS, ease: 'power2.out', onUpdate: draw });
  else { progress.value = 1; draw(); }
};
/** @param {Editor} editor @returns {void} */
const redraw = (editor) => {
  updateShapes(editor);
  for (const action of ['move', 'remove']) editor.panel.querySelector(`[data-point-action="${action}"]`).disabled = editor.selected < 0;
  editor.panel.querySelector('[data-point-action="add"]').disabled = editor.points.length >= MAX_LAND_POINTS;
  editor.panel.querySelector('[data-point-action="add"]').setAttribute('aria-pressed', String(editor.isAdding));
  editor.panel.querySelector('[data-point-action="move"]').setAttribute('aria-pressed', String(!editor.isAdding));
  updateMapHint(editor);
};
/** @param {Editor} editor @returns {void} */
const updateMapHint = (editor) => {
  editor.panel.querySelector('[data-point-status]').textContent = editor.map.getZoom() < LAND_ZOOM ? t('Zoom in closer to mark your land.') : editor.isAdding ? t('{count} corners. Mark 3–100 points in boundary order; tap a marked corner to move it.', { count: editor.points.length }) : t('Select a point, then tap to move it.');
};
/** @param {Editor} editor @returns {void} */
const locateLand = (editor) => {
  if (!navigator.geolocation) { showError(editor, new Error('Location unavailable. Move the map to your land.')); return; }
  navigator.geolocation.getCurrentPosition((position) => {
    if (!editor.isDisposed) editor.map.setView([position.coords.latitude, position.coords.longitude], LAND_ZOOM + 1);
  }, () => { if (!editor.isDisposed) showError(editor, new Error('Location unavailable. Move the map to your land.')); }, { timeout: 15000 });
};
/** @param {Editor} editor @param {number} direction @returns {void} */
const changeStep = (editor, direction) => {
  if (direction > 0 && editor.step === 0) normalizeFieldBoundary(editor.points);
  
  editor.step = Math.max(0, Math.min(1, editor.step + direction));
  editor.stepMotion?.kill();
  editor.panel.querySelectorAll('[data-land-step]').forEach((element) => { element.hidden = Number(element.dataset.landStep) !== editor.step; });
  editor.panel.querySelector('[data-land-progress]').textContent = `${editor.step + 1} / 2`;
  editor.panel.querySelector('[data-point-action="previous"]').hidden = editor.step === 0;
  editor.panel.querySelector('[data-point-action="next"]').hidden = editor.step === 1;
  editor.panel.querySelectorAll('button[type="submit"]').forEach((button) => { button.hidden = editor.step !== 1; });
  editor.panel.querySelector('[data-record-error]').textContent = '';
  const current = editor.panel.querySelector(`[data-land-step="${editor.step}"]`);
  if (editor.step === 0) editor.map.invalidateSize({ animate: false });
  else current.querySelector('input')?.focus({ preventScroll: true });
  if (editor.step > 0 && window.gsap && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) editor.stepMotion = window.gsap.fromTo(current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.18, ease: 'power2.out', clearProps: 'opacity,transform' });
};
/** @param {Editor} editor @param {string} action @returns {void} */
const handleAction = (editor, action) => {
  const dialog = editor.panel.querySelector('[data-land-delete-dialog]');
  try {
    if (action === 'locate') { locateLand(editor); return; }
    if (action === 'next' || action === 'previous') { changeStep(editor, action === 'next' ? 1 : -1); return; }
    if (action === 'add' || action === 'move') editor.isAdding = action === 'add';
    if (action === 'remove') { editor.points = editLandPoint(editor.points, 'remove', editor.selected); editor.selected = Math.min(editor.selected, editor.points.length - 1); editor.isAdding = true; }
    if (action === 'delete-land') dialog.showModal();
    if (action === 'cancel-delete') dialog.close();
    if (action === 'confirm-delete' && dialog.open) {
      editor.store.update((state) => deleteLandRecord(state, editor.id));
      dialog.close(); editor.panel.dispatchEvent(new CustomEvent('land-record-saved', { bubbles: true, detail: { path: '/farm' } })); return;
    }
    redraw(editor);
  } catch (error) { dialog.close(); showError(editor, error); }
};
/** @param {Editor} editor @param {SubmitEvent} event @returns {void} */
const save = (editor, event) => {
  event.preventDefault(); event.stopPropagation();
  const form = editor.panel.querySelector('form'); const data = new FormData(form);
  try {
    if (editor.step < 1) { changeStep(editor, 1); return; }
    if (!editor.panel.querySelector('[name="name"]').reportValidity()) return;
    const boundary = normalizeFieldBoundary(editor.points);
    let id = '';
    editor.store.update((state) => { id = saveLandRecord(state, { id: editor.id, name: String(data.get('name')), boundary }); });
    editor.panel.dispatchEvent(new CustomEvent('land-record-saved', { bubbles: true, detail: { path: `/farm/${id}/fields/setup` } }));
  } catch (error) { showError(editor, error); }
};
/** @param {Editor} editor @returns {()=>void} */
const bind = (editor) => {
  const onMapClick = (event) => {
    if (editor.map.getZoom() < LAND_ZOOM) { updateMapHint(editor); return; }
    if (editor.isAdding && editor.points.length >= MAX_LAND_POINTS) return;
    try { editor.points = editLandPoint(editor.points, editor.isAdding ? 'add' : 'move', editor.selected, [event.latlng.lat, event.latlng.lng]); if (editor.isAdding) editor.selected += 1; redraw(editor); }
    catch (error) { showError(editor, error); }
  };
  const onClick = (event) => { const button = event.target instanceof Element ? event.target.closest('[data-point-action]') : null; if (button) handleAction(editor, button.dataset.pointAction); };
  const onChange = (event) => {
    if (event.target.matches('[data-record-map-type]')) {
      try { if (!saveMapType(editor.store, event.target.value)) return; }
      catch (error) { event.target.value = savedMapType(editor.store); showError(editor, error); return; }
      editor.map.removeLayer(editor.base); editor.base = createMapLayer(editor.leaflet, event.target.value).addTo(editor.map); }
  };
  const onSubmit = (event) => save(editor, event);
  editor.map.on('zoomend', () => updateMapHint(editor));
  editor.map.on('click', onMapClick); editor.panel.addEventListener('click', onClick); editor.panel.addEventListener('change', onChange); editor.panel.querySelector('form').addEventListener('submit', onSubmit);
  return () => { editor.isDisposed = true; editor.stepMotion?.kill(); editor.motion?.kill(); editor.map.remove(); editor.panel.removeEventListener('click', onClick); editor.panel.removeEventListener('change', onChange); editor.panel.querySelector('form').removeEventListener('submit', onSubmit); };
};
/** @param {HTMLElement} panel @param {import('./store.mjs').AppStore} store @param {import('./land-map.mjs').Leaflet|undefined} leaflet @returns {()=>void} */
export function initializeLandEditor(panel, store, leaflet) {
  if (!leaflet) { panel.querySelector('[data-record-error]').textContent = t('Map unavailable. Reload to try again.'); return () => {}; }
  const land = store.getState().farms.find((record) => record.id === panel.dataset.landEditor);
  const points = land ? displayedLandBoundary(land) : [];
  const map = leaflet.map(panel.querySelector('[data-record-map]'), { scrollWheelZoom: true, touchZoom: true, zoomControl: true }).setView([4.75, 100.9], LAND_ZOOM);
  map.attributionControl?.setPrefix(false);
  const editor = { isDisposed: false, step: 0, stepMotion: null, markers: [], polygon: null, motion: null, panel, store, id: land?.id ?? '', points, selected: points.length - 1, isAdding: !points.length, map, leaflet, layers: leaflet.layerGroup().addTo(map), base: createMapLayer(leaflet, savedMapType(store)).addTo(map) };
  if (points.length) map.fitBounds(leaflet.latLngBounds(points), { padding: [24, 24], maxZoom: 18 });
  for (const [selector, label] of [['.leaflet-control-zoom-in', 'Zoom in'], ['.leaflet-control-zoom-out', 'Zoom out']]) { panel.querySelector(selector)?.setAttribute('aria-label', t(label)); panel.querySelector(selector)?.setAttribute('title', t(label)); }
  const mapTypeSelect = panel.querySelector('[data-record-map-type]');
  if (mapTypeSelect) mapTypeSelect.value = savedMapType(store);
  redraw(editor); return bind(editor);
}

/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {void} */
export function initializeLandCardDeletion(root, store) {
  const list = root.querySelector('[data-land-list]');
  if (!list) return;
  const sheet = list.querySelector('[data-card-delete-sheet]');
  const motion = createFieldCareMotion(sheet, window.gsap, () => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  let selectedId = '';
  sheet.addEventListener('cancel', (event) => { event.preventDefault(); motion.close(); });
  list.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    if (!button || motion.isClosing()) return;
    if (button.dataset.landCardDelete) {
      event.preventDefault(); event.stopPropagation();
      const land = store.getState().farms.find((item) => item.id === button.dataset.landCardDelete);
      if (!land) return;
      selectedId = land.id;
      sheet.querySelector('[data-card-delete-title]').textContent = t('Delete {name}?', { name: land.name });
      sheet.querySelector('[data-card-delete-error]').textContent = '';
      motion.open(); return;
    }
    if (button.hasAttribute('data-card-delete-cancel')) { motion.close(); return; }
    if (!button.hasAttribute('data-card-delete-confirm') || !sheet.open || !selectedId) return;
    try {
      store.update((state) => deleteLandRecord(state, selectedId));
      selectedId = '';
      motion.close(() => root.dispatchEvent(new CustomEvent('land-record-saved', { bubbles: true, detail: { path: '/farm' } })));
    } catch (error) {
      sheet.querySelector('[data-card-delete-error]').textContent = t(error instanceof Error ? error.message : 'Could not save land.');
    }
  });
}

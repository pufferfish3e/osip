import { escapeHtml, icon } from './ui.mjs';
import { displayedLandBoundary } from './land-boundary.mjs';
import { t } from './i18n.mjs';
import { deleteField, fieldAreaHectares, mappedFields, normalizeFieldBoundary, saveFieldBoundary } from './field-boundary.mjs';

/** @typedef {import('./land-boundary.mjs').LandPoint} LandPoint */
/** @typedef {{lat:number,lng:number}} LatLng */
/** @typedef {{addTo:(map:LandMap|LayerGroup)=>Layer,on:(name:string,handler:()=>void)=>Layer,bindTooltip:(content:string,options:object)=>Layer}} Layer */
/** @typedef {Layer & {clearLayers:()=>void}} LayerGroup */
/** @typedef {{setView:(center:number[],zoom:number)=>LandMap,removeLayer:(layer:Layer)=>void,on:(name:string,handler:(event:{latlng:LatLng})=>void)=>void,off:(name:string,handler:(event:{latlng:LatLng})=>void)=>void,fitBounds:(bounds:unknown,options:object)=>void,getZoom:()=>number,getCenter:()=>LatLng,remove:()=>void,invalidateSize:(options:object)=>LandMap}} LandMap */
/** @typedef {{map:(element:HTMLElement,options:object)=>LandMap,tileLayer:(url:string,options:object)=>Layer,layerGroup:()=>LayerGroup,polygon:(points:LandPoint[],options:object)=>Layer,circleMarker:(point:number[],options:object)=>Layer,latLngBounds:(points:LandPoint[])=>unknown}} Leaflet */
/** @typedef {{panel:HTMLElement,store:import('./store.mjs').AppStore,farmId:string,fields:import('./store.mjs').Plot[],plotId:string,selectedCorner:number|null,previousPlotId:string,step:number,baseLayer:Layer,fieldLayers:LayerGroup,map:LandMap,leaflet:Leaflet,saved:LandPoint[],points:LandPoint[],isEditing:boolean,isDisposed:boolean,outline:Layer|null,locationMarker:Layer|null,corners:LayerGroup}} Editor */
const DEFAULT_CENTER = [4.75, 100.9];
const DEFAULT_ZOOM = 8;
const LOCATION_ZOOM = 17;
const MAX_ZOOM = 22;
const NATIVE_TILE_ZOOM = 19;
const LOCATION_TIMEOUT_MS = 15000;
const MAX_POINTS = 100;
const CORNER_RADIUS = 10;
const MIN_CORNER_DISTANCE = 0.000001;
const POSITION_RADIUS = 7;
const BOUNDARY_PADDING = [24, 24];
const BOUNDARY_FILL_OPACITY = 0.22;
const EDIT_COLOR = '#075bea';
const SAVED_COLOR = '#225e42';
const OVERVIEW_OUTLINE_COLOR = '#075bea';
const OVERVIEW_HALO_COLOR = '#ffffff';
const OVERVIEW_HALO_WEIGHT = 7;
const OVERVIEW_OUTLINE_WEIGHT = 3;
const MAP_EXPAND_SECONDS = 0.32;

const createMapExpansionMotion = (panel, map) => {
  let motion;
  let placeholder;
  const clear = () => {
    motion?.kill();
    panel.style?.removeProperty('transform');
    panel.style?.removeProperty('transform-origin');
    placeholder?.remove();
    placeholder = null;
  };
  const animate = (isExpanded) => {
    const gsap = globalThis.gsap;
    if (!gsap || globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      clear();
      panel.classList.toggle('is-map-expanded', isExpanded);
      map.invalidateSize({ animate: false });
      return;
    }
    motion?.kill();
    const start = panel.getBoundingClientRect();
    if (isExpanded && !placeholder) {
      placeholder = document.createElement('div');
      placeholder.style.height = `${start.height}px`;
      placeholder.setAttribute('aria-hidden', 'true');
      panel.before(placeholder);
    }
    panel.classList.add('is-map-expanded');
    map.invalidateSize({ animate: false });
    const end = isExpanded ? panel.getBoundingClientRect() : placeholder.getBoundingClientRect();
    const viewport = panel.getBoundingClientRect();
    const transform = (rect) => ({ x:rect.left - viewport.left, y:rect.top - viewport.top, scaleX:rect.width / viewport.width, scaleY:rect.height / viewport.height });
    motion = gsap.fromTo(panel, { ...transform(start), transformOrigin:'top left' }, {
      ...transform(end), duration:MAP_EXPAND_SECONDS, ease:'power2.inOut',
      onComplete:() => {
        panel.classList.toggle('is-map-expanded', isExpanded);
        panel.style.removeProperty('transform');
        panel.style.removeProperty('transform-origin');
        if (!isExpanded) clear();
        map.invalidateSize({ animate:false });
      },
    });
  };
  return { animate, clear };
};

/** @param {Editor} editor @param {string} text @param {boolean} [shouldShow] @returns {void} */
const setStatus = (editor, text, shouldShow = true) => {
  const status = editor.panel.querySelector('[data-land-status]');
  status.textContent = t(text);
  status.className = shouldShow ? 'land-map-status' : 'sr-only';
  if (editor.isEditing) {
    status.className = 'sr-only';
    const error = editor.panel.querySelector('[data-field-error]');
    error.textContent = t(text); error.hidden = !shouldShow;
  }
};

/** @param {HTMLElement} panel @param {import('./store.mjs').AppStore} store @param {Leaflet|undefined} leaflet @returns {()=>void} */
export function initializeLandMap(panel, store, leaflet) {
  if (!leaflet) { const status = panel.querySelector('[data-land-status]'); status.textContent = t('Map unavailable. Reload to try again.'); status.className = 'land-map-status'; return () => {}; }
  const farm = store.getState().farms.find((item) => item.id === panel.dataset.farmMap);
  const canvas = panel.querySelector('[data-land-canvas]');
  if (!farm || !(canvas instanceof HTMLElement)) return () => {};
  const map = leaflet.map(canvas, { scrollWheelZoom: true, touchZoom: true, zoomControl: true }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
  map.attributionControl?.setPrefix(false);
  const mapType = savedMapType(store);
  const baseLayer = createMapLayer(leaflet, mapType).addTo(map);
  const mapTypeSelect = panel.querySelector('[data-map-type]');
  if (mapTypeSelect) mapTypeSelect.value = mapType;
  if (panel.dataset.landOverview === 'true') return initializeLandOverview(panel, farm, map, leaflet, store, baseLayer);
  const editor = { panel, store, farmId: farm.id, map, leaflet, baseLayer, fields: mappedFields(farm), plotId: panel.dataset.plotId || farm.plots[0]?.id || '', selectedCorner: null, previousPlotId: '', step: 0, fieldLayers: leaflet.layerGroup().addTo(map), saved: [], points: [], isEditing: false, isDisposed: false, outline: null, locationMarker: null, corners: leaflet.layerGroup().addTo(map) };
  selectField(editor, editor.plotId, false);
  localizeZoom(panel);
  redraw(editor);
  const bounds = panel.dataset.plotId ? editor.saved : [...displayedLandBoundary(farm), ...editor.fields.flatMap((field) => field.boundary ?? [])];
  if (bounds.length) map.fitBounds(leaflet.latLngBounds(bounds), { padding: BOUNDARY_PADDING, maxZoom: LOCATION_ZOOM });
  return bindEditor(editor);
}

/** @param {Editor} editor @returns {()=>void} */
const bindEditor = (editor) => {
  const onMapClick = (/** @type {{latlng:LatLng}} */ event) => addCorner(editor, event.latlng);
  const onClick = (/** @type {MouseEvent} */ event) => {
    if (!(event.target instanceof Element)) return;
    const choice = event.target.closest('[data-field-crop-choice]');
    if (choice instanceof HTMLButtonElement) { selectCrop(editor, choice.dataset.fieldCropChoice ?? ''); return; }
    const button = event.target.closest('[data-land-action]');
    if (button instanceof HTMLButtonElement) { event.stopPropagation(); handleAction(editor, button.dataset.landAction ?? ''); }
  };
  const onChange = (event) => {
    if (!(event.target instanceof HTMLSelectElement)) return;
    if (event.target.matches('[data-field-select]')) selectField(editor, event.target.value);
    if (event.target.matches('[data-map-type]')) {
      try { if (!saveMapType(editor.store, event.target.value)) return; }
      catch (error) { event.target.value = savedMapType(editor.store); setStatus(editor, error instanceof Error ? error.message : 'Could not save land.'); return; }
      const layer = createMapLayer(editor.leaflet, event.target.value);
      editor.map.removeLayer(editor.baseLayer);
      editor.baseLayer = layer.addTo(editor.map);
    }
  };
  const onKeyDown = (event) => { if (event.key === 'Escape' && editor.isEditing) { event.preventDefault(); handleAction(editor, 'cancel'); } };
  editor.panel.addEventListener('keydown', onKeyDown);
  editor.panel.addEventListener('change', onChange);
  editor.map.on('click', onMapClick);
  editor.panel.addEventListener('click', onClick);
  return () => {
    editor.isDisposed = true;
    editor.map.off('click', onMapClick);
    editor.panel.removeEventListener('click', onClick);
    editor.panel.removeEventListener('change', onChange);
    editor.panel.removeEventListener('keydown', onKeyDown);
    editor.map.remove();
  };
};

/** @param {LandPoint[]} points @returns {LandPoint[]|null} */
const validCorners = (points) => {
  try { return normalizeFieldBoundary(points); }
  catch (error) { if (error instanceof Error) return null; throw error; }
};

/** @param {Editor} editor @param {string} plotId @param {boolean} [shouldFrame] @returns {void} */
const selectField = (editor, plotId, shouldFrame = true) => {
  if (editor.isEditing) return;
  editor.plotId = plotId;
  const field = editor.fields.find((item) => item.id === plotId);
  editor.saved = structuredClone(field?.boundary ?? []);
  editor.points = structuredClone(editor.saved);
  editor.panel.querySelector('[data-field-name]').value = field?.name ?? '';
  editor.panel.querySelector('[data-field-crop]').value = field?.crop ?? '';
  editor.panel.querySelector('[data-field-select]').value = plotId;
  redraw(editor);
  if (shouldFrame && editor.saved.length) editor.map.fitBounds(editor.leaflet.latLngBounds(editor.saved), { padding: BOUNDARY_PADDING, maxZoom: LOCATION_ZOOM });
};

/** @param {Editor} editor @returns {void} */
const drawFields = (editor) => {
  editor.fieldLayers.clearLayers();
  const land = editor.store.getState().farms.find((item) => item.id === editor.farmId);
  const boundary = land ? displayedLandBoundary(land) : [];
  if (boundary.length) editor.leaflet.polygon(boundary, { color: '#225e42', weight: 2, fillOpacity: 0.08, interactive: false }).addTo(editor.fieldLayers);
  for (const field of editor.fields) {
    if (!field.boundary?.length || (editor.isEditing && field.id === editor.plotId)) continue;
    labelFieldCrop(editor.leaflet.polygon(field.boundary, { color: field.id === editor.plotId ? SAVED_COLOR : '#8b6d32', fillOpacity: BOUNDARY_FILL_OPACITY, interactive: false }).addTo(editor.fieldLayers), field.crop);
  }
};

/** @param {Editor} editor @returns {void} */
const redraw = (editor) => {
  if (editor.isDisposed) return;
  const { panel, map, leaflet, points, isEditing, corners } = editor;
  if (editor.outline) map.removeLayer(editor.outline);
  editor.outline = null;
  const wasEditing = !panel.querySelector('[data-field-details]').hidden;
  corners.clearLayers();
  drawFields(editor);
  if (isEditing) drawDraft(editor);
  panel.querySelector('[data-land-tools]').hidden = !isEditing || editor.step !== 0;
  panel.querySelector('[data-field-details]').hidden = !isEditing;
  panel.querySelector('[data-field-select]').disabled = isEditing;
  panel.querySelector('[data-land-action="edit"]').hidden = isEditing;
  panel.querySelector('[data-land-action="edit"]').disabled = !editor.plotId;
  const createButton = panel.querySelector('[data-land-action="new"]');
  if (createButton) createButton.hidden = isEditing;
  panel.querySelector('[data-land-action="delete"]').hidden = isEditing;
  panel.querySelector('[data-land-action="delete"]').disabled = !editor.plotId;
  panel.querySelector('[data-land-action="save"]').disabled = !validCorners(points);
  panel.querySelector('[data-land-action="undo"]').disabled = points.length === 0;
  setStatus(editor, '', false);
  updateSheet(editor);
  if (wasEditing !== isEditing) {
    map.invalidateSize({ animate: false });
    const bounds = isEditing ? points : editor.saved;
    if (bounds.length) map.fitBounds(leaflet.latLngBounds(bounds), { padding: BOUNDARY_PADDING, maxZoom: LOCATION_ZOOM });
  }
};

/** @param {Editor} editor @returns {void} */
const drawDraft = (editor) => {
  const { points, leaflet, map, corners } = editor;
  const shape = validCorners(points) ?? points;
  if (shape.length) editor.outline = leaflet.polygon(shape, { color: EDIT_COLOR, fillOpacity: BOUNDARY_FILL_OPACITY, interactive: false }).addTo(map);
  points.forEach((point, index) => {
    const corner = leaflet.circleMarker(point, { radius: CORNER_RADIUS, color: EDIT_COLOR, fillOpacity: 1, bubblingMouseEvents: false }).addTo(corners);
    corner.on('click', () => { editor.selectedCorner = index; setStatus(editor, 'Tap the new position for this corner.'); });
  });
};

/** @param {Editor} editor @param {LatLng} point @returns {void} */
const addCorner = (editor, point) => {
  if (!editor.isEditing || editor.step !== 0) return;
  const coordinate = [point.lat, point.lng];
  if (editor.selectedCorner !== null) {
    editor.points[editor.selectedCorner] = coordinate;
    editor.selectedCorner = null;
  } else {
    if (editor.points.length >= MAX_POINTS) { setStatus(editor, '100 corners marked. Select a corner to move it, or undo.'); return; }
    if (editor.points.some((existing) => Math.hypot(existing[0] - point.lat, existing[1] - point.lng) < MIN_CORNER_DISTANCE)) { setStatus(editor, 'This corner is too close to another. Choose a different position.'); return; }
    editor.points.push(coordinate);
  }
  redraw(editor);
  if (editor.points.length >= 3 && !validCorners(editor.points)) setStatus(editor, 'Mark corners in boundary order; undo or move a corner to fix this shape.');
};

/** @param {Editor} editor @param {string} name @returns {void} */
const handleAction = (editor, name) => {
  if (name === 'delete') { showFieldDeletion(editor); return; }
  if (name === 'confirm-delete') { removeSelectedField(editor); return; }
  if (name === 'cancel-delete') { editor.panel.querySelector('[data-field-delete-dialog]').close(); return; }
  if (name === 'locate') { locateLandMap(editor); return; }
  if (name === 'edit' || name === 'new') { beginField(editor, name === 'new'); return; }
  if (!editor.isEditing) return;
  if (name === 'next') { advanceSheet(editor); return; }
  if (name === 'back') { editor.step = Math.max(0, editor.step - 1); redraw(editor); focusSheet(editor); return; }
  if (name === 'center') { addCorner(editor, editor.map.getCenter()); return; }
  if (name === 'undo') editor.points.pop();
  if (name === 'clear') editor.points = [];
  editor.selectedCorner = null;
  if (name === 'cancel') { editor.isEditing = false; selectField(editor, editor.previousPlotId); editor.panel.querySelector('[data-land-action="new"]').focus(); return; }
  if (name === 'save' && ((editor.step !== 3 && !editor.plotId) || !commitBoundary(editor))) return;
  redraw(editor);
};

/** @param {Editor} editor @param {boolean} isNew @returns {void} */
const beginField = (editor, isNew) => {
  if (editor.isEditing) return;
  editor.step = 0;
  editor.previousPlotId = editor.plotId;
  editor.isEditing = true;
  editor.selectedCorner = null;
  if (isNew) {
    editor.plotId = ''; editor.points = [];
    editor.panel.querySelector('[data-field-name]').value = '';
    editor.panel.querySelector('[data-field-crop]').value = '';
  } else editor.points = editor.saved.length >= 3 ? structuredClone(editor.saved) : [];
  redraw(editor);
  focusSheet(editor);
};

/** @param {Editor} editor @returns {boolean} */
const commitBoundary = (editor) => {
  try {
    const draft = { plotId: editor.plotId, name: editor.panel.querySelector('[data-field-name]').value, crop: editor.panel.querySelector('[data-field-crop]').value, boundary: editor.points };
    let plotId = editor.plotId;
    editor.store.update((state) => { plotId = saveFieldBoundary(state, editor.farmId, draft); });
    editor.plotId = plotId;
    const farm = editor.store.getState().farms.find((item) => item.id === editor.farmId);
    editor.fields = mappedFields(farm);
    refreshFieldOptions(editor);
    editor.isEditing = false;
    selectField(editor, editor.plotId, false);
    editor.panel.dispatchEvent(new CustomEvent('land-field-saved', { bubbles: true }));
    return true;
  } catch (error) {
    console.warn('Field boundary save failed.', error);
    setStatus(editor, error instanceof Error ? error.message : 'Could not save field. Try again.');
    return false;
  }
};

/** @param {Editor} editor @returns {void} */
const refreshFieldOptions = (editor) => {
  const select = editor.panel.querySelector('[data-field-select]');
  select.replaceChildren(...editor.fields.map((field) => {
    const option = document.createElement('option');
    option.value = field.id; option.textContent = `${field.name} · ${field.crop}`;
    return option;
  }));
};

/** @param {Editor} editor @param {GeolocationPosition} position @returns {void} */
const showPosition = (editor, position) => {
  if (editor.isDisposed) return;
  editor.panel.querySelector('[data-land-action="locate"]').disabled = false;
  const { latitude, longitude, accuracy } = position.coords;
  editor.map.setView([latitude, longitude], LOCATION_ZOOM);
  if (editor.locationMarker) editor.map.removeLayer(editor.locationMarker);
  editor.locationMarker = editor.leaflet.circleMarker([latitude, longitude], { radius: POSITION_RADIUS, color: EDIT_COLOR, fillOpacity: 1 }).addTo(editor.map);
  setStatus(editor, t('Current position, accurate to about {accuracy} m. Mark your land corners separately.', { accuracy: Math.round(accuracy) }));
};

/** @param {Editor} editor @returns {void} */
const locateLandMap = (editor) => {
  const button = editor.panel.querySelector('[data-land-action="locate"]');
  if (button.disabled) return;
  if (!navigator.geolocation) { setStatus(editor, 'Location is unavailable. You can move the map manually.'); return; }
  button.disabled = true;
  setStatus(editor, 'Waiting for location permission…');
  const onError = (/** @type {{code:number}} */ error) => {
    if (editor.isDisposed) return;
    button.disabled = false;
    setStatus(editor, error.code === 1 ? 'Location permission denied. Move the map to your land manually.' : 'Could not get location. Try again or move the map manually.');
  };
  try {
    navigator.geolocation.getCurrentPosition((position) => showPosition(editor, position), onError, { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 });
  } catch (error) { console.warn('Land map location failed.', error); onError({ code: 2 }); }
};

/** @param {HTMLElement} panel @returns {void} */
const localizeZoom = (panel) => {
  for (const [selector, label] of [['.leaflet-control-zoom-in', 'Zoom in'], ['.leaflet-control-zoom-out', 'Zoom out']]) {
    const button = panel.querySelector(selector);
    button?.setAttribute('title', t(label));
    button?.setAttribute('aria-label', t(label));
  }
};

const FIELD_STEPS = ['boundary', 'name', 'crop', 'review'];
const FIELD_STEP_TITLES = ['Mark your field', 'What do you call it?', 'What grows here?', 'Looks right?'];
const COMMON_CROPS = ['Rice', 'Coconut', 'Oil palm', 'Vegetables'];

/** @param {Editor} editor @returns {void} */
const updateSheet = (editor) => {
  const { panel, step, isEditing } = editor;
  panel.querySelector('[data-field-progress]').textContent = t('Step {step} of 4', { step: step + 1 });
  panel.querySelector('[data-field-title]').textContent = t(FIELD_STEP_TITLES[step]);
  FIELD_STEPS.forEach((name, index) => { panel.querySelector(`[data-field-step="${name}"]`).hidden = index !== step; });
  panel.querySelector('[data-field-corners]').textContent = t('{count} corners. Mark 3–100 points in boundary order; tap a marked corner to move it.', { count: editor.points.length });
  panel.querySelector('[data-land-action="back"]').hidden = step === 0;
  panel.querySelector('[data-land-action="next"]').hidden = step === 3 || Boolean(editor.plotId);
  panel.querySelector('[data-land-action="next"]').disabled = step === 0 && !validCorners(editor.points);
  panel.querySelector('[data-land-action="save"]').hidden = step !== 3 && !editor.plotId;
  if (editor.plotId) panel.querySelector('[data-field-progress]').textContent = '';
  if (isEditing && step === 2) syncCropChoices(editor);
  if (isEditing && step === 3) {
    panel.querySelector('[data-field-review-name]').textContent = panel.querySelector('[data-field-name]').value.trim();
    panel.querySelector('[data-field-review-crop]').textContent = t(panel.querySelector('[data-field-crop]').value.trim());
    panel.querySelector('[data-field-review-area]').textContent = `${fieldAreaHectares(validCorners(editor.points) ?? []).toFixed(2)} ${t('ha')}`;
  }
};

/** @param {Editor} editor @returns {void} */
const advanceSheet = (editor) => {
  const selector = editor.step === 1 ? '[data-field-name]' : '[data-field-crop]';
  if (editor.step === 0 && !validCorners(editor.points)) { setStatus(editor, 'Mark 3–100 distinct corners in boundary order without crossing edges.'); return; }
  if ((editor.step === 1 || editor.step === 2) && !editor.panel.querySelector(selector).value.trim()) {
    setStatus(editor, editor.step === 1 ? 'Enter a field name.' : 'Choose a crop.'); return;
  }
  editor.step = Math.min(3, editor.step + 1);
  redraw(editor);
  focusSheet(editor);
};

/** @param {Editor} editor @returns {void} */
const focusSheet = (editor) => {
  const selector = editor.step === 1 ? '[data-field-name]' : '[data-field-title]';
  editor.panel.querySelector(selector).focus({ preventScroll: true });
};

/** @param {Editor} editor @param {string} crop @returns {void} */
const selectCrop = (editor, crop) => {
  if (!editor.isEditing || editor.step !== 2) return;
  const input = editor.panel.querySelector('[data-field-crop]');
  input.value = crop === 'Other' ? '' : crop;
  syncCropChoices(editor, crop === 'Other');
  if (crop === 'Other') input.focus({ preventScroll: true });
};

/** @param {Editor} editor @param {boolean} [isOther] @returns {void} */
const syncCropChoices = (editor, isOther = false) => {
  const crop = editor.panel.querySelector('[data-field-crop]').value;
  const hasOther = isOther || (crop !== '' && !COMMON_CROPS.includes(crop));
  editor.panel.querySelector('[data-field-other]').hidden = !hasOther;
  for (const choice of editor.panel.querySelectorAll('[data-field-crop-choice]')) {
    choice.setAttribute('aria-pressed', String(choice.dataset.fieldCropChoice === crop || (choice.dataset.fieldCropChoice === 'Other' && hasOther)));
  }
};

/** @param {Leaflet} leaflet @param {string} type @returns {Layer} */
export function createMapLayer(leaflet, type) {
  if (type === 'satellite') return leaflet.tileLayer('https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    maxZoom: MAX_ZOOM, maxNativeZoom: NATIVE_TILE_ZOOM,
    attribution: 'Tiles &copy; <a href="https://www.esri.com/">Esri</a> &mdash; Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
  });
  return leaflet.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: MAX_ZOOM, maxNativeZoom: NATIVE_TILE_ZOOM, attribution: `&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> ${t('contributors')}`,
  });
};

/** @param {Editor} editor @returns {void} */
const removeSelectedField = (editor) => {
  if (editor.isEditing || !editor.plotId) return;
  const field = editor.fields.find((item) => item.id === editor.plotId);
  if (!field || !editor.panel.querySelector('[data-field-delete-dialog]').open) return;
  try {
    editor.store.update((state) => deleteField(state, editor.farmId, field.id));
    editor.panel.dispatchEvent(new CustomEvent('land-field-deleted', { bubbles: true, detail: { farmId: editor.farmId } }));
  } catch (error) {
    editor.panel.querySelector('[data-field-delete-dialog]').close();
    console.error('Field deletion failed.', error);
    setStatus(editor, error instanceof Error ? error.message : 'Could not delete field. Try again.');
  }
};

/** @param {Editor} editor @returns {void} */
const showFieldDeletion = (editor) => {
  if (editor.isEditing || !editor.plotId) return;
  const field = editor.fields.find((item) => item.id === editor.plotId);
  if (!field) return;
  editor.panel.querySelector('[data-field-delete-copy]').textContent = t('Delete “{name}”? Its boundary and field details will be removed. Farm tasks and total area will stay unchanged.', { name: field.name });
  editor.panel.querySelector('[data-field-delete-dialog]').showModal();
};

/** @param {HTMLElement} panel @param {import('./store.mjs').Farm} farm @param {LandMap} map @param {Leaflet} leaflet @param {import('./store.mjs').AppStore} store @param {Layer} baseLayer @returns {()=>void} */
const initializeLandOverview = (panel, farm, map, leaflet, store, baseLayer) => {
  const boundary = displayedLandBoundary(farm);
  if (boundary.length) leaflet.polygon(boundary, { color: SAVED_COLOR, weight: 2, fillOpacity: 0.08, interactive: false }).addTo(map);
  const fields = mappedFields(farm);
  for (const field of fields) {
    if (!field.boundary?.length) continue;
    leaflet.polygon(field.boundary, { color: OVERVIEW_HALO_COLOR, weight: OVERVIEW_HALO_WEIGHT, opacity: 0.95, fill: false, interactive: false }).addTo(map);
    const polygon = leaflet.polygon(field.boundary, { color: OVERVIEW_OUTLINE_COLOR, weight: OVERVIEW_OUTLINE_WEIGHT, opacity: 1, fillOpacity: 0.08, interactive: true }).addTo(map);
    polygon.bindTooltip(`<button type="button" class="field-care-map-button" aria-label="${escapeHtml(field.name)} · ${escapeHtml(t('Field care'))}"><span aria-hidden="true">${cropEmoji(field.crop)}</span></button>`, { permanent: true, direction: 'center', className: 'field-care-label', opacity: 1, interactive: true });
    polygon.on('click', () => panel.closest('main')?.querySelector('[data-field-care-sheet]')?.dispatchEvent(new CustomEvent('field-care-open', { detail: { farmId: farm.id, plotId: field.id } })));
  }
  const bounds = [...boundary, ...fields.flatMap((field) => field.boundary ?? [])];
  if (bounds.length) map.fitBounds(leaflet.latLngBounds(bounds), { padding: BOUNDARY_PADDING, maxZoom: LOCATION_ZOOM });
  localizeZoom(panel);
  let currentLayer = baseLayer;
  const onChange = (event) => {
    if (!event.target.matches('[data-map-type]')) return;
    try {
      if (!saveMapType(store, event.target.value)) return;
      const nextLayer = createMapLayer(leaflet, event.target.value).addTo(map);
      map.removeLayer(currentLayer);
      currentLayer = nextLayer;
    } catch (error) {
      event.target.value = savedMapType(store);
      const status = panel.querySelector('[data-land-status]');
      status.textContent = t(error instanceof Error ? error.message : 'Could not save land.');
      status.className = 'land-map-status';
    }
  };
  panel.addEventListener('change', onChange);
  const closeExpandedMap = initializeExpandedMap(panel, map);
  return () => { closeExpandedMap(); panel.removeEventListener('change', onChange); map.remove(); };
};

/** @type {Array<[string, RegExp]>} */
const CROP_EMOJIS = [
  ['🌾', /\b(rice|paddy|padi|wheat|gandum)\b|水稻|稻米|小麦/u],
  ['🥥', /\b(coconut|kelapa)\b(?!\s+sawit)|椰子/u],
  ['🌴', /\b(oil palm|palm|sawit)\b|油棕/u],
  ['🥬', /\b(vegetables?|sayur|lettuce|cabbage|kale|spinach|bayam|sawi|kangkung)\b|蔬菜|白菜|菠菜/u],
  ['🌽', /\b(corn|maize|jagung)\b|玉米/u],
  ['🌶️', /\b(chill?i|chilies|chillies|pepper|cili|cabai)\b|辣椒/u],
  ['🍅', /\b(tomato|tomatoes|tomat)\b|番茄|西红柿/u],
  ['🍌', /\b(banana|bananas|pisang)\b|香蕉/u],
  ['🍍', /\b(pineapple|nanas)\b|菠萝|黄梨/u],
  ['🥭', /\b(mango|mangga)\b|芒果/u],
  ['🍉', /\b(watermelon|tembikai)\b|西瓜/u],
  ['🥒', /\b(cucumber|timun)\b|黄瓜/u],
  ['🍆', /\b(eggplant|aubergine|terung)\b|茄子/u],
  ['🥔', /\b(potato|potatoes|kentang)\b|马铃薯|土豆/u],
  ['🥕', /\b(carrot|carrots|lobak)\b|胡萝卜/u],
  ['🫘', /\b(beans?|soybeans?|kacang)\b|豆/u],
  ['🍄', /\b(mushroom|mushrooms|cendawan)\b|蘑菇/u],
  ['🌳', /\b(durian|rubber|getah|fruit tree)\b|榴莲|橡胶/u],
];
/** @param {string} crop @returns {string} */
export function cropEmoji(crop) {
  const name = crop.normalize('NFKC').trim().toLowerCase();
  return CROP_EMOJIS.find(([, pattern]) => pattern.test(name))?.[0] ?? '🌱';
}
/** @param {Layer} polygon @param {string} crop @returns {Layer} */
export function labelFieldCrop(polygon, crop) {
  if (!crop?.trim()) return polygon;
  return polygon.bindTooltip(`<span role="img" aria-label="${escapeHtml(t(crop))}">${cropEmoji(crop)}</span>`, { permanent: true, direction: 'center', className: 'field-crop-emoji', opacity: 1, interactive: false });
}

/** @param {import('./store.mjs').AppStore} store @returns {'street'|'satellite'} */
export function savedMapType(store) {
  return store.getState().settings?.mapType === 'satellite' ? 'satellite' : 'street';
}
/** @param {import('./store.mjs').AppStore} store @param {string} value @returns {boolean} */
export function saveMapType(store, value) {
  if ((value !== 'street' && value !== 'satellite') || value === savedMapType(store)) return false;
  store.update((state) => { state.settings.mapType = value; });
  return true;
}

/** @param {HTMLElement} panel @param {LandMap} map @returns {()=>void} */
export function initializeExpandedMap(panel, map) {
  const button = panel.querySelector('[data-map-expand]');
  if (!button) return () => {};
  let isExpanded = false;
  const motion = createMapExpansionMotion(panel, map);
  const toggle = () => {
    isExpanded = !isExpanded;
    motion.animate(isExpanded);
    button.setAttribute('aria-expanded', String(isExpanded));
    const label = t(isExpanded ? 'Close expanded map' : 'Expand map');
    button.setAttribute('aria-label', label);
    button.setAttribute('title', label);
    button.innerHTML = isExpanded ? icon('arrows-minimize', 20) : icon('arrows-maximize', 20);
    button.focus({ preventScroll: true });
  };
  const onClick = (event) => {
    if (!event.target.closest('[data-map-expand]')) return;
    event.preventDefault();
    toggle();
  };
  const onKey = (event) => {
    if (!isExpanded) return;
    if (event.key === 'Escape') { event.preventDefault(); toggle(); }
    if (event.key !== 'Tab') return;
    const controls = [...panel.querySelectorAll('a[href],button,select,[tabindex="0"]')].filter((control) => !control.disabled && control.getClientRects().length);
    const edge = event.shiftKey ? controls[0] : controls.at(-1);
    if (document.activeElement === edge) { event.preventDefault(); (event.shiftKey ? controls.at(-1) : controls[0])?.focus(); }
  };
  panel.addEventListener('click', onClick);
  panel.addEventListener('keydown', onKey);
  return () => {
    panel.removeEventListener('click', onClick);
    panel.removeEventListener('keydown', onKey);
    motion.clear();
    panel.classList?.toggle('is-map-expanded', false);
  };
}

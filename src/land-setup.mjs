import { createMapLayer, labelFieldCrop, savedMapType, saveMapType } from './land-map.mjs';
import { t } from './i18n.mjs';
import { saveLandGrid, splitLand } from './land-grid.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const CROPS = ['Rice', 'Coconut', 'Oil palm', 'Vegetables', 'Other'];
/** @param {import('./store.mjs').Farm} [land] @returns {string} */
export function renderLandSetup(land) {
  if (land?.plots.length) return `${pageHeading('', t('Choose field dimensions'))}<p>${esc(t('This land already has fields. Edit them individually.'))}</p><a class="button" href="/farm/${esc(land.id)}">${esc(t('Back'))}</a>`;
  if (land && land.boundary?.length !== 4) return `${pageHeading('', t('Choose field dimensions'))}<p>${esc(t('Automatic grids need four outer corners. Your land is saved; edit its boundary to use a grid.'))}</p><a class="button" href="/farm/${esc(land.id)}/edit">${esc(t('Edit land'))}</a>`;
  return `${pageHeading('', t(land ? 'Choose field dimensions' : 'Add land'))}<section class="land-setup" data-land-setup="${esc(land?.id ?? '')}" ><div class="land-grid-map-wrap"><div class="land-setup-map" data-grid-map aria-label="${esc(t('Mark your land'))}"></div><div class="land-grid-map-tools"><label><span class="sr-only">${esc(t('Map type'))}</span><select data-grid-map-type><option value="street">${esc(t('Street'))}</option><option value="satellite">${esc(t('Satellite'))}</option></select></label><button type="button" data-grid-locate aria-label="${esc(t('Use my location'))}">${icon('map-pin', 20)}</button><button type="button" data-grid-undo aria-label="${esc(t('Undo'))}">${icon('arrow-back-up', 20)}</button></div></div><p class="sr-only" data-grid-status role="status">${esc(t('Tap the four outer corners of your land.'))}</p><form id="land-grid-form" class="land-grid-controls" data-grid-form><div data-grid-details><div class="land-grid-summary"><span>${esc(t('Fields'))}</span><output data-grid-count aria-live="polite">1</output></div><div ${land ? 'hidden' : ''}><label class="field">${esc(t('Land name'))}<input class="input" name="name" value="${esc(land?.name ?? '')}" maxlength="120"></label></div><div class="land-grid-dimensions">${['Columns', 'Rows'].map((label) => `<label class="land-grid-dimension"><span>${esc(t(label))}</span><input name="${label.toLowerCase()}" type="number" min="1" max="100" step="1" value="1" required></label>`).join('')}</div></div><div data-grid-crops hidden><h2 data-grid-heading></h2><div class="land-grid-picker" data-grid-picker></div><div class="land-crop-picker">${CROPS.map((crop) => `<button type="button" class="button button-secondary" data-grid-crop="${crop}">${esc(t(crop))}</button>`).join('')}</div><label class="field" data-custom-crop hidden>${esc(t('Crop'))}<input class="input" name="customCrop" maxlength="80"></label></div><p role="alert" data-grid-error></p><div class="land-grid-actions"><button type="button" class="button button-secondary" data-grid-back hidden>${esc(t('Back'))}</button><button type="submit" class="button" data-grid-submit>${esc(t('Continue'))}</button></div></form></section>`;
}
/** @param {HTMLElement} panel @param {import('./store.mjs').AppStore} store @param {import('./land-map.mjs').Leaflet|undefined} leaflet @returns {()=>void} */
export function initializeLandSetup(panel, store, leaflet) {
  const status = panel.querySelector('[data-grid-status]');
  if (!leaflet) { status.textContent = t('Map unavailable. Reload to try again.'); return () => {}; }
  const map = leaflet.map(panel.querySelector('[data-grid-map]'), { scrollWheelZoom: true, touchZoom: true, zoomControl: true }).setView([4.75, 100.9], 8);
  map.attributionControl?.setPrefix(false);
  let baseLayer = createMapLayer(leaflet, savedMapType(store)).addTo(map);
  panel.querySelector('[data-grid-map-type]').value = savedMapType(store);
  for (const [selector, label] of [['.leaflet-control-zoom-in', 'Zoom in'], ['.leaflet-control-zoom-out', 'Zoom out']]) {
    const control = panel.querySelector(selector); control?.setAttribute('aria-label', t(label)); control?.setAttribute('title', t(label));
  }
  const layers = leaflet.layerGroup().addTo(map);
  const form = panel.querySelector('form');
  const land = store.getState().farms.find((item) => item.id === panel.dataset.landSetup);
  const draft = { points: land?.boundary?.map((point) => [...point]) ?? [], fields: [], crops: [], selected: 0, isAssigning: false, isDisposed: false };
  const error = panel.querySelector('[data-grid-error]');
  const redraw = () => {
    layers.clearLayers();
    if (!draft.isAssigning) {
      draft.points.forEach((point) => leaflet.circleMarker(point, { radius: 5 }).addTo(layers));
      if (draft.points.length > 2) leaflet.polygon(draft.points, { color: '#075bea', fillOpacity: 0.12 }).addTo(layers);
      if (draft.points.length === 4) {
        try {
          const fields = splitLand(draft.points, Number(form.elements.namedItem('columns').value), Number(form.elements.namedItem('rows').value));
          fields.forEach((boundary) => leaflet.polygon(boundary, { color: '#075bea', weight: 2, fillOpacity: 0.12, interactive: false }).addTo(layers));
          panel.querySelector('[data-grid-count]').textContent = String(fields.length);
          error.textContent = '';
        } catch (failure) {
          panel.querySelector('[data-grid-count]').textContent = '—';
          error.textContent = t(failure instanceof Error ? failure.message : 'Could not save land.');
        }
      }
      return;
    }
    draft.fields.forEach((boundary, index) => labelFieldCrop(leaflet.polygon(boundary, { color: index === draft.selected ? '#075bea' : '#285d42', weight: index === draft.selected ? 4 : 1, fillOpacity: index === draft.selected ? 0.55 : 0.15 }).addTo(layers).on('click', () => { draft.selected = index; refresh(); }), draft.crops[index] ?? ''));
  };
  const refresh = () => {
    panel.classList.toggle('is-assigning', draft.isAssigning);
    panel.querySelector('[data-grid-details]').hidden = draft.isAssigning;
    panel.querySelector('[data-grid-crops]').hidden = !draft.isAssigning;
    panel.querySelector('[data-grid-back]').hidden = !draft.isAssigning;
    panel.querySelector('[data-grid-undo]').hidden = Boolean(land) || draft.isAssigning;
    panel.querySelector('[data-grid-submit]').textContent = t(draft.isAssigning ? 'Save land' : 'Continue');
    status.textContent = t(draft.isAssigning ? 'Choose a crop for the highlighted field.' : land ? 'Choose field dimensions' : 'Tap the four outer corners of your land.');
    panel.querySelector('[data-grid-heading]').textContent = t('Field {number}', { number: draft.selected + 1 });
    panel.querySelector('[data-grid-picker]').innerHTML = draft.fields.map((_, index) => `<button type="button" class="button button-secondary" data-grid-index="${index}" aria-pressed="${index === draft.selected}">${index + 1}${draft.crops[index] ? ` · ${esc(t(draft.crops[index]))}` : ''}</button>`).join('');
    const customInput = form.elements.namedItem('customCrop');
    const currentCrop = draft.crops[draft.selected] ?? '';
    const isCustom = currentCrop === 'Other' || (currentCrop !== '' && !CROPS.includes(currentCrop));
    panel.querySelector('[data-custom-crop]').hidden = !isCustom;
    if (document.activeElement !== customInput) customInput.value = isCustom && currentCrop !== 'Other' ? currentCrop : '';
    panel.querySelectorAll('[data-grid-crop]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.gridCrop === draft.crops[draft.selected])));
    redraw();
    map.invalidateSize({ animate: false });
  };
  const onMapClick = ({ latlng }) => { if (!land && !draft.isAssigning && draft.points.length < 4) { draft.points.push([latlng.lat, latlng.lng]); redraw(); } };
  const onSubmit = (event) => {
    event.preventDefault(); event.stopPropagation(); error.textContent = '';
    try {
      const data = new FormData(form);
      if (!draft.isAssigning) { draft.fields = splitLand(draft.points, Number(data.get('columns')), Number(data.get('rows'))); draft.crops = draft.fields.map(() => ''); draft.selected = 0; draft.isAssigning = true; refresh(); map.fitBounds(leaflet.latLngBounds(draft.points), { padding: [20, 20], maxZoom: 19 }); panel.scrollIntoView({ block: 'start' }); return; }
      let id = '';
      store.update((state) => { id = saveLandGrid(state, { id: land?.id, name: String(data.get('name')), location: land?.location ?? '', boundary: draft.points, columns: Number(data.get('columns')), rows: Number(data.get('rows')), crops: draft.crops }); });
      panel.dispatchEvent(new CustomEvent('land-grid-saved', { bubbles: true, detail: { id } }));
    } catch (failure) { error.textContent = t(failure instanceof Error ? failure.message : 'Could not save land.'); }
  };
  const onClick = (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-grid-index')) { draft.selected = Number(button.dataset.gridIndex); refresh(); }
    if (button.hasAttribute('data-grid-crop')) { draft.crops[draft.selected] = button.dataset.gridCrop; panel.querySelector('[data-custom-crop]').hidden = button.dataset.gridCrop !== 'Other'; refresh(); }
    if (button.hasAttribute('data-grid-undo')) { draft.points.pop(); redraw(); }
    if (button.hasAttribute('data-grid-back')) { draft.isAssigning = false; refresh(); }
    if (button.hasAttribute('data-grid-locate') && !navigator.geolocation) error.textContent = t('Location unavailable. Move the map to your land.');
    if (button.hasAttribute('data-grid-locate')) navigator.geolocation?.getCurrentPosition((position) => { if (!draft.isDisposed) map.setView([position.coords.latitude, position.coords.longitude], 17); }, () => { if (!draft.isDisposed) error.textContent = t('Location unavailable. Move the map to your land.'); }, { timeout: 15000 });
  };
  const onInput = (event) => { if (['columns', 'rows'].includes(event.target.name)) redraw(); if (event.target.name === 'customCrop') { draft.crops[draft.selected] = event.target.value; refresh(); } };
  const onChange = (event) => { if (event.target.matches('[data-grid-map-type]')) {
    try { if (!saveMapType(store, event.target.value)) return; }
    catch (failure) { event.target.value = savedMapType(store); error.textContent = t(failure instanceof Error ? failure.message : 'Could not save land.'); return; }
    map.removeLayer(baseLayer); baseLayer = createMapLayer(leaflet, event.target.value).addTo(map); } };
  panel.addEventListener('change', onChange);
  redraw();
  if (draft.points.length) map.fitBounds(leaflet.latLngBounds(draft.points), { padding: [20, 20], maxZoom: 18 });
  refresh();
  map.on('click', onMapClick); form.addEventListener('submit', onSubmit); panel.addEventListener('click', onClick); panel.addEventListener('input', onInput);
  return () => { draft.isDisposed = true; map.remove(); panel.removeEventListener('change', onChange); form.removeEventListener('submit', onSubmit); panel.removeEventListener('click', onClick); panel.removeEventListener('input', onInput); };
}

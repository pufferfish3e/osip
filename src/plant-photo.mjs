import { validateWebResult } from './plant-web.mjs';
import { translateAnalysis } from './translation.mjs';
import { getLocale, t } from './i18n.mjs';
import { findPlantGuide } from './plant-guides.mjs';
import { renderPlantAnalysis } from './plant-help.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

/** @typedef {{title:string,summary:string,isPlant:boolean,observations:string[],nextSteps:string[],guideSlugs:string[],research?:import('./plant-web.mjs').PlantWebResult,referenceImages?:{url:string,source:string,title:string,credit:string}[]}} PlantAnalysis */
/** @typedef {{status:'idle'|'preparing'|'ready'|'analyzing'|'success'|'error'|'translating',resultLocale:string,image:string,result:PlantAnalysis|null,error:string}} PhotoState */
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGE_CHARACTERS = Math.ceil(4 * 1024 * 1024 / 3) * 4 + 40;
const MAX_EDGE = 1600;
const MAX_PIXELS = 48 * 1000 * 1000;
const JPEG_QUALITY = 0.84;
const REQUEST_TIMEOUT = 75000;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/** @param {{size:number,type:string}} file @returns {void} */
export function validatePhotoFile(file) {
  if (!IMAGE_TYPES.has(file.type)) throw new Error('Choose a JPEG, PNG, WebP or supported phone photo.');
  if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Choose a photo smaller than 15 MB.');
}

/** @param {number} width @param {number} height @returns {{width:number,height:number}} */
export function fitPhotoDimensions(width, height) {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > MAX_PIXELS) throw new Error('This photo is too large to prepare. Choose a smaller image.');
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** @param {File} file @returns {Promise<string>} */
export async function preparePlantPhoto(file) {
  validatePhotoFile(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const size = fitPhotoDimensions(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the photo.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    if (!dataUrl.startsWith('data:image/jpeg;base64,') || dataUrl.length > MAX_IMAGE_CHARACTERS) throw new Error('Choose a smaller photo and try again.');
    return dataUrl;
  } catch (error) {
    if (error instanceof Error && error.name === 'EncodingError') throw new Error('This photo format could not be opened. Try a JPEG or PNG.');
    throw error;
  } finally { URL.revokeObjectURL(url); }
}

/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
/** @param {unknown} value @param {number} limit @returns {value is string[]} */
const isTextList = (value, limit) => Array.isArray(value) && value.length <= limit && value.every((item) => typeof item === 'string' && item.length <= 1000);

/** @param {unknown} value @returns {PlantAnalysis} */
export function parsePlantAnalysis(value) {
  if (!isObject(value) || typeof value.title !== 'string' || !value.title.trim() || value.title.length > 200 || typeof value.summary !== 'string' || !value.summary.trim() || value.summary.length > 3000 || typeof value.isPlant !== 'boolean' || !isTextList(value.observations, 6) || !isTextList(value.nextSteps, 6) || !isTextList(value.guideSlugs, 3) || value.guideSlugs.some((slug) => !findPlantGuide(slug))) throw new Error('The photo summary was incomplete. Please try again.');
  const references = value.referenceImages;
  if (references !== undefined && (!Array.isArray(references) || references.length > 3 || references.some((item) => {
    if (!isObject(item) || typeof item.title !== 'string' || item.title.length > 180 || typeof item.credit !== 'string' || item.credit.length > 180) return true;
    try { return new URL(item.url).hostname !== 'upload.wikimedia.org' || new URL(item.url).protocol !== 'https:' || new URL(item.source).hostname !== 'commons.wikimedia.org' || new URL(item.source).protocol !== 'https:'; }
    catch { return true; }
  }))) throw new Error('The photo references could not be read.');
  return { title: value.title, summary: value.summary, isPlant: value.isPlant, observations: value.observations, nextSteps: value.nextSteps, guideSlugs: value.isPlant ? [...new Set(value.guideSlugs)] : [], ...(value.research ? { research: validateWebResult(value.research) } : {}), ...(value.isPlant && references ? { referenceImages: references } : {}) };
}

/** @param {string} image @param {AbortSignal} signal @param {typeof fetch} fetcher @returns {Promise<PlantAnalysis>} */
export async function requestPlantAnalysis(image, signal, fetcher = fetch) {
  const response = await fetcher('/api/plant-analysis', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ image, locale: getLocale() }), signal, cache: 'no-store' });
  let payload;
  try { payload = await response.json(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new Error('Photo analysis returned an unreadable response. Please try again.');
  }
  if (!response.ok) {
    const message = isObject(payload) && isObject(payload.error) && typeof payload.error.message === 'string' ? payload.error.message : 'Photo analysis is unavailable. Try again or search the guides.';
    throw new Error(message);
  }
  return parsePlantAnalysis(payload);
}

/** @returns {PhotoState} */
const initialState = () => ({ status: 'idle', image: '', result: null, resultLocale: getLocale(), error: '' });

/** @param {PhotoState} state @returns {string} */
export function renderPhotoState(state) {
  const isBusy = ['preparing', 'analyzing', 'translating'].includes(state.status);
  const preview = state.image ? `<img src="${esc(state.image)}" alt="${esc(t('Your selected plant photo'))}">` : `<div class="plant-viewfinder" aria-hidden="true">${icon('leaf', 72)}</div>`;
  const status = state.status === 'preparing' ? 'Preparing your photo…' : state.status === 'translating' ? 'Translating your summary…' : state.status === 'analyzing' ? 'Looking at your plant…' : '';
  const summary = state.result && (!state.resultLocale || state.resultLocale === getLocale()) ? renderPlantAnalysis(state.result)
    : state.result && !isBusy ? `<section class="card card-pad"><p>${esc(t('This summary is in another language. Translate it to your selected language.'))}</p><button class="button" data-photo-action="translate">${esc(t('Translate summary'))}</button></section>` : '';
  return `<section class="plant-camera-card" aria-busy="${isBusy}"><div class="plant-photo-preview">${preview}</div><div class="plant-photo-controls"><input type="file" accept="image/*" capture="environment" data-plant-photo="camera" aria-label="${esc(t('Take a plant photo'))}" hidden><input type="file" accept="image/*" data-plant-photo="library" aria-label="${esc(t('Choose a plant photo'))}" hidden>${isBusy ? `<p class="plant-photo-status" role="status">${icon('leaf', 22)} ${esc(t(status))}</p><button class="button button-secondary" data-photo-action="cancel">${esc(t('Cancel'))}</button>` : `<div class="plant-photo-buttons">${state.image ? `<button class="button" data-photo-action="analyze">${icon('plant-2', 20)} ${esc(t(state.result ? 'Analyze again' : 'Analyze photo'))}</button><button class="button button-secondary" data-photo-action="camera">${icon('camera', 20)} ${esc(t('Retake'))}</button>` : `<button class="button" data-photo-action="camera">${icon('camera', 20)} ${esc(t('Take a photo'))}</button>`}<button class="${state.image ? 'link' : 'button button-secondary'}" data-photo-action="library">${icon('photo', 20)} ${esc(t('Choose a photo'))}</button></div>`}${state.error ? `<div class="plant-photo-error" role="alert"><p>${esc(t(state.error))}</p><a class="link" href="/plant-help">${esc(t('Search problems instead'))} ${icon('arrow-right', 17)}</a></div>` : ''}</div></section>${summary}`;
}

/** @param {{onChange:(state:PhotoState)=>void,prepare?:(file:File)=>Promise<string>,request?:(image:string,signal:AbortSignal)=>Promise<PlantAnalysis>}} options @returns {{getState:()=>PhotoState,choose:(file:File)=>Promise<void>,analyze:()=>Promise<void>,reset:(notify?:boolean)=>void,cancel:()=>void}} */
export function createPlantPhotoController({ onChange, prepare = preparePlantPhoto, request = requestPlantAnalysis, translate = translateAnalysis }) {
  let state = initialState();
  let revision = 0;
  let pending = null;
  const localizedResults = new Map();
  /** @param {PhotoState} next @returns {void} */
  const update = (next) => { state = next; onChange(state); };
  /** @returns {void} */
  const cancel = () => { revision += 1; pending?.abort(); pending = null; update({ ...state, status: state.image ? 'ready' : 'idle', error: '' }); };
  /** @param {boolean} notify @returns {void} */
  const reset = (notify = true) => { revision += 1; pending?.abort(); pending = null; state = initialState(); localizedResults.clear(); if (notify) onChange(state); };
  /** @param {File} file @returns {Promise<void>} */
  const choose = async (file) => {
    reset(false);
    const current = revision;
    update({ ...state, status: 'preparing' });
    try { const image = await prepare(file); if (current === revision) update({ ...state, image, status: 'ready' }); }
    catch (error) { if (current === revision) update({ ...initialState(), status: 'error', error: error instanceof Error ? error.message : 'The photo could not be opened.' }); }
  };
  /** @returns {Promise<void>} */
  const analyze = async () => {
    if (!state.image || state.status === 'analyzing') return;
    const resultLocale = getLocale();
    const current = ++revision;
    const controller = new AbortController();
    pending = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    update({ ...state, status: 'analyzing', error: '', result: null });
    try {
      const result = await request(state.image, controller.signal);
      if (current === revision) { localizedResults.clear(); localizedResults.set(resultLocale, result); update({ ...state, status: 'success', result, resultLocale }); await localize(); }
    }
    catch (error) { if (current === revision) update({ ...state, status: 'error', error: controller.signal.aborted ? 'That took too long. Try again or search the guides.' : error instanceof TypeError ? 'Could not connect. Check your connection or search the guides.' : error instanceof Error ? error.message : 'Photo analysis is unavailable.' }); }
    finally { clearTimeout(timer); if (current === revision) pending = null; }
  };
  const localize = async () => {
    const locale = getLocale();
    if (!state.result) return;
    if (state.resultLocale === locale) {
      if (state.status === 'translating') { revision += 1; pending?.abort(); pending = null; update({ ...state, status: 'success', error: '' }); }
      return;
    }
    const current = ++revision;
    pending?.abort();
    const controller = new AbortController(); pending = controller;
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);
    const original = state.result;
    update({ ...state, status: 'translating', error: '' });
    try {
      const result = localizedResults.get(locale) ?? parsePlantAnalysis(await translate(original, locale, controller.signal));
      if (current === revision) { localizedResults.set(locale, result); update({ ...state, status: 'success', result, resultLocale: locale }); }
    } catch (error) {
      if (current === revision) update({ ...state, status: 'error', error: 'Translation is unavailable. Please try again.' });
    } finally { clearTimeout(timer); if (current === revision) pending = null; }
  };
  return { getState: () => state, choose, analyze, localize, reset, cancel };
}

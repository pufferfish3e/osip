import { t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

/** @typedef {{url:string,title:string,start:number,end:number}} WebCitation */
/** @typedef {{text:string,citations:WebCitation[]}} PlantWebResult */
const MAX_TEXT_LENGTH = 8000;
const MAX_CITATIONS = 20;
/** @param {unknown} value @returns {value is Record<string,unknown>} */
const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
/** @param {unknown} value @returns {boolean} */
const isSafeUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2000) return false;
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password; }
  catch (error) { if (error instanceof TypeError) return false; throw error; }
};
/** @param {unknown} value @returns {PlantWebResult} */
export function validateWebResult(value) {
  if (!isRecord(value) || typeof value.text !== 'string' || !value.text.trim() || value.text.length > MAX_TEXT_LENGTH || !Array.isArray(value.citations) || !value.citations.length || value.citations.length > MAX_CITATIONS) throw new Error('No cited web results were returned. Try a more specific plant symptom.');
  let end = 0;
  for (const citation of value.citations) {
    if (!isRecord(citation) || !isSafeUrl(citation.url) || typeof citation.title !== 'string' || !citation.title.trim() || citation.title.length > 500 || !Number.isInteger(citation.start) || !Number.isInteger(citation.end) || citation.start < end || citation.end <= citation.start || citation.end > value.text.length) throw new Error('The web result could not be read. Please try again.');
    end = citation.end;
  }
  return /** @type {PlantWebResult} */ (value);
}
/** @param {PlantWebResult} result @returns {string} */
export function renderPlantWebResult(result) {
  validateWebResult(result);
  let cursor = 0;
  const fragments = result.citations.map((citation, index) => {
    const fragment = `${esc(result.text.slice(cursor, citation.start))}<a class="plant-web-citation" href="${esc(citation.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(citation.title)}">[${index + 1}]</a>`;
    cursor = citation.end; return fragment;
  });
  const sources = [...new Map(result.citations.map((citation) => [citation.url, citation])).values()];
  return `<section class="plant-web-result"><div class="section-heading"><h2>${esc(t('From the web'))}</h2><span class="muted">${esc(t('AI search'))}</span></div><div class="card card-pad plant-web-summary">${fragments.join('')}${esc(result.text.slice(cursor))}</div><div class="plant-guide-list card">${sources.map((source) => `<a class="plant-guide-row plant-web-source" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer"><span class="plant-guide-icon">${icon('book', 25)}</span><span class="row-copy"><span class="plant-guide-category">${esc(new URL(source.url).hostname)}</span><strong>${esc(source.title)}</strong></span>${icon('arrow-up-right', 18)}</a>`).join('')}</div><p class="muted plant-web-note">${esc(t('AI web research, not a confirmed plant diagnosis.'))}</p></section>`;
}
/** @param {string} query @param {string} locale @param {AbortSignal} signal @param {typeof fetch} [fetchImpl] @returns {Promise<PlantWebResult>} */
export async function searchPlantWeb(query, locale, signal, fetchImpl = fetch) {
  const response = await fetchImpl('/api/plant-search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, locale }), signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message ?? 'Web search is unavailable. Please try again.');
  return validateWebResult(payload);
}

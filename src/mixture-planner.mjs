import { preparePlantPhoto } from './plant-photo.mjs';
import { getFormatLocale, getLocale, t } from './i18n.mjs';
import { renderPlantWebResult, searchPlantWeb, validateWebResult } from './plant-web.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const MAX_TANK_LITRES = 10000;
const BASE_VOLUME_LITRES = 100;
const MILLILITRES_PER_LITRE = 1000;
const MAX_PERCENT = 100;
/** @typedef {{product:string,crop:string,purpose:string,kind:string,basis:string,rate:number,tank:number,source:string,fieldId:string,area:number,volume:number}} Recipe */
/** @param {Recipe} recipe @returns {{amount:number,unit:string,finished:number}} */
export function prepareMixture(recipe) {
  if (![recipe.rate, recipe.tank].every((value) => Number.isFinite(value) && value > 0) || recipe.tank > MAX_TANK_LITRES) throw new Error('Enter a positive label rate and a tank volume up to 10,000 L.');
  if (!['ml-l', 'g-l', 'ml-100l', 'g-100l', 'percent-vv', 'percent-wv', 'ml-ha', 'g-ha'].includes(recipe.basis)) throw new Error('Select the units stated on the product label.');
  if (recipe.basis.startsWith('percent') && recipe.rate >= MAX_PERCENT) throw new Error('A dilution percentage must be below 100%.');
  const factor = recipe.basis.includes('100l') ? 1 / BASE_VOLUME_LITRES : recipe.basis.startsWith('percent') ? MILLILITRES_PER_LITRE / MAX_PERCENT : 1;
  if (![recipe.area, recipe.volume].every((value) => Number.isFinite(value) && value > 0)) throw new Error('Select a mapped field and enter your calibrated spray volume.');
  const finished = recipe.area * recipe.volume;
  const amount = recipe.rate * (recipe.basis.endsWith('-ha') ? recipe.area : finished) * factor;
  if (!Number.isFinite(amount)) throw new Error('This mixture quantity is too large.');
  if (['ml-l', 'ml-100l', 'percent-vv', 'ml-ha'].includes(recipe.basis) && amount >= finished * MILLILITRES_PER_LITRE) throw new Error('Product volume must be below the finished mixture volume.');
  return { amount, unit: ['g-l', 'g-100l', 'percent-wv', 'g-ha'].includes(recipe.basis) ? 'g' : 'mL', finished };
}
/** @param {import('./store.mjs').AppState} state @returns {string} */
export function renderMixturePlanner(state) {
  const fields = state.farms.flatMap((land) => land.plots.map((field) => ({ ...field, landName: land.name })));
  const savedFields = fields.filter((field) => field.mixtureConfig);
  const crops = [...new Set(state.farms.flatMap((land) => [land.crop, ...land.plots.map((field) => field.crop)]).filter(Boolean))];
  return `${pageHeading('', t("Prepare a field mixture"))}<section class="form-stack" data-mixture-planner>
  <div class="form-stack" data-mixture-entry><h2>${esc(t('How would you like to start?'))}</h2><button type="button" class="role-card" data-mixture-new>${icon('plus', 32)}<span class="row-copy"><span class="row-title">${esc(t('Prepare a new formula'))}</span></span>${icon('chevron-right', 18)}</button><h3>${esc(t('Saved formulas'))}</h3>${savedFields.length ? savedFields.map((field) => `<button type="button" class="role-card" data-mixture-existing="${esc(field.id)}">${icon('bookmark', 32)}<span class="row-copy"><span class="row-title">${esc(field.mixtureConfig.product)}</span><span class="row-subtitle">${esc(field.landName)} · ${esc(field.name)}</span></span>${icon('chevron-right', 18)}</button>`).join('') : `<p class="muted">${esc(t('No saved formulas yet. Save your first formula after calculating.'))}</p>`}</div><p class="muted" data-mixture-progress>1 / 3</p><form class="form-stack" data-mixture-form>
  <div class="form-stack" data-mixture-step="0" hidden><h2>${esc(t("Choose your field"))}</h2><label class="field">${esc(t("Prepare for which field?"))}<select class="input" name="fieldId" required><option value="">${esc(t("Choose a field"))}</option>${fields.map((field) => `<option value="${esc(field.id)}" data-area="${field.area}" data-crop="${esc(field.crop)}">${esc(field.landName)} · ${esc(field.name)} · ${field.area} ha</option>`).join('')}</select></label>${fields.length ? '' : `<a class="link" href="/farm">${esc(t('Map a field first'))}</a>`}</div><div class="form-stack" data-mixture-step="1" hidden><h2>${esc(t("Check your crop"))}</h2><label class="field">${esc(t("Crop"))}<input class="input" name="crop" list="mixture-crops" maxlength="40" required value="${esc(crops[0] ?? '')}"><datalist id="mixture-crops">${crops.map((crop) => `<option value="${esc(crop)}"></option>`).join('')}</datalist></label><datalist id="mixture-crops">${crops.map((crop) => `<option value="${esc(crop)}"></option>`).join('')}</datalist></div><div class="form-stack" data-mixture-step="2" hidden><h2>${esc(t("Do you already have a pesticide?"))}</h2><input type="hidden" name="kind" value="pesticide"><button type="button" class="role-card" data-mixture-path="label">${esc(t("I already have a pesticide"))}</button><button type="button" class="role-card" data-mixture-path="find">${esc(t("Help me find options"))}</button></div><div class="form-stack" data-mixture-step="3" hidden><h2>${esc(t("What problem are you treating?"))}</h2><label class="field">${esc(t("What problem are you treating?"))}<input class="input" name="purpose" maxlength="60" required placeholder="${esc(t("e.g. weeds, insects or plant disease"))}"></label><div data-mixture-research-result aria-live="polite"></div><a class="link" href="https://epengembangan.doa.gov.my/teknologi/aplikasi-mudah-alih/sismarp/" target="_blank" rel="noopener noreferrer">${esc(t("Check Malaysia’s registered crop/pest recommendations ↗"))}</a></div><div class="form-stack" data-mixture-step="4" hidden><h2>${esc(t('Which pesticide do you have?'))}</h2><label class="field">${esc(t('Describe your pesticide'))}<input class="input" data-product-description maxlength="160" placeholder="${esc(t('Brand name, packaging, or anything you remember'))}"></label><button type="button" class="button" data-product-search>${esc(t('Find matching products'))}</button><label class="field">${esc(t('Or upload a packaging photo'))}<input class="input" type="file" accept="image/jpeg,image/png,image/webp" data-product-photo></label><p role="status" data-product-status></p><input type="hidden" name="product"><div data-product-matches></div><p class="muted" data-product-selected></p></div><div class="form-stack" data-mixture-step="5" hidden><h2>${esc(t("Enter the product label reference"))}</h2><label class="field">${esc(t("Label or adviser reference"))}<input class="input" name="source" required maxlength="500" placeholder="${esc(t("Label URL, registration number or adviser reference"))}"></label></div><div class="form-stack" data-mixture-step="6" hidden><h2>${esc(t("Enter the label rate"))}</h2><label class="field">${esc(t("Label rate or custom label-approved concentration"))}<input class="input" name="rate" type="number" min="0.000001" step="any" required></label><label class="field">${esc(t("Label units"))}<select class="input" name="basis"><option value="ml-ha">${esc(t("mL product / ha"))}</option><option value="g-ha">${esc(t("g product / ha"))}</option><option value="ml-l">${esc(t("mL product / L finished mixture"))}</option><option value="g-l">${esc(t("g product / L finished mixture"))}</option><option value="ml-100l">${esc(t("mL product / 100 L finished mixture"))}</option><option value="g-100l">${esc(t("g product / 100 L finished mixture"))}</option><option value="percent-vv">${esc(t("% v/v product in finished mixture"))}</option><option value="percent-wv">${esc(t("% w/v: grams per 100 mL finished mixture"))}</option></select></label></div><div class="form-stack" data-mixture-step="7" hidden><h2>${esc(t("What is your tank capacity?"))}</h2><label class="field">${esc(t("Tank capacity (L)"))}<input class="input" name="tank" type="number" min="0.000001" max="10000" step="any" required value="16"></label></div><div class="form-stack" data-mixture-step="8" hidden><h2>${esc(t("Enter your calibrated spray volume"))}</h2><label class="field">${esc(t("Calibrated finished spray volume (L/ha)"))}<input class="input" name="volume" type="number" min="0.000001" step="any" required></label></div><div class="form-stack" data-mixture-step="9" hidden><h2>${esc(t("Review your label details"))}</h2><div data-mixture-review></div><label class="checkbox-field"><input type="checkbox" name="confirmed" required>${esc(t("I checked this label permits the crop, target and rate."))}</label></div><div class="form-stack" data-mixture-step="10" hidden><h2>${esc(t("Your tank preparation"))}</h2><div class="card card-pad" data-mixture-result></div><button type="button" class="button button-secondary" data-mixture-save>${esc(t("Save configuration to this field"))}</button></div><p role="alert" data-mixture-error></p><div class="toolbar"><button type="button" class="button button-secondary" data-mixture-back hidden>${esc(t("Back"))}</button><button type="submit" class="button" data-mixture-next>${esc(t('Use a product label'))}</button></div></form></section>`;
}
/** @param {HTMLFormElement} form @returns {Recipe} */
const readRecipe = (form) => {
  const data = new FormData(form);
  return { fieldId: String(data.get('fieldId')), area: Number(form.querySelector('[name="fieldId"]').selectedOptions[0]?.dataset.area), volume: Number(data.get('volume')), crop: String(data.get('crop')), purpose: String(data.get('purpose')), kind: String(data.get('kind')), product: String(data.get('product')), source: String(data.get('source')), basis: String(data.get('basis')), rate: Number(data.get('rate')), tank: Number(data.get('tank')) };
};
/** @type {Record<string,string>|null} */
let plannerDraft = null;

/** @type {Recipe|null} */
let tankRecipe = null;
/** @param {Recipe} recipe @param {string} fieldName @returns {string} */
export function renderMixtureReview(recipe, fieldName) {
  const units = {
    'ml-ha': 'mL product / ha', 'g-ha': 'g product / ha',
    'ml-l': 'mL product / L finished mixture', 'g-l': 'g product / L finished mixture',
    'ml-100l': 'mL product / 100 L finished mixture', 'g-100l': 'g product / 100 L finished mixture',
    'percent-vv': '% v/v product in finished mixture', 'percent-wv': '% w/v: grams per 100 mL finished mixture',
  };
  /** @param {number} value @returns {string} */
  const format = (value) => value.toLocaleString(getFormatLocale(), { maximumFractionDigits: 6 });
  /** @param {string} label @param {string} value @returns {string} */
  const row = (label, value) => `<div><dt>${esc(t(label))}</dt><dd>${esc(value)}</dd></div>`;
  /** @param {string} title @param {string} rows @returns {string} */
  const group = (title, rows) => `<section><h3>${esc(t(title))}</h3><dl>${rows}</dl></section>`;
  return `<div class="mixture-review">${group('Field', row('Field', fieldName) + row('Crop', recipe.crop) + row('Area', `${format(recipe.area)} ha`))}${group('Product label', row('Product', recipe.product) + (recipe.purpose ? row('What problem are you treating?', recipe.purpose) : '') + row('Label rate', `${format(recipe.rate)} ${t(units[recipe.basis] ?? recipe.basis)}`) + row('Label or adviser reference', recipe.source))}${group('Tank settings', row('Tank capacity (L)', format(recipe.tank)) + row('Calibrated finished spray volume (L/ha)', format(recipe.volume)))}</div>`;
}
/** @param {Recipe|null} [recipe] @returns {string} */
export function renderTankPreparation(recipe = tankRecipe) {
  if (!recipe) return `${pageHeading('', t('Tank preparation'))}<p>${esc(t('Prepare a calculation first.'))}</p><a class="button" href="/tools">${esc(t('Back'))}</a>`;
  const result = prepareMixture(recipe);
  /** @param {number} value @returns {string} */
  const format = (value) => value.toLocaleString(getFormatLocale(), { maximumFractionDigits: 3 });
  const loads = Math.ceil(result.finished / recipe.tank);
  const loadVolume = Math.min(recipe.tank, result.finished);
  const loadProduct = result.amount / result.finished * loadVolume;
  const finalVolume = result.finished - (loads - 1) * recipe.tank;
  const finalProduct = result.amount / result.finished * finalVolume;
  let source = '';
  try { const url = new URL(recipe.source); if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) source = url.href; }
  catch (error) { if (!(error instanceof TypeError)) throw error; }
  return `${pageHeading('', t('Tank preparation'), recipe.product)}<section class="tank-preparation" data-tank-preparation><div class="tank-visual" role="img" aria-label="${esc(t('Illustrative tank. Colours identify ingredients, not their actual appearance.'))}"><svg viewBox="0 0 300 330" aria-hidden="true"><defs><clipPath id="tank-interior"><rect x="52" y="42" width="196" height="258" rx="30"/></clipPath></defs><rect x="108" y="10" width="84" height="32" rx="8" fill="#d9e2dd"/><rect x="44" y="34" width="212" height="274" rx="38" fill="#eef2ef" stroke="#53685d" stroke-width="5"/><g clip-path="url(#tank-interior)"><rect x="52" y="90" width="196" height="210" fill="#c9e5fb"/><path d="M52 90 Q100 78 150 90 T248 90 V108 H52Z" fill="#f2bf53"/></g><text x="150" y="185" text-anchor="middle" fill="#19352a" font-size="30" font-weight="600">${esc(format(loadVolume))} L</text></svg></div><div class="tank-ingredients"><div><span class="tank-swatch tank-product"></span><span>${esc(t('Pesticide'))}</span><strong>${esc(format(loadProduct))} ${esc(result.unit)}</strong></div><div><span class="tank-swatch tank-water"></span><span>${esc(t('Water'))}</span><strong>${esc(t('Top up to {volume} L', { volume: format(loadVolume) }))}</strong></div></div><p class="muted tank-colour-note">${esc(t('Illustrative colours. Follow the label’s mixing order.'))}</p><div class="tank-totals"><p>${esc(t('{loads} tank loads · {area} ha', { loads, area: format(recipe.area) }))}</p><p>${esc(t('Total product: {amount} {unit}', { amount: format(result.amount), unit: result.unit }))}</p><p>${esc(t('Final load: {volume} L · {amount} {unit} product', { volume: format(finalVolume), amount: format(finalProduct), unit: result.unit }))}</p></div><section class="tank-evidence"><h2>${esc(t('Verification status'))}</h2><p>${esc(t('Not independently verified'))}</p><p class="muted">${esc(t('Calculated from your entered rate. Product identity, crop suitability and label instructions still need verification.'))}</p>${source ? `<a class="link" href="${esc(source)}" target="_blank" rel="noopener noreferrer">${esc(t('Open provided reference'))}</a>` : `<p class="muted">${esc(recipe.source)}</p>`}<a class="link" href="https://epengembangan.doa.gov.my/teknologi/aplikasi-mudah-alih/sismarp/" target="_blank" rel="noopener noreferrer">${esc(t('Check Malaysia’s registered crop/pest recommendations ↗'))}</a></section><button type="button" class="button" data-tank-save>${esc(t('Save configuration to this field'))}</button><p role="status" data-tank-status></p><a class="link" href="/tools?resume=1">${esc(t('Back'))}</a></section>`;
}
/** @param {HTMLElement} panel @param {import('./store.mjs').AppStore} store @returns {()=>void} */
const initializeTankPreparation = (panel, store) => {
  panel.querySelector('[data-tank-save]').addEventListener('click', () => {
    try {
      if (!tankRecipe) throw new Error('Prepare a calculation first.');
      store.update((state) => saveFieldRecipe(state, tankRecipe));
      panel.querySelector('[data-tank-status]').textContent = t('Configuration saved to this field on this device.');
    } catch (error) { panel.querySelector('[data-tank-status]').textContent = error instanceof Error ? error.message : t('Could not save configuration.'); }
  });
  return () => {};
};

/** @type {{key:string,isPhoto:boolean,load:()=>Promise<import('./plant-web.mjs').PlantWebResult>}|null} */
let productSearch = null;
/** @param {HTMLElement} root @param {string} path @returns {void} */
const openProductPage = (root, path) => {
  const link = document.createElement('a'); link.href = path; root.append(link); link.click();
};
/** @returns {string} */
export function renderProductMatchPage() {
  return `${pageHeading('', t(productSearch?.isPhoto ? 'Possible matches' : 'Which product is yours?'))}<section class="form-stack" data-product-page><p class="muted" role="status" data-product-status>${esc(t('Finding matching products…'))}</p><div data-product-matches aria-live="polite"></div><p class="muted">${esc(t('AI matches. Confirm against your packaging.'))}</p><a class="link" href="/tools?resume=1">${esc(t('Back'))}</a></section>`;
}
/** @param {HTMLElement} panel @returns {()=>void} */
const initializeProductMatchPage = (panel) => {
  let isDisposed = false;
  const status = panel.querySelector('[data-product-status]');
  const matches = panel.querySelector('[data-product-matches]');
  const show = async () => {
    try {
      const products = productSearch ? productMatches(await cachedFormulaOptions(productSearch.key, productSearch.load), productSearch.isPhoto ? 10 : 4) : [];
      if (isDisposed) return;
      matches.innerHTML = renderProductMatches(products, productSearch?.isPhoto ?? false);
      matches.querySelectorAll('[data-product-image]').forEach((image) => image.addEventListener('error', () => { image.parentElement.innerHTML = icon('bottle', 28); }, { once: true }));
      status.textContent = t(products.length ? 'Choose the product that matches your packaging.' : 'No matching products found. Try another photo or description.');
      panel.querySelector('[data-product-retry]').hidden = products.length > 0;
    } catch (error) {
      if (isDisposed) return;
      console.error('Product search failed.', error instanceof Error ? error.message : 'Unknown error');
      status.textContent = t('No matching products found. Try another photo or description.');
      matches.innerHTML = renderProductMatches([]); panel.querySelector('[data-product-retry]').hidden = false;
    }
  };
  matches.addEventListener('click', (event) => {
    const choice = event.target.closest('[data-product-choice]');
    if (choice) { plannerDraft = { ...plannerDraft, product: choice.dataset.formulaName, source: choice.dataset.formulaSource, rate: '', confirmed: '' }; openProductPage(panel, '/tools?resume=1&matched=1'); return; }
    if (event.target.closest('[data-product-none]')) panel.querySelector('[data-product-retry]').hidden = false;
    if (event.target.closest('[data-product-retry-photo]')) openProductPage(panel, '/tools?resume=1&retry=photo');
    if (event.target.closest('[data-product-retry-description]')) openProductPage(panel, '/tools?resume=1&retry=description');
  });
  void show();
  return () => { isDisposed = true; };
};

/** @param {import('./store.mjs').AppState} state @returns {string} */
export function renderPesticideOptions(state) {
  const fields = state.farms.flatMap((land) => land.plots.map((field) => ({ ...field, landName: land.name })));
  return `${pageHeading('', t('Formula options'))}<section class="form-stack" data-pesticide-options><form class="form-stack" data-options-form hidden><label class="field">${esc(t('Choose a field'))}<select class="input" name="fieldId" required><option value="">${esc(t('Choose a field'))}</option>${fields.map((field) => `<option value="${esc(field.id)}" data-crop="${esc(field.crop)}">${esc(field.landName)} · ${esc(field.name)}</option>`).join('')}</select></label><label class="field">${esc(t('Crop'))}<input class="input" name="crop" required maxlength="40"></label><label class="field">${esc(t('What problem are you treating?'))}<input class="input" name="purpose" required maxlength="60" placeholder="${esc(t('e.g. weeds, insects or plant disease'))}"></label><button class="button" type="submit">${esc(t('Find sourced options'))}</button></form><p role="alert" data-options-error>${plannerDraft?.fieldId && plannerDraft?.crop && plannerDraft?.purpose ? '' : esc(t('Unable to generate options. If you have a pesticide formula, you can enter it instead.'))}</p><div data-options-results aria-live="polite"></div><p class="muted">${esc(t('AI suggestions. Check the product label before use.'))}</p><a class="button" href="/tools?resume=1" data-options-continue>${esc(t('Never mind, I have a formula'))}</a><a class="link" href="/tools?resume=1">${esc(t('Back'))}</a></section>`;
}

/** @param {string} value @returns {string} */
export function formulaSentence(value) {
  const text = value.trim().replace(/\s*[(（]\s*$/, '').trim();
  if (!text || /[.!?。！？]$/.test(text)) return text;
  return `${text}${getLocale() === 'zh-Hans' ? '。' : '.'}`;
}

/** @type {Map<string,Promise<import('./plant-web.mjs').PlantWebResult>>} */
const OPTIONS_REQUESTS = new Map();
/** Reuse results across interface language changes; response text keeps its original language.
 * @param {string} key @param {()=>Promise<import('./plant-web.mjs').PlantWebResult>} request @returns {Promise<import('./plant-web.mjs').PlantWebResult>}
 */
export function cachedFormulaOptions(key, request) {
  if (!OPTIONS_REQUESTS.has(key)) OPTIONS_REQUESTS.set(key, request());
  return OPTIONS_REQUESTS.get(key);
}

/** @param {import('./plant-web.mjs').PlantWebResult} result @returns {string} */
export function renderFormulaOptions(result) {
  const fallback = renderPlantWebResult(result, true);
  const options = [];
  for (const paragraph of result.text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)) {
    const match = /^OPTION:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*HELPS:\s*([\s\S]+)$/.exec(paragraph[0]);
    if (!match || match[1].trim().length > 120) continue;
    const source = result.citations.find((citation) => citation.start >= paragraph.index && citation.end <= paragraph.index + paragraph[0].length);
    if (!source) continue;
    const start = source.start - paragraph.index;
    const clean = paragraph[0].slice(0, start).match(/^OPTION:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*HELPS:\s*([\s\S]+)$/);
    if (!clean) continue;
    options.push(`<article class="formula-option"><a class="chip formula-option-pill" href="/tools?resume=1" data-formula-name="${esc(clean[1].trim())}" data-formula-source="${esc(source.url)}">${esc(clean[1].trim())}${icon('arrow-right', 18)}</a><p>${esc(formulaSentence(clean[2]))} ${esc(formulaSentence(clean[3]))}</p><a class="link" href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t('Source'))} ${icon('arrow-up-right', 16)}</a></article>`);
  }
  return options.length ? `<section class="form-stack"><h2>${esc(t('Choose an option to check'))}</h2>${options.join('')}</section>` : fallback;
}

/** @param {HTMLElement} panel @returns {()=>void} */
const initializePesticideOptions = (panel) => {
  const form = panel.querySelector('form');
  const controller = new AbortController();
  for (const [name, value] of Object.entries(plannerDraft ?? {})) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
  panel.addEventListener('click', (event) => {
    const option = event.target.closest('[data-formula-name]');
    if (option) plannerDraft = { ...plannerDraft, product: option.dataset.formulaName, source: option.dataset.formulaSource, rate: '', confirmed: '' };
  });
  form.elements.fieldId.addEventListener('change', () => { form.elements.crop.value = form.elements.fieldId.selectedOptions[0]?.dataset.crop ?? ''; });
  const save = () => { plannerDraft = { ...plannerDraft, ...Object.fromEntries(new FormData(form)), kind: 'pesticide' }; };
  panel.querySelector('[data-options-continue]').addEventListener('click', (event) => {
    if (!plannerDraft?.fieldId || !plannerDraft?.crop || !plannerDraft?.purpose) { plannerDraft = null; return; }
    if (!form.reportValidity()) { event.preventDefault(); return; }
    save(); plannerDraft = { ...plannerDraft, product: '', source: '', rate: '', confirmed: '' };
  });
  form.addEventListener('input', () => { save(); panel.querySelector('[data-options-results]').innerHTML = ''; });
  form.addEventListener('change', save);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    save(); form.hidden = true;
    const button = form.querySelector('button');
    const error = panel.querySelector('[data-options-error]');
    button.disabled = true; button.textContent = t('Finding online sources…'); error.textContent = '';
    panel.querySelector('[data-options-results]').setAttribute('aria-busy', 'true');
    panel.querySelector('[data-options-results]').innerHTML = `<div class="options-loading" role="status">${esc(t('Searching crop guidance and product sources…'))}</div>`;
    try {
      const requested = JSON.stringify(Object.fromEntries(new FormData(form)));
      const query = `Malaysia ${plannerDraft.crop} ${plannerDraft.purpose}: pesticide options, registered labels and evidence; no invented rates`.slice(0, 160);
      const key = JSON.stringify([plannerDraft.fieldId, plannerDraft.crop, plannerDraft.purpose]);
      const result = await cachedFormulaOptions(key, () => searchPlantWeb(query, getLocale(), AbortSignal.timeout(45000), fetch, 'pesticide-options'));
      if (!controller.signal.aborted && requested === JSON.stringify(Object.fromEntries(new FormData(form)))) panel.querySelector('[data-options-results]').innerHTML = `<div class="pesticide-query"><span class="chip">${esc(plannerDraft.crop)}</span><span class="chip">${esc(plannerDraft.purpose)}</span></div>${renderFormulaOptions(result)}`;
    } catch (failure) { if (!controller.signal.aborted) { panel.querySelector('[data-options-results]').innerHTML = ''; console.error('Pesticide options failed.', failure instanceof Error ? failure.message : 'Unknown error'); error.textContent = t('Unable to generate options. If you have a pesticide formula, you can enter it instead.'); } }
    finally { panel.querySelector('[data-options-results]').setAttribute('aria-busy', 'false'); button.disabled = false; button.textContent = t('Find sourced options'); }
  });
  if (plannerDraft?.fieldId && plannerDraft?.crop && plannerDraft?.purpose) form.requestSubmit();
  return () => controller.abort();
};

/** @param {string} crop @param {boolean} shouldFindOptions @returns {number[]} */
export function mixtureSteps(crop, shouldFindOptions) {
  return [0, ...(crop.trim() ? [] : [1]), 2, ...(shouldFindOptions ? [3] : []), 4, 5, 6, 7, 8, 9, 10];
}

/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {()=>void} */
export function initializeMixturePlanner(root, store) {
  const tank = root.querySelector('[data-tank-preparation]');
  if (tank) return initializeTankPreparation(tank, store);
  const products = root.querySelector('[data-product-page]');
  if (products) return initializeProductMatchPage(products);
  const options = root.querySelector('[data-pesticide-options]');
  if (options) return initializePesticideOptions(options);
  const panel = root.querySelector('[data-mixture-planner]');
  if (!panel) return () => {};
  const form = panel.querySelector('form');
  const error = panel.querySelector('[data-mixture-error]');
  const controller = new AbortController();
  let step = -1;
  let shouldFindOptions = false;
  const flowSteps = () => mixtureSteps(form.elements.fieldId.selectedOptions[0]?.dataset.crop ?? '', shouldFindOptions);
  const show = () => {
    if (step === 9) {
      const recipe = readAllFields(form);
      const field = form.elements.fieldId.selectedOptions[0];
      panel.querySelector('[data-mixture-review]').innerHTML = renderMixtureReview(recipe, (field?.textContent ?? '').replace(/ · [^·]+ ha$/, ''));
    }
    panel.querySelector('[data-mixture-entry]').hidden = step !== -1;
    form.hidden = step === -1;
    panel.querySelector('[data-mixture-progress]').hidden = step === -1;
    panel.querySelectorAll('[data-mixture-step]').forEach((item) => { item.hidden = Number(item.dataset.mixtureStep) !== step; item.querySelectorAll('input,select').forEach((field) => { field.disabled = item.hidden; }); });
    const steps = flowSteps();
    panel.querySelector('[data-mixture-progress]').textContent = `${steps.indexOf(step) + 1} / ${steps.length}`;
    panel.querySelector('[data-mixture-back]').hidden = false;
    panel.querySelector('[data-mixture-next]').hidden = step === 10 || step === 2 || (step === 4 && !form.elements.product.value);
    panel.querySelector('[data-mixture-next]').textContent = t(step === 9 ? 'Prepare my tank' : 'Continue');
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      if (!form.reportValidity()) return;
      if (step === 3) {
        plannerDraft = Object.fromEntries([...form.elements].filter((field) => field.name).map((field) => [field.name, field.value]));
        const link = document.createElement('a'); link.href = '/tools/options'; panel.append(link); link.click(); return;
      }
      if (step === 9) {
        const recipe = readAllFields(form); prepareMixture(recipe); tankRecipe = recipe;
        plannerDraft = Object.fromEntries([...form.elements].filter((field) => field.name).map((field) => [field.name, field.value]));
        openProductPage(panel, '/tools/tank'); return;
      }
      const steps = flowSteps();
      step = steps[Math.min(steps.length - 1, steps.indexOf(step) + 1)]; error.textContent = ''; show();
    } catch (failure) { error.textContent = t(failure instanceof Error ? failure.message : 'Could not prepare this mixture.'); }
  });
  panel.querySelector('[data-mixture-back]').addEventListener('click', () => { const steps = flowSteps(); step = steps[steps.indexOf(step) - 1] ?? -1; error.textContent = ''; show(); });
  bindProductIdentification(panel, controller.signal);
  bindFieldRecipe(panel, store);
  panel.querySelector('[data-mixture-new]').addEventListener('click', () => {
    form.reset(); panel.querySelector('[name="fieldId"]').dispatchEvent(new Event('change'));
    step = 0; error.textContent = ''; show();
  });
  for (const button of panel.querySelectorAll('[data-mixture-existing]')) button.addEventListener('click', () => {
    panel.querySelector('[name="fieldId"]').value = button.dataset.mixtureExisting;
    panel.querySelector('[name="fieldId"]').dispatchEvent(new Event('change'));
    shouldFindOptions = false; step = 0; error.textContent = ''; show();
  });
  for (const button of panel.querySelectorAll('[data-mixture-path]')) button.addEventListener('click', () => {
    shouldFindOptions = button.dataset.mixturePath === 'find';
    step = shouldFindOptions ? 3 : 4; error.textContent = ''; show();
  });
  if (new URLSearchParams(window.location.search).has('resume') && plannerDraft) {
    for (const [name, value] of Object.entries(plannerDraft)) if (form.elements.namedItem(name)) form.elements.namedItem(name).value = value;
    form.elements.confirmed.checked = false;
    shouldFindOptions = false; step = new URLSearchParams(window.location.search).has('matched') ? 5 : 4;
  }
  show();
  if (new URLSearchParams(window.location.search).get('retry') === 'description') panel.querySelector('[data-product-description]').focus();
  return () => controller.abort();
}
/** @param {import('./plant-web.mjs').PlantWebResult} result @returns {{name:string,detail:string,source:string,image?:string}[]} */
export function productMatches(result, limit = 4) {
  validateWebResult(result);
  const products = [];
  for (const paragraph of result.text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)) {
    const source = result.citations.find((citation) => citation.start >= paragraph.index && citation.end <= paragraph.index + paragraph[0].length);
    if (!source) continue;
    const content = paragraph[0].slice(0, source.start - paragraph.index).trim();
    const match = /^OPTION:\s*([^|]+)\|\s*WHY:\s*([^|]+)\|\s*HELPS:\s*([\s\S]+)$/.exec(content);
    if (!match || match[1].trim().length > 120) continue;
    const name = match[1].trim();
    if (products.some((product) => product.name.toLowerCase() === name.toLowerCase())) continue;
    products.push({ name, detail: `${formulaSentence(match[2])} ${formulaSentence(match[3])}`, source: source.url, image: result.images?.find((image) => image.source === source.url)?.url });
  }
  return products.slice(0, Math.min(10, limit));
}
/** @param {{name:string,detail:string,source:string,image?:string}[]} products @returns {string} */
export function renderProductMatches(products, isPhoto = false) {
  return `<div class="product-match-list ${isPhoto ? 'product-photo-grid' : ''}">${products.map((product) => `<article class="product-match"><button type="button" class="role-card" data-product-choice data-formula-name="${esc(product.name)}" data-formula-source="${esc(product.source)}"><span class="product-match-image">${product.image ? `<img src="${esc(product.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-product-image>` : icon('bottle', 28)}</span><span class="row-copy"><span class="row-title">${esc(product.name)}</span>${isPhoto ? '' : `<span class="row-subtitle">${esc(product.detail)}</span>`}</span>${icon('chevron-right', 18)}</button>${isPhoto ? '' : `<a class="link" href="${esc(product.source)}" target="_blank" rel="noopener noreferrer">${esc(t('Source'))}</a>`}</article>`).join('')}</div><button type="button" class="button button-secondary" data-product-none>${esc(t('None of these is mine'))}</button><div class="form-stack" data-product-retry hidden><p class="muted">${esc(t('Try a clearer packaging photo or describe the brand and packaging.'))}</p><div class="toolbar"><button type="button" class="button button-secondary" data-product-retry-photo>${esc(t('Try a photo'))}</button><button type="button" class="button button-secondary" data-product-retry-description>${esc(t('Try a description'))}</button></div></div>`;
}

/** @param {HTMLElement} panel @param {AbortSignal} signal @returns {void} */
const bindProductIdentification = (panel, signal) => {
  const status = panel.querySelector('[data-product-status]');
  let requestNumber = 0;
  const identify = async (file) => {
    const request = ++requestNumber;
    const description = panel.querySelector('[data-product-description]').value.trim();
    if (!file && !description) { status.textContent = t('Describe your pesticide or upload a photo.'); return; }
    status.textContent = t('Finding matching products…');
    try {
      const image = file ? await preparePlantPhoto(file) : '';
      if (signal.aborted || request !== requestNumber) return;
      plannerDraft = Object.fromEntries([...panel.querySelector('form').elements].filter((field) => field.name).map((field) => [field.name, field.value]));
      const locale = getLocale();
      productSearch = { key: `product-${crypto.randomUUID()}`, isPhoto: Boolean(image), load: () => searchPlantWeb(description || 'Identify this pesticide packaging and shortlist sourced product matches. No dosage.', locale, AbortSignal.timeout(45000), fetch, 'pesticide-products', image) };
      openProductPage(panel, '/tools/products');
    } catch (error) { if (!signal.aborted) { console.error('Product photo failed.', error instanceof Error ? error.message : 'Unknown error'); status.textContent = t('No matching products found. Try another photo or description.'); } }
  };
  panel.querySelector('[data-product-search]').addEventListener('click', async () => { await identify(null); });
  panel.querySelector('[data-product-photo]').addEventListener('change', async (event) => { if (event.target.files?.[0]) await identify(event.target.files[0]); });
};

/** @param {HTMLFormElement} form @returns {Recipe} */
const readAllFields = (form) => {
  const disabled = [...form.querySelectorAll(':disabled')];
  disabled.forEach((field) => { field.disabled = false; });
  try { return readRecipe(form); }
  finally { disabled.forEach((field) => { field.disabled = true; }); }
};
/** @param {import('./store.mjs').AppState} state @param {Recipe} recipe @returns {void} */
export function saveFieldRecipe(state, recipe) {
  prepareMixture(recipe);
  const field = state.farms.flatMap((land) => land.plots).find((item) => item.id === recipe.fieldId);
  if (!field) throw new Error('Selected field no longer exists.');
  if (!recipe.product.trim() || !recipe.source.trim()) throw new Error('Enter the product and label reference.');
  field.mixtureConfig = { ...recipe };
}
/** @param {HTMLElement} panel @param {import('./store.mjs').AppStore} store @returns {void} */
const bindFieldRecipe = (panel, store) => {
  panel.querySelector('[name="fieldId"]').addEventListener('change', (event) => {
    const field = store.getState().farms.flatMap((land) => land.plots).find((item) => item.id === event.target.value);
    panel.querySelector('[name="crop"]').value = field?.crop ?? '';
    for (const name of ['product', 'source', 'purpose', 'rate', 'volume']) panel.querySelector(`[name="${name}"]`).value = '';
    if (field?.mixtureConfig) for (const name of ['product', 'source', 'purpose', 'kind', 'basis', 'rate', 'tank', 'volume']) panel.querySelector(`[name="${name}"]`).value = field.mixtureConfig[name];
    panel.querySelector('[name="confirmed"]').checked = false;
    panel.querySelector('[data-mixture-research-result]').innerHTML = '';
  });
  panel.querySelector('[data-mixture-save]').addEventListener('click', () => {
    try {
      const recipe = readAllFields(panel.querySelector('form'));
      store.update((state) => saveFieldRecipe(state, recipe));
      panel.querySelector('[data-mixture-error]').textContent = t('Configuration saved to this field on this device.');
    } catch (failure) { panel.querySelector('[data-mixture-error]').textContent = t(failure instanceof Error ? failure.message : 'Could not save configuration.'); }
  });
};

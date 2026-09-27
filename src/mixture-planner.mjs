import { getLocale, t } from './i18n.mjs';
import { renderPlantWebResult, searchPlantWeb } from './plant-web.mjs';
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
  if (['ml-l', 'ml-100l', 'percent-vv'].includes(recipe.basis) && amount >= finished * MILLILITRES_PER_LITRE) throw new Error('Product volume must be below the finished mixture volume.');
  return { amount, unit: ['g-l', 'g-100l', 'percent-wv', 'ml-ha', 'g-ha'].includes(recipe.basis) ? 'g' : 'mL', finished };
}
/** @param {import('./store.mjs').AppState} state @returns {string} */
export function renderMixturePlanner(state) {
  const fields = state.farms.flatMap((land) => land.plots.map((field) => ({ ...field, landName: land.name })));
  const crops = [...new Set(state.farms.flatMap((land) => [land.crop, ...land.plots.map((field) => field.crop)]).filter(Boolean))];
  return `${pageHeading('', t("Prepare a field mixture"), t("Find crop guidance, then scale the exact product label to your tank."))}<section class="form-stack" data-mixture-planner>
  <p class="muted" data-mixture-progress>1 / 3</p><form class="form-stack" data-mixture-form>
  <div class="form-stack" data-mixture-step="0"><h2>${esc(t("Your field, crop and goal"))}</h2><label class="field">${esc(t("Prepare for which field?"))}<select class="input" name="fieldId" required><option value="">${esc(t("Choose a field"))}</option>${fields.map((field) => `<option value="${esc(field.id)}" data-area="${field.area}" data-crop="${esc(field.crop)}">${esc(field.landName)} · ${esc(field.name)} · ${field.area} ha</option>`).join('')}</select></label>${fields.length ? '' : `<a class="link" href="/farm">${esc(t('Map a field first'))}</a>`}<label class="field">${esc(t("Crop"))}<input class="input" name="crop" list="mixture-crops" maxlength="40" required value="${esc(crops[0] ?? '')}"><datalist id="mixture-crops">${crops.map((crop) => `<option value="${esc(crop)}"></option>`).join('')}</datalist></label><label class="field">${esc(t("What are you preparing?"))}<select class="input" name="kind"><option value="pesticide">${esc(t("Pesticide"))}</option><option value="fertiliser">${esc(t("Fertiliser"))}</option></select></label><label class="field">${esc(t("Target pest, condition or nutrient goal"))}<input class="input" name="purpose" maxlength="60" required placeholder="${esc(t("e.g. rice leaf blast, or soil-test nitrogen needs"))}"></label><button type="button" class="button" data-mixture-research>${icon('search', 18)} ${esc(t('Find sourced options'))}</button><div data-mixture-research-result aria-live="polite"></div><p class="muted">${esc(t("Options depend on the crop and problem. An AI source link does not confirm product registration or a diagnosis."))}</p><a class="link" href="https://epengembangan.doa.gov.my/teknologi/aplikasi-mudah-alih/sismarp/" target="_blank" rel="noopener noreferrer">${esc(t("Check Malaysia’s registered crop/pest recommendations ↗"))}</a></div>
  <div class="form-stack" data-mixture-step="1" hidden><h2>${esc(t("Use your product label"))}</h2><label class="field">${esc(t("Exact product and formulation"))}<input class="input" name="product" required maxlength="120" placeholder="${esc(t("Product name and formulation from the label"))}"></label><label class="field">${esc(t("Label or adviser reference"))}<input class="input" name="source" required maxlength="500" placeholder="${esc(t("Label URL, registration number or adviser reference"))}"></label><label class="field">${esc(t("Label rate or custom label-approved concentration"))}<input class="input" name="rate" type="number" min="0.000001" step="any" required></label><label class="field">${esc(t("Label units"))}<select class="input" name="basis"><option value="ml-ha">${esc(t("mL product / ha"))}</option><option value="g-ha">${esc(t("g product / ha"))}</option><option value="ml-l">${esc(t("mL product / L finished mixture"))}</option><option value="g-l">${esc(t("g product / L finished mixture"))}</option><option value="ml-100l">${esc(t("mL product / 100 L finished mixture"))}</option><option value="g-100l">${esc(t("g product / 100 L finished mixture"))}</option><option value="percent-vv">${esc(t("% v/v product in finished mixture"))}</option><option value="percent-wv">${esc(t("% w/v: grams per 100 mL finished mixture"))}</option></select></label><label class="field">${esc(t("Calibrated finished spray volume (L/ha)"))}<input class="input" name="volume" type="number" min="0.000001" step="any" required></label><label class="field">${esc(t("Tank capacity (L)"))}<input class="input" name="tank" type="number" min="0.000001" max="10000" step="any" required value="16"></label><p class="muted">${esc(t("Percentage means commercial product in the finished mixture, not the product’s active-ingredient strength. For an area-based label rate, product is multiplied by mapped field area. Finished spray volume comes from your sprayer calibration."))}</p><label class="checkbox-field"><input type="checkbox" name="confirmed" required>${esc(t("I checked this label permits the crop, target and rate."))}</label></div>
  <div class="form-stack" data-mixture-step="2" hidden><h2>${esc(t("Your tank preparation"))}</h2><div class="card card-pad" data-mixture-result></div><button type="button" class="button button-secondary" data-mixture-save>${esc(t("Save configuration to this field"))}</button></div><p role="alert" data-mixture-error></p><div class="toolbar"><button type="button" class="button button-secondary" data-mixture-back hidden>${esc(t("Back"))}</button><button type="submit" class="button" data-mixture-next>${esc(t('Use a product label'))}</button></div></form></section>`;
}
/** @param {HTMLFormElement} form @returns {Recipe} */
const readRecipe = (form) => {
  const data = new FormData(form);
  return { fieldId: String(data.get('fieldId')), area: Number(form.querySelector('[name="fieldId"]').selectedOptions[0]?.dataset.area), volume: Number(data.get('volume')), crop: String(data.get('crop')), purpose: String(data.get('purpose')), kind: String(data.get('kind')), product: String(data.get('product')), source: String(data.get('source')), basis: String(data.get('basis')), rate: Number(data.get('rate')), tank: Number(data.get('tank')) };
};
/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {()=>void} */
export function initializeMixturePlanner(root, store) {
  const panel = root.querySelector('[data-mixture-planner]');
  if (!panel) return () => {};
  const form = panel.querySelector('form');
  const error = panel.querySelector('[data-mixture-error]');
  const controller = new AbortController();
  let step = 0;
  const show = () => {
    panel.querySelectorAll('[data-mixture-step]').forEach((item) => { item.hidden = Number(item.dataset.mixtureStep) !== step; item.querySelectorAll('input,select').forEach((field) => { field.disabled = item.hidden; }); });
    panel.querySelector('[data-mixture-progress]').textContent = `${step + 1} / 3`;
    panel.querySelector('[data-mixture-back]').hidden = step === 0;
    panel.querySelector('[data-mixture-next]').hidden = step === 2;
    panel.querySelector('[data-mixture-next]').textContent = t(step === 0 ? 'Use a product label' : 'Prepare my tank');
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    try {
      if (!form.reportValidity()) return;
      if (step === 1) renderPreparation(panel, readAllFields(form));
      step = Math.min(2, step + 1); error.textContent = ''; show();
    } catch (failure) { error.textContent = t(failure instanceof Error ? failure.message : 'Could not prepare this mixture.'); }
  });
  panel.querySelector('[data-mixture-back]').addEventListener('click', () => { step = Math.max(0, step - 1); error.textContent = ''; show(); });
  bindFieldRecipe(panel, store);
  panel.querySelector('[data-mixture-research]').addEventListener('click', async () => { await researchOptions(panel, controller.signal); });
  show();
  return () => controller.abort();
}
/** @param {HTMLFormElement} form @returns {Recipe} */
const readAllFields = (form) => {
  const disabled = [...form.querySelectorAll(':disabled')];
  disabled.forEach((field) => { field.disabled = false; });
  try { return readRecipe(form); }
  finally { disabled.forEach((field) => { field.disabled = true; }); }
};
/** @param {HTMLElement} panel @param {Recipe} recipe @returns {void} */
const renderPreparation = (panel, recipe) => {
  const result = prepareMixture(recipe);
  panel.querySelector('[data-mixture-result]').innerHTML = `<h3>${esc(recipe.product)}</h3><p>${esc(recipe.crop)} · ${esc(recipe.purpose)}</p><p class="price">${result.amount.toLocaleString(undefined, { maximumFractionDigits: 3 })} ${result.unit} product</p><p>Prepare ${result.finished} L of finished mixture for ${recipe.area} ha: ${Math.ceil(result.finished / recipe.tank)} tank loads at up to ${recipe.tank} L each. Top up each load to its finished volume. Follow the label’s mixing order, protective equipment and application restrictions.</p><p>Full tank: ${(result.amount / result.finished * Math.min(recipe.tank, result.finished)).toLocaleString(undefined, { maximumFractionDigits: 3 })} ${result.unit} product. Final tank: ${(result.finished - (Math.ceil(result.finished / recipe.tank) - 1) * recipe.tank).toLocaleString(undefined, { maximumFractionDigits: 3 })} L finished mixture.</p><p class="muted">Reference: ${esc(recipe.source)}</p><p class="muted">Scaled from your entered label rate; this recipe has not been independently verified. Do not combine products unless their labels permit it.</p>`;
};
/** @param {HTMLElement} panel @param {AbortSignal} signal @returns {Promise<void>} */
const researchOptions = async (panel, signal) => {
  const button = panel.querySelector('[data-mixture-research]');
  const error = panel.querySelector('[data-mixture-error]');
  const recipe = readAllFields(panel.querySelector('form'));
  if (!recipe.crop.trim() || !recipe.purpose.trim()) { error.textContent = t('Enter your crop and target first.'); return; }
  button.disabled = true; button.textContent = t('Finding online sources…'); error.textContent = '';
  try {
    const query = `Malaysia ${recipe.crop} ${recipe.purpose}: ${recipe.kind} options, registered labels and evidence; no invented rates`.slice(0, 160);
    const result = await searchPlantWeb(query, getLocale(), signal);
    if (!signal.aborted && readAllFields(panel.querySelector('form')).fieldId === recipe.fieldId && readAllFields(panel.querySelector('form')).purpose === recipe.purpose && readAllFields(panel.querySelector('form')).crop === recipe.crop) panel.querySelector('[data-mixture-research-result]').innerHTML = renderPlantWebResult(result);
  } catch (failure) { if (!signal.aborted) error.textContent = t(failure instanceof Error ? failure.message : 'Research unavailable. You can still use your product label.'); }
  finally { button.disabled = false; button.textContent = t('Find sourced options'); }
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

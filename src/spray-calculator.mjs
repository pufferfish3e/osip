import { convertArea, CalculationError } from './calculators.mjs';
import { t } from './i18n.mjs';
import { escapeHtml as esc, pageHeading } from './ui.mjs';

const US_GALLON_LITRES = 3.785411784;
/** Documented examples, not product dose recommendations. */
export const SPRAY_SETUPS = [
  { id: 't40', name: 'DJI T40 · paddy example', volume: 15, tank: 40, source: 'https://www.dji.com/support/product/t40', note: '15 L/ha; manufacturer paddy performance example.' },
  { id: 't30', name: 'DJI T30 · manufacturer example', volume: 4.8 / convertArea(1, 'acre', 'ha'), tank: 30, source: 'https://www.dji.com/support/product/t30', note: '4.8 L/acre converted to L/ha.' },
  { id: 'backpack', name: 'Backpack · calibrated example', volume: 20 * US_GALLON_LITRES / convertArea(1, 'acre', 'ha'), tank: 16, source: 'https://extension.psu.edu/backpack-sprayer-calibration-for-woodland-applications', note: '20 US gal/acre calibration example; editable 16 L tank assumption.' },
];
/** @typedef {{volume:number|null,tank:number|null,dose:number|null,basis:'ml-ha'|'g-ha'|'ml-l'|'g-l'|null}} SprayConfig */
/** @param {unknown} value @returns {SprayConfig} */
export function validateSprayConfig(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new CalculationError('The configuration could not be read.');
  for (const key of ['volume', 'tank', 'dose']) if (value[key] !== null && (typeof value[key] !== 'number' || !Number.isFinite(value[key]) || value[key] <= 0)) throw new CalculationError('Use positive, explicit quantities.');
  if (![null, 'ml-ha', 'g-ha', 'ml-l', 'g-l'].includes(value.basis)) throw new CalculationError('Use mL or grams per hectare or litre of finished spray.');
  return value;
}
/** @param {number} area @param {SprayConfig} config @returns {{mixture:number,product:number|null,unit:string,tanks:number,lastTank:number}} */
export function estimateSpray(area, config) {
  validateSprayConfig(config);
  if (!Number.isFinite(area) || area <= 0 || config.volume === null || config.tank === null) throw new CalculationError('Choose a positive land area, spray volume and tank size.');
  if ((config.dose === null) !== (config.basis === null)) throw new CalculationError('Enter both the label rate and its units.');
  const mixture = area * config.volume;
  const product = config.dose === null ? null : config.dose * (config.basis.endsWith('-ha') ? area : mixture);
  if (!Number.isFinite(mixture) || !Number.isFinite(mixture / config.tank) || (product !== null && !Number.isFinite(product))) throw new CalculationError('The estimate is too large.');
  const tanks = Math.ceil(mixture / config.tank);
  return { mixture, product, unit: config.basis?.startsWith('g-') ? 'g' : 'mL', tanks, lastTank: mixture - (tanks - 1) * config.tank };
}
/** @param {import('./store.mjs').AppState} state @returns {string} */
export function renderSprayCalculator(state) {
  const choices = state.farms.flatMap((land) => [{ id: land.id, name: land.name, area: convertArea(land.area, land.unit ?? 'ha', 'ha') }, ...land.plots.map((field) => ({ id: field.id, name: `${land.name} · ${field.name}`, area: field.area }))]);
  return `${pageHeading('', t('Spray estimate'), t('Plan one application from your mapped land.'))}<section data-spray-calculator class="card card-pad form-stack"><div data-spray-step><h2>${t('Choose your land')}</h2><label class="field">${t('Land or field')}<select class="input" name="sprayArea">${choices.map((choice) => `<option value="${choice.area}">${esc(choice.name)} · ${choice.area.toFixed(2)} ha</option>`).join('')}</select></label></div><div data-spray-step hidden><h2>${t('Choose a setup')}</h2><label class="field">${t('Reference setup')}<select class="input" name="spraySetup">${SPRAY_SETUPS.map((setup) => `<option value="${setup.id}">${esc(setup.name)}</option>`).join('')}<option value="custom">${t('My own configuration')}</option></select></label><p class="muted" data-spray-source></p><div class="form-grid">${[['volume','Spray mixture (L/ha)'],['tank','Tank capacity (L)'],['dose','Product label rate (optional)']].map(([name,label]) => `<label class="field">${t(label)}<input class="input" type="number" min="0.000001" step="any" name="${name}"></label>`).join('')}</div><label class="field">${t('Label rate units')}<select class="input" name="basis"><option value="ml-ha">mL/ha</option><option value="g-ha">g/ha</option><option value="ml-l">mL/L finished spray</option><option value="g-l">g/L finished spray</option></select></label><button class="button button-secondary" data-spray-ai-open>${t('Describe my setup with AI')}</button></div><div data-spray-step hidden><h2>${t('Your estimate')}</h2><div data-spray-result></div></div><p class="muted">${t('Reference spray volumes are examples, not pesticide doses. Use the product label and calibrated equipment; mapped areas are estimates.')}</p><p role="alert" data-spray-error></p><div class="toolbar"><button class="button button-secondary" data-spray-back hidden>${t('Back')}</button><button class="button" data-spray-next>${t('Continue')}</button></div><dialog class="task-sheet" data-spray-ai aria-labelledby="spray-ai-title"><div class="card-pad form-stack"><h2 id="spray-ai-title">${t('Describe your setup')}</h2><label class="field">${t('Your configuration')}<textarea class="input" maxlength="1000" data-spray-description placeholder="My tank is 16 litres, calibrated at 180 L/ha. The label says 2 mL per litre of finished spray."></textarea></label><p class="muted">${t('AI extracts only the quantities you provide. Review them against the label before calculating.')}</p><p role="status" data-spray-ai-status></p><div class="toolbar"><button class="button button-secondary" data-spray-ai-close>${t('Cancel')}</button><button class="button" data-spray-ai-parse>${t('Review configuration')}</button></div></div></dialog></section>`;
}
/** @param {HTMLElement} root @returns {()=>void} */
export function initializeSprayCalculator(root) {
  const panel = root.querySelector('[data-spray-calculator]');
  if (!panel) return () => {};
  const controller = new AbortController();
  const get = (name) => panel.querySelector(`[name="${name}"]`);
  const error = panel.querySelector('[data-spray-error]');
  let step = 0;
  const show = () => { panel.querySelectorAll('[data-spray-step]').forEach((item,index) => { item.hidden = index !== step; }); panel.querySelector('[data-spray-back]').hidden = step === 0; panel.querySelector('[data-spray-next]').hidden = step === 2; };
  const setup = () => { const selected = SPRAY_SETUPS.find((item) => item.id === get('spraySetup').value); get('volume').value = selected?.volume.toFixed(2) ?? ''; get('tank').value = selected?.tank ?? ''; panel.querySelector('[data-spray-source]').innerHTML = selected ? `${esc(selected.note)} <a href="${selected.source}" target="_blank" rel="noopener noreferrer">${t('Source')}</a>` : ''; };
  setup();
  get('spraySetup').addEventListener('change', setup);
  panel.querySelector('[data-spray-back]').addEventListener('click', () => { step -= 1; error.textContent = ''; show(); });
  panel.querySelector('[data-spray-next]').addEventListener('click', () => {
    try {
      if (!(Number(get('sprayArea').value) > 0)) throw new CalculationError('Map your land first to calculate its spray estimate.');
      if (step === 1) renderEstimate(panel, Number(get('sprayArea').value), { volume:Number(get('volume').value), tank:Number(get('tank').value), dose:get('dose').value ? Number(get('dose').value) : null, basis:get('dose').value ? get('basis').value : null });
      step += 1; error.textContent = ''; show();
    } catch (failure) { error.textContent = t(failure instanceof Error ? failure.message : 'Could not calculate.'); }
  });
  const dialog = panel.querySelector('[data-spray-ai]');
  panel.querySelector('[data-spray-ai-open]').addEventListener('click', () => dialog.showModal());
  panel.querySelector('[data-spray-ai-close]').addEventListener('click', () => dialog.close());
  panel.querySelector('[data-spray-ai-parse]').addEventListener('click', async () => { await parseConfiguration(panel, controller.signal); });
  return () => controller.abort();
}
/** @param {HTMLElement} panel @param {number} area @param {SprayConfig} config @returns {void} */
const renderEstimate = (panel, area, config) => {
  const result = estimateSpray(area, config);
  const format = (value) => value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  panel.querySelector('[data-spray-result]').innerHTML = `<div class="stat-grid"><div><p>${t('Finished spray mixture')}</p><strong>${format(result.mixture)} L</strong></div><div><p>${t('Pesticide product')}</p><strong>${result.product === null ? t('Label rate needed') : `${format(result.product)} ${result.unit}`}</strong></div><div><p>${t('Tank loads')}</p><strong>${result.tanks}</strong></div></div><p>${t('Last tank')}: ${format(result.lastTank)} L · ${format(area)} ha</p><p class="muted">${t('Top up to the finished mixture volume; this is not water plus the same volume of product.')}</p>`;
};
/** @param {HTMLElement} panel @param {AbortSignal} signal @returns {Promise<void>} */
const parseConfiguration = async (panel, signal) => {
  const button = panel.querySelector('[data-spray-ai-parse]');
  if (button.disabled) return;
  const status = panel.querySelector('[data-spray-ai-status]');
  button.disabled = true; status.textContent = t('Reading your configuration…');
  try {
    const response = await fetch('/api/spray-config', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({description:panel.querySelector('[data-spray-description]').value}), signal:AbortSignal.any([signal, AbortSignal.timeout(35000)]) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? 'AI configuration is unavailable.');
    const config = validateSprayConfig(payload);
    if (signal.aborted || !panel.isConnected) return;
    panel.querySelector('[name="spraySetup"]').value = 'custom'; panel.querySelector('[data-spray-source]').textContent = t('AI draft — review every quantity and unit against your label.');
    for (const key of ['volume','tank','dose','basis']) panel.querySelector(`[name="${key}"]`).value = config[key] ?? '';
    panel.querySelector('[data-spray-ai]').close();
  } catch (failure) { if (!signal.aborted) status.textContent = t(failure instanceof Error ? failure.message : 'AI configuration is unavailable.'); console.warn('Spray configuration failed.', failure instanceof Error ? failure.name : 'Unknown error'); }
  finally { button.disabled = false; }
};

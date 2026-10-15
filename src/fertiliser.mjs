import { getFormatLocale, t } from './i18n.mjs';
import { escapeHtml as esc } from './ui.mjs';

/** @typedef {{product:string,amount?:number,unit?:'bag'|'kg'}} Fertiliser */
export const FERTILISER_CATEGORY = 'Fertilizer';
/** Common Malaysian smallholder products; product names stay as printed on the bag. */
export const FERTILISERS = [
  { product: 'Urea (46-0-0)', hint: 'Nitrogen boost' },
  { product: 'NPK 15-15-15', hint: 'Balanced' },
  { product: 'NPK 12-12-17-2', hint: 'Fruiting and filling' },
  { product: 'MOP (0-0-60)', hint: 'Potash' },
  { product: 'Compost / organic', hint: 'Organic matter' },
];
const UNITS = ['bag', 'kg'];
const MAX_AMOUNT = 9999;

/** @param {Record<string,unknown>} fields @returns {Fertiliser|null} Throws a user-facing message when the choice is incomplete. */
export function fertiliserFromFields(fields) {
  const choice = String(fields.fertiliserProduct ?? '').trim();
  const product = choice === 'other' ? String(fields.fertiliserOther ?? '').trim() : choice;
  if (!product) throw new Error('Choose which fertiliser to apply.');
  if (product.length > 60) throw new Error('Keep the fertiliser name under 60 characters.');
  const rawAmount = String(fields.fertiliserAmount ?? '').trim();
  if (!rawAmount) return { product };
  const amount = Number(rawAmount);
  const unit = UNITS.includes(String(fields.fertiliserUnit)) ? /** @type {'bag'|'kg'} */ (String(fields.fertiliserUnit)) : 'bag';
  if (!Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT) throw new Error('Enter an amount above 0, or leave it blank.');
  return { product, amount: Math.round(amount * 100) / 100, unit };
}

/** @param {Fertiliser} fertiliser @returns {string} */
const amountLabel = ({ amount, unit }) => {
  if (!amount) return '';
  const value = new Intl.NumberFormat(getFormatLocale(), { maximumFractionDigits: 2 }).format(amount);
  return unit === 'kg' ? t('{amount} kg', { amount: value }) : t(amount === 1 ? '{amount} bag' : '{amount} bags', { amount: value });
};

/** @param {Fertiliser|undefined} fertiliser @returns {string} Plain text, e.g. "NPK 15-15-15 · 2 bags". */
export function fertiliserLabel(fertiliser) {
  if (!fertiliser?.product) return '';
  return [t(fertiliser.product), amountLabel(fertiliser)].filter(Boolean).join(' · ');
}

/** @param {Fertiliser|undefined} fertiliser @returns {string} */
export const fertiliserTag = (fertiliser) => fertiliser?.product ? `<span class="fertiliser-tag">${esc(fertiliserLabel(fertiliser))}</span>` : '';

/** The task-sheet step body: one product choice, then an optional amount. @param {Fertiliser|undefined} current @returns {string} */
export function renderFertiliserPicker(current) {
  const isPreset = FERTILISERS.some((item) => item.product === current?.product);
  const selected = current?.product ? (isPreset ? current.product : 'other') : '';
  const option = (value, label, hint) => `<label class="fertiliser-option"><input type="radio" name="fertiliserProduct" value="${esc(value)}" ${selected === value ? 'checked' : ''}><span><strong>${esc(label)}</strong>${hint ? `<small>${esc(hint)}</small>` : ''}</span></label>`;
  return `<fieldset class="fertiliser-options"><legend class="sr-only">${esc(t('Fertiliser'))}</legend>${FERTILISERS.map((item) => option(item.product, t(item.product), t(item.hint))).join('')}${option('other', t('Other'), t('Type the name on the bag'))}</fieldset>
    <label class="field" data-fertiliser-other ${selected === 'other' ? '' : 'hidden'}><span>${esc(t('Fertiliser name'))}</span><input class="input" name="fertiliserOther" maxlength="60" value="${esc(selected === 'other' ? current.product : '')}" placeholder="${esc(t('e.g. Nitrophoska Blue'))}"></label>
    <div class="fertiliser-amount"><label class="field"><span>${esc(t('Amount per application (optional)'))}</span><input class="input" name="fertiliserAmount" type="number" inputmode="decimal" min="0.01" max="${MAX_AMOUNT}" step="0.01" value="${current?.amount ?? ''}"></label><label class="field"><span class="sr-only">${esc(t('Unit'))}</span><select class="input" name="fertiliserUnit">${UNITS.map((unit) => `<option value="${unit}" ${(current?.unit ?? 'bag') === unit ? 'selected' : ''}>${esc(t(unit === 'bag' ? 'Bags' : 'kg'))}</option>`).join('')}</select></label></div>`;
}

/** Fertiliser use on one field: each product, times applied and the next date. @param {import('./store.mjs').Task[]} tasks @param {string} farmId @param {string} plotId @param {(date:string)=>string} dateLabel @returns {string} */
export function renderFertiliserSummary(tasks, farmId, plotId, dateLabel) {
  const relevant = tasks.filter((task) => task.farmId === farmId && task.plotId === plotId && task.category === FERTILISER_CATEGORY && task.fertiliser?.product);
  if (!relevant.length) return '';
  const products = new Map();
  for (const task of relevant) {
    const entry = products.get(task.fertiliser.product) ?? { fertiliser: task.fertiliser, applied: 0, next: '' };
    if (task.done) entry.applied += 1;
    else if (!entry.next || task.dueDate < entry.next) { entry.next = task.dueDate; entry.fertiliser = task.fertiliser; }
    products.set(task.fertiliser.product, entry);
  }
  const rows = [...products.values()].map(({ fertiliser, applied, next }) => `<li><span class="fertiliser-summary-dot" aria-hidden="true"></span><span class="row-copy"><strong>${esc(fertiliserLabel(fertiliser))}</strong><span class="row-subtitle">${esc(applied ? t(applied === 1 ? 'Applied {count} time' : 'Applied {count} times', { count: applied }) : t('Not applied yet'))}${next ? ` · ${esc(t('Next {date}', { date: dateLabel(next) }))}` : ''}</span></span></li>`).join('');
  return `<section class="fertiliser-summary card"><h2>${esc(t('Fertiliser on this field'))}</h2><ul>${rows}</ul></section>`;
}

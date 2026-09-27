import { t } from './i18n.mjs';

/** @typedef {'ha' | 'acre' | 'm2'} AreaUnit */

const SQUARE_METERS_PER_UNIT = Object.freeze({ ha: 10000, acre: 4046.8564224, m2: 1 });

/** Invalid calculator inputs must never produce a plausible-looking estimate. */
export class CalculationError extends Error {
  /** @param {string} message */
  constructor(message) {
    super(message);
    this.name = 'CalculationError';
  }
}

/** @param {number} value @param {string} label @returns {void} */
const validateNumber = (value, label) => {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new CalculationError(t('{field} must be a finite, non-negative number.', { field: t(label) }));
  }
};

/** @param {number} value @returns {number} */
const validateResult = (value) => {
  if (!Number.isFinite(value)) throw new CalculationError('The result is too large to calculate.');
  return value;
};

/** @param {AreaUnit} unit @returns {number} */
const areaFactor = (unit) => {
  if (!Object.hasOwn(SQUARE_METERS_PER_UNIT, unit)) {
    throw new CalculationError('Choose hectares, acres, or square meters.');
  }
  return SQUARE_METERS_PER_UNIT[unit];
};

/** @param {number} value @param {AreaUnit} from @param {AreaUnit} to @returns {number} */
export function convertArea(value, from, to) {
  validateNumber(value, 'Area');
  return validateResult(value * (areaFactor(from) / areaFactor(to)));
}

/**
 * The rate is entered by the user; this calculator does not prescribe application rates.
 * @param {number} area @param {number} rate @param {number} unitCost @returns {number}
 */
export function calculateCost(area, rate, unitCost) {
  validateNumber(area, 'Area');
  validateNumber(rate, 'Quantity per area unit');
  validateNumber(unitCost, 'Cost per quantity unit');
  return validateResult(area * rate * unitCost);
}

/** @param {number} revenue @param {number} cost @returns {number} */
export function calculateMargin(revenue, cost) {
  validateNumber(revenue, 'Revenue');
  validateNumber(cost, 'Cost');
  return validateResult(revenue - cost);
}

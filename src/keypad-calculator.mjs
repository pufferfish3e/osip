import { t } from './i18n.mjs';
import { escapeHtml as esc, icon } from './ui.mjs';

const OPERATORS = ['+', '−', '×', '÷'];
const KEYS = ['⌫', 'C', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '−', '1', '2', '3', '+', '±', '0', '.', '='];
const LABELS = { '⌫': 'Delete digit', C: 'Clear', '%': 'Percent', '÷': 'Divide', '×': 'Multiply', '−': 'Subtract', '+': 'Add', '±': 'Change sign', '.': 'Decimal point', '=': 'Equals' };
const MAX_DIGITS = 12;
/** @typedef {{display:string,left:number|null,operator:string,replace:boolean,expression:string,result:number|null}} CalculatorState */
/** @returns {CalculatorState} */
export const emptyCalculator = () => ({ display: '0', left: null, operator: '', replace: false, expression: '', result: null });
/** @param {number} left @param {number} right @param {string} operator @returns {number} */
const arithmetic = (left, right, operator) => {
  if (operator === '÷' && right === 0) throw new Error('Cannot divide by zero.');
  const result = operator === '+' ? left + right : operator === '−' ? left - right : operator === '×' ? left * right : left / right;
  if (!Number.isFinite(result)) throw new Error('Result is too large.');
  return Number(result.toPrecision(MAX_DIGITS));
};
/** @param {CalculatorState} current @param {string} key @returns {CalculatorState} */
export function calculatorInput(current, key) {
  if (key === 'C') return emptyCalculator();
  const state = { ...current, result: null };
  if (/^[0-9.]$/.test(key)) {
    if (state.replace) { state.display = '0'; state.replace = false; if (!state.operator) state.expression = ''; }
    if (key === '.' && state.display.includes('.')) return state;
    if (state.display.replace(/[-.]/g, '').length >= MAX_DIGITS) return state;
    state.display = key === '.' ? `${state.display}.` : state.display === '0' ? key : state.display + key;
  } else if (key === '⌫') state.display = state.display.slice(0, -1).replace(/^-$|^$/, '0');
  else if (key === '±') state.display = String(-Number(state.display));
  else if (key === '%') state.display = String(Number(state.display) / 100);
  else if (OPERATORS.includes(key) || key === '=') {
    if (state.operator && state.left !== null && !state.replace) {
      state.expression = `${state.left} ${state.operator} ${state.display}`;
      state.display = String(arithmetic(state.left, Number(state.display), state.operator));
    }
    if (key === '=') { state.result = Number(state.display); state.expression ||= state.display; state.left = null; state.operator = ''; }
    else { state.left = Number(state.display); state.operator = key; state.expression = `${state.display} ${key}`; }
    state.replace = true;
  }
  return state;
}
/** @returns {string} */
export function renderKeypadCalculator() {
  return `<section class="keypad-calculator" data-keypad tabindex="0" aria-label="${esc(t('Calculator'))}"><header class="keypad-header"><h1>${esc(t('Calculator'))}</h1><div class="toolbar"><button class="icon-button" data-keypad-save disabled aria-label="${esc(t('Save calculation'))}">${icon('bookmark')}</button><a class="icon-button" href="/tools/saved" aria-label="${esc(t('Saved calculations'))}">${icon('clock')}</a></div></header><div class="keypad-display"><p class="muted" data-keypad-expression></p><output data-keypad-output aria-live="polite">0</output><p class="muted" data-keypad-status role="status"></p></div><div class="keypad-grid">${KEYS.map((key) => `<button type="button" data-keypad-key="${key}" class="keypad-key ${OPERATORS.includes(key) || key === '=' ? 'keypad-operator' : ['⌫', 'C', '%'].includes(key) ? 'keypad-utility' : ''}" aria-label="${esc(t(LABELS[key] ?? key))}">${key}</button>`).join('')}</div></section>`;
}
/** @param {HTMLElement} root @param {import('./store.mjs').AppStore} store @returns {void} */
export function initializeKeypadCalculator(root, store) {
  const panel = root.querySelector('[data-keypad]');
  if (!panel) return;
  let state = emptyCalculator();
  const save = panel.querySelector('[data-keypad-save]');
  const status = panel.querySelector('[data-keypad-status]');
  const press = (key) => {
    try {
      state = calculatorInput(state, key);
      panel.querySelector('[data-keypad-output]').textContent = state.display;
      panel.querySelector('[data-keypad-expression]').textContent = state.expression;
      status.textContent = '';
      save.disabled = state.result === null;
    } catch (error) { status.textContent = t(error instanceof Error ? error.message : 'Could not calculate.'); state = emptyCalculator(); save.disabled = true; }
  };
  panel.addEventListener('click', (event) => { const key = event.target.closest('[data-keypad-key]'); if (key) press(key.dataset.keypadKey); });
  panel.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && event.target.closest('button,a')) return;
    const key = { '*': '×', '/': '÷', '-': '−', Enter: '=', Backspace: '⌫', Escape: 'C' }[event.key] ?? event.key;
    if (!KEYS.includes(key)) return;
    event.preventDefault(); press(key);
  });
  save.addEventListener('click', () => {
    if (state.result === null) return;
    try {
      store.update((draft) => draft.savedCalculations.unshift({ id: crypto.randomUUID(), type: 'basic', title: state.expression, result: state.result, unit: '', date: new Date().toISOString() }));
      save.disabled = true; status.textContent = t('Calculation saved.');
    } catch (error) { status.textContent = t(error instanceof Error ? error.message : 'Could not calculate.'); }
  });
}

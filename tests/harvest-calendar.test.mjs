import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with {type:'json'};
import { initializeTaskEndCalendar, isTaskEndDateValid } from '../src/schedule.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('expected harvest renders the shared calendar container instead of a native date input', () => {
  const state = structuredClone(DEMO);
  const farm = state.farms[0];
  const html = renderWorkspace(`/farm/${farm.id}/schedule`,state);
  assert.match(html,/data-task-end-picker role="group" aria-labelledby="task-end-date-label"/);
  assert.match(html,/type="hidden" name="endDate"/);
  assert.doesNotMatch(html,/type="date" name="endDate"/);
});

test('shared harvest calendar preserves selection during month browsing and rejects disabled dates', () => {
  const picker = {dataset:{},innerHTML:'',addEventListener:(_,listener) => { picker.click = listener; },querySelector:() => null};
  const error = {hidden:false};
  const form = {elements:{dueDate:{value:'2030-01-10'},endDate:{value:'2030-01-20'}},querySelector:(selector) => selector === '[data-end-date-error]' ? error : picker};
  initializeTaskEndCalendar(form);
  assert.match(picker.innerHTML,/data-calendar-date="2030-01-20"\s+aria-pressed="true"/);
  assert.match(picker.innerHTML,/data-calendar-date="2030-01-09" disabled/);
  const click = (dataset,disabled=false) => picker.click({target:{closest:() => ({dataset,disabled})}});
  click({calendarMove:'1'});
  assert.equal(picker.dataset.month,'2030-02');
  assert.equal(form.elements.endDate.value,'2030-01-20');
  click({calendarDate:'2030-02-15'});
  assert.equal(form.elements.endDate.value,'2030-02-15');
  assert.equal(error.hidden,true);
  click({calendarDate:'2030-01-09'},true);
  assert.equal(form.elements.endDate.value,'2030-02-15');
});

test('end date must be real and on or after the first task', () => {
  assert.equal(isTaskEndDateValid('2030-01-10','2030-01-10'),true);
  for (const date of ['', '2030-01-09', '2030-02-30', 'invalid']) assert.equal(isTaskEndDateValid(date,'2030-01-10'),false);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { demoPilotMatch, initializePilotDatePicker, matchPilots, renderPilotMatcher, renderPilotMatch, revealPilotMatch } from '../src/pilot-matcher.mjs';
import { PILOTS } from '../src/data.mjs';
const PREFERENCES = {service:'Mapping',area:'Perak',date:'',budget:75};
test('demo matching rotates eligible pilots and gives an explicitly illustrative score below 100', () => {
  const first = demoPilotMatch(PREFERENCES, '', () => 0);
  const second = demoPilotMatch(PREFERENCES, first.pilot.id, () => 0.99);
  assert.notEqual(first.pilot.id, second.pilot.id);
  for (const match of [first, second]) {
    assert.ok(match.score >= 72 && match.score <= 95);
    assert.ok(match.pilot.services.includes(PREFERENCES.service));
    assert.match(renderPilotMatch(match), /Demo match/);
  }
  assert.equal(demoPilotMatch({ ...PREFERENCES, area:'Other' }), undefined);
  const spraying = demoPilotMatch({ ...PREFERENCES, service:'Spraying' }, 'maya', () => 0);
  assert.notEqual(spraying.pilot.id, 'maya');
  assert.ok(spraying.pilot.services.includes('Spraying'));
});

test('matching shows a loading state before reveal and never reopens a cancelled dialog', async () => {
  let release;
  const dialog = { innerHTML:'', open:false, isConnected:true, showModal() { this.open = true; } };
  const pending = revealPilotMatch(dialog, demoPilotMatch(PREFERENCES), () => new Promise((resolve) => { release = resolve; }));
  assert.match(dialog.innerHTML, /Finding your pilot/);
  assert.doesNotMatch(dialog.innerHTML, /pilot-match-cover/);
  dialog.open = false;
  release();
  await pending;
  assert.equal(dialog.open, false);
  assert.doesNotMatch(dialog.innerHTML, /pilot-match-cover/);
  await revealPilotMatch(dialog, demoPilotMatch(PREFERENCES), async () => {});
  assert.match(dialog.innerHTML, /pilot-match-cover/);
});
test('matching requires service and area; budget and date affect score deterministically', () => {
  const results = matchPilots(PREFERENCES);
  assert.deepEqual(new Set(results.map((result)=>result.pilot.id)), new Set(['azlan','maya','kelvin','siti','amir','joanne']));
  assert.equal(results[0].score,100);
  const spraying = matchPilots({...PREFERENCES,service:'Spraying'});
  assert.deepEqual(new Set(spraying.map((result)=>result.pilot.id)), new Set(['maya','hakim','amir','nabil']));
  assert.deepEqual(matchPilots({...PREFERENCES,area:'Other'}), []);
  assert.ok(matchPilots({...PREFERENCES,budget:60})[0].score < 100);
  const early=matchPilots({...PREFERENCES,date:'2000-01-01'});
  assert.equal(early[0].dateMatches,false);
  assert.ok(early[0].score<100);
  assert.equal(matchPilots({...PREFERENCES,date:PILOTS[0].available})[0].dateMatches,true);
});
test('wizard offers catalogue bypass and four steps with a separate centered result dialog',()=>{
 const html=renderPilotMatcher();
 assert.equal((html.match(/data-match-step=/g)??[]).length,4);
 assert.match(html,/Browse all pilots/);
 assert.match(html,/data-pilot-match/);
 assert.match(html,/data-match-back/);
 assert.match(html,/data-pilot-date-picker/);
 assert.match(html,/class="calendar-days"/);
 assert.doesNotMatch(html,/type="date"/);
});

test('pilot calendar preserves selection while navigating and supports flexible dates', () => {
  const input = { value:'' };
  const listeners = new Map();
  let cells = [];
  const picker = {
    set innerHTML(html) { cells = [...html.matchAll(/data-calendar-date="([^"]+)"/g)].map((match) => ({ dataset:{ calendarDate:match[1] }, disabled:false })); },
    querySelectorAll:() => cells,
    querySelector:() => ({ focus:() => {} }),
    addEventListener:(name, handler) => listeners.set(name, handler),
  };
  const flexible = { setAttribute:() => {}, addEventListener:(name, handler) => listeners.set('flexible', handler) };
  initializePilotDatePicker({ querySelector:(selector) => selector === '[data-pilot-date-picker]' ? picker : flexible }, input, '2026-09-27');
  assert.equal(cells.find((cell) => cell.dataset.calendarDate === '2026-09-26').disabled, true);
  const click = (dataset) => listeners.get('click')({ target:{ closest:() => ({ dataset, disabled:false, hasAttribute:(name) => name === 'data-calendar-expand' && Boolean(dataset.shouldToggle) }) } });
  click({ calendarDate:'2026-09-28' });
  assert.equal(input.value, '2026-09-28');
  click({ calendarMove:'1' });
  assert.ok(cells.some((cell) => cell.dataset.calendarDate === '2026-10-01'));
  assert.equal(input.value, '2026-09-28');
  click({ calendarDate:'2026-09-01' });
  assert.equal(input.value, '2026-09-28');
  click({ shouldToggle:true });
  assert.equal(cells.length, 7);
  click({ shouldToggle:true });
  assert.ok(cells.length > 7);
  assert.equal(input.value, '2026-09-28');
  listeners.get('flexible')();
  assert.equal(input.value, '');
});

test('matched card uses each pilot portrait, shows rating and explains demo reviews', () => {
 for (const pilot of PILOTS) {
  const html = renderPilotMatch({pilot,score:100,dateMatches:true,budgetMatches:true});
  assert.ok(html.includes(pilot.portrait));
  if (pilot.reviewCount) {
    assert.ok(html.includes(String(pilot.rating)));
    assert.ok(html.includes(`(${pilot.reviewCount})`));
    assert.match(html, /Sample reviews/);
  } else assert.match(html, /No reviews yet/);
  for (const review of pilot.reviews) assert.ok(html.includes(review));
  assert.match(html, pilot.portrait.endsWith('.svg') ? /Placeholder portrait/ : /AI-generated portrait/);
  assert.ok(html.includes(`/services/pilots/${pilot.id}`));
 }
 assert.match(renderPilotMatch(undefined), /No pilot fits/);
});

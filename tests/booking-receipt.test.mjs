import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE, PILOTS } from '../src/data.mjs';
import { initializeChatComposer, renderWorkspace } from '../src/workspace.mjs';

const BOOKING = { id:'receipt-test', type:'pilot', providerId:'azlan', title:'Mapping with Azlan Ibrahim', date:'2026-09-30', time:'09:00', farmId:'land-test', status:'requested', notes:'Check the north field', price:504.5, conversation:[] };

test('booking receipt preserves details and actions without stacked cards', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id:'land-test', name:'Land 2', crop:'Rice', location:'Perak', plots:[] }];
  state.bookings = [BOOKING];
  const html = renderWorkspace('/bookings/receipt-test', state);
  assert.match(html, /booking-receipt-amount/);
  assert.match(html, /504\.50/);
  assert.match(html, /Land 2/);
  assert.match(html, /data-action="cancel-booking"/);
  assert.doesNotMatch(html, /Open conversation/);
  assert.match(html, /<details class="booking-reschedule">/);
  assert.match(html, /data-form="reschedule"/);
  assert.doesNotMatch(html, /class="card|stat-grid|notice/);
});

test('cancelled receipt shows disabled actions without cancellation or reschedule handlers', () => {
  const state = structuredClone(INITIAL_STATE);
  state.bookings = [{ ...BOOKING, status:'cancelled' }];
  const html = renderWorkspace('/bookings/receipt-test', state);
  assert.doesNotMatch(html, /data-action="cancel-booking"|data-form="reschedule"/);
  assert.doesNotMatch(html, /Open conversation/);
  assert.match(html, /booking-inactive-actions/);
  assert.equal((html.match(/class="button button-secondary" disabled/g) ?? []).length, 2);
});

test('pilot portraits stay consistent in chat and inbox', () => {
  for (const pilot of PILOTS) {
    const state = structuredClone(INITIAL_STATE);
    state.bookings = [{ ...BOOKING, providerId:pilot.id }];
    for (const route of ['/messages', '/bookings/receipt-test/chat']) {
      const html = renderWorkspace(route, state);
      assert.ok(html.includes(`src="${pilot.portrait}"`));
      assert.doesNotMatch(html, /avatar-default/);
    }
  }
});

test('unknown pilot keeps the fallback avatar', () => {
  const state = structuredClone(INITIAL_STATE);
  state.bookings = [{ ...BOOKING, providerId:'missing-pilot' }];
  assert.match(renderWorkspace('/bookings/receipt-test/chat', state), /avatar-default.svg/);
});

test('chat reveals the shared app background', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  const backgrounds = [...css.matchAll(/\.chat-screen\s*\{[^}]*background:([^;]+);/g)];
  assert.equal(backgrounds.at(-1)?.[1], 'transparent');
});

test('saving a chat message persists without a success toast', () => {
  const state = structuredClone(INITIAL_STATE);
  state.bookings = [{ ...BOOKING, conversation:[] }];
  const result = submitForm(state, 'message', { bookingId:BOOKING.id, message:'Hello' });
  assert.equal(result.message, undefined);
  assert.equal(state.bookings[0].conversation[0].text, 'Hello');
});

test('chat composer overrides the global textarea minimum height', () => {
  const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
  assert.match(css, /\.chat-composer textarea \{[^}]*min-height:44px; height:44px;/);
  assert.match(css, /\.chat-screen \{ margin-inline:0; padding:0;/);
});

test('Enter sends, while Shift+Enter and composition preserve typing', () => {
  let handler;
  let submissions = 0;
  let prevented = 0;
  const textarea = { value:'Hello', form:{ requestSubmit:() => { submissions++; } }, addEventListener:(_name, callback) => { handler = callback; } };
  initializeChatComposer({ querySelector:() => textarea });
  const press = (overrides = {}) => handler({ key:'Enter', preventDefault:() => { prevented++; }, ...overrides });
  press();
  assert.equal(submissions, 1);
  assert.equal(prevented, 1);
  for (const overrides of [{ shiftKey:true }, { isComposing:true }, { keyCode:229 }, { repeat:true }, { key:'a' }]) press(overrides);
  assert.equal(submissions, 1);
  assert.equal(prevented, 1);
  textarea.value = '   ';
  press();
  assert.equal(submissions, 1);
});

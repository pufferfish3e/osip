import assert from 'node:assert/strict';
import { test } from 'node:test';

import { submitForm } from '../src/actions.mjs';
import { pilotBookingDateRange } from '../src/booking-dates.mjs';
import { INITIAL_STATE, PILOTS } from '../src/data.mjs';
import { setLocale } from '../src/i18n.mjs';
import { formatArea } from '../src/ui.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('areas show at most two decimals', () => {
  assert.equal(formatArea(4.9996), '5');
  assert.equal(formatArea(19.9982), '20');
  assert.equal(formatArea(1.234), '1.23');
  assert.equal(formatArea(Number.NaN), '0');
});

test('a booking request reads in the current language with a formatted date', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id: 'farm-test', name: 'Test land', location: 'Perak', crop: 'Rice', area: 4.9996, unit: 'ha', plantedAt: '', plots: [] }];
  const pilot = PILOTS[0];
  const date = pilotBookingDateRange().minimumDate;
  const { redirect } = submitForm(state, 'pilot-booking', { providerId: pilot.id, farmId: 'farm-test', service: [pilot.services[0]], date, time: '09:00', notes: 'North gate' });
  const request = state.bookings.at(-1).conversation[0];
  assert.deepEqual(request.request, { services: [pilot.services[0]], providerId: pilot.id, land: 'Test land', area: 4.9996, date, time: '09:00', notes: 'North gate' });
  try {
    setLocale('ms');
    const html = renderWorkspace(redirect, state);
    assert.match(html, /Test land · 5 ha/);
    assert.doesNotMatch(html, new RegExp(`${date} ·`));
    assert.match(html, /North gate/);
  } finally {
    setLocale('en');
  }
});

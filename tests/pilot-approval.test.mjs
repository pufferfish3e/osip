import assert from 'node:assert/strict';
import { test } from 'node:test';

import { approvePilotBooking, submitForm } from '../src/actions.mjs';
import { INITIAL_STATE, PILOTS } from '../src/data.mjs';
import { pilotBookingDateRange } from '../src/booking-dates.mjs';

const requestPilot = () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id: 'farm-test', name: 'Test land', location: 'Perak', crop: 'Rice', area: 2, unit: 'ha', plantedAt: '', plots: [] }];
  const pilot = PILOTS[0];
  const result = submitForm(state, 'pilot-booking', { providerId: pilot.id, farmId: state.farms[0].id, service: [pilot.services[0]], date: pilotBookingDateRange().minimumDate, time: '09:00', notes: 'Map the main plot.' });
  const id = result.redirect.match(/^\/bookings\/([^/]+)\/chat$/)[1];
  return { state, pilot, booking: state.bookings.find((item) => item.id === id) };
};

test('a new pilot request waits for the pilot reply, then is confirmed in its chat', () => {
  const { state, pilot, booking } = requestPilot();
  assert.equal(booking.status, 'requested');
  assert.equal(booking.awaitingPilotReply, true);
  assert.equal(approvePilotBooking(state, booking.id, new Date('2026-10-14T08:00:00Z')), true);
  assert.equal(booking.status, 'confirmed');
  assert.equal(booking.awaitingPilotReply, undefined);
  const reply = booking.conversation.at(-1);
  assert.equal(reply.sender, pilot.name);
  assert.deepEqual(reply.approval, { bookingId: booking.id, services: [pilot.services[0]], date: booking.date, time: '09:00', land: state.farms[0].name, price: booking.price });
  assert.equal(state.notifications[0].title, 'Booking confirmed');
  assert.equal(state.notifications[0].bookingId, booking.id);
});

test('the pilot replies once, and never to a cancelled or older request', () => {
  const { state, booking } = requestPilot();
  approvePilotBooking(state, booking.id);
  const messages = booking.conversation.length;
  assert.equal(approvePilotBooking(state, booking.id), false);
  assert.equal(booking.conversation.length, messages);

  const cancelled = requestPilot();
  cancelled.booking.status = 'cancelled';
  assert.equal(approvePilotBooking(cancelled.state, cancelled.booking.id), false);
  assert.equal(cancelled.booking.status, 'cancelled');

  const older = requestPilot();
  delete older.booking.awaitingPilotReply;
  assert.equal(approvePilotBooking(older.state, older.booking.id), false);
  assert.equal(older.booking.status, 'requested');
});

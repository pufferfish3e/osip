import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pilotBookingDateRange } from '../src/booking-dates.mjs';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE, PILOTS } from '../src/data.mjs';
import { calendarDate, renderCalendar } from '../src/schedule.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('one-week booking window uses local calendar days across month and year boundaries', () => {
  assert.deepEqual(pilotBookingDateRange(new Date('2026-09-28T23:59:00')), { minimumDate:'2026-09-29', maximumDate:'2026-10-05' });
  assert.deepEqual(pilotBookingDateRange(new Date('2026-12-28T00:01:00')), { minimumDate:'2026-12-29', maximumDate:'2027-01-04' });
  assert.deepEqual(pilotBookingDateRange(new Date('2028-02-25T12:00:00')), { minimumDate:'2028-02-26', maximumDate:'2028-03-03' });
});

test('shared calendar enables the inclusive last day and disables dates outside the booking window', () => {
  const html = renderCalendar('', '2026-10', true, [], false, '2026-09-28', '2026-10-05');
  assert.doesNotMatch(html, /data-calendar-date="2026-10-05" disabled/);
  assert.match(html, /data-calendar-date="2026-10-06" disabled/);
  const september = renderCalendar('', '2026-09', true, [], false, '2026-09-28', '2026-10-05');
  assert.match(september, /data-calendar-date="2026-09-27" disabled/);
  assert.doesNotMatch(september, /data-calendar-date="2026-09-28" disabled/);
  assert.doesNotMatch(renderCalendar('', '2026-10', true), /data-calendar-date="2026-10-06" disabled/);
});

test('pilot booking and rescheduling reject day eight without modifying saved requests', () => {
  const state = structuredClone(INITIAL_STATE);
  const { minimumDate, maximumDate } = pilotBookingDateRange();
  state.farms = [{id:'test-land', name:'Test land', area:1, crop:'Rice', plots:[]}];
  state.bookings = [];
  const outside = new Date(`${maximumDate}T12:00:00`);
  outside.setDate(outside.getDate() + 1);
  const fields = {providerId:PILOTS[0].id, farmId:'test-land', date:calendarDate(outside), time:'23:59'};
  assert.throws(() => submitForm(state, 'pilot-booking', fields), /next seven days/);
  assert.equal(state.bookings.length, 0);
  submitForm(state, 'pilot-booking', {...fields, date:maximumDate});
  const booking = state.bookings[0];
  assert.throws(() => submitForm(state, 'reschedule', {...fields, bookingId:booking.id}), /next seven days/);
  assert.equal(booking.rescheduleRequest, undefined);
  submitForm(state, 'reschedule', {...fields, bookingId:booking.id, date:maximumDate, time:'22:00'});
  assert.equal(booking.rescheduleRequest.date, maximumDate);
  const receipt = renderWorkspace(`/bookings/${booking.id}`, state);
  assert.ok(receipt.includes(`min="${minimumDate}" max="${maximumDate}"`));
});

test('same-day pilot booking and rescheduling are rejected, tomorrow is accepted', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'notice-land',name:'Land',area:1,crop:'Rice',plots:[]}];
  state.bookings = [];
  const fields = {providerId:PILOTS[0].id,farmId:'notice-land',date:calendarDate(new Date()),time:'23:59'};
  assert.throws(() => submitForm(state,'pilot-booking',fields), /tomorrow/);
  assert.equal(state.bookings.length,0);
  submitForm(state,'pilot-booking',{...fields,date:pilotBookingDateRange().minimumDate});
  const booking = state.bookings[0];
  assert.throws(() => submitForm(state,'reschedule',{...fields,bookingId:booking.id}), /tomorrow/);
  assert.equal(booking.rescheduleRequest,undefined);
});

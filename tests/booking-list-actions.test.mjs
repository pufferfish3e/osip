import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { applyAction } from '../src/actions.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('booking list and receipt share rescheduling and cancellation state', () => {
  const state = structuredClone(INITIAL_STATE);
  state.bookings = [{id:'booking',type:'pilot',providerId:'azlan',title:'Mapping',date:'2030-01-01',time:'09:00',farmId:'land',status:'requested',notes:'',price:50,conversation:[]}];
  const html = renderWorkspace('/bookings', state);
  assert.match(html, /data-action="cancel-booking" data-id="booking"/);
  assert.match(html, /data-form="reschedule"/);
  assert.match(html, /name="bookingId" value="booking"/);
  applyAction(state,'cancel-booking','booking');
  assert.doesNotMatch(renderWorkspace('/bookings',state),/data-action="cancel-booking"|data-form="reschedule"/);
  assert.match(renderWorkspace('/bookings/booking',state),/Cancelled/);
});

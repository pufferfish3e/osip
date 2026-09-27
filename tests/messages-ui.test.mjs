import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { submitForm } from '../src/actions.mjs';

test('inbox has searchable previews and conversation links without fabricated presence', () => {
  const state = structuredClone(INITIAL_STATE);
  const booking = {id:'test-booking',type:'pilot',providerId:'pilot-1',title:'Mapping job',date:'2026-09-28',time:'08:00',farmId:state.farms[0].id,status:'requested',notes:'',price:0,conversation:[]};
  state.bookings.push(booking);
  booking.conversation = [{id:'test',sender:'you',text:'<script>bad()</script>',date:'2026-09-27T00:00:00Z'}];
  const html = renderWorkspace('/messages',state);
  assert.match(html,/data-search="conversations"/);
  assert.ok(html.includes(`/bookings/${booking.id}/chat`));
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>|Online now|Delivered|Read receipt/);
});
test('conversation separates bubble direction and retains local message submission', () => {
  const state = structuredClone(INITIAL_STATE);
  const booking = {id:'test-booking',type:'pilot',providerId:'pilot-1',title:'Mapping job',date:'2026-09-28',time:'08:00',farmId:state.farms[0].id,status:'requested',notes:'',price:0,conversation:[]};
  state.bookings.push(booking);
  booking.conversation = [{id:'incoming',sender:'Provider',text:'A test incoming message',date:'2026-09-27T00:00:00Z'}];
  submitForm(state,'message',{bookingId:booking.id,message:'A test local reply'});
  const html = renderWorkspace(`/bookings/${booking.id}/chat`,state);
  assert.match(html,/message-received/); assert.match(html,/message-own/);
  assert.match(html,/class="chat-composer" data-form="message"/);
  assert.doesNotMatch(html,/Messages are not delivered/);
  assert.match(html,/avatar-default.svg/);
  assert.doesNotMatch(html,/chat-booking-context|inbox-context/);
  assert.match(html,/name="bookingId"/); assert.match(html,/name="message"/);
});

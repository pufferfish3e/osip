import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseChatReply, validateChatRequest } from '../server/mock-chat.mjs';
import { COURSES, INITIAL_STATE } from '../src/data.mjs';
import { submitForm } from '../src/actions.mjs';
import { createStore } from '../src/store.mjs';
import { appendChatReply, requestChatReply, renderWorkspace } from '../src/workspace.mjs';

const BOOKING = { id:'test', type:'pilot', providerId:'azlan', conversation:[{ id:'sent', sender:'you', text:'Can you map my rice field?', date:'2026-09-27' }] };

test('chat validates supported pilot and bounded history', () => {
  assert.equal(validateChatRequest({ providerId:'azlan', messages:BOOKING.conversation }).pilot.name, 'Azlan Ibrahim');
  for (const value of [{ providerId:'unknown', messages:BOOKING.conversation }, { providerId:'azlan', messages:[] }, { providerId:'azlan', messages:[{ sender:'you', text:'x'.repeat(2001) }] }]) assert.throws(() => validateChatRequest(value));
});

test('completed AI text becomes a few bubbles; incomplete output fails', () => {
  assert.deepEqual(parseChatReply({ status:'completed', output:[{ type:'message', content:[{ type:'output_text', text:'Hi!\n\nHow is field access?' }] }] }), ['Hi!', 'How is field access?']);
  assert.throws(() => parseChatReply({ status:'incomplete', output:[] }));
});

test('client sends bounded context and persists replies once', async () => {
  const booking = structuredClone(BOOKING);
  const replies = await requestChatReply(booking, async (url, options) => {
    assert.equal(url, '/api/mock-chat');
    assert.equal(JSON.parse(options.body).messages[0].text, BOOKING.conversation[0].text);
    return Response.json({ messages:['Hi!', 'How is field access?'] });
  });
  assert.equal(appendChatReply(booking, 'sent', replies), true);
  assert.equal(booking.conversation[1].sender, 'Azlan Ibrahim');
  assert.equal(appendChatReply(booking, 'sent', replies), false);
});

test('stale replies never overwrite newer messages and failures surface', async () => {
  const booking = structuredClone(BOOKING);
  booking.conversation.push({ ...booking.conversation[0], id:'newer' });
  assert.equal(appendChatReply(booking, 'sent', ['Hi']), false);
  await assert.rejects(requestChatReply(booking, async () => Response.json({ error:{ message:'Unavailable' } }, { status:503 })), /Unavailable/);
});

test('casual contacts and course instructors are valid AI personas', () => {
  assert.equal(validateChatRequest({ name:'Farmer Sam', messages:BOOKING.conversation }).pilot.role, 'fellow farmer');
  assert.equal(validateChatRequest({ providerId:COURSES[0].id, messages:BOOKING.conversation }).pilot.name, COURSES[0].instructor);
  assert.throws(() => validateChatRequest({ name:'x'.repeat(101), messages:BOOKING.conversation }));
});

test('casual chat is created, rendered and saved without a booking', () => {
  const values = new Map();
  const storage = { getItem:(key) => values.get(key) ?? null, setItem:(key, value) => values.set(key, value) };
  const store = createStore(storage);
  let result;
  store.update((state) => { result = submitForm(state, 'conversation', { name:'Farmer Sam' }); });
  const id = store.getState().chats[0].id;
  assert.equal(result.redirect, `/messages/${id}`);
  const html = renderWorkspace(result.redirect, store.getState());
  assert.match(html, /Farmer Sam/);
  assert.match(html, /name="chatId"/);
  assert.match(html, /data-chat-typing role="status" hidden/);
  assert.doesNotMatch(html, /Booking details|name="bookingId"/);
  store.update((state) => { submitForm(state, 'message', { chatId:id, message:'How is your rice harvest?' }); });
  const reloaded = createStore(storage).getState();
  assert.equal(reloaded.chats[0].conversation[0].text, 'How is your rice harvest?');
  assert.equal(reloaded.bookings.length, INITIAL_STATE.bookings.length);
  assert.match(renderWorkspace('/messages', reloaded), new RegExp(`/messages/${id}`));
});

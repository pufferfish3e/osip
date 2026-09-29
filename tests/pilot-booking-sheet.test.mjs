import { pilotBookingDateRange } from '../src/booking-dates.mjs';
import { renderCalendar } from '../src/schedule.mjs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE, PILOTS, COURSES } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { unifiedConversations, renderWorkspace } from '../src/workspace.mjs';
import { createStore } from '../src/store.mjs';

const LAND = {id:'booking-land',name:'North land',location:'Perak',area:2,crop:'Rice',unit:'ha',plantedAt:'',plots:[],isDemo:false};
const createState = () => ({...structuredClone(INITIAL_STATE),farms:[LAND],bookings:[]});
const fieldsFor = (pilot) => ({providerId:pilot.id,farmId:LAND.id,service:pilot.services[0],date:pilotBookingDateRange().maximumDate,time:'09:00',notes:'Use the north entrance.'});

test('pilot request is a guided modal over the pilot profile', () => {
  const html = renderDiscover(`/services/pilots/${PILOTS[0].id}/book`,createState());
  assert.match(html, /<dialog[^>]*data-pilot-booking-sheet/);
  assert.match(html, /data-booking-back/);
  assert.match(html, /data-booking-next/);
  assert.match(html, /data-booking-close/);
  assert.equal((html.match(/data-form="pilot-booking"/g) ?? []).length,1);
});

test('saving request opens its chat and seeds the Messages conversation with job details', () => {
  const state = createState();
  const result = submitForm(state,'pilot-booking',fieldsFor(PILOTS[0]));
  const booking = state.bookings[0];
  assert.equal(result.redirect,`/bookings/${booking.id}/chat`);
  assert.equal(booking.status,'requested');
  assert.equal(booking.conversation[0].sender,'you');
  assert.match(booking.conversation[0].text,/North land · 2 ha/);
  assert.ok(booking.conversation[0].text.includes(`${fieldsFor(PILOTS[0]).date} · 09:00`));
  assert.match(booking.conversation[0].text,/Use the north entrance/);
  assert.match(renderWorkspace('/messages',state),new RegExp(`/bookings/${booking.id}/chat`));
  assert.match(renderWorkspace(result.redirect,state),/Use the north entrance/);
  assert.throws(()=>submitForm(state,'pilot-booking',fieldsFor(PILOTS[0])));
  assert.equal(state.bookings.length,1);
});

test('booking conversation survives a device-store reload', () => {
  const records = new Map();
  const storage = {getItem:(key)=>records.get(key)??null,setItem:(key,value)=>records.set(key,value)};
  const store = createStore(storage);
  store.update((state)=> { state.farms=[LAND]; state.bookings=[]; submitForm(state,'pilot-booking',fieldsFor(PILOTS[0])); });
  assert.match(createStore(storage).getState().bookings[0].conversation[0].text,/North land/);
});

test('booking accepts several offered services and rejects empty or unsupported selections', () => {
  const pilot = PILOTS.find((item)=>item.services.length > 1);
  const state = createState();
  const fields = {...fieldsFor(pilot),service:pilot.services.slice(0,2)};
  const html = renderDiscover(`/services/pilots/${pilot.id}/book`,state);
  assert.match(html,/Booking details/);
  assert.match(html,/data-booking-services/);
  assert.equal((html.match(/type="checkbox" name="service"/g)??[]).length,pilot.services.length);
  assert.throws(()=>submitForm(state,'pilot-booking',{...fields,service:[]}));
  assert.throws(()=>submitForm(state,'pilot-booking',{...fields,service:['Unsupported']}));
  submitForm(state,'pilot-booking',fields);
  assert.deepEqual(state.bookings[0].services,fields.service);
  for (const service of fields.service) assert.ok(state.bookings[0].conversation[0].text.includes(service));
});

test('booking uses the scheduler calendar and prevents selecting past days', () => {
  const html = renderDiscover(`/services/pilots/${PILOTS[0].id}/book`,createState());
  assert.match(html,/data-booking-calendar/);
  assert.match(html,/calendar-heading/);
  assert.match(html,/type="hidden" name="date"/);
  assert.doesNotMatch(html,/type="date" name="date"/);
  const calendar = renderCalendar('2026-09-27','2026-09',true,[],false,'2026-09-27');
  assert.match(calendar,/data-calendar-date="2026-09-26" disabled/);
  assert.doesNotMatch(calendar,/data-calendar-date="2026-09-27" disabled/);
});


test('booking calendar shows the late-fee notice within its guided date step', () => {
  const html = renderDiscover(`/services/pilots/${PILOTS[0].id}/book`,createState());
  const dateStep = html.match(/<section class="field" data-booking-date>[\s\S]*?<\/section>/)?.[0];
  assert.ok(dateStep);
  assert.match(dateStep, /data-booking-calendar[\s\S]*<p class="muted booking-date-note">Existing bookings beyond the seven-day window may incur a late fee of RM 30 per day\.<\/p>/);
});

test('pilot booking errors have an accessible target inside the modal',()=>{
 const state=structuredClone(INITIAL_STATE);
 state.farms=[LAND];
 const html=renderDiscover(`/services/pilots/${PILOTS[0].id}/book`,state);
 assert.match(html,/<p[^>]*data-booking-error[^>]*role="alert"[^>]*tabindex="-1"[^>]*hidden/);
});

test('course booking errors remain visible inside the sheet',()=>{
 const html=renderDiscover(`/learn/courses/${COURSES[0].id}/book`,INITIAL_STATE);
 assert.match(html,/<p[^>]*data-booking-error[^>]*role="alert"/);
});

test('same pilot bookings share one inbox and retain messages through both old routes', () => {
  const pilot = PILOTS[0];
  const base = {type:'pilot',providerId:pilot.id,title:'Mapping',date:'2030-01-01',time:'08:00'};
  const first = {...base,id:'first',conversation:[{id:'m1',text:'First booking',sender:'you',date:'2030-01-01T08:00:00Z'}]};
  const second = {...base,id:'second',conversation:[{id:'m2',text:'Second booking',sender:'you',date:'2030-01-02T08:00:00Z'}]};
  const state = {...structuredClone(INITIAL_STATE),bookings:[first,second],chats:[]};
  assert.equal(unifiedConversations(state).length,1);
  assert.equal((renderWorkspace('/messages',state).match(/class="inbox-row"/g) ?? []).length,1);
  for (const id of ['first','second']) {
    const html = renderWorkspace(`/bookings/${id}/chat`,state);
    assert.match(html,/First booking/);
    assert.match(html,/Second booking/);
  }
  assert.equal(first.conversation.length,1);
  assert.equal(second.conversation.length,1);
});

test('course chat uses its instructor portrait', () => {
  const course = COURSES.find((item)=>item.instructorPortrait);
  const state = {...structuredClone(INITIAL_STATE),chats:[],bookings:[{id:'course-chat',type:'course',providerId:course.id,title:course.title,date:course.date,conversation:[]}]};
  assert.ok(renderWorkspace('/messages',state).includes(course.instructorPortrait));
  assert.ok(renderWorkspace('/bookings/course-chat/chat',state).includes(course.instructorPortrait));
});

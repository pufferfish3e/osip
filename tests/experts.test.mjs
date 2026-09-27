import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { matchExperts, startExpertChat } from '../src/expert-data.mjs';
import { renderExperts } from '../src/expert-ui.mjs';
import { renderHome } from '../src/home.mjs';
import { setLocale } from '../src/i18n.mjs';
import { requestChatReply } from '../src/workspace.mjs';

test('expert matching is deterministic and explains preference score', () => {
  const preferences = {crop:'Rice',topic:'Pests',area:'Kedah',language:'Bahasa Melayu'};
  const matches = matchExperts(preferences);
  assert.equal(matches[0].expert.id,'expert-azlan');
  assert.equal(matches[0].score,100);
  assert.deepEqual(matches[0].reasons,Object.values(preferences));
  assert.deepEqual(matches,matchExperts(preferences));
});
test('repeated expert chat actions reuse a conversation without bookings', async () => {
  const state = structuredClone(INITIAL_STATE);
  const bookings = structuredClone(state.bookings);
  const first = submitForm(state,'expert-chat',{expertId:'expert-maya'});
  assert.deepEqual(first,submitForm(state,'expert-chat',{expertId:'expert-maya'}));
  const chat = state.chats.find((item)=>item.expertId === 'expert-maya');
  assert.equal(state.chats.filter((item)=>item.expertId === 'expert-maya').length,1);
  submitForm(state,'message',{chatId:chat.id,message:'My chilli leaves are yellow'});
  assert.equal(chat.conversation[0].text,'My chilli leaves are yellow');
  assert.deepEqual(state.bookings,bookings);
  assert.deepEqual(await requestChatReply(chat,()=>{throw new Error('Must not impersonate an expert');}),[]);
  assert.throws(()=>startExpertChat(state,'unknown'),/Expert not found/);
});
test('expert shortcut and direct chat profile render in all supported languages', () => {
  for (const [locale,label] of [['en','Find an expert'],['ms','Cari pakar'],['zh-Hans','寻找专家']]) {
    setLocale(locale);
    assert.ok(renderHome(structuredClone(INITIAL_STATE)).includes(label));
    assert.ok(renderExperts().includes(label));
    const detail = renderExperts('expert-maya');
    assert.match(detail,/data-form="expert-chat"/);
    assert.doesNotMatch(detail,/data-form="pilot-booking"/);
    assert.match(renderExperts(),/data-search="experts"/);
  }
  setLocale('en');
});

test('typed crop and help choices use entered values without altering saved selections',async()=>{
  const {resolveExpertPreferences}=await import('../src/expert-ui.mjs');
  const preferences={crop:'Other',topic:'Other',otherCrop:'  rice  ',otherTopic:'  pests  ',area:'Kedah',language:'Bahasa Melayu'};
  const resolved=resolveExpertPreferences(preferences);
  assert.equal(resolved.crop,'rice');
  assert.equal(resolved.topic,'pests');
  assert.equal(preferences.otherCrop,'  rice  ');
  assert.equal(matchExperts(resolved)[0].score,100);
  assert.equal(resolveExpertPreferences({...preferences,crop:'Coconut'}).crop,'Coconut');
  assert.ok(matchExperts({...resolved,crop:'Unknown crop'})[0].score <= 60);
});

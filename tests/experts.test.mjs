import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { EXPERTS, matchExperts, startExpertChat } from '../src/expert-data.mjs';
import { renderExpertMatch, renderExperts } from '../src/expert-ui.mjs';
import { renderHome } from '../src/home.mjs';
import { setLocale } from '../src/i18n.mjs';
import { renderWorkspace, requestChatReply } from '../src/workspace.mjs';

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

test('every listed crop has a matching specialist and every state has a drone specialist', () => {
  const crops = ['Rice','Oil palm','Rubber','Coconut','Durian','Banana','Pineapple','Guava','Vegetables','Chilli','Cocoa','Pepper'];
  const states = ['Kedah','Perlis','Penang','Perak','Selangor','Negeri Sembilan','Melaka','Johor','Pahang','Kelantan','Terengganu','Sabah','Sarawak'];
  for (const crop of crops) {
    assert.ok(EXPERTS.some((expert) => expert.crops.includes(crop) && expert.topics.some((topic) => topic !== 'Drone operations')), crop);
  }
  for (const area of states) {
    const matches = matchExperts({crop:'Rice',topic:'Drone operations',area,language:'Bahasa Melayu'});
    assert.equal(matches[0].score,100, area);
    assert.ok(matches[0].expert.topics.includes('Drone operations'), area);
  }
  assert.ok(EXPERTS.every((expert) => expert.isDemo === true));
  const page = renderExperts();
  assert.doesNotMatch(page,/Demo profiles/);
  assert.match(page,/Drone operations/);
  assert.match(page,/Negeri Sembilan/);
});

test('expert match is a single portrait surface with reviews and a direct chat action', () => {
  const html = renderExpertMatch(matchExperts({crop:'Rice',topic:'Pests',area:'Kedah',language:'English'})[0]);
  assert.equal((html.match(/<article/g) ?? []).length, 1);
  assert.match(html, /expert-result-card/);
  assert.match(html, /data-expert-result-close/);
  assert.match(html, /expert-rating/);
  assert.doesNotMatch(html, />Mock rating</);
  assert.match(html, /expert-bio/);
  assert.doesNotMatch(html, /<details/);
  assert.match(html, /data-form="expert-chat"/);
  assert.doesNotMatch(html, /pilot-catalog-card|task-sheet-heading|expert-match-reasons/);
});

test('expert chat keeps the composer without the demo notice', () => {
  const state = structuredClone(INITIAL_STATE);
  startExpertChat(state, 'expert-maya');
  const chat = state.chats.find((item) => item.expertId === 'expert-maya');
  const html = renderWorkspace(`/messages/${chat.id}`, state);
  assert.match(html, /chat-composer/);
  assert.doesNotMatch(html, /Demo chat|Messages stay on this device/);
});

test('view expert opens a detailed profile instead of another catalogue card', () => {
  const html = renderExperts('expert-maya');
  assert.match(html, /expert-detail/);
  assert.match(html, /What I can help with/);
  assert.match(html, /Languages/);
  assert.match(html, /expert-detail-action/);
  assert.match(html, /expert-bio/);
  assert.doesNotMatch(html, /pilot-catalog-card|pilot-portrait-card/);
});

test('expert bios are concise and ratings render five fractional stars with review counts', () => {
  setLocale('en');
  for (const expert of EXPERTS) {
    const html = renderExperts(expert.id);
    const bio = html.match(/class="expert-bio">([^<]+)</)[1];
    const wordCount = bio.trim().split(/\s+/).length;
    assert.ok(wordCount >= 20 && wordCount <= 30, `${expert.name}: ${wordCount} words`);
    assert.equal((html.match(/class="expert-star"/g) ?? []).length, 5);
    assert.match(html, /4\.[6-9] <span>\(\d+\)<\/span>/);
    assert.match(html, /--star-fill:[6-9]\d(?:\.\d+)?%/);
  }
});

test('expert match preserves location and every crop as separate glass pills', () => {
  const expert = EXPERTS.find((item) => item.crops.length > 5);
  assert.ok(expert);
  const html = renderExpertMatch({expert,score:80});
  const pills = html.match(/class="expert-glass-pills">([\s\S]*?)<\/div>/)[1];
  assert.equal((pills.match(/<span>/g) ?? []).length, expert.crops.length + 1);
  for (const label of [expert.area,...expert.crops]) assert.ok(pills.includes(`<span>${label}</span>`));
});

test('expert multiselect retains typed choices and scores partial coverage', async () => {
  const {resolveExpertPreferences} = await import('../src/expert-ui.mjs');
  const prefs = {crop:['Rice','Other'],topic:['Pests','Water'],area:['Kedah','Perak'],language:['English'],otherCrop:'Chilli',otherTopic:''};
  const resolved = resolveExpertPreferences(prefs);
  assert.deepEqual(resolved.crop,['Rice','Chilli']);
  assert.deepEqual(prefs.crop,['Rice','Other']);
  const azlan = matchExperts(resolved).find((match)=>match.expert.id === 'expert-azlan');
  assert.equal(azlan.score,70);
  assert.deepEqual(azlan.reasons,['Rice','Pests','Water','Kedah','English']);
});

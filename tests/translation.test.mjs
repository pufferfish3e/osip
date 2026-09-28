import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { translateTexts, translateAnalysis } from '../src/translation.mjs';
import { translateArticleBlocks } from '../src/article-reader.mjs';
import { createTranslationHandler, validateTranslationRequest } from '../server/translate.mjs';
import { createPlantPhotoController, renderPhotoState } from '../src/plant-photo.mjs';
import { setLocale } from '../src/i18n.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { validateChatRequest } from '../server/mock-chat.mjs';

afterEach(() => setLocale('en'));
const RESULT = { title: 'Leaf damage', summary: 'Look closer.', isPlant: true, observations: ['Holes'], nextSteps: ['Check leaves'], guideSlugs: [] };
const translated = (texts) => texts.map((text) => `Terjemahan ${text}`);

test('scheduler empty state is translated in both languages', () => {
  for (const locale of ['ms', 'zh-Hans']) {
    setLocale(locale);
    const html = renderWorkspace('/schedule', structuredClone(INITIAL_STATE));
    assert.doesNotMatch(html, /Add your land first|Create a land record/);
    assert.match(html, locale === 'ms' ? /Tambah tanah anda dahulu/ : /先添加土地/);
  }
});

test('translation batches long copy, preserves whitespace and numbers, and caches by locale', async () => {
  const requests = [];
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/translate');
    const data = JSON.parse(options.body); requests.push(data);
    assert.ok(data.texts.length <= 40);
    assert.ok(data.texts.join('').length <= 8000);
    return Response.json({ ...data, texts: translated(data.texts) });
  };
  const input = ['  Bounded translation example  \n', '120', ...Array.from({ length: 45 }, (_, i) => `Long ${i} ${'word '.repeat(700)}`)];
  const result = await translateTexts(input, 'ms', undefined, fetcher);
  assert.equal(result[0], '  Terjemahan Bounded translation example  \n');
  assert.equal(result[1], '120'); assert.equal(result.length, input.length);
  assert.ok(requests.length > 1);
  const count = requests.length;
  await translateTexts([input[0]], 'ms', undefined, fetcher);
  assert.equal(requests.length, count);
  await translateTexts([input[0]], 'zh-Hans', undefined, fetcher);
  assert.equal(requests.length, count + 1);
});

test('failed, malformed and aborted translations are not accepted', async () => {
  await assert.rejects(translateTexts(['Unique failed text'], 'ms', undefined, async () => Response.json({ texts: [], locale: 'ms' })), /unavailable/);
  await assert.rejects(translateTexts(['Unique aborted text'], 'ms', AbortSignal.abort(), async () => { throw new Error('must not fetch'); }), { name: 'AbortError' });
  await assert.rejects(translateTexts(['Text'], 'fr'), /unavailable/);
});

test('AI translation retains citation markers, offsets, URLs and image credits', async () => {
  const source = { ...RESULT, possibleCauses: ['Could be caterpillars.'], confirmationChecks: ['Inspect leaf undersides.'], research: { text: 'Read [1] now.', citations: [{ start: 5, end: 8, title: 'Source', url: 'https://example.org/article' }] }, referenceImages: [{ title: 'Aphid', url: 'https://example.org/aphid.jpg', credit: 'Photographer' }] };
  const copy = await translateAnalysis(source, 'ms', undefined, translated);
  const citation = copy.research.citations[0];
  assert.equal(copy.research.text.slice(citation.start, citation.end), '[1]');
  assert.equal(citation.url, source.research.citations[0].url);
  assert.equal(copy.referenceImages[0].credit, 'Photographer');
  assert.equal(source.title, RESULT.title);
  assert.match(copy.nextSteps[0], /Terjemahan/);
  assert.match(copy.possibleCauses[0], /Terjemahan/);
  assert.match(copy.confirmationChecks[0], /Terjemahan/);
});

test('article translation preserves tables, equations, images and the original', async () => {
  const blocks = [{ type: 'heading', text: 'Title' }, { type: 'list', items: ['Advice'] }, { type: 'table', rows: [[{ text: 'Crop', colspan: 2 }, '120']] }, { type: 'equation', text: 'x = y' }, { type: 'figure', src: '/content/a.jpg', caption: 'Figure' }];
  const result = await translateArticleBlocks(blocks, 'ms', undefined, translated);
  assert.equal(result[0].text, 'Terjemahan Title');
  assert.equal(result[1].items[0], 'Terjemahan Advice');
  assert.equal(result[2].rows[0][0].colspan, 2);
  assert.equal(result[2].rows[0][1], '120');
  assert.deepEqual(result[3], blocks[3]);
  assert.equal(result[4].src, blocks[4].src);
  assert.equal(blocks[0].text, 'Title');
});

test('photo translation cannot overwrite a newer language', async () => {
  let finish, signal;
  const photo = createPlantPhotoController({ onChange() {}, prepare: async () => 'image', request: async () => RESULT, translate: async (_, locale, abort) => { signal = abort; return new Promise((resolve) => { finish = resolve; }); } });
  await photo.choose({}); await photo.analyze();
  setLocale('ms'); const pending = photo.localize();
  assert.equal(photo.getState().status, 'translating');
  setLocale('en'); await photo.localize(); assert.equal(signal.aborted, true);
  finish({ ...RESULT, title: 'Malay' }); await pending;
  assert.equal(photo.getState().resultLocale, 'en');
  assert.equal(photo.getState().result.title, RESULT.title);
  setLocale('ms');
  assert.doesNotMatch(renderPhotoState(photo.getState()), /Leaf damage/);
  photo.reset();
});

test('existing and mid-analysis photo results follow the selected language, with cached originals', async () => {
  let finish, count = 0;
  const photo = createPlantPhotoController({ onChange() {}, prepare: async () => 'image', request: () => new Promise((resolve) => { finish = resolve; }), translate: async (result) => { count++; return { ...result, title: 'Daun rosak' }; } });
  await photo.choose({}); const analyzing = photo.analyze();
  setLocale('ms'); finish(RESULT); await analyzing;
  assert.equal(photo.getState().resultLocale, 'ms');
  setLocale('en'); await photo.localize(); assert.equal(photo.getState().result.title, RESULT.title);
  setLocale('ms'); await photo.localize(); assert.equal(count, 1);
  photo.reset();
});

async function callHandler(handler, value, origin = 'http://localhost:4173') {
  const socket = new Socket(); Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
  const request = new IncomingMessage(socket); request.method = 'POST';
  request.headers = { host: 'localhost:4173', origin, 'content-type': 'application/json' };
  let status, body;
  const response = Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false, setHeader() {}, writeHead(code) { status = code; }, end(text) { body = JSON.parse(text); this.writableEnded = true; } });
  request.push(Buffer.from(JSON.stringify(value))); request.push(null);
  await handler(request, response); socket.destroy(); return { status, body };
}

test('translation endpoint validates locale and size and rejects foreign origins', async () => {
  for (const value of [{ locale: '__proto__', texts: ['a'] }, { locale: 'ms', texts: ['x'.repeat(8001)] }, { locale: 'ms', texts: [] }, { locale: 'ms', texts: [null] }]) assert.throws(() => validateTranslationRequest(value));
  let calls = 0;
  const handler = createTranslationHandler({ apiKey: 'test', fetchImpl: async (_, options) => {
    calls++; const input = JSON.parse(options.body);
    assert.match(input.instructions, /Bahasa Melayu/); assert.equal(input.store, false);
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ texts: ['Daun'] }) }] }] });
  } });
  assert.equal((await callHandler(handler, { locale: 'ms', texts: ['Leaf'] }, 'https://evil.example')).status, 403);
  assert.equal(calls, 0);
  const result = await callHandler(handler, { locale: 'ms', texts: ['Leaf'] });
  assert.equal(result.status, 200); assert.deepEqual(result.body, { locale: 'ms', texts: ['Daun'] });
  const broken = createTranslationHandler({ apiKey: 'test', fetchImpl: async () => Response.json({ status: 'incomplete' }) });
  assert.equal((await callHandler(broken, { locale: 'ms', texts: ['Leaf'] })).status, 502);
});

test('new chat replies use the selected app language', () => {
  assert.equal(validateChatRequest({ name: 'Farmer', messages: [{ sender: 'you', text: 'Hi' }], locale: 'ms' }).language, 'Bahasa Melayu');
  assert.equal(validateChatRequest({ name: 'Farmer', messages: [{ sender: 'you', text: 'Hi' }], locale: '__proto__' }).language, 'English');
});

test('photo translation failure keeps the source and allows a successful retry', async () => {
  let attempts = 0;
  const photo = createPlantPhotoController({ onChange() {}, prepare: async () => 'image', request: async () => RESULT, translate: async (result) => {
    if (++attempts === 1) throw new Error('offline');
    return { ...result, title: 'Daun rosak' };
  } });
  await photo.choose({}); await photo.analyze(); setLocale('ms');
  await photo.localize(); assert.equal(photo.getState().status, 'error');
  assert.equal(photo.getState().result.title, RESULT.title);
  assert.doesNotMatch(renderPhotoState(photo.getState()), /Leaf damage/);
  await photo.localize(); assert.equal(photo.getState().resultLocale, 'ms');
  assert.equal(photo.getState().result.title, 'Daun rosak'); photo.reset();
});

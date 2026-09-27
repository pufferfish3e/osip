import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'node:test';

import { createPlantSearchHandler, parseSearchResult } from '../server/plant-search.mjs';
import { renderPlantResults } from '../src/plant-help.mjs';
import { renderPlantWebResult, searchPlantWeb, validateWebResult } from '../src/plant-web.mjs';

const RESULT = { text: 'Check soil moisture. [source]', citations: [{ url: 'https://extension.example.org/plants', title: 'Plant care', start: 21, end: 29 }] };
const providerPayload = () => ({ status: 'completed', output: [{ type: 'web_search_call', status: 'completed' }, { type: 'message', content: [{ type: 'output_text', text: RESULT.text, annotations: RESULT.citations.map(({ start, end, ...source }) => ({ ...source, type: 'url_citation', start_index: start, end_index: end })) }] }] });
const makeHandler = (options = {}) => createPlantSearchHandler({ apiKey: 'mock-key-for-tests', trustedOrigin: '', fetchImpl: async () => Response.json(providerPayload()), ...options });
const requestSearch = async (handler, overrides = {}) => {
  const socket = new Socket(); Object.defineProperty(socket, 'remoteAddress', { value: '127.0.0.1' });
  const request = new IncomingMessage(socket);
  request.method = overrides.method ?? 'POST';
  request.headers = { host: 'localhost:4173', origin: 'http://localhost:4173', 'content-type': 'application/json', ...overrides.headers };
  const result = { status: 0, body: null };
  const response = Object.assign(new EventEmitter(), {
    writableEnded: false, destroyed: false, setHeader: () => {},
    writeHead: (status) => { result.status = status; },
    end: (body) => { result.body = JSON.parse(body); response.writableEnded = true; response.emit('close'); },
  });
  request.push(Buffer.from(JSON.stringify(overrides.body ?? { query: 'durian leaf bronze patches', locale: 'en' }))); request.push(null);
  await handler(request, response); socket.destroy(); return result;
};

test('web fallback forces Responses web search and returns provider citations', async () => {
  let sent;
  const handler = makeHandler({ fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/responses'); sent = JSON.parse(options.body);
    return Response.json(providerPayload());
  } });
  const result = await requestSearch(handler);
  assert.equal(result.status, 200); assert.deepEqual(result.body, RESULT);
  assert.deepEqual(sent.tools, [{ type: 'web_search' }]); assert.equal(sent.tool_choice, 'required'); assert.equal(sent.store, false);
  assert.match(sent.instructions, /plant and crop problems only/);
});

test('web search rejects untrusted, invalid and unconfigured requests before contacting the provider', async () => {
  let calls = 0;
  const handler = makeHandler({ fetchImpl: async () => { calls += 1; return Response.json(providerPayload()); } });
  for (const [override, status] of [[{ method: 'GET' }, 405], [{ headers: { origin: 'https://other.example' } }, 403], [{ body: { query: '' } }, 400], [{ body: { query: 'x'.repeat(161) } }, 400], [{ body: { query: 'plant', locale: 'fr' } }, 400]]) {
    assert.equal((await requestSearch(handler, override)).status, status);
  }
  assert.equal(calls, 0);
  assert.equal((await requestSearch(makeHandler({ apiKey: '' }))).status, 503);
});

test('uncited answers, unsafe URLs and malformed citation ranges cannot render as web research', () => {
  for (const result of [{ ...RESULT, citations: [] }, { ...RESULT, citations: [{ ...RESULT.citations[0], url: 'javascript:alert(1)' }] }, { ...RESULT, citations: [{ ...RESULT.citations[0], end: 999 }] }]) assert.throws(() => validateWebResult(result));
  const payload = providerPayload(); payload.output.shift(); assert.throws(() => parseSearchResult(payload));
});

test('web results escape source titles and response text while keeping inline citations clickable', () => {
  const result = { ...RESULT, text: `${RESULT.text}<script>bad()</script>`, citations: [{ ...RESULT.citations[0], title: '<img onerror=bad()>' }] };
  const html = renderPlantWebResult(result);
  assert.doesNotMatch(html, /<script>|<img onerror/);
  assert.match(html, /plant-web-citation/); assert.match(html, /rel="noopener noreferrer"/);
  assert.match(html, /plant-guide-row plant-web-source/);
});

test('fallback only appears for a nonempty unmatched query and client preserves the cancellation signal', async () => {
  assert.match(renderPlantResults('zzzzunknownplant'), /data-plant-web-search/);
  assert.doesNotMatch(renderPlantResults('aphids'), /data-plant-web-search/);
  assert.doesNotMatch(renderPlantResults(''), /data-plant-web-search/);
  const controller = new AbortController();
  await searchPlantWeb('plant', 'ms', controller.signal, async (url, options) => {
    assert.equal(options.signal, controller.signal); assert.equal(url, '/api/plant-search');
    assert.deepEqual(JSON.parse(options.body), { query: 'plant', locale: 'ms' });
    return Response.json(RESULT);
  });
});

test('provider failures and request limits surface an error instead of an invented answer', async () => {
  assert.equal((await requestSearch(makeHandler({ fetchImpl: async () => new Response('', { status: 500 }) }))).status, 502);
  const handler = makeHandler({ now: () => 1000 });
  for (let index = 0; index < 6; index += 1) assert.equal((await requestSearch(handler)).status, 200);
  assert.equal((await requestSearch(handler)).status, 429);
});

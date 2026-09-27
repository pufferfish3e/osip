import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { IncomingMessage } from 'node:http';
import { Socket } from 'node:net';
import { test } from 'node:test';
import { estimateSpray, validateSprayConfig, renderSprayCalculator, SPRAY_SETUPS } from '../src/spray-calculator.mjs';
import { createSprayConfigHandler, parseSprayResponse } from '../server/spray-config.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
const CONFIG = {volume:180,tank:16,dose:2,basis:'ml-l'};
const payload = () => ({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(CONFIG)}]}]});
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
  request.push(Buffer.from(JSON.stringify(overrides.body ?? { description: '16 L tank, 180 L/ha and label rate 2 mL/L' }))); request.push(null);
  await handler(request, response); socket.destroy(); return result;
};


test('mapped area scales mixture, concentration-based product and partial tanks', () => {
  assert.deepEqual(estimateSpray(2, CONFIG), {mixture:360,product:720,unit:'mL',tanks:23,lastTank:8});
  assert.equal(estimateSpray(2,{...CONFIG,dose:500,basis:'g-ha'}).product,1000);
  assert.equal(estimateSpray(2,{...CONFIG,dose:null,basis:null}).product,null);
});
test('invalid and ambiguous configurations never produce quantities', () => {
  for (const volume of [0,-1,NaN,Infinity,'15']) assert.throws(() => estimateSpray(1,{...CONFIG,volume}));
  assert.throws(() => estimateSpray(0,CONFIG));
  assert.throws(() => estimateSpray(2,{...CONFIG,basis:null}));
  assert.throws(() => validateSprayConfig({...CONFIG,basis:'percent'}));
  assert.throws(() => parseSprayResponse({status:'incomplete'}));
});
test('three source-linked setups and both parcel and field choices are available', () => {
  assert.equal(SPRAY_SETUPS.length,3);
  const html = renderSprayCalculator(INITIAL_STATE);
  assert.match(html,/data-spray-ai/); assert.match(html,/data-spray-step/);
  assert.ok(html.includes(INITIAL_STATE.farms[0].plots[0].name));
});
test('AI uses structured extraction without inventing doses and guards paid endpoint', async () => {
  let sent;
  const handler = createSprayConfigHandler({apiKey:'test',trustedOrigin:'',fetchImpl:async (_url,options) => {sent=JSON.parse(options.body);return Response.json(payload());}});
  const result = await requestSearch(handler);
  assert.equal(result.status,200); assert.deepEqual(result.body,CONFIG);
  assert.equal(sent.store,false); assert.equal(sent.text.format.strict,true);
  assert.match(sent.instructions,/Never recommend or infer a pesticide dose/);
  assert.equal((await requestSearch(handler,{headers:{origin:'https://evil.example'}})).status,403);
  assert.equal((await requestSearch(handler,{body:{description:''}})).status,400);
  const unavailable = createSprayConfigHandler({apiKey:'',trustedOrigin:''});
  assert.equal((await requestSearch(unavailable)).status,503);
});

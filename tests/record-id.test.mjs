import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {test} from 'node:test';
import DEMO from '../data/demo.json' with {type:'json'};
import {createRecordId} from '../src/record-id.mjs';
import {saveLandGrid} from '../src/land-grid.mjs';
import {applyAction,submitForm} from '../src/actions.mjs';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test('native UUID uses its crypto receiver and preserves the full ID',()=>{
  const source = {randomUUID(){ assert.equal(this,source); return 'native-uuid'; }};
  assert.equal(createRecordId(source),'native-uuid');
});

test('HTTP-compatible crypto fallback creates valid distinct version-4 UUIDs',()=>{
  const source = {getRandomValues:(bytes)=>webcrypto.getRandomValues(bytes)};
  const ids = Array.from({length:1000},()=>createRecordId(source));
  assert.ok(ids.every((id)=>UUID_V4.test(id)));
  assert.equal(new Set(ids).size,ids.length);
  assert.equal(createRecordId({getRandomValues:(bytes)=>bytes.fill(255)}),'ffffffff-ffff-4fff-bfff-ffffffffffff');
});

test('local records still get distinct IDs without any crypto API',()=>{
  const ids = Array.from({length:1000},()=>createRecordId(null));
  assert.ok(ids.every((id)=>id.startsWith('local-')));
  assert.equal(new Set(ids).size,ids.length);
});

test('unexpected crypto failures remain visible',()=>{
  assert.throws(()=>createRecordId({randomUUID:()=>{throw new Error('crypto failure');}}),/crypto failure/);
});

test('task creation and repeat completion work without native randomUUID',()=>{
  const original = Object.getOwnPropertyDescriptor(globalThis,'crypto');
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:(bytes)=>webcrypto.getRandomValues(bytes)}});
  try {
    const state = structuredClone(DEMO);
    submitForm(state,'task',{farmId:state.farms[0].id,plotId:state.farms[0].plots[0].id,title:'Check crops',dueDate:'2030-01-01',time:'08:00',category:'General',repeat:'daily',endKind:'date',endDate:'2030-01-02'});
    assert.match(state.tasks.at(-1).id,/^task-[0-9a-f]{8}-/);
    assert.match(state.tasks.at(-1).scheduleId,/^schedule-[0-9a-f]{8}-/);
    applyAction(state,'toggle-task',state.tasks.at(-1).id);
    assert.equal(state.tasks.at(-1).dueDate,'2030-01-02');
    const landId = saveLandGrid(state,{name:'HTTP land',location:'Perak',boundary:[[4,101],[4,101.004],[4.002,101.003],[4.003,101]],columns:1,rows:1,crops:['Rice']});
    assert.match(landId,/^farm-[0-9a-f]{8}-/);
    assert.match(state.farms.at(-1).plots[0].id,/^plot-[0-9a-f]{8}-/);
  } finally {
    if (original) Object.defineProperty(globalThis,'crypto',original);
    else Reflect.deleteProperty(globalThis,'crypto');
  }
});

test('new helper is served and cached for offline use',async()=>{
  const sources = await Promise.all(['../server.mjs','../sw.js'].map((path)=>readFile(new URL(path,import.meta.url),'utf8')));
  for (const source of sources) assert.ok(source.includes("'/src/record-id.mjs'"));
});

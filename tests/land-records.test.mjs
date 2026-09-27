import assert from 'node:assert/strict';
import { test } from 'node:test';
import { editLandPoint, saveLandRecord, deleteLandRecord } from '../src/land-records.mjs';
import { saveLandGrid } from '../src/land-grid.mjs';
import { createStore } from '../src/store.mjs';
const BOX = [[4,101],[4,101.002],[4.002,101.002],[4.002,101]];
const storage = () => { const records = new Map(); return { getItem:(key)=>records.get(key)??null,setItem:(key,value)=>records.set(key,value) }; };
const draft = { name:'North land', location:'Perak', boundary:BOX };
test('point add, move and arbitrary deletion preserve order and leave the original unchanged', () => {
  const added = editLandPoint(BOX,'add',0,[4,101.001]);
  assert.equal(added.length,5); assert.deepEqual(added[1],[4,101.001]);
  const moved = editLandPoint(added,'move',1,[3.9999,101.001]);
  assert.deepEqual(moved[1],[3.9999,101.001]);
  assert.deepEqual(editLandPoint(moved,'remove',1),BOX);
  assert.deepEqual(BOX[0],[4,101]);
  assert.throws(()=>editLandPoint(BOX,'move',-1,[4,101]));
  assert.throws(()=>editLandPoint(BOX,'move',0,[NaN,101]));
});
test('land can be created without fields, edited and deleted across reloads', () => {
  const disk=storage(); const store=createStore(disk); let id;
  store.update(state=>{id=saveLandRecord(state,draft);});
  assert.equal(createStore(disk).getState().farms.find(land=>land.id===id).plots.length,0);
  store.update(state=>saveLandRecord(state,{...draft,id,name:'Renamed',boundary:[...BOX.slice(0,1),[4,101.001],...BOX.slice(1)]}));
  assert.equal(createStore(disk).getState().farms.find(land=>land.id===id).boundary.length,5);
  store.update(state=>deleteLandRecord(state,id));
  assert.equal(createStore(disk).getState().farms.some(land=>land.id===id),false);
});
test('invalid boundaries and failed writes leave saved land intact', () => {
  const disk=storage(); const store=createStore(disk); let id;
  store.update(state=>{id=saveLandRecord(state,draft);}); const before=store.getState();
  assert.throws(()=>store.update(state=>saveLandRecord(state,{...draft,id,boundary:BOX.slice(0,2)})));
  assert.throws(()=>store.update(state=>saveLandRecord(state,{...draft,id,boundary:[BOX[0],BOX[2],BOX[1],BOX[3]]})));
  disk.setItem=()=>{throw new Error('Disk full');};
  assert.throws(()=>store.update(state=>deleteLandRecord(state,id)));
  assert.deepEqual(store.getState(),before);
});
test('splitting saved land updates that parcel without creating another or overwriting fields', () => {
  const store=createStore(storage()); let id;
  store.update(state=>{id=saveLandRecord(state,draft);}); const count=store.getState().farms.length;
  const split={...draft,id,columns:6,rows:1,crops:Array(6).fill('Rice')};
  store.update(state=>saveLandGrid(state,split));
  assert.equal(store.getState().farms.length,count); assert.equal(store.getState().farms.find(land=>land.id===id).plots.length,6);
  assert.throws(()=>store.update(state=>saveLandGrid(state,split)));
  assert.throws(()=>store.update(state=>saveLandRecord(state,{...draft,id,boundary:BOX.map(([lat,lng])=>[lat+0.1,lng])})));
});
test('deletion removes parcel tasks and their reminders but blocks linked booking records', () => {
  const store=createStore(storage()); let id;
  store.update(state=>{id=saveLandRecord(state,draft);state.tasks.push({id:'land-task',farmId:id,title:'Water',dueDate:'2026-10-01',time:'08:00',category:'General',done:false,reminder:true});state.notifications.push({id:'reminder-land-task-2026-10-01-08:00',title:'Water',body:'Water',date:'2026-10-01',read:false});});
  const state=store.getState(); state.bookings.push({farmId:id}); assert.throws(()=>deleteLandRecord(state,id),/booking/);
  store.update(state=>deleteLandRecord(state,id));
  assert.equal(store.getState().tasks.some(task=>task.farmId===id),false); assert.equal(store.getState().notifications.some(note=>note.id.startsWith('reminder-land-task-')),false);
});

test('blank land names get unique defaults that persist through field setup and reload', () => {
  const adapter = storage();
  const store = createStore(adapter);
  let first;
  let second;
  store.update((state) => { first = saveLandRecord(state, { ...draft, name: '   ' }); });
  store.update((state) => { second = saveLandRecord(state, { ...draft, name: '' }); });
  assert.equal(store.getState().farms.find((land) => land.id === first).name, 'Land 1');
  assert.equal(store.getState().farms.find((land) => land.id === second).name, 'Land 2');
  store.update((state) => saveLandGrid(state, { ...draft, id: first, name: '', columns: 1, rows: 1, crops: ['Rice'] }));
  assert.equal(createStore(adapter).getState().farms.find((land) => land.id === first).name, 'Land 1');
});

test('generated names avoid custom names regardless of case and direct grid creation supports blanks', () => {
  const store = createStore(storage());
  store.update((state) => saveLandRecord(state, { ...draft, name: ' land 1 ' }));
  let id;
  store.update((state) => { id = saveLandGrid(state, { ...draft, name: '', columns: 1, rows: 1, crops: ['Rice'] }); });
  assert.equal(store.getState().farms.find((land) => land.id === id).name, 'Land 2');
  store.update((state) => saveLandRecord(state, { ...draft, id, name: 'West land' }));
  assert.equal(store.getState().farms.find((land) => land.id === id).name, 'West land');
});

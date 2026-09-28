import assert from 'node:assert/strict';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with {type:'json'};
import { applyAction, submitForm } from '../src/actions.mjs';
import { createStore } from '../src/store.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const FIELDS = {farmId:DEMO.farms[0].id,title:'Water crops',dueDate:'2030-01-01',time:'08:00',category:'Water',repeat:'custom',repeatUnit:'days',repeatInterval:'1',endKind:'harvest',endDate:'2030-01-02'};

test('end date includes its final day and never creates an occurrence after it', () => {
  const state = structuredClone(DEMO);
  submitForm(state,'task',FIELDS);
  const first = state.tasks.at(-1);
  applyAction(state,'toggle-task',first.id);
  const last = state.tasks.at(-1);
  assert.equal(last.dueDate,'2030-01-02');
  assert.equal(last.scheduleId,first.scheduleId);
  assert.equal(last.endKind,'harvest');
  const count = state.tasks.length;
  applyAction(state,'toggle-task',last.id);
  assert.equal(state.tasks.length,count);
});

test('invalid end dates are rejected before tasks are written', () => {
  for (const endDate of ['', 'invalid', '2029-12-31']) {
    const state = structuredClone(DEMO);
    const count = state.tasks.length;
    assert.throws(() => submitForm(state,'task',{...FIELDS,endDate}));
    assert.equal(state.tasks.length,count);
  }
});

test('same-day minute repeats stop when next occurrence crosses the end date', () => {
  const state = structuredClone(DEMO);
  submitForm(state,'task',{...FIELDS,time:'23:45',repeatUnit:'minutes',repeatInterval:'30',endDate:FIELDS.dueDate});
  const first = state.tasks.at(-1);
  const count = state.tasks.length;
  applyAction(state,'toggle-task',first.id);
  assert.equal(state.tasks.length,count);
});

test('multi-field schedules share a tree while independent schedules stay separate', () => {
  const state = structuredClone(DEMO);
  state.tasks = [];
  state.farms = [state.farms[0]];
  state.farms[0].plots = [{id:'field-a',name:'Field 1',crop:'Rice',area:1},{id:'field-b',name:'Field 2',crop:'Rice',area:1}];
  const plots = state.farms[0].plots;
  submitForm(state,'task',{...FIELDS,plotIds:plots.slice(0,2).map((plot) => plot.id)});
  assert.equal(state.tasks[0].scheduleId,state.tasks[1].scheduleId);
  submitForm(state,'task',FIELDS);
  const html = renderWorkspace('/schedule',state);
  assert.equal((html.match(/class="notification-task-stack"/g) ?? []).length,2);
  assert.match(html,/Until harvest/);
  assert.match(html,/When should it end\?/);
  assert.doesNotMatch(html,/schedule-tree-fields"><div class="card/);
});

test('end condition persists in local storage', () => {
  const memory = new Map();
  const adapter = {getItem:(key) => memory.get(key) ?? null,setItem:(key,value) => memory.set(key,value)};
  const store = createStore(adapter,DEMO,'demo');
  store.update((state) => submitForm(state,'task',FIELDS));
  const restored = createStore(adapter,DEMO,'demo').getState().tasks.at(-1);
  assert.equal(restored.endKind,'harvest');
  assert.equal(restored.endDate,FIELDS.endDate);
});

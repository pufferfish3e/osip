import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('Next on your land includes newly created tasks beyond four and sorts by schedule', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land-test',name:'Test land',crop:'Rice',location:'Kedah',area:1,plots:[]}];
  state.tasks = Array.from({length:5},(_,index)=>({id:`old-${index}`,farmId:'land-test',plotId:'',title:`Existing ${index}`,dueDate:'2030-12-20',time:'12:00',category:'Water',done:false,reminder:false}));
  submitForm(state,'task',{farmId:'land-test',plotIds:[''],title:'New early task',dueDate:'2030-12-01',time:'09:00',category:'Water'});
  submitForm(state,'task',{farmId:'land-test',plotIds:[''],title:'New later task',dueDate:'2030-12-21',time:'09:00',category:'Water'});
  state.tasks.push({...state.tasks[0],id:'completed',title:'Finished task',done:true});
  state.tasks.push({...state.tasks[0],id:'other',farmId:'another-land',title:'Other land task'});
  const html = renderWorkspace('/farm/land-test',state);
  const pending = html.split('Next on your land')[1].split('<h2>Completed')[0];
  assert.ok(pending.includes('New early task'));
  assert.ok(pending.includes('New later task'));
  assert.ok(pending.indexOf('New early task') < pending.indexOf('Existing 0'));
  assert.ok(pending.indexOf('Existing 4') < pending.indexOf('New later task'));
  assert.ok(!pending.includes('Other land task'));
  assert.ok(!pending.includes('Finished task'));
});

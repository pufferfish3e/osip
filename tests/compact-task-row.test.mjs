import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';
import { applyAction } from '../src/actions.mjs';

test('task rows show title, field and deletion without scheduling metadata', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land',name:'Land',crop:'Rice',location:'Perak',plots:[{id:'field',name:'Field 2',crop:'Rice'}]}];
  state.tasks = [{id:'task',farmId:'land',plotId:'field',title:'Inspect crops',dueDate:'2030-01-01',time:'08:00',category:'General',done:false,reminder:true}];
  state.notifications = [];
  const html = renderWorkspace('/farm/land/schedule',state);
  assert.match(html,/Inspect crops/);
  assert.match(html,/class="row-subtitle">Field 2<\/span>/);
  assert.match(html,/data-action="delete-task" data-id="task"/);
  assert.doesNotMatch(html.split('<div data-agenda>')[1].split('<p class="muted" data-agenda-empty')[0],/08:00|Reminder enabled/);
  applyAction(state,'delete-task','task');
  assert.equal(state.tasks.length,0);
});


test('land fields render as square cards in a horizontal scrolling container', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land',name:'Land',area:5,crop:'Rice',location:'Perak',plots:Array.from({length:5},(_,index)=>({id:`field-${index}`,name:`Field ${index+1}`,crop:'Rice',area:1,plantedAt:''}))}];
  state.tasks=[];
  const html = renderWorkspace('/farm/land',state);
  assert.match(html,/class="field-card-scroll"/);
  assert.equal((html.match(/class="field-summary-card"/g) ?? []).length,5);
  assert.match(html,/href="\/farm\/land\/plots\/field-4"/);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { submitForm } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { completeFieldSchedule, renderFieldSchedules } from '../src/field-care.mjs';
import { fieldTaskUrgency, fieldTaskSegments } from '../src/land-map.mjs';

const NOW = new Date('2030-06-20T12:00:00');
const TASK = {id:'task-1',farmId:'land-1',plotId:'',title:'Check irrigation',category:'Water',dueDate:'2030-06-20',time:'11:00',done:false,reminder:false};

test('whole-land tasks update every field marker and task sheet', () => {
  for (const plotId of ['field-1','field-2']) {
    assert.equal(fieldTaskUrgency([TASK],'land-1',plotId,NOW).pending,1);
    assert.equal(fieldTaskSegments([TASK],'land-1',plotId,NOW)[0].state,'overdue');
    assert.match(renderFieldSchedules([TASK],'land-1',plotId,NOW),/Check irrigation/);
  }
  assert.equal(fieldTaskUrgency([TASK],'other-land','field-1',NOW).pending,0);
  assert.equal(fieldTaskUrgency([{...TASK,plotId:'field-1'}],'land-1','field-2',NOW).pending,0);
});

test('creating a whole-land task is immediately reflected in map status', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land-1',name:'Land 1',plots:[{id:'field-1'}]}];
  state.tasks = [];
  submitForm(state,'task',{farmId:'land-1',plotIds:[''],title:'Inspect crops',category:'Water',dueDate:'2030-06-20',time:'11:00'});
  assert.equal(state.tasks.length,1);
  assert.equal(fieldTaskUrgency(state.tasks,'land-1','field-1',NOW).pending,1);
  assert.match(renderFieldSchedules(state.tasks,'land-1','field-1',NOW),/Inspect crops/);
});

test('completing whole-land work from the map leaves other fields pending', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{id:'land-1',plots:[{id:'field-1'},{id:'field-2'}]}];
  state.tasks = [{...TASK,dueDate:'2000-01-01'}];
  completeFieldSchedule(state,'land-1','field-1',TASK.id);
  assert.equal(state.tasks.filter((task)=>task.done).length,1);
  assert.equal(fieldTaskUrgency(state.tasks,'land-1','field-1').urgency,'complete');
  assert.equal(fieldTaskUrgency(state.tasks,'land-1','field-2').urgency,'overdue');
  completeFieldSchedule(state,'land-1','field-2',TASK.id);
  assert.equal(state.tasks.every((task)=>task.done),true);
});

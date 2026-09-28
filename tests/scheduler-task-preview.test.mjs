import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('scheduler groups pending and completed task previews by land', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id:'land-a', name:'Land A', location:'Perak', crop:'Rice', plots:[] }, { id:'land-b', name:'Land B', location:'Perak', crop:'Rice', plots:[] }];
  state.tasks = [
    { id:'pending', farmId:'land-a', title:'Spray <field>', dueDate:'2030-01-01', time:'08:00', done:false },
    { id:'done', farmId:'land-a', title:'Fertilize field', dueDate:'2030-01-01', time:'08:00', done:true },
    { id:'other', farmId:'land-b', title:'Water plants', dueDate:'2030-01-01', time:'08:00', done:false },
  ];
  const html = renderWorkspace('/schedule', state);
  assert.match(html, /Spray &lt;field&gt;[^]*0 of 1 completed/);
  assert.match(html, /Fertilize field[^]*1 of 1 completed/);
  assert.equal((html.match(/role="progressbar"/g) ?? []).length, 3);
  assert.match(html, /class="notification-task-stack"/);
  assert.doesNotMatch(html, /class="scheduler-task"/);
  assert.match(html, /href="\/farm\/land-a\/tasks\/done"/);
  const sections = html.split('class="scheduler-land"');
  assert.match(sections[1], /2 tasks/);
  assert.match(sections[2], /1 task/);
  assert.doesNotMatch(html, /tasks to do/);
  assert.doesNotMatch(sections[1], /Water plants/);
  assert.match(sections[2], /Water plants/);
});


test('single-land scheduler retains notification-style task rows', () => {
  const state = structuredClone(INITIAL_STATE);
  state.farms = [{ id:'land-a', name:'Land A', location:'Perak', crop:'Rice', plots:[] }];
  state.tasks = [
    { id:'pending', farmId:'land-a', title:'Water crop', dueDate:'2030-01-01', time:'08:00', category:'Water', done:false },
    { id:'done', farmId:'land-a', title:'Inspect crop', dueDate:'2030-01-01', time:'09:00', category:'General', done:true },
  ];
  const html = renderWorkspace('/schedule', state);
  assert.match(html, /Water crop[^]*0 of 1 completed/);
  assert.match(html, /Inspect crop[^]*1 of 1 completed/);
});

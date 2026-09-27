import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { INITIAL_STATE } from '../src/data.mjs';
import { renderDiscover, searchServices } from '../src/discover.mjs';
import { renderHome } from '../src/home.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const LAND = { id:'land-a', name:'North land', location:'Perak', crop:'Rice', area:2, unit:'ha', plantedAt:'', plots:[{id:'field-a',name:'Rice field',crop:'Rice',area:2,plantedAt:''}], isDemo:false };
const stateWith = (farms) => ({ ...structuredClone(INITIAL_STATE), farms, tasks:[] });

test('shop is hidden from home, services and service search', () => {
  const state = stateWith([LAND]);
  const html = renderHome(state) + renderDiscover('/services', state);
  assert.doesNotMatch(html, /href="\/shop|href="\/orders|Services &amp; shop/);
  assert.doesNotMatch(html, /href="\/schedule"/);
  assert.equal(searchServices('drone').some((item) => item.kind === 'shop'), false);
});

test('scheduler opens one land directly, offers a land choice, and handles no land', () => {
  assert.match(renderWorkspace('/schedule',stateWith([LAND])), /data-schedule="land-a"/);
  const state = stateWith([LAND,{...LAND,id:'land-b',name:'South land'}]);
  state.tasks = [{id:'task',farmId:'land-b',title:'Water crops',category:'Water',dueDate:'2030-01-01',time:'08:00',done:false}];
  const html = renderWorkspace('/schedule', state);
  assert.match(html, /href="\/farm\/land-a\/schedule"/);
  assert.match(html, /href="\/farm\/land-b\/schedule"/);
  assert.match(html, /1 task/);
  assert.match(renderWorkspace('/schedule',stateWith([])), /href="\/farm\/new"/);
});

test('main navigation and offline routes expose scheduler while retaining shop code', () => {
  const shell = readFileSync(new URL('../src/shell.mjs',import.meta.url),'utf8');
  assert.match(shell, /\['\/schedule', 'calendar', 'Scheduler'\]/);
  for (const path of ['../server.mjs','../sw.js']) assert.ok(readFileSync(new URL(path,import.meta.url),'utf8').includes("'/schedule'"));
  assert.ok(renderDiscover('/shop',stateWith([])).includes('Everyday tools'));
});

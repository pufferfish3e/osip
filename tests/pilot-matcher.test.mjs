import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchPilots, renderPilotMatcher } from '../src/pilot-matcher.mjs';
import { PILOTS } from '../src/data.mjs';
const PREFERENCES = {service:'Mapping',area:'Perak',date:'',budget:75};
test('matching requires service and area; budget and date affect score deterministically', () => {
  const results = matchPilots(PREFERENCES);
  assert.deepEqual(results.map((result)=>result.pilot.id), ['azlan','maya']);
  assert.equal(results[0].score,100);
  assert.deepEqual(matchPilots({...PREFERENCES,service:'Spraying'}).map((result)=>result.pilot.id), ['maya']);
  assert.deepEqual(matchPilots({...PREFERENCES,area:'Other'}), []);
  assert.ok(matchPilots({...PREFERENCES,budget:60})[0].score < 100);
  const early=matchPilots({...PREFERENCES,date:'2000-01-01'});
  assert.equal(early[0].dateMatches,false);
  assert.ok(early[0].score<100);
  assert.equal(matchPilots({...PREFERENCES,date:PILOTS[0].available})[0].dateMatches,true);
});
test('wizard offers catalogue bypass and four steps with a separate centered result dialog',()=>{
 const html=renderPilotMatcher();
 assert.equal((html.match(/data-match-step=/g)??[]).length,4);
 assert.match(html,/Browse all pilots/);
 assert.match(html,/data-pilot-match/);
 assert.match(html,/data-match-back/);
});

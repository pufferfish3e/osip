import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFieldCareMotion } from '../src/field-care.mjs';

const harness = () => {
  const events = {};
  const tweens = [];
  const removed = [];
  const sheet = {
    open: false,
    style: {removeProperty: (property) => removed.push(property)},
    addEventListener: (name, callback) => { events[name] = callback; },
    showModal() { this.open = true; },
    close() { this.open = false; },
  };
  const gsap = {
    killTweensOf: () => {},
    fromTo: (target, from, to) => tweens.push({from,to}),
    to: (target, to) => tweens.push({to}),
  };
  return {sheet,gsap,events,tweens,removed};
};

test('closing retains the modal until the exit finishes and runs the action once', () => {
  const h = harness();
  const motion = createFieldCareMotion(h.sheet,h.gsap,()=>false);
  let actions = 0;
  motion.open();
  assert.equal(h.sheet.open,true);
  assert.equal(h.tweens[0].from['--care-backdrop-opacity'],0);
  motion.close(()=>{ actions += 1; });
  motion.close(()=>{ actions += 1; });
  assert.equal(h.sheet.open,true);
  assert.equal(actions,0);
  assert.equal(h.tweens.length,2);
  h.tweens[1].to.onComplete();
  assert.equal(h.sheet.open,false);
  assert.equal(actions,1);
  assert.ok(h.removed.includes('transform'));
});

test('reduced motion and missing GSAP keep all actions immediate', () => {
  for (const reduced of [true,false]) {
    const h = harness();
    const motion = createFieldCareMotion(h.sheet,reduced ? h.gsap : undefined,()=>reduced);
    let completed = false;
    motion.open();
    motion.close(()=>{ completed = true; });
    assert.equal(h.sheet.open,false);
    assert.equal(completed,true);
    assert.equal(h.tweens.length,0);
  }
});

test('repeated opens do not restart motion and stale close events do not interrupt reopening', () => {
  const h = harness();
  const motion = createFieldCareMotion(h.sheet,h.gsap,()=>false);
  motion.open(); motion.open();
  assert.equal(h.tweens.length,1);
  motion.close(); h.tweens[1].to.onComplete();
  motion.open();
  const removed = h.removed.length;
  h.events.close();
  assert.equal(h.removed.length,removed);
  assert.equal(h.sheet.open,true);
});

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { animateChatTyping } from '../src/workspace.mjs';

test('typing motion only runs under no-preference and disposes its media context', () => {
  const dots = [{},{},{}];
  let reverted = false;
  let registered;
  let tween;
  const gsap = {
    matchMedia: () => ({add:(query,callback)=>{registered={query,callback};},revert:()=>{reverted=true;}}),
    fromTo:(targets,from,to)=>{tween={targets,from,to};},
  };
  const dispose = animateChatTyping({hidden:false,querySelectorAll:()=>dots},gsap);
  assert.equal(registered.query,'(prefers-reduced-motion: no-preference)');
  assert.equal(tween,undefined);
  registered.callback();
  assert.equal(tween.targets,dots);
  assert.equal(tween.to.stagger.repeat,-1);
  assert.ok(tween.to.stagger.each > 0);
  dispose();
  assert.equal(reverted,true);
});

test('hidden indicators and unavailable GSAP never start a loop', () => {
  const gsap = {matchMedia:()=>{throw new Error('Unexpected animation');}};
  animateChatTyping({hidden:true},gsap)();
  animateChatTyping({hidden:false},undefined)();
});

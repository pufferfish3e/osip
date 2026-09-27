import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initializeLandEditor } from '../src/land-editor.mjs';
import { createStore } from '../src/store.mjs';

const harness = (isReduced, isNew = false) => {
  const elements = new Map(); const handlers = new Map(); const markers = []; const polygons = []; const tweens = [];
  const layer = () => ({ addTo() { return this; }, on(name, callback) { this.click = callback; return this; } });
  let zoom = 16;
  const map = { getZoom:()=>zoom, setView() {return this;}, fitBounds() {}, on(name, callback) {handlers.set(name, callback);}, remove() {} };
  const leaflet = { map:()=>map, tileLayer:layer, layerGroup:()=>({...layer(),removeLayer() {}}), latLngBounds:points=>points,
    polygon:(points)=>{ const polygon={...layer(),points,setLatLngs(next) {this.points=next;}};polygons.push(polygon);return polygon;},
    circleMarker:(point, options)=>{ const marker={...layer(),point,radius:options.radius,getLatLng() {return {lat:this.point[0],lng:this.point[1]};},getRadius() {return this.radius;},setLatLng(next) {this.point=next;},setRadius(radius) {this.radius=radius;},setStyle() {}};markers.push(marker);return marker;}
  };
  const panel = { dataset:{landEditor:isNew ? '' : 'farm-1'},querySelector(selector) {if(!elements.has(selector)) elements.set(selector,{setAttribute(){},addEventListener(){},removeEventListener(){}});return elements.get(selector);},addEventListener(){},removeEventListener(){} };
  const prior = globalThis.window;
  globalThis.window={matchMedia:()=>({matches:isReduced}),gsap:{to:(target,options)=>{const tween={target,options,isKilled:false,kill(){this.isKilled=true;}};tweens.push(tween);return tween;}}};
  const store=createStore({getItem:()=>null,setItem(){}});
  const dispose=initializeLandEditor(panel,store,leaflet);
  return {markers,polygons,tweens,addPoint:(point)=>handlers.get('click')({latlng:{lat:point[0],lng:point[1]}}),canAdd:()=>!elements.get('[data-point-action="add"]').disabled,zoomOut:()=>{zoom=8;handlers.get('zoomend')();},status:()=>elements.get('[data-point-status]').textContent,select:()=>markers[0].click(),move:()=>handlers.get('click')({latlng:{lat:3.9742,lng:100.7942}}),finish:()=>{dispose();globalThis.window=prior;}};
};
test('selection and movement reuse markers and polygon; new input interrupts the active tween',()=>{
  const h=harness(false);
  try {
    const first=h.markers[0]; const original=[...first.point];
    h.select(); assert.equal(h.markers.length,4);assert.equal(h.polygons.length,1);
    h.move();assert.equal(h.tweens[0].isKilled,true);assert.equal(h.markers[0],first);
    const tween=h.tweens.at(-1);tween.target.value=0.5;tween.options.onUpdate();
    assert.ok(Math.abs(first.point[0]-(original[0]+3.9742)/2)<1e-10);
    tween.target.value=1;tween.options.onUpdate();assert.deepEqual(first.point,[3.9742,100.7942]);
    assert.deepEqual(h.polygons[0].points[0],first.point);
  } finally {h.finish();}
  assert.equal(h.tweens.at(-1).isKilled,true);
});
test('reduced motion updates points immediately without creating tweens',()=>{
  const h=harness(true);
  try {h.select();h.move();assert.equal(h.tweens.length,0);assert.deepEqual(h.markers[0].point,[3.9742,100.7942]);} finally {h.finish();}
});

test('regional zoom blocks moving points and explains why',()=>{
  const h=harness(true);
  try {h.select();const point=[...h.markers[0].point];h.zoomOut();h.move();assert.deepEqual(h.markers[0].point,point);assert.match(h.status(),/Zoom in closer/);} finally {h.finish();}
});

test('new land accepts six boundary corners and stops at the storage limit', () => {
  const h = harness(true, true);
  try {
    const points = [[4,101],[4,101.002],[4.001,101.002],[4.001,101.001],[4.002,101.001],[4.002,101]];
    points.forEach(h.addPoint);
    assert.equal(h.markers.length, 6);
    assert.deepEqual(h.polygons[0].points, points);
    assert.equal(h.canAdd(), true);
    assert.match(h.status(), /6 corners.*3–100/);
    for (let index = 6; index < 100; index += 1) h.addPoint([4 + index / 100000, 101.003]);
    assert.equal(h.canAdd(), false);
    h.addPoint([4.003,101.003]);
    assert.equal(h.markers.length, 100);
  } finally { h.finish(); }
});

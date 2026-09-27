import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { renderLandEditor } from '../src/land-editor.mjs';

const SOURCE = readFileSync(new URL('../src/land-editor.mjs', import.meta.url), 'utf8');
const SAVE_START = SOURCE.indexOf('const save = (editor, event) => {');
const SAVE_END = SOURCE.indexOf('/** @param {Editor} editor @returns {()=>void} */', SAVE_START);

test('land editor has one save action', () => {
  const html = renderLandEditor();
  assert.equal((html.match(/type="submit"/g) ?? []).length, 1);
  assert.match(html, /Save and choose field dimensions/);
  assert.doesNotMatch(html, /value="save"/);
});

test('saving without a submitter persists land and opens field dimensions', () => {
  let savedRecord;
  let destination;
  const boundary = [[4, 101], [4, 101.001], [4.001, 101.001], [4.001, 101]];
  const context = {
    FormData: class { get() { return 'West land'; } },
    CustomEvent: class { constructor(name, options) { this.detail = options.detail; } },
    normalizeFieldBoundary: (points) => points,
    saveLandRecord: (state, record) => { savedRecord = record; return 'land-new'; },
    showError: (editor, error) => { throw error; },
  };
  runInNewContext(`${SOURCE.slice(SAVE_START, SAVE_END)} globalThis.saveLand = save;`, context);
  const editor = {
    step: 1, id: '', points: boundary,
    store: { update: (update) => update({}) },
    panel: { querySelector: () => ({ reportValidity: () => true }), dispatchEvent: (event) => { destination = event.detail.path; } },
  };
  context.saveLand(editor, { preventDefault() {}, stopPropagation() {} });
  assert.equal(savedRecord.name, 'West land');
  assert.deepEqual(savedRecord.boundary, boundary);
  assert.equal(destination, '/farm/land-new/fields/setup');
});

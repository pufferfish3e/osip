import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyAction } from '../src/actions.mjs';
import { INITIAL_STATE } from '../src/data.mjs';
import { createStore } from '../src/store.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

test('land keeps a checked completed task visible beside its next repeating occurrence', () => {
  let saved = null;
  const storage = { getItem: () => saved, setItem: (_key, value) => { saved = value; } };
  const store = createStore(storage);
  const original = store.getState().tasks[0];
  store.update((state) => { state.tasks.find((task) => task.id === original.id).repeat = 'daily'; });
  store.update((state) => { applyAction(state, 'toggle-task', original.id); });
  const state = createStore(storage).getState();
  const html = renderWorkspace(`/farm/${original.farmId}`, state);
  assert.match(html, /<h2>Completed<\/h2>/);
  assert.ok(html.includes(`data-id="${original.id}"`));
  assert.ok(html.includes(`aria-pressed="true"`));
  assert.equal(state.tasks.find((task) => task.id === original.id).done, true);
  assert.equal(state.tasks.filter((task) => task.repeatFromId === original.id).length, 1);
  store.update((draft) => { applyAction(draft, 'toggle-task', original.id); });
  assert.equal(store.getState().tasks.find((task) => task.id === original.id).done, false);
});

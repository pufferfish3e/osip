import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import DEMO from '../data/demo.json' with { type: 'json' };
import { submitForm, applyAction } from '../src/actions.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

const FARM = DEMO.farms[0];
const FIELDS = { farmId: FARM.id, title: 'Water crops', dueDate: '2026-10-02', time: '08:00', category: 'Watering', repeat: 'daily', reminder: 'on', creationKey: 'multi-test' };

test('selected fields each receive an independent task and resubmission is safe', () => {
  const state = structuredClone(DEMO);
  state.farms[0].plots.push({ ...FARM.plots[0], id: 'second-field', name: 'Second field' });
  const before = state.tasks.length;
  const plotIds = state.farms[0].plots.slice(0, 2).map((plot) => plot.id);
  submitForm(state, 'task', { ...FIELDS, plotIds: [...plotIds, plotIds[0]] });
  const tasks = state.tasks.slice(before);
  assert.equal(tasks.length, 2);
  assert.deepEqual(tasks.map((task) => task.plotId), plotIds);
  assert.notEqual(tasks[0].id, tasks[1].id);
  assert.ok(tasks.every((task) => task.repeat === 'daily' && task.reminder));
  submitForm(state, 'task', { ...FIELDS, plotIds });
  assert.equal(state.tasks.length, before + 2);
  applyAction(state, 'toggle-task', tasks[0].id);
  assert.equal(tasks[1].done, false);
});

test('empty, invalid and mixed whole-land selections cannot partially save', () => {
  for (const plotIds of [[], [FARM.plots[0].id, 'missing'], ['', FARM.plots[0].id]]) {
    const state = structuredClone(DEMO);
    const before = structuredClone(state.tasks);
    assert.throws(() => submitForm(state, 'task', { ...FIELDS, plotIds }));
    assert.deepEqual(state.tasks, before);
  }
});

test('whole-land and legacy single-field submissions remain supported', () => {
  for (const selection of [{ plotIds: [''] }, { plotId: FARM.plots[0].id }]) {
    const state = structuredClone(DEMO);
    submitForm(state, 'task', { ...FIELDS, ...selection });
    assert.equal(state.tasks.at(-1).plotId, selection.plotId ?? '');
  }
  const html = renderWorkspace(`/farm/${FARM.id}/schedule`, structuredClone(DEMO));
  assert.match(html, /type="checkbox" name="plotIds"/);
  assert.doesNotMatch(html, /select[^>]*name="plotId"/);
});

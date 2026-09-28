import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { renderPlantAnalysis, renderPlantHelp, renderPlantResults } from '../src/plant-help.mjs';
import { createPlantPhotoController, fitPhotoDimensions, parsePlantAnalysis, renderPhotoState, requestPlantAnalysis, validatePhotoFile } from '../src/plant-photo.mjs';

const PHOTO = new File(['photo'], 'leaf.jpg', { type: 'image/jpeg' });
const IMAGE = 'data:image/jpeg;base64,/9j/2Q==';
const RESULT = { title: 'Leaves with holes', summary: 'Visible damage needs a closer look.', isPlant: true, observations: ['Several holes are visible.'], nextSteps: ['Look under the leaves.'], guideSlugs: ['caterpillars'] };

test('plant help pages omit the camera/search switch and preserve their tools', () => {
  const searchHtml = renderPlantHelp('/plant-help');
  const cameraHtml = renderPlantHelp('/plant-help/camera');
  assert.doesNotMatch(searchHtml, /plant-modes|Plant help tools/);
  assert.doesNotMatch(cameraHtml, /plant-modes|Plant help tools/);
  assert.match(searchHtml, /data-plant-search/);
  assert.match(cameraHtml, /data-plant-camera/);
});

test('photo selection rejects oversized, empty and unsupported files', () => {
  validatePhotoFile(PHOTO);
  assert.throws(() => validatePhotoFile({ size: 0, type: 'image/jpeg' }), /15 MB/);
  assert.throws(() => validatePhotoFile({ size: 16 * 1024 * 1024, type: 'image/jpeg' }), /15 MB/);
  assert.throws(() => validatePhotoFile({ size: 100, type: 'image/svg+xml' }), /Choose/);
});

test('preparation preserves portrait and landscape proportions without upscaling', () => {
  assert.deepEqual(fitPhotoDimensions(4032, 3024), { width: 1600, height: 1200 });
  assert.deepEqual(fitPhotoDimensions(3024, 4032), { width: 1200, height: 1600 });
  assert.deepEqual(fitPhotoDimensions(400, 300), { width: 400, height: 300 });
  for (const dimensions of [[0, 20], [NaN, 30], [10000, 10000]]) assert.throws(() => fitPhotoDimensions(...dimensions));
});

test('camera and search point to the same guide detail route', () => {
  const href = '/plant-help/guides/caterpillars';
  assert.ok(renderPlantResults('holes').includes(href));
  assert.ok(renderPlantAnalysis(RESULT).includes(href));
  assert.match(renderPlantHelp(href), /What to do first/);
  assert.match(renderPlantHelp('/plant-help/guides/missing'), /Guide not found/);
  assert.equal(renderPlantHelp('/plant-help/guides/aphids/extra'), null);
});

test('search and AI text are escaped and missing guides rejected', () => {
  const attack = '<img src=x onerror="alert(1)">';
  assert.ok(renderPlantHelp('/plant-help', attack).includes('&lt;img'));
  const html = renderPlantAnalysis({ ...RESULT, title: attack, summary: attack });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes(attack));
  assert.throws(() => parsePlantAnalysis({ ...RESULT, guideSlugs: ['made-up-guide'] }), /incomplete/);
  assert.throws(() => parsePlantAnalysis({ ...RESULT, summary: '' }), /incomplete/);
  assert.deepEqual(parsePlantAnalysis({ ...RESULT, isPlant: false }).guideSlugs, []);
});

test('photo state renders native capture, gallery fallback and explicit send action', () => {
  const idle = renderPhotoState({ status: 'idle', image: '', result: null, error: '' });
  assert.match(idle, /capture="environment"/);
  assert.match(idle, /data-plant-photo="library"/);
  const ready = renderPhotoState({ status: 'ready', image: IMAGE, result: null, error: '' });
  assert.match(ready, /Analyze photo/);
  assert.doesNotMatch(idle, /A leaf, a stem, a clue|plant-photo-privacy|plant-viewfinder[^>]*><span/);
  assert.doesNotMatch(ready, /Only Analyze sends your photo to OpenAI/);
  assert.match(idle, /Take a photo/);
  assert.match(idle, /Choose a photo/);
  assert.match(idle, /plant-viewfinder[^>]*><svg/);
  assert.match(ready, /plant-camera-has-photo/);
  assert.match(renderPhotoState({ status: 'analyzing', image: IMAGE, result: null, error: '' }), /Looking at your plant…/);
});

test('photo checks remain beside cited guidance with publisher details and reference photos', () => {
  const research = { text: 'Check beneath leaves. [one]\n\nInspect nearby plants. [two]', citations: [
    { url: 'https://extension.example.org/one', title: 'Leaf guide', start: 22, end: 27 },
    { url: 'https://extension.example.org/two', title: 'Field guide', start: 52, end: 57 },
  ] };
  const referenceImages = [{ url: 'https://upload.wikimedia.org/example.jpg', source: 'https://commons.wikimedia.org/wiki/File:Example.jpg', title: 'Aphid close-up', credit: 'Example author · CC BY 4.0' }];
  const html = renderPlantAnalysis({ ...RESULT, research, referenceImages });
  assert.match(html, /Photos to compare/);
  assert.match(html, /Aphid close-up/);
  assert.match(html, /Check beneath leaves/);
  assert.match(html, /Look under the leaves\./);
  assert.match(html, /Advice from published sources/);
  assert.match(html, /Leaf guide/);
  assert.match(html, /extension\.example\.org/);
  assert.equal((html.match(/class="plant-source-links"/g) ?? []).length, 2);
  assert.ok(html.indexOf('extension.example.org/one') < html.indexOf('extension.example.org/two'));
  assert.doesNotMatch(renderPlantAnalysis({ ...RESULT, isPlant: false, research, referenceImages }), /Photos to compare/);
  assert.throws(() => parsePlantAnalysis({ ...RESULT, referenceImages: [{ ...referenceImages[0], url: 'javascript:alert(1)' }] }), /references/);
});

test('photo shows possible causes and distinguishing checks without claiming sources confirm the photo', () => {
  const result = { ...RESULT, possibleCauses: ['Could be caterpillars if fresh feeding is present.'], confirmationChecks: ['Look for living larvae beneath nearby leaves.'] };
  const html = renderPlantAnalysis(result);
  assert.match(html, /Possible causes/);
  assert.match(html, /Could be caterpillars/);
  assert.match(html, /What to check to confirm/);
  assert.match(html, /Look for living larvae/);
  assert.match(html, /not a confirmed diagnosis/);
  const unrelated = renderPlantAnalysis({ ...result, isPlant: false, nextSteps: ['Take a clearer plant photo.'], guideSlugs: [] });
  assert.doesNotMatch(unrelated, /Possible causes|living larvae|plant-evidence-note/);
  assert.match(unrelated, /Take a clearer plant photo/);
  assert.throws(() => parsePlantAnalysis({ ...result, isPlant: false, guideSlugs: [] }), /incomplete/);
  assert.throws(() => parsePlantAnalysis({ ...result, possibleCauses: ['a', 'b', 'c'] }), /incomplete/);
});

test('photo request uses only same-origin API and propagates safe server errors', async () => {
  const signal = new AbortController().signal;
  const fetcher = async (url, options) => {
    assert.equal(url, '/api/plant-analysis');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers.Authorization, undefined);
    assert.deepEqual(JSON.parse(options.body), { image: IMAGE, locale: 'en' });
    return new Response(JSON.stringify(RESULT));
  };
  assert.deepEqual(await requestPlantAnalysis(IMAGE, signal, fetcher), RESULT);
  await assert.rejects(requestPlantAnalysis(IMAGE, signal, async () => new Response(JSON.stringify({ error: { message: 'Not configured yet.' } }), { status: 503 })), /Not configured/);
  await assert.rejects(requestPlantAnalysis(IMAGE, signal, async () => new Response('<html>Unavailable</html>', { status: 502 })), /unreadable response/);
});

test('analysis runs only after explicit analyze and preserves a retryable photo on failure', async () => {
  let calls = 0;
  const controller = createPlantPhotoController({ onChange: () => {}, prepare: async () => IMAGE, request: async () => { calls += 1; throw new Error('Try again later.'); } });
  await controller.choose(PHOTO);
  assert.equal(calls, 0);
  assert.equal(controller.getState().status, 'ready');
  await controller.analyze();
  assert.equal(calls, 1);
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().image, IMAGE);
  assert.equal(controller.getState().error, 'Try again later.');
});

test('cancel or leaving the page prevents a late analysis from restoring a photo', async () => {
  let finish;
  let requestSignal;
  const controller = createPlantPhotoController({ onChange: () => {}, prepare: async () => IMAGE, request: async (_image, signal) => { requestSignal = signal; return await new Promise((resolve) => { finish = resolve; }); } });
  await controller.choose(PHOTO);
  const pending = controller.analyze();
  controller.reset();
  assert.equal(requestSignal.aborted, true);
  finish(RESULT);
  await pending;
  assert.equal(controller.getState().status, 'idle');
  assert.equal(controller.getState().image, '');
  assert.equal(controller.getState().result, null);
});

test('new photo wins over an older preparation and duplicate analysis is ignored', async () => {
  let finishOld;
  let preparations = 0;
  let requests = 0;
  let finishRequest;
  const controller = createPlantPhotoController({ onChange: () => {}, prepare: async () => ++preparations === 1 ? await new Promise((resolve) => { finishOld = resolve; }) : IMAGE, request: async () => { requests += 1; return await new Promise((resolve) => { finishRequest = resolve; }); } });
  const old = controller.choose(PHOTO);
  await controller.choose(PHOTO);
  finishOld('old photo'); await old;
  assert.equal(controller.getState().image, IMAGE);
  const first = controller.analyze(); await controller.analyze();
  assert.equal(requests, 1);
  finishRequest(RESULT); await first;
  assert.equal(controller.getState().status, 'success');
});

test('photo summaries render observations as non-interactive pills and ordered action cards', () => {
  const html = renderPlantAnalysis(RESULT);
  assert.match(html, /class="plant-summary-card card"/);
  assert.match(html, /<ul class="plant-observations" role="list"><li>Several holes are visible\.<\/li><\/ul>/);
  assert.match(html, /<ol class="plant-action-cards" role="list">/);
  assert.match(html, /class="plant-step-number" aria-hidden="true">1<\/span>/);
  assert.match(html, /Look under the leaves\./);
  const sparse = renderPlantAnalysis({ ...RESULT, isPlant: false, observations: [], nextSteps: [], guideSlugs: [] });
  assert.doesNotMatch(sparse, /class="plant-observations"|class="plant-action-cards"|plant-step-number/);
  const unsafe = renderPlantAnalysis({ ...RESULT, observations: ['<script>bad()</script>'], nextSteps: ['<img src=x onerror=bad()>'] });
  assert.doesNotMatch(unsafe, /<script>|<img src=x/);
  assert.match(unsafe, /&lt;script&gt;/);
});

import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { getLocale, setLocale } from '../src/i18n.mjs';
import { PLANT_GUIDE_COPY } from '../src/locales/plant.mjs';
import { PLANT_GUIDES, localizePlantGuide, searchPlantGuides } from '../src/plant-guides.mjs';
import { renderPlantHelp } from '../src/plant-help.mjs';
import { renderPhotoState, requestPlantAnalysis } from '../src/plant-photo.mjs';

afterEach(() => setLocale('en'));

test('all ten plant guides have complete local reading content and canonical sources', () => {
  for (const locale of ['ms', 'zh-Hans']) {
    for (const guide of PLANT_GUIDES) {
      assert.ok(PLANT_GUIDE_COPY[locale][guide.slug]);
      const localized = localizePlantGuide(guide, locale);
      assert.equal(localized.slug, guide.slug);
      assert.deepEqual(localized.sources, guide.sources);
      assert.notEqual(localized.summary, guide.summary);
      assert.equal(localized.symptoms.length, guide.symptoms.length);
      assert.equal(localized.actions.length, guide.actions.length);
      assert.ok(localized.whenToGetHelp);
    }
  }
});

test('plant search accepts Malay and Chinese symptoms without changing canonical categories', () => {
  assert.ok(searchPlantGuides('daun kuning').some(({slug}) => slug === 'yellow-leaves'));
  assert.ok(searchPlantGuides('蚜虫').some(({slug}) => slug === 'aphids'));
  assert.ok(searchPlantGuides('叶子发黄').some(({slug}) => slug === 'yellow-leaves'));
  assert.ok(searchPlantGuides('积水', 'Growing conditions').some(({slug}) => slug === 'waterlogging'));
  assert.equal(searchPlantGuides('蚜虫', 'Disease').length, 0);
});

test('camera, search and article UI render the chosen language', () => {
  for (const [locale, heading, camera] of [['ms', 'Apa yang berlaku?', 'Ambil foto'], ['zh-Hans', '植物怎么了？', '拍照']]) {
    setLocale(locale);
    assert.ok(renderPlantHelp('/plant-help').includes(heading));
    assert.ok(renderPlantHelp('/plant-help/guides/aphids').includes(PLANT_GUIDE_COPY[locale].aphids.summary));
    assert.ok(renderPhotoState({ status:'idle',image:'',error:'',result:null }).includes(camera));
  }
});

test('photo requests send the validated display language without translating guide IDs', async () => {
  setLocale('zh-Hans');
  const expected = {title:'叶片',summary:'照片可见叶片。',isPlant:true,observations:[],nextSteps:[],guideSlugs:['aphids']};
  const result = await requestPlantAnalysis('photo', new AbortController().signal, async (_url, options) => {
    assert.equal(JSON.parse(options.body).locale, getLocale());
    return Response.json(expected);
  });
  assert.deepEqual(result, expected);
});

import { strict as assert } from 'node:assert';
import { afterEach, test } from 'node:test';

import { ARTICLES, COURSES, INITIAL_STATE, NEWS, PILOTS, PRODUCTS } from '../src/data.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { setLocale, t } from '../src/i18n.mjs';
import { DISCOVER_TRANSLATIONS } from '../src/locales/discover.mjs';

const LOCALES = ['ms', 'zh-Hans'];
const UNSAFE_NAME = '<img src=x onerror="bad()">';
const ROUTES = ['/learn', '/learn/knowledge', '/learn/saved', '/learn/courses', '/learn/my-courses', '/services', '/services/pilots', '/shop', '/shop/cart', '/news', '/tools', '/tools/area', '/tools/cost', '/tools/margin', '/tools/saved'];

/** @returns {import('../src/store.mjs').AppState} */
const createState = () => structuredClone(INITIAL_STATE);

/** @param {string} path @param {import('../src/store.mjs').AppState} state @returns {string} */
const render = (path, state = createState()) => {
  const html = renderDiscover(path, state);
  assert.equal(typeof html, 'string', `${path} should render`);
  return html;
};

afterEach(() => setLocale('en'));

test('Malay and Chinese discovery dictionaries cover the same keys and preserve parameters', () => {
  assert.deepEqual(Object.keys(DISCOVER_TRANSLATIONS.ms), Object.keys(DISCOVER_TRANSLATIONS['zh-Hans']));
  for (const locale of LOCALES) {
    for (const [source, translation] of Object.entries(DISCOVER_TRANSLATIONS[locale])) {
      assert.ok(translation.trim(), `${locale}: ${source}`);
      assert.deepEqual(translation.match(/\{\w+\}/g)?.sort() ?? [], source.match(/\{\w+\}/g)?.sort() ?? [], `${locale}: ${source}`);
    }
  }
});

test('all discovery collections and detail pages render in each selected language', () => {
  const detailPaths = [
    ...ARTICLES.map((article) => `/learn/knowledge/${article.slug}`),
    ...COURSES.flatMap((course) => [`/learn/courses/${course.id}`, `/learn/courses/${course.id}/book`]),
    ...PILOTS.flatMap((pilot) => [`/services/pilots/${pilot.id}`, `/services/pilots/${pilot.id}/book`]),
    ...PRODUCTS.map((product) => `/shop/products/${product.id}`),
    ...NEWS.map((story) => `/news/${story.slug}`),
  ];
  for (const locale of LOCALES) {
    setLocale(locale);
    for (const path of [...ROUTES, ...detailPaths]) {
      const html = render(path);
      assert.doesNotMatch(html, /\bundefined\b|\bNaN\b|\{(?:name|count|minutes|price)\}/, path);
      assert.match(html, /<h[12]\b/, path);
    }
    assert.ok(render('/learn').includes(t('Learn something new.')));
    assert.ok(render('/services').includes(t('Book a drone pilot')));
    assert.ok(render('/tools').includes(t('Calculator')));
  }
});

test('guide search indexes both translated and original titles while category keys stay canonical', () => {
  for (const locale of LOCALES) {
    setLocale(locale);
    const html = render('/learn/knowledge');
    for (const article of ARTICLES) {
      assert.ok(html.includes(article.title.toLowerCase()));
      assert.ok(html.includes(t(article.title).toLowerCase()));
      assert.ok(html.includes(`data-topic="${article.category.toLowerCase()}"`));
      assert.ok(html.includes(`data-filter="${article.category.toLowerCase()}"`));
    }
    assert.ok(html.includes(`aria-label="${t('Search farming guides')}"`));
  }
});

test('full article, course, product and news copy is translated', () => {
  const displayText = [
    ...ARTICLES.flatMap((article) => [article.title, article.summary, article.category, article.crop, article.author, article.source, ...article.sections.flatMap((section) => [section.title, section.body])]),
    ...COURSES.flatMap((course) => [course.title, course.summary, course.category, course.format, course.location, course.duration, ...course.topics]),
    ...PRODUCTS.flatMap((product) => [product.name, product.category, product.description, ...product.specs]),
    ...NEWS.flatMap((story) => [story.title, story.category, story.summary, story.body, story.source]),
    ...PILOTS.flatMap((pilot) => [pilot.serviceArea, pilot.equipment, ...pilot.services]),
  ];
  for (const locale of LOCALES) {
    setLocale(locale);
    for (const text of displayText) {
      if (locale === 'ms' && ['Perak', 'Kedah', 'Perak & Kedah'].includes(text)) continue;
      assert.notEqual(t(text), text, `${locale}: ${text}`);
    }
    for (const article of ARTICLES) {
      const html = render(`/learn/knowledge/${article.slug}`);
      for (const section of article.sections) assert.ok(html.includes(t(section.body)));
    }
  }
});

test('translated forms keep original service, course and calculator values', () => {
  for (const locale of LOCALES) {
    setLocale(locale);
    const pilot = render('/services/pilots/azlan/book');
    assert.ok(pilot.includes(`<option value="Mapping">${t('Mapping')}</option>`));
    assert.ok(pilot.includes('name="title" value="Drone service with Azlan Ibrahim"'));
    const course = render('/learn/courses/field-mapping/book');
    assert.ok(course.includes('name="title" value="Your first digital field map"'));
    assert.ok(course.includes('name="providerId" value="field-mapping"'));
    const calculator = render('/tools/area');
    for (const unit of ['ha', 'acre', 'm2']) assert.ok(calculator.includes(`value="${unit}"`));
    assert.ok(calculator.includes('data-kind="area"'));
  }
});

test('language rendering leaves state, fixed data, and user-authored names unchanged and escaped', () => {
  const state = createState();
  state.farms[0].name = 'Soil';
  state.bookings = [{ id: 'custom', providerId: 'field-mapping', type: 'course', title: UNSAFE_NAME, date: '2026-10-01', time: '09:00', farmId: '', status: 'requested', notes: '', price: 120, conversation: [] }];
  state.savedCalculations = [{ title: 'Soil', type: 'margin', result: 20, unit: 'MYR', date: '2026-10-01' }];
  const before = structuredClone({ state, ARTICLES, COURSES, PILOTS, PRODUCTS, NEWS });
  for (const locale of LOCALES) {
    setLocale(locale);
    assert.match(render('/services/pilots/azlan/book', state), /value="farm-1">Soil ·/);
    assert.match(render('/tools/saved', state), /class="row-title">Soil</);
    const bookings = render('/learn/my-courses', state);
    assert.ok(bookings.includes('&lt;img src=x onerror=&quot;bad()&quot;&gt;'));
    assert.doesNotMatch(bookings, /<img src=x/);
  }
  assert.deepEqual({ state, ARTICLES, COURSES, PILOTS, PRODUCTS, NEWS }, before);
});

test('locale changes translate free course pricing without changing values', () => {
  setLocale('en');
  const english = render('/learn/courses/field-mapping');
  setLocale('zh-Hans');
  const chinese = render('/learn/courses/field-mapping');
  assert.match(english, />Free</);
  assert.match(chinese, />免费</);
  assert.notEqual(english, chinese);
  setLocale('en');
  assert.equal(render('/learn/courses/field-mapping'), english);
});

test('health services are absent from navigation and no longer resolve in every locale', () => {
  for (const locale of ['en', ...LOCALES]) {
    setLocale(locale);
    assert.doesNotMatch(render('/services'), /services\/health/);
    assert.equal(renderDiscover('/services/health', createState()), null);
    assert.equal(renderDiscover('/services/health/provider-placeholder', createState()), null);
  }
});

test('course catalogue has 25 unique searchable courses in every supported language', () => {
  assert.equal(COURSES.length, 25);
  assert.equal(new Set(COURSES.map((course) => course.id)).size, 25);
  for (const locale of ['en', ...LOCALES]) {
    setLocale(locale);
    const html = render('/learn/courses');
    assert.match(html, /data-search="courses"/);
    assert.match(html, /data-search-empty/);
    assert.equal((html.match(/data-search-item/g) ?? []).length, 25);
    for (const course of COURSES) {
      assert.ok(html.includes(t(course.title).toLowerCase()));
      assert.ok(html.includes(t(course.topics[0]).toLowerCase()));
      assert.equal(course.isDemo, true);
      assert.equal(course.price, 0);
    }
  }
});

test('course booking uses a labelled bottom sheet over course details', () => {
  const html = render('/learn/courses/drone-intro/book');
  assert.match(html, /<dialog[^>]+data-course-booking-sheet/);
  assert.match(html, /aria-labelledby="course-booking-title"/);
  assert.match(html, /data-course-booking-close/);
  assert.equal((html.match(/data-form="course-booking"/g) ?? []).length, 1);
  assert.match(html, /What you will learn/);
  assert.doesNotMatch(html, /<div class="two-column"><form/);
});

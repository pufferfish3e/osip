import { escapeHtml } from '../src/ui.mjs';
import { PLANT_TRANSLATIONS } from '../src/locales/plant.mjs';
import { DISCOVER_TRANSLATIONS } from '../src/locales/discover.mjs';
import { WORKSPACE_TRANSLATIONS } from '../src/locales/workspace.mjs';
import { CORE_TRANSLATIONS } from '../src/locales/core.mjs';
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import {readFileSync,readdirSync} from 'node:fs';
import {INITIAL_STATE,ARTICLES,COURSES,PILOTS,PRODUCTS,NEWS} from '../src/data.mjs';
import {renderHome} from '../src/home.mjs';import {renderWorkspace} from '../src/workspace.mjs';import {renderDiscover} from '../src/discover.mjs';import {renderPlantHelp} from '../src/plant-help.mjs';import {PLANT_GUIDES} from '../src/plant-guides.mjs';import {setLocale,t} from '../src/i18n.mjs';

const DISCOVER_ROUTES = [
  '/learn', '/learn/knowledge', `/learn/knowledge/${ARTICLES[0].slug}`, '/learn/saved',
  '/learn/courses', `/learn/courses/${COURSES[0].id}`, `/learn/courses/${COURSES[0].id}/book`, '/learn/my-courses',
  '/services', '/services/pilots', `/services/pilots/${PILOTS[0].id}`, `/services/pilots/${PILOTS[0].id}/book`,
  '/shop', `/shop/products/${PRODUCTS[0].id}`, '/shop/cart',
  '/news', `/news/${NEWS[0].slug}`, '/tools', '/tools/area', '/tools/cost', '/tools/margin', '/tools/saved',
];
const WORKSPACE_ROUTES = [
  '/auth/sign-in', '/auth/sign-up', '/onboarding/role', '/onboarding/farmer', '/onboarding/pilot', '/onboarding/pilot/verification',
  '/farm', '/farm/new', '/farm/farm-1/edit', '/farm/farm-1/fields/setup', '/farm/farm-1', '/farm/farm-1/plots/plot-1', '/farm/farm-1/schedule', '/farm/farm-1/tasks/soil', '/weather/farm-1',
  '/bookings', '/bookings/pilot-booking', '/bookings/pilot-booking/chat', '/messages',
  '/pilot', '/pilot/requests', '/pilot/availability', '/pilot/profile',
  '/account', '/account/settings', '/notifications', '/orders', '/orders/order-1',
  '/checkout/cart', '/checkout/order-1', '/checkout/order-1/payment',
];
const routes=['/',...DISCOVER_ROUTES,...WORKSPACE_ROUTES,...ARTICLES.map(x=>'/learn/knowledge/'+x.slug),...COURSES.flatMap(x=>['/learn/courses/'+x.id,'/learn/courses/'+x.id+'/book']),...PRODUCTS.map(x=>'/shop/products/'+x.id),...NEWS.map(x=>'/news/'+x.slug),...PLANT_GUIDES.map(x=>'/plant-help/guides/'+x.slug),'/plant-help','/plant-help/camera'];
const state=structuredClone(INITIAL_STATE); state.profile.roles=['farmer','pilot'];state.bookings=[{id:'pilot-booking',type:'pilot',providerId:PILOTS[0].id,title:`${PILOTS[0].services[0]} with ${PILOTS[0].name}`,service:PILOTS[0].services[0],date:'2026-10-01',time:'09:00',farmId:'farm-1',status:'requested',notes:'',price:65,conversation:[]},{id:'course-booking',type:'course',providerId:COURSES[0].id,title:COURSES[0].title,date:'2026-10-01',time:'10:00',status:'requested',price:120,conversation:[]}];state.cart=[{productId:PRODUCTS[0].id,quantity:1}];state.orders=[{id:'order-1',items:state.cart,total:100,status:'unpaid',date:'2026-10-01'}];
const render=path=>path==='/'?renderHome(state):renderWorkspace(path,state)??renderDiscover(path,state)??renderPlantHelp(path);
const tokens=html=>[...html.matchAll(/>([^<>]+)</g),...html.matchAll(/(?:aria-label|placeholder|alt|title)="([^"]+)"/g)].map(m=>m[1].trim()).filter(s=>/[A-Za-z]{3}/.test(s)&&!s.includes('<'));

afterEach(() => setLocale('en'));
const DICTIONARIES = [CORE_TRANSLATIONS, WORKSPACE_TRANSLATIONS, DISCOVER_TRANSLATIONS, PLANT_TRANSLATIONS];
const PROPER_NAMES = new Set([INITIAL_STATE.profile.name, ...PILOTS.map((pilot) => pilot.name), ...PRODUCTS.filter((product) => product.name.startsWith('DJI ')).map((product) => product.name), 'English', 'Bahasa Melayu', 'DJI', ...ARTICLES.filter((article) => article.kind).flatMap((article) => [article.title, article.author, article.source, article.summary, article.copyright, `${article.source} · ${article.publishedYear}`])].flatMap((text) => typeof text === 'string' ? [text, escapeHtml(text)] : []));
test('every route, catalogue detail, and plant guide translates visible copy and accessible labels', () => {
  for (const path of new Set(routes)) {
    setLocale('en');
    const english = tokens(render(path) || '');
    setLocale('zh-Hans');
    const translated = new Set(tokens(render(path) || ''));
    const leaks = [...new Set(english.filter((text) => translated.has(text) && !PROPER_NAMES.has(text)))];
    assert.deepEqual(leaks, [], path);
  }
});

test('all literal translation calls and server photo errors have both translations', () => {
  const files = ['app.js', ...readdirSync(new URL('../src/', import.meta.url)).filter((name) => name.endsWith('.mjs')).map((name) => `src/${name}`)];
  const messages = files.flatMap((file) => [...readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').matchAll(/\bt\('([^'\n]+)'/g)].map((match) => match[1]));
  const server = readFileSync(new URL('../server/plant-analysis.mjs', import.meta.url), 'utf8');
  messages.push(...[...server.matchAll(/new PlantAnalysisError\([^,]+, '[^']+', '([^']+)'/g)].map((match) => match[1]));
  for (const locale of ['ms', 'zh-Hans']) {
    const dictionary = Object.assign({}, ...DICTIONARIES.map((item) => item[locale]));
    for (const message of messages.filter(Boolean)) assert.ok(Object.hasOwn(dictionary, message), `${locale}: ${message}`);
  }
});


test('demo translations do not mutate persisted records or translate custom text', async () => {
  const { localizeDemoState } = await import('../src/ui.mjs');
  const original = structuredClone(INITIAL_STATE);
  const snapshot = structuredClone(original);
  setLocale('zh-Hans');
  assert.equal(localizeDemoState(original).tasks[0].title, '记录土壤观察结果');
  assert.deepEqual(original, snapshot);
  original.farms[0].name = 'My custom farm';
  original.tasks[0].title = 'My custom task';
  const translated = localizeDemoState(original);
  assert.equal(translated.farms[0].name, 'My custom farm');
  assert.equal(translated.tasks[0].title, 'My custom task');
});

test('visible copy uses Perak and omits demo labels in every language', () => {
  for (const locale of ['en', 'ms', 'zh-Hans']) {
    setLocale(locale);
    for (const path of new Set(routes)) {
      const visibleCopy = tokens(render(path) || '').join(' ');
      assert.doesNotMatch(visibleCopy, /\bdemo\b|Penang|Pulau Pinang|槟城|演示/i, `${locale}: ${path}`);
    }
    assert.ok(renderHome(state).includes(locale === 'zh-Hans' ? '霹雳' : 'Perak'));
  }
});

test('old default farm locations display Perak without changing saved or custom locations', async () => {
  const { localizeDemoState } = await import('../src/ui.mjs');
  const saved = structuredClone(INITIAL_STATE);
  saved.farms[0].location = 'Penang, Malaysia · demo location';
  assert.equal(localizeDemoState(saved).farms[0].location, 'Perak, Malaysia');
  assert.equal(saved.farms[0].location, 'Penang, Malaysia · demo location');
  saved.farms[0].location = 'My Penang plot';
  assert.equal(localizeDemoState(saved).farms[0].location, 'My Penang plot');
});

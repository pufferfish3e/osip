import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { ARTICLES, COURSES, INITIAL_STATE, NEWS, PILOTS, PRODUCTS } from '../src/data.mjs';
import { applyAction } from '../src/actions.mjs';
import { renderDiscover } from '../src/discover.mjs';
import { renderHome } from '../src/home.mjs';
import { emptyState, escapeHtml, pageHeading } from '../src/ui.mjs';
import { renderWorkspace } from '../src/workspace.mjs';

/** @typedef {import('../src/store.mjs').AppState} AppState */

const UNSAFE_TEXT = '<img src=x onerror="alert(1)"><script>bad()</script>\'&';
const EMPTY_ASSET_ATTRIBUTE = /\b(?:href|src)\s*=\s*(?:"\s*"|'\s*')/;
const MISSING_VALUE_TEXT = /\b(?:undefined|NaN)\b/;
const FIXTURE_DATE = '2026-10-01';

/** @returns {AppState} */
const createState = () => {
  const state = structuredClone(INITIAL_STATE);
  state.profile.roles = ['farmer', 'pilot'];
  state.bookings = [
    { id: 'pilot-booking', type: 'pilot', providerId: PILOTS[0].id, title: 'Map the north field', date: FIXTURE_DATE, time: '09:00', farmId: state.farms[0].id, status: 'requested', notes: 'Meet at the gate.', price: 65, conversation: [{ id: 'message-1', sender: 'you', text: 'Can we meet at nine?', date: `${FIXTURE_DATE}T08:00:00Z` }] },
    { id: 'course-booking', type: 'course', providerId: COURSES[0].id, title: COURSES[0].title, date: FIXTURE_DATE, time: '10:00', farmId: '', status: 'requested', notes: '', price: 120, conversation: [] },
  ];
  state.cart = [{ productId: PRODUCTS[0].id, quantity: 2 }];
  state.orders = [{ id: 'order-1', items: [...state.cart], total: PRODUCTS[0].price * 2, status: 'unpaid', date: FIXTURE_DATE }];
  state.savedArticles = [ARTICLES[0].id];
  state.savedCalculations = [{ title: 'North field estimate', type: 'margin', result: -100, unit: 'MYR', date: FIXTURE_DATE }];
  state.notifications = [{ id: 'reminder-1', title: 'Field visit due', body: 'Review your schedule.', date: FIXTURE_DATE, read: false }];
  return state;
};

const DISCOVER_ROUTES = [
  '/learn', '/learn/knowledge', `/learn/knowledge/${ARTICLES[0].slug}`, '/learn/saved',
  '/learn/courses', `/learn/courses/${COURSES[0].id}`, `/learn/courses/${COURSES[0].id}/book`, '/learn/my-courses',
  '/services', '/services/pilots', `/services/pilots/${PILOTS[0].id}`, `/services/pilots/${PILOTS[0].id}/book`,
  '/shop', `/shop/products/${PRODUCTS[0].id}`, '/shop/cart',
  '/news', `/news/${NEWS[0].slug}`, '/tools', '/tools/area', '/tools/cost', '/tools/margin', '/tools/saved',
];

const WORKSPACE_ROUTES = [
  '/auth/sign-in', '/auth/sign-up', '/onboarding/role', '/onboarding/farmer', '/onboarding/pilot', '/onboarding/pilot/verification',
  '/farm', '/farm/farm-1', '/farm/farm-1/plots/plot-1', '/farm/farm-1/schedule', '/farm/farm-1/tasks/soil', '/weather/farm-1',
  '/bookings', '/bookings/pilot-booking', '/bookings/pilot-booking/chat', '/messages',
  '/pilot', '/pilot/requests', '/pilot/availability', '/pilot/profile',
  '/account', '/account/settings', '/notifications', '/orders', '/orders/order-1',
  '/checkout/cart', '/checkout/order-1', '/checkout/order-1/payment',
];

/** @param {string | null} html @param {string} path @returns {void} */
const assertHealthyMarkup = (html, path) => {
  assert.equal(typeof html, 'string', `${path} must be handled`);
  assert.ok(html.length > 0, `${path} must produce content`);
  assert.match(html, /<h1\b/, `${path} must have a page title`);
  assert.doesNotMatch(html, EMPTY_ASSET_ATTRIBUTE, `${path} must not contain empty links or image sources`);
  assert.doesNotMatch(html, MISSING_VALUE_TEXT, `${path} must not expose unresolved data`);
};

test('each discovery route renders its expected collection or record', () => {
  const state = createState();
  for (const path of DISCOVER_ROUTES) assertHealthyMarkup(renderDiscover(path, state), path);
});

test('each workspace route renders with complete farm, booking, and order records', () => {
  const state = createState();
  for (const path of WORKSPACE_ROUTES) assertHealthyMarkup(renderWorkspace(path, state), path);
  assertHealthyMarkup(renderHome(state), '/');
});

test('initial empty collections produce useful screens rather than missing data', () => {
  for (const path of ['/learn/saved', '/learn/my-courses', '/shop/cart', '/tools/saved']) {
    assertHealthyMarkup(renderDiscover(path, INITIAL_STATE), path);
  }
  for (const path of ['/bookings', '/messages', '/pilot/requests', '/orders', '/checkout/cart', '/notifications']) {
    assertHealthyMarkup(renderWorkspace(path, INITIAL_STATE), path);
  }
});

test('missing record IDs render a recovery destination', () => {
  const state = createState();
  const discoveryPaths = ['/learn/knowledge/missing', '/learn/courses/missing', '/learn/courses/missing/book', '/services/pilots/missing', '/services/pilots/missing/book', '/shop/products/missing', '/news/missing', '/tools/missing'];
  const workspacePaths = ['/farm/missing', '/farm/farm-1/plots/missing', '/farm/farm-1/tasks/missing', '/weather/missing', '/bookings/missing', '/bookings/missing/chat', '/orders/missing', '/checkout/missing', '/checkout/missing/payment'];
  for (const path of discoveryPaths) {
    const html = renderDiscover(path, state);
    assert.match(html, /not found/i, path);
    assert.match(html, /<a\b[^>]*href="\/[^"]+"/, path);
  }
  for (const path of workspacePaths) {
    const html = renderWorkspace(path, state);
    assert.match(html, /not found/i, path);
    assert.match(html, /<a\b[^>]*href="\/[^"]+"/, path);
  }
});

test('renderers decline routes owned by another module and malformed deep routes', () => {
  const state = createState();
  for (const path of ['/account', '/bookings', '/not-a-route', '/shop/cart/extra', '/learn/knowledge/test/extra']) {
    assert.equal(renderDiscover(path, state), null, path);
  }
  for (const path of ['/learn', '/shop', '/not-a-route', '/farm/farm-1/extra', '/orders/order-1/extra']) {
    assert.equal(renderWorkspace(path, state), null, path);
  }
});

test('user-entered names, task details, booking notes, and messages are escaped', () => {
  const state = createState();
  state.profile.name = UNSAFE_TEXT;
  state.farms[0].name = UNSAFE_TEXT;
  state.farms[0].location = UNSAFE_TEXT;
  state.farms[0].crop = UNSAFE_TEXT;
  state.tasks[0].title = UNSAFE_TEXT;
  state.bookings[0].title = UNSAFE_TEXT;
  state.bookings[0].notes = UNSAFE_TEXT;
  state.bookings[0].conversation[0].text = UNSAFE_TEXT;
  state.savedCalculations[0].title = UNSAFE_TEXT;
  const screens = [renderHome(state), renderDiscover('/services/pilots/azlan/book', state), renderDiscover('/tools/saved', state)];
  const paths = ['/farm', '/farm/farm-1', '/farm/farm-1/tasks/soil', '/account/settings', '/bookings/pilot-booking', '/bookings/pilot-booking/chat', '/messages'];
  screens.push(...paths.map((path) => renderWorkspace(path, state)));
  for (const html of screens) {
    assert.ok(html.includes(escapeHtml(UNSAFE_TEXT)), 'Escaped text should remain visible');
    assert.doesNotMatch(html, /<script\b|<img src=x|onerror="alert\(1\)"/);
  }
});

test('UI helpers escape text and omit absent optional links', () => {
  assert.equal(escapeHtml('<>&"\''), '&lt;&gt;&amp;&quot;&#39;');
  assert.equal(escapeHtml(null), '');
  const heading = pageHeading(UNSAFE_TEXT, UNSAFE_TEXT, UNSAFE_TEXT);
  assert.doesNotMatch(heading, /<script\b|<img src=x/);
  assert.equal(heading.split(escapeHtml(UNSAFE_TEXT)).length - 1, 3);
  assert.doesNotMatch(emptyState('No results', 'Try again'), /<a\b/);
});

test('onboarding offers both roles and collects role-specific information', () => {
  const state = createState();
  const roles = renderWorkspace('/onboarding/role', state);
  for (const role of ['farmer', 'pilot', 'both']) assert.ok(roles.includes(`data-role="${role}"`));
  const farmer = renderWorkspace('/onboarding/farmer', state);
  for (const name of ['name', 'farmName', 'location', 'crop']) assert.ok(farmer.includes(`name="${name}"`));
  assert.match(farmer, /data-form="farmer-onboarding"/);
  assert.doesNotMatch(farmer, /name="equipment"/);
  const pilot = renderWorkspace('/onboarding/pilot', state);
  for (const name of ['name', 'area', 'services', 'equipment', 'rate']) assert.ok(pilot.includes(`name="${name}"`));
  assert.match(pilot, /data-form="pilot-onboarding"/);
  assert.doesNotMatch(pilot, /name="farmName"/);
});

test('dual-role account keeps both role switches and marks the active role', () => {
  const state = createState();
  state.profile.role = 'pilot';
  const html = renderWorkspace('/account', state);
  assert.match(html, /data-role="farmer" aria-pressed="false"/);
  assert.match(html, /data-role="pilot" aria-pressed="true"/);
});

test('pilot requests cannot present an enabled acceptance button before verification', () => {
  const state = createState();
  Object.assign(state.bookings[0], { direction: 'incoming' });
  const html = renderWorkspace('/pilot/requests', state);
  assert.match(html, /data-action="pilot-accept"[^>]*disabled/);
  assert.match(html, /verified pilot profile is required/i);
});

test('sample service actions make their offline-only effect explicit', () => {
  const state = createState();
  assert.match(renderDiscover(`/learn/courses/${COURSES[0].id}/book`, state), /No seat is reserved/);
  assert.match(renderDiscover(`/services/pilots/${PILOTS[0].id}/book`, state), /No pilot is contacted/);
  assert.match(renderWorkspace('/bookings/pilot-booking/chat', state), /Messages are not delivered/);
  assert.match(renderWorkspace('/weather/farm-1', state), /not live weather/);
  assert.match(renderWorkspace('/onboarding/pilot/verification', state), /status stays pending/);
});

test('payment stays attached to its order and cannot be mistaken for a live QR charge', () => {
  const state = createState();
  const review = renderWorkspace('/checkout/order-1', state);
  assert.match(review, /href="\/checkout\/order-1\/payment"/);
  const payment = renderWorkspace('/checkout/order-1/payment', state);
  assert.match(payment, /Scan to pay is not connected/i);
  assert.match(payment, /No money moves/);
  assert.match(payment, /no payable code or funds collected/i);
  assert.match(payment, /data-action="demo-payment"/);
  state.orders[0].status = 'demo-paid';
  assert.match(renderWorkspace('/checkout/order-1/payment', state), /data-action="demo-payment"[^>]*disabled/);
});

test('saved guide state and course enrollment lists reflect local records', () => {
  const state = createState();
  const guide = renderDiscover(`/learn/knowledge/${ARTICLES[0].slug}`, state);
  assert.match(guide, /data-action="save-article"[^>]*aria-pressed="true"/);
  const courses = renderDiscover('/learn/my-courses', state);
  assert.match(courses, /href="\/bookings\/course-booking"/);
  assert.doesNotMatch(courses, /href="\/bookings\/pilot-booking"/);
  assert.match(renderDiscover('/tools/saved', state), /-100 MYR/);
});

test('pilot booking without a farm leads to setup rather than an empty selector', () => {
  const state = createState();
  state.farms = [];
  const html = renderDiscover(`/services/pilots/${PILOTS[0].id}/book`, state);
  assert.match(html, /href="\/onboarding\/farmer"/);
  assert.doesNotMatch(html, /data-form="pilot-booking"/);
});

test('a task cannot be displayed under a different farm in the URL', () => {
  const state = createState();
  state.tasks[0].farmId = 'another-farm';
  const html = renderWorkspace('/farm/farm-1/tasks/soil', state);
  assert.match(html, /Task not found/);
  assert.doesNotMatch(html, /data-form="task"/);
});

test('Home prioritises a saved farm and excludes sample land from the area total', () => {
  const state = createState();
  state.profile.onboarded = true;
  state.farms.push({ id: 'real-farm', name: 'My vegetable farm', crop: 'Vegetables', area: 2.5, location: 'My town', unit: 'ha', plantedAt: '', plots: [] });
  const html = renderHome(state);
  assert.ok(html.includes('My vegetable farm'));
  assert.ok(!html.includes(INITIAL_STATE.farms[0].name));
  assert.match(html, /2\.5\s*<span>ha<\/span>/);
  assert.doesNotMatch(html, />6\.7\s*<span>ha<\/span>/);
});

test('farm creation stays in a native disclosure with one labelled form and no nested card', () => {
  const state = createState();
  const html = renderWorkspace('/farm', state);
  const disclosure = html.match(/<details\b[^>]*>([\s\S]*?)<\/details>/)?.[1];
  assert.ok(disclosure);
  assert.match(disclosure, /^<summary\b[^>]*>[\s\S]*Add a farm[\s\S]*<\/summary>/);
  assert.match(disclosure, /<form class="form-stack add-panel-body" data-form="farm" aria-label="Add a farm">/);
  assert.equal((disclosure.match(/<form\b/g) ?? []).length, 1);
  assert.doesNotMatch(disclosure, /<form[^>]*class="[^"]*\bcard\b/);
  assert.match(disclosure, /name="area" type="number"[^>]*required[^>]*min="0.01"/);
  assert.match(html, /class="farm-card-heading"/);
  assert.match(html, /class="farm-card-meta muted">Farm · Rice/);
});

test('adding another field stays available when existing fields fill the recorded farm area', () => {
  const state = createState();
  for (const plots of [state.farms[0].plots, []]) {
    state.farms[0].plots = plots;
    const html = renderWorkspace('/farm/farm-1', state);
    assert.doesNotMatch(html, /data-action="add-field"/);
    assert.doesNotMatch(html, /data-form="plot"|All farm area is assigned/);
    assert.match(html, /data-land-action="new"/);
  }
});

test('welcome occupies the greeting slot until an explicit role choice and is not duplicated below', () => {
  const state = createState();
  let html = renderHome(state);
  assert.match(html, /<h1[^>]*>Make yourself at home<\/h1>/);
  assert.doesNotMatch(html, /Good morning,|Good day,|class="setup-strip"/);
  applyAction(state, 'choose-role', '', 'farmer');
  html = renderHome(state);
  assert.doesNotMatch(html, /Make yourself at home/);
  assert.match(html, /Good morning,|Good day,/);
  assert.match(html, /Finish your setup/);
  state.profile.onboarded = true;
  delete state.profile.hasChosenRole;
  assert.doesNotMatch(renderHome(state), /Make yourself at home|Finish your setup/);
});

test('farmer onboarding omits size while ordinary farm creation retains it', () => {
  const state = createState();
  const onboarding = renderWorkspace('/onboarding/farmer', state);
  assert.doesNotMatch(onboarding, /name="area"|Farm area \(hectares\)/);
  assert.match(onboarding, /name="farmName"/);
  assert.match(renderWorkspace('/farm', state), /name="area"/);
});

test('all courses show Free across discovery, details, and booking forms', () => {
  const state = createState();
  for (const course of COURSES) {
    assert.equal(course.price, 0);
    for (const path of ['/learn', '/learn/courses', `/learn/courses/${course.id}`, `/learn/courses/${course.id}/book`]) {
      const html = renderDiscover(path, state);
      assert.match(html, />Free</, path);
      assert.doesNotMatch(html, /RM\s*[\d,]+/, path);
    }
  }
});

test('older local course bookings show Free while pilot estimates retain their price', () => {
  const state = createState();
  const courseHtml = renderWorkspace('/bookings/course-booking', state);
  assert.match(courseHtml, /Free/);
  assert.doesNotMatch(courseHtml, /RM\s*120/);
  assert.match(renderWorkspace('/bookings/pilot-booking', state), /RM\s*65/);
});

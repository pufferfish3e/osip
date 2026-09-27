const { test } = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { mkdir, mkdtemp, symlink, writeFile } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join, resolve } = require('node:path');
const { runInNewContext } = require('node:vm');

const ROOT = resolve(__dirname, '..');
const ORIGIN = 'https://osip.test';
const WORKER_SOURCE = readFileSync(resolve(ROOT, 'sw.js'), 'utf8');
const CURRENT_CACHE = `${WORKER_SOURCE.match(/const CACHE_PREFIX = '([^']+)';/)?.[1]}${WORKER_SOURCE.match(/const CACHE_NAME = `\$\{CACHE_PREFIX\}([^`]+)`;/)?.[1]}`;
const SHELL_BODY = '<main>OSIP app shell</main>';
const OFFLINE_BODY = '<main>OSIP offline fallback</main>';

/** @param {string} path @returns {string} */
const read = (path) => readFileSync(resolve(ROOT, path), 'utf8');

/** @param {Map<string, Response>} cached @returns {object} */
const cacheHarness = (cached) => ({
  async addAll(paths) {
    for (const path of paths) {
      const body = path === '/index.html' ? SHELL_BODY : path === '/offline.html' ? OFFLINE_BODY : path;
      cached.set(new URL(path, ORIGIN).href, new Response(body));
    }
  },
  async put(request, response) { cached.set(request.url, response.clone()); },
  async match(request) {
    const url = new URL(typeof request === 'string' ? request : request.url, ORIGIN);
    url.search = '';
    return cached.get(url.href)?.clone();
  },
});

/** @param {boolean} isOffline @returns {object} */
const workerHarness = (isOffline = false) => {
  const handlers = {};
  const cached = new Map();
  const retired = [];
  const network = [];
  const logs = [];
  const lifecycle = { claims: 0, skipped: 0 };
  const cache = cacheHarness(cached);
  const context = {
    URL, Set, Response,
    console: { warn(...args) { logs.push(args); }, error(...args) { logs.push(args); } },
    caches: { async open() { return cache; }, async keys() { return ['other-app-v1', 'osip-shell-v1', CURRENT_CACHE]; }, async delete(key) { retired.push(key); return true; } },
    fetch: async (request) => { network.push(request.url); if (isOffline) throw new Error('Offline test'); return new Response('Network response'); },
    self: {
      registration: { scope: `${ORIGIN}/` }, location: { origin: ORIGIN },
      clients: { async claim() { lifecycle.claims += 1; } },
      async skipWaiting() { lifecycle.skipped += 1; },
      addEventListener(name, handler) { handlers[name] = handler; },
    },
  };
  runInNewContext(read('sw.js'), context);
  return { handlers, retired, network, cached, lifecycle, logs };
};

/** @param {Function} handler @param {object} extra @returns {Promise<void>} */
const lifecycleEvent = async (handler, extra = {}) => {
  let pending;
  handler({ ...extra, waitUntil(promise) { pending = promise; } });
  await pending;
};

/** @param {object} harness @param {string} path @param {string} mode @returns {Promise<Response | undefined>} */
const workerRequest = async (harness, path, mode = 'navigate') => {
  let response;
  harness.handlers.fetch({ request: { url: new URL(path, ORIGIN).href, method: 'GET', mode }, respondWith(promise) { response = promise; } });
  return await response;
};

/** @param {object} context @param {string} root @returns {Promise<string>} */
const startTestServer = async (context, root = ROOT) => {
  const { createAppServer } = await import('../server.mjs');
  const server = createAppServer(root);
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(0, '127.0.0.1', resolveListen);
  });
  context.after(async () => { await new Promise((resolveClose, rejectClose) => server.close((error) => error ? rejectClose(error) : resolveClose())); });
  return `http://127.0.0.1:${server.address().port}`;
};

test('manifest installs at the root with standalone display and real PNG icons', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.display, 'standalone');
  assert.equal(new URL(manifest.start_url, ORIGIN).pathname, '/');
  assert.equal(new URL(manifest.scope, ORIGIN).pathname, '/');
  assert.ok(manifest.icons.some((icon) => icon.purpose === 'maskable'));
  for (const icon of manifest.icons) {
    const png = readFileSync(resolve(ROOT, icon.src.replace(/^\//, '')));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icon.sizes);
  }
});

test('precache contains every source module and the existing local production assets', async () => {
  const harness = workerHarness();
  await lifecycleEvent(harness.handlers.install);
  const paths = [...harness.cached.keys()].map((url) => new URL(url).pathname);
  for (const path of paths) assert.ok(existsSync(resolve(ROOT, path === '/' ? 'index.html' : path.slice(1))), path);
  for (const module of readdirSync(resolve(ROOT, 'src')).filter((name) => name.endsWith('.mjs'))) assert.ok(paths.includes(`/src/${module}`), module);
  for (const asset of ['/assets/app.css', '/assets/vendor/gsap.min.js', '/assets/icons.svg', '/assets/farm.jpg', '/assets/crops.jpg', '/assets/drone.jpg', '/assets/course.jpg']) assert.ok(paths.includes(asset), asset);
  assert.ok(!paths.some((path) => path.startsWith('/api/') || path.includes('node_modules') || path.includes('.agents')));
});

test('cache revision covers every shell file and is deterministic regardless of enumeration order', async () => {
  const { computeCacheRevision } = await import('../scripts/build.mjs');
  const harness = workerHarness();
  await lifecycleEvent(harness.handlers.install);
  const paths = [...harness.cached.keys()].map((url) => new URL(url).pathname);
  const contents = new Map(paths.map((path) => [path, readFileSync(resolve(ROOT, path === '/' ? 'index.html' : path.slice(1)))]));
  const revision = computeCacheRevision(paths, (path) => contents.get(path));
  assert.equal(CURRENT_CACHE, `osip-shell-v3-${revision}`, 'Run npm run build after changing app assets.');
  assert.equal(computeCacheRevision([...paths].reverse(), (path) => contents.get(path)), revision);
  for (const changedPath of paths) {
    const changedRevision = computeCacheRevision(paths, (path) => path === changedPath ? Buffer.concat([contents.get(path), Buffer.from('changed')]) : contents.get(path));
    assert.notEqual(changedRevision, revision, `${changedPath} must invalidate the cache.`);
  }
});

test('known deep app routes return the cached shell offline, including query navigation', async () => {
  const harness = workerHarness(true);
  await lifecycleEvent(harness.handlers.install);
  for (const path of ['/', '/learn/knowledge/soil?source=saved', '/farm/farm-1/schedule', '/services/pilots/azlan/book', '/bookings/local/chat', '/checkout/local/payment', '/onboarding/pilot', '/plant-help', '/plant-help/camera', '/plant-help/guides/aphids']) {
    const response = await workerRequest(harness, path);
    assert.equal(await response.text(), SHELL_BODY, path);
  }
  assert.equal(harness.network.length, 0);
});

test('unknown navigation uses the network online and the offline document when disconnected', async () => {
  const online = workerHarness();
  await lifecycleEvent(online.handlers.install);
  assert.equal(await (await workerRequest(online, '/unknown-page')).text(), 'Network response');
  const offline = workerHarness(true);
  await lifecycleEvent(offline.handlers.install);
  assert.equal(await (await workerRequest(offline, '/farmhouse')).text(), OFFLINE_BODY);
  assert.deepEqual(offline.network, [`${ORIGIN}/farmhouse`]);
  assert.equal(offline.logs.length, 1);
});

test('worker intercepts only listed static assets and bypasses APIs, POST and external requests', async () => {
  const harness = workerHarness(true);
  await lifecycleEvent(harness.handlers.install);
  assert.equal(await (await workerRequest(harness, '/assets/app.css?v=3', 'cors')).text(), '/assets/app.css');
  for (const request of [
    { url: `${ORIGIN}/api/private`, method: 'GET', mode: 'navigate' },
    { url: `${ORIGIN}/api/plant-analysis`, method: 'POST', mode: 'cors' },
    { url: `${ORIGIN}/api`, method: 'GET', mode: 'navigate' },
    { url: `${ORIGIN}/assets/user-photo.jpg`, method: 'GET', mode: 'cors' },
    { url: `${ORIGIN}/src/private-data.json`, method: 'GET', mode: 'cors' },
    { url: 'https://external.test/script.js', method: 'GET', mode: 'cors' },
    { url: `${ORIGIN}/bookings`, method: 'POST', mode: 'navigate' },
  ]) harness.handlers.fetch({ request, respondWith() { assert.fail(`Must bypass: ${request.url}`); } });
});

test('updates wait for an explicit message and activation retains unrelated caches', async () => {
  const harness = workerHarness();
  await lifecycleEvent(harness.handlers.install);
  assert.equal(harness.lifecycle.skipped, 0);
  await lifecycleEvent(harness.handlers.message, { data: { type: 'UNKNOWN' } });
  assert.equal(harness.lifecycle.skipped, 0);
  await lifecycleEvent(harness.handlers.message, { data: { type: 'SKIP_WAITING' } });
  assert.equal(harness.lifecycle.skipped, 1);
  await lifecycleEvent(harness.handlers.activate);
  assert.deepEqual(harness.retired, ['osip-shell-v1']);
  assert.equal(harness.lifecycle.claims, 1);
});

test('static server supports deep links, JavaScript MIME types, HEAD and method rejection', async (context) => {
  const origin = await startTestServer(context);
  const deepLink = await fetch(`${origin}/learn/knowledge/getting-to-know-your-soil`);
  assert.equal(deepLink.status, 200);
  assert.equal(await deepLink.text(), read('index.html'));
  const fieldModule = await fetch(`${origin}/src/field-boundary.mjs`);
  assert.equal(fieldModule.status, 200);
  assert.match(fieldModule.headers.get('content-type'), /text\/javascript/);
  const module = await fetch(`${origin}/src/discover.mjs`);
  assert.match(module.headers.get('content-type'), /text\/javascript/);
  assert.equal(module.headers.get('x-content-type-options'), 'nosniff');
  const manifest = await fetch(`${origin}/manifest.webmanifest`);
  assert.match(manifest.headers.get('content-type'), /application\/manifest\+json/);
  const head = await fetch(`${origin}/index.html`, { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), '');
  const post = await fetch(`${origin}/bookings`, { method: 'POST' });
  assert.equal(post.status, 405);
  assert.equal(post.headers.get('allow'), 'GET, HEAD');
});

test('static server rejects private files, route-prefix lookalikes and encoded traversal', async (context) => {
  const origin = await startTestServer(context);
  for (const path of ['/package.json', '/server.mjs', '/AGENTS.md', '/.git/config', '/.agents/skills/test', '/node_modules/gsap/package.json', '/src/private.mjs', '/api/private', '/farmhouse']) {
    assert.equal((await fetch(`${origin}${path}`)).status, 404, path);
  }
  assert.equal((await fetch(`${origin}/assets/%2e%2e%2fpackage.json`)).status, 403);
  assert.equal((await fetch(`${origin}/%E0%A4%A`)).status, 400);
});

test('allowlisted symlinks cannot expose external or private files', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'osip-server-boundary-'));
  const root = join(directory, 'site');
  await mkdir(join(root, 'assets'), { recursive: true });
  await writeFile(join(directory, 'outside.txt'), 'Outside the public root');
  await writeFile(join(root, 'private.txt'), 'Private file inside root');
  await symlink(join(directory, 'outside.txt'), join(root, 'assets', 'mark.svg'));
  await symlink(join(root, 'private.txt'), join(root, 'assets', 'icon-192.png'));
  const origin = await startTestServer(context, root);
  const response = await fetch(`${origin}/assets/mark.svg`);
  assert.equal(response.status, 403);
  assert.ok(!(await response.text()).includes('Outside the public root'));
  assert.equal((await fetch(`${origin}/assets/icon-192.png`)).status, 403);
});

test('article bodies and figures cache on demand and remain readable offline', async () => {
  const online = workerHarness();
  const path = '/content/articles/PMC123.json';
  assert.equal(await (await workerRequest(online, path, 'cors')).text(), 'Network response');
  assert.ok(online.cached.has(`${ORIGIN}${path}`));
  await workerRequest(online, path, 'cors');
  assert.equal(online.network.length, 1);
  const offline = workerHarness(true);
  offline.cached.set(`${ORIGIN}${path}`, online.cached.get(`${ORIGIN}${path}`));
  assert.equal(await (await workerRequest(offline, path, 'cors')).text(), 'Network response');
  assert.equal((await workerRequest(offline, '/content/articles/PMC999.json', 'cors')).status, 503);
});

test('opening a cached article figure in a new tab works offline', async () => {
  const harness = workerHarness(true);
  const path = '/content/articles/PMC123-figure-1.jpg';
  harness.cached.set(`${ORIGIN}${path}`, new Response('image data'));
  assert.equal(await (await workerRequest(harness,path,'navigate')).text(),'image data');
  assert.equal(harness.network.length,0);
});

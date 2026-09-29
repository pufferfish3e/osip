const CACHE_PREFIX = 'osip-shell-';
// The build fingerprints shell content so browsers discover asset updates.
const CACHE_NAME = `${CACHE_PREFIX}v3-b5983b685c55ed6d`;
const SHELL_FILES = [
  '/src/booking-dates.mjs',
  '/src/record-id.mjs',
  '/src/translation.mjs', '/src/locales/supplemental.mjs',
  '/src/task-history.mjs',
  '/src/shop-deals.mjs',
  '/data/active.json', '/data/demo.json', '/data/newuser.json', '/src/storage-seed.mjs',
  '/src/real-products.mjs', '/src/land-covers.mjs',
  '/src/malaysia-articles.mjs',
  '/src/mixture-planner.mjs',
  '/assets/shop-power.jpg', '/assets/shop-weather.jpg',
  '/assets/article-aphids.jpg', '/assets/article-caterpillars.jpg', '/assets/article-leafminers.jpg', '/assets/article-rice-blast.jpg', '/assets/article-rice-planthoppers.jpg', '/assets/article-snails.jpg', '/assets/article-water-stress.jpg', '/assets/article-waterlogging.jpg', '/assets/article-whiteflies.jpg', '/assets/article-yellow-leaves.jpg',
  '/', '/index.html', '/offline.html', '/src/browser-app.mjs', '/manifest.webmanifest',
  '/src/open-articles.mjs', '/src/article-reader.mjs', '/src/extension-articles.mjs', '/src/article-catalogue.mjs', '/src/article-library.mjs', '/src/data.mjs', '/src/store.mjs', '/src/spray-calculator.mjs', '/src/calculators.mjs', '/src/profile-photo.mjs', '/src/ui.mjs', '/src/shell.mjs',
  '/src/home.mjs', '/src/workspace.mjs', '/src/discover.mjs', '/src/pilot-matcher.mjs', '/src/expert-data.mjs', '/src/expert-ui.mjs', '/src/keypad-calculator.mjs', '/src/actions.mjs', '/src/pwa.mjs', '/src/drafts.mjs',
  '/src/land-editor.mjs', '/src/land-records.mjs', '/src/land-grid.mjs', '/src/land-setup.mjs', '/src/field-boundary.mjs', '/src/land-boundary.mjs', '/src/land-map.mjs', '/src/field-care.mjs', '/src/schedule.mjs', '/src/plant-web.mjs', '/src/plant-action.mjs', '/src/plant-guides.mjs', '/src/plant-help.mjs', '/src/plant-photo.mjs',
  '/src/i18n.mjs', '/src/language.mjs', '/src/locales/core.mjs', '/src/locales/workspace.mjs', '/src/locales/discover.mjs', '/src/locales/plant.mjs',
  '/assets/vendor/leaflet.js', '/assets/vendor/leaflet.css', '/assets/app.css', '/assets/aura-brand.css', '/assets/vendor/gsap.min.js', '/assets/icons.svg', '/assets/mark.svg', '/assets/avatar-default.svg',
  '/assets/expert-farid.jpg',
  '/assets/expert-aisyah.jpg',
  '/assets/expert-hafiz.jpg',
  '/assets/expert-weiling.jpg',
  '/assets/expert-meiyin.jpg',
  '/assets/expert-suresh.jpg',
  '/assets/expert-nirmala.jpg',
  '/assets/expert-liang.jpg',
  '/assets/expert-nurul.jpg',
  '/assets/expert-zulkifli.jpg',
  '/assets/expert-salmah.jpg',
  '/assets/expert-roshani.jpg',
  '/assets/expert-arun.jpg',
  '/assets/expert-chong.jpg',
  '/assets/expert-nadia.jpg',
  '/assets/expert-azhar.jpg',
  '/assets/expert-shanti.jpg',
  '/assets/expert-siew.jpg',
  '/assets/expert-lina.jpg',
  '/assets/expert-ying.jpg',
  '/assets/expert-faizal.jpg',
  '/assets/expert-rizal.jpg',
  '/assets/expert-kavitha.jpg',
  '/assets/expert-kamal.jpg',
  '/assets/expert-diana.jpg',
  '/assets/pilot-kelvin.jpg',
  '/assets/pilot-siti.jpg',
  '/assets/pilot-hakim.jpg',
  '/assets/pilot-ravi.jpg',
  '/assets/pilot-amir.jpg',
  '/assets/pilot-joanne.jpg',
  '/assets/pilot-nabil.jpg',
  '/assets/pilot-izzat.jpg',
  '/assets/pilot-azlan.webp', '/assets/pilot-maya.webp', '/assets/pilot-daniel.webp', '/assets/profile-ahmad.jpg', '/assets/farm.jpg', '/assets/crops.jpg', '/assets/drone.jpg', '/assets/course.jpg',
  '/assets/pilot-azlan.png', '/assets/pilot-maya.png', '/assets/pilot-daniel.png',
  '/assets/learn-soil.jpg', '/assets/learn-soil-thumb.jpg', '/assets/learn-water.jpg', '/assets/learn-water-thumb.jpg', '/assets/learn-scouting.jpg', '/assets/learn-scouting-thumb.jpg', '/assets/learn-harvest.jpg', '/assets/learn-harvest-thumb.jpg',
  '/assets/icon-192.png', '/assets/icon-512.png', '/assets/icon-maskable.png',
];
const SHELL_PATHS = new Set(SHELL_FILES);
// Photos are cached when viewed, rather than downloading every directory portrait
// and article illustration during first launch or every application update.
const INSTALL_FILES = SHELL_FILES.filter((path) => !/\.(?:jpg|png|webp)$/.test(path) || path.startsWith('/assets/icon-'));
const APP_ROUTES = ['/schedule', '/farm', '/learn', '/services', '/tools', '/weather', '/onboarding', '/auth', '/account', '/notifications', '/bookings', '/messages', '/pilot', '/shop', '/checkout', '/orders', '/news', '/plant-help'];

/** @param {string} pathname @returns {boolean} */
const isAppRoute = (pathname) => pathname === '/' || pathname === '/index.html'
  || APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));

/** @returns {Promise<void>} */
const installShell = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(INSTALL_FILES);
  } catch (error) {
    console.error('Aura offline installation failed.', error);
    throw error;
  }
};

/** @returns {Promise<void>} */
const activateShell = async () => {
  try {
    const keys = await caches.keys();
    for (const key of keys) {
      if (key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  } catch (error) {
    console.error('Aura offline activation failed.', error);
    throw error;
  }
};

/** @returns {Promise<Response>} */
const offlineResponse = async () => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const fallback = await cache.match('/offline.html');
    if (fallback) return fallback;
  } catch (error) {
    console.error('Aura offline fallback is unavailable.', error);
  }
  return new Response('You are offline. Open Aura after reconnecting.', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};

/** @param {Request} request @returns {Promise<Response>} */
const respondFromShell = async (request) => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      try { await cache.put(request, response.clone()); }
      catch (error) { console.warn('Aura asset could not be saved offline.', error); }
    }
    return response;
  } catch (error) {
    console.warn('Aura asset is unavailable offline.', error);
    return new Response('Asset unavailable offline.', { status: 503 });
  }
};

/** @param {Request} request @returns {Promise<Response>} */
const respondToNavigation = async (request) => {
  try {
    if (isAppRoute(new URL(request.url).pathname)) {
      const cache = await caches.open(CACHE_NAME);
      const shell = await cache.match('/index.html');
      if (shell) return shell;
    }
    return await fetch(request);
  } catch (error) {
    console.warn('Aura page is unavailable offline.', error);
    return await offlineResponse();
  }
};

/** @returns {Promise<void>} */
const applyUpdate = async () => {
  try {
    await self.skipWaiting();
  } catch (error) {
    console.error('Aura update could not activate.', error);
    throw error;
  }
};

/** @param {Request} request @returns {Promise<Response>} */
const respondToArticle = async (request) => {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
      try { await cache.put(request, response.clone()); }
      catch (error) { console.warn('Article could not be cached.', error); }
    }
    return response;
  } catch (error) {
    console.warn('Article unavailable offline.', error);
    return new Response('Article unavailable offline.', {status: 503});
  }
};

self.addEventListener('install', (event) => { event.waitUntil(installShell()); });
self.addEventListener('activate', (event) => { event.waitUntil(activateShell()); });
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(applyUpdate());
  if (event.data?.type === 'CACHE_VIEWED_PHOTOS' && Array.isArray(event.data.paths)) {
    const photos = [...new Set(event.data.paths)].filter((path) => SHELL_PATHS.has(path) && /\.(?:jpg|webp|png)$/.test(path)).slice(0, 40);
    event.waitUntil(Promise.all(photos.map((path) => respondFromShell(new Request(new URL(path, self.location.origin))))));
  }
});
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  if (/^\/content\/articles\/PMC\d+(?:-figure-\d+)?\.(json|jpg|png)$/.test(url.pathname)) {
    event.respondWith(respondToArticle(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(respondToNavigation(request));
    return;
  }
  if (SHELL_PATHS.has(url.pathname)) event.respondWith(respondFromShell(request));
});

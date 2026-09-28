import { createMockChatHandler } from './server/mock-chat.mjs';
import { createSprayConfigHandler } from './server/spray-config.mjs';
import { readFile, realpath, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { OPEN_ARTICLE_FILES } from './src/open-articles.mjs';
import { createPlantSearchHandler } from './server/plant-search.mjs';
import { createPlantAnalysisHandler } from './server/plant-analysis.mjs';

const ROOT = dirname(fileURLToPath(import.meta.url));
const HOST = '0.0.0.0';
const DEFAULT_PORT = 4173;
const MAX_PORT = 65535;
const ROUTE_PREFIXES = ['/schedule', '/farm', '/learn', '/services', '/tools', '/weather', '/onboarding', '/auth', '/account', '/notifications', '/bookings', '/messages', '/pilot', '/shop', '/checkout', '/orders', '/news', '/plant-help'];
const PUBLIC_FILES = new Set([
  '/src/task-history.mjs',
  '/src/shop-deals.mjs',
  '/data/active.json', '/data/demo.json', '/data/newuser.json', '/src/storage-seed.mjs',
  '/src/real-products.mjs', '/src/land-covers.mjs',
  '/src/mixture-planner.mjs',
  '/assets/shop-power.jpg', '/assets/shop-weather.jpg',
  ...OPEN_ARTICLE_FILES,
  '/src/malaysia-articles.mjs',
  '/assets/article-aphids.jpg', '/assets/article-caterpillars.jpg', '/assets/article-leafminers.jpg', '/assets/article-rice-blast.jpg', '/assets/article-rice-planthoppers.jpg', '/assets/article-snails.jpg', '/assets/article-water-stress.jpg', '/assets/article-waterlogging.jpg', '/assets/article-whiteflies.jpg', '/assets/article-yellow-leaves.jpg',
  '/src/land-editor.mjs', '/src/land-records.mjs', '/src/land-grid.mjs', '/src/land-setup.mjs', '/src/field-boundary.mjs', '/src/land-boundary.mjs', '/src/land-map.mjs', '/src/field-care.mjs', '/src/schedule.mjs',
  '/assets/vendor/leaflet.js', '/assets/vendor/leaflet.css',
  '/index.html', '/offline.html', '/src/browser-app.mjs', '/sw.js', '/manifest.webmanifest',
  '/src/open-articles.mjs', '/src/article-reader.mjs', '/src/extension-articles.mjs', '/src/article-catalogue.mjs', '/src/article-library.mjs', '/src/data.mjs', '/src/store.mjs', '/src/spray-calculator.mjs', '/src/calculators.mjs', '/src/profile-photo.mjs', '/src/ui.mjs', '/src/shell.mjs',
  '/src/home.mjs', '/src/workspace.mjs', '/src/discover.mjs', '/src/pilot-matcher.mjs', '/src/expert-data.mjs', '/src/expert-ui.mjs', '/src/keypad-calculator.mjs', '/src/actions.mjs', '/src/pwa.mjs', '/src/drafts.mjs',
  '/src/plant-web.mjs', '/src/plant-action.mjs', '/src/plant-guides.mjs', '/src/plant-help.mjs', '/src/plant-photo.mjs',
  '/src/i18n.mjs', '/src/language.mjs', '/src/locales/core.mjs', '/src/locales/workspace.mjs', '/src/locales/discover.mjs', '/src/locales/plant.mjs',
  '/assets/app.css', '/assets/aura-brand.css', '/assets/vendor/gsap.min.js', '/assets/icons.svg', '/assets/mark.svg', '/assets/avatar-default.svg',
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
]);
const MIME_TYPES = new Map([
  ['.html', 'text/html; charset=utf-8'], ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'], ['.css', 'text/css; charset=utf-8'],
  ['.webmanifest', 'application/manifest+json; charset=utf-8'], ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'], ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.webp', 'image/webp'],
]);
const STATUS = { ok: 200, badRequest: 400, forbidden: 403, notFound: 404, methodNotAllowed: 405, error: 500 };
// Preserve existing directory URLs while serving the smaller image format.
const PUBLIC_ASSET_ALIASES = new Map([
  ['/assets/pilot-azlan.png', '/assets/pilot-azlan.webp'],
  ['/assets/pilot-maya.png', '/assets/pilot-maya.webp'],
  ['/assets/pilot-daniel.png', '/assets/pilot-daniel.webp'],
]);

/** Invalid requests must not be mistaken for missing app routes. */
class RequestPathError extends Error {
  /** @param {string} message @param {number} status */
  constructor(message, status) {
    super(message);
    this.name = 'RequestPathError';
    this.status = status;
  }
}

/** @param {string} target @returns {string} */
const publicPath = (target) => {
  let pathname;
  try {
    pathname = decodeURIComponent(target.split('?')[0]);
  } catch (error) {
    if (error instanceof URIError) throw new RequestPathError('Invalid path encoding.', STATUS.badRequest);
    throw error;
  }
  if (!pathname.startsWith('/') || pathname.includes('\\') || pathname.includes('\0')) {
    throw new RequestPathError('Invalid path.', STATUS.badRequest);
  }
  if (pathname.split('/').some((segment) => segment === '..' || segment === '.')) {
    throw new RequestPathError('Path traversal is not allowed.', STATUS.forbidden);
  }
  if (pathname === '/' || ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return '/index.html';
  if (PUBLIC_FILES.has(pathname)) return PUBLIC_ASSET_ALIASES.get(pathname) ?? pathname;
  throw new RequestPathError('Not found.', STATUS.notFound);
};

/** @param {string} root @param {string} pathname @returns {Promise<string>} */
const containedFile = async (root, pathname) => {
  const rootPath = await realpath(root);
  const filePath = await realpath(resolve(rootPath, pathname.slice(1)));
  const relativePath = relative(rootPath, filePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new RequestPathError('File is outside the public root.', STATUS.forbidden);
  }
  if (!PUBLIC_FILES.has(`/${relativePath.split(sep).join('/')}`)) throw new RequestPathError('File is not public.', STATUS.forbidden);
  if (!(await stat(filePath)).isFile()) throw new RequestPathError('Not found.', STATUS.notFound);
  return filePath;
};

/** @param {import('node:http').ServerResponse} response @param {number} status @param {string} text @param {boolean} isHead @returns {void} */
const textResponse = (response, status, text, isHead) => {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(isHead ? undefined : text);
};

/** @param {unknown} error @returns {boolean} */
const isMissingFile = (error) => error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR');

/** @param {import('node:http').IncomingMessage} request @param {import('node:http').ServerResponse} response @param {string} root @returns {Promise<void>} */
const serveRequest = async (request, response, root) => {
  const isHead = request.method === 'HEAD';
  if (request.method !== 'GET' && !isHead) {
    response.setHeader('Allow', 'GET, HEAD');
    textResponse(response, STATUS.methodNotAllowed, 'Method not allowed.', false);
    return;
  }
  try {
    const pathname = publicPath(request.url ?? '/');
    const filePath = await containedFile(root, pathname);
    const content = await readFile(filePath);
    const etag = `"${createHash('sha256').update(content).digest('hex')}"`;
    // Public files contain no account data. Cache them at Vercel's edge; browsers
    // revalidate stable filenames so a deployment cannot strand an old app shell.
    const headers = { 'Content-Type': MIME_TYPES.get(extname(pathname)) ?? 'application/octet-stream', 'Cache-Control': pathname === '/sw.js' ? 'no-cache' : 'public, max-age=0, must-revalidate', 'ETag': etag, 'X-Content-Type-Options': 'nosniff' };
    if (pathname !== '/sw.js') headers['Vercel-CDN-Cache-Control'] = 'public, max-age=86400';
    if (request.headers['if-none-match']?.split(',').some((value) => value.trim().replace(/^W\//, '') === etag)) {
      response.writeHead(304, headers);
      response.end();
      return;
    }
    headers['Content-Length'] = content.byteLength;
    response.writeHead(STATUS.ok, headers);
    response.end(isHead ? undefined : content);
  } catch (error) {
    if (error instanceof RequestPathError) textResponse(response, error.status, error.message, isHead);
    else if (isMissingFile(error)) textResponse(response, STATUS.notFound, 'Not found.', isHead);
    else {
      console.error('OSIP could not serve a request.', error);
      textResponse(response, STATUS.error, 'Unable to serve this page.', isHead);
    }
  }
};

/** @param {string} root @param {import('./server/plant-analysis.mjs').AnalysisOptions} analysisOptions @returns {import('node:http').Server} */
export function createAppServer(root = ROOT, analysisOptions = {}) {
  const handleMockChat = createMockChatHandler(analysisOptions);
  const handlePlantAnalysis = createPlantAnalysisHandler(analysisOptions);
  const handleSprayConfig = createSprayConfigHandler(analysisOptions);
  const handlePlantSearch = createPlantSearchHandler(analysisOptions);
  return createServer(async (request, response) => {
    try {
      if (request.url?.split('?')[0] === '/api/mock-chat') { await handleMockChat(request, response); return; }
      if (request.url?.split('?')[0] === '/api/spray-config') { await handleSprayConfig(request, response); return; }
      if (request.url?.split('?')[0] === '/api/plant-search') {
        await handlePlantSearch(request, response);
        return;
      }
      if (request.url?.split('?')[0] === '/api/plant-analysis') {
        await handlePlantAnalysis(request, response);
        return;
      }
      await serveRequest(request, response, root);
    } catch (error) {
      console.error('OSIP request handler failed.', error);
      if (!response.headersSent) textResponse(response, STATUS.error, 'Unable to serve this page.', request.method === 'HEAD');
      else response.destroy(error instanceof Error ? error : new Error('Request failed.'));
    }
  });
}

/** @returns {Promise<void>} */
const startServer = async () => {
  const port = Number(process.env.PORT ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > MAX_PORT) throw new Error('PORT must be an integer from 1 to 65535.');
  const server = createAppServer();
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, HOST, () => {
      server.removeListener('error', rejectListen);
      console.log(`OSIP is running at http://${HOST}:${port}`);
      resolveListen(undefined);
    });
  });
  server.on('error', (error) => { console.error('OSIP server error.', error); });
};

const IS_DIRECT_ENTRY = Boolean(process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url);
if (IS_DIRECT_ENTRY) {
  try {
    await startServer();
  } catch (error) {
    console.error('OSIP server could not start.', error);
    process.exitCode = 1;
  }
}

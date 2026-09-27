import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = new URL('../', import.meta.url);
const CACHE_REVISION_LENGTH = 16;
const CACHE_NAME_PATTERN = /const CACHE_NAME = `\$\{CACHE_PREFIX\}[^`]+`;/;
/** @param {string} path @returns {string} */
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8');

/** @param {string[]} paths @param {(path:string)=>Uint8Array} readAsset @returns {string} */
export function computeCacheRevision(paths, readAsset) {
  const hash = createHash('sha256');
  for (const path of [...new Set(paths)].sort()) {
    const content = readAsset(path);
    hash.update(`${path}\0${content.byteLength}\0`);
    hash.update(content);
  }
  return hash.digest('hex').slice(0, CACHE_REVISION_LENGTH);
}

/** @returns {string} */
const updateWorkerRevision = () => {
  const worker = read('sw.js');
  const shellList = worker.match(/const SHELL_FILES = \[([\s\S]*?)\];/)?.[1];
  if (!shellList || !CACHE_NAME_PATTERN.test(worker)) throw new Error('Service worker cache markers are missing.');
  const paths = [...shellList.matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]);
  if (!paths.length) throw new Error('Service worker shell list is empty.');
  const revision = computeCacheRevision(paths, (path) => readFileSync(new URL(path === '/' ? 'index.html' : path.slice(1), ROOT)));
  const updated = worker.replace(CACHE_NAME_PATTERN, `const CACHE_NAME = \`\${CACHE_PREFIX}v3-${revision}\`;`);
  if (updated !== worker) writeFileSync(new URL('sw.js', ROOT), updated);
  return revision;
};

/** @returns {Set<string>} */
const findIcons = () => {
  const source = ['app.js', ...readdirSync(new URL('src/', ROOT)).filter((name) => name.endsWith('.mjs')).sort().map((name) => `src/${name}`)].map(read).join('\n');
  const iconNames = new Set([...source.matchAll(/icon\(['"]([a-z0-9-]+)['"]/g)].map((match) => match[1]));
  // Dynamic navigation, task, and service icons share this small explicit allowlist.
  for (const name of ['tool','shield','scissors','home','plant-2','book','drone','calculator','calendar','droplet','arrow-up-right','bell','sun','wind','message-circle','settings','user','school','shopping-bag','heart','map','map-pin','check','plus','cloud','cloud-rain','chevron-right','arrow-left','arrow-right','bookmark','search','clock','minus','credit-card','shield-check','adjustments','chart-bar','crop','pencil','trash','crosshair','wallet','ruler','leaf','download','x','logout','circle-check','circle','dots','menu-2','external-link','refresh','compass','alert-circle','chevron-down','send','arrow-up','device-mobile']) iconNames.add(name);
  return iconNames;
};

/** @returns {void} */
const buildAssets = () => {
  const iconNames = findIcons();
  const symbols = [...iconNames].sort().map((name) => {
    const svg = read(`node_modules/@tabler/icons/icons/outline/${name}.svg`);
    return `<symbol id="${name}" viewBox="0 0 24 24">${svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '')}</symbol>`;
  });
  mkdirSync(new URL('assets/vendor/', ROOT), { recursive: true });
  writeFileSync(new URL('assets/icons.svg', ROOT), `<svg xmlns="http://www.w3.org/2000/svg">${symbols.join('')}</svg>`);
  for (const name of ['leaflet.js', 'leaflet.css']) copyFileSync(new URL(`node_modules/leaflet/dist/${name}`, ROOT), new URL(`assets/vendor/${name}`, ROOT));
  copyFileSync(new URL('node_modules/gsap/dist/gsap.min.js', ROOT), new URL('assets/vendor/gsap.min.js', ROOT));
  execFileSync(new URL('node_modules/.bin/tailwindcss', ROOT).pathname, ['-i', 'styles.css', '-o', 'assets/app.css', '--minify'], { cwd: ROOT, stdio: 'inherit' });
  console.log(`Built local CSS, GSAP, ${iconNames.size} icons, and offline revision ${updateWorkerRevision()}.`);
};

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    buildAssets();
  } catch (error) {
    console.error('OSIP build failed.', error);
    process.exitCode = 1;
  }
}

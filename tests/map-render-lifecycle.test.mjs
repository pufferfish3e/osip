import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';

const APP_SOURCE = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const RENDER_START = APP_SOURCE.indexOf('const render = (shouldAnimate = false) => {');
const RENDER_END = APP_SOURCE.indexOf('  initializeSchedule(MAIN);', RENDER_START);
const RENDER_LIFECYCLE = `${APP_SOURCE.slice(RENDER_START, RENDER_END)} }; globalThis.renderPage = render;`;
const MAP_SELECTORS = ['[data-farm-map]', '[data-land-setup]', '[data-land-editor]'];

/** @param {string} selector @returns {void} */
const verifyNavigation = (selector) => {
  let activeSelector = selector;
  const removals = [];
  const initialize = () => {
    const map = { isRemoved: false };
    removals.push(map);
    return () => {
      if (map.isRemoved) throw new Error('Map container is being reused by another instance');
      map.isRemoved = true;
    };
  };
  const context = {
    disposeLandMap: () => {}, disposeSprayCalculator: () => {}, animationContext: null,
    plantWebRequest: null, plantQuery: '', plantCategory: 'all',
    window: { location: { pathname: '/farm' }, L: {} }, document: {},
    STORE: { getState: () => ({ profile: {} }) }, PHOTO: { reset: () => {} },
    MAIN: { querySelector: (value) => value === activeSelector ? {} : null },
    renderShell: () => {}, localizeDocument: () => {}, renderPlantHelp: () => '',
    initializeLandMap: initialize, initializeLandSetup: initialize, initializeLandEditor: initialize,
  };
  runInNewContext(RENDER_LIFECYCLE, context);
  context.renderPage();
  activeSelector = '';
  context.renderPage(); context.renderPage();
  activeSelector = selector;
  context.renderPage(); context.renderPage();
  activeSelector = '';
  context.renderPage(); context.renderPage();
  assert.equal(removals.length, 3);
  assert.ok(removals.every((map) => map.isRemoved));
};

for (const selector of MAP_SELECTORS) {
  test(`${selector} cleans up once across navigation, screen updates and remounts`, () => {
    verifyNavigation(selector);
  });
}

import assert from 'node:assert/strict';
import { test } from 'node:test';
import NEW_USER from '../data/newuser.json' with { type: 'json' };
import DEMO from '../data/demo.json' with { type: 'json' };
import { renderHome } from '../src/home.mjs';

test('home displays an add action when no land exists and a summary when it does', () => {
  const emptyHtml = renderHome(NEW_USER);
  assert.match(emptyHtml, /No land added yet/);
  assert.match(emptyHtml, /href="\/farm\/new"[^>]*>.*Add land/);
  assert.doesNotMatch(emptyHtml, /0 land parcel|View my land/);

  const landHtml = renderHome(DEMO);
  assert.match(landHtml, /Your growing space/);
  assert.match(landHtml, /View my land/);
  assert.doesNotMatch(landHtml, /No land added yet/);
});

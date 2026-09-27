import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { setLocale, t } from '../src/i18n.mjs';
import { STORAGE_KEY } from '../src/store.mjs';

const read = (name) => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');

test('Aura branding appears in browser metadata, PWA identity and navigation', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.short_name, 'Aura');
  assert.match(manifest.name, /^Aura/);
  assert.equal(manifest.id, '/');
  assert.match(read('index.html'), /<title>Aura — Your field companion<\/title>/);
  assert.match(read('src/shell.mjs'), />aura<span>/);
  for (const name of ['index.html', 'app.js', 'src/shell.mjs', 'src/workspace.mjs', 'src/pwa.mjs']) assert.doesNotMatch(read(name), /Osip|OSIP/);
  assert.equal(STORAGE_KEY, 'osip-state-v2');
});

test('translated branding keeps the Aura name', () => {
  try {
    for (const locale of ['en', 'ms', 'zh-Hans']) {
      setLocale(locale);
      for (const label of ['Aura home', 'Take Aura to the field', 'How will you use Aura?', 'Aura is already installed.']) {
        assert.match(t(label), /Aura/);
        assert.doesNotMatch(t(label), /Osip|OSIP/);
      }
    }
  } finally { setLocale('en'); }
});

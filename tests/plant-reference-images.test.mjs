import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findPlantReferenceImages } from '../server/plant-reference-images.mjs';

test('reference search keeps licensed, relevant Commons images and their credits', async () => {
  const fetcher = async (url) => {
    assert.match(url, /commons\.wikimedia\.org\/w\/api\.php/);
    return Response.json({ query: { pages: [
      { title: 'File:Aphids on a stem.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/aphids.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Aphids_on_a_stem.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC BY 4.0' }, Artist: { value: 'Field photographer' } } }] },
      { title: 'File:Aphid close-up.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/unlicensed.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Aphid_close-up.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'All rights reserved' } } }] },
      { title: 'File:Ladybird.jpg', imageinfo: [{ thumburl: 'https://upload.wikimedia.org/ladybird.jpg', descriptionurl: 'https://commons.wikimedia.org/wiki/File:Ladybird.jpg', mime: 'image/jpeg', extmetadata: { LicenseShortName: { value: 'CC0' } } }] },
    ] } });
  };
  const images = await findPlantReferenceImages('aphids', fetcher);
  assert.equal(images.length, 1);
  assert.equal(images[0].credit, 'Field photographer · CC BY 4.0');
  assert.deepEqual(await findPlantReferenceImages('yellow-leaves', fetcher), []);
});

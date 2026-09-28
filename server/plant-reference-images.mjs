// Only show Commons thumbnails with an explicit reuse licence and matching title.
const QUERIES = { aphids: 'aphids insect', whiteflies: 'whitefly insect', leafminers: 'leafminer leaf', caterpillars: 'caterpillar leaf', 'rice-planthoppers': 'planthopper insect', 'rice-blast': 'rice blast leaf' };
const MATCH = { aphids: /aphids?/i, whiteflies: /whitefl(?:y|ies)/i, leafminers: /leafminers?/i, caterpillars: /caterpillars?/i, 'rice-planthoppers': /planthoppers?/i, 'rice-blast': /rice.blast/i };

/** @param {string} slug @param {typeof fetch} [fetchImpl] @param {AbortSignal} [signal] */
export async function findPlantReferenceImages(slug, fetchImpl = fetch, signal) {
  if (!Object.hasOwn(QUERIES, slug)) return [];
  try {
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({ action: 'query', generator: 'search', gsrsearch: QUERIES[slug], gsrnamespace: '6', gsrlimit: '15', prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '640', format: 'json', formatversion: '2' }).toString();
    const response = await fetchImpl(url.href, { signal: AbortSignal.any([signal ?? new AbortController().signal, AbortSignal.timeout(3500)]), redirect: 'error' });
    if (!response.ok) return [];
    const data = await response.json();
    if (!Array.isArray(data?.query?.pages)) return [];
    return data.query.pages.flatMap((page) => {
      const info = page.imageinfo?.[0];
      const title = page.title?.replace(/^File:/, '').replace(/\.[^.]+$/, '').replaceAll('_', ' ').trim();
      const licence = info?.extmetadata?.LicenseShortName?.value ?? '';
      const image = info?.thumburl;
      const source = info?.descriptionurl;
      const author = info?.extmetadata?.Artist?.value?.replace(/<[^>]+>/g, '').trim() ?? '';
      if (!title || !MATCH[slug].test(title) || !/^(CC0|CC BY(?:-SA)?(?: [0-9.]+)?)$/i.test(licence) || !['image/jpeg', 'image/png', 'image/webp'].includes(info?.mime)) return [];
      try {
        if (new URL(image).hostname !== 'upload.wikimedia.org' || new URL(image).protocol !== 'https:' || new URL(source).hostname !== 'commons.wikimedia.org' || new URL(source).protocol !== 'https:') return [];
      } catch { return []; }
      return [{ url: image, source, title: title.slice(0, 180), credit: `${author.slice(0, 100) || 'Contributor'} · ${licence}` }];
    }).slice(0, 3);
  } catch { return []; }
}

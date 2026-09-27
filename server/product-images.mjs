const PRODUCT_HOSTS = new Set(['www.harvest-agro.com', 'harvest-agro.com', 'majujayaagriculture.onesync.my']);
const MAX_PAGE_CHARACTERS = 200000;
/** @param {string} source @param {typeof fetch} fetchImpl @returns {Promise<string|null>} */
export async function sourceProductImage(source, fetchImpl = fetch) {
  const page = new URL(source);
  if (page.protocol !== 'https:' || page.username || page.password || !PRODUCT_HOSTS.has(page.hostname)) return null;
  try {
    const response = await fetchImpl(page.href, { redirect: 'error', signal: AbortSignal.timeout(5000) });
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
    const html = (await response.text()).slice(0, MAX_PAGE_CHARACTERS);
    for (const tag of html.matchAll(/<meta\s[^>]+>/gi)) {
      if (!/(?:property|name)=["'](?:og:image|twitter:image)["']/i.test(tag[0])) continue;
      const content = /content=["']([^"']+)["']/i.exec(tag[0])?.[1];
      if (!content) continue;
      const image = new URL(content.replaceAll('&amp;', '&'), page);
      if (image.protocol === 'https:' && !image.username && !image.password) return image.href;
    }
    return null;
  } catch (error) { console.info('Product image unavailable.', page.hostname, error instanceof Error ? error.name : 'Unknown error'); return null; }
}
/** @param {import('../src/plant-web.mjs').PlantWebResult} result @param {typeof fetch} fetchImpl @returns {Promise<import('../src/plant-web.mjs').PlantWebResult>} */
export async function attachProductImages(result, fetchImpl = fetch) {
  const sources = [...new Set(result.citations.map((citation) => citation.url))].slice(0, 10);
  const images = await Promise.all(sources.map(async (source) => ({ source, url: await sourceProductImage(source, fetchImpl) })));
  return { ...result, images: images.filter((image) => image.url) };
}

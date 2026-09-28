import { searchPlantWeb } from './plant-web.mjs';
import { getLocale, t } from './i18n.mjs';
import { escapeHtml as esc, icon, money } from './ui.mjs';

/** @typedef {{retailer:string,price:number,url:string,rating?:number,reviewCount?:number,name?:string,match?:string,condition?:string}} RetailOffer */
/** @param {RetailOffer[]} offers @returns {string} */
export function renderShopOffers(offers) {
  return `<div class="shop-offers">${[...offers].sort((first, second) => Number(first.match === 'similar') - Number(second.match === 'similar') || first.price - second.price).filter((offer) => /^https:\/\//.test(offer.url)).map((offer) => `<a class="shop-offer" href="${esc(offer.url)}" target="_blank" rel="noopener noreferrer"><span class="row-copy"><strong>${esc(offer.name ?? offer.retailer)}</strong>${offer.name ? `<span class="row-subtitle">${esc(offer.retailer)}${offer.match === 'similar' ? ` · ${esc(t('Similar'))}` : ''}${offer.condition === 'used' ? ` · ${esc(t('Used'))}` : ''}</span>` : ''}<span class="row-subtitle">${offer.rating !== undefined ? `★ ${esc(String(offer.rating))}${offer.reviewCount !== undefined ? ` · ${esc(String(offer.reviewCount))} ${esc(t('reviews'))}` : ''}` : esc(t('No rating available'))}</span></span><strong class="shop-offer-price">${money(offer.price)}</strong>${icon('arrow-up-right', 20)}</a>`).join('')}</div>`;
}

/** @param {import('./plant-web.mjs').PlantWebResult} result @param {number} baseline @returns {RetailOffer[]} */
export function parseDealOffers(result, baseline) {
  const offers = [];
  for (const paragraph of result.text.matchAll(/[^\n]+/g)) {
    const match = paragraph[0].match(/DEAL:\s*(.+?)\s*\|\s*SELLER:\s*(.+?)\s*\|\s*PRICE:\s*MYR\s*([\d,.]+)\s*\|\s*MATCH:\s*(exact|similar)[^|]*\|\s*CONDITION:\s*(new|used|unknown)\s*\|\s*RATING:\s*([\d.]+|unknown)\s*\|\s*REVIEWS:\s*(\d+|unknown)/);
    const citation = result.citations.find((item) => item.start >= paragraph.index && item.end <= paragraph.index + paragraph[0].length);
    if (!match || !citation || match[4] !== 'exact' || match[5] === 'used') continue;
    const price = Number(match[3].replaceAll(',', ''));
    if (!Number.isFinite(price) || price <= 0 || (baseline > 0 && price >= baseline)) continue;
    const rating = Number(match[6]);
    const reviewCount = Number(match[7]);
    offers.push({ name:match[1], retailer:match[2], price, url:citation.url, match:match[4], condition:match[5], ...(Number.isFinite(rating) && rating >= 0 && rating <= 5 ? {rating} : {}), ...(Number.isInteger(reviewCount) && reviewCount >= 0 ? {reviewCount} : {}) });
  }
  return [...new Map(offers.map((offer) => [offer.url, offer])).values()];
}
/** @param {string} [name] @param {number} [price] @returns {string} */
export function renderDealSearch(name = '', price = 0) {
  return `<form class="form-stack" data-deal-search><label class="field"><span>${esc(t('Product'))}</span><input class="input" name="product" value="${esc(name)}" maxlength="100" required placeholder="${esc(t('Product name or model'))}"></label><label class="field"><span>${esc(t('Current price (RM)'))}</span><input class="input" name="price" type="number" min="0.01" step="0.01" value="${price || ''}" required></label><button class="button" type="submit">${esc(t('Find lower prices'))}${icon('search',18)}</button><p data-deal-status role="status"></p><div data-deal-results></div></form>`;
}
/** @param {HTMLElement} root @returns {void} */
export function initializeShopDeals(root) {
  const form = root.querySelector('[data-deal-search]');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    const status = form.querySelector('[data-deal-status]');
    const results = form.querySelector('[data-deal-results]');
    button.disabled = true; status.textContent = t('Checking marketplaces…'); results.innerHTML = '';
    try {
      const price = Number(form.elements.price.value);
      const query = `${form.elements.product.value} under MYR ${price} Malaysia exact package first`.slice(0,160);
      const response = await searchPlantWeb(query, getLocale(), AbortSignal.timeout(35000), fetch, 'shop-deals');
      const offers = parseDealOffers(response, price);
      results.innerHTML = renderShopOffers(offers);
      status.textContent = t(offers.length ? 'Listed prices · shipping extra' : 'No matching lower prices found. Try a more specific model.');
    } catch (error) { status.textContent = t(error instanceof Error ? error.message : 'Search unavailable. Try again.'); }
    finally { button.disabled = false; }
  });
}

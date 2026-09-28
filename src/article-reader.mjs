import { getLocale, t } from './i18n.mjs';
import { translateTexts } from './translation.mjs';
import { escapeHtml as esc } from './ui.mjs';

const ARTICLE_PATH = /^\/content\/articles\/PMC\d+\.json$/;
const FIGURE_PATH = /^\/content\/articles\/PMC\d+-figure-\d+\.(jpg|png)$/;
/** @typedef {{text:string,colSpan:number,rowSpan:number,isHeader:boolean}} ArticleCell */
/** @typedef {{type:string,text?:string,level?:number,src?:string,label?:string,caption?:string,footnote?:string,items?:string[],rows?:(string|ArticleCell)[][]}} ArticleBlock */

/** @param {string|ArticleCell} cell @returns {string} */
const renderCell = (cell) => {
  if (typeof cell === 'string') return `<td>${esc(cell)}</td>`;
  const tag = cell.isHeader ? 'th' : 'td';
  const columns = Math.min(100, Math.max(1, Number(cell.colSpan) || 1));
  const rows = Math.min(100, Math.max(1, Number(cell.rowSpan) || 1));
  return `<${tag} colspan="${columns}" rowspan="${rows}">${esc(cell.text)}</${tag}>`;
};

/** @param {ArticleBlock} block @param {number} index @returns {string} */
export function renderArticleBlock(block, index) {
  if (block.type === 'heading') {
    const level = Math.min(4, Math.max(2, Number(block.level) || 2));
    return `<h${level} id="article-section-${index}">${esc(block.text ?? '')}</h${level}>`;
  }
  if (block.type === 'paragraph') return `<p>${esc(block.text ?? '')}</p>`;
  if (block.type === 'equation') return `<pre class="article-equation" tabindex="0"><code>${esc(block.text ?? '')}</code></pre>`;
  if (block.type === 'list') return `<ul>${(block.items ?? []).map((item) => `<li>${esc(item)}</li>`).join('')}</ul>`;
  if (block.type === 'table') return `<div class="article-table" tabindex="0" role="region" aria-label="${esc(block.caption || t('Article table'))}"><table><caption>${esc(block.caption ?? '')}</caption><tbody>${(block.rows ?? []).map((row) => `<tr>${row.map(renderCell).join('')}</tr>`).join('')}</tbody></table>${block.footnote ? `<p>${esc(block.footnote)}</p>` : ''}</div>`;
  if (block.type === 'figure' && FIGURE_PATH.test(block.src ?? '')) {
    return `<figure class="article-figure"><a href="${esc(block.src)}" target="_blank" rel="noopener" aria-label="${esc(t('Open figure'))}"><img src="${esc(block.src)}" alt="${esc(block.label || t('Article figure'))}" loading="lazy" decoding="async"></a><figcaption>${esc(block.label ?? '')} ${esc(block.caption ?? '')}</figcaption></figure>`;
  }
  return '';
}

/** @param {unknown} payload @returns {ArticleBlock[]} */
export function validateArticleContent(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.blocks) || !payload.blocks.length) throw new Error('Article body is missing.');
  for (const block of payload.blocks) {
    if (!block || typeof block !== 'object' || typeof block.type !== 'string') throw new Error('Invalid article block.');
    for (const key of ['text', 'src', 'label', 'caption', 'footnote']) {
      if (block[key] !== undefined && typeof block[key] !== 'string') throw new Error('Invalid article text.');
    }
    if (block.items && (!Array.isArray(block.items) || !block.items.every((item) => typeof item === 'string'))) throw new Error('Invalid article list.');
    if (block.rows && (!Array.isArray(block.rows) || !block.rows.every((row) => Array.isArray(row) && row.every((cell) => typeof cell === 'string' || (cell && typeof cell.text === 'string'))))) throw new Error('Invalid article table.');
  }
  return payload.blocks;
}

/** @param {string} path @param {typeof fetch} fetcher @returns {Promise<ArticleBlock[]>} */
export async function loadArticleContent(path, fetcher = fetch, signal) {
  if (!ARTICLE_PATH.test(path)) throw new Error('Invalid article path.');
  const response = await fetcher(path, { signal });
  if (!response.ok) throw new Error(`Article request failed: ${response.status}`);
  return validateArticleContent(await response.json());
}

export async function translateArticleBlocks(blocks, locale, signal, translate = translateTexts) {
  const copy = structuredClone(blocks), slots = [];
  const add = (object, key) => { if (typeof object[key] === 'string' && /\p{L}/u.test(object[key])) slots.push([object, key]); };
  for (const block of copy) {
    if (block.type === 'equation') continue;
    for (const key of ['text', 'label', 'caption', 'footnote']) add(block, key);
    block.items?.forEach((_, index) => add(block.items, index));
    block.rows?.forEach((row) => row.forEach((cell, index) => typeof cell === 'string' ? add(row, index) : add(cell, 'text')));
  }
  const translated = await translate(slots.map(([object, key]) => object[key]), locale, signal);
  slots.forEach(([object, key], index) => { object[key] = translated[index]; });
  return copy;
}

const articleMarkup = (blocks) => {
  const contents = blocks.map((block, index) => block.type === 'heading' ? `<li><a href="#article-section-${index}">${esc(block.text ?? '')}</a></li>` : '').join('');
  return `<details class="article-contents"><summary>${esc(t('In this article'))}</summary><ul>${contents}</ul></details>${blocks.map(renderArticleBlock).join('')}`;
};

// Metadata is small; full research papers translate only when the reader asks.
export async function initializeArticleTranslation(root, signal) {
  const article = root.querySelector('[data-article-translate="true"]');
  const locale = getLocale();
  if (!article || locale === 'en') return;
  const nodes = [...article.querySelectorAll('.page-title, .page-description, [data-article-section] h2, [data-article-section] p')];
  const notice = article.querySelector('[data-article-translation-status]');
  const button = article.querySelector('[data-translate-article-intro]');
  const original = nodes.map((node) => node.textContent);
  let translated = null, showingOriginal = true;
  const translate = async () => {
    button.disabled = true; notice.textContent = t('Translating…');
    try {
      translated ??= await translateTexts(original, locale, signal);
      if (signal?.aborted || !article.isConnected || getLocale() !== locale) return;
      nodes.forEach((node, index) => { node.textContent = translated[index]; node.lang = locale; });
      showingOriginal = false; button.textContent = t('Show original'); notice.textContent = t('Translated with AI. Check the original for technical details.');
    } catch (error) { if (!signal?.aborted && article.isConnected) notice.textContent = t('Translation unavailable. Showing the original text.'); }
    finally { button.disabled = false; }
  };
  button.addEventListener('click', () => {
    if (showingOriginal) void translate();
    else { nodes.forEach((node, index) => { node.textContent = original[index]; node.lang = 'en'; }); showingOriginal = true; button.textContent = t('Translate summary'); notice.textContent = t('Original article in English'); }
  });
  await translate();
}

/** @param {HTMLElement} root @param {AbortSignal} [signal] @returns {Promise<void>} */
export async function initializeArticleReader(root, signal) {
  const container = root.querySelector('[data-article-content]');
  if (!container || container.dataset.loading === 'true') return;
  container.dataset.loading = 'true';
  container.setAttribute('aria-busy', 'true');
  try {
    const blocks = await loadArticleContent(container.dataset.articleContent, fetch, signal);
    if (!container.isConnected) return;
    const locale = getLocale();
    container.innerHTML = `${locale !== 'en' ? `<div class="toolbar"><button class="button button-secondary" data-translate-article>${esc(t('Translate article'))}</button><p class="muted" role="status" data-article-body-status>${esc(t('Original article in English'))}</p></div>` : ''}<div data-article-blocks lang="en">${articleMarkup(blocks)}</div>`;
    const button = container.querySelector('[data-translate-article]');
    let translated = null, showingOriginal = true;
    button?.addEventListener('click', async () => {
      const status = container.querySelector('[data-article-body-status]');
      const body = container.querySelector('[data-article-blocks]');
      if (!showingOriginal) {
        body.innerHTML = articleMarkup(blocks); body.lang = 'en'; showingOriginal = true;
        button.textContent = t('Translate article'); status.textContent = t('Original article in English'); return;
      }
      button.disabled = true; status.textContent = t('Translating…');
      try {
        translated ??= await translateArticleBlocks(blocks, locale, signal);
        if (signal?.aborted || !container.isConnected || getLocale() !== locale) return;
        body.innerHTML = articleMarkup(translated); body.lang = locale; showingOriginal = false;
        button.textContent = t('Show original'); status.textContent = t('Translated with AI. Check the original for technical details.');
      } catch (error) { if (!signal?.aborted && container.isConnected) status.textContent = t('Translation unavailable. Showing the original text.'); }
      finally { button.disabled = false; }
    });
  } catch (error) {
    if (signal?.aborted || !container.isConnected) return;
    console.error('Article could not load.', error);
    container.innerHTML = `<p role="alert">${esc(t('This article could not load. Reconnect and try again.'))}</p><button class="button button-secondary" data-retry-article>${esc(t('Try again'))}</button>`;
    container.querySelector('[data-retry-article]')?.addEventListener('click', () => {
      void initializeArticleReader(root, signal).catch((retryError) => console.error('Article retry failed.', retryError));
    }, {once: true});
  } finally {
    container.dataset.loading = 'false';
    container.setAttribute('aria-busy', 'false');
  }
}

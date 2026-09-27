import { t } from './i18n.mjs';
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
export async function loadArticleContent(path, fetcher = fetch) {
  if (!ARTICLE_PATH.test(path)) throw new Error('Invalid article path.');
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`Article request failed: ${response.status}`);
  return validateArticleContent(await response.json());
}

/** @param {HTMLElement} root @returns {Promise<void>} */
export async function initializeArticleReader(root) {
  const container = root.querySelector('[data-article-content]');
  if (!container || container.dataset.loading === 'true') return;
  container.dataset.loading = 'true';
  container.setAttribute('aria-busy', 'true');
  try {
    const blocks = await loadArticleContent(container.dataset.articleContent);
    if (!container.isConnected) return;
    const contents = blocks.map((block, index) => block.type === 'heading' ? `<li><a href="#article-section-${index}">${esc(block.text ?? '')}</a></li>` : '').join('');
    container.innerHTML = `<details class="article-contents"><summary>${esc(t('In this article'))}</summary><ul>${contents}</ul></details>${blocks.map(renderArticleBlock).join('')}`;
  } catch (error) {
    console.error('Article could not load.', error);
    container.innerHTML = `<p role="alert">${esc(t('This article could not load. Reconnect and try again.'))}</p><button class="button button-secondary" data-retry-article>${esc(t('Try again'))}</button>`;
    container.querySelector('[data-retry-article]')?.addEventListener('click', () => {
      void initializeArticleReader(root).catch((retryError) => console.error('Article retry failed.', retryError));
    }, {once: true});
  } finally {
    container.dataset.loading = 'false';
    container.setAttribute('aria-busy', 'false');
  }
}

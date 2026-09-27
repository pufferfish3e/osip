import { ARTICLES } from './data.mjs';
import { t } from './i18n.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const PAGE_SIZE = 24;
/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {(typeof ARTICLES)[number]} Article */
/** @param {boolean} isSavedOnly @returns {string} */
export function renderArticleLibrary(isSavedOnly = false) {
  return `${pageHeading('',t(isSavedOnly ? 'Saved guides' : 'Farming knowledge'))}<section data-article-library data-saved-only="${isSavedOnly}"><label class="search-field">${icon('search',20)}<input type="search" data-library-search aria-label="${esc(t('Search farming guides'))}" placeholder="${esc(t('Search crops, soil, water…'))}"></label><div class="chips library-topics" data-library-topics></div><p class="muted" data-library-count aria-live="polite"></p><div class="card-grid" data-library-results></div><p class="muted" data-library-empty hidden>${esc(t('No guides match this search. Try another crop or topic.'))}</p><button class="button button-secondary" data-library-more>${esc(t('Load more'))}</button></section>`;
}
/** @param {Article} article @param {boolean} isSaved @returns {string} */
const articleRow = (article,isSaved) => `<article class="card card-pad library-article"><div class="toolbar"><span class="muted">${esc(t(article.category))}</span><button class="icon-button" data-action="save-article" data-id="${esc(article.id)}" aria-label="${esc(t(isSaved ? 'Saved' : 'Save guide'))}" aria-pressed="${isSaved}">${icon(isSaved ? 'check' : 'bookmark',18)}</button></div><h2><a href="/learn/knowledge/${esc(article.slug)}">${esc(article.title)}</a></h2><p class="muted library-source">${esc(article.source)}${article.publishedYear ? ` · ${article.publishedYear}` : ''}</p><p class="library-article-kind">${esc(t(article.kind === 'research' ? 'Research article' : 'Extension guide'))}</p><a class="link" href="${esc(article.sourceUrl || `/learn/knowledge/${article.slug}`)}" ${article.sourceUrl ? 'target="_blank" rel="noopener noreferrer"' : ''}>${esc(t(article.sourceUrl ? 'Read original' : 'Read guide'))} ${icon('arrow-up-right',16)}</a></article>`;
/** @param {HTMLElement} root @param {AppState} state @returns {void} */
export function initializeArticleLibrary(root,state) {
  const panel = root.querySelector('[data-article-library]');
  if (!panel) return;
  const articles = ARTICLES.filter((article) => panel.dataset.savedOnly === 'true' ? state.savedArticles.includes(article.id) : !article.isDemo);
  const topics = [...new Set(articles.flatMap((article) => article.topics ?? [article.category]))];
  let topic = ''; let query = ''; let limit = PAGE_SIZE;
  const render = () => {
    const matches = articles.filter((article) => (!topic || (article.topics ?? [article.category]).includes(topic)) && `${article.title} ${article.source} ${article.author} ${(article.topics ?? [article.category]).join(' ')}`.toLowerCase().includes(query));
    panel.querySelector('[data-library-results]').innerHTML = matches.slice(0,limit).map((article) => articleRow(article,state.savedArticles.includes(article.id))).join('');
    panel.querySelector('[data-library-count]').textContent = `${Math.min(limit,matches.length)} / ${matches.length} ${t('articles')}`;
    panel.querySelector('[data-library-more]').hidden = limit >= matches.length;
    panel.querySelector('[data-library-empty]').hidden = matches.length > 0;
    panel.querySelector('[data-library-topics]').innerHTML = ['',...topics].map((value) => `<button class="chip ${value === topic ? 'chip-active' : ''}" data-library-topic="${esc(value)}" aria-pressed="${value === topic}">${esc(t(value || 'All topics'))}${value ? ` <span>${articles.filter((article) => (article.topics ?? [article.category]).includes(value)).length}</span>` : ''}</button>`).join('');
  };
  panel.querySelector('[data-library-search]').addEventListener('input',(event) => { query = event.target.value.trim().toLowerCase(); limit = PAGE_SIZE; render(); });
  panel.querySelector('[data-library-topics]').addEventListener('click',(event) => { const button = event.target.closest('[data-library-topic]'); if (!button) return; topic = button.dataset.libraryTopic; limit = PAGE_SIZE; render(); });
  panel.querySelector('[data-library-more]').addEventListener('click',() => { limit += PAGE_SIZE; render(); });
  render();
}

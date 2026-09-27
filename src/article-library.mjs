import { findPlantGuide, localizePlantGuide } from './plant-guides.mjs';
import { ARTICLES } from './data.mjs';
import { getLocale, t } from './i18n.mjs';
import { MALAYSIA_CONTEXT } from './malaysia-articles.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const PAGE_SIZE = 24;
/** @type {Map<string,{topic:string,query:string,limit:number}>} */
const LIBRARY_VIEWS = new Map();
/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {(typeof ARTICLES)[number]} Article */
/** @param {Article} article @returns {Article} */
export function localizeLearningArticle(article) {
  if (article.copies) return {...article, ...(article.copies[getLocale()] ?? article.copies.en)};
  const guide = article.plantGuideSlug ? findPlantGuide(article.plantGuideSlug) : null;
  if (!guide) return article;
  const copy = localizePlantGuide(guide, getLocale());
  const context = MALAYSIA_CONTEXT[guide.slug]?.copy[getLocale()] ?? MALAYSIA_CONTEXT[guide.slug]?.copy.en;
  return {...article, title: copy.title, summary: copy.summary, sections: [
    ...(context ? [{title: 'In Malaysia', body: context}] : []),
    {title: 'Look for', body: copy.symptoms.join(' ')},
    {title: 'What to do first', body: copy.actions.join(' ')},
    {title: 'When to get help', body: copy.whenToGetHelp},
  ]};
}

/** @param {boolean} isSavedOnly @returns {string} */
export function renderArticleLibrary(isSavedOnly = false) {
  return `${pageHeading('',t(isSavedOnly ? 'Saved guides' : 'Farming knowledge'))}<section data-article-library data-saved-only="${isSavedOnly}"><label class="search-field">${icon('search',20)}<input type="search" data-library-search aria-label="${esc(t('Search farming guides'))}" placeholder="${esc(t('Search crops, soil, water…'))}"></label><div class="chips library-topics" data-library-topics></div><p class="muted" data-library-count aria-live="polite"></p><div class="card-grid" data-library-results></div><p class="muted" data-library-empty hidden>${esc(t('No guides match this search. Try another crop or topic.'))}</p><button class="button button-secondary" data-library-more>${esc(t('Load more'))}</button></section>`;
}
const ARTICLE_TOPIC_IMAGES = Object.freeze({
  Drones: '/assets/drone.jpg', Technology: '/assets/course.jpg', Soil: '/assets/learn-soil.jpg',
  Water: '/assets/learn-water.jpg', Pests: '/assets/learn-scouting.jpg', Harvest: '/assets/learn-harvest.jpg',
});

/** @param {Article} article @param {boolean} isSaved @returns {string} */
export function renderLearningArticleCard(article, isSaved) {
  article = localizeLearningArticle(article);
  const image = article.image || ARTICLE_TOPIC_IMAGES[article.category] || '/assets/farm.jpg';
  const href = `/learn/knowledge/${article.slug}`;
  return `<article class="media-card article-card library-article learning-photo-card" data-search-item data-search-text="${esc([article.title, article.category, article.crop, article.summary].flatMap((value) => [value, t(value)]).join(' ').toLowerCase())}" data-topic="${esc(article.category.toLowerCase())}">
    <picture class="article-picture"><img class="media-image article-thumbnail" src="${esc(image)}" alt="" loading="lazy" decoding="async" width="1200" height="800"></picture>
    <button class="icon-button learning-photo-save" type="button" data-action="save-article" data-id="${esc(article.id)}" aria-pressed="${isSaved}" aria-label="${esc(t(isSaved ? 'Unsave {title}' : 'Save {title}', { title: t(article.title) }))}">${icon(isSaved ? 'check' : 'bookmark', 20)}</button>
    <div class="learning-photo-body"><span class="learning-photo-meta">${esc(t(article.category))}${article.readTime ? ` · ${esc(t('{minutes} min read', { minutes: article.readTime }))}` : ''}</span><h3><a href="${esc(href)}">${esc(t(article.title))}</a></h3>
    <p class="learning-photo-meta library-source">${article.region === 'MY' ? `${esc(t('Malaysia'))} · ${esc(t(article.crop))}` : `${esc(t(article.source))}${article.publishedYear ? ` · ${article.publishedYear}` : ''}`}</p>
    <div class="learning-photo-footer"><span class="learning-photo-meta">${esc(t(article.kind === 'practical' ? 'Practical guide' : article.kind === 'research' ? 'Research article' : 'Extension guide'))}</span><a class="button" href="${esc(href)}">${esc(t('Read guide'))}${icon('arrow-up-right', 18)}</a></div></div></article>`;
}

/** @param {Article[]} articles @param {string} topic @param {string} query @returns {Article[]} */
export function matchArticles(articles,topic,query) {
  const normalized = query.trim().toLowerCase();
  return articles.filter((article) => (!topic || (article.topics ?? [article.category]).includes(topic)) && `${localizeLearningArticle(article).title} ${localizeLearningArticle(article).summary} ${article.title} ${article.source} ${article.author} ${(article.keywords ?? []).join(' ')} ${(article.topics ?? [article.category]).flatMap((value) => [value, t(value)]).join(' ')}`.toLowerCase().includes(normalized));
}
/** @param {Article[]} articles @returns {Article[]} */
export function malaysiaLibraryArticles(articles) {
  return articles.filter((article) => article.region === 'MY' && !article.isDemo && (article.sections.length > 0 || article.contentPath));
}
/** @param {HTMLElement} root @param {AppState} state @returns {void} */
export function initializeArticleLibrary(root,state) {
  const panel = root.querySelector('[data-article-library]');
  if (!panel) return;
  const catalogue = malaysiaLibraryArticles(ARTICLES).filter((article) => panel.dataset.savedOnly !== 'true' || state.savedArticles.includes(article.id));
  const key = panel.dataset.savedOnly;
  const view = LIBRARY_VIEWS.get(key) ?? {topic:'',query:'',limit:PAGE_SIZE};
  let {topic,query,limit} = view;
  const articles = catalogue;
  let topics = [...new Set(articles.flatMap((article) => article.topics ?? [article.category]))];
  panel.querySelector('[data-library-search]').value = query;
  const render = () => {
    topics = [...new Set(articles.flatMap((article) => article.topics ?? [article.category]))];
    LIBRARY_VIEWS.set(key,{topic,query,limit});
    const matches = matchArticles(articles,topic,query);
    panel.querySelector('[data-library-results]').innerHTML = matches.slice(0,limit).map((article) => renderLearningArticleCard(article,state.savedArticles.includes(article.id))).join('');
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

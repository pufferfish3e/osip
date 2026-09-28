import { renderPlantWebResult, validateWebResult } from './plant-web.mjs';
import { getLocale, t } from './i18n.mjs';
import { localizePlantGuide, findPlantGuide, searchPlantGuides } from './plant-guides.mjs';
import { emptyState, escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const CATEGORIES = ['all', 'Pests', 'Disease', 'Growing conditions'];

/** @param {import('./plant-guides.mjs').PlantGuide} guide @returns {string} */
const guideCard = (source) => {
  const guide = localizePlantGuide(source, getLocale());
  return `<a class="plant-guide-row" href="/plant-help/guides/${esc(guide.slug)}"><span class="plant-guide-icon" aria-hidden="true">${icon(guide.icon, 25)}</span><span class="row-copy"><span class="plant-guide-category">${esc(t(guide.category))}</span><strong>${esc(guide.title)}</strong><span class="plant-guide-summary">${esc(guide.summary)}</span></span>${icon('chevron-right', 18)}</a>`;
};

/** @param {string} query @param {string} category @returns {string} */
export function renderPlantResults(query, category = 'all') {
  const guides = searchPlantGuides(query, category);
  const heading = query.trim() ? 'Matching guides' : 'Common problems';
  return `<div class="section-heading"><h2>${esc(t(heading))}</h2><span class="muted" role="status" aria-live="polite">${esc(t(guides.length === 1 ? '{count} guide' : '{count} guides', { count: guides.length }))}</span></div>${guides.length ? `<div class="plant-guide-list card">${guides.map(guideCard).join('')}</div>` : `<div class="empty-state card">${icon('search', 32)}<h2>${esc(t('No matching guides yet'))}</h2><p class="muted">${esc(t('Try a symptom such as yellow leaves, holes or wilting.'))}</p>${query.trim() ? `<button type="button" class="button" data-plant-web-search>${icon('search', 18)} ${esc(t('Search the web with AI'))}</button><p class="muted plant-web-note">${esc(t('Searches online sources for your plant symptom.'))}</p>` : ''}<button class="button button-secondary" data-plant-clear>${esc(t('Show all guides'))}</button></div>${query.trim() ? '<div data-plant-web-panel aria-live="polite"></div>' : ''}`}`;
}

/** @param {string} query @param {string} category @returns {string} */
const searchPage = (query, category) => `${pageHeading('', t('What’s happening?'))}<form class="plant-search" data-form="plant-search" role="search"><label class="search-field">${icon('search', 22)}<span class="sr-only">${esc(t('Search plant problems'))}</span><input type="search" data-plant-search value="${esc(query)}" placeholder="${esc(t('Pests, yellow leaves, wilting…'))}" maxlength="160" autocomplete="off" enterkeyhint="search"></label><button class="icon-button" type="submit" aria-label="${esc(t('Search guides'))}">${icon('arrow-right', 22)}</button></form><div class="chips plant-categories" aria-label="${esc(t('Filter guides'))}">${CATEGORIES.map((item) => `<button class="chip ${item === category ? 'chip-active' : ''}" data-plant-category="${esc(item)}" aria-pressed="${item === category}">${esc(t(item === 'all' ? 'All problems' : item))}</button>`).join('')}</div><section data-plant-results>${renderPlantResults(query, category)}</section>`;

/** @param {string} slug @returns {string} */
const guidePage = (slug) => {
  const source = findPlantGuide(slug);
  const guide = source ? localizePlantGuide(source, getLocale()) : null;
  if (!guide) return `${pageHeading('', t('Guide not found'))}${emptyState('Try another guide', 'Search the symptom you can see.', '/plant-help', 'Search problems')}`;
  return `<a class="back-link" href="/plant-help">${icon('arrow-left', 18)} ${esc(t('Plant problems'))}</a><article class="plant-article">${pageHeading('', guide.title)}<p class="plant-article-intro">${esc(guide.summary)}</p><section class="card card-pad"><h2>${icon(guide.icon, 24)} ${esc(t('Look for'))}</h2><ul>${guide.symptoms.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></section><section class="plant-guide-steps"><h2>${esc(t('What to do first'))}</h2><ol>${guide.actions.map((item) => `<li>${esc(item)}</li>`).join('')}</ol></section><section class="card card-pad"><h2>${esc(t('When to get help'))}</h2><p>${esc(guide.whenToGetHelp)}</p></section><details class="plant-sources"><summary>${esc(t('Sources & further reading'))}</summary><ul>${guide.sources.map((source) => `<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(t(source.title))} ${icon('arrow-up-right', 16)}</a></li>`).join('')}</ul></details><a class="button button-secondary" href="/plant-help/camera">${icon('camera', 20)} ${esc(t('Check a plant photo'))}</a></article>`;
};

/** @param {string} path @param {string} query @param {string} category @returns {string|null} */
export function renderPlantHelp(path, query = '', category = 'all') {
  if (path === '/plant-help') return searchPage(query, category);
  if (path === '/plant-help/camera') return `${pageHeading('', t('Check your plant'))}<div data-plant-camera></div>`;
  const route = path.match(/^\/plant-help\/guides\/([^/]+)$/);
  return route ? guidePage(route[1]) : null;
}

/** @param {import('./plant-photo.mjs').PlantAnalysis} result @returns {string} */
export function renderPlantAnalysis(result) {
  const guides = result.isPlant ? result.guideSlugs.map(findPlantGuide).filter(Boolean) : [];
  // Retain the photo checks; each separate web recommendation shows its own retrieved sources.
  const research = result.isPlant && result.research ? validateWebResult(result.research) : null;
  const researchedSteps = research ? [...research.text.matchAll(/[^\n]+(?:\n(?!\n)[^\n]+)*/g)].map((match) => {
    const start = match.index;
    const sources = research.citations.filter((source) => source.start >= start && source.end <= start + match[0].length);
    if (!sources.length) return null;
    let text = match[0];
    for (const source of [...sources].reverse()) text = `${text.slice(0, source.start - start)}${text.slice(source.end - start)}`;
    return { text: text.trim(), sources };
  }).filter(Boolean).slice(0, 3) : [];
  const referenceImages = result.isPlant ? (result.referenceImages ?? []) : [];
  return `<section class="plant-analysis" aria-labelledby="plant-summary-title">
    <header class="plant-summary-card card"><div class="plant-summary-label">${icon('leaf', 20)}<span>${esc(t('Photo summary'))}</span></div><h2 id="plant-summary-title" tabindex="-1">${esc(result.title)}</h2><p class="plant-summary-copy">${esc(result.summary)}</p>
      ${result.observations.length ? `<div class="plant-observation-group"><h3>${esc(t('What’s visible'))}</h3><ul class="plant-observations" role="list">${result.observations.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
      ${result.isPlant && result.possibleCauses?.length ? `<div class="plant-evidence-group"><h3>${esc(t('Possible causes'))}</h3><ul>${result.possibleCauses.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
      ${result.isPlant && result.confirmationChecks?.length ? `<div class="plant-evidence-group"><h3>${esc(t('What to check to confirm'))}</h3><ul>${result.confirmationChecks.map((item) => `<li>${esc(item)}</li>`).join('')}</ul></div>` : ''}
      ${result.isPlant ? `<p class="plant-evidence-note">${esc(t('Possible causes are based on the photo. The linked sources support field guidance, not a confirmed diagnosis.'))}</p>` : ''}
    </header>
    ${referenceImages.length ? `<section class="plant-references" aria-labelledby="plant-references-title"><h3 id="plant-references-title">${esc(t('Photos to compare'))}</h3><p class="muted">${esc(t('Examples, not a diagnosis of your photo.'))}</p><div class="plant-reference-strip" role="list">${referenceImages.map((item) => `<a class="plant-reference-card" role="listitem" href="${esc(item.source)}" target="_blank" rel="noopener noreferrer"><img src="${esc(item.url)}" alt="${esc(item.title)}" loading="lazy" referrerpolicy="no-referrer"><span><strong>${esc(item.title)}</strong><small>${esc(item.credit)} · Wikimedia Commons ${icon('arrow-up-right', 14)}</small></span></a>`).join('')}</div></section>` : ''}
    ${result.nextSteps.length ? `<section class="plant-next-steps" aria-labelledby="plant-steps-title"><h3 id="plant-steps-title">${esc(t('Next steps'))}</h3><ol class="plant-action-cards" role="list">${result.nextSteps.map((item, index) => `<li><span class="plant-step-number" aria-hidden="true">${index + 1}</span><div><p>${esc(item)}</p></div></li>`).join('')}</ol></section>` : ''}
    ${researchedSteps.length ? `<section class="plant-next-steps plant-published-guidance" aria-labelledby="plant-guidance-title"><h3 id="plant-guidance-title">${esc(t('Advice from published sources'))}</h3><p class="muted">${esc(t('Check whether each source applies to your crop and region.'))}</p><ul class="plant-action-cards" role="list">${researchedSteps.map((item) => `<li><div><p>${esc(item.text)}</p><div class="plant-source-links">${item.sources.map((source) => `<a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(t('Read source: {title}', { title: source.title }))}"><span>${esc(source.title)}</span><small>${esc(new URL(source.url).hostname)}</small>${icon('arrow-up-right', 16)}</a>`).join('')}</div></div></li>`).join('')}</ul></section>` : ''}
    ${research ? `<details class="plant-research-sources"><summary>${esc(t('All research sources'))}</summary>${renderPlantWebResult(research)}</details>` : ''}
    <p class="plant-analysis-note">${icon('info-circle', 18)}<span>${esc(t('AI-generated observations, not a confirmed diagnosis.'))}</span></p>
    ${guides.length ? `<div class="section-heading"><h2>${esc(t('Guides to compare'))}</h2></div><div class="plant-guide-list card">${guides.map(guideCard).join('')}</div>` : `<p class="muted">${esc(t(result.isPlant ? 'No close guide match. Search the symptoms you can see.' : 'Try a clear photo of a plant, leaf or pest.'))}</p>`}
    <a class="button button-secondary" href="/plant-help">${icon('search', 19)} ${esc(t('Search all problems'))}</a>
  </section>`;
}

import { renderExperts } from './expert-ui.mjs';
import { renderCalendar } from './schedule.mjs';
import { renderDealSearch, renderShopOffers } from './shop-deals.mjs';
// Pesticide calculator disabled at user request; retain integration for restoration.
// import { renderMixturePlanner, renderPesticideOptions, renderProductMatchPage, renderTankPreparation } from './mixture-planner.mjs';
import { renderPilotMatcher, renderPilotReviews } from './pilot-matcher.mjs';
import { renderArticleLibrary, renderLearningArticleCard, localizeLearningArticle } from './article-library.mjs';
import { ARTICLES, COURSES, NEWS, PILOTS, PRODUCTS, isArticleCatalogueLoaded } from './data.mjs';
import { getFormatLocale, getLocale, t } from './i18n.mjs';
import { emptyState, escapeHtml as esc, localizeDemoState, icon, pageHeading } from './ui.mjs';

/** @typedef {import('./store.mjs').AppState} AppState */
/** @typedef {(typeof ARTICLES)[number]} Article */
/** @typedef {(typeof COURSES)[number]} Course */
/** @typedef {(typeof PILOTS)[number]} Pilot */
/** @typedef {(typeof PRODUCTS)[number]} Product */

const AREA_UNITS = [{ value: 'ha', label: 'Hectares' }, { value: 'acre', label: 'Acres' }, { value: 'm2', label: 'Square metres' }];
const CALCULATION_TITLES = { area: 'Area conversion', cost: 'Input cost', margin: 'Simple margin' };
const CALCULATORS = [
  // { id: 'spray', title: 'Spray estimate', description: 'Spray mixture and product quantities from your land area.', icon: 'plant-2' },
  { id: 'area', title: 'Area converter', description: 'Hectares, acres and square metres.', icon: 'map-pin' },
  { id: 'cost', title: 'Input cost', description: 'Plan material costs for your field.', icon: 'calculator' },
  { id: 'margin', title: 'Gross margin', description: 'Compare revenue with your costs.', icon: 'shopping-bag' },
];

/** @param {number} value @returns {string} */
const money = (value) => new Intl.NumberFormat(getFormatLocale(), { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(value);

/** @param {string} value @returns {string} */
const dateLabel = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat(getFormatLocale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(date);
};

/** @returns {string} */
const today = () => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};

/** @param {string} href @param {string} label @returns {string} */
const backLink = (href, label) => `<a class="back-link" href="${esc(href)}">${icon('arrow-left', 18)}${esc(t(label))}</a>`;

/** @param {string} source @param {string} description @returns {string} */
const photo = (source, description) => source ? `<img class="media-image" src="${esc(source)}" alt="${esc(t(description))}" loading="lazy" decoding="async" width="1200" height="800">` : '';

/** @param {string} title @param {string} href @param {string} label @returns {string} */
const sectionHeading = (title, href, label) => `<div class="section-heading"><h2>${esc(t(title))}</h2><a class="link" href="${esc(href)}">${esc(t(label))}${icon('chevron-right', 16)}</a></div>`;

/** @param {string} name @param {string | number} value @returns {string} */
const hiddenInput = (name, value) => `<input type="hidden" name="${esc(name)}" value="${esc(String(value))}">`;

/** @param {string} title @param {string} href @param {string} label @returns {string} */
const missingPage = (title, href, label) => emptyState(t(title), t('This item is not available. Return to the collection to choose another.'), href, t(label));

/** @param {string} source @param {string} sourceUrl @returns {string} */
const sourceReference = (source, sourceUrl) => sourceUrl ? `<a class="link" href="${esc(sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(t(source))}${icon('arrow-up-right', 16)}</a>` : `<p class="muted">${esc(t(source))}</p>`;

/** @param {Article} article @param {AppState} state @returns {string} */
const articleCard = (article, state) => renderLearningArticleCard(article, state.savedArticles.includes(article.id));

/** @param {Course} course @returns {string} */
const courseCard = (course) => `<article class="media-card learning-photo-card course-photo-card" data-search-item data-search-text="${esc([course.title, course.category, course.instructor, course.summary, ...course.topics].flatMap((value) => [value, t(value)]).join(' ').toLowerCase())}">
  ${photo(course.image, '')}<div class="learning-photo-body"><span class="learning-photo-meta">${esc(t(course.format))} · ${esc(t(course.duration))}</span>
  <h3><a href="/learn/courses/${esc(course.id)}">${esc(t(course.title))}</a></h3><p class="learning-photo-meta">${esc(dateLabel(course.date))}</p>
  <div class="learning-photo-footer"><span class="price">${esc(t('Free'))}</span><a class="button" href="/learn/courses/${esc(course.id)}">${esc(t('View course'))}${icon('arrow-up-right', 18)}</a></div></div></article>`;

/** @param {AppState} state @returns {string} */
const learningHome = (state) => `${pageHeading(t('Learning'), t('Learn something new.'))}
  <div class="chips"><a class="chip chip-active" href="/learn">${esc(t('Explore'))}</a><a class="chip" href="/learn/saved">${icon('bookmark', 16)}${esc(t('Saved guides'))}</a><a class="chip" href="/learn/my-courses">${esc(t('My courses'))}</a></div>
  ${sectionHeading('Farming knowledge', '/learn/knowledge', 'All guides')}
  <div class="card-grid">${ARTICLES.slice(0, 2).map((article) => articleCard(article, state)).join('')}</div>
  ${sectionHeading('Courses', '/learn/courses', 'View all')}
  <div class="card-grid">${COURSES.slice(0, 2).map(courseCard).join('')}</div>`;

/** @param {AppState} state @param {boolean} isSavedOnly @returns {string} */
const knowledgeList = (_state, isSavedOnly) => renderArticleLibrary(isSavedOnly);

/** @param {Article} article @param {boolean} isSaved @returns {string} */
export function renderPublicationArticle(article, isSaved) {
  article = localizeLearningArticle(article);
  const hasBody = article.sections.length > 0 || Boolean(article.contentPath);
  const needsTranslation = !article.copies && !article.plantGuideSlug;
  const body = article.contentPath ? `<div class="article-full-text" data-article-content="${esc(article.contentPath)}"><p role="status">${esc(t('Loading article…'))}</p></div>` : article.sections.map((section) => `<section data-article-section><h2>${esc(t(section.title))}</h2><p>${esc(t(section.body))}</p></section>`).join('');
  return `${backLink('/learn/knowledge', 'Farming knowledge')}<article class="detail-content" data-article-translate="${needsTranslation}">${pageHeading(t(article.category), t(article.title), t(article.summary))}
    <div class="toolbar"><button class="button button-secondary" data-action="save-article" data-id="${esc(article.id)}" aria-pressed="${isSaved}">${esc(t(isSaved ? 'Saved' : 'Save guide'))}</button>${hasBody ? `<span class="muted">${esc(t('{minutes} min read', {minutes: article.readTime}))}</span>` : ''}</div>
    ${needsTranslation && getLocale() !== 'en' ? `<div class="toolbar"><button class="button button-secondary" data-translate-article-intro>${esc(t('Translate summary'))}</button><p class="muted" role="status" data-article-translation-status></p></div>` : ''}${article.region === 'MY' && article.image ? `<figure class="article-figure">${photo(article.image, '')}<figcaption>${esc(t('Illustrative field image'))}</figcaption></figure>` : ''}${article.contentPath ? `<p class="muted">${esc(t('Original article in English'))}</p>` : ''}${body}<aside class="card card-pad"><p>${esc(t(article.author))}</p><p class="muted">${esc(article.source)}${article.publishedYear ? ` · ${article.publishedYear}` : ''}</p>
    ${article.malaysiaSourceUrl ? `<p>${sourceReference('Malaysian guidance', article.malaysiaSourceUrl)}</p>` : ''}
    ${!hasBody ? `<p class="muted">${esc(t('The full article is hosted by its publisher; access may require a subscription.'))}</p>` : ''}${article.copyright ? `<p class="muted">${esc(article.copyright)}</p>` : ''}${sourceReference('Read original', article.sourceUrl)}${article.licenseUrl ? `<p>${sourceReference('Creative Commons licence', article.licenseUrl)}</p><p class="muted">${esc(t('Text and figures reproduced with attribution. Formatting adapted for this reader.'))} ${esc(t('Source: Europe PMC and NLM PMC. Imported {date}; later updates may exist.', {date: article.checkedAt}))}</p>` : ''}</aside></article>`;
}

/** @param {string} slug @param {AppState} state @returns {string} */
const articleDetail = (slug, state) => {
  const article = ARTICLES.find((item) => item.slug === slug);
  if (!article && !isArticleCatalogueLoaded()) return `<p class="loading-state" role="status" data-load-article-catalogue>${esc(t('Loading article…'))}</p>`;
  if (!article) return missingPage('Guide not found', '/learn/knowledge', 'Browse guides');
  const isSaved = state.savedArticles.includes(article.id);
  if (!article.isDemo) return renderPublicationArticle(article, isSaved);
  return `${backLink('/learn/knowledge', 'Farming knowledge')}
    <article class="detail-content">${pageHeading(t(article.category), t(article.title), t(article.summary))}
    <div class="toolbar"><span class="muted">${esc(t('{minutes} min read', { minutes: article.readTime }))} · ${esc(t(article.crop))}</span>
      <button class="button button-secondary button-small" type="button" data-action="save-article" data-id="${esc(article.id)}" aria-pressed="${isSaved}">${icon(isSaved ? 'check' : 'bookmark', 18)}${esc(t(isSaved ? 'Saved' : 'Save guide'))}</button></div>
    <div class="detail-hero">${photo(article.image, article.title)}</div>
    ${article.sections.map((section) => `<section data-article-section><h2>${esc(t(section.title))}</h2><p>${esc(t(section.body))}</p></section>`).join('')}
    <aside class="notice"><p>${esc(t('Sample guide · Agricultural review pending.'))}</p>
      <p class="muted">${esc(t(article.author))}${article.reviewedAt ? ` · ${esc(t('Reviewed {date}', { date: dateLabel(article.reviewedAt) }))}` : ''}</p>
      ${sourceReference(article.source, article.sourceUrl)}</aside></article>`;
};

/** @returns {string} */
const courseList = () => `${backLink('/learn', 'Learning')}${pageHeading(t('Courses'), t('Learn by doing. All courses are free.'))}
  <div class="toolbar"><span class="badge badge-blue">${esc(t('Sample catalogue'))}</span><a class="link" href="/learn/my-courses">${esc(t('My courses'))}${icon('chevron-right', 16)}</a></div>
  <label class="search-field">${icon('search')}<input type="search" data-search="courses" aria-label="${esc(t('Search courses'))}" placeholder="${esc(t('Search crops, topics, or instructors…'))}"></label>
  <div class="card-grid">${COURSES.map(courseCard).join('')}</div><p class="muted" data-search-empty role="status" hidden>${esc(t('No courses match your search.'))}</p>`;

/** @param {string} id @returns {string} */
const courseDetail = (id) => {
  const course = COURSES.find((item) => item.id === id);
  if (!course) return missingPage('Course not found', '/learn/courses', 'Browse courses');
  return `${backLink('/learn/courses', 'Courses')}<div class="split-layout"><div>
    ${pageHeading(t(course.category), t(course.title), t(course.summary))}<div class="detail-hero">${photo(course.image, course.title)}</div>
    <section class="detail-content"><h2>${esc(t('What you will learn'))}</h2><ul>${course.topics.map((topic) => `<li>${esc(t(topic))}</li>`).join('')}</ul></section></div>
    <aside class="card card-pad form-stack"><span class="badge badge-blue">${esc(t('Sample course'))} · ${esc(t(course.format))}</span><h2>${esc(t('Free'))}</h2>
      <div class="list"><div class="list-row">${icon('calendar')}<span>${esc(dateLabel(course.date))} · ${esc(course.time)}</span></div>
      <div class="list-row">${icon('clock')}<span>${esc(t(course.duration))}</span></div><div class="list-row">${icon('map-pin')}<span>${esc(t(course.location))}</span></div></div>
      <p>${esc(t('With {name}', { name: t(course.instructor) }))}</p><p class="muted">${esc(t('{count} places · Illustrative availability', { count: course.seats }))}</p>
      <a class="button" href="/learn/courses/${esc(course.id)}/book">${esc(t('Book this course'))}${icon('arrow-up-right', 18)}</a>
    </aside></div>`;
};

/** @param {string} id @returns {string} */
const courseBooking = (id) => {
  const course = COURSES.find((item) => item.id === id);
  if (!course) return missingPage('Course not found', '/learn/courses', 'Browse courses');
  return `${courseDetail(id)}<dialog class="task-sheet course-booking-sheet" data-course-booking-sheet data-course-id="${esc(course.id)}" aria-labelledby="course-booking-title">
    <form class="form-stack" data-form="course-booking">
      <div class="task-sheet-heading"><h2 id="course-booking-title">${esc(t('Book a course'))}</h2><button type="button" class="icon-button" data-course-booking-close aria-label="${esc(t('Cancel'))}">${icon('x', 20)}</button></div>
      <p class="course-booking-name">${esc(t(course.title))}</p>
      ${hiddenInput('providerId', course.id)}${hiddenInput('type', 'course')}${hiddenInput('title', course.title)}${hiddenInput('price', course.price)}
      ${hiddenInput('date', course.date)}${hiddenInput('time', course.time)}${hiddenInput('farmId', '')}
      <p class="muted">${esc(dateLabel(course.date))} · ${esc(course.time)}<br>${esc(t(course.location))}</p>
      <label class="field">${esc(t('Notes for the instructor'))}<textarea class="input" name="notes" rows="3" maxlength="1000" placeholder="${esc(t('Experience, access needs, or something you want to learn'))}"></textarea></label>
      <div class="toolbar"><span>${esc(t('Course fee'))}</span><strong>${esc(t('Free'))}</strong></div>
      <button class="button" type="submit">${esc(t('Save booking request'))}${icon('arrow-up-right', 18)}</button>
    </form></dialog>`;
};

/** @param {AppState} state @returns {string} */
const myCourses = (state) => {
  const bookings = state.bookings.filter((booking) => booking.type === 'course');
  const rows = bookings.map((booking) => `<a class="list-row" href="/bookings/${esc(booking.id)}"><span class="row-icon">${icon('school')}</span><span class="row-copy"><span class="row-title">${esc(COURSES.some((course) => course.id === booking.providerId && course.title === booking.title) ? t(booking.title) : booking.title)}</span><span class="row-subtitle">${esc(dateLabel(booking.date))} · ${esc(booking.time)}</span></span><span class="badge">${esc(t(booking.status))}</span>${icon('chevron-right', 18)}</a>`).join('');
  return `${backLink('/learn', 'Learning')}${pageHeading(t('My courses'), t('Your courses'))}
    ${bookings.length ? `<div class="card list">${rows}</div>` : emptyState('Something new is waiting.', 'Choose a course to start building your learning plan.', '/learn/courses', 'Explore courses')}`;
};

/** @returns {string} */
const servicesHome = () => `${pageHeading('', t('Services'))}
  <label class="search-field">${icon('search')}<input type="search" data-service-search maxlength="200" aria-label="${esc(t('Search pilots'))}" placeholder="${esc(t('Search pilots or a job…'))}"></label><div data-service-results aria-live="polite" hidden></div><div data-service-browse>
  <div class="card-grid"><a class="media-card learning-photo-card services-feature-card" href="/services/pilots">${photo(PILOTS[0]?.portrait ?? '/assets/course.jpg', '')}<div class="learning-photo-body"><p class="learning-photo-meta">${esc(t('Drone pilots'))}</p><h2>${esc(t('Book a drone pilot'))}</h2><div class="learning-photo-footer"><span class="button">${esc(t('Find a pilot'))}${icon('arrow-up-right', 18)}</span></div></div></a>
</div>
  <div class="section-heading"><h2>${esc(t('Your services'))}</h2></div><div class="card list">
${/* Pesticide calculator disabled; restore this link with its route.
<a class="list-row" href="/tools"><span class="row-icon">${icon('calculator')}</span><span class="row-copy"><span class="row-title">${esc(t('Pesticide calculator'))}</span></span>${icon('chevron-right', 18)}</a>
*/ ''}
    <a class="list-row" href="/weather"><span class="row-icon">${icon('cloud')}</span><span class="row-copy"><span class="row-title">${esc(t('Weather'))}</span></span>${icon('chevron-right', 18)}</a>
    <a class="list-row" href="/bookings"><span class="row-icon">${icon('calendar')}</span><span class="row-copy"><span class="row-title">${esc(t('Your bookings'))}</span><span class="row-subtitle">${esc(t('Requests, schedules and conversations'))}</span></span>${icon('chevron-right', 18)}</a>
</div></div>`;

/** @param {Pilot} pilot @returns {string} */
const pilotCard = (pilot) => `<article class="pilot-portrait-card pilot-catalog-card" data-search-item data-search-text="${esc([pilot.name, pilot.serviceArea, pilot.equipment, ...pilot.services].flatMap((value) => [value, t(value)]).join(' ').toLowerCase())}">
  <img class="pilot-match-cover" src="${esc(pilot.portrait)}" alt="" loading="lazy" width="1086" height="1448">
  <div class="pilot-match-body"><h2>${esc(pilot.name)}</h2><p class="pilot-match-specialty">${esc(t(pilot.serviceArea))} · ${pilot.services.map((service) => esc(t(service))).join(' · ')}</p>
    <div class="pilot-match-footer"><div class="pilot-match-stats">${renderPilotReviews(pilot)}<span class="pilot-match-percent">${money(pilot.rate)} / ${esc(t(pilot.rateUnit))}</span></div><a class="button" href="/services/pilots/${esc(pilot.id)}">${esc(t('View pilot'))}${icon('arrow-up-right', 18)}</a></div></div></article>`;

/** @returns {string} */
const pilotList = () => `${backLink('/services', 'Services')}${pageHeading(t('Drone pilots'), t('Find a drone pilot'))}
  <div class="pilot-catalog-controls"><div class="search-field">${icon('search')}<input type="search" data-search="pilots" aria-label="${esc(t('Search pilots'))}" placeholder="${esc(t('Search pilots'))}"><button type="button" class="icon-button pilot-search-match" data-match-open aria-label="${esc(t('Find my pilot'))}" title="${esc(t('Find my pilot'))}">${icon('adjustments-horizontal', 20)}</button></div>${renderPilotMatcher()}</div><div class="card-grid">${PILOTS.map(pilotCard).join('')}</div><p class="muted" data-search-empty hidden>${esc(t('No matching pilots.'))}</p>`;

/** @param {string} id @returns {string} */
const pilotDetail = (id) => {
  const pilot = PILOTS.find((item) => item.id === id);
  if (!pilot) return missingPage('Pilot not found', '/services/pilots', 'Find a pilot');
  return `${backLink('/services/pilots', 'Drone pilots')}<div class="split-layout"><div>
    ${pageHeading(t('Drone pilot'), pilot.name)}<div class="chips">${pilot.services.map((service) => `<span class="chip">${esc(t(service))}</span>`).join('')}</div>
    <div class="card card-pad form-stack"><h2>${esc(t('Ready for the field'))}</h2><div class="list-row"><span class="row-icon">${icon('map-pin')}</span><div class="row-copy"><span class="row-title">${esc(t('Service area'))}</span><span class="row-subtitle">${esc(t(pilot.serviceArea))}</span></div></div>
      <div class="list-row"><span class="row-icon">${icon('drone')}</span><div class="row-copy"><span class="row-title">${esc(t('Equipment'))}</span><span class="row-subtitle">${esc(t(pilot.equipment))}</span></div></div></div></div>
    <aside class="card card-pad form-stack"><img class="avatar pilot-avatar" src="${esc(pilot.portrait)}" alt="" loading="lazy"><span class="badge badge-blue">${esc(t('Sample pilot'))}</span><div><h2>${money(pilot.rate)} <span class="muted">/ ${esc(t(pilot.rateUnit))}</span></h2><p class="muted">${esc(t('Starting rate · Final quote to be agreed.'))}</p></div>
      <a class="button" href="/services/pilots/${esc(pilot.id)}/book">${esc(t('Request a booking'))}${icon('arrow-up-right', 18)}</a></aside></div>`;
};

/** @param {string} id @param {AppState} state @returns {string} */
const pilotBooking = (id, state) => {
  const pilot = PILOTS.find((item) => item.id === id);
  if (!pilot) return missingPage('Pilot not found', '/services/pilots', 'Find a pilot');
  if (!state.farms.length) return emptyState('Start with your farm.', 'Add a farm so your pilot knows where the work is needed.', '/onboarding/farmer', 'Add your farm');
  const farms = [...state.farms].sort((first, second) => Number(Boolean(first.isDemo || first.id === 'farm-1')) - Number(Boolean(second.isDemo || second.id === 'farm-1'))).map((farm) => `<option value="${esc(farm.id)}">${esc(farm.name)} · ${esc(farm.area.toString())} ${esc(t(farm.unit ?? 'ha'))}</option>`).join('');
  return `${pilotDetail(id)}<dialog class="task-sheet pilot-booking-sheet" data-pilot-booking-sheet data-pilot-id="${esc(pilot.id)}" aria-labelledby="pilot-booking-title"><form class="form-stack" data-form="pilot-booking"><div class="task-sheet-heading"><span class="muted" data-booking-progress></span><button class="icon-button" type="button" data-booking-close aria-label="${esc(t('Cancel'))}">${icon('x',20)}</button></div><h2 id="pilot-booking-title">${esc(t('Booking details'))}</h2>
      ${hiddenInput('providerId', pilot.id)}${hiddenInput('type', 'pilot')}${hiddenInput('title', `Drone service with ${pilot.name}`)}${hiddenInput('price', pilot.rate)}
      <label class="field">${esc(t('Your land'))}<select class="input" name="farmId" required>${farms}</select></label>
      <fieldset class="booking-services" data-booking-services><legend>${esc(t('Services'))}</legend>${pilot.services.map((service) => `<label class="booking-service-option"><input type="checkbox" name="service" value="${esc(service)}"><span>${esc(t(service))}</span></label>`).join('')}</fieldset>
      <div class="form-grid"><section class="field" data-booking-date><span>${esc(t('Preferred date'))}</span><input type="hidden" name="date" value="${today()}"><div data-booking-calendar>${renderCalendar(today(),today().slice(0,7),true,[],false,today())}</div></section><label class="field">${esc(t('Preferred time'))}<input class="input" type="time" name="time" value="09:00" required></label></div>
      <label class="field">${esc(t('Job details'))}<textarea class="input" name="notes" rows="3" maxlength="1000" placeholder="${esc(t('Plot size, crop, access and anything the pilot should know'))}" required></textarea></label>
      <div class="task-sheet-actions"><button class="button button-secondary" type="button" data-booking-back>${esc(t('Back'))}</button><button class="button" type="button" data-booking-next>${esc(t('Continue'))}</button><button class="button" type="submit">${esc(t('Save request'))}${icon('arrow-up-right', 18)}</button></div></form></dialog>`;
};

/** @param {Product} product @returns {string} */
const productCard = (product) => `<a class="shop-sample-card" href="/shop/products/${esc(product.id)}"><span class="shop-sample-icon" aria-hidden="true">${icon(product.productIcon ?? 'drone', 28)}</span><span class="row-copy"><span class="eyebrow">${esc(t(product.category))}</span><h2>${esc(t(product.name))}</h2><span class="muted">${esc(t('Listed price'))}</span><strong class="shop-sample-price">${money(product.price)}</strong></span>${icon('arrow-up-right',20)}</a>`;

/** @param {AppState} state @returns {string} */
const shopHome = (state) => {
  return `${backLink('/services', 'Services')}${pageHeading(t('The field shop'), t('The field shop'))}
    ${renderDealSearch()}
    <section class="shop-samples"><h2>${esc(t('Everyday tools'))}</h2><div class="shop-sample-grid">${PRODUCTS.filter((product) => product.productIcon).map(productCard).join('')}</div></section><details class="shop-advanced"><summary>${esc(t('Drone equipment'))}</summary><div class="shop-sample-grid">${PRODUCTS.filter((product) => !product.isDemo && product.category === 'Drones').map(productCard).join('')}</div></details>`;
};

/** @param {string} id @returns {string} */
const productDetail = (id) => {
  const product = PRODUCTS.find((item) => item.id === id);
  if (!product) return missingPage('Product not found', '/shop', 'Explore shop');
  const offers = product.supplierUrl ? [{ retailer:product.supplier, price:product.price, url:product.supplierUrl }] : [];
  return `${backLink('/shop', 'The field shop')}${pageHeading('', t(product.name))}${renderShopOffers(offers)}${renderDealSearch(product.searchName ?? product.name, product.price)}`;
};

/** @param {Product} product @param {number} quantity @returns {string} */
const cartRow = (product, quantity) => `<div class="list-row"><span class="row-icon">${icon('shopping-bag')}</span><div class="row-copy"><a class="row-title" href="/shop/products/${esc(product.id)}">${esc(t(product.name))}</a><span class="row-subtitle">${esc(t('{price} each', { price: money(product.price) }))}</span>
  <div class="toolbar"><button class="icon-button" type="button" data-action="cart-decrement" data-id="${esc(product.id)}" aria-label="${esc(t('Remove one {name}', { name: t(product.name) }))}">${icon('minus', 16)}</button><span aria-label="${esc(t('Quantity'))}">${quantity}</span><button class="icon-button" type="button" data-action="cart-increment" data-id="${esc(product.id)}" aria-label="${esc(t('Add one {name}', { name: t(product.name) }))}">${icon('plus', 16)}</button></div></div><span class="row-end price">${money(product.price * quantity)}</span></div>`;

/** @param {AppState} state @returns {string} */
const shopCart = (state) => {
  const items = state.cart.flatMap((item) => {
    const product = PRODUCTS.find((candidate) => candidate.id === item.productId);
    return product ? [{ product, quantity: item.quantity }] : [];
  });
  const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  return `${backLink('/shop', 'The field shop')}${pageHeading(t('Your cart'), t('Your cart'))}
    ${items.length ? `<div class="two-column"><div class="card list">${items.map((item) => cartRow(item.product, item.quantity)).join('')}</div><aside class="card card-pad form-stack"><h2>${esc(t('Order summary'))}</h2><div class="toolbar"><span>${esc(t('Subtotal'))}</span><strong>${money(total)}</strong></div><p class="muted">${esc(t('Sample checkout · Shipping and taxes to be confirmed.'))}</p><a class="button" href="/checkout/cart">${esc(t('Continue to checkout'))}${icon('arrow-up-right', 18)}</a></aside></div>` : emptyState('Your cart is empty', 'Find the right tools for your farm.', '/shop', 'Explore shop')}`;
};

/** @returns {string} */
const newsList = () => `${pageHeading(t('Field journal'), t('Field journal'))}<p class="notice">${esc(t('Sample stories · Live news is not connected.'))}</p>
  <div class="card-grid">${NEWS.map((item) => `<a class="media-card" href="/news/${esc(item.slug)}">${photo(item.image, '')}<div class="card-body"><span class="muted">${esc(t(item.category))} · ${esc(dateLabel(item.date))}</span><h2>${esc(t(item.title))}</h2><span class="link">${esc(t('Read story'))}${icon('arrow-up-right', 16)}</span></div></a>`).join('')}</div>`;

/** @param {string} slug @returns {string} */
const newsDetail = (slug) => {
  const item = NEWS.find((candidate) => candidate.slug === slug);
  if (!item) return missingPage('Story not found', '/news', 'Read field journal');
  return `${backLink('/news', 'Field journal')}<article class="detail-content">${pageHeading(t(item.category), t(item.title), t(item.summary))}<p class="muted">${esc(dateLabel(item.date))} · ${esc(t('Sample editorial'))}</p>
    <div class="detail-hero">${photo(item.image, item.title)}</div><p>${esc(t(item.body))}</p><aside class="notice">${sourceReference(item.source, item.sourceUrl)}<p class="muted">${esc(t('This preview is not a live news report.'))}</p></aside></article>`;
};

/** @param {string} name @param {string} label @param {string} value @param {string} step @returns {string} */
const numberField = (name, label, value, step = 'any') => `<label class="field">${esc(t(label))}<input class="input" name="${esc(name)}" type="number" inputmode="decimal" min="0" step="${esc(step)}" value="${esc(value)}" required></label>`;

/** @param {string} name @param {string} label @param {string} selected @returns {string} */
const unitField = (name, label, selected) => `<label class="field">${esc(t(label))}<select class="input" name="${esc(name)}">${AREA_UNITS.map((unit) => `<option value="${unit.value}"${unit.value === selected ? ' selected' : ''}>${esc(t(unit.label))}</option>`).join('')}</select></label>`;

/** @param {string} id @returns {string} */
const calculatorFields = (id) => {
  if (id === 'area') return `${numberField('value', 'Area', '1')}<div class="form-grid">${unitField('from', 'From', 'ha')}${unitField('to', 'To', 'acre')}</div><p class="muted">${esc(t('Converts area using fixed unit definitions.'))}</p>`;
  if (id === 'cost') return `${numberField('area', 'Field area (ha)', '2')}${numberField('rate', 'Planned material quantity (units / ha)', '1')}${numberField('unitCost', 'Cost per material unit (RM)', '100')}<p class="muted">${esc(t('Area × your planned quantity per hectare × cost per unit. Enter your own quantity; this tool does not prescribe application rates.'))}</p>`;
  return `${numberField('revenue', 'Expected revenue (RM)', '5000')}${numberField('cost', 'Variable costs (RM)', '2500')}<p class="muted">${esc(t('Expected revenue − variable costs = gross margin. Fixed overheads and taxes are excluded.'))}</p>`;
};

/** @param {string} id @returns {string} */
const calculatorPage = (id) => {
  const calculator = CALCULATORS.find((item) => item.id === id);
  if (!calculator) return missingPage('Calculator not found', '/tools', 'View farm tools');
  return `${backLink('/tools', 'Farm tools')}${pageHeading(t('Farmer calculator'), t(calculator.title), t(calculator.description))}
    <div class="two-column"><form class="card card-pad form-stack" data-form="calculator" data-kind="${calculator.id}">${calculatorFields(id)}<button class="button" type="submit">${esc(t('Calculate'))}${icon('arrow-up-right', 18)}</button></form>
    <aside class="card card-pad form-stack"><h2>${esc(t('Your result'))}</h2><div id="calculation-result" role="status" aria-live="polite"><p class="muted">${esc(t('Enter your figures and calculate to see the result here.'))}</p></div></aside></div>`;
};

/** @param {AppState} state @returns {string} */
const savedCalculations = (state) => {
  const rows = state.savedCalculations.map((calculation) => `<div class="list-row"><span class="row-icon">${icon('calculator')}</span><span class="row-copy"><span class="row-title">${esc(CALCULATION_TITLES[calculation.type] === calculation.title ? t(calculation.title) : calculation.title)}</span><span class="row-subtitle">${esc(dateLabel(calculation.date))}</span></span><span class="row-end">${esc(String(calculation.result))} ${esc(t(calculation.unit))}</span></div>`).join('');
  return `${backLink('/tools', 'Farm tools')}${pageHeading(t('Saved calculations'), t('Saved calculations'))}${rows ? `<div class="card list">${rows}</div>` : emptyState('No saved calculations', 'Save a result to find it here later.', '/tools', 'Open farm tools')}`;
};

/** @param {string[]} segments @param {AppState} state @returns {string | null} */
const renderLearning = (segments, state) => {
  const [, section, id, action] = segments;
  if (!section) return learningHome(state);
  if (section === 'saved' && !id) return knowledgeList(state, true);
  if (section === 'my-courses' && !id) return myCourses(state);
  if (section === 'knowledge' && !id) return knowledgeList(state, false);
  if (section === 'knowledge' && id && !action) return articleDetail(id, state);
  if (section === 'courses' && !id) return courseList();
  if (section === 'courses' && id && !action) return courseDetail(id);
  if (section === 'courses' && id && action === 'book') return courseBooking(id);
  return null;
};

/** @param {string[]} segments @param {AppState} state @returns {string | null} */
const renderServices = (segments, state) => {
  const [, section, id, action] = segments;
  if (!section) return servicesHome();
  if (section === 'experts' && !action) return renderExperts(id);
  if (section === 'pilots' && !id) return pilotList();
  if (section === 'pilots' && id && !action) return pilotDetail(id);
  if (section === 'pilots' && id && action === 'book') return pilotBooking(id, state);
  return null;
};

/** @param {string[]} segments @param {AppState} state @returns {string | null} */
const renderShop = (segments, state) => {
  const [, section, id] = segments;
  if (!section) return shopHome(state);
  if (section === 'cart' && !id) return shopCart(state);
  if (section === 'products' && id && segments.length === 3) return productDetail(id);
  return null;
};

/** @param {string} path @param {AppState} state @returns {string | null} */
export function renderDiscover(path, state) {
  state = localizeDemoState(state);
  const segments = path.split('/').filter(Boolean);
  const [section, id] = segments;
  if (segments.length > 4) return null;
  if (section === 'learn') return renderLearning(segments, state);
  if (section === 'services') return renderServices(segments, state);
  if (section === 'shop') return renderShop(segments, state);
  if (segments.length > 2) return null;
  if (section === 'news') return id ? newsDetail(id) : newsList();
  // if (section === 'tools' && id === 'tank') return renderTankPreparation();
  // if (section === 'tools' && id === 'products') return renderProductMatchPage();
  // if (section === 'tools' && id === 'options') return renderPesticideOptions(state);
  // if (section === 'tools' && id === 'spray') return renderMixturePlanner(state);
  if (section === 'tools' && id === 'saved') return savedCalculations(state);
  // if (section === 'tools') return id ? calculatorPage(id) : renderMixturePlanner(state);
  if (section === 'tools' && id && !['spray', 'tank', 'products', 'options'].includes(id)) return calculatorPage(id);
  return null;
}

const SERVICE_SYNONYMS = [
  ['mapping', ['aerial survey', 'crop survey', 'survey', 'maps', 'map', 'pemetaan', 'ukur', '测绘', '航测', '地图']],
  ['spraying', ['spray', 'sprayer', 'semburan', 'sembur', '喷洒', '喷药']],
  ['drone', ['drones', 'uav', 'dron', '无人机']],
  ['pilot', ['pilots', 'operator', 'juruterbang', '飞手']],
  ['book', ['booking', 'hire', 'rent', 'tempah', 'sewa', '预约', '雇用']],
  ['shop', ['buy', 'purchase', 'beli', 'kedai', '购买', '商店']],
  ['battery', ['batteries', 'power kit', 'spare power', 'bateri', '电池', '备用电源']],
  ['soil', ['tanah', '土壤']],
  ['water', ['irrigation', 'pengairan', '灌溉']],
];
const SEARCH_STOP_WORDS = new Set(['a', 'an', 'the', 'for', 'to', 'i', 'need', 'want', 'find', 'me', 'with', 'and', 'my', 'please', 'saya', 'nak', 'cari', 'untuk', 'dan']);
/** @param {string} value @returns {string[]} */
const serviceTokens = (value) => {
  let normalized = value.normalize('NFKC').toLowerCase().replace(/[\p{P}\p{S}]/gu, ' ');
  for (const [term, aliases] of SERVICE_SYNONYMS) {
    for (const alias of aliases) {
      const pattern = /[\u3400-\u9fff]/u.test(alias) ? alias : `\\b${alias}\\b`;
      normalized = normalized.replace(new RegExp(pattern, 'gu'), ` ${term} `);
    }
  }
  return [...new Set(normalized.split(/\s+/u).filter((token) => token && !SEARCH_STOP_WORDS.has(token)))];
};
/** @param {string} query @returns {Array<{id:string,title:string,subtitle:string,href:string,kind:string,score:number}>} */
export function searchServices(query) {
  const tokens = serviceTokens(query.trim().slice(0, 200));
  if (!tokens.length) return [];
  const entries = [
    ...PILOTS.map((pilot) => ({ id: pilot.id, title: pilot.name, subtitle: pilot.services.map(t).join(' · '), href: `/services/pilots/${pilot.id}`, kind: 'pilot', tags: ['book pilot drone', 'tempah juruterbang', pilot.name, pilot.serviceArea, pilot.equipment, pilot.bio, ...pilot.services] })),
  ];
  return entries.map(({ tags, ...entry }) => {
    const words = serviceTokens(tags.flatMap((tag) => [tag, t(tag)]).join(' '));
    const titleWords = serviceTokens(entry.title);
    const matches = tokens.map((token) => words.some((word) => word === token || (token.length >= 3 && word.startsWith(token))));
    const score = matches.every(Boolean) ? tokens.reduce((total, token) => total + (titleWords.includes(token) ? 4 : 1), 0) : 0;
    return { ...entry, score };
  }).filter((entry) => entry.score > 0).sort((first, second) => second.score - first.score || first.title.localeCompare(second.title));
}
/** @param {string} query @returns {string} */
export function renderServiceResults(query) {
  const results = searchServices(query);
  if (!results.length) return `<p class="muted" role="status">${esc(t('No matching pilots or products. Try another keyword.'))}</p>`;
  return `<div class="card list">${results.map((result) => `<a class="list-row" href="${esc(result.href)}"><span class="row-icon">${icon(result.kind === 'pilot' ? 'drone' : 'shopping-bag')}</span><span class="row-copy"><span class="row-title">${esc(result.title)}</span><span class="row-subtitle">${esc(result.subtitle)}</span></span>${icon('chevron-right', 18)}</a>`).join('')}</div>`;
}

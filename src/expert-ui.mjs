import { EXPERTS, matchExperts } from './expert-data.mjs';
import { createFieldCareMotion } from './field-care.mjs';
import { togglePilotPreference } from './pilot-matcher.mjs';
import { t } from './i18n.mjs';
import { escapeHtml as esc, icon, pageHeading } from './ui.mjs';

const STEPS = [
  {key:'crop',title:'Which crop do you grow?',choices:['Rice','Oil palm','Rubber','Coconut','Durian','Banana','Pineapple','Guava','Vegetables','Chilli','Cocoa','Pepper','Other']},
  {key:'topic',title:'What do you need help with?',choices:['Pests','Disease','Soil','Water','Harvest','Fertilizer','Weeds','Planting','Pruning','Farm planning','Drone operations','Other']},
  {key:'area',title:'Where is your land?',choices:['Kedah','Perlis','Penang','Perak','Selangor','Negeri Sembilan','Melaka','Johor','Pahang','Kelantan','Terengganu','Sabah','Sarawak','Other']},
  {key:'language',title:'Preferred language',choices:['Bahasa Melayu','English','中文']},
];
/** @param {(typeof EXPERTS)[number]} expert @returns {string} */
const chatButton = (expert) => `<form data-form="expert-chat"><input type="hidden" name="expertId" value="${esc(expert.id)}"><button class="button" type="submit">${esc(t('Chat with expert'))}${icon('message-circle',18)}</button></form>`;
const MOCK_RATINGS = [4.8, 4.9, 4.7, 4.6];
const MOCK_REVIEW_COUNTS = [20, 32, 18, 24];
const STAR_COUNT = 5;
/** @param {(typeof EXPERTS)[number]} expert @returns {string} */
const expertSummary = (expert) => {
  const index = Math.max(0, EXPERTS.findIndex((item) => item.id === expert.id)) % MOCK_RATINGS.length;
  const rating = MOCK_RATINGS[index];
  const reviewCount = MOCK_REVIEW_COUNTS[index];
  const topics = expert.topics.slice(0, 2).map((topic) => t(topic).toLocaleLowerCase()).join(' and ');
  const crops = expert.crops.slice(0, 2).map((crop) => t(crop).toLocaleLowerCase()).join(' and ');
  const description = `${expert.name} supports ${crops} growers in ${t(expert.area)}, focusing on ${topics}. Provides practical guidance for field planning, crop monitoring, and informed farm management decisions.`;
  const stars = Array.from({length:STAR_COUNT}, (_, position) => `<span class="expert-star" style="--star-fill:${Math.round(Math.min(1, Math.max(0, rating - position)) * 100)}%">${icon('star',16)}</span>`).join('');
  return `<p class="expert-bio">${esc(description)}</p><p class="expert-rating" aria-label="${esc(`${rating.toFixed(1)} out of 5, ${reviewCount} sample reviews`)}"><span class="expert-stars" aria-hidden="true">${stars}</span><strong>${rating.toFixed(1)} <span>(${reviewCount})</span></strong></p>`;
};
/** @param {string[]} labels @returns {string} */
const expertPills = (labels) => `<div class="expert-glass-pills">${labels.map((label) => `<span>${esc(t(label))}</span>`).join('')}</div>`;
/** @param {(typeof EXPERTS)[number]} expert @param {boolean} [isDetail] @returns {string} */
const expertCard = (expert, isDetail = false) => `<article class="pilot-portrait-card pilot-catalog-card" data-search-item data-search-text="${esc([expert.name,expert.area,...(expert.areas ?? []),...expert.crops,...expert.topics,...expert.languages].flatMap((value)=>[value,t(value)]).join(' ').toLowerCase())}"><img class="pilot-match-cover" src="${esc(expert.portrait)}" alt="" width="1086" height="1448" loading="lazy"><div class="pilot-match-body"><h2>${esc(expert.name)}</h2>${expertPills([expert.area, ...(expert.topics.includes('Drone operations') ? ['Drone operations'] : expert.crops)])}${expertSummary(expert)}<div class="pilot-match-footer">${isDetail ? chatButton(expert) : `<a class="button" href="/services/experts/${esc(expert.id)}">${esc(t('View expert'))}${icon('arrow-up-right',18)}</a>`}</div></div></article>`;
/** @param {ReturnType<typeof matchExperts>[number]} match @returns {string} */
export function renderExpertMatch(match) {
  const { expert, score } = match;
  return `<article class="pilot-portrait-card expert-result-card">
    <img class="pilot-match-cover" src="${esc(expert.portrait)}" alt="" width="1086" height="1448">
    <div class="expert-result-heading"><span>${score}% ${esc(t('Preference match'))}</span><button type="button" class="icon-button" data-expert-result-close aria-label="${esc(t('Close'))}">${icon('x')}</button></div>
    <div class="pilot-match-body"><h2>${esc(expert.name)}</h2>
      ${expertPills([expert.area, ...expert.crops])}
      ${expertSummary(expert)}
      <div class="pilot-match-footer">${chatButton(expert)}</div>
    </div></article>`;
}
/** @param {(typeof EXPERTS)[number]} expert @returns {string} */
const expertProfile = (expert) => `<article class="expert-detail">
  <header class="expert-detail-heading"><img src="${esc(expert.portrait)}" alt="" width="112" height="112"><h1>${esc(expert.name)}</h1><p>${icon('map-pin',16)}${esc(t(expert.area))}</p></header>
  <div class="expert-detail-summary">${expertSummary(expert)}</div>
  <section class="expert-detail-section"><h2>${esc(t('What I can help with'))}</h2><div class="expert-detail-topics">${expert.topics.map((topic)=>`<span>${esc(t(topic))}</span>`).join('')}</div></section>
  <dl class="expert-detail-facts"><div><dt>${esc(t('Crops'))}</dt><dd>${expert.crops.map((crop)=>esc(t(crop))).join(' · ')}</dd></div><div><dt>${esc(t('Languages'))}</dt><dd>${expert.languages.map(esc).join(' · ')}</dd></div></dl>
  <footer class="expert-detail-action">${chatButton(expert)}</footer>
</article>`;
/** @param {string|undefined} id @returns {string} */
export function renderExperts(id) {
  const expert = EXPERTS.find((item)=>item.id === id);
  if (id) return `<a class="link" href="/services/experts">${icon('arrow-left',18)}${esc(t('Find an expert'))}</a>${expert ? expertProfile(expert) : pageHeading('',t('Expert not found'))}`;
  return `${pageHeading('',t('Find an expert'))}<div class="search-field">${icon('search')}<input type="search" data-search="experts" aria-label="${esc(t('Search experts'))}" placeholder="${esc(t('Search experts'))}"><button class="icon-button" type="button" data-expert-match-open aria-label="${esc(t('Match me'))}">${icon('adjustments-horizontal',20)}</button></div><div class="card-grid">${EXPERTS.map((item)=>expertCard(item)).join('')}</div><p class="muted" data-search-empty hidden>${esc(t('No matching experts.'))}</p>${renderExpertWizard()}`;
}
/** @returns {string} */
const renderExpertWizard = () => `<dialog class="task-sheet expert-sheet" data-expert-wizard aria-labelledby="expert-wizard-title"><div class="task-sheet-heading"><span data-expert-progress></span><button type="button" class="icon-button" data-expert-close aria-label="${esc(t('Close'))}">${icon('x')}</button></div><h2 id="expert-wizard-title" tabindex="-1"></h2><div class="chips" data-expert-choices></div><label class="field" data-expert-other-label hidden><span data-expert-other-title></span><input class="input" type="text" maxlength="80" data-expert-other></label><p role="alert" data-expert-error></p><div class="task-sheet-actions"><button type="button" class="button button-secondary" data-expert-back>${esc(t('Back'))}</button><button type="button" class="button" data-expert-next>${esc(t('Continue'))}</button></div><button type="button" class="pilot-catalog-shortcut" data-expert-close>${esc(t('Browse all experts'))}</button></dialog><dialog class="pilot-match-dialog expert-sheet" data-expert-result aria-label="${esc(t('Your expert match'))}"></dialog>`;
/** @param {HTMLElement} root @returns {void} */
export function initializeExpertMatcher(root) {
  const wizard = root.querySelector('[data-expert-wizard]');
  if (!(wizard instanceof HTMLDialogElement)) return;
  const result = root.querySelector('[data-expert-result]');
  const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const motion = createFieldCareMotion(wizard,window.gsap,reduced);
  const resultMotion = createFieldCareMotion(result,window.gsap,reduced);
  const preferences = {crop:[],topic:[],area:[],language:[],otherCrop:'',otherTopic:''};
  let step = 0;
  const update = () => {
    const current = STEPS[step];
    wizard.querySelector('h2').textContent = t(current.title);
    wizard.querySelector('[data-expert-progress]').textContent = `${step + 1} / ${STEPS.length}`;
    wizard.querySelector('[data-expert-choices]').innerHTML = current.choices.map((choice)=>`<button type="button" class="chip" data-expert-choice="${esc(choice)}" aria-pressed="${preferences[current.key].includes(choice)}">${esc(t(choice))}</button>`).join('');
    const isOther = ['crop','topic'].includes(current.key) && preferences[current.key].includes('Other');
    wizard.querySelector('[data-expert-other-label]').hidden = !isOther;
    wizard.querySelector('[data-expert-other-title]').textContent = t(current.key === 'crop' ? 'Your crop' : 'What do you need help with?');
    wizard.querySelector('[data-expert-other]').value = preferences[current.key === 'crop' ? 'otherCrop' : 'otherTopic'];
    wizard.querySelector('[data-expert-back]').hidden = step === 0;
    wizard.querySelector('[data-expert-error]').textContent = '';
    wizard.querySelector('[data-expert-next]').textContent = t(step === STEPS.length - 1 ? 'Match me' : 'Continue');
  };
  const showResult = () => {
    const match = matchExperts(resolveExpertPreferences(preferences))[0];
    result.innerHTML = renderExpertMatch(match);
    motion.close(()=>resultMotion.open());
  };
  bindExpertWizard(wizard,motion,preferences,()=>step,(next)=>{step=next;update();wizard.querySelector('h2').focus();},showResult);
  root.querySelector('[data-expert-match-open]').addEventListener('click',()=>{update();motion.open();});
  result.addEventListener('click',(event)=>{if(event.target.closest('[data-expert-result-close]')) resultMotion.close();});
  result.addEventListener('cancel',(event)=>{event.preventDefault();resultMotion.close();});
  update(); motion.open();
}
/** @param {HTMLDialogElement} wizard @param {ReturnType<typeof createFieldCareMotion>} motion @param {import('./expert-data.mjs').ExpertPreferences} preferences @param {()=>number} getStep @param {(step:number)=>void} move @param {()=>void} showResult @returns {void} */
const bindExpertWizard = (wizard,motion,preferences,getStep,move,showResult) => {
  wizard.addEventListener('input',(event)=>{
    if (event.target.matches('[data-expert-other]')) preferences[getStep() === 0 ? 'otherCrop' : 'otherTopic'] = event.target.value;
  });
  wizard.addEventListener('cancel',(event)=>{event.preventDefault();motion.close();});
  wizard.addEventListener('click',(event)=>{
    const button = event.target.closest('button');
    if (!button || motion.isClosing()) return;
    const step = getStep();
    if (button.hasAttribute('data-expert-close')) {motion.close();return;}
    if (button.hasAttribute('data-expert-back')) {move(Math.max(0,step-1));return;}
    if (button.dataset.expertChoice) {preferences[STEPS[step].key]=togglePilotPreference(preferences[STEPS[step].key],button.dataset.expertChoice);move(step);return;}
    if (!button.hasAttribute('data-expert-next')) return;
    if (['crop','topic'].includes(STEPS[step].key) && preferences[STEPS[step].key].includes('Other') && !preferences[step === 0 ? 'otherCrop' : 'otherTopic'].trim()) {wizard.querySelector('[data-expert-error]').textContent=t('Please enter a short description.');wizard.querySelector('[data-expert-other]').focus();return;}
    if (!preferences[STEPS[step].key].length) {wizard.querySelector('[data-expert-error]').textContent=t('Choose an option to continue.');return;}
    if (step < STEPS.length-1) move(step+1); else showResult();
  });
};

/** @param {import('./expert-data.mjs').ExpertPreferences & {otherCrop:string,otherTopic:string}} preferences @returns {import('./expert-data.mjs').ExpertPreferences} */
export function resolveExpertPreferences(preferences) {
  const resolve = (value, other) => Array.isArray(value) ? value.map((item) => item === 'Other' ? other.trim().slice(0,80) : item) : value === 'Other' ? other.trim().slice(0,80) : value;
  return {...preferences,crop:resolve(preferences.crop,preferences.otherCrop),topic:resolve(preferences.topic,preferences.otherTopic)};
}

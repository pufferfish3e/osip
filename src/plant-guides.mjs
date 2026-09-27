import { PLANT_GUIDE_COPY } from './locales/plant.mjs';

/**
 * @typedef {'Pests'|'Disease'|'Growing conditions'} PlantGuideCategory
 * @typedef {{title:string,url:string}} PlantGuideSource
 * @typedef {Object} PlantGuide
 * @property {string} slug
 * @property {string} title
 * @property {PlantGuideCategory} category
 * @property {string} summary
 * @property {string[]} symptoms
 * @property {string[]} actions
 * @property {string} whenToGetHelp
 * @property {PlantGuideSource[]} sources
 * @property {string[]} keywords
 * @property {string[]} crops
 * @property {string} icon
 */

/** @type {PlantGuide[]} */
export const PLANT_GUIDES = [
  {
    slug: 'aphids', title: 'Aphids on new growth', category: 'Pests', icon: 'leaf',
    summary: 'Clusters of soft insects, curled shoots and sticky leaves can point to aphids. Check the growing tips before deciding what to do.',
    symptoms: [
      'Look under young leaves and along tender stems for groups of small, pear-shaped insects; their colour can vary from green to black.',
      'Leaves may curl or yellow. Sticky honeydew, ants and dark surface mould can accompany feeding, but none of these signs identifies aphids alone.',
    ],
    actions: [
      'Inspect several affected and nearby healthy plants. Photograph the insects close up and note whether fresh shoots are still growing normally.',
      'On sturdy plants in a small patch, dislodge aphids with water early in the day, allowing foliage to dry; protect delicate seedlings from forceful sprays.',
      'Keep ladybirds, lacewings and other natural enemies. Avoid unnecessary broad-spectrum spraying and extra nitrogen added simply to force new growth.',
    ],
    whenToGetHelp: 'Ask a local crop adviser if colonies keep expanding, seedlings weaken, or new leaves remain distorted; some aphids transmit viruses, which a photo cannot confirm.',
    sources: [{ title: 'University of California IPM · Aphids', url: 'https://ipm.ucanr.edu/home-and-landscape/aphids/' }],
    keywords: ['aphid', 'sticky leaves', 'honeydew', 'ants', 'curled leaves', 'black mould', 'kutu daun'],
    crops: ['Vegetables', 'Chilli', 'Cabbage', 'Cucumber', 'Beans'],
  },
  {
    slug: 'whiteflies', title: 'Whiteflies under leaves', category: 'Pests', icon: 'leaf',
    summary: 'Tiny white insects that lift off when a leaf moves may be whiteflies. Their immature stages stay on the underside, where inspection is most useful.',
    symptoms: [
      'Gently turn leaves over and watch for white, winged adults. Look closely for pale, flat immature insects attached to the lower leaf surface.',
      'Infested foliage may become sticky, yellow or distorted. Dark sooty mould can grow on honeydew; similar symptoms can also accompany other sap-feeding pests.',
    ],
    actions: [
      'Check young and older leaves on several plants, including newly bought seedlings. Record which parts of the plot are affected before moving plants elsewhere.',
      'Yellow sticky cards can help monitor flying adults, but inspect leaves too; a trap count does not show the full population or prove the cause of yellowing.',
      'Keep natural predators and parasitic wasps by avoiding unnecessary broad-spectrum insecticides. Remove heavily infested leaves only where plants can tolerate the loss.',
    ],
    whenToGetHelp: 'Seek local advice if seedlings decline, numbers rise despite early action, or leaves show persistent distortion or unusual colour patterns that could need virus testing.',
    sources: [{ title: 'University of California IPM · Whiteflies', url: 'https://ipm.ucanr.edu/home-and-landscape/whiteflies/' }],
    keywords: ['whitefly', 'white flies', 'white insects', 'sticky leaves', 'honeydew', 'yellow leaves', 'sooty mould', 'lalat putih'],
    crops: ['Vegetables', 'Chilli', 'Tomato', 'Cucumber', 'Brinjal'],
  },
  {
    slug: 'leafminers', title: 'Winding trails in leaves', category: 'Pests', icon: 'leaf',
    summary: 'Pale tunnels inside a leaf can be leafminer feeding. The larvae live between the leaf surfaces, so surface marks alone need a closer look.',
    symptoms: [
      'Look for narrow, twisting white trails that widen along their length. Tiny pale punctures can occur where adult flies have fed or laid eggs.',
      'Young plants and edible leafy crops deserve close attention. Older damaged leaves may remain marked even after an insect has left the mine.',
    ],
    actions: [
      'Compare fresh leaves with older ones and record whether new mines are appearing. Hold a leaf toward the light to inspect the tunnel without tearing it.',
      'Check nursery plants before transplanting, and avoid putting new seedlings beside a heavily infested crop approaching harvest when there is another suitable location.',
      'Clear infested crop residues after harvest and manage host weeds. Preserve the tiny parasitic wasps that help control leafminers by avoiding unnecessary broad-spectrum sprays.',
    ],
    whenToGetHelp: 'Get a crop adviser to inspect spreading damage on seedlings or leaves intended for sale; the crop, growth stage and active infestation determine the next step.',
    sources: [{ title: 'University of California IPM · Leafminers in cole crops', url: 'https://ipm.ucanr.edu/agriculture/cole-crops/leafminers/' }],
    keywords: ['leafminer', 'leaf miner', 'white trails', 'winding lines', 'tunnels', 'mines', 'leaf damage'],
    crops: ['Vegetables', 'Cabbage', 'Mustard greens', 'Cauliflower'],
  },
  {
    slug: 'caterpillars', title: 'Holes and caterpillars', category: 'Pests', icon: 'leaf',
    summary: 'Fresh holes in cabbage or mustard leaves may come from caterpillars. Inspect the undersides and growing point to find the animal responsible.',
    symptoms: [
      'Young diamondback moth larvae can leave thin, translucent patches; older larvae chew holes. Other caterpillars and snails can create similar feeding damage.',
      'Look for small green larvae beneath leaves and around buds. Diamondback moth larvae often wriggle when disturbed or drop on a silk thread.',
    ],
    actions: [
      'Inspect multiple plants, including border rows, and photograph any larvae beside the damage. Count affected plants so you can tell whether the problem is spreading.',
      'Check seedlings and developing heads regularly, where feeding can affect growth or harvest quality. Record active insects separately from old holes that are no longer increasing.',
      'Protect natural enemies by avoiding routine broad-spectrum spraying. For the next planting, plan crop rotation and discuss nearby overlapping cabbage-family plantings with your adviser.',
    ],
    whenToGetHelp: 'Request local identification if growing points are damaged, larvae enter heads, or feeding increases; different caterpillars need different management, and pesticide resistance can complicate treatment.',
    sources: [{ title: 'University of California IPM · Diamondback moth', url: 'https://ipm.ucanr.edu/agriculture/cole-crops/diamondback-moth/' }],
    keywords: ['caterpillar', 'holes in leaves', 'chewed leaves', 'diamondback moth', 'larvae', 'worms', 'ulat'],
    crops: ['Vegetables', 'Cabbage', 'Mustard greens', 'Cauliflower'],
  },
  {
    slug: 'rice-planthoppers', title: 'Planthoppers in rice', category: 'Pests', icon: 'plant-2',
    summary: 'Planthoppers feed low on rice stems and can cause patches of drying plants. Inspect the base of tillers, not just the leaf tips.',
    symptoms: [
      'Look for small pale-to-brown insects around the lower stems. Gently tapping a bent plant can reveal insects falling onto the water surface.',
      'Heavy feeding can turn rice orange-yellow, then brown and dry: hopperburn. Honeydew or dark mould may be present near the base, but check for insects too.',
    ],
    actions: [
      'Walk across the field and inspect plant bases in several locations. Record crop stage, affected patches, insect numbers and natural enemies such as spiders.',
      'Avoid unnecessary early or broad-spectrum insecticide applications, which can remove natural enemies. Review nitrogen inputs with your adviser rather than adding extra fertiliser to yellow patches.',
      'Continue scouting and compare observations over time. For future planting, ask about locally suitable resistant varieties and practices that avoid an overly dense canopy.',
    ],
    whenToGetHelp: 'Contact a rice adviser promptly when drying patches expand or populations rise; a leaf photo alone cannot distinguish hopperburn from other causes of crop decline.',
    sources: [{ title: 'IRRI Rice Doctor · Planthopper', url: 'https://keyserver.lucidcentral.org/key-server/data/0e090d01-0209-460e-810c-0d060708030c/media/Html/Planthopper.htm' }],
    keywords: ['planthopper', 'brown planthopper', 'hopperburn', 'yellow rice', 'dry patches', 'paddy', 'benah perang'],
    crops: ['Rice'],
  },
  {
    slug: 'rice-blast', title: 'Spots that may be rice blast', category: 'Disease', icon: 'plant-2',
    summary: 'Rice blast can produce pointed, pale-centred leaf lesions. Similar-looking spots have other causes, so use this guide to gather useful evidence for identification.',
    symptoms: [
      'Older lesions are often spindle-shaped, with pointed ends, a grey or whitish centre and a brown border. Several lesions may join as damage advances.',
      'Inspect the junction between leaf blade and sheath as well as the leaf. Rounder brown spots with yellow margins can indicate a different problem.',
    ],
    actions: [
      'Photograph a whole plant, several lesions and the wider affected patch in daylight. Record the variety, crop stage, recent rain and when symptoms first appeared.',
      'Avoid adding extra nitrogen in response to damaged leaves. Discuss a balanced, split nitrogen programme and suitable water management with a local rice adviser.',
      'Monitor surrounding plants and keep a record of whether spots spread. For the next crop, ask which blast-resistant varieties suit your location and production system.',
    ],
    whenToGetHelp: 'Arrange prompt inspection if lesions spread or the crop is approaching heading; blast can affect more than leaves, and a photo is insufficient to choose treatment.',
    sources: [{ title: 'IRRI Rice Doctor · Blast, leaf and collar', url: 'https://keyserver.lucidcentral.org/key-server/data/0e090d01-0209-460e-810c-0d060708030c/media/Html/Blast_%28Leaf_and_Collar%29.htm' }],
    keywords: ['blast', 'rice disease', 'leaf spots', 'brown spots', 'grey centres', 'fungus', 'paddy', 'karah'],
    crops: ['Rice'],
  },
  {
    slug: 'yellow-leaves', title: 'Why leaves turn yellow', category: 'Growing conditions', icon: 'leaf',
    summary: 'Yellow leaves are a symptom, not a diagnosis. Water, nutrition, insects, disease and normal ageing can all change leaf colour, so check the pattern first.',
    symptoms: [
      'Note whether yellowing starts on older lower leaves or fresh growth, and whether the whole leaf changes colour or veins stay greener than surrounding tissue.',
      'A few ageing lower leaves with healthy new growth differ from many plants rapidly turning yellow. Look for wilting, spots, insects and damaged roots as accompanying clues.',
    ],
    actions: [
      'Check soil moisture below the surface and look under leaves for pests. Compare an affected plant with a healthy one of the same crop and age.',
      'Record recent irrigation, heavy rain, fertiliser and spray applications. Photograph the entire plant as well as individual leaves so the distribution remains visible.',
      'Avoid adding fertiliser solely because a leaf is yellow. Ask about soil nutrient and pH testing when nutrition is suspected, and adjust inputs to verified crop needs.',
    ],
    whenToGetHelp: 'Seek local advice when yellowing spreads, new growth is affected or plants wilt despite suitable moisture; tests may be needed to separate root disease from nutrient problems.',
    sources: [
      { title: 'University of Maryland Extension · Yellowing vegetable leaves', url: 'https://extension.umd.edu/resource/yellowing-leaves-vegetable-plants' },
      { title: 'University of Maryland Extension · Nutrient deficiency', url: 'https://extension.umd.edu/resource/nutrient-deficiency-vegetable-plants' },
    ],
    keywords: ['yellow leaf', 'yellowing', 'chlorosis', 'pale leaves', 'nutrient deficiency', 'nitrogen', 'iron', 'daun kuning'],
    crops: ['Vegetables', 'Chilli', 'Tomato', 'Cabbage', 'Cucumber'],
  },
  {
    slug: 'water-stress', title: 'Wilting in heat or dry soil', category: 'Growing conditions', icon: 'droplet',
    summary: 'Drooping vegetable leaves can signal water stress, but hot weather, wet roots and disease can look alike. Check the soil before adding more water.',
    symptoms: [
      'Leaves may droop during the hottest part of the day and recover as conditions cool. Persistent wilting, dry edges and slowed growth deserve closer inspection.',
      'Feel the soil below the surface near the root zone. A dry crust alone does not tell you whether roots have water; compare several places in the bed.',
    ],
    actions: [
      'Check plants again in the cooler morning and note whether they recover. Record recent rain, irrigation and unusually hot or windy weather alongside your photos.',
      'If the root zone is dry, water slowly at soil level so moisture reaches roots, then reassess. Match frequency to the crop, soil and weather rather than a fixed daily routine.',
      'Check for blocked irrigation outlets or uneven watering. If soil is already saturated, investigate drainage instead; adding more water can worsen root stress.',
    ],
    whenToGetHelp: 'Ask for local diagnosis when wilting persists after moisture is corrected, one side of a plant collapses, or stems and roots show decay; irrigation alone may not solve it.',
    sources: [{ title: 'University of Maryland Extension · Wilting vegetable plants', url: 'https://extension.umd.edu/resource/wilting-vegetable-plants' }],
    keywords: ['wilting', 'drooping', 'dry soil', 'drought', 'heat stress', 'water shortage', 'dry edges', 'layu'],
    crops: ['Vegetables', 'Chilli', 'Tomato', 'Cucumber', 'Brinjal'],
  },
  {
    slug: 'waterlogging', title: 'Wet soil and struggling roots', category: 'Growing conditions', icon: 'droplet',
    summary: 'Vegetables can wilt even in wet soil. Poor drainage limits air around roots and can favour disease; this guide is for vegetable beds and containers, not flooded rice.',
    symptoms: [
      'Look for wilting or yellowing after prolonged rain, irrigation or standing water. Compare low areas with better-drained parts of the same bed.',
      'Check drainage holes and soil below the surface. Brown, soft roots or decaying stem bases need closer investigation; appearance alone cannot identify a particular root disease.',
    ],
    actions: [
      'Pause unnecessary irrigation while the root zone remains saturated. Clear accessible container drainage holes and inspect existing bed drains without damaging roots.',
      'Avoid walking, digging or operating equipment on waterlogged beds, which can compact soil. Record where water collects and how long it remains after rain stops.',
      'For future vegetable planting, improve drainage and consider raised beds where appropriate. Keep plant roots intact when checking seedlings; repeated disturbance adds another source of stress.',
    ],
    whenToGetHelp: 'Request local advice if plants keep collapsing after drainage improves or roots and stems rot; damaged roots and soilborne disease may require different responses.',
    sources: [
      { title: 'University of Maryland Extension · Vegetable seedling stress', url: 'https://www.extension.umd.edu/resource/vegetable-seedlings-or-transplant-leaves-yellowing-turning-white-or-are-spotted-or-scorched' },
      { title: 'University of Minnesota Extension · Climate-ready gardening', url: 'https://extension.umn.edu/garden-and-home/yard-and-garden/gardening-in-minnesota/tips-for-climate-ready-gardening' },
      { title: 'University of Maryland Extension · Wilting vegetable plants', url: 'https://extension.umd.edu/resource/wilting-vegetable-plants' },
    ],
    keywords: ['waterlogged', 'waterlogging', 'overwatering', 'wet soil', 'root rot', 'standing water', 'poor drainage', 'yellow leaves', 'wilting'],
    crops: ['Vegetables', 'Chilli', 'Tomato', 'Cabbage', 'Seedlings'],
  },
  {
    slug: 'snails', title: 'Snails and missing seedlings', category: 'Pests', icon: 'leaf',
    summary: 'Missing rice seedlings or ragged vegetable leaves can be snail damage. Identify the animal and crop context before choosing a response.',
    symptoms: [
      'In young rice, golden apple snails can cut stems near the base, leaving gaps. Bright pink egg clusters on objects above water are a useful clue.',
      'On vegetables, look for irregular holes, damaged tender seedlings and silvery slime trails. Slugs lack a shell and may hide under damp debris during daylight.',
    ],
    actions: [
      'Inspect damp areas early or after dark, using gloves or tools to collect pests. Photograph the animal, eggs and damage rather than relying on a damaged leaf alone.',
      'For rice, check irrigation entry points and discuss suitable screens and crop-stage water management with your local adviser; avoid transferring snails to other waterways.',
      'For vegetable beds, remove unnecessary damp hiding places and check beneath nearby boards or debris. Coordinate rice snail and egg collection with neighbouring growers where possible.',
    ],
    whenToGetHelp: 'Seek prompt local help when young rice stands are disappearing or seedling losses continue; management depends on the snail species, crop stage and field water system.',
    sources: [
      { title: 'IRRI Rice Knowledge Bank · Golden apple snail', url: 'https://www.knowledgebank.irri.org/step-by-step-production/growth/pests-and-diseases/golden-apple-snails' },
      { title: 'University of Maryland Extension · Slugs and snails', url: 'https://extension.umd.edu/resource/slugs-and-snails-vegetables' },
    ],
    keywords: ['snail', 'slug', 'golden apple snail', 'missing seedlings', 'holes', 'slime trails', 'pink eggs', 'paddy', 'siput gondang'],
    crops: ['Rice', 'Vegetables', 'Cabbage', 'Seedlings'],
  },
];

const SEARCH_WEIGHTS = { title: 8, keywords: 5, category: 4, crops: 4, symptoms: 2, summary: 1, phrase: 12 };
const SEARCH_STOP_WORDS = new Set(['a', 'an', 'and', 'are', 'for', 'in', 'is', 'my', 'of', 'on', 'the', 'to', 'with']);
const SEARCH_ALIASES = new Map([
  ['leaves', 'leaf'], ['pests', 'pest'], ['holes', 'hole'], ['yellowing', 'yellow'],
  ['aphids', 'aphid'], ['whiteflies', 'whitefly'], ['leafminers', 'leafminer'],
  ['caterpillars', 'caterpillar'], ['planthoppers', 'planthopper'], ['snails', 'snail'],
  ['slugs', 'slug'], ['vegetables', 'vegetable'], ['waterlogged', 'waterlogging'],
]);

/** @param {string} value @returns {string} */
const normalizeSearch = (value) => value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** @param {string} value @returns {string[]} */
const searchTokens = (value) => [...new Set(normalizeSearch(value).split(' ').filter(Boolean).map((token) => SEARCH_ALIASES.get(token) ?? token))];

/** @param {PlantGuide} guide @param {string} locale @returns {PlantGuide} */
export function localizePlantGuide(guide, locale) {
  const copy = PLANT_GUIDE_COPY[locale]?.[guide.slug];
  return copy ? { ...guide, ...copy } : guide;
}

/** @param {PlantGuide} guide @param {string[]} tokens @param {string} phrase @returns {number} */
const scoreGuide = (guide, tokens, phrase) => {
  const localized = Object.keys(PLANT_GUIDE_COPY).map((locale) => localizePlantGuide(guide, locale));
  const fields = [
    { value: guide.title, weight: SEARCH_WEIGHTS.title },
    { value: guide.keywords.join(' '), weight: SEARCH_WEIGHTS.keywords },
    { value: guide.category, weight: SEARCH_WEIGHTS.category },
    { value: guide.crops.join(' '), weight: SEARCH_WEIGHTS.crops },
    { value: guide.symptoms.join(' '), weight: SEARCH_WEIGHTS.symptoms },
    { value: guide.summary, weight: SEARCH_WEIGHTS.summary },
    ...localized.map((copy) => ({ value: [copy.title, ...copy.keywords, copy.summary].join(' '), weight: SEARCH_WEIGHTS.keywords })),
  ].map((field) => ({ tokens: new Set(searchTokens(field.value)), text: normalizeSearch(field.value), weight: field.weight }));
  const tokenScores = tokens.map((token) => fields.reduce((score, field) => score + (field.tokens.has(token) || (/\p{Script=Han}/u.test(token) && field.text.includes(token)) ? field.weight : 0), 0));
  if (tokenScores.some((score) => score === 0)) return 0;
  const phraseBonus = normalizeSearch(guide.title).includes(phrase) ? SEARCH_WEIGHTS.phrase : 0;
  return tokenScores.reduce((sum, score) => sum + score, phraseBonus);
};

/** @param {string} query @param {PlantGuideCategory|'all'} [category] @returns {PlantGuide[]} */
export function searchPlantGuides(query, category = 'all') {
  const guides = PLANT_GUIDES.filter((guide) => category === 'all' || guide.category === category);
  const phrase = normalizeSearch(query);
  if (!phrase) return guides;
  const tokens = searchTokens(query).filter((token) => !SEARCH_STOP_WORDS.has(token));
  if (!tokens.length) return [];
  return guides.map((guide) => ({ guide, score: scoreGuide(guide, tokens, phrase) }))
    .filter((result) => result.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((result) => result.guide);
}

/** @param {string} slug @returns {PlantGuide|undefined} */
export function findPlantGuide(slug) {
  return PLANT_GUIDES.find((guide) => guide.slug === slug);
}

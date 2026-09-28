import { OPEN_ARTICLES } from './open-articles.mjs';
import { MALAYSIA_ARTICLES, MALAYSIA_CONTEXT } from './malaysia-articles.mjs';
import { PLANT_GUIDES } from './plant-guides.mjs';
import { EXTENSION_ARTICLES } from './extension-articles.mjs';
import { EVERYDAY_PRODUCTS, REAL_PRODUCTS } from './real-products.mjs';
const TODAY = new Date();
const DATE_OFFSET_DAYS = { tomorrow: 1, course: 6, workshop: 12, nextCourse: 18 };

/** @param {number} offset @returns {string} */
const dateAfter = (offset) => {
  const date = new Date(TODAY);
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

export const ARTICLES = [
  ...PLANT_GUIDES.map((guide) => ({
    id: `practical-${guide.slug}`, slug: `practical-${guide.slug}`, plantGuideSlug: guide.slug,
    title: guide.title, category: guide.category, topics: [guide.category], crop: guide.crops[0] ?? 'All crops',
    readTime: 2, image: `/assets/article-${guide.slug}.jpg`, thumbnail: `/assets/article-${guide.slug}.jpg`,
    summary: guide.summary, author: 'Aura editorial', reviewedAt: '', source: guide.sources[0].title,
    sourceUrl: guide.sources[0].url, isDemo: false, kind: 'practical',
    region: 'MY', malaysiaSourceUrl: MALAYSIA_CONTEXT[guide.slug]?.sourceUrl, keywords: guide.keywords,
    sections: [{title: 'Look for', body: guide.symptoms.join(' ')}, {title: 'What to do first', body: guide.actions.join(' ')}, {title: 'When to get help', body: guide.whenToGetHelp}],
  })),
  ...MALAYSIA_ARTICLES,
  ...OPEN_ARTICLES,
  ...EXTENSION_ARTICLES,
  {
    id: 'soil-check', slug: 'getting-to-know-your-soil', title: 'Start with your soil',
    category: 'Soil', crop: 'All crops', readTime: 4, image: '/assets/learn-soil.jpg', thumbnail: '/assets/learn-soil-thumb.jpg',
    summary: 'A simple field notebook can help you ask better questions about your soil.',
    author: 'Aura editorial', reviewedAt: '', source: 'Guide · awaiting agricultural review', sourceUrl: '', isDemo: true,
    sections: [
      { title: 'Give each plot a name', body: 'Keep observations linked to the same plot. Record the date, recent weather, and where you looked so you can compare notes over time.' },
      { title: 'Record what you can observe', body: 'Photograph the surface and note visible standing water, cracking, or differences between areas. These notes describe conditions; they do not diagnose a soil problem.' },
      { title: 'Bring your questions to an adviser', body: 'Ask a local agricultural adviser which laboratory tests and sampling approach suit your crop and location before making input decisions.' },
    ],
  },
  {
    id: 'water-records', slug: 'make-a-water-log', title: 'Make every water record useful',
    category: 'Water', crop: 'Rice', readTime: 3, image: '/assets/learn-water.jpg', thumbnail: '/assets/learn-water-thumb.jpg',
    summary: 'Keep rainfall, irrigation, and field observations together.',
    author: 'Aura editorial', reviewedAt: '', source: 'Guide · awaiting agricultural review', sourceUrl: '', isDemo: true,
    sections: [
      { title: 'Choose a consistent record', body: 'For each watering activity, note the plot, start time, duration, and measured volume if you have it. Mark estimates as estimates.' },
      { title: 'Add context', body: 'Attach a photo and a short observation before and after the activity. Record local rainfall separately from a forecast.' },
      { title: 'Review with crop context', body: 'Use the log when speaking with your local adviser. Water needs depend on the crop, growth stage, soil, and local conditions.' },
    ],
  },
  {
    id: 'crop-scouting', slug: 'a-better-crop-scouting-note', title: 'A better crop scouting note',
    category: 'Pests', crop: 'Vegetables', readTime: 5, image: '/assets/learn-scouting.jpg', thumbnail: '/assets/learn-scouting-thumb.jpg',
    summary: 'Turn an observation into a clear record you can share with an expert.',
    author: 'Aura editorial', reviewedAt: '', source: 'Guide · awaiting agricultural review', sourceUrl: '', isDemo: true,
    sections: [
      { title: 'Capture the whole picture', body: 'Record the crop, plot, date, and which part of the plant looks different. Include both a close photo and a wider view.' },
      { title: 'Describe the pattern', body: 'Note whether the observation is isolated or repeated across the plot, and whether nearby plants look similar. Keep observations separate from guesses about the cause.' },
      { title: 'Request a diagnosis', body: 'Share the record with a qualified local adviser. A photograph alone may not establish the cause, and this sample guide does not recommend a treatment.' },
    ],
  },
  {
    id: 'harvest-records', slug: 'keep-a-simple-harvest-record', title: 'Know your harvest, plot by plot',
    category: 'Harvest', crop: 'All crops', readTime: 3, image: '/assets/learn-harvest.jpg', thumbnail: '/assets/learn-harvest-thumb.jpg',
    summary: 'Connect harvest quantities and costs to the plot that produced them.',
    author: 'Aura editorial', reviewedAt: '', source: 'Guide · awaiting agricultural review', sourceUrl: '', isDemo: true,
    sections: [
      { title: 'Start with a unit', body: 'Record quantity in one consistent unit, such as kilograms, alongside the harvest date and plot. Keep measured and estimated quantities distinct.' },
      { title: 'Keep costs visible', body: 'Save labour, transport, packaging, and other costs with their receipts. Record the actual sale price when it is available.' },
      { title: 'Compare carefully', body: 'The calculator can show a simple revenue-minus-cost estimate. Differences in area, crop, season, and missing costs affect whether records can be compared.' },
    ],
  },
];

let articleCataloguePromise = null;
let articleCatalogueLoaded = false;
export const isArticleCatalogueLoaded = () => articleCatalogueLoaded;
/** Load the legacy publication catalogue only when a detail route needs it. */
export function loadArticleCatalogue() {
  if (!articleCataloguePromise) articleCataloguePromise = import('./article-catalogue.mjs').then(({ ARTICLE_CATALOGUE }) => {
    ARTICLES.splice(PLANT_GUIDES.length + MALAYSIA_ARTICLES.length + OPEN_ARTICLES.length + EXTENSION_ARTICLES.length, 0, ...ARTICLE_CATALOGUE);
    articleCatalogueLoaded = true;
  }).catch((error) => { articleCataloguePromise = null; throw error; });
  return articleCataloguePromise;
}

export const COURSES = [
  {
    id: 'field-mapping', title: 'Your first digital field map', category: 'Technology', instructor: 'Nadia Rahman',
    format: 'In person', location: 'Perak', date: dateAfter(DATE_OFFSET_DAYS.course), time: '09:00', duration: '3 hours',
    price: 0, seats: 8, image: '/assets/course.jpg', summary: 'Practice turning field observations into a simple map and a useful plot record.',
    topics: ['Organising plot records', 'Reading a sample field map', 'Planning a mapping request'], isDemo: true,
  },
  {
    id: 'soil-basics', title: 'Read your soil report', category: 'Soil', instructor: 'Amir Lim',
    format: 'Online', location: 'Online classroom', date: dateAfter(DATE_OFFSET_DAYS.workshop), time: '14:00', duration: '90 minutes',
    price: 0, seats: 16, image: '/assets/crops.jpg', summary: 'Learn the vocabulary used in a sample soil report and prepare questions for your adviser.',
    topics: ['Report terminology', 'Keeping sample records', 'Questions for a local specialist'], isDemo: true,
  },
  {
    id: 'drone-intro', title: 'Working with a drone pilot', category: 'Technology', instructor: 'Maya Tan',
    format: 'In person', location: 'Perak', date: dateAfter(DATE_OFFSET_DAYS.nextCourse), time: '10:00', duration: '2 hours',
    price: 0, seats: 12, image: '/assets/drone.jpg', summary: 'Prepare a clear service brief, share plot information, and understand the booking process.',
    topics: ['Choosing a service', 'Sharing field requirements', 'Agreeing scope and schedule'], isDemo: true,
  },
  {
    "id": "pest-scouting",
    "title": "Spot pests early",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Inspect leaves and shoots. Keep a pest observation log.",
    "topics": [
        "Inspect leaves and shoots",
        "Keep a pest observation log"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 1)
  },
  {
    "id": "aphid-checks",
    "title": "Recognising aphids",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Compare insects on young shoots. Record leaf curling and sticky residue.",
    "topics": [
        "Compare insects on young shoots",
        "Record leaf curling and sticky residue"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 2)
  },
  {
    "id": "beneficial-insects",
    "title": "Know your helpful insects",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Distinguish predators from crop pests. Document insects before choosing a response.",
    "topics": [
        "Distinguish predators from crop pests",
        "Document insects before choosing a response"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 3)
  },
  {
    "id": "plant-symptoms",
    "title": "Investigate yellow leaves",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Compare old and new growth. Prepare symptom photos for an adviser.",
    "topics": [
        "Compare old and new growth",
        "Prepare symptom photos for an adviser"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 4)
  },
  {
    "id": "seedling-care",
    "title": "Start stronger seedlings",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Track germination and seedling losses. Plan a nursery inspection routine.",
    "topics": [
        "Track germination and seedling losses",
        "Plan a nursery inspection routine"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 5)
  },
  {
    "id": "crop-rotation",
    "title": "Plan your crop rotation",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Group crops by plant family. Sketch a rotation for your fields.",
    "topics": [
        "Group crops by plant family",
        "Sketch a rotation for your fields"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 6)
  },
  {
    "id": "weed-records",
    "title": "Understand field weeds",
    "category": "Crop care",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-scouting.jpg",
    "summary": "Map recurring weed patches. Compare management options with an adviser.",
    "topics": [
        "Map recurring weed patches",
        "Compare management options with an adviser"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 7)
  },
  {
    "id": "soil-sampling",
    "title": "Take useful soil samples",
    "category": "Soil",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-soil.jpg",
    "summary": "Plan sampling locations with your laboratory. Label samples and record field history.",
    "topics": [
        "Plan sampling locations with your laboratory",
        "Label samples and record field history"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 8)
  },
  {
    "id": "compost-basics",
    "title": "Understand composting",
    "category": "Soil",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-soil.jpg",
    "summary": "Compare compost ingredients. Keep moisture and temperature records.",
    "topics": [
        "Compare compost ingredients",
        "Keep moisture and temperature records"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 9)
  },
  {
    "id": "soil-cover",
    "title": "Keep your soil covered",
    "category": "Soil",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-soil.jpg",
    "summary": "Compare mulch and cover crop options. Plan a small field trial.",
    "topics": [
        "Compare mulch and cover crop options",
        "Plan a small field trial"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 10)
  },
  {
    "id": "soil-compaction",
    "title": "Spot soil compaction",
    "category": "Soil",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-soil.jpg",
    "summary": "Record traffic and wet areas. Prepare questions about root growth.",
    "topics": [
        "Record traffic and wet areas",
        "Prepare questions about root growth"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 11)
  },
  {
    "id": "irrigation-planning",
    "title": "Plan irrigation checks",
    "category": "Water",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-water.jpg",
    "summary": "Compare water delivery across a field. Create a leak inspection checklist.",
    "topics": [
        "Compare water delivery across a field",
        "Create a leak inspection checklist"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 12)
  },
  {
    "id": "drainage-checks",
    "title": "Inspect field drainage",
    "category": "Water",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-water.jpg",
    "summary": "Map standing water after rain. Document blocked or damaged drains.",
    "topics": [
        "Map standing water after rain",
        "Document blocked or damaged drains"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 13)
  },
  {
    "id": "rain-records",
    "title": "Turn rainfall into records",
    "category": "Water",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-water.jpg",
    "summary": "Read and log a rain gauge. Compare rainfall with field observations.",
    "topics": [
        "Read and log a rain gauge",
        "Compare rainfall with field observations"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 14)
  },
  {
    "id": "weather-decisions",
    "title": "Read a forecast for fieldwork",
    "category": "Water",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-water.jpg",
    "summary": "Interpret wind and rain forecasts. Plan around forecast uncertainty.",
    "topics": [
        "Interpret wind and rain forecasts",
        "Plan around forecast uncertainty"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 15)
  },
  {
    "id": "harvest-quality",
    "title": "Plan a quality harvest",
    "category": "Harvest",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-harvest.jpg",
    "summary": "Define crop-specific harvest checks. Record handling and quality losses.",
    "topics": [
        "Define crop-specific harvest checks",
        "Record handling and quality losses"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 16)
  },
  {
    "id": "postharvest-handling",
    "title": "Reduce handling losses",
    "category": "Harvest",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-harvest.jpg",
    "summary": "Map the journey from field to buyer. Compare packaging and shade options.",
    "topics": [
        "Map the journey from field to buyer",
        "Compare packaging and shade options"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 17)
  },
  {
    "id": "harvest-budget",
    "title": "Build a harvest budget",
    "category": "Harvest",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/learn-harvest.jpg",
    "summary": "List labour and transport costs. Compare expected and actual returns.",
    "topics": [
        "List labour and transport costs",
        "Compare expected and actual returns"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 18)
  },
  {
    "id": "field-photography",
    "title": "Take better crop photos",
    "category": "Technology",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/course.jpg",
    "summary": "Capture whole plants and close-up details. Organise photos by field and date.",
    "topics": [
        "Capture whole plants and close-up details",
        "Organise photos by field and date"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 19)
  },
  {
    "id": "farm-spreadsheets",
    "title": "Simple farm spreadsheets",
    "category": "Technology",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/course.jpg",
    "summary": "Set up an input and harvest ledger. Check units and missing entries.",
    "topics": [
        "Set up an input and harvest ledger",
        "Check units and missing entries"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 20)
  },
  {
    "id": "drone-reports",
    "title": "Read a drone survey report",
    "category": "Technology",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/course.jpg",
    "summary": "Compare imagery with ground observations. Ask about coverage and data limitations.",
    "topics": [
        "Compare imagery with ground observations",
        "Ask about coverage and data limitations"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 21)
  },
  {
    "id": "season-planning",
    "title": "Plan your growing season",
    "category": "Technology",
    "instructor": "Aura editorial",
    "format": "Online",
    "location": "Online classroom",
    "time": "10:00",
    "duration": "90 minutes",
    "price": 0,
    "seats": 16,
    "image": "/assets/course.jpg",
    "summary": "Build a calendar of field activities. Assign tasks and review progress.",
    "topics": [
        "Build a calendar of field activities",
        "Assign tasks and review progress"
    ],
    "isDemo": true,
    "date": dateAfter(DATE_OFFSET_DAYS.workshop + 22)
  },
];

export const PILOTS = [
  {
    id: 'azlan', reviews: ['Clear field maps and a helpful handover.', 'Arrived on time and explained the survey clearly.'], portrait: '/assets/pilot-azlan.webp', name: 'Azlan Ibrahim', initials: 'AI', serviceArea: 'Perak', services: ['Mapping', 'Crop survey'],
    equipment: 'Multispectral survey drone', rating: 4.9, reviewCount: 28, rate: 65, rateUnit: 'ha', available: dateAfter(DATE_OFFSET_DAYS.tomorrow),
    status: 'Profile', bio: 'Example mapping service for farmers who want organised plot imagery and a clear record of field observations.', isDemo: true,
  },
  {
    id: 'maya', reviews: ['Explained the plan before starting work.', 'Easy to coordinate the visit and field access.'], portrait: '/assets/pilot-maya.webp', name: 'Maya Tan', initials: 'MT', serviceArea: 'Perak & Kedah', services: ['Mapping', 'Spraying'],
    equipment: 'Agricultural application drone', rating: 4.8, reviewCount: 19, rate: 75, rateUnit: 'ha', available: dateAfter(DATE_OFFSET_DAYS.tomorrow),
    status: 'Profile', bio: 'Example agricultural service profile. Job scope, permissions, site conditions, and any application details require professional review.', isDemo: true,
  },
  {
    id: 'daniel', reviews: ['Useful crop photos with clear notes.', 'Careful survey and an organised handover.'], portrait: '/assets/pilot-daniel.webp', name: 'Daniel Lee', initials: 'DL', serviceArea: 'Kedah', services: ['Crop survey', 'Mapping'],
    equipment: 'Survey drone with RGB camera', rating: 4.9, reviewCount: 34, rate: 60, rateUnit: 'ha', available: dateAfter(DATE_OFFSET_DAYS.course),
    status: 'Profile', bio: 'Example survey service for comparing field photographs and documenting plot boundaries supplied by the farmer.', isDemo: true,
  },
  {"id":"hakim","reviews":[],"portrait":"/assets/pilot-hakim.jpg","name":"Hakim Roslan","initials":"HR","serviceArea":"Perak","services":["Spraying"],"equipment":"Agricultural application drone","rating":0,"reviewCount":0,"rate":80,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(1)},
  {"id":"kelvin","reviews":[],"portrait":"/assets/pilot-kelvin.jpg","name":"Kelvin Wong","initials":"KW","serviceArea":"Perak & Kedah","services":["Mapping","Crop survey"],"equipment":"Multispectral survey drone","rating":0,"reviewCount":0,"rate":70,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(2)},
  {"id":"siti","reviews":[],"portrait":"/assets/pilot-siti.jpg","name":"Siti Amina","initials":"SA","serviceArea":"Perak","services":["Mapping"],"equipment":"Survey drone with RTK positioning","rating":0,"reviewCount":0,"rate":68,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(3)},
  {"id":"ravi","reviews":[],"portrait":"/assets/pilot-ravi.jpg","name":"Ravi Subramaniam","initials":"RS","serviceArea":"Kedah","services":["Spraying","Crop survey"],"equipment":"Agricultural application drone","rating":0,"reviewCount":0,"rate":85,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(1)},
  {"id":"amir","reviews":[],"portrait":"/assets/pilot-amir.jpg","name":"Amir Faiz","initials":"AF","serviceArea":"Perak & Kedah","services":["Mapping","Spraying"],"equipment":"Survey and application drone kit","rating":0,"reviewCount":0,"rate":90,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(4)},
  {"id":"joanne","reviews":[],"portrait":"/assets/pilot-joanne.jpg","name":"Joanne Teoh","initials":"JT","serviceArea":"Perak","services":["Crop survey","Mapping"],"equipment":"Survey drone with RGB camera","rating":0,"reviewCount":0,"rate":62,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(2)},
  {"id":"izzat","reviews":[],"portrait":"/assets/pilot-izzat.jpg","name":"Izzat Hamdan","initials":"IH","serviceArea":"Kedah","services":["Mapping","Spraying"],"equipment":"Agricultural application drone","rating":0,"reviewCount":0,"rate":78,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(3)},
  {"id":"nabil","reviews":[],"portrait":"/assets/pilot-nabil.jpg","name":"Nabil Zain","initials":"NZ","serviceArea":"Perak","services":["Crop survey","Spraying"],"equipment":"Agricultural drone with field camera","rating":0,"reviewCount":0,"rate":72,"rateUnit":"ha","status":"Profile","bio":"Demo agricultural drone service profile. Equipment, prices and availability are illustrative; no professional credentials have been verified.","isDemo":true,"available":dateAfter(5)},
];

export const PRODUCTS = [
  ...EVERYDAY_PRODUCTS,
  ...REAL_PRODUCTS,
  {
    id: 'scout-drone', name: 'Field Scout drone', category: 'Drones', price: 4800, image: '/assets/drone.jpg',
    description: 'A fictional survey-drone listing for exploring the shop and checkout flow. Specifications and pricing are illustrative.',
    specs: ['Sample RGB imaging kit', 'Sample flight controller', 'Supplier consultation required'], isDemo: true,
  },
  {
    id: 'field-battery', name: 'Field power kit', category: 'Accessories', price: 680, image: '/assets/shop-power.jpg',
    description: 'A fictional spare-power kit. Confirm model compatibility and supplier specifications before a real purchase.',
    specs: ['Sample battery kit', 'Sample charging case', 'Compatibility to be confirmed'], isDemo: true,
  },
  {
    id: 'weather-meter', name: 'Pocket weather meter', category: 'Field tools', price: 240, image: '/assets/shop-weather.jpg',
    description: 'A fictional handheld field-instrument listing. Readings, calibration, and suitability would depend on the actual device.',
    specs: ['Sample wind reading', 'Sample temperature display', 'Illustrative product'], isDemo: true,
  },
];

export const NEWS = [
  {
    id: 'field-notebook', slug: 'a-fresh-start-for-field-records', title: 'A fresh start for your field records', category: 'From Aura',
    date: dateAfter(0), summary: 'Try the schedule and keep your next field visit organised.',
    body: 'Create a task, choose a plot, and add a date. The prototype saves records on this device so you can explore the daily workflow. These are product notes, not a live agricultural news feed.',
    source: 'Aura editorial', sourceUrl: '', image: '/assets/farm.jpg', isDemo: true,
  },
  {
    id: 'learning-calendar', slug: 'explore-the-learning-calendar', title: 'Make room to learn something new', category: 'Learning',
    date: dateAfter(0), summary: 'Explore sample workshops on mapping, soil reports, and working with pilots.',
    body: 'The sample course catalogue shows how farmers could compare topics, formats, and dates. All courses are free. All instructors, venues, seats, and enrollments in this prototype are illustrative.',
    source: 'Aura editorial', sourceUrl: '', image: '/assets/course.jpg', isDemo: true,
  },
];

export const WEATHER = {
  isDemo: true, location: 'Perak', temperature: 28, condition: 'Partly cloudy', humidity: 76,
  rainChance: 40, windSpeed: 12, gusts: 20, windDirection: 'NE', windDegrees: 45, updatedAt: 'Sample forecast · not live',
  hourly: [
    { time: 'Now', temperature: 28, rainChance: 40, condition: 'Partly cloudy', windSpeed: 12, humidity: 76 },
    { time: '11:00', temperature: 29, rainChance: 35, condition: 'Cloudy', windSpeed: 14, humidity: 72 },
    { time: '12:00', temperature: 30, rainChance: 50, condition: 'Light rain', windSpeed: 18, humidity: 78 },
    { time: '13:00', temperature: 29, rainChance: 65, condition: 'Showers', windSpeed: 16, humidity: 85 },
    { time: '14:00', temperature: 28, rainChance: 60, condition: 'Showers', windSpeed: 13, humidity: 82 },
    { time: '15:00', temperature: 28, rainChance: 45, condition: 'Cloudy', windSpeed: 10, humidity: 79 },
  ],
  daily: [
    { day: 'Today', high: 30, low: 24, rainChance: 40, condition: 'Partly cloudy' },
    { day: 'Tomorrow', high: 31, low: 24, rainChance: 55, condition: 'Showers' },
    { day: 'Day 3', high: 30, low: 25, rainChance: 65, condition: 'Rain' },
    { day: 'Day 4', high: 32, low: 25, rainChance: 30, condition: 'Partly cloudy' },
    { day: 'Day 5', high: 31, low: 24, rainChance: 35, condition: 'Cloudy' },
    { day: 'Day 6', high: 30, low: 24, rainChance: 50, condition: 'Showers' },
    { day: 'Day 7', high: 31, low: 25, rainChance: 40, condition: 'Partly cloudy' },
  ],
};

/** @type {import('./store.mjs').AppState} */
export { SEED_STATE as INITIAL_STATE } from './storage-seed.mjs';

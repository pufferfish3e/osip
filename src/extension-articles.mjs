/** University extension resources, linked to their original publications. */
const SOURCES = [
  ['Drones','Using Drones in Agriculture and Natural Resource Management','Penn State Extension','https://extension.psu.edu/using-drones-in-agriculture-and-natural-resource-management'],
  ['Drones','Herbicide Applications with Drones: Stay On-Label and On-Target!','Penn State Extension','https://extension.psu.edu/herbicide-applications-with-drones-stay-on-label-and-on-target'],
  ['Drones','Unmanned Aerial Vehicle-Based Crop Scouting in Fruit Trees','Penn State Extension','https://extension.psu.edu/unmanned-aerial-vehicle-based-crop-scouting-in-fruit-trees'],
  ['Drones','Getting started with UAVs for pesticide application','University of Minnesota Extension','https://blog-crop-news.extension.umn.edu/2025/04/getting-started-with-uavs-for-pesticide.html'],
  ['Technology','MN CropCast: What’s New in Weed Management Part 2 — Herbicide application technologies','University of Minnesota Extension','https://blog-crop-news.extension.umn.edu/2026/04/mn-cropcast-whats-new-in-weed.html'],
  ['Soil','What happens to soils during a drought?','University of Minnesota Extension','https://blog-crop-news.extension.umn.edu/2026/09/what-happens-to-soils-during-drought.html'],
  ['Pests','How to calculate herbicide rates and calibrate herbicide applicators','University of Minnesota Extension','https://extension.umn.edu/agriculture/crop-production/weed-management/how-to-calculate-herbicide-rates-and-calibrate-herbicide-applicators'],
  ['Technology','Backpack Sprayer Calibration for Woodland Applications','Penn State Extension','https://extension.psu.edu/backpack-sprayer-calibration-for-woodland-applications'],
  ['Water','Conserve Water In Your Landscape','University of Maryland Extension','https://www.extension.umd.edu/resource/conserve-water-your-landscape'],
];
export const EXTENSION_ARTICLES = SOURCES.map(([category,title,source,sourceUrl],index) => ({ id:`extension-resource-${index + 1}`,slug:`extension-resource-${index + 1}`,category,topics:[category],title,source,sourceUrl,crop:'All crops',readTime:0,image:'',thumbnail:'',summary:'University extension resource. Read the original publication for its guidance and regional context.',author:source,reviewedAt:'',checkedAt:'2026-09-27',isDemo:false,kind:'extension',sections:[] }));

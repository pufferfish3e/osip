const CHECKED_AT = '2026-09-27';
const PERAK_CENTRES_URL = 'https://sanyeong.com.my/our-3s-centres-sales-service-spare-parts/';
const PERAK_OPERATOR_URL = 'https://www.geotech.com.my/about-us/';

export const REAL_PRODUCTS = [
  {
    id:'dji-agras-t25', name:'DJI AGRAS T25', category:'Drones', price:47500,
    description:'Compact agricultural drone for spraying and spreading. Listed by Aeros Geotech in Bagan Serai, Perak.',
    specs:['20 kg spraying payload', '25 kg spreading payload', 'Standard package: aircraft, C8000 charger and two DB800 batteries'],
    sourceUrl:'https://ag.dji.com/t25', supplierUrl:'https://rcflyzone.com.my/product/dji-agras-t25-standard-package',
    regionalSourceUrl:PERAK_OPERATOR_URL, regionalLabel:'Listed by a Perak operator',
  },
  {
    id:'dji-agras-t50', name:'DJI AGRAS T50', category:'Drones', price:62600,
    description:'Agricultural drone for spraying and spreading with larger payloads. Listed by Aeros Geotech in Bagan Serai, Perak.',
    specs:['40 kg spraying payload', '50 kg spreading payload', 'Dual atomizing spraying system'],
    sourceUrl:'https://ag.dji.com/t50', supplierUrl:'https://rcflyzone.com.my/product/dji-agras-t50-standard-package',
    regionalSourceUrl:PERAK_OPERATOR_URL, regionalLabel:'Listed by a Perak operator',
  },
  {
    id:'dji-agras-t70p', name:'DJI AGRAS T70P', category:'Drones', price:58999,
    description:'Agricultural drone supporting spraying, spreading and lifting. Listed for sale in Malaysia; model-specific use in Perak has not been verified.',
    specs:['Maximum payload: 70 kg', '70 L spraying tank', 'Standard package: two DB2160 batteries and C12000 charger'],
    sourceUrl:'https://ag.dji.com/t70p', supplierUrl:'https://rcflyzone.com.my/product/dji-agras-t70p-standard-package',
    regionalSourceUrl:PERAK_CENTRES_URL, regionalLabel:'Malaysian supplier listing',
  },
  {
    id:'dji-agras-t100', name:'DJI AGRAS T100', category:'Drones', price:73999,
    description:'High-payload agricultural drone supporting spraying, spreading and lifting. Listed for sale in Malaysia; model-specific use in Perak has not been verified.',
    specs:['Maximum payload: 100 kg', 'Spraying, spreading and lifting', 'Standard package: two DB2160 batteries and C12000 charger'],
    sourceUrl:'https://ag.dji.com/t100', supplierUrl:'https://rcflyzone.com.my/product/dji-agras-t100-standard-package',
    regionalSourceUrl:PERAK_CENTRES_URL, regionalLabel:'Malaysian supplier listing',
  },
].map((product) => ({ ...product, image:'/assets/farm.jpg', isDemo:false, isIllustrativeImage:true, supplier:'FLY ZONE', packageName:'Standard package', checkedAt:CHECKED_AT, availability:'Supplier lists pre-order' }));


export const EVERYDAY_PRODUCTS = [
  { id:'guantai-manual-sprayer-16l', name:'16L manual knapsack sprayer', searchName:'Guantai knapsack sprayer 16L SKU 58469620 manual', category:'Sprayers', price:109, supplier:'Guan Tai Hardware', supplierUrl:'https://www.guantai-hardware.com/online-shopping/knapsack-sprayer-16l', specs:['16 L', 'Manual pump', 'SKU 58469620'], productIcon:'bottle' },
  { id:'veoda-tl160b', name:'VEODA TL160B battery sprayer', searchName:'VEODA TL160B VQ16B 16L battery sprayer 12V 8AH', category:'Sprayers', price:115, supplier:'Corated', supplierUrl:'https://www.corated.com.my/shop/vq16b-veoda-16l-knapsack-rechargeable-battery-sprayer-16263', specs:['16 L', '12V / 8Ah', 'TL160B'], productIcon:'bottle' },
  { id:'spring-hc01610', name:'SPRING HC01610 hose connector', searchName:'SPRING HC01610 hose connector 1/2 inch x 5/8 inch', category:'Replacement parts', price:5, supplier:'HomePro', supplierUrl:'https://www.homepro.com.my/p/1070800', specs:['1/2 inch × 5/8 inch', 'HC01610'], productIcon:'tool' },
  { id:'spring-pl-pre7', name:'SPRING PL-PRE7 watering nozzle', searchName:'SPRING PL-PRE7 7-pattern garden hose nozzle', category:'Irrigation', price:19.5, supplier:'HomePro', supplierUrl:'https://www.homepro.com.my/m/p/1075307', specs:['7 patterns', 'Clean water only'], productIcon:'droplet' },
  { id:'3m-tekk-gloves-l', name:'3M TEKK rubber gloves · L', searchName:'3M TEKK chemical resistant rubber gloves large 1040650', category:'Protective gear', price:30.9, supplier:'HomePro', supplierUrl:'https://www.homepro.com.my/p/1040650', specs:['Large', 'Polychloroprene', 'Check chemical compatibility'], productIcon:'shield' },
  { id:'spring-pruning-shears-8', name:'SPRING pruning shears · 8 inch', searchName:'SPRING pruning shears rubber handle 8 inch 1074813', category:'Hand tools', price:20.9, supplier:'HomePro', supplierUrl:'https://www.homepro.com.my/p/1074813', specs:['8 inch', 'Rubber handle', 'SKU 1074813'], productIcon:'scissors' },
].map((product) => ({ ...product, description:product.specs.join(' · '), sourceUrl:product.supplierUrl, regionalSourceUrl:product.supplierUrl, regionalLabel:product.category, checkedAt:CHECKED_AT, priceBasis:'Indexed listing', isDemo:false, isIllustrativeImage:false, image:'/assets/crops.jpg', packageName:product.specs.join(' · '), availability:'Check retailer' }));

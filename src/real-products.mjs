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

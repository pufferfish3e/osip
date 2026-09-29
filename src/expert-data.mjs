/** Demo identities are not verified professionals or connected chat recipients. */
export const EXPERTS = [
  {id:'expert-azlan',name:'Azlan Ibrahim',portrait:'/assets/pilot-azlan.png',crops:['Rice'],topics:['Pests','Soil','Water'],area:'Kedah',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-maya',name:'Maya Tan',portrait:'/assets/pilot-maya.png',crops:['Vegetables','Chilli'],topics:['Pests','Disease','Soil'],area:'Perak',languages:['Bahasa Melayu','English','中文'],isDemo:true},
  {id:'expert-daniel',name:'Daniel Lim',portrait:'/assets/pilot-daniel.png',crops:['Durian','Guava'],topics:['Disease','Water','Harvest'],area:'Johor',languages:['English','中文'],isDemo:true},
  {"id":"expert-farid","name":"Farid Hassan","portrait":"/assets/expert-farid.jpg","crops":["Rice"],"topics":["Pests","Water"],"area":"Perak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-aisyah","name":"Aisyah Rahman","portrait":"/assets/expert-aisyah.jpg","crops":["Rice","Vegetables"],"topics":["Soil","Harvest"],"area":"Kedah","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-weiling","name":"Tan Wei Ling","portrait":"/assets/expert-weiling.jpg","crops":["Vegetables","Chilli"],"topics":["Disease","Water"],"area":"Perak","languages":["English","中文"],"isDemo":true},
  {"id":"expert-suresh","name":"Suresh Kumar","portrait":"/assets/expert-suresh.jpg","crops":["Durian","Guava"],"topics":["Soil","Harvest"],"area":"Perak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-nurul","name":"Nurul Huda","portrait":"/assets/expert-nurul.jpg","crops":["Rice","Chilli"],"topics":["Pests","Disease"],"area":"Selangor","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-hafiz","name":"Hafiz Osman","portrait":"/assets/expert-hafiz.jpg","crops":["Rice"],"topics":["Soil","Water"],"area":"Perak","languages":["Bahasa Melayu"],"isDemo":true},
  {"id":"expert-meiyin","name":"Lim Mei Yin","portrait":"/assets/expert-meiyin.jpg","crops":["Guava","Vegetables"],"topics":["Harvest","Disease"],"area":"Johor","languages":["English","中文"],"isDemo":true},
  {"id":"expert-nirmala","name":"Nirmala Devi","portrait":"/assets/expert-nirmala.jpg","crops":["Vegetables","Chilli"],"topics":["Soil","Water"],"area":"Selangor","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-zulkifli","name":"Zulkifli Ismail","portrait":"/assets/expert-zulkifli.jpg","crops":["Durian"],"topics":["Pests","Harvest"],"area":"Perak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-liang","name":"Wong Liang Kit","portrait":"/assets/expert-liang.jpg","crops":["Rice","Vegetables"],"topics":["Disease","Soil"],"area":"Kedah","languages":["English","中文"],"isDemo":true},
  {"id":"expert-salmah","name":"Salmah Abdullah","portrait":"/assets/expert-salmah.jpg","crops":["Guava","Durian"],"topics":["Water","Soil"],"area":"Johor","languages":["Bahasa Melayu"],"isDemo":true},
  {"id":"expert-arun","name":"Arun Raj","portrait":"/assets/expert-arun.jpg","crops":["Rice","Chilli"],"topics":["Harvest","Water"],"area":"Kedah","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-roshani","name":"Roshani Binti Ali","portrait":"/assets/expert-roshani.jpg","crops":["Vegetables"],"topics":["Pests","Harvest"],"area":"Sabah","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-chong","name":"Chong Kai Wen","portrait":"/assets/expert-chong.jpg","crops":["Durian","Guava"],"topics":["Disease","Pests"],"area":"Sarawak","languages":["Bahasa Melayu","English","中文"],"isDemo":true},
  {"id":"expert-nadia","name":"Nadia Azmi","portrait":"/assets/expert-nadia.jpg","crops":["Chilli","Vegetables"],"topics":["Disease","Soil"],"area":"Perak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-azhar","name":"Azhar Yusof","portrait":"/assets/expert-azhar.jpg","crops":["Rice"],"topics":["Harvest","Water"],"area":"Kedah","languages":["Bahasa Melayu"],"isDemo":true},
  {"id":"expert-shanti","name":"Shanti Menon","portrait":"/assets/expert-shanti.jpg","crops":["Guava","Chilli"],"topics":["Pests","Water"],"area":"Selangor","languages":["English","Bahasa Melayu"],"isDemo":true},
  {"id":"expert-siew","name":"Lee Siew Fen","portrait":"/assets/expert-siew.jpg","crops":["Vegetables"],"topics":["Harvest","Soil"],"area":"Johor","languages":["English","中文"],"isDemo":true},
  {"id":"expert-faizal","name":"Faizal Ahmad","portrait":"/assets/expert-faizal.jpg","crops":["Durian","Rice"],"topics":["Soil","Pests"],"area":"Perak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-lina","name":"Lina Joseph","portrait":"/assets/expert-lina.jpg","crops":["Rice","Vegetables"],"topics":["Water","Disease"],"area":"Sarawak","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-rizal","name":"Rizal Jamil","portrait":"/assets/expert-rizal.jpg","crops":["Guava","Durian"],"topics":["Harvest","Water"],"area":"Sabah","languages":["Bahasa Melayu"],"isDemo":true},
  {"id":"expert-ying","name":"Ng Ying Hui","portrait":"/assets/expert-ying.jpg","crops":["Chilli"],"topics":["Pests","Disease"],"area":"Perak","languages":["Bahasa Melayu","English","中文"],"isDemo":true},
  {"id":"expert-kavitha","name":"Kavitha Nair","portrait":"/assets/expert-kavitha.jpg","crops":["Vegetables","Guava"],"topics":["Soil","Harvest"],"area":"Selangor","languages":["English","Bahasa Melayu"],"isDemo":true},
  {"id":"expert-kamal","name":"Kamal Shahrin","portrait":"/assets/expert-kamal.jpg","crops":["Rice","Durian"],"topics":["Disease","Water"],"area":"Johor","languages":["Bahasa Melayu","English"],"isDemo":true},
  {"id":"expert-diana","name":"Diana Chong","portrait":"/assets/expert-diana.jpg","crops":["Durian","Chilli"],"topics":["Soil","Pests"],"area":"Sarawak","languages":["English","中文"],"isDemo":true},
  {id:'expert-oil-palm',name:'Halim Rahman',portrait:'/assets/expert-faizal.jpg',crops:['Oil palm'],topics:['Pests','Fertilizer'],area:'Pahang',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-rubber',name:'Devi Nair',portrait:'/assets/expert-nirmala.jpg',crops:['Rubber'],topics:['Disease','Harvest'],area:'Negeri Sembilan',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-coconut',name:'Amira Yusof',portrait:'/assets/expert-salmah.jpg',crops:['Coconut'],topics:['Pests','Water'],area:'Melaka',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-banana',name:'Jason Lee',portrait:'/assets/expert-liang.jpg',crops:['Banana'],topics:['Disease','Soil'],area:'Penang',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-pineapple',name:'Siti Amina',portrait:'/assets/expert-roshani.jpg',crops:['Pineapple'],topics:['Fertilizer','Harvest'],area:'Terengganu',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-cocoa',name:'Idris Salleh',portrait:'/assets/expert-azhar.jpg',crops:['Cocoa'],topics:['Pests','Pruning'],area:'Kelantan',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-pepper',name:'Harith Zain',portrait:'/assets/expert-kamal.jpg',crops:['Pepper'],topics:['Disease','Planting'],area:'Perlis',languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-drone-north',name:'Firdaus Omar',portrait:'/assets/expert-hafiz.jpg',crops:["Rice","Oil palm","Rubber","Coconut","Durian","Banana","Pineapple","Guava","Vegetables","Chilli","Cocoa","Pepper"],topics:['Drone operations'],area:'Northern Malaysia',areas:["Kedah","Penang","Perlis","Perak"],languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-drone-central',name:'Mei Chen',portrait:'/assets/expert-weiling.jpg',crops:["Rice","Oil palm","Rubber","Coconut","Durian","Banana","Pineapple","Guava","Vegetables","Chilli","Cocoa","Pepper"],topics:['Drone operations'],area:'Central Malaysia',areas:["Selangor","Negeri Sembilan","Melaka"],languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-drone-east',name:'Ismail Yusof',portrait:'/assets/expert-farid.jpg',crops:["Rice","Oil palm","Rubber","Coconut","Durian","Banana","Pineapple","Guava","Vegetables","Chilli","Cocoa","Pepper"],topics:['Drone operations'],area:'East Coast Malaysia',areas:["Pahang","Kelantan","Terengganu"],languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-drone-south',name:'Adrian Lim',portrait:'/assets/expert-chong.jpg',crops:["Rice","Oil palm","Rubber","Coconut","Durian","Banana","Pineapple","Guava","Vegetables","Chilli","Cocoa","Pepper"],topics:['Drone operations'],area:'Southern Malaysia',areas:["Johor"],languages:['Bahasa Melayu','English'],isDemo:true},
  {id:'expert-drone-borneo',name:'Farah Binti Ali',portrait:'/assets/expert-lina.jpg',crops:["Rice","Oil palm","Rubber","Coconut","Durian","Banana","Pineapple","Guava","Vegetables","Chilli","Cocoa","Pepper"],topics:['Drone operations'],area:'East Malaysia',areas:["Sabah","Sarawak"],languages:['Bahasa Melayu','English'],isDemo:true},
];
const MATCH_WEIGHTS = {crop:40,topic:30,area:20,language:10};
/** @typedef {{crop:string|string[],topic:string|string[],area:string|string[],language:string|string[]}} ExpertPreferences */
/** @param {ExpertPreferences} preferences @returns {{expert:(typeof EXPERTS)[number],score:number,reasons:string[]}[]} */
export function matchExperts(preferences) {
  return EXPERTS.map((expert) => {
    const values = {crop:expert.crops,topic:expert.topics,area:[expert.area,...(expert.areas ?? [])],language:expert.languages};
    const reasons = [];
    const score = Object.keys(MATCH_WEIGHTS).reduce((sum,key) => {
      const selected = [...new Set([].concat(preferences[key]).map((value) => value.trim()).filter(Boolean))];
      const matched = selected.filter((value) => values[key].some((option) => option.toLowerCase() === value.toLowerCase()));
      reasons.push(...matched);
      return sum + (selected.length ? MATCH_WEIGHTS[key] * matched.length / selected.length : 0);
    },0);
    return {expert,score:Math.round(score),reasons};
  }).sort((first,second) => second.score - first.score || first.expert.id.localeCompare(second.expert.id));
}
/** @param {import('./store.mjs').AppState} state @param {string} expertId @returns {string} */
export function startExpertChat(state, expertId) {
  const expert = EXPERTS.find((item) => item.id === expertId);
  if (!expert) throw new Error('Expert not found');
  state.chats ??= [];
  const existing = state.chats.find((chat) => chat.expertId === expertId);
  if (existing) return existing.id;
  const id = `chat-${expert.id}`;
  state.chats.push({id,name:expert.name,expertId,conversation:[]});
  return id;
}

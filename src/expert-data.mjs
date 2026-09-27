/** Demo identities are not verified professionals or connected chat recipients. */
export const EXPERTS = [
  {id:'expert-azlan',name:'Azlan Ibrahim',portrait:'/assets/pilot-azlan.png',crops:['Rice'],topics:['Pests','Soil','Water'],area:'Kedah',languages:['Bahasa Melayu','English']},
  {id:'expert-maya',name:'Maya Tan',portrait:'/assets/pilot-maya.png',crops:['Vegetables','Chilli'],topics:['Pests','Disease','Soil'],area:'Perak',languages:['Bahasa Melayu','English','中文']},
  {id:'expert-daniel',name:'Daniel Lim',portrait:'/assets/pilot-daniel.png',crops:['Durian','Guava'],topics:['Disease','Water','Harvest'],area:'Johor',languages:['English','中文']},
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
];
const MATCH_WEIGHTS = {crop:40,topic:30,area:20,language:10};
/** @typedef {{crop:string,topic:string,area:string,language:string}} ExpertPreferences */
/** @param {ExpertPreferences} preferences @returns {{expert:(typeof EXPERTS)[number],score:number,reasons:string[]}[]} */
export function matchExperts(preferences) {
  return EXPERTS.map((expert) => {
    const matches = {crop:expert.crops.some((crop)=>crop.toLowerCase() === preferences.crop.trim().toLowerCase()),topic:expert.topics.some((topic)=>topic.toLowerCase() === preferences.topic.trim().toLowerCase()),area:expert.area === preferences.area,language:expert.languages.includes(preferences.language)};
    const reasons = Object.keys(matches).filter((key) => matches[key]).map((key) => preferences[key]);
    const score = Object.keys(matches).reduce((sum,key) => sum + (matches[key] ? MATCH_WEIGHTS[key] : 0),0);
    return {expert,score,reasons};
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

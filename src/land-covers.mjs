export const LAND_COVERS = ['/assets/farm.jpg', '/assets/crops.jpg', '/assets/learn-water.jpg', '/assets/learn-harvest.jpg'];

/** @param {import('./store.mjs').Farm} land @param {number} index @returns {string} */
export const landCover = (land, index) => LAND_COVERS.includes(land.coverImage) ? land.coverImage : LAND_COVERS[Math.max(0, index) % LAND_COVERS.length];

/** @param {import('./store.mjs').Farm[]} lands @returns {string} */
export const assignLandCover = (lands) => {
  lands.forEach((land, index) => { land.coverImage = landCover(land, index); });
  const counts = LAND_COVERS.map((image) => lands.filter((land) => land.coverImage === image).length);
  const previous = lands.at(-1)?.coverImage;
  const choices = LAND_COVERS.filter((image) => image !== previous);
  return choices.reduce((best, image) => counts[LAND_COVERS.indexOf(image)] < counts[LAND_COVERS.indexOf(best)] ? image : best);
};

// Supporting buildings finish in three substantial stages. Stage three retains
// the old level-five service capacity, so existing towns lose no benefits.
const SUPPORTING = new Set([
  'well',
  'well2',
  'farm',
  'farm2',
  'farm3',
  'home',
  'home2',
  'home3',
  'home4',
  'stable',
  'museum',
  'armory',
  'shop',
  'fisherman',
  'school',
  'doctor',
]);
export const hasShortProgression = (id) => SUPPORTING.has(id);
export const buildingServiceLevel = (id, stage) =>
  hasShortProgression(id) && stage >= 3 ? 5 : stage;

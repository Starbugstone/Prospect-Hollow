import { villagerRandom } from './villagers';

export const VIP_SPEND = 5;
export const VIP_RECEIPT_LIMIT = 64;
// A name alone also identifies visiting players and legacy share-link guests.
export const canVipSpend = (identity) =>
  identity?.vip === true && !identity.guest && !identity.live;
const VIP_VISIT_BUILDINGS = Object.freeze([
  'saloon',
  'shop',
  'bank',
  'museum',
  'hotel',
  'market',
  'diner',
  'library',
  'concertHall',
  'supermarket',
  'doctor',
  'post',
  'cityHall',
]);
export const vipVisitBuildings = (town) =>
  VIP_VISIT_BUILDINGS.filter((id) => town.buildings[id] > 0 && !town.projects?.[id]);

// Stable per arrival: ordinary sightseeing is common and two purchases are rare.
export function vipVisitCount(seed) {
  const draw = villagerRandom(seed);
  return draw < 0.5 ? 0 : draw < 0.98 ? 1 : 2;
}
export function normalizeVipReceipts(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((id) => typeof id === 'string' && id.length <= 160))].slice(
        -VIP_RECEIPT_LIMIT,
      )
    : [];
}
export function vipReceipt(receipt) {
  return receipt &&
    canVipSpend(receipt.visitor) &&
    typeof receipt.tour === 'string' &&
    receipt.tour.length > 0 &&
    receipt.tour.length < 150 &&
    Number.isInteger(receipt.stop) &&
    receipt.stop >= 0 &&
    receipt.stop < 2
    ? `${receipt.tour}:${receipt.stop}`
    : null;
}

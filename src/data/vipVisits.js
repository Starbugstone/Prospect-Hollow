import { villagerRandom } from './villagers';
import { LEVEL_COUNT } from './campaign';
import { miningDepthBonus } from './economy';

// Receipt terms are permanent: change the base only by adding a new version.
export const VIP_SPEND_BASES = Object.freeze({ 0: 5, 1: 5, 2: 10 });
export const VIP_SPEND_VERSION = 2;
// Normal records are validated on load and replay. Unknown catalog levels cannot
// invent deeper chapters; new chapters inherit the mining multiplier automatically.
export function vipSpend(records = {}, version = VIP_SPEND_VERSION) {
  if (!Number.isInteger(version) || !Object.hasOwn(VIP_SPEND_BASES, version)) return 0;
  const base = VIP_SPEND_BASES[version];
  if (version === 0) return base; // Unversioned, already queued purchases.
  const level = Object.keys(records).reduce((deepest, key) => {
    const id = Number(key);
    return Number.isInteger(id) && id >= 1 && id <= LEVEL_COUNT && records[key]
      ? Math.max(deepest, id)
      : deepest;
  }, 1);
  return base + miningDepthBonus(base, level);
}
export const VIP_RECEIPT_LIMIT = 64;
// A name alone also identifies visiting players and legacy share-link guests.
export const canVipSpend = (identity) =>
  identity?.vip === true && !identity.guest && !identity.live;
// Where a VIP may spend, per settlement. The server accepts every listed building
// (`economy.vipBuildings`), so add new places at the end of a settlement's list.
const VIP_VISIT_BUILDINGS = Object.freeze({
  valley: Object.freeze([
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
  ]),
  // New Hollow's hall (as the valley's city hall), its keepsake workshop (a shop) and
  // the lookout's paid view (as the museum). Homes, utilities, farms and pads are not.
  moon: Object.freeze(['newHollowCommons', 'moonstoneWorkshop', 'earthriseLookout']),
});
/** Finished places a VIP may spend in: one settlement's, or every settlement's. */
export const vipVisitBuildings = (town, settlement) =>
  (settlement
    ? (VIP_VISIT_BUILDINGS[settlement] ?? [])
    : Object.values(VIP_VISIT_BUILDINGS).flat()
  ).filter((id) => town.buildings[id] > 0 && !town.projects?.[id]);

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

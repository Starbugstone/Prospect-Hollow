// The settlements the town spreads across, in one authoritative registry. A building,
// monument site or event names its settlement by id (`settlement: 'moon'`); anything
// without one stands in the home settlement, the valley. Shared code (the Build list
// order, event routing, which map draws a place, moonstone rewards, notices and VIP
// spending) reads these facts instead of comparing ids, so a new settlement needs a
// registry entry, its content and, to be visited, its map component.
export const HOME_SETTLEMENT = 'valley';
export const MOON_SETTLEMENT = 'moon';

/**
 * @typedef {object} Settlement
 * @property {string} id
 * @property {string|null} map  The map that draws it: 'valley' is TownScene's own diorama;
 *   any other key names a map drawn over the valley (TownScene's SETTLEMENT_MAPS). Without
 *   a map its events play in the valley.
 * @property {string|null} art  The building drawings of its kinds (TownBuilding.vue).
 * @property {boolean} moonstones  Each finished building level here earns one moonstone.
 * @property {{ happening: string, waiting: string, monument: string }} labels  The waiting
 *   event notice, its collapsed reminder and a grand monument unveiling's title.
 * @property {string} monumentStone  The stone of an unpainted monument.
 * @property {string[]} vipBuildings  Where a VIP may spend. The server accepts every listed
 *   building (`economy.vipBuildings`), so add new places at the end of the list.
 */
export const SETTLEMENT_DEFINITIONS = Object.freeze([
  {
    id: HOME_SETTLEMENT,
    map: 'valley',
    labels: {
      happening: 'Something is happening in the valley',
      waiting: 'Valley event waiting',
      monument: 'A monument for Prospect Hollow',
    },
    monumentStone: '#ddd1b5',
    vipBuildings: [
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
    ],
  },
  {
    // New Hollow on the Moon.
    id: MOON_SETTLEMENT,
    map: 'moon',
    art: 'moon',
    moonstones: true,
    labels: {
      happening: 'Something is happening on the Moon',
      waiting: 'Moon event waiting',
      monument: 'A monument for New Hollow',
    },
    monumentStone: '#e5e8e7',
    // New Hollow's hall (as the valley's city hall), its keepsake workshop (a shop) and
    // the lookout's paid view (as the museum). Homes, utilities, farms and pads are not.
    vipBuildings: ['newHollowCommons', 'moonstoneWorkshop', 'earthriseLookout'],
  },
]);

/**
 * Validates one definition and fills the facts it leaves out, so an incomplete entry
 * falls back safely: no map (its events play in the valley), no art of its own, no
 * moonstones, no VIP spending and the valley's monument stone. A settlement that can be
 * shown on a map must name its notice and unveiling words.
 * @returns {Readonly<Settlement>}
 */
export function defineSettlement(definition, home) {
  if (!definition?.id || typeof definition.id !== 'string')
    throw new Error('A settlement needs an id.');
  const map = definition.map ?? null;
  // A settlement without a map is never shown, so home's words are never read for it.
  const labels = definition.labels ?? (map ? null : home?.labels);
  if (!labels?.happening || !labels.waiting || !labels.monument)
    throw new Error(`Settlement ${definition.id} needs its notice and monument labels.`);
  return Object.freeze({
    id: definition.id,
    map,
    art: definition.art ?? null,
    moonstones: definition.moonstones === true,
    labels: Object.freeze({ ...labels }),
    monumentStone: definition.monumentStone ?? home?.monumentStone,
    vipBuildings: Object.freeze([...(definition.vipBuildings ?? [])]),
  });
}

/**
 * The registry and its lookups for an ordered list of definitions, the first being home.
 * The game uses the one below; tests build another to prove a new settlement needs only
 * its entry.
 */
export function createSettlementRegistry(definitions) {
  const home = defineSettlement(definitions[0]);
  const settlements = Object.freeze([
    home,
    ...definitions.slice(1).map((definition) => defineSettlement(definition, home)),
  ]);
  const byId = Object.fromEntries(settlements.map((settlement) => [settlement.id, settlement]));
  if (Object.keys(byId).length !== settlements.length)
    throw new Error('Settlement ids must be unique.');
  /** The id a place declares, or home's when it declares none. Unknown ids are kept. */
  const settlementId = (place) => place?.settlement ?? home.id;
  /** The registered settlement with this id, or undefined. */
  const settlementById = (id) => (Object.hasOwn(byId, id ?? '') ? byId[id] : undefined);
  return {
    SETTLEMENTS: settlements,
    settlementId,
    settlementById,
    /** A place's settlement and its facts; an unknown settlement reads as home. */
    settlementOf: (place) => settlementById(settlementId(place)) ?? home,
    /** The places of one settlement, by declared id: unknown settlements have none. */
    settlementPlaces: (id, places) => places.filter((place) => settlementId(place) === id),
    /** Where an event can play: its settlement when a map shows it, else home. */
    shownSettlement: (id) => (settlementById(id)?.map ? id : home.id),
  };
}

export const {
  SETTLEMENTS,
  settlementId,
  settlementById,
  settlementOf,
  settlementPlaces,
  shownSettlement,
} = createSettlementRegistry(SETTLEMENT_DEFINITIONS);

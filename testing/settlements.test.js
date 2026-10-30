import { expect, it } from 'vitest';
import {
  HOME_SETTLEMENT,
  MOON_SETTLEMENT,
  SETTLEMENTS,
  SETTLEMENT_DEFINITIONS,
  createSettlementRegistry,
  defineSettlement,
  settlementId,
  settlementOf,
  settlementPlaces,
  shownSettlement,
} from '../src/data/settlements';
import { BUILDINGS, EARTH_BUILDINGS, MOON_BUILDINGS, MOONSTONE_BUILDINGS } from '../src/data/town';
import { MOON_LOTS } from '../src/data/moonSettlement';
import { PERSONAL_AREAS, areasForSettlement } from '../src/data/townLandmarks';
import { vipVisitBuildings } from '../src/data/vipVisits';
import { eventSettlement, placeSettlement } from '../src/game/town/TownEventSettlement';
import fr from '../src/i18n/fr.json';

// The settlement registry (src/data/settlements.js) is the one definition of the valley
// and New Hollow. These pin the shipped facts it replaced, so moving them changed nothing.

it('registers the valley as home and the Moon, each with a map', () => {
  expect(SETTLEMENTS.map(({ id }) => id)).toEqual([HOME_SETTLEMENT, MOON_SETTLEMENT]);
  expect(SETTLEMENTS.map(({ map }) => map)).toEqual(['valley', 'moon']);
  expect(Object.isFrozen(SETTLEMENTS[1])).toBe(true);
});

it('places every building and site in the settlement it declares', () => {
  expect(EARTH_BUILDINGS).toEqual(BUILDINGS.filter((building) => !building.settlement));
  expect(MOON_BUILDINGS).toEqual(BUILDINGS.filter((building) => building.settlement === 'moon'));
  expect(EARTH_BUILDINGS.length + MOON_BUILDINGS.length).toBe(BUILDINGS.length);
  for (const building of BUILDINGS)
    expect(placeSettlement(building.id)).toBe(building.settlement ?? 'valley');
  for (const area of PERSONAL_AREAS) expect(placeSettlement(area.id)).toBe(area.settlement);
  expect(placeSettlement('no-such-place')).toBe('valley');
  expect(areasForSettlement('moon').map(({ id }) => id)).toEqual([
    'earthrise-plaza',
    'moonrock-court',
    'earthlight-conservatory',
  ]);
});

it('derives the moonstone buildings from the registry: every Moon lot, nothing else', () => {
  expect([...MOONSTONE_BUILDINGS].sort()).toEqual(Object.keys(MOON_LOTS).sort());
  expect(MOONSTONE_BUILDINGS).toEqual(MOON_BUILDINGS.map(({ id }) => id));
  expect(Object.isFrozen(MOONSTONE_BUILDINGS)).toBe(true);
});

it('keeps the VIP shopping lists in their shipped order', () => {
  const town = { buildings: new Proxy({}, { get: () => 1 }), projects: {} };
  expect(vipVisitBuildings(town, 'moon')).toEqual([
    'newHollowCommons',
    'moonstoneWorkshop',
    'earthriseLookout',
  ]);
  expect(vipVisitBuildings(town).slice(-3)).toEqual(vipVisitBuildings(town, 'moon'));
  expect(vipVisitBuildings(town, 'valley')[0]).toBe('saloon');
  expect(vipVisitBuildings(town, 'mars')).toEqual([]);
});

it('routes events to a settlement with a map, and anything else to the valley', () => {
  expect(eventSettlement({ building: 'roverBarn' })).toBe('moon');
  expect(eventSettlement({ settlement: 'moon' })).toBe('moon');
  expect(eventSettlement({ id: 'first-lights' })).toBe('valley');
  expect(eventSettlement({ settlement: 'unregistered' })).toBe('valley');
  expect(shownSettlement()).toBe('valley');
});

it('reads an undeclared place as the valley and keeps an unknown id out of every map', () => {
  expect(settlementId({})).toBe('valley');
  expect(settlementId({ settlement: 'mars' })).toBe('mars');
  expect(settlementOf({ settlement: 'mars' }).id).toBe('valley');
  expect(settlementPlaces('valley', [{ id: 'a' }, { id: 'b', settlement: 'mars' }])).toEqual([
    { id: 'a' },
  ]);
});

it('translates every settlement’s notice and monument words', () => {
  const words = SETTLEMENTS.flatMap(({ labels }) => Object.values(labels));
  expect(words).toHaveLength(6);
  expect(words.filter((text) => !Object.hasOwn(fr, text))).toEqual([]);
});

it('fills an incomplete settlement with safe defaults and rejects unusable ones', () => {
  const [home] = SETTLEMENTS;
  expect(defineSettlement({ id: 'outpost' }, home)).toEqual({
    id: 'outpost',
    map: null,
    art: null,
    moonstones: false,
    labels: home.labels,
    monumentStone: home.monumentStone,
    vipBuildings: [],
  });
  expect(() => defineSettlement({}, home)).toThrow(/id/);
  // A settlement shown on a map must name its own words, never borrow the valley's.
  expect(() => defineSettlement({ id: 'mars', map: 'moon' }, home)).toThrow(/labels/);
  expect(() =>
    createSettlementRegistry([...SETTLEMENT_DEFINITIONS, SETTLEMENT_DEFINITIONS[1]]),
  ).toThrow(/unique/);
});

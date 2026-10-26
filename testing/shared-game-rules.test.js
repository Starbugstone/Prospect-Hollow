import { afterEach, describe, expect, it } from 'vitest';
import { buildSaveRules } from '../scripts/save-rules.js';
import { CHAPTERS } from '../src/data/campaign';
import { ERAS, ERA_BY_ID, FRONTIER_ERA, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { isMajorCityBuilding } from '../src/data/city';
import { chapterOverflowCoins } from '../src/data/journey';
import {
  SAVE_SCHEMA_VERSION,
  SUPPORTED_SAVE_SCHEMAS,
  isWholeNumber,
  wholeNumberOrZero,
} from '../src/data/saveFormat';
import { BUILDINGS, BUILDING_BY_ID, createTown, newBuildingPrice } from '../src/data/town';
import { RAID_RULES } from '../src/data/townEvents';
import {
  MAX_CONSTRUCTION_RUNS,
  SALOON_INCOME,
  gangSize,
  projectRuns,
  raidReady,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { freshProfile } from '../src/stores/campaignStore';

const registered = [];
afterEach(() => {
  for (const id of registered.splice(0)) {
    ERAS.splice(
      ERAS.findIndex((era) => era.id === id),
      1,
    );
    delete ERA_BY_ID[id];
  }
});
const register = (evolution) => {
  const era = defineEra({
    id: `shared-rules-${registered.length}`,
    label: 'Successor',
    yearLabel: '2400',
    enabled: true,
    evolution: { style: 'industrial', prices: [101, 202, 303], ...evolution },
  });
  ERAS.push(era);
  ERA_BY_ID[era.id] = era;
  registered.push(era.id);
  return era.id;
};
// A town past its first free project, so offers show their real prices.
const settledTown = (era) => ({
  ...createTown(),
  era,
  coins: 600,
  buildings: { ...createTown().buildings, home: 1, well: 1, farm: 1 },
});

describe('save formats', () => {
  it('writes the newest supported format and exports the same list to the server', () => {
    expect(SUPPORTED_SAVE_SCHEMAS).toEqual([2, 3, 4]);
    expect(SUPPORTED_SAVE_SCHEMAS.at(-1)).toBe(SAVE_SCHEMA_VERSION);
    expect(freshProfile().schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    const rules = buildSaveRules();
    expect(rules.supportedSchemaVersions).toEqual(SUPPORTED_SAVE_SCHEMAS);
    expect(rules.profileSchemaVersion).toBe(SAVE_SCHEMA_VERSION);
  });

  it('accepts only whole numbers JSON keeps exactly', () => {
    for (const value of [0, 1, Number.MAX_SAFE_INTEGER]) {
      expect(isWholeNumber(value)).toBe(true);
      expect(wholeNumberOrZero(value)).toBe(value);
    }
    for (const value of [-1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, '1', null]) {
      expect(isWholeNumber(value)).toBe(false);
      expect(wholeNumberOrZero(value)).toBe(0);
    }
  });
});

describe('new building prices', () => {
  // The quoted price of each level of a standard plot each era introduces.
  const QUOTED = {
    'river-rail': [800, 1200, 1400],
    industrial: [1400, 1850, 2300],
    'post-war': [4500, 6000, 7500],
    'motor-age': [6480, 9000, 11880],
    aviation: [12000, 15000, 18000],
    broadcast: [12000, 15000, 18000],
    contemporary: [12000, 15000, 18000],
    tomorrow: [15000, 18750, 22500],
    canopy: [17250, 21000, 24750],
    riverlight: [20250, 24000, 27750],
    skysail: [23250, 27000, 30750],
    stargazer: [26250, 30000, 33750],
    moonward: [29250, 33000, 36750],
    'twin-hollows': [31500, 35250, 39000],
  };

  it('prices every plot an era introduces from that era alone, landmarks with their premium', () => {
    expect(Object.keys(QUOTED)).toEqual(ERAS.slice(1).map((era) => era.id));
    for (const building of BUILDINGS) {
      const quoted = QUOTED[building.introducedEra];
      if (!quoted) continue;
      expect(
        building.upgrades.map((upgrade) => upgrade.cost),
        building.id,
      ).toEqual(
        quoted.map((price) => (isMajorCityBuilding(building.id) ? Math.ceil(price * 1.25) : price)),
      );
    }
    // A Moon parcel, a leisure field and a major landmark keep their published prices.
    expect(BUILDING_BY_ID.settlerDomes.upgrades[0].cost).toBe(31500);
    expect(BUILDING_BY_ID.horseField.upgrades.map((upgrade) => upgrade.cost)).toEqual([
      1400, 1850, 2300,
    ]);
    expect(BUILDING_BY_ID.airport.upgrades[0].cost).toBe(15000);
  });

  it('keeps authored costs for plots of eras without new-building prices', () => {
    expect(eraEvolution(FRONTIER_ERA).newBuildingPrices).toBeNull();
    expect(newBuildingPrice(BUILDING_BY_ID.well, 0)).toBeNull();
    expect(newBuildingPrice({ id: 'unknown', introducedEra: 'no-such-era' }, 0)).toBeNull();
    // A level beyond the era's three prices is not invented.
    expect(newBuildingPrice(BUILDING_BY_ID.bridge, 3)).toBeNull();
    const authored = register({});
    expect(newBuildingPrice({ id: 'plot', introducedEra: authored }, 0)).toBeNull();
    const priced = register({ newBuildingPrices: [11, 22, 33] });
    expect(newBuildingPrice({ id: 'plot', introducedEra: priced }, 2)).toBe(33);
    expect(newBuildingPrice({ id: 'airport', introducedEra: priced }, 2)).toBe(42);
  });

  it('reprices earlier plots only in an era that asks for it', () => {
    const bank = BUILDING_BY_ID.bank.upgrades[0].cost;
    expect(upgradeOffer(settledTown('river-rail'), 'bank').cost).toBe(800);
    expect(upgradeOffer(settledTown('industrial'), 'bank').cost).toBe(bank);
    expect(upgradeOffer(settledTown(FRONTIER_ERA), 'bank').cost).toBe(bank);
    const successor = register({ newBuildingPrices: [11, 22, 33], repricesEarlierPlots: true });
    expect(upgradeOffer(settledTown(successor), 'bank').cost).toBe(11);
    expect(upgradeOffer(settledTown(register({})), 'bank').cost).toBe(bank);
  });

  it('rejects an era that reprices plots without prices', () => {
    expect(() => register({ repricesEarlierPlots: true })).toThrow('Missing new building prices');
    expect(() => register({ newBuildingPrices: [1, 2] })).toThrow('Invalid newBuildingPrices');
  });
});

describe('shared town rules', () => {
  it('sizes raids from one table', () => {
    const town = (development) => ({ buildings: { plot: development } });
    expect([0, 15, 16, 29, 30, 49, 50, 69, 70, 400].map((size) => gangSize(town(size)))).toEqual([
      2, 2, 4, 4, 6, 6, 8, 8, 10, 10,
    ]);
    expect(RAID_RULES).toMatchObject({
      lossPerRider: 5,
      lossCap: 30,
      coinShare: 10,
      keepCoins: 50,
    });
  });

  it('starts era incidents only once a gate plot is built', () => {
    const ready = (era, extra = {}) => {
      const town = settledTown(era);
      town.nextRaidRun = 0;
      Object.assign(town.buildings, extra);
      return raidReady(town);
    };
    expect(ready(FRONTIER_ERA)).toBe(true);
    expect(ready('river-rail')).toBe(false);
    expect(ready('river-rail', { riverPort: 1 })).toBe(true);
    expect(ready('river-rail', { railDepot: 1 })).toBe(true);
    expect(ready('industrial')).toBe(false);
    expect(ready('industrial', { mill: 1 })).toBe(true);
    expect(ready('post-war')).toBe(true);
    expect(ready(register({ incidentGate: ['saloon'] }))).toBe(false);
    expect(ready(register({ incidentGate: ['saloon'] }), { saloon: 1 })).toBe(true);
    expect(() => register({ incidentGate: [] })).toThrow('Invalid incident gate');
    expect(() => register({ incidentGate: ['saloon', 3] })).toThrow('Invalid incident gate');
  });

  it('exports the rules the server replays instead of copies of their formulas', () => {
    const rules = buildSaveRules();
    expect(rules.economy.saloonIncome).toEqual(SALOON_INCOME);
    expect(SALOON_INCOME).toEqual({ rate: 2.25, happinessPercent: 1.25, dinerBonus: 0.05 });
    expect(rules.economy.raid).toEqual(JSON.parse(JSON.stringify(RAID_RULES)));
    expect(rules.economy).not.toHaveProperty('introOrder');
    for (const era of ERAS)
      expect(rules.eras[era.id].incidentGate).toEqual(era.evolution.incidentGate);
    expect(rules.maxConstructionRuns).toBe(MAX_CONSTRUCTION_RUNS);
    for (const [id, building] of Object.entries(rules.buildings))
      building.upgrades.forEach((upgrade, stage) => {
        expect(upgrade.runs).toBe(projectRuns(id, stage + 1));
        expect(upgrade.runs).toBeLessThanOrEqual(MAX_CONSTRUCTION_RUNS);
      });
    expect(rules.chapters.map((chapter) => chapter.overflowCoins)).toEqual(
      CHAPTERS.map((_, index) => chapterOverflowCoins(index + 1)),
    );
    expect(chapterOverflowCoins(3)).toBe(300);
  });
});

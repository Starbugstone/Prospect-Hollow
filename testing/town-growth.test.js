import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BANDIT_EVENT, createTown } from '../src/data/town';
import {
  normalizeTown,
  purchase,
  advanceConstruction,
  finishConstruction,
  plotUnlocked,
  plotRequirement,
  population,
  gangSize,
  raidReady,
  banditEncounter,
  saloonIncomeRate,
  settleSaloonIncome,
  HOUR_MS,
  roadLevel,
  residentPopulation,
  visitorPopulation,
  visitorCapacity,
  happiness,
  upgradeOffer,
  buildWithHammer,
  availablePurchases,
} from '../src/game/town/TownRules';
import { bonusCapacity } from '../src/data/rewards';
import { rollShopStock } from '../src/data/shop';
import { useCampaignStore } from '../src/stores/campaignStore';
import { SAVE_KEY } from '../src/services/localProfile';

const frontierBuildings = BUILDINGS.filter((b) => b.introducedEra === 'frontier');
const legacyBuildings = frontierBuildings.filter(
  (b) => !['fisherman', 'blacksmith', 'school', 'doctor', 'watermill'].includes(b.id),
);
const village = (levels = {}) => ({
  ...createTown(),
  nextRaidRun: 0,
  coins: 600,
  buildings: { ...createTown().buildings, well: 1, farm: 1, home: 1, ...levels },
});
let saves;
beforeEach(() => {
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saves.get(k) ?? null,
    setItem: (k, v) => saves.set(k, v),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Substantial building stages and a growing frontier', () => {
  it.each([
    ['home', ['home2', 'home3', 'home4']],
    ['farm', ['farm2', 'farm3']],
    ['well', ['well2']],
  ])(
    'opens each %s parcel only after finishing the previous building at level 2',
    (kind, extras) => {
      let town = { ...village(), coins: 2000 };
      const assertLocked = (id) => {
        expect(plotUnlocked(town, id)).toBe(false);
        expect(purchase(town, id, 0)).toBeNull();
        expect(buildWithHammer(town, id, 0)).toBeNull();
        expect(availablePurchases(town, 5).some((b) => b.id === id)).toBe(false);
      };
      extras.forEach(assertLocked);
      town = purchase(town, kind, 1);
      extras.forEach(assertLocked);
      town = advanceConstruction(town);
      // A completed puzzle still needs the player's tap to remove the scaffolding.
      extras.forEach(assertLocked);
      town = finishConstruction(town, kind, 2);
      for (const [index, id] of extras.entries()) {
        expect(plotUnlocked(town, id)).toBe(true);
        expect(availablePurchases(town).some((b) => b.id === id)).toBe(true);
        extras.slice(index + 1).forEach(assertLocked);
        const withoutCoins = { ...town, coins: 0 };
        expect(availablePurchases(withoutCoins).some((b) => b.id === id)).toBe(false);
        expect(availablePurchases(withoutCoins, 1).some((b) => b.id === id)).toBe(true);
        expect(buildWithHammer(withoutCoins, id, 0)?.buildings[id]).toBe(1);
        town = purchase(town, id, 0);
        expect(town.buildings[id]).toBe(1);
        extras.slice(index + 1).forEach(assertLocked);
        if (extras[index + 1]) {
          const instant = buildWithHammer({ ...town, coins: 0 }, id, 1);
          expect(plotUnlocked(instant, extras[index + 1])).toBe(true);
          town = purchase(town, id, 1);
          extras.slice(index + 1).forEach(assertLocked);
          town = normalizeTown(advanceConstruction(town));
          // Ready scaffolding is still level 1 until the player finishes the work.
          extras.slice(index + 1).forEach(assertLocked);
          town = finishConstruction(town, id, 2);
        }
      }
    },
  );
  it.each([
    ['home', 'home2', 'home3', 'home4'],
    ['farm', 'farm2', 'farm3'],
    ['well', 'well2'],
  ])('charges more for each successive %s parcel at every building level', (...ids) => {
    for (let stage = 0; stage < 3; stage++) {
      let previousCost = 0;
      for (const id of ids) {
        const town = village(Object.fromEntries(ids.map((plot) => [plot, stage || 2])));
        town.buildings[id] = stage;
        town.coins = 10000;
        const offer = upgradeOffer(town, id);
        expect(offer.available).toBe(true);
        expect(offer.cost).toBeGreaterThan(previousCost);
        expect(purchase(town, id, stage).coins).toBe(town.coins - offer.cost);
        previousCost = offer.cost;
      }
    }
  });
  it('explains the missing prerequisite and keeps saved buildings and projects accessible', () => {
    let town = village({ farm: 2 });
    expect(plotRequirement(town, 'farm3')).toEqual({ id: 'farm2', level: 2 });
    expect(upgradeOffer(town, 'farm3').reason).toBe('Unlock by upgrading Farm II to level 2.');
    // A legacy second farm cannot bypass the original farm's level requirement.
    expect(plotUnlocked(village({ farm: 1, farm2: 1 }), 'farm3')).toBe(false);
    town.buildings.farm3 = 1;
    town.buildings.home4 = 1;
    town.projects.home4 = { id: 'home4', stage: 2, wins: 1, required: 1 };
    town = normalizeTown(town);
    expect(plotUnlocked(town, 'farm3')).toBe(true);
    expect(plotUnlocked(town, 'home4')).toBe(true);
    expect(finishConstruction(town, 'home4', 2).buildings.home4).toBe(2);
    expect(plotUnlocked(town, 'unknown')).toBe(false);
  });
  it('caps supporting buildings at three and core services at five and preserves existing benefits during improvements', () => {
    for (const building of frontierBuildings) {
      expect(building.upgrades).toHaveLength(
        ['saloon', 'sheriff', 'bank', 'square', 'blacksmith'].includes(building.id) ? 5 : 3,
      );
      const town = village(
        Object.fromEntries(frontierBuildings.map((b) => [b.id, b.upgrades.length])),
      );
      expect(purchase(town, building.id, 5)).toBeNull();
    }
    let town = village({ saloon: 1, home: 2 });
    expect(saloonIncomeRate(town)).toBe(13);
    town = purchase(town, 'saloon', 1);
    while (town.projects.saloon) {
      expect(saloonIncomeRate(town)).toBe(13);
      town = finishConstruction(advanceConstruction(town), 'saloon', 2);
    }
    expect(saloonIncomeRate(town)).toBe(27);
  });
  it('uses shared food and water capacity for the expanding residential neighborhood', () => {
    const town = village({ home: 3, home2: 3, home3: 3, home4: 3 });
    expect(population(town)).toBe(6);
    town.buildings.well = town.buildings.farm = 3;
    expect(population(town)).toBe(30);
    town.buildings.well2 = town.buildings.farm2 = 1;
    expect(population(town)).toBe(36);
    expect(roadLevel(createTown())).toBe(0);
    expect(roadLevel(village())).toBe(1);
    expect(roadLevel(town)).toBeGreaterThan(1);
  });
});

describe('Stored saloon earnings and explicit collection', () => {
  it('starts the clock without retroactive income, then preserves fractional earnings across saves', () => {
    const start = settleSaloonIncome(village({ saloon: 1 }), HOUR_MS);
    expect(start.earned).toBe(0);
    let town = start.town,
      earned = 0;
    for (let minute = 1; minute <= 60; minute++) {
      const result = settleSaloonIncome(normalizeTown(town), HOUR_MS + minute * 60000);
      town = result.town;
      earned += result.earned;
    }
    expect(earned).toBe(6);
    expect(town.income.remainder).toBe(0);
    expect(settleSaloonIncome(town, HOUR_MS * 2).earned).toBe(0);
  });
  it('stores online earnings at the eight-hour cap and only a player collection credits the wallet', () => {
    const campaign = useCampaignStore();
    campaign.town = village({ saloon: 1 });
    campaign.accrueSaloonIncome(HOUR_MS);
    for (let hour = 2; hour <= 20; hour++) campaign.accrueSaloonIncome(HOUR_MS * hour);
    expect(campaign.town.income.stored).toBe(48);
    expect(campaign.town.coins).toBe(600);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.town.income.stored).toBe(48);
    expect(reloaded.town.coins).toBe(600);
    expect(reloaded.collectSaloonIncome(HOUR_MS * 20)).toBe(48);
    expect(reloaded.town.coins).toBe(648);
    setActivePinia(createPinia());
    const collected = useCampaignStore();
    expect(collected.collectSaloonIncome(HOUR_MS * 20)).toBe(0);
    expect(collected.collectSaloonIncome(HOUR_MS * 21)).toBe(6);
    expect(collected.town.coins).toBe(654);
  });
  it('scales with completed saloon levels and houses; needs customers and stops at eight away hours', () => {
    const town = village({ saloon: 3, home: 2, home2: 1, home3: 1, home4: 1 });
    town.projects.home4 = { id: 'home4', stage: 2, wins: 0, required: 4 };
    expect(saloonIncomeRate(town)).toBe(55);
    const start = settleSaloonIncome(town, HOUR_MS).town;
    const collected = settleSaloonIncome(start, HOUR_MS * 101);
    expect(collected.earned).toBe(440);
    expect(settleSaloonIncome(collected.town, HOUR_MS * 101).earned).toBe(0);
    expect(settleSaloonIncome(collected.town, HOUR_MS * 102).earned).toBe(0);
    expect(saloonIncomeRate(village({ farm: 0, saloon: 3 }))).toBe(0);
    expect(saloonIncomeRate(village({ home: 0, saloon: 1 }))).toBe(0);
  });
  it('preserves already stored coins if a population change lowers the current storage cap', () => {
    let town = settleSaloonIncome(village({ saloon: 1, stable: 1 }), HOUR_MS).town;
    town = settleSaloonIncome(town, HOUR_MS * 9).town;
    expect(town.income.stored).toBe(104);
    town.buildings.farm = 0;
    expect(saloonIncomeRate(town) * 8).toBeLessThan(104);
    town = normalizeTown(town);
    expect(settleSaloonIncome(town, HOUR_MS * 10).town.income.stored).toBe(104);
  });
  it('does not double-credit clock rollback and rejects invalid clock/checkpoint values', () => {
    const town = settleSaloonIncome(village({ saloon: 1 }), HOUR_MS * 2).town;
    for (const time of [HOUR_MS, NaN, Infinity, -1, 1.2])
      expect(settleSaloonIncome(town, time).town).toBe(town);
    expect(settleSaloonIncome(town, HOUR_MS * 3).earned).toBe(6);
    expect(normalizeTown({ income: { at: -1, remainder: 999999999 } }).income).toEqual({
      at: null,
      remainder: 0,
      stored: 0,
    });
  });
  it('settles the old rate before a free hammer upgrade and reloads without paying twice', () => {
    const campaign = useCampaignStore();
    campaign.town = village({ saloon: 1 });
    vi.spyOn(Date, 'now').mockReturnValue(HOUR_MS);
    campaign.collectSaloonIncome();
    campaign.builderHammers = 1;
    Date.now.mockReturnValue(HOUR_MS * 2);
    expect(campaign.useBuilderHammer('saloon', 1)).toBe(true);
    expect(campaign.town.coins).toBe(600);
    expect(campaign.town.income.stored).toBe(6);
    expect(campaign.town.buildings.saloon).toBe(2);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.collectSaloonIncome()).toBe(6);
    expect(reloaded.collectSaloonIncome()).toBe(0);
    expect(reloaded.collectSaloonIncome(HOUR_MS * 3)).toBe(13);
  });
});

describe('A useful square and a longer village economy', () => {
  it('connects visitors, basic needs, happiness, and saloon spending', () => {
    const town = village({ saloon: 1 });
    expect(residentPopulation(town)).toBe(2);
    expect(saloonIncomeRate(town)).toBe(6);
    town.buildings.stable = 1;
    expect(visitorPopulation(town)).toBe(2);
    expect(population(town)).toBe(4);
    expect(saloonIncomeRate(town)).toBe(13);
    town.buildings.square = 1;
    expect(happiness(town)).toBe(50);
    expect(saloonIncomeRate(town)).toBe(14);
    town.buildings.museum = 2;
    expect(visitorCapacity(town)).toBe(4);
    expect(visitorPopulation(town)).toBe(4);
    expect(saloonIncomeRate(town)).toBe(22);
    town.buildings.home = 3;
    expect(residentPopulation(town)).toBe(6);
    expect(visitorPopulation(town)).toBe(0);
    expect(happiness(town)).toBe(31);
    town.buildings.well = town.buildings.farm = 2;
    expect(visitorPopulation(town)).toBe(2);
    expect(happiness(town)).toBe(48);
    expect(saloonIncomeRate(town)).toBe(43);
  });
  it('settles existing visitors and happiness before a square changes the income rate', () => {
    const campaign = useCampaignStore();
    campaign.town = village({ saloon: 1, stable: 1 });
    campaign.builderHammers = 1;
    vi.spyOn(Date, 'now').mockReturnValue(HOUR_MS);
    campaign.collectSaloonIncome();
    Date.now.mockReturnValue(HOUR_MS * 2);
    expect(campaign.useBuilderHammer('square', 0)).toBe(true);
    expect(campaign.town.coins).toBe(600);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.collectSaloonIncome()).toBe(13);
    expect(reloaded.collectSaloonIncome()).toBe(0);
    expect(reloaded.collectSaloonIncome(HOUR_MS * 3)).toBe(14);
    expect(happiness(reloaded.town)).toBe(50);
  });
  it('allows fourth and fifth levels without a completed-puzzle gate for either payment', () => {
    for (const { id } of frontierBuildings.filter((b) => b.upgrades.length === 5)) {
      let town = {
        ...village(Object.fromEntries(frontierBuildings.map((b) => [b.id, 3]))),
        coins: 10000,
        completedRuns: 0,
      };
      expect(upgradeOffer(town, id).available).toBe(true);
      expect(purchase(town, id, 3).projects[id]).toMatchObject({ stage: 4, required: 1 });
      town = buildWithHammer(town, id, 3);
      expect(town.buildings[id]).toBe(4);
      expect(town.coins).toBe(10000);
      expect(purchase(town, id, 4).projects[id]).toMatchObject({ stage: 5, required: 1 });
      town = buildWithHammer(town, id, 4);
      expect(town.buildings[id]).toBe(5);
      expect(normalizeTown(town).buildings[id]).toBe(5);
      expect(upgradeOffer(town, id)).toBeNull();
    }
  });
  it('supports a mature village with meaningful services at every final tier', () => {
    const town = village(
      Object.fromEntries(frontierBuildings.map((b) => [b.id, b.upgrades.length])),
    );
    expect(residentPopulation(town)).toBe(40);
    expect(visitorPopulation(town)).toBe(18);
    expect(happiness(town)).toBe(100);
    expect(saloonIncomeRate(town)).toBe(1468);
    expect(bonusCapacity(town)).toBe(20);
    expect(rollShopStock(5)).toHaveLength(5);
    expect(gangSize(town)).toBe(10);
    const raid = banditEncounter(town);
    expect(normalizeTown(raid).events[BANDIT_EVENT]).toMatchObject({
      outcome: 'protected',
      gangSize: 10,
      sheriffLevel: 5,
      bankLevel: 5,
    });
    town.buildings.sheriff = town.buildings.bank = 0;
    town.coins = 10000;
    expect(banditEncounter(town).events[BANDIT_EVENT].loss).toBe(30);
    expect(normalizeTown({ buildings: { home: 3, well: 3, farm: 3 } }).buildings.square).toBe(0);
  });
  it('quotes the next price while keeping locked plots out of the first-build discount', () => {
    const town = createTown();
    expect(upgradeOffer(town, 'well').cost).toBe(0);
    expect(upgradeOffer(town, 'well2')).toMatchObject({ cost: 113, available: false });
    town.buildings.well = 1;
    expect(upgradeOffer(town, 'well')).toMatchObject({ cost: 210, stage: 1, available: true });
  });
});

describe('Visible raids with a single saved outcome', () => {
  it.each([
    [1, 2],
    [2, 4],
    [3, 6],
  ])('scales gangs for developed towns and protects them at sheriff level %s', (level, riders) => {
    const town = village(Object.fromEntries(legacyBuildings.map((b) => [b.id, level])));
    // Keep the development bands independent of the two new plots.
    town.buildings.shop = 0;
    town.buildings.home4 = 0;
    town.buildings.square = 0;
    expect(gangSize(town)).toBe(riders);
    const result = banditEncounter(town);
    expect(result.events[BANDIT_EVENT]).toMatchObject({
      gangSize: riders,
      sheriffLevel: level,
      loss: 0,
      outcome: 'protected',
    });
    town.buildings.sheriff = Math.max(0, level - 1);
    const underprotected = banditEncounter(town);
    expect(underprotected.events[BANDIT_EVENT].loss).toBeGreaterThan(0);
  });
  it('retains current protection during sheriff work and never takes the final fifty coins', () => {
    let town = village(Object.fromEntries(legacyBuildings.map((b) => [b.id, 2])));
    town.buildings.shop = 0;
    town.buildings.home4 = 0;
    town.buildings.square = 0;
    town.buildings.sheriff = 1;
    town = purchase(town, 'sheriff', 1);
    expect(banditEncounter(town).events[BANDIT_EVENT]).toMatchObject({ sheriffLevel: 1, loss: 5 });
    town.coins = 53;
    expect(banditEncounter(town).coins).toBe(50);
    town = finishConstruction(advanceConstruction(town), 'sheriff', 2);
    expect(banditEncounter(town).events[BANDIT_EVENT].outcome).toBe('protected');
  });
  it('saves before presenting, resumes an unseen raid after reload, and spaces raids by normal puzzle wins', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    let campaign = useCampaignStore();
    campaign.town = village();
    expect(campaign.resolveBandits()).toBe(true);
    const snapshot = JSON.parse(saves.get(SAVE_KEY));
    expect(snapshot.town.events[BANDIT_EVENT].seen).toBe(false);
    expect(snapshot.town.coins).toBe(590);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(campaign.resolveBandits()).toBe(false);
    expect(campaign.town.coins).toBe(590);
    expect(campaign.markRaidSeen(99)).toBe(false);
    expect(campaign.markRaidSeen(1)).toBe(true);
    expect(campaign.markRaidSeen(1)).toBe(false);
    campaign.town.completedRuns = 4;
    expect(raidReady(campaign.town)).toBe(false);
    campaign.town.completedRuns = 5;
    expect(raidReady(campaign.town)).toBe(true);
    expect(campaign.resolveBandits()).toBe(true);
    expect(campaign.town.events[BANDIT_EVENT].id).toBe(2);
    expect(campaign.town.coins).toBe(580);
  });
  it('discards incomplete raid receipts and resets stored income with the village', () => {
    const town = normalizeTown({
      ...village(),
      events: { [BANDIT_EVENT]: { outcome: 'protected', loss: 0 } },
    });
    expect(town.events[BANDIT_EVENT]).toBeUndefined();
    const campaign = useCampaignStore();
    campaign.town = town;
    campaign.town.income = { at: HOUR_MS, stored: 12, remainder: 3 };
    campaign.lastSaloonIncome = 12;
    campaign.resetProgress();
    setActivePinia(createPinia());
    expect(useCampaignStore().town).toEqual(createTown());
    expect(useCampaignStore().lastSaloonIncome).toBe(0);
  });
});

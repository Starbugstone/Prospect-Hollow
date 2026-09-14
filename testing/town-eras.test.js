import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, createTown, BANDIT_EVENT } from '../src/data/town';
import { CHAPTERS } from '../src/data/campaign';
import { ERAS, forgeProductionRuns } from '../src/data/eras';
import { campaignMilestoneReached } from '../src/data/campaignMilestones';
import {
  normalizeTown,
  purchase,
  advanceConstruction,
  finishConstruction,
  foodCapacity,
  residentPopulation,
  visitorPopulation,
  happiness,
  saloonIncomeRate,
  plotUnlocked,
  upgradeOffer,
  advanceForge,
  buildWithHammer,
} from '../src/game/town/TownRules';
import { advanceEra, eraGate, isEraComplete } from '../src/game/town/TownEras';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { useGameStore } from '../src/stores/gameStore';
import {
  PLOTS,
  visiblePlots,
  townTracks,
  railEdges,
  routeBetween,
  plotStreet,
} from '../src/game/town/TownLayout';
import { RIVER, riverDistance, riverCenterX, wetBank } from '../src/game/town/TownRiver';
import { groundHeight } from '../src/game/town/TownLandscape';

const frontier = () => {
  const town = createTown();
  town.coins = 30000;
  town.completedRuns = 70;
  for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
    town.buildings[b.id] = b.upgrades.length;
  return town;
};
const milestoneRecords = () =>
  Object.fromEntries(
    Array.from(
      { length: (CHAPTERS.findIndex((c) => c.id === 'river-discovery') + 1) * 6 },
      (_, i) => [i + 1, { score: 100, stars: 1 }],
    ),
  );
const victory = (runId) => ({ id: 1, runId, score: 0, target: 1000, combo: 1 });
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
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Frontier additions preserve bounded services and saves', () => {
  it('shortens later Steam stages while preserving paid work and the first modernization', () => {
    let town = advanceEra(frontier(), 'frontier');
    expect(upgradeOffer(town, 'saloon').runs).toBe(2);
    town = buildWithHammer(town, 'saloon', upgradeOffer(town, 'saloon').stage);
    expect(upgradeOffer(town, 'saloon').runs).toBe(1);
    town = purchase(town, 'saloon', upgradeOffer(town, 'saloon').stage);
    town.projects.saloon = { ...town.projects.saloon, required: 2, wins: 1 };
    town.buildings.railDepot = 1;
    town.projects.railDepot = { id: 'railDepot', stage: 2, required: 2, wins: 1 };
    const coins = town.coins;
    town = normalizeTown(town);
    expect(town.coins).toBe(coins);
    expect(town.projects.saloon).toMatchObject({ required: 1, wins: 1 });
    expect(town.projects.railDepot).toMatchObject({ required: 1, wins: 1 });
    town = finishConstruction(town, 'saloon', town.projects.saloon.stage);
    expect(upgradeOffer(town, 'saloon').runs).toBe(1);
  });
  it('loads a v3 receipt without losing its coins, construction, income, stock or inventory', () => {
    const town = frontier();
    delete town.era;
    delete town.buildingEras;
    delete town.forge;
    delete town.infrastructure;
    for (const id of ['fisherman', 'blacksmith', 'school', 'doctor']) delete town.buildings[id];
    town.buildings.saloon = 2;
    town.projects.saloon = { id: 'saloon', stage: 3, wins: 1, required: 1 };
    town.income = { at: 1000, stored: 73, remainder: 800 };
    town.events[BANDIT_EVENT] = {
      id: 1,
      atRun: 60,
      gangSize: 10,
      sheriffLevel: 5,
      bankLevel: 5,
      outcome: 'protected',
      loss: 0,
      seen: true,
      targets: ['mine'],
    };
    saves.set(
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        town,
        records: { 1: { score: 500, stars: 2 } },
        powers: [{ id: 'tnt', quantity: 3 }],
        builderHammers: 2,
        shopVisit: 8,
        shopStock: [{ id: 'tnt', sold: true }],
      }),
    );
    const campaign = useCampaignStore();
    expect(campaign.town).toMatchObject({
      era: 'frontier',
      coins: 30000,
      forge: { charge: 0, progress: 0 },
      income: town.income,
      projects: town.projects,
      events: town.events,
    });
    expect(campaign.town.buildings).toMatchObject({
      fisherman: 0,
      blacksmith: 0,
      school: 0,
      doctor: 0,
      railDepot: 0,
    });
    expect(campaign.records[1]).toEqual({ score: 500, stars: 2 });
    expect(campaign.powers.find((p) => p.id === 'tnt').quantity).toBe(3);
    expect(campaign.builderHammers).toBe(2);
    expect(campaign.shopVisit).toBe(8);
    expect(campaign.shopStock).toContainEqual({ id: 'tnt', sold: true });
  });
  it('activates fisherman food exactly once after finishing, and keeps school happiness capped', () => {
    let town = frontier();
    town.buildings.fisherman = 0;
    town.buildings.farm = 1;
    town.buildings.farm2 = town.buildings.farm3 = 0;
    expect(foodCapacity(town)).toBe(6);
    for (let stage = 0; stage < 3; stage++) {
      town = purchase(town, 'fisherman', stage);
      expect(purchase(town, 'fisherman', stage)).toBeNull();
      town = advanceConstruction(town);
      expect(foodCapacity(town)).toBe(6 + stage);
      town = finishConstruction(normalizeTown(town), 'fisherman', stage + 1);
      expect(foodCapacity(town)).toBe(6 + [1, 2, 5][stage]);
      expect(finishConstruction(town, 'fisherman', stage + 1)).toBeNull();
    }
    expect(residentPopulation(town)).toBe(11);
    expect(visitorPopulation(town)).toBe(0);
    const empty = createTown();
    empty.buildings.school = 5;
    expect(happiness(empty)).toBe(5);
    empty.buildings.doctor = 5;
    expect(happiness(empty)).toBe(5);
  });
});

describe('Collecting Forge TNT into inventory', () => {
  it('uses collected TNT once when its blast wins the puzzle', async () => {
    const c = useCampaignStore(),
      g = useGameStore(),
      inventory = useInventoryStore();
    c.town.buildings.blacksmith = 1;
    c.town.forge.charge = 1;
    c.powers.find((p) => p.id === 'tnt').quantity = 2;
    g.bootstrap();
    expect(c.collectForgeTNT()).toBe(true);
    g.startLevel(1);
    g.tiles.forEach((tile, i) => {
      tile.health = i === 14 ? 1 : 0;
      tile.state = 'PLAYABLE';
    });
    g.remainingLayers = 1;
    expect(await inventory.usePowerUp('tnt')).toBe(true);
    expect(await g.resolveBonusClick(14)).toBe(true);
    expect(g.levelCleared).toBe(true);
    expect(c.records[1]).toBeDefined();
    expect(c.powers.find((p) => p.id === 'tnt').quantity).toBe(2);
    expect(c.activeRun).toBeNull();
  });
  it('counts only settled normal completions, caps at one and rejects repeat or stale victories', () => {
    const c = useCampaignStore();
    c.town.buildings.blacksmith = 1;
    c.town.buildings.museum = 1;
    for (let i = 0; i < forgeProductionRuns(1); i++) {
      const run = c.beginRun('normal', 1);
      c.recordVictory(victory(run));
      c.recordVictory(victory(run));
    }
    expect(c.town.forge).toEqual({ progress: 0, charge: 1 });
    for (let i = 0; i < 8; i++) c.recordVictory(victory(c.beginRun('normal', 1)));
    expect(c.town.forge).toEqual({ progress: 0, charge: 1 });
    setActivePinia(createPinia());
    expect(useCampaignStore().town.forge.charge).toBe(1);
  });
  it.each([
    [1, 6],
    [2, 5],
    [3, 4],
    [4, 3],
    [5, 2],
  ])(
    'stores one TNT at level %i and restarts its %i-puzzle cycle after collection',
    (level, runs) => {
      // Keep the newly guaranteed completion chest separate from forge output.
      vi.spyOn(Math, 'random').mockReturnValue(0.8);
      let c = useCampaignStore();
      c.town.buildings.blacksmith = level;
      c.town.buildings.museum = 1;
      for (let i = 0; i < runs + 7; i++) c.recordVictory(victory(c.beginRun('normal', 1)));
      expect(c.town.forge).toEqual({ charge: 1, progress: 0 });
      expect(c.collectForgeTNT()).toBe(true);
      expect(c.town.forge).toEqual({ charge: 0, progress: 0 });
      for (let i = 1; i <= runs; i++) {
        c.recordVictory(victory(c.beginRun('normal', 1)));
        expect(c.town.forge).toEqual(
          i === runs ? { charge: 1, progress: 0 } : { charge: 0, progress: i },
        );
        setActivePinia(createPinia());
        c = useCampaignStore();
      }
      expect(c.powers.find((p) => p.id === 'tnt').quantity).toBe(1);
      expect(c.town.forge).toEqual({ charge: 1, progress: 0 });
    },
  );
  it('preserves production progress across upgrades and makes TNT ready when the shorter cycle is reached', () => {
    let c = useCampaignStore();
    c.town.completedRuns = 100;
    c.town.buildings.home = 1;
    c.town.buildings.blacksmith = 1;
    c.town.forge.progress = 3;
    c.town.projects.blacksmith = { id: 'blacksmith', stage: 2, wins: 1, required: 1 };
    expect(c.finishConstruction('blacksmith', 2)).toBe(true);
    expect(c.town.forge).toEqual({ charge: 0, progress: 3 });
    setActivePinia(createPinia());
    c = useCampaignStore();
    expect(c.town.forge.progress).toBe(3);
    c.town.forge.progress = 4;
    c.builderHammers = 1;
    expect(c.useBuilderHammer('blacksmith', 2)).toBe(true);
    expect(c.town.forge).toEqual({ charge: 1, progress: 0 });
    expect(c.collectForgeTNT()).toBe(true);
    c.town = advanceForge(c.town);
    expect(c.town.forge).toEqual({ charge: 0, progress: 1 });
  });
  it('honors older accumulated forge work under the shorter cycle and preserves stored TNT', () => {
    const town = createTown();
    town.buildings.blacksmith = 1;
    town.forge.progress = 19;
    expect(normalizeTown(town).forge).toEqual({ charge: 1, progress: 0 });
    const ready = advanceForge(normalizeTown(town));
    ready.buildings.blacksmith = 5;
    expect(normalizeTown(ready).forge).toEqual({ charge: 1, progress: 0 });
  });
  it('does not charge a closed or ready blacksmith or Continuous play', () => {
    const c = useCampaignStore();
    c.town.buildings.museum = 1;
    c.town.projects.blacksmith = { id: 'blacksmith', stage: 1, required: 1, wins: 1 };
    c.recordVictory(victory(c.beginRun('normal', 1)));
    expect(c.town.forge.progress).toBe(0);
    c.town.buildings.blacksmith = 1;
    const run = c.beginRun('continuous', 1);
    c.recordContinuous({ id: 1, runId: run, jewels: 300, score: 500 });
    expect(c.recordVictory(victory(run))).toEqual([]);
    expect(c.town.forge).toEqual({ progress: 0, charge: 0 });
  });
  it('collects once, persists the TNT and leaves starting a run independent of the charge', () => {
    const c = useCampaignStore();
    c.town.buildings.blacksmith = 1;
    c.town.forge.charge = 1;
    const run = c.beginRun('normal', 1);
    expect(c.town.forge.charge).toBe(1);
    expect(c.collectForgeTNT()).toBe(false);
    c.endRun(run);
    expect(c.collectForgeTNT()).toBe(true);
    expect(c.collectForgeTNT()).toBe(false);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.town.forge).toEqual({ progress: 0, charge: 0 });
    expect(reloaded.powers.find((p) => p.id === 'tnt').quantity).toBe(1);
    expect(reloaded.town.coins).toBe(0);
    expect(reloaded.builderHammers).toBe(0);
  });
  it.each(['exit', 'win', 'reload', 'replace'])(
    'keeps an unused collected TNT after %s',
    (action) => {
      // The guaranteed win chest must not add TNT to this forge-only assertion.
      vi.spyOn(Math, 'random').mockReturnValue(0.8);
      const c = useCampaignStore(),
        g = useGameStore();
      c.town.buildings.blacksmith = 1;
      c.town.forge.charge = 1;
      expect(c.collectForgeTNT()).toBe(true);
      g.runId = c.beginRun('normal', 1);
      if (action === 'exit') g.exitLevel();
      if (action === 'win') c.recordVictory(victory(g.runId));
      if (action === 'reload') setActivePinia(createPinia());
      if (action === 'replace') c.beginRun('normal', 1);
      expect(useCampaignStore().town.forge.charge).toBe(0);
      expect(useCampaignStore().powers.find((p) => p.id === 'tnt').quantity).toBe(1);
    },
  );
  it('keeps the charge at the blacksmith when storage is full or saving fails', () => {
    const c = useCampaignStore();
    c.town.forge.charge = 1;
    expect(c.collectForgeTNT()).toBe(false);
    c.town.buildings.blacksmith = 1;
    const slot = c.powers.find((p) => p.id === 'tnt');
    slot.quantity = c.bonusLimit;
    expect(c.canCollectForge()).toBe(false);
    expect(c.collectForgeTNT()).toBe(false);
    expect(c.town.forge.charge).toBe(1);
    slot.quantity--;
    expect(c.canCollectForge()).toBe(true);
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw Error('full');
    });
    expect(c.collectForgeTNT()).toBe(false);
    expect(slot.quantity).toBe(c.bonusLimit - 1);
    expect(c.town.forge.charge).toBe(1);
    expect(advanceForge({ ...createTown(), forge: { charge: 0, progress: 4 } }).forge.charge).toBe(
      0,
    );
  });
});

describe('Two eras and explicit modernization', () => {
  it('blocks advancement during a mine run and permits it after exiting either mode', () => {
    const c = useCampaignStore(),
      g = useGameStore();
    c.town = frontier();
    c.records = milestoneRecords();
    for (const mode of ['normal', 'continuous']) {
      g.runId = c.beginRun(mode, 1);
      expect(c.advanceEra('frontier')).toBe(false);
      g.exitLevel();
      expect(c.activeRun).toBeNull();
    }
    expect(c.advanceEra('frontier')).toBe(true);
  });
  it('rolls back an era change when its transition receipt cannot be saved', () => {
    const c = useCampaignStore();
    c.town = frontier();
    c.records = milestoneRecords();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw Error('full');
    });
    expect(c.advanceEra('frontier')).toBe(false);
    expect(c.town.era).toBe('frontier');
    expect(c.town.transition).toBeUndefined();
  });
  it('requires every frontier parcel without any mine progress', () => {
    const town = frontier(),
      records = milestoneRecords();
    expect(campaignMilestoneReached(records, 'river-discovery')).toBe(true);
    expect(eraGate(town).available).toBe(true);
    expect(eraGate(town, records).available).toBe(true);
    for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier')) {
      const incomplete = structuredClone(town);
      incomplete.buildings[b.id]--;
      expect(advanceEra(incomplete, 'frontier'), b.id).toBeNull();
    }
    expect(ERAS.filter((e) => e.enabled).map((e) => e.id)).toEqual([
      'frontier',
      'river-rail',
      'industrial',
      'post-war',
      'motor-age',
      'aviation',
      'broadcast',
      'contemporary',
    ]);
  });
  it('saves the transition before presenting it and cannot advance twice across reload', () => {
    const c = useCampaignStore();
    c.town = frontier();
    c.records = milestoneRecords();
    expect(c.advanceEra('frontier')).toBe(true);
    expect(JSON.parse(saves.get(SAVE_KEY)).town.transition.pending).toBe(true);
    expect(c.advanceEra('frontier')).toBe(false);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.town.era).toBe('river-rail');
    expect(reloaded.town.transition.pending).toBe(true);
    reloaded.acknowledgeEra();
    expect(reloaded.town.eraTransitionSeen['river-rail']).toBe(true);
    expect(reloaded.advanceEra('frontier')).toBe(false);
  });
  it('retains services until modernization finishes and rejects duplicate purchases and finishes', () => {
    let town = advanceEra(frontier(), 'frontier');
    const rate = saloonIncomeRate(town);
    expect(isEraComplete(town)).toBe(false);
    town = purchase(town, 'saloon', 5);
    expect(town.projects.saloon).toMatchObject({
      type: 'modernization',
      stage: 5,
      required: 2,
      cost: 800,
    });
    expect(town.buildingEras.saloon).toBe('frontier');
    expect(saloonIncomeRate(town)).toBe(rate);
    expect(purchase(town, 'saloon', 5)).toBeNull();
    town = normalizeTown(advanceConstruction(town));
    expect(finishConstruction(town, 'saloon', 5)).toBeNull();
    town = finishConstruction(advanceConstruction(town), 'saloon', 5);
    expect(town.buildings.saloon).toBe(5);
    expect(town.buildingEras.saloon).toBe('river-rail');
    expect(saloonIncomeRate(town)).toBe(rate);
    expect(upgradeOffer(town, 'saloon')).toMatchObject({ eraLevel: 2, cost: 1200 });
    expect(finishConstruction(town, 'saloon', 5)).toBeNull();
  });
  it('builds the station and railway in one receipt and enables both only on its first finish', () => {
    let town = frontier();
    expect(plotUnlocked(town, 'railDepot')).toBe(false);
    expect(railEdges(town)).toEqual([]);
    expect(purchase(town, 'railDepot', 0)).toBeNull();
    town = advanceEra(town, 'frontier');
    const coins = town.coins;
    town = purchase(town, 'railDepot', 0);
    const cost = coins - town.coins;
    expect(cost).toBeGreaterThan(0);
    expect(town.infrastructure.rail).toBe(0);
    town = advanceConstruction(advanceConstruction(town));
    expect(railEdges(town)).toEqual([]);
    expect(town.buildings.railDepot).toBe(0);
    town = finishConstruction(normalizeTown(town), 'railDepot', 1);
    expect(town.infrastructure.rail).toBe(1);
    expect(railEdges(town)).toHaveLength(1);
    expect(town.coins).toBe(coins - cost);
    expect(purchase(town, 'railDepot', 0)).toBeNull();
    expect(railEdges(normalizeTown(town))).toHaveLength(1);
  });
  it('completes River & Rail without changing landmark service levels and applies the stronger population and happiness income', () => {
    let town = advanceEra(frontier(), 'frontier');
    town.transition.pending = false;
    for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier'))
      town = buildWithHammer(town, b.id, b.upgrades.length);
    for (const id of [
      'bridge',
      'riverPort',
      'railDepot',
      'post',
      'warehouse',
      'hotel',
      'home5',
      'market',
    ])
      town = buildWithHammer(town, id, 0);
    expect(isEraComplete(town)).toBe(false);
    for (const building of BUILDINGS.filter((b) =>
      ['frontier', 'river-rail'].includes(b.introducedEra),
    )) {
      for (let level = 2; level <= 3; level++) {
        const offer = upgradeOffer(town, building.id);
        town = buildWithHammer(town, building.id, offer.stage);
      }
    }
    expect(isEraComplete(town)).toBe(true);
    expect(eraGate(town, milestoneRecords()).available).toBe(true);
    expect(residentPopulation(town)).toBe(70);
    expect(visitorPopulation(town)).toBe(30); // The Steam waterworks supplies the whole town.
    expect(saloonIncomeRate(town)).toBe(2531);
  });
});

describe('River, gated parcels and permitted crossings', () => {
  it('keeps the river valley below water and banks free of frontier foundations', () => {
    for (let z = -80; z <= 80; z += 2) {
      const x = riverCenterX(z);
      expect(groundHeight(x, z)).toBeLessThan(RIVER.waterHeight);
      expect(wetBank(x, z)).toBe(true);
      expect(wetBank(x + 5, z)).toBe(false);
    }
    for (const b of BUILDINGS.filter((b) => b.introducedEra === 'frontier')) {
      const [x, z] = PLOTS[b.id];
      expect(wetBank(x, z, 2)).toBe(false);
    }
  });
  it('hides future lots from framing and adds pedestrian edges only after finishing the bridge', () => {
    let town = frontier();
    expect(visiblePlots(town).some((p) => p.id === 'railDepot' || p.district === 'east-bank')).toBe(
      false,
    );
    town = advanceEra(town, 'frontier');
    expect(visiblePlots(town).some((p) => p.district === 'east-bank')).toBe(false);
    expect(routeBetween(town, plotStreet('home5'), plotStreet('saloon'))).toEqual([]);
    town = buildWithHammer(town, 'bridge', 0);
    expect(visiblePlots(town).some((p) => p.id === 'home5')).toBe(true);
    const path = routeBetween(town, plotStreet('home5'), plotStreet('saloon'));
    expect(path.length).toBeGreaterThan(3);
    expect(path).toContainEqual([24, 7.5]);
    expect(path).toContainEqual([38, 7.5]);
    for (const edge of townTracks(town))
      for (let n = 0; n <= 20; n++) {
        const x = edge.from[0] + ((edge.to[0] - edge.from[0]) * n) / 20;
        const z = edge.from[1] + ((edge.to[1] - edge.from[1]) * n) / 20;
        if (riverDistance(x, z) < RIVER.halfWidth) expect(edge.crossing).toBe('bridge');
      }
  });
});

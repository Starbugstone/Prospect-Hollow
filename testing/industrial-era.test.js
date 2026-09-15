import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BANDIT_EVENT, createTown } from '../src/data/town';
import { INDUSTRIAL_LEVEL_PRICES, hasElectricity } from '../src/data/industrial';
import { eraBuildingLevel, eraGate, advanceEra, isEraComplete } from '../src/game/town/TownEras';
import {
  advanceConstruction,
  buildWithHammer,
  finishConstruction,
  normalizeTown,
  upgradeOffer,
  purchase,
  waterCapacity,
  housingCapacity,
  banditEncounter,
  reinforceRaid,
  raidBounty,
  ringTownBell,
} from '../src/game/town/TownRules';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { plotStreet, routeBetween, visiblePlots, railEdges } from '../src/game/town/TownLayout';

function completedRiverTown() {
  const town = createTown();
  town.era = 'river-rail';
  town.coins = 250000;
  town.completedRuns = 72;
  for (const b of BUILDINGS.filter((b) => ['frontier', 'river-rail'].includes(b.introducedEra))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = 'river-rail';
    town.buildingEraLevels[b.id] = 3;
  }
  return normalizeTown(town);
}
function industrial() {
  const town = advanceEra(completedRiverTown(), 'river-rail');
  town.transition.pending = false;
  return town;
}
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

describe('Industrial follows every River & Rail upgrade', () => {
  it.each(
    BUILDINGS.filter((b) => ['frontier', 'river-rail'].includes(b.introducedEra)).map((b) => [
      b.id,
    ]),
  )('requires the final River & Rail tier on %s', (id) => {
    const town = completedRiverTown();
    expect(eraGate(town).available).toBe(true);
    if (BUILDINGS.find((b) => b.id === id).introducedEra === 'river-rail') town.buildings[id] = 2;
    else town.buildingEraLevels[id] = 2;
    expect(advanceEra(town, 'river-rail')).toBeNull();
  });
  it('preserves funded second-era work and the old facade on entering Industrial', () => {
    const old = completedRiverTown();
    old.buildingEraLevels.saloon = 2;
    const pending = purchase(old, 'saloon', upgradeOffer(old, 'saloon').stage);
    expect(normalizeTown(pending).projects.saloon).toEqual(pending.projects.saloon);
    expect(advanceEra(pending, 'river-rail')).toBeNull();
    const town = industrial();
    expect(town.buildings).toEqual(completedRiverTown().buildings);
    expect(town.buildingEras.saloon).toBe('river-rail');
    expect(town.buildingEraLevels.saloon).toBe(3);
    expect(eraBuildingLevel(town, 'saloon')).toBe(0);
    expect(railEdges(town)).toHaveLength(1);
  });
  it('saves and resumes the second transition and rolls failed acknowledgements back', () => {
    let c = useCampaignStore();
    c.town = completedRiverTown();
    expect(c.advanceEra('river-rail')).toBe(true);
    expect(JSON.parse(saves.get(SAVE_KEY)).town.transition.to).toBe('industrial');
    setActivePinia(createPinia());
    c = useCampaignStore();
    expect(c.town.transition.pending).toBe(true);
    const save = vi.spyOn(c, 'save').mockReturnValue(false);
    expect(c.acknowledgeEra()).toBe(false);
    expect(c.town.transition.pending).toBe(true);
    save.mockRestore();
    expect(c.acknowledgeEra()).toBe(true);
    expect(c.town.eraTransitionSeen.industrial).toBe(true);
    expect(c.advanceEra('river-rail')).toBe(false);
  });
  it('unlocks electricity only after finishing, and persists its celebration once', () => {
    let c = useCampaignStore();
    c.town = industrial();
    expect(upgradeOffer(c.town, 'saloon').available).toBe(false);
    expect(upgradeOffer(c.town, 'railDepot').available).toBe(true);
    c.town = purchase(c.town, 'powerHouse', 0);
    c.town = advanceConstruction(advanceConstruction(c.town));
    expect(hasElectricity(c.town)).toBe(false);
    expect(c.finishConstruction('powerHouse', 1)).toBe(true);
    expect(hasElectricity(c.town)).toBe(true);
    expect(upgradeOffer(c.town, 'saloon').available).toBe(true);
    expect(c.town.firstLightsSeen).toBe(false);
    const save = vi.spyOn(c, 'save').mockReturnValue(false);
    expect(c.acknowledgeFirstLights()).toBe(false);
    save.mockRestore();
    expect(c.acknowledgeFirstLights()).toBe(true);
    expect(c.acknowledgeFirstLights()).toBe(false);
    setActivePinia(createPinia());
    expect(useCampaignStore().town.firstLightsSeen).toBe(true);
  });
  it.each(
    BUILDINGS.filter((b) => ['frontier', 'river-rail', 'industrial'].includes(b.introducedEra)).map(
      (b) => [b.id],
    ),
  )('finishes all three Industrial tiers of %s across reload, rejecting stale purchases', (id) => {
    let town = industrial();
    town = buildWithHammer(town, 'powerHouse', 0);
    const base = town.buildings[id];
    for (let level = id === 'powerHouse' ? 2 : 1; level <= 3; level++) {
      const offer = upgradeOffer(town, id);
      expect(offer.cost).toBe(INDUSTRIAL_LEVEL_PRICES[level - 1]);
      town = purchase(town, id, offer.stage);
      expect(purchase(town, id, offer.stage)).toBeNull();
      town = normalizeTown(advanceConstruction(advanceConstruction(town)));
      town = finishConstruction(town, id, town.projects[id].stage);
      expect(eraBuildingLevel(town, id)).toBe(level);
      expect(buildWithHammer(town, id, offer.stage)).toBeNull();
      town = normalizeTown(town);
      expect(eraBuildingLevel(town, id)).toBe(level);
    }
    expect(upgradeOffer(town, id)).toBeNull();
    if (BUILDINGS.find((b) => b.id === id).introducedEra !== 'industrial')
      expect(town.buildings[id]).toBe(base);
    if (id === 'well') expect(waterCapacity(town)).toBe(120);
    if (id === 'rowHouses') expect(housingCapacity(town)).toBe(housingCapacity(industrial()) + 16);
    if (id === 'bridge') expect(town.infrastructure.bridge).toBe(3);
    if (id === 'railDepot') expect(town.infrastructure.rail).toBe(3);
  });
  it('unlocks Post-war Rebuilding and blocks completion for any unfinished Industrial plot', () => {
    let town = industrial();
    town = buildWithHammer(town, 'powerHouse', 0);
    for (const b of BUILDINGS.filter((b) =>
      ['frontier', 'river-rail', 'industrial'].includes(b.introducedEra),
    )) {
      let offer;
      while ((offer = upgradeOffer(town, b.id))) town = buildWithHammer(town, b.id, offer.stage);
    }
    expect(isEraComplete(town)).toBe(true);
    expect(eraGate(town).available).toBe(true);
    expect(eraGate(town).next.id).toBe('post-war');
    for (const b of BUILDINGS.filter((b) =>
      ['frontier', 'river-rail', 'industrial'].includes(b.introducedEra),
    )) {
      const unfinished = structuredClone(town);
      if (b.introducedEra === 'industrial') unfinished.buildings[b.id] = 2;
      else unfinished.buildingEraLevels[b.id] = 2;
      expect(isEraComplete(unfinished), b.id).toBe(false);
    }
  });
  it('keeps future parcels hidden and connects the new district through the existing bridge', () => {
    expect(visiblePlots(completedRiverTown()).some((p) => p.id === 'powerHouse')).toBe(false);
    const town = buildWithHammer(industrial(), 'powerHouse', 0);
    for (const id of ['powerHouse', 'fireStation', 'rowHouses', 'mill'])
      expect(routeBetween(town, plotStreet(id), plotStreet('sheriff')).length, id).toBeGreaterThan(
        1,
      );
  });
});

describe('Each era has a bounded village event', () => {
  it('keeps old bandit receipts unchanged and creates cargo theft only for new second-era events', () => {
    const town = completedRiverTown();
    town.nextRaidRun = 72;
    const cargo = banditEncounter(town, () => 0);
    expect(cargo.events[BANDIT_EVENT]).toMatchObject({
      kind: 'cargo-theft',
      targets: ['warehouse'],
      loss: 0,
    });
    expect(normalizeTown(cargo).events).toEqual(cargo.events);
    delete cargo.events[BANDIT_EVENT].kind;
    expect(normalizeTown(cargo).events[BANDIT_EVENT].kind).toBeUndefined();
  });
  it('recovers malformed incident targets without losing the saved town', () => {
    const town = completedRiverTown();
    town.nextRaidRun = town.completedRuns;
    const cargo = banditEncounter(town, () => 0);
    cargo.events[BANDIT_EVENT].targets = 'warehouse';
    const restored = normalizeTown(cargo);
    expect(restored.coins).toBe(cargo.coins);
    expect(restored.events[BANDIT_EVENT].targets).toEqual(['railDepot']);
  });
  it.each([0, 1, 2, 3])(
    'bounds workshop losses with fire station level %i and never destroys buildings',
    (level) => {
      const town = buildWithHammer(industrial(), 'powerHouse', 0);
      town.buildings.fireStation = level;
      town.nextRaidRun = town.completedRuns;
      const after = banditEncounter(town, () => 0),
        event = after.events[BANDIT_EVENT];
      expect(event.kind).toBe('workshop-fire');
      expect(event.loss).toBe([30, 17, 9, 0][level]);
      expect(after.buildings).toEqual(town.buildings);
      expect(raidBounty(event)).toBe(0);
      expect(normalizeTown(after).events).toEqual(after.events);
      expect(eraGate(after).pendingRaid).toBe(true);
    },
  );
  it('refunds a fire loss when ready defense opens and cannot pay a fire bounty or repeat settlement', () => {
    const c = useCampaignStore();
    let town = buildWithHammer(industrial(), 'powerHouse', 0);
    town.nextRaidRun = town.completedRuns;
    c.town = banditEncounter(town, () => 0);
    c.town = ringTownBell(c.town, c.town.events[BANDIT_EVENT].id);
    expect(c.town.events[BANDIT_EVENT].loss).toBe(15);
    c.town.buildings.fireStation = 3;
    c.town = reinforceRaid(c.town);
    expect(c.town.coins).toBe(town.coins);
    expect(c.town.events[BANDIT_EVENT].loss).toBe(0);
    const id = c.town.events[BANDIT_EVENT].id;
    expect(c.markRaidSeen(id)).toBe(true);
    expect(c.town.coins).toBe(town.coins);
    expect(c.markRaidSeen(id)).toBe(false);
  });
  it('protects the last fifty coins and creates no events from elapsed offline time', () => {
    let town = buildWithHammer(industrial(), 'powerHouse', 0);
    town.coins = 50;
    town.nextRaidRun = town.completedRuns + 1;
    expect(banditEncounter(town)).toBeNull();
    town.completedRuns++;
    town = banditEncounter(town, () => 0);
    expect(town.coins).toBe(50);
    expect(normalizeTown(town).coins).toBe(50);
  });
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { TOWN_PROJECTS } from '../src/data/townProjects';
import { BUILDING_BY_ID, BUILDINGS, createTown } from '../src/data/town';
import { finishedRewardProjects, townProjects } from '../src/game/town/TownProjects';
import { eraGate, eraIndex } from '../src/game/town/TownEras';
import {
  advanceConstruction,
  finishConstruction,
  purchase,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import fr from '../src/i18n/fr.json';
import { HAMMER_CAPACITY } from '../src/data/rewards';
import { ERAS } from '../src/data/eras';
let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
function aviationTown() {
  const town = createTown();
  town.era = 'aviation';
  town.coins = 1e7;
  for (const b of BUILDINGS.filter((b) => eraIndex(b.introducedEra) <= eraIndex(town.era))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = town.era;
    town.buildingEraLevels[b.id] = 3;
  }
  town.buildings.airport = 0;
  return town;
}
it('uses real, available plots and attainable three-stage targets with translated project titles', () => {
  for (const project of TOWN_PROJECTS) {
    expect(fr[project.title]).toBeTruthy();
    for (const id of project.buildings) {
      expect(BUILDING_BY_ID[id]).toBeTruthy();
      expect(eraIndex(BUILDING_BY_ID[id].introducedEra)).toBeLessThanOrEqual(eraIndex(project.era));
      if (BUILDING_BY_ID[id].introducedEra === project.era)
        expect(BUILDING_BY_ID[id].upgrades).toHaveLength(3);
    }
  }
});
it('counts existing Frontier work immediately without altering construction offers or era gates', () => {
  const c = useCampaignStore();
  c.town.buildings = { ...c.town.buildings, well: 1, farm: 1, home: 1 };
  const before = JSON.parse(JSON.stringify(c.town));
  expect(townProjects(c.town)[0]).toMatchObject({ done: 3, total: 9, complete: false });
  expect(townProjects(c.town)[0].milestones[0]).toMatchObject({ done: 3, total: 3 });
  const offer = upgradeOffer(c.town, 'home'),
    gate = eraGate(c.town);
  expect(c.focusTownProject('trail-welcome')).toBe(true);
  expect(upgradeOffer(c.town, 'home')).toEqual(offer);
  expect(eraGate(c.town)).toEqual(gate);
  expect(JSON.parse(JSON.stringify(c.town))).toEqual(before);
});
it('counts finished construction only, including the two-run airport initial build and one-run upgrades', () => {
  let town = aviationTown();
  const project = () => townProjects(town).find((p) => p.id === 'airport-opening');
  expect(project()).toMatchObject({ done: 3, total: 6 });
  for (let stage = 0; stage < 3; stage++) {
    const offer = upgradeOffer(town, 'airport');
    town = purchase(town, 'airport', offer.stage);
    expect(project().done).toBe(3 + stage);
    town = advanceConstruction(town);
    if (!stage) {
      expect(project().buildings[0].ready).toBe(false);
      town = advanceConstruction(town);
    }
    expect(project().buildings[0].ready).toBe(true);
    town = finishConstruction(town, 'airport', town.projects.airport.stage);
    expect(project().done).toBe(4 + stage);
  }
  expect(project().complete).toBe(true);
});
it('counts free hammer completion and persists focus through reload and backup import', () => {
  let c = useCampaignStore();
  c.town = aviationTown();
  c.builderHammers = 1;
  expect(c.focusTownProject('airport-opening')).toBe(true);
  const coins = c.town.coins;
  expect(c.useBuilderHammer('airport', 0)).toBe(true);
  expect(c.town.coins).toBe(coins);
  expect(townProjects(c.town)[0].done).toBe(4);
  const backup = c.exportSave();
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.townProjectFocus).toBe('airport-opening');
  expect(townProjects(c.town)[0].done).toBe(4);
  expect(c.focusTownProject('traveler-welcome')).toBe(true);
  c.importSave(backup);
  expect(c.townProjectFocus).toBe('airport-opening');
  expect(c.focusTownProject('first-neighbors')).toBe(false);
  expect(c.focusTownProject('unknown')).toBe(false);
});
it('discards invalid or wrong-era saved focus and rolls back failed focus writes', () => {
  const c = useCampaignStore();
  c.save();
  const data = JSON.parse(saved.get(SAVE_KEY));
  data.townProjectFocus = 'airport-opening';
  saved.set(SAVE_KEY, JSON.stringify(data));
  setActivePinia(createPinia());
  const restored = useCampaignStore();
  expect(restored.townProjectFocus).toBe('');
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw Error('storage full');
  });
  expect(restored.focusTownProject('first-neighbors')).toBe(false);
  expect(restored.townProjectFocus).toBe('');
});

it('pays one builder hammer for each finished Frontier starter project, once and past the limit', () => {
  const campaign = useCampaignStore();
  expect(TOWN_PROJECTS.filter((project) => project.hammers).map((project) => project.id)).toEqual([
    'first-neighbors',
    'trail-welcome',
  ]);
  Object.assign(campaign.town.buildings, { well: 3, farm: 3, home: 2 });
  campaign.town.coins = 10000;
  campaign.builderHammers = HAMMER_CAPACITY;
  expect(campaign.upgradeBuilding('home', 2)).toBe(true);
  // Starting the last stage pays nothing; finishing it completes the project.
  expect(campaign.builderHammers).toBe(HAMMER_CAPACITY);
  expect(campaign.lastProjectReward).toBe(null);
  campaign.town = advanceConstruction(campaign.town);
  expect(campaign.finishConstruction('home', 3)).toBe(true);
  expect(campaign.builderHammers).toBe(HAMMER_CAPACITY + 1);
  expect(campaign.lastProjectReward).toEqual({ projects: ['first-neighbors'], hammers: 1 });
  const receipt = campaign.integrity.actions.at(-1);
  expect(receipt).toMatchObject({ kind: 'building-finish', data: { projectRewards: 1 } });
  // The finished project never pays again, after a reload or another building.
  setActivePinia(createPinia());
  const reloaded = useCampaignStore();
  expect(reloaded.builderHammers).toBe(HAMMER_CAPACITY + 1);
  expect(reloaded.useBuilderHammer('stable', 0)).toBe(true);
  expect(reloaded.lastProjectReward).toBe(null);
  expect(reloaded.builderHammers).toBe(HAMMER_CAPACITY);
});

it('pays back the hammer that finishes a starter project', () => {
  const campaign = useCampaignStore();
  Object.assign(campaign.town.buildings, { stable: 3, shop: 3, school: 2, home: 2 });
  campaign.builderHammers = 1;
  expect(campaign.useBuilderHammer('school', 2)).toBe(true);
  expect(campaign.builderHammers).toBe(1);
  expect(campaign.lastProjectReward).toEqual({ projects: ['trail-welcome'], hammers: 1 });
  expect(fr['Project complete: {project}. The town gives you a builder hammer.']).toBeTruthy();
});

// An era may deliberately omit guides only with an explicit, documented decision here.
const ERAS_WITHOUT_GUIDED_PROJECTS = [];
const guidedEras = ERAS.filter(
  (era) => era.enabled && !ERAS_WITHOUT_GUIDED_PROJECTS.includes(era.id),
);
it('covers every enabled era with guides, including future eras unless explicitly opted out', () => {
  for (const era of guidedEras) {
    const projects = TOWN_PROJECTS.filter((project) => project.era === era.id);
    expect(projects.length, era.id).toBeGreaterThanOrEqual(2);
    if (eraIndex(era.id) > eraIndex('tomorrow')) {
      // Every new required plot appears in the main guide path.
      const guided = projects.flatMap((project) => project.buildings);
      for (const building of BUILDINGS.filter(
        (building) => building.introducedEra === era.id && building.requiredForEraCompletion,
      ))
        expect(guided, building.id).toContain(building.id);
    }
  }
});
it('uses only required buildings and keeps all later guides free of hammer rewards', () => {
  for (const project of TOWN_PROJECTS) {
    if (project.era !== 'frontier') expect(project.hammers, project.id).toBe(0);
    for (const id of project.buildings)
      expect(BUILDING_BY_ID[id].requiredForEraCompletion, id).toBe(true);
  }
});
function completeEraTown(era) {
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS.filter((b) => eraIndex(b.introducedEra) <= eraIndex(era))) {
    if (!b.requiredForEraCompletion) continue;
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
}
it.each(guidedEras.map((era) => era.id))(
  'recognizes completed %s saves without retroactive rewards on load, focus or import',
  (era) => {
    const campaign = useCampaignStore();
    campaign.town = completeEraTown(era);
    campaign.builderHammers = 2;
    campaign.save();
    setActivePinia(createPinia());
    const restored = useCampaignStore();
    const projects = townProjects(restored.town);
    expect(projects.length).toBeGreaterThan(0);
    expect(projects.every((project) => project.complete)).toBe(true);
    expect(finishedRewardProjects(restored.town, restored.town)).toEqual([]);
    expect(restored.builderHammers).toBe(2);
    expect(restored.focusTownProject(projects[0].id)).toBe(true);
    const backup = restored.exportSave();
    restored.importSave(backup);
    expect(restored.builderHammers).toBe(2);
    expect(restored.lastProjectReward).toBeNull();
    expect(eraGate(restored.town).townComplete).toBe(true);
    expect(restored.town.buildings.saucerPad).toBe(0);
  },
);
it.each(guidedEras.filter((era) => era.id !== 'frontier').map((era) => era.id))(
  'finishes a %s guided project without paying a hammer',
  (era) => {
    const town = completeEraTown(era);
    const project = TOWN_PROJECTS.find((project) => project.era === era);
    const id = project.buildings[0];
    const before = structuredClone(town);
    if (BUILDING_BY_ID[id].introducedEra === era) before.buildings[id] = 2;
    else before.buildingEraLevels[id] = 2;
    expect(townProjects(before).find((p) => p.id === project.id).complete).toBe(false);
    expect(townProjects(town).find((p) => p.id === project.id).complete).toBe(true);
    expect(finishedRewardProjects(before, town)).toEqual([]);
  },
);
it('tracks Moon construction and uses the shared building names and offers', () => {
  const town = completeEraTown('twin-hollows');
  town.buildings.willowkinDome = 2;
  town.projects.willowkinDome = { id: 'willowkinDome', stage: 3, wins: 1, required: 2 };
  const project = () => townProjects(town).find((project) => project.id === 'moon-gardens');
  expect(project().buildings.map((building) => building.name)).toEqual([
    'Greenhouse',
    'Willowkin dome',
    'Commons',
  ]);
  expect(project()).toMatchObject({ done: 8, total: 9, complete: false });
  expect(project().buildings[1]).toMatchObject({ level: 2, ready: false, runs: 2 });
  town.projects.willowkinDome.wins = 2;
  expect(project().buildings[1].ready).toBe(true);
  expect(project().done).toBe(8);
  expect(
    townProjects(finishConstruction(town, 'willowkinDome', 3)).find(
      (project) => project.id === 'moon-gardens',
    ).complete,
  ).toBe(true);
});

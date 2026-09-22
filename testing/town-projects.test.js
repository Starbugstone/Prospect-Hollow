import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { TOWN_PROJECTS } from '../src/data/townProjects';
import { BUILDING_BY_ID, BUILDINGS, createTown } from '../src/data/town';
import { townProjects } from '../src/game/town/TownProjects';
import { eraGate, eraIndex } from '../src/game/town/TownEras';
import {
  advanceConstruction,
  finishConstruction,
  purchase,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import fr from '../src/i18n/fr.json';
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

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { Scene } from 'three';
import { createPinia, setActivePinia } from 'pinia';
import { createTown, MOON_BUILDINGS } from '../src/data/town';
import { TOWN_ACTIONS, buildingActionLabel } from '../src/data/townIndicators';
import { buildingStatusLabel } from '../src/game/town/TownBuildingFeedback';
import {
  advanceConstruction,
  buildingIndicators,
  constructionReady,
  constructionVisual,
} from '../src/game/town/TownRules';
import { MoonConstruction } from '../src/game/town/moon/MoonConstruction';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { useCampaignStore } from '../src/stores/campaignStore';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

function view() {
  const v = { d: new TownPrimitives(), scene: new Scene(), elapsed: 0, reducedMotion: false };
  v.construction = new MoonConstruction(v);
  return v;
}
function townFor(id, wins = 0) {
  const town = createTown();
  town.era = MOON_BUILDINGS.find((building) => building.id === id).introducedEra;
  town.projects[id] = { id, stage: 1, wins, required: 2 };
  return town;
}

it.each(MOON_BUILDINGS.map(({ id }) => id))(
  '%s keeps its lunar worksite until the shared store finishes it',
  (id) => {
    const v = view();
    const store = useCampaignStore();
    store.town = townFor(id);
    v.construction.sync(store.town);
    const first = v.construction.sites.get(id).root;
    expect(first.parent).toBe(v.scene);
    expect(first.userData.progress).toBe(constructionVisual(store.town.projects[id]));
    expect(first.userData.ready).toBe(false);
    expect(buildingStatusLabel(store.town, id)).toBe('0/2');
    expect(store.finishConstruction(id, 1)).toBe(false);
    const geometry = first.children.find((part) => part.isMesh).geometry;
    const release = vi.spyOn(geometry, 'dispose');
    store.town = advanceConstruction(store.town);
    v.construction.sync(store.town);
    expect(release).toHaveBeenCalledOnce();
    expect(first.parent).toBeNull();
    expect(v.construction.sites.get(id).root.userData.progress).toBe(2);
    expect(buildingStatusLabel(store.town, id)).toBe('1/2');
    store.town = advanceConstruction(store.town);
    v.construction.sync(store.town);
    const ready = v.construction.sites.get(id).root;
    expect(constructionReady(store.town.projects[id])).toBe(true);
    expect(ready.userData.ready).toBe(true);
    // Both maps receive this exact indicator map and use the same icon/label contract.
    const indicators = buildingIndicators(store.town);
    expect(indicators[id]).toBe('ready');
    expect(TOWN_ACTIONS[indicators[id]].icon).toContain('builder-hammer');
    expect(buildingStatusLabel(store.town, id, indicators[id])).toBe('Tap to finish');
    expect(buildingActionLabel(store.town, id, indicators[id])).toMatch(/^Finish /);
    expect(store.finishConstruction(id, 1)).toBe(true);
    v.construction.sync(store.town);
    expect(store.town.buildings[id]).toBe(1);
    expect(store.town.projects[id]).toBeUndefined();
    expect(v.construction.sites.has(id)).toBe(false);
    expect(ready.parent).toBeNull();
    expect(buildingIndicators(store.town)[id]).not.toBe('ready');
    expect(v.construction.effects).toHaveLength(1);
    expect(store.finishConstruction(id, 1)).toBe(false);
    const effect = v.construction.effects[0].root;
    v.construction.update(2);
    expect(effect.parent).toBeNull();
    expect(v.construction.effects).toHaveLength(0);
    v.construction.dispose();
    v.d.disposePrimitives();
  },
);

it('restores a ready site on reload without a celebration and disposes on map close', () => {
  const v = view();
  const town = townFor('settlerDomes', 2);
  v.construction.sync(town);
  const root = v.construction.sites.get('settlerDomes').root;
  v.construction.sync(town);
  expect(v.construction.sites.get('settlerDomes').root).toBe(root);
  expect(v.construction.effects).toHaveLength(0);
  v.construction.dispose();
  expect(root.parent).toBeNull();
  expect(v.scene.children).toHaveLength(0);
  v.d.disposePrimitives();
});

it('shares affordable-upgrade and collect labels without retaining the ready hammer', () => {
  const town = townFor('settlerDomes');
  town.projects = {};
  Object.assign(town.buildings, { ribbonLanding: 1, settlerDomes: 1 });
  town.coins = 1e6;
  expect(buildingIndicators(town).settlerDomes).toBe('upgrade');
  expect(buildingStatusLabel(town, 'settlerDomes', 'upgrade', true)).toBe('Upgrade');
  town.income.stored = 17;
  expect(buildingStatusLabel(town, 'saloon', 'coins')).toBe('Collect 17 coins');
  expect(buildingActionLabel(town, 'blacksmith', 'tnt')).toBe('Collect 1 TNT');
});

it('keeps an upgrade scaffold until completion and also celebrates a future era modernization', () => {
  const v = view();
  const store = useCampaignStore();
  store.town = townFor('settlerDomes', 2);
  store.town.buildings.settlerDomes = 1;
  store.town.projects.settlerDomes.stage = 2;
  v.construction.sync(store.town);
  expect(v.construction.sites.has('settlerDomes')).toBe(true);
  expect(store.finishConstruction('settlerDomes', 2)).toBe(true);
  v.construction.sync(store.town);
  expect(v.construction.sites.has('settlerDomes')).toBe(false);
  expect(v.construction.effects).toHaveLength(1);
  v.construction.update(2);
  // Modernizations keep the base level; their saved finish is the completion signal.
  store.town.buildingEraLevels.settlerDomes = 3;
  v.construction.sync(store.town);
  expect(v.construction.effects).toHaveLength(1);
  v.construction.update(2, true);
  expect(v.construction.effects).toHaveLength(0);
  v.construction.dispose();
  v.d.disposePrimitives();
});

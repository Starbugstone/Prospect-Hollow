import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createTestingTools } from '../src/services/testingTools';
import { useGameStore } from '../src/stores/gameStore';
import { SAVE_KEY } from '../src/services/localProfile';
import { ERAS } from '../src/data/eras';
import { CHAPTERS } from '../src/data/campaign';
import { BUILDINGS, BANDIT_EVENT } from '../src/data/town';
import { eraGate, eraBuildingLevel, plotInEra } from '../src/game/town/TownEras';
import { upgradeOffer } from '../src/game/town/TownRules';

let pinia, saves;
beforeEach(() => {
  pinia = createPinia();
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
});
afterEach(() => {
  useGameStore(pinia).exitLevel();
  vi.unstubAllGlobals();
});

it('adds test resources, caps hammers, and persists without changing buildings or records', () => {
  const campaign = useCampaignStore(pinia);
  const before = JSON.stringify([campaign.town.buildings, campaign.records]);
  expect(createTestingTools(pinia).grant()).toEqual({ coins: 100000, builderHammers: 5 });
  expect(createTestingTools(pinia).grant({ coins: 500, hammers: 100 })).toEqual({
    coins: 100500,
    builderHammers: 5,
  });
  expect(JSON.stringify([campaign.town.buildings, campaign.records])).toBe(before);
  const loaded = useCampaignStore(createPinia());
  expect(loaded.town.coins).toBe(100500);
  expect(loaded.builderHammers).toBe(5);
});
it('rejects invalid amounts before changing the save', () => {
  const grant = createTestingTools(pinia).grant;
  for (const value of [-1, 1.5, Infinity, NaN, '5', Number.MAX_SAFE_INTEGER + 1]) {
    expect(() => grant({ coins: value })).toThrow(TypeError);
    expect(() => grant({ hammers: value })).toThrow(TypeError);
  }
  expect(saves.has(SAVE_KEY)).toBe(false);
});
it('restores balances when storage is unavailable', () => {
  const campaign = useCampaignStore(pinia);
  campaign.town.coins = 25;
  campaign.builderHammers = 1;
  localStorage.setItem = () => {
    throw new Error('Storage full');
  };
  expect(() => createTestingTools(pinia).grant()).toThrow('Balances were restored');
  expect(campaign.town.coins).toBe(25);
  expect(campaign.builderHammers).toBe(1);
});
it('preserves an incompatible save', () => {
  saves.set(SAVE_KEY, JSON.stringify({ schemaVersion: 999 }));
  const saved = saves.get(SAVE_KEY);
  expect(() => createTestingTools(pinia).grant()).toThrow();
  expect(() => createTestingTools(pinia).prepareEra()).toThrow();
  expect(() => createTestingTools(pinia).mineStage(2)).toThrow();
  expect(saves.get(SAVE_KEY)).toBe(saved);
});

it.each(ERAS.filter((era) => era.enabled).map((era) => era.id))(
  'prepares every building in %s, persists, and waits for the normal transition action',
  (era) => {
    const campaign = useCampaignStore(pinia);
    const records = JSON.stringify(campaign.records);
    const powers = JSON.stringify(campaign.powers);
    const result = createTestingTools(pinia).prepareEra(era);
    const next = ERAS[ERAS.findIndex((entry) => entry.id === era) + 1];
    expect(result).toEqual({ era, nextEra: next?.id ?? null, readyToChange: !!next?.enabled });
    expect(campaign.town.era).toBe(era);
    expect(campaign.town.transition?.pending).toBeFalsy();
    const loaded = useCampaignStore(createPinia());
    for (const town of [campaign.town, loaded.town]) {
      expect(eraGate(town).townComplete).toBe(true);
      for (const building of BUILDINGS) {
        expect(town.buildings[building.id]).toBe(
          plotInEra(town, building.id) ? building.upgrades.length : 0,
        );
        if (!plotInEra(town, building.id)) continue;
        expect(upgradeOffer(town, building.id)).toBeNull();
        if (era !== 'frontier') expect(eraBuildingLevel(town, building.id)).toBe(3);
      }
      expect(town.infrastructure.rail).toBe(town.buildings.railDepot);
      expect(town.infrastructure.bridge).toBe(town.buildings.bridge);
    }
    expect(JSON.stringify(campaign.records)).toBe(records);
    expect(JSON.stringify(campaign.powers)).toBe(powers);
    expect(campaign.advanceEra(era)).toBe(!!next?.enabled);
    if (next?.enabled) {
      expect(campaign.town.era).toBe(next.id);
      expect(campaign.town.transition.pending).toBe(true);
    }
  },
);

it('can prepare earlier eras and clears work and presentation gates', () => {
  const cheat = createTestingTools(pinia);
  const campaign = useCampaignStore(pinia);
  cheat.prepareEra('contemporary');
  campaign.town.projects.well = { id: 'well', stage: 1, wins: 0, required: 1 };
  campaign.town.events[BANDIT_EVENT] = {
    id: 1,
    atRun: 0,
    gangSize: 2,
    sheriffLevel: 1,
    loss: 0,
    outcome: 'protected',
    seen: false,
  };
  campaign.town.presentations['railway-opening'] = 'pending';
  campaign.town.transition = {
    id: 'broadcast:contemporary',
    from: 'broadcast',
    to: 'contemporary',
    pending: true,
  };
  cheat.prepareEra('river-rail');
  expect(campaign.town.projects).toEqual({});
  expect(campaign.town.events[BANDIT_EVENT].seen).toBe(true);
  expect(campaign.town.presentations['railway-opening']).toBe('seen');
  expect(campaign.town.transition).toBeUndefined();
  expect(eraGate(campaign.town).available).toBe(true);
  expect(cheat.prepareEra().era).toBe('river-rail');
});

it('rejects unknown eras and active mine runs before writing', () => {
  const cheat = createTestingTools(pinia);
  for (const era of ['unknown', '__proto__', '', 2, {}])
    expect(() => cheat.prepareEra(era)).toThrow(TypeError);
  const campaign = useCampaignStore(pinia);
  campaign.activeRun = { runId: 1, levelId: 1 };
  expect(() => cheat.prepareEra()).toThrow('Exit the mine');
  campaign.activeRun = null;
  useGameStore(pinia).sessionActive = true;
  expect(() => cheat.prepareEra()).toThrow('Exit the mine');
  expect(saves.has(SAVE_KEY)).toBe(false);
});

it('opens a chapter, unlocks preceding levels without payouts and preserves existing scores', () => {
  const campaign = useCampaignStore(pinia);
  campaign.records[1] = { score: 2500, stars: 3, bestTimeMs: 1200 };
  const before = JSON.stringify([campaign.town, campaign.powers, campaign.builderHammers]);
  const result = createTestingTools(pinia).mineStage(12);
  expect(result).toEqual({ chapter: 12, name: CHAPTERS[11].name, level: 67 });
  expect(useGameStore(pinia).currentLevelId).toBe(67);
  expect(useGameStore(pinia).sessionActive).toBe(true);
  expect(campaign.nextLevel).toBe(67);
  expect(campaign.records[1]).toEqual({ score: 2500, stars: 3, bestTimeMs: 1200 });
  expect(Object.keys(campaign.records)).toHaveLength(66);
  expect(campaign.lastChapterReward).toBeNull();
  expect(JSON.stringify([campaign.town, campaign.powers, campaign.builderHammers])).toBe(before);
  expect(useCampaignStore(createPinia()).nextLevel).toBe(67);
});

it('jumps backwards into completed chapters without a museum or deleting records', () => {
  const cheat = createTestingTools(pinia);
  cheat.mineStage(4);
  const campaign = useCampaignStore(pinia);
  const before = JSON.stringify(campaign.records);
  const previousSession = useGameStore(pinia).sessionVersion;
  cheat.mineStage(1);
  expect(useGameStore(pinia).currentLevelId).toBe(1);
  expect(useGameStore(pinia).sessionVersion).toBeGreaterThan(previousSession);
  expect(campaign.canReplay).toBe(false);
  expect(JSON.stringify(campaign.records)).toBe(before);
  // Ordinary gameplay retains the museum requirement.
  expect(useGameStore(pinia).startLevel(1)).toBe(false);
});

it('accepts the final chapter and awards only subsequently played chapter gifts', () => {
  const campaign = useCampaignStore(pinia);
  const chapter = CHAPTERS.length;
  const { level } = createTestingTools(pinia).mineStage(chapter);
  expect(level).toBe((chapter - 1) * 6 + 1);
  expect(campaign.lastChapterReward).toBeNull();
  for (let id = level; id < level + 6; id++)
    campaign.recordVictory({ id, score: 100, target: 1000, combo: 1 });
  expect(campaign.lastChapterReward?.chapter).toBe(chapter);
});

it('rejects invalid chapters before changing progress or the active board', () => {
  const cheat = createTestingTools(pinia);
  cheat.mineStage(2);
  const before = saves.get(SAVE_KEY);
  for (const chapter of [undefined, null, 0, -1, 1.5, Infinity, NaN, '5', CHAPTERS.length + 1])
    expect(() => cheat.mineStage(chapter)).toThrow(TypeError);
  expect(saves.get(SAVE_KEY)).toBe(before);
  expect(useGameStore(pinia).currentLevelId).toBe(7);
});

it('restores the town or unlock records after failed saves and leaves the active board intact', () => {
  const campaign = useCampaignStore(pinia);
  const cheat = createTestingTools(pinia);
  cheat.prepareEra('industrial');
  const townBefore = JSON.stringify(campaign.town);
  const stored = saves.get(SAVE_KEY);
  const originalSave = localStorage.setItem;
  localStorage.setItem = () => {
    throw new Error('Storage full');
  };
  expect(() => cheat.prepareEra('frontier')).toThrow('Previous progress was restored');
  expect(JSON.stringify(campaign.town)).toBe(townBefore);
  expect(saves.get(SAVE_KEY)).toBe(stored);
  localStorage.setItem = originalSave;
  cheat.mineStage(2);
  const recordsBefore = JSON.stringify(campaign.records);
  const boardBefore = JSON.stringify(useGameStore(pinia).board);
  localStorage.setItem = () => {
    throw new Error('Storage full');
  };
  expect(() => cheat.mineStage(8)).toThrow('Previous progress was restored');
  expect(JSON.stringify(campaign.records)).toBe(recordsBefore);
  expect(JSON.stringify(useGameStore(pinia).board)).toBe(boardBefore);
  expect(useGameStore(pinia).currentLevelId).toBe(7);
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { advanceContinuousMoonstones } from '../src/data/moonstones';
import { normalizeTown } from '../src/game/town/TownRules';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

const complete = (campaign, puzzles) => {
  for (let n = 0; n < puzzles; n++) {
    const runId = campaign.beginRun('normal', 1);
    campaign.recordVictory({ id: 1, runId, score: 0, target: 1000, combo: 1 });
  }
};
it('keeps workshop batches beyond ten through normal play and reload/import', () => {
  const c = useCampaignStore();
  c.town.buildings.moonstoneWorkshop = 3;
  c.town.buildings.museum = 1;
  complete(c, 35);
  expect(c.town.moonstoneProduction).toEqual({ stored: 33, progress: 2 });
  c.reloadLocal();
  expect(c.town.moonstoneProduction).toEqual({ stored: 33, progress: 2 });
  c.importSave(c.exportSave());
  expect(c.town.moonstoneProduction).toEqual({ stored: 33, progress: 2 });
});
it('credits continuous gems when workshop stock exceeds its former capacity', () => {
  const c = useCampaignStore();
  c.town.buildings.moonstoneWorkshop = 3;
  c.town.moonstoneProduction = { stored: 33, progress: 2 };
  const { town, gems } = advanceContinuousMoonstones(c.town, 0, 900);
  expect(gems).toBe(900);
  expect(town.moonstoneProduction).toEqual({ stored: 36, progress: 2 });
});
it('accumulates several forge cycles while uncollected and preserves them on reload', () => {
  const c = useCampaignStore();
  c.town.buildings.blacksmith = 1;
  c.town.buildings.museum = 1;
  complete(c, 20);
  expect(c.town.forge).toEqual({ charge: 3, progress: 2 });
  c.reloadLocal();
  expect(c.town.forge).toEqual({ charge: 3, progress: 2 });
});
it('collects only TNT inventory room, retains charge and progress, credits honours and cooldown', () => {
  const c = useCampaignStore();
  c.town.buildings.blacksmith = 1;
  c.town.forge = { charge: 5, progress: 2 };
  const tnt = c.powers.find((p) => p.id === 'tnt');
  tnt.quantity = c.bonusLimit - 2;
  const before = c.honours.counts.forge ?? 0;
  expect(c.canCollectForge(1000)).toBe(true);
  expect(c.collectForgeTNT(1000)).toBe(true);
  expect(c.powers.find((p) => p.id === 'tnt').quantity).toBe(c.bonusLimit);
  expect(c.town.forge).toEqual({ charge: 3, progress: 2 });
  expect(c.honours.counts.forge).toBe(before + 2);
  c.powers.find((p) => p.id === 'tnt').quantity--;
  expect(c.collectForgeTNT(30999)).toBe(false);
  expect(c.collectForgeTNT(31000)).toBe(true);
  expect(normalizeTown(c.town).forge).toEqual({ charge: 2, progress: 2 });
});

it('rolls back a partial forge collection and honours when saving fails', () => {
  const c = useCampaignStore();
  c.town.buildings.blacksmith = 1;
  c.town.forge = { charge: 5, progress: 2 };
  c.powers.find((p) => p.id === 'tnt').quantity = c.bonusLimit - 2;
  const before = JSON.parse(JSON.stringify(c.profile()));
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('disk full');
  });
  expect(c.collectForgeTNT(1000)).toBe(false);
  expect(c.profile()).toEqual(before);
});
it('journals score-only continuous improvements after coin and workshop allowances are used', () => {
  const c = useCampaignStore();
  c.town.buildings.museum = 1;
  c.town.buildings.moonstoneWorkshop = 3;
  const runId = c.beginRun('continuous', 1);
  expect(c.recordContinuous({ id: 1, runId, jewels: 900, score: 100 })).toBe(true);
  const receipts = c.integrity.actions.length;
  expect(c.recordContinuous({ id: 1, runId, jewels: 900, score: 200 })).toBe(true);
  expect(c.integrity.actions).toHaveLength(receipts + 1);
  expect(c.integrity.actions.at(-1)).toMatchObject({ kind: 'continuous', data: { score: 200 } });
  expect(c.recordContinuous({ id: 1, runId, jewels: 900, score: 200 })).toBe(true);
  expect(c.integrity.actions).toHaveLength(receipts + 1);
});

it('never recovers unbuilt-workshop gems after construction during the same continuous run', () => {
  const c = useCampaignStore();
  c.town.era = 'twin-hollows';
  c.town.buildings.museum = 1;
  const runId = c.beginRun('continuous', 1);
  expect(c.recordContinuous({ id: 1, runId, jewels: 250, score: 100 })).toBe(true);
  expect(c.recordContinuous({ id: 1, runId, jewels: 750, score: 100 })).toBe(true);
  expect(c.continuousRecords[1].moonstoneGems ?? 0).toBe(0);
  c.town.buildings.moonstoneWorkshop = 1;
  expect(c.recordContinuous({ id: 1, runId, jewels: 1050, score: 100 })).toBe(true);
  expect(c.continuousRecords[1].moonstoneGems).toBe(300);
  expect(c.town.moonstoneProduction).toEqual({ stored: 0, progress: 1 });
});

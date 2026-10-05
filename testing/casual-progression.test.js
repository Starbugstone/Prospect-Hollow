import { LEVEL_COUNT } from '../src/data/campaign';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { chapterGift, journeyProgress } from '../src/data/journey';
import { chestRewardFits, rollChestReward } from '../src/data/rewards';
import { GUEST_JOURNAL_LIMIT } from '../src/services/saveIntegrity';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const finish = (campaign, id, extra = {}) =>
  campaign.recordVictory({
    id,
    runId: campaign.beginRun('normal', id),
    score: 1,
    target: 6000,
    combo: 1,
    elapsedMs: 600000,
    speedTargetMs: 60000,
    ...extra,
  });

it('gives a slow low-score player one chest and saves its unopened reward exactly once', () => {
  vi.spyOn(Math, 'random').mockReturnValue(0.8);
  let c = useCampaignStore();
  const chests = finish(c, 1, { chooseRewards: true });
  expect(chests.map((chest) => chest.source)).toEqual(['completion']);
  expect(c.town.coins).toBe(0);
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.town.coins).toBe(500);
  expect(c.pendingChests).toEqual([]);
  setActivePinia(createPinia());
  expect(useCampaignStore().town.coins).toBe(500);
});

it('uses an existing qualifying chest instead of adding another opening', () => {
  const c = useCampaignStore();
  expect(finish(c, 1, { elapsedMs: 1000 }).map((chest) => chest.source)).toEqual(['speed']);
  expect(finish(c, 2, { score: 6000 }).map((chest) => chest.source)).toEqual(['score']);
  expect(finish(c, 3, { score: 6000, elapsedMs: 1000 }).map((chest) => chest.source)).toEqual([
    'score',
    'speed',
  ]);
});

// Replays and reloads every campaign level, so its cost grows with each new chapter.
it(
  'awards every chapter gift once through the full campaign, directly with no extra chest',
  {
    timeout: 15000,
  },
  () => {
    let c = useCampaignStore();
    for (let id = 1; id <= LEVEL_COUNT; id++) {
      const chests = finish(c, id);
      expect(chests).toHaveLength(1);
      if (id % 6 === 0) {
        expect(c.lastChapterReward.chapter).toBe(id / 6);
        expect(c.lastChapterReward.gift.quantity).toBeGreaterThan(0);
        expect(c.mineStage).toBe(id / 6);
      } else expect(c.lastChapterReward).toBeNull();
      c.save();
      setActivePinia(createPinia());
      c = useCampaignStore();
    }
    expect(journeyProgress(c.records)).toBeNull();
    // A guest journal stays bounded, while its sequence still counts every receipt once.
    const { actions, baseSequence } = c.integrity;
    expect(actions.length).toBeLessThanOrEqual(GUEST_JOURNAL_LIMIT);
    expect(baseSequence + actions.length).toBe(LEVEL_COUNT * 2);
    expect(actions.map((action) => action.sequence)).toEqual(
      actions.map((_, index) => baseSequence + index + 1),
    );
    expect(new Set(actions.map((action) => action.id)).size).toBe(actions.length);
    expect(actions[0].kind).toBe('run-start');
    expect(actions.at(-1)).toMatchObject({
      sequence: LEVEL_COUNT * 2,
      kind: 'victory',
      data: { levelId: LEVEL_COUNT },
    });
    c.town.buildings.museum = 1;
    finish(c, LEVEL_COUNT);
    expect(c.lastChapterReward).toBeNull();
  },
);

it('shows an honest six-puzzle trail and gives useful chapter coins when its bonus is full', () => {
  const c = useCampaignStore();
  for (let id = 1; id <= 5; id++) c.records[id] = { score: 1, stars: 1 };
  expect(journeyProgress(c.records)).toMatchObject({
    chapter: 1,
    remaining: 1,
    gift: chapterGift(1),
  });
  c.powers.find((power) => power.id === 'tnt').quantity = c.bonusLimit;
  finish(c, 6);
  expect(c.lastChapterReward.gift).toMatchObject({
    kind: 'coins',
    quantity: 100,
    convertedFrom: 'TNT',
  });
  expect(journeyProgress(c.records)).toMatchObject({ chapter: 2, remaining: 6 });
});

it('reserves pending rewards when selecting automatic prizes and avoids full storage', () => {
  const c = useCampaignStore();
  for (const power of c.powers) power.quantity = c.bonusLimit;
  c.builderHammers = 5;
  expect(rollChestReward(() => 0, c).id).toBe('coins');
  const row = c.powers[0];
  row.quantity--;
  expect(rollChestReward(() => 0, c).id).toBe(row.id);
  c.pendingChests = [{ items: [{ id: row.id }] }];
  expect(chestRewardFits(c, { id: row.id, kind: 'power' })).toBe(false);
  expect(rollChestReward(() => 0, c).id).toBe('coins');
});

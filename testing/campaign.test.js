import * as chestRewards from '../src/data/rewards';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { useGameStore } from '../src/stores/gameStore';
import { useCampaignStore, freshProfile, SAVE_KEY } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { LEVEL_COUNT, scoreChestEarned } from '../src/data/campaign';
import { localProfile } from '../src/services/localProfile';
import { townStorage } from '../src/services/townStorage';
import { createSyncService } from '../src/services/syncService';

let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    get length() {
      return saved.size;
    },
    key: (index) => [...saved.keys()][index] ?? null,
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  });
  setActivePinia(createPinia());
  vi.spyOn(chestRewards, 'rollChestReward').mockReturnValue({
    id: 'coins',
    kind: 'coins',
    label: 'Coins',
    quantity: 500,
  });
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it('keeps view replacement income hooks from writing or reporting a storage failure', () => {
  const campaign = useCampaignStore();
  campaign.save();
  const before = saved.get(SAVE_KEY);
  const release = localProfile.suspendWrites();
  try {
    campaign.reloadLocal();
    campaign.accrueSaloonIncome(Date.now() + 1000);
    expect(saved.get(SAVE_KEY)).toBe(before);
    expect(campaign.saveWarning).toBe('');
    expect(campaign.save()).toBe(false);
  } finally {
    release();
  }
  expect(campaign.save()).toBe(true);
  expect(saved.get(SAVE_KEY)).not.toBe(before);
});

it('claims an unopened chest once during a paused reload and saves it when writes resume', () => {
  const campaign = useCampaignStore();
  const runId = campaign.beginRun('normal', 1);
  campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    jewels: 10,
    chooseRewards: true,
  });
  expect(campaign.pendingChests).toHaveLength(1);
  const coins = campaign.town.coins;
  const stored = saved.get(SAVE_KEY);
  const claims = (profile) =>
    profile.integrity.actions.filter((action) => action.kind === 'chest-claim');
  // A view reload applying a synced save that holds the chest still unopened.
  const release = localProfile.suspendWrites();
  try {
    campaign.reloadLocal();
    expect(campaign.saveWarning).toBe('');
    expect(campaign.pendingChests).toEqual([]);
    expect(campaign.town.coins).toBe(coins + 500);
    expect(saved.get(SAVE_KEY)).toBe(stored);
  } finally {
    release();
  }
  const profile = JSON.parse(saved.get(SAVE_KEY));
  expect(profile.pendingChests).toEqual([]);
  expect(profile.town.coins).toBe(coins + 500);
  expect(claims(profile)).toHaveLength(1);
  expect(campaign.saveWarning).toBe('');
  // The stored claim is final: loading it again pays nothing more.
  campaign.reloadLocal();
  expect(campaign.town.coins).toBe(coins + 500);
  expect(claims(JSON.parse(saved.get(SAVE_KEY)))).toHaveLength(1);
});

const chestClaims = (integrity, id) =>
  integrity.actions.filter((action) => action.kind === 'chest-claim' && action.data.chestId === id);

it('keeps a receipt refresh from claiming a chest the player is still opening', () => {
  const campaign = useCampaignStore();
  const runId = campaign.beginRun('normal', 1);
  const [chest] = campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    jewels: 10,
    chooseRewards: true,
  });
  const coins = campaign.town.coins;
  const stored = saved.get(SAVE_KEY);
  // A sync stored a copy with this game's progress and the chest unopened.
  campaign.reloadLocal({ integrityOnly: true });
  expect(saved.get(SAVE_KEY)).toBe(stored);
  expect(campaign.pendingChests.map((entry) => entry.id)).toEqual([chest.id]);
  expect(chestClaims(campaign.integrity, chest.id)).toEqual([]);
  // Opening it claims the rolled prize once, with one receipt.
  expect(campaign.claimChest(chest.id, chest.items[0].id)).toMatchObject({ quantity: 500 });
  const profile = JSON.parse(saved.get(SAVE_KEY));
  expect(profile.pendingChests).toEqual([]);
  expect(profile.town.coins).toBe(coins + 500);
  expect(chestClaims(profile.integrity, chest.id)).toHaveLength(1);
  campaign.reloadLocal();
  expect(campaign.town.coins).toBe(coins + 500);
  expect(chestClaims(campaign.integrity, chest.id)).toHaveLength(1);
});

it('still records the claim when a receipt refresh meets a chest a paused reload already paid', () => {
  const campaign = useCampaignStore();
  const runId = campaign.beginRun('normal', 1);
  const [chest] = campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    jewels: 10,
    chooseRewards: true,
  });
  const coins = campaign.town.coins;
  const release = localProfile.suspendWrites();
  try {
    // The reload pays the chest in memory; storage keeps it unopened until writes resume.
    campaign.reloadLocal();
    campaign.reloadLocal({ integrityOnly: true });
    expect(campaign.town.coins).toBe(coins + 500);
    expect(chestClaims(campaign.integrity, chest.id)).toHaveLength(1);
  } finally {
    release();
  }
  const profile = JSON.parse(saved.get(SAVE_KEY));
  expect(profile.pendingChests).toEqual([]);
  expect(profile.town.coins).toBe(coins + 500);
  expect(chestClaims(profile.integrity, chest.id)).toHaveLength(1);
});

it('never refreshes receipts during a victory reveal, so a synced chest is claimed and uploaded once', async () => {
  townStorage.save(freshProfile());
  const owner = { id: 'chest-owner' };
  townStorage.account(owner);
  let remote = {
    townId: townStorage.active().meta.id,
    name: 'Chest Creek',
    revision: 1,
    updatedAt: 100,
    profile: townStorage.active().profile,
    isPublic: false,
    publicId: 'chest-creek',
  };
  townStorage.attach(remote, owner.id, townStorage.active().meta.sequence);
  const game = useGameStore();
  const campaign = useCampaignStore();
  const outbox = new Map();
  const uploaded = [];
  const request = vi.fn(async (_path, body) => {
    if (body) {
      uploaded.push(structuredClone(body.profile));
      const { integrity } = body.profile;
      const ackSequence = integrity.actions.at(-1)?.sequence ?? integrity.baseSequence;
      remote = {
        ...remote,
        revision: remote.revision + 1,
        profile: {
          ...body.profile,
          integrity: { ...integrity, baseSequence: ackSequence, actions: [] },
        },
        integrity: { version: 1, epoch: integrity.epoch, ackSequence, status: 'tracked' },
      };
    }
    return structuredClone(remote);
  });
  // Wired as CloudRoot.vue wires the cloud sync to this town's live game.
  const refresh = vi.fn((id) => {
    if (townStorage.activeMeta()?.id === id) campaign.reloadLocal({ integrityOnly: true });
  });
  const applied = vi.fn((id) => {
    if (townStorage.activeMeta().id !== id) return;
    const resume = localProfile.suspendWrites();
    try {
      game.exitLevel();
      campaign.reloadLocal();
    } finally {
      resume();
    }
  });
  const sync = createSyncService({
    storage: townStorage,
    request,
    account: () => owner,
    recoveries: {
      put: async () => {},
      putUpload: async (value) => outbox.set(value.id, structuredClone(value)),
      getUpload: async (id) => structuredClone(outbox.get(id)),
      removeUpload: async (id) => outbox.delete(id),
    },
    canApply: (id) => townStorage.activeMeta().id !== id || !game.sessionActive,
    integrityApplied: refresh,
    applied,
  });
  game.bootstrap();
  game.startLevel(1);
  game.remainingLayers = 0;
  game.completeLevel();
  const [chest] = campaign.pendingChests;
  const coins = campaign.town.coins;
  expect(townStorage.active().profile.pendingChests.map((entry) => entry.id)).toEqual([chest.id]);
  // The victory uploads, then the cloud copy moves on with this device's progress and the
  // chest still unopened (renamed elsewhere). The reveal is part of the running mine, so
  // the sync waits instead of replacing the save or refreshing its receipts.
  await sync.sync();
  remote = { ...remote, revision: remote.revision + 1, name: 'Renamed elsewhere' };
  delete remote.integrity;
  await sync.sync();
  expect(refresh).not.toHaveBeenCalled();
  expect(applied).not.toHaveBeenCalled();
  expect(townStorage.active().meta.baseRevision).toBe(remote.revision - 1);
  expect(campaign.claimChest(chest.id, chest.items[0].id)).toMatchObject({ quantity: 500 });
  expect(chestClaims(campaign.integrity, chest.id)).toHaveLength(1);
  expect(chestClaims(townStorage.active().profile.integrity, chest.id)).toHaveLength(1);
  // Back in the village the newer cloud copy loads, and the chest it holds is claimed once.
  game.exitLevel();
  await sync.sync();
  await sync.sync();
  expect(refresh).not.toHaveBeenCalled();
  expect(applied).toHaveBeenCalledOnce();
  const last = uploaded.at(-1);
  expect(last.pendingChests).toEqual([]);
  expect(last.town.coins).toBe(coins + 500);
  expect(chestClaims(last.integrity, chest.id)).toHaveLength(1);
  expect(uploaded.flatMap((profile) => chestClaims(profile.integrity, chest.id))).toHaveLength(1);
  expect(townStorage.active().meta.dirty).toBe(false);
});

it('stages obstacles while leaving a lighter fifth puzzle in every chapter', () => {
  const levels = generateLevelConfigs();
  expect(levels).toHaveLength(LEVEL_COUNT);
  for (let start = 0; start < levels.length; start += 6) {
    const chapter = levels.slice(start, start + 6);
    // From level 403 many goals are cargo, lanterns or orders rather than layers, so
    // the measured chest target (from 30 simulated runs) stands for the workload.
    const workload = chapter.map((level) =>
      level.id > 402 ? level.chestTarget : level.objectives[0].target,
    );
    expect(workload[4]).toBeLessThan(workload[3]);
    expect(workload[5]).toBeGreaterThan(workload[4]);
    expect(chapter[4].chestTarget).toBeLessThan(chapter[3].chestTarget);
    if (start)
      expect(workload[0]).toBeLessThan(
        levels[start - 1].id > 402 || start === 402
          ? levels[start - 1].chestTarget
          : levels[start - 1].objectives[0].target,
      );
  }
  for (const level of levels.slice(0, 36)) {
    const blockers = level.tiles.filter((tile) => tile.type === 'blocker');
    expect(blockers.length > 0).toBe(level.id >= 7);
    expect(blockers.some((tile) => tile.health === 2)).toBe(
      level.id >= 19 && level.pace !== 'rest',
    );
    expect(level.tiles.some((tile) => tile.state === 'FROZEN')).toBe(level.id >= 31);
    level.tiles.forEach((tile, i) => expect(level.board[i] === null).toBe(tile.type === 'blocker'));
  }
});

it('gives the four-color opening enough ice to play and keeps the first two chapters single-layered', () => {
  const levels = generateLevelConfigs();
  expect(levels[0].objectives[0].target).toBe(32);
  for (const level of levels.slice(0, 12)) {
    level.tiles.forEach((tile) => {
      expect(tile.health).toBeLessThanOrEqual(1);
    });
  }
  for (const level of levels) expect(level.tiles.every((tile) => tile.health <= 2)).toBe(true);
});
it('enforces sequential unlocks in the game action, saves completion and awards only once', () => {
  const game = useGameStore();
  const campaign = useCampaignStore();
  game.bootstrap();
  expect(game.startLevel(3)).toBe(false);
  expect(game.sessionActive).toBe(false);
  game.startLevel(1);
  game.score = game.objectives.find((objective) => objective.type === 'score').target;
  game.completeLevel();
  expect(campaign.completedCount).toBe(0);
  game.remainingLayers = 0;
  game.completeLevel();
  expect(campaign.nextLevel).toBe(2);
  expect(game.levelRewards[0].items).toHaveLength(1);
  const powers = campaign.powers.reduce((sum, power) => sum + power.quantity, 0);
  game.completeLevel();
  expect(campaign.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(powers);
  setActivePinia(createPinia());
  expect(useCampaignStore().nextLevel).toBe(2);
  expect(useCampaignStore().powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(powers);
});
it('continues to unfinished levels before replaying mines with fewer than three stars', () => {
  const campaign = useCampaignStore();
  expect(campaign.nextMiningLevel).toBe(1);
  campaign.town.buildings.museum = 1;
  campaign.records[1] = { score: 100, stars: 1 };
  expect(campaign.nextMiningLevel).toBe(2);
});

it('continues a completed campaign at the lowest mine without three stars and keeps all mines unlocked', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.museum = 1;
  campaign.records = Object.fromEntries(
    Array.from({ length: LEVEL_COUNT }, (_, i) => [i + 1, { score: 12000, stars: 3 }]),
  );
  campaign.records[2] = { score: 6000, stars: 2 };
  campaign.records[5] = { score: 100, stars: 1 };
  expect(campaign.nextMiningLevel).toBe(2);
  expect(campaign.canPlay(LEVEL_COUNT)).toBe(true);

  const game = useGameStore();
  game.bootstrap();
  expect(game.startLevel(campaign.nextMiningLevel)).toBe(true);
  expect(game.currentLevelId).toBe(2);

  campaign.recordVictory({ id: 2, score: 100, target: 6000, combo: 1 });
  expect(campaign.nextMiningLevel).toBe(2);
  campaign.recordVictory({ id: 2, score: 12000, target: 6000, combo: 1 });
  expect(campaign.nextMiningLevel).toBe(5);
  campaign.recordVictory({ id: 5, score: 12000, target: 6000, combo: 1 });
  expect(campaign.nextMiningLevel).toBeNull();
});

it('requires the museum to continue replaying a completed campaign', () => {
  const campaign = useCampaignStore();
  campaign.records = Object.fromEntries(
    Array.from({ length: LEVEL_COUNT }, (_, i) => [i + 1, { score: 100, stars: 1 }]),
  );
  expect(campaign.nextMiningLevel).toBeNull();
  campaign.town.buildings.museum = 1;
  expect(campaign.nextMiningLevel).toBe(1);
});

it.each([
  [5999, 1],
  [6000, 1],
  [8999, 1],
  [9000, 1],
  [12000, 1],
])('awards the correct chest at score %i', (score, count) => {
  const campaign = useCampaignStore();
  const reward = campaign.recordVictory({ id: 1, score, target: 6000, combo: 1 });
  expect(reward[0]?.items.length ?? 0).toBe(count);
  expect(campaign.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
  expect(campaign.town.coins).toBe(count * 500);
  expect(scoreChestEarned(score, 0)).toBe(false);
});
it('keeps the best score and stars on replay, and saves used powers', () => {
  const campaign = useCampaignStore();
  campaign.recordVictory({ id: 1, score: 12000, target: 6000, combo: 4 });
  campaign.recordVictory({ id: 1, score: 100, target: 6000, combo: 1 });
  expect(campaign.records[1]).toEqual({ score: 12000, stars: 3 });
  const inventory = useInventoryStore();
  campaign.awardReward({ id: 'tnt', label: 'TNT', kind: 'power', quantity: 1 });
  const before = inventory.quickAccessSlots.find((power) => power.id === 'tnt').quantity;
  inventory.consumeItem('tnt');
  setActivePinia(createPinia());
  expect(useInventoryStore().quickAccessSlots.find((power) => power.id === 'tnt').quantity).toBe(
    before - 1,
  );
});
it('recovers from malformed saves and unavailable storage', () => {
  saved.set(SAVE_KEY, '{broken');
  expect(useCampaignStore().nextLevel).toBe(1);
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('blocked');
    },
    setItem: () => {
      throw new Error('blocked');
    },
  });
  setActivePinia(createPinia());
  expect(() =>
    useCampaignStore().recordVictory({ id: 1, score: 6000, target: 6000, combo: 1 }),
  ).not.toThrow();
});

it('makes one weighted roll per earned chest and saves exactly those awards', () => {
  chestRewards.rollChestReward.mockRestore();
  const random = vi.spyOn(Math, 'random').mockReturnValueOnce(0.1).mockReturnValueOnce(0.7);
  const campaign = useCampaignStore();
  const rewards = campaign.recordVictory({
    id: 1,
    score: 999999,
    target: 6000,
    combo: 4,
    elapsedMs: 1,
    speedTargetMs: 60000,
  });
  expect(random).toHaveBeenCalledTimes(2);
  expect(rewards.map((reward) => reward.items)).toEqual([
    [{ id: 'clear-row', kind: 'power', label: 'Clear Row', quantity: 1, overflowCoins: 0 }],
    [{ id: 'coins', kind: 'coins', label: 'Coins', quantity: 500, overflowCoins: 0 }],
  ]);
  expect(rewards.every((reward) => reward.count === 1)).toBe(true);
  setActivePinia(createPinia());
  expect(useCampaignStore().powers.map((power) => power.quantity)).toEqual([1, 0, 0, 0, 0]);
});

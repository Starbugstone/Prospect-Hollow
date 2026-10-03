import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, toRaw } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import {
  awardHonour,
  createHonours,
  creditRun,
  levelElements,
  maxPowerCapacity,
  pendingAnnouncements,
} from '../src/data/honours';
import { levelHonourElements } from '../src/data/honourLevels';
import { ERAS } from '../src/data/eras';
import { BANDIT_EVENT } from '../src/data/town';
import { eraEventKind } from '../src/data/townEvents';
import { POWERS } from '../src/data/campaign';
import * as rewards from '../src/data/rewards';
import { GEM_TYPES, createGem } from '../src/game/engine/GemFactory';
import { HintEngine } from '../src/game/engine/HintEngine';
import { levelConfig } from '../src/game/engine/LevelGenerator';
import { eraGate } from '../src/game/town/TownEras';
import { createLocalIntegrityPlugin } from '../src/services/localIntegrity';
import { localProfile } from '../src/services/localProfile';
import { createSyncService } from '../src/services/syncService';
import { createTestingTools } from '../src/services/testingTools';
import { townStorage } from '../src/services/townStorage';
import { SAVE_KEY, freshProfile, useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

const { backups, outbox } = vi.hoisted(() => ({ backups: new Map(), outbox: new Map() }));
vi.mock('../src/services/recoveryStore', () => ({
  recoveryStore: {
    putUpload: vi.fn(async (value) => outbox.set(value.id, structuredClone(value))),
    getUpload: vi.fn(async (id, owner, townId) => {
      const value = outbox.get(id);
      return value?.owner === owner && value?.townId === townId ? structuredClone(value) : null;
    }),
    removeUpload: vi.fn(async (id) => outbox.delete(id)),
    put: vi.fn(async (value) => backups.set(value.id, structuredClone(value))),
    get: vi.fn(async (id, owner, townId) => {
      const value = backups.get(id);
      return value?.owner === owner && value?.townId === townId ? structuredClone(value) : null;
    }),
  },
}));

let values, pinia, games;
beforeEach(() => {
  values = new Map();
  backups.clear();
  outbox.clear();
  games = [];
  vi.stubGlobal('localStorage', {
    get length() {
      return values.size;
    },
    key: (index) => [...values.keys()][index] ?? null,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  pinia = createPinia();
  setActivePinia(pinia);
});
afterEach(() => {
  for (const game of games) game.cancelHint(true);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

// A stored profile, opened by an ordinary store or the production mutation guard.
function open(profile = freshProfile(), { guarded = false } = {}) {
  values.set(SAVE_KEY, JSON.stringify(profile));
  pinia = createPinia();
  if (guarded) {
    pinia.use(createLocalIntegrityPlugin());
    createApp({}).use(pinia);
  }
  setActivePinia(pinia);
  return useCampaignStore(pinia);
}
const gameStore = () => {
  const game = useGameStore(pinia);
  games.push(game);
  game.bootstrap();
  return game;
};
const counts = () => toRaw(useCampaignStore(pinia).honours.counts);
const stored = () => JSON.parse(values.get(SAVE_KEY)).honours;
const tnt = (campaign) => campaign.powers.find((power) => power.id === 'tnt').quantity;
const victory = (campaign, { id = 1, ...options } = {}) =>
  campaign.recordVictory({
    id,
    runId: campaign.beginRun('normal', id),
    score: 100,
    target: 6000,
    combo: 1,
    ...options,
  });
// Gems in committed resolutions: ordinary moves, or only the free rescue sweep.
function committedGems(spy, { recovery = false } = {}) {
  const gems = {};
  for (const [resolution] of spy.mock.calls) {
    if (!!resolution.recovery !== recovery) continue;
    for (const step of resolution.steps)
      for (const jewel of step.collectedJewels ?? [])
        if (GEM_TYPES.includes(jewel.type)) gems[jewel.type] = (gems[jewel.type] ?? 0) + 1;
  }
  return gems;
}
const total = (gems) => Object.values(gems).reduce((sum, count) => sum + count, 0);
async function swap(game) {
  const hint = new HintEngine().findBestMove(
    game.board,
    game.tiles,
    game.boardCols,
    game.boardRows,
  );
  expect(await game.resolveSwap(hint.swap.aIndex, hint.swap.bIndex)).toBe(true);
}
// The same gems rearranged so the first row opens with a three-gem match.
function boardWithMatch(board) {
  const next = [...board];
  const type = next[3].type;
  for (const target of [0, 1, 2]) {
    if (next[target].type === type) continue;
    const source = next.findIndex((gem, index) => index > 2 && gem?.type === type);
    [next[target], next[source]] = [next[source], next[target]];
  }
  return next;
}
function protectedRaid(campaign, overrides = {}) {
  campaign.town.completedRuns = 10;
  campaign.town.events[BANDIT_EVENT] = {
    id: 1,
    atRun: 10,
    gangSize: 10,
    sheriffLevel: 3,
    bankLevel: 3,
    targets: ['mine'],
    outcome: 'protected',
    loss: 0,
    seen: false,
    ...overrides,
  };
}

describe('The run tally', () => {
  it('counts committed swaps, powers and post-shuffle matches, never the rescue sweep', async () => {
    const game = gameStore();
    expect(game.startLevel(1)).toBe(true);
    const committed = vi.spyOn(game, 'commitResolution');
    await swap(game);
    const afterSwap = total(game.honourTally.gems);
    expect(afterSwap).toBeGreaterThan(0);
    expect(game.honourTally.gems).toEqual(committedGems(committed));

    expect(await game.activateOneTimeBonus('tnt')).toBe(true);
    const afterPower = total(game.honourTally.gems);
    expect(afterPower).toBeGreaterThan(afterSwap);

    expect(await game.shuffleBoard({ recoveryBoard: boardWithMatch(game.board) })).toBe(true);
    expect(total(game.honourTally.gems)).toBeGreaterThan(afterPower);
    expect(game.honourTally.gems).toEqual(committedGems(committed));

    // The free rescue sweep clears the whole board; none of it is counted.
    expect(await game._activatePower('recovery_sweep', 0)).toBe(true);
    expect(total(committedGems(committed, { recovery: true }))).toBeGreaterThan(0);
    expect(game.honourTally.gems).toEqual(committedGems(committed));
    expect(game.collectedJewels).toBeGreaterThan(total(game.honourTally.gems));
    if (!game.levelCleared) {
      game.remainingLayers = 0;
      game.completeLevel();
    }
    expect(game.levelCleared).toBe(true);
    expect(counts().gems).toEqual(committedGems(committed));
  }, 20000);

  it('records real fusion keys from committed steps and skips recovery resolutions', () => {
    const game = gameStore();
    game.startLevel(1);
    const resolution = (recovery) => ({
      board: game.board,
      steps: [{ collectedJewels: [], bonusFusion: { key: 'bomb+cross' } }],
      layersCleared: 0,
      recovery,
    });
    game.commitResolution(resolution(true));
    expect(game.honourTally.fusions).toEqual([]);
    game.commitResolution(resolution(false));
    game.commitResolution(resolution(false));
    expect(game.honourTally.fusions).toEqual(['bomb+cross']);
  });

  it('credits nothing for continuous play or a puzzle left unfinished', async () => {
    const profile = freshProfile();
    profile.records[1] = { score: 10, stars: 1 };
    profile.town.buildings.museum = 1;
    const campaign = open(profile);
    const game = gameStore();
    expect(game.startLevel(1, 'continuous')).toBe(true);
    await swap(game);
    expect(game.collectedJewels).toBeGreaterThan(0);
    expect(game.honourTally).toEqual({ gems: {}, fusions: [], mine: {} });
    game.remainingLayers = 0;
    game.completeLevel();
    game.exitLevel();

    expect(game.startLevel(1)).toBe(true);
    await swap(game);
    expect(total(game.honourTally.gems)).toBeGreaterThan(0);
    game.exitLevel();
    expect(game.honourTally).toEqual({ gems: {}, fusions: [], mine: {} });
    expect(game.startLevel(1)).toBe(true);
    game.remainingLayers = 0;
    game.completeLevel();
    expect(game.levelCleared).toBe(true);
    expect(campaign.honours.counts).toEqual(createHonours().counts);
  });
});

describe('The town handoff', () => {
  function transfer(game, edit = (snapshot) => snapshot) {
    const snapshot = edit(game.captureHandoff());
    expect(useCampaignStore(pinia).save()).toBe(true);
    townStorage.handoff(snapshot);
    const resume = localProfile.suspendWrites();
    game.exitLevel();
    resume();
    pinia = createPinia();
    setActivePinia(pinia);
    useCampaignStore(pinia);
    const next = gameStore();
    next.restoreHandoff(townStorage.handoff());
    townStorage.handoff(null);
    return next;
  }

  it('carries the tally to the new window and credits it once at victory', async () => {
    const game = gameStore();
    game.startLevel(1);
    await swap(game);
    const tally = JSON.parse(JSON.stringify(game.honourTally));
    expect(total(tally.gems)).toBeGreaterThan(0);
    const next = transfer(game);
    expect(next.honourTally).toEqual(tally);
    next.remainingLayers = 0;
    next.completeLevel();
    expect(counts().gems).toEqual(tally.gems);
    next.completeLevel();
    expect(counts().gems).toEqual(tally.gems);
  });

  it('restores an older snapshot without a tally as an empty one', async () => {
    const game = gameStore();
    game.startLevel(1);
    await swap(game);
    const next = transfer(game, (snapshot) => {
      delete snapshot.state.honourTally;
      return snapshot;
    });
    expect(next.sessionActive).toBe(true);
    expect(next.honourTally).toEqual({ gems: {}, fusions: [], mine: {} });
    const damaged = transfer(next, (snapshot) => {
      snapshot.state.honourTally = { gems: { ruby: -4, topaz: 2 }, fusions: ['constructor', 7] };
      return snapshot;
    });
    expect(damaged.honourTally).toEqual({ gems: { topaz: 2 }, fusions: [], mine: {} });
  });
});

describe('Crediting a victory', () => {
  const tally = { gems: { ruby: 5 }, fusions: ['bomb+cross'], mine: { relics: 2 } };

  it('credits a settled normal victory exactly once and keeps it out of the receipt', () => {
    const campaign = useCampaignStore();
    const runId = campaign.beginRun('normal', 1);
    const finish = () =>
      campaign.recordVictory({ id: 1, runId, score: 100, target: 6000, combo: 1, tally });
    expect(finish()).not.toEqual([]);
    expect(finish()).toEqual([]);
    expect(counts()).toEqual({ gems: { ruby: 5 }, forge: 0, mine: { relics: 2 } });
    expect(campaign.honours.fusions).toEqual(['bomb+cross']);
    expect(JSON.stringify(campaign.integrity.actions.at(-1))).not.toMatch(/ruby|relics|tally/);
    expect(stored().counts.gems.ruby).toBe(5);
    expect(campaign.honours.earned['first-fusion']).toBeTruthy();

    const stale = campaign.beginRun('normal', 1);
    campaign.beginRun('normal', 1);
    expect(
      campaign.recordVictory({ id: 1, runId: stale, score: 1, target: 1, combo: 1, tally }),
    ).toEqual([]);
    expect(counts().gems.ruby).toBe(5);
  });

  it('never credits a continuous run', () => {
    const profile = freshProfile();
    profile.records[1] = { score: 10, stars: 1 };
    profile.town.buildings.museum = 1;
    const campaign = open(profile);
    const runId = campaign.beginRun('continuous', 1);
    campaign.recordVictory({ id: 1, runId, score: 100, target: 6000, combo: 1, tally });
    expect(counts()).toEqual(createHonours().counts);
  });

  it('credits mine elements from the completed level configuration, replays included', () => {
    const profile = freshProfile();
    for (let id = 1; id < 249; id++) profile.records[id] = { score: 1, stars: 1 };
    const campaign = open(profile);
    const game = gameStore();
    const complete = () => {
      expect(game.startLevel(249)).toBe(true);
      game.board = game.board.map((gem) => (gem?.type === 'relic' ? createGem('ruby') : gem));
      game.oreOrders = game.oreOrders.map((order) => ({ ...order, progress: order.target }));
      game.remainingLayers = 0;
      game.completeLevel();
      expect(game.levelCleared).toBe(true);
      game.exitLevel();
    };
    complete();
    expect(levelElements(levelConfig(249))).toEqual({ relics: 2, lanterns: 3 });
    expect(counts().mine).toEqual(levelHonourElements(249));
    campaign.town.buildings.museum = 1;
    complete();
    expect(counts().mine).toEqual({ relics: 4, lanterns: 6 });
  });

  it('completes and credits a puzzle after more than 100 moves and the speed target', async () => {
    const campaign = useCampaignStore();
    const game = gameStore();
    game.startLevel(1);
    game.moves = 100;
    game.playClock.elapsed = game.speedTargetMs + 60000;
    game.playClock.started = true;
    await swap(game);
    expect(game.moves).toBe(101);
    expect(game.sessionActive).toBe(true);
    const gems = { ...game.honourTally.gems };
    game.remainingLayers = 0;
    game.completeLevel();
    expect(game.levelCleared).toBe(true);
    expect(campaign.nextLevel).toBe(2);
    expect(counts().gems).toEqual(gems);
  });
});

describe('Evaluation at save', () => {
  it('keeps no new honour when the save fails or the profile is read-only', () => {
    const campaign = useCampaignStore();
    expect(campaign.save()).toBe(true);
    const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    victory(campaign, { score: 1e6, combo: 4 });
    expect(campaign.records[1].stars).toBe(3);
    expect(campaign.saveWarning).toBeTruthy();
    expect(campaign.honours.earned['first-perfect']).toBeUndefined();
    write.mockRestore();
    expect(campaign.save()).toBe(true);
    expect(campaign.honours.earned['first-perfect'].at).toBeGreaterThan(0);
    expect(stored().earned['first-perfect']).toBeTruthy();

    const profile = { ...freshProfile(), schemaVersion: 3 };
    profile.records[1] = { score: 1, stars: 3 };
    profile.honours = { ...createHonours(), backfilled: 1 };
    const readOnly = open(profile);
    expect(readOnly.readOnly).toBe(true);
    expect(readOnly.save()).toBe(false);
    expect(readOnly.honours.earned).toEqual({});
  });

  it('awards Master Quartermaster only with maximum storage and every power full at once', () => {
    const { capacity, levels } = maxPowerCapacity();
    const supplied = ({ garage = levels.garage, full = capacity } = {}) => {
      const profile = freshProfile();
      profile.town.era = 'motor-age';
      Object.assign(profile.town.buildings, { ...levels, garage, blacksmith: 1 });
      profile.town.forge = { progress: 0, charge: 1 };
      profile.powers = POWERS.map((power) => ({
        id: power.id,
        quantity: power.id === 'tnt' ? full - 1 : full,
      }));
      return open(profile);
    };
    const partial = supplied({ garage: levels.garage - 1, full: capacity - 2 });
    expect(partial.bonusLimit).toBe(capacity - 2);
    expect(partial.collectForgeTNT()).toBe(true);
    expect(partial.powers.every((power) => power.quantity === partial.bonusLimit)).toBe(true);
    expect(partial.honours.earned['master-quartermaster']).toBeUndefined();

    const maximum = supplied();
    expect(maximum.bonusLimit).toBe(capacity);
    expect(maximum.honours.earned['master-quartermaster']).toBeUndefined();
    expect(maximum.collectForgeTNT()).toBe(true);
    expect(maximum.honours.earned['master-quartermaster'].evidence).toEqual({ capacity });
    expect(maximum.consumePowerItem('tnt')).toBe(true);
    expect(maximum.honours.earned['master-quartermaster']).toBeTruthy();
  });
});

describe('The forge', () => {
  const forge = (edit = () => {}) => {
    const profile = freshProfile();
    profile.town.buildings.blacksmith = 1;
    profile.town.forge = { progress: 0, charge: 1 };
    edit(profile);
    return open(profile);
  };

  it('counts each successful collection once', () => {
    const campaign = forge();
    expect(campaign.collectForgeTNT()).toBe(true);
    expect(campaign.collectForgeTNT()).toBe(false);
    expect(counts().forge).toBe(1);
    expect(campaign.honours.earned['forge-delivers']).toBeTruthy();
    expect(stored().counts.forge).toBe(1);
  });

  it('counts no blocked or failed collection', () => {
    const full = forge((profile) => {
      profile.powers.find((power) => power.id === 'tnt').quantity = rewards.bonusCapacity(
        profile.town,
      );
    });
    expect(full.collectForgeTNT()).toBe(false);
    expect(counts().forge).toBe(0);
    const cooling = forge((profile) => {
      profile.town.lastCollections.blacksmith = Date.now();
    });
    expect(cooling.collectForgeTNT()).toBe(false);
    expect(counts().forge).toBe(0);
    const mining = forge();
    mining.beginRun('normal', 1);
    expect(mining.collectForgeTNT()).toBe(false);
    expect(counts().forge).toBe(0);
    const failing = forge();
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    expect(failing.collectForgeTNT()).toBe(false);
    expect(counts().forge).toBe(0);
    expect(failing.honours.earned).toEqual({});
  });

  it('ignores TNT from chests and the shop', () => {
    vi.spyOn(rewards, 'rollChestReward').mockReturnValue(rewards.chestReward('tnt'));
    const campaign = forge((profile) => {
      profile.town.coins = 1000;
      profile.town.buildings.shop = 1;
      profile.shopVisit = 1;
      profile.shopStock = [{ id: 'tnt', sold: false }];
    });
    expect(campaign.buyShopItem('tnt', 1)).toBe(true);
    const [chest] = victory(campaign, { chooseRewards: true });
    expect(campaign.claimChest(chest.id, 'tnt').id).toBe('tnt');
    expect(tnt(campaign)).toBe(2);
    expect(counts().forge).toBe(0);
    expect(campaign.honours.earned['forge-delivers']).toBeUndefined();
  });
});

describe('Era defence medals', () => {
  it('awards a quiet medal for a fully protected incident in its era, once', () => {
    const campaign = useCampaignStore();
    protectedRaid(campaign);
    expect(campaign.markRaidSeen(1)).toBe(true);
    const medal = campaign.honours.earned['defence-frontier'];
    expect(medal).toMatchObject({ evidence: { eventId: 1 }, seen: false, announced: false });
    expect(medal.at).toBeGreaterThan(0);
    expect(stored().earned['defence-frontier']).toBeTruthy();
    expect(pendingAnnouncements(campaign.honours)).toEqual([]);

    protectedRaid(campaign, { id: 2 });
    expect(campaign.markRaidSeen(2)).toBe(true);
    expect(campaign.honours.earned['defence-frontier']).toEqual(medal);
    expect(campaign.markRaidSeen(2)).toBe(false);
  });

  it('gives nothing for a harmless raid on a poor town or a raid with losses', () => {
    const campaign = useCampaignStore();
    protectedRaid(campaign, { outcome: 'harmless', sheriffLevel: 0, bankLevel: 0 });
    expect(campaign.markRaidSeen(1)).toBe(true);
    protectedRaid(campaign, { id: 2, outcome: 'stolen', loss: 20, sheriffLevel: 0 });
    expect(campaign.markRaidSeen(2)).toBe(true);
    expect(campaign.honours.earned).toEqual({});
  });

  it('attributes a shared incident kind to the era it happened in', () => {
    const shared = ERAS.filter(
      (era) => era.enabled && eraEventKind(era.id) === eraEventKind('industrial'),
    );
    expect(shared.length).toBeGreaterThan(1);
    for (const era of shared) {
      const campaign = useCampaignStore(pinia);
      campaign.town.era = era.id;
      protectedRaid(campaign, { kind: eraEventKind(era.id), fireStationLevel: 3 });
      expect(campaign.markRaidSeen(1)).toBe(true);
      expect(Object.keys(campaign.honours.earned)).toEqual([`defence-${era.id}`]);
      pinia = createPinia();
      setActivePinia(pinia);
      values.clear();
    }
    const campaign = useCampaignStore(pinia);
    campaign.town.era = 'industrial';
    protectedRaid(campaign);
    expect(campaign.markRaidSeen(1)).toBe(true);
    expect(campaign.honours.earned).toEqual({});
  });

  it('cannot change era while an incident is unseen, so its era is the current one', () => {
    const campaign = open(freshProfile(), { guarded: true });
    const tools = createTestingTools(pinia);
    expect(tools.prepareEra('frontier').readyToChange).toBe(true);
    const town = JSON.parse(JSON.stringify(campaign.town));
    protectedRaid({ town });
    values.set(SAVE_KEY, JSON.stringify({ ...JSON.parse(values.get(SAVE_KEY)), town }));
    campaign.reloadLocal();
    expect(eraGate(campaign.town)).toMatchObject({ townComplete: true, pendingRaid: true });
    expect(campaign.advanceEra('frontier')).toBe(false);
    expect(campaign.markRaidSeen(1)).toBe(true);
    expect(Object.keys(campaign.honours.earned)).toEqual(['defence-frontier']);
    expect(campaign.advanceEra('frontier')).toBe(true);
    expect(campaign.town.era).not.toBe('frontier');
    expect(campaign.honours.earned['defence-frontier']).toBeTruthy();
  }, 20000);
});

describe('Backfilling older saves', () => {
  it('earns what the saved state proves with an unknown date, once, without inferring counts', () => {
    const legacy = freshProfile();
    delete legacy.honours;
    legacy.records[3] = { score: 1, stars: 3 };
    legacy.town.completedRuns = 10;
    legacy.town.events[BANDIT_EVENT] = {
      id: 1,
      atRun: 10,
      gangSize: 10,
      sheriffLevel: 3,
      targets: ['mine'],
      outcome: 'protected',
      loss: 0,
      seen: true,
    };
    const campaign = open(legacy);
    const before = values.get(SAVE_KEY);
    const backfilled = JSON.parse(JSON.stringify(campaign.honours));
    expect(backfilled.earned['first-perfect']).toMatchObject({ at: null, backfilled: true });
    expect(backfilled.earned['defence-frontier']).toMatchObject({ at: null, backfilled: true });
    expect(backfilled.counts).toEqual(createHonours().counts);
    expect(backfilled.backfilled).toBeGreaterThan(0);
    expect(values.get(SAVE_KEY)).toBe(before);
    campaign.reloadLocal();
    expect(campaign.honours).toEqual(backfilled);

    expect(campaign.save()).toBe(true);
    expect(stored()).toEqual(backfilled);
    campaign.reloadLocal();
    expect(campaign.honours).toEqual(backfilled);
  });

  it('does not backfill again once the current version has run', () => {
    const profile = freshProfile();
    profile.records[3] = { score: 1, stars: 3 };
    profile.honours.backfilled = 1;
    const campaign = open(profile);
    expect(campaign.honours.earned).toEqual({});
    expect(campaign.save()).toBe(true);
    expect(campaign.honours.earned['first-perfect'].at).toBeGreaterThan(0);
  });
});

describe('Replacing a town copy', () => {
  const earned = (honours) => Object.keys(honours.earned).sort();

  it('keeps honours when a backup of the same town is imported, but not another town’s', () => {
    const campaign = useCampaignStore();
    victory(campaign, { tally: { gems: { ruby: 100 } }, score: 1e6, combo: 4 });
    const backup = campaign.exportSave();
    victory(campaign, { id: 2, tally: { gems: { ruby: 50 }, fusions: ['bomb+cross'] } });
    campaign.markHonoursSeen();
    const live = JSON.parse(JSON.stringify(campaign.honours));
    expect(earned(live)).toEqual(['first-fusion', 'first-perfect']);

    campaign.importSave(backup);
    expect(campaign.records[2]).toBeUndefined();
    expect(campaign.honours.counts.gems.ruby).toBe(150);
    expect(earned(campaign.honours)).toEqual(earned(live));
    expect(campaign.honours.earned['first-fusion'].seen).toBe(true);
    expect(stored().counts.gems.ruby).toBe(150);

    const other = JSON.parse(backup);
    other.town = { id: crypto.randomUUID(), name: 'Elsewhere' };
    campaign.importSave(JSON.stringify(other));
    expect(campaign.honours.counts.gems.ruby).toBe(100);
    expect(earned(campaign.honours)).toEqual(['first-perfect']);

    expect(campaign.resetProgress()).toBe(true);
    expect(campaign.honours).toEqual(createHonours());
  });

  describe('through cloud sync', () => {
    let owner, api, sync;
    const honours = (id, at, ruby) =>
      awardHonour(creditRun(createHonours(), { gems: { ruby } }), id, { at });
    const profile = (extra = {}) => ({
      schemaVersion: 2,
      records: {},
      continuousRecords: {},
      powers: [],
      town: { era: 'frontier', buildings: {}, coins: 1 },
      ...extra,
    });
    const remote = (revision, data) => ({
      townId: townStorage.active().meta.id,
      name: 'Dustwater',
      revision,
      profile: data,
      updatedAt: 100,
      publicId: 'public-id',
      isPublic: false,
    });
    beforeEach(() => {
      townStorage.save(profile({ honours: honours('first-perfect', 5, 10) }));
      owner = { id: 'owner-a' };
      townStorage.account(owner);
      townStorage.attach(
        remote(1, townStorage.active().profile),
        owner.id,
        townStorage.active().meta.sequence,
      );
      api = vi.fn();
      sync = createSyncService({ storage: townStorage, request: api, account: () => owner });
    });

    it('keeps local honours when a newer cloud copy is downloaded, then uploads them', async () => {
      api.mockResolvedValue(remote(2, profile({ honours: honours('lamplighter', 7, 4) })));
      await sync.sync();
      const local = townStorage.active();
      expect(earned(local.profile.honours)).toEqual(['first-perfect', 'lamplighter']);
      expect(local.profile.honours.counts.gems.ruby).toBe(10);
      expect(local.meta).toMatchObject({ baseRevision: 2, dirty: true });
      api.mockImplementation(async (_, body) => (body ? remote(3, body.profile) : remote(2)));
      await sync.sync();
      expect(api.mock.calls.at(-1)[1].profile.honours.counts.gems.ruby).toBe(10);
      expect(townStorage.active().meta.dirty).toBe(false);
    });

    it('adopts a cloud copy that already holds every honour unchanged', async () => {
      const newer = honours('first-perfect', 5, 12);
      api.mockResolvedValue(remote(2, profile({ honours: newer })));
      await sync.sync();
      expect(townStorage.active().profile.honours).toEqual(newer);
      expect(townStorage.active().meta.dirty).toBe(false);
    });

    it('keeps honours from a diverged local copy when the server copy wins', async () => {
      townStorage.save(profile({ honours: honours('first-perfect', 5, 30) }));
      api.mockResolvedValue(remote(2, profile({ honours: honours('ore-merchant', 9, 20) })));
      await sync.sync();
      const local = townStorage.active();
      expect(earned(local.profile.honours)).toEqual(['first-perfect', 'ore-merchant']);
      expect(local.profile.honours.counts.gems.ruby).toBe(30);
      expect(backups.get(local.meta.recovery.id).profile.honours.counts.gems.ruby).toBe(30);
      expect(local.meta.dirty).toBe(true);
    });

    it('restores an older save without losing honours earned since', async () => {
      api.mockImplementation(async (_, body) => (body ? remote(2, body.profile) : remote(1)));
      await sync.restore(townStorage.active().meta.id, profile());
      const uploaded = api.mock.calls.at(-1)[1].profile;
      expect(earned(uploaded.honours)).toEqual(['first-perfect']);
      expect(uploaded.honours.counts.gems.ruby).toBe(10);
      expect(earned(townStorage.active().profile.honours)).toEqual(['first-perfect']);
    });
  });
});

describe('The local mutation guard', () => {
  it('blocks console honour edits while normal actions and debug tools still earn them', () => {
    const profile = freshProfile();
    profile.town.buildings.blacksmith = 1;
    profile.town.forge = { progress: 0, charge: 1 };
    const campaign = open(profile, { guarded: true });
    campaign.honours = awardHonour(campaign.honours, 'score-legend', { at: 1 });
    campaign.honours.earned['score-legend'] = { at: 1, version: 1 };
    campaign.honours.counts.forge = 49;
    campaign.$patch({ honours: { counts: { forge: 49 } } });
    expect(campaign.honours.earned).toEqual({});
    expect(campaign.honours.counts.forge).toBe(0);

    expect(campaign.collectForgeTNT()).toBe(true);
    expect(Object.keys(campaign.honours.earned)).toEqual(['forge-delivers']);
    expect(campaign.updateEarnedHonours(['forge-delivers'], 'seen')).toBe(false);
    expect(campaign.setHonourShowcase(['forge-delivers'])).toBe(true);
    expect(campaign.markHonoursAnnounced(['forge-delivers'])).toBe(true);
    expect(campaign.markHonoursSeen()).toBe(true);
    expect(campaign.honours.earned['forge-delivers']).toMatchObject({
      seen: true,
      announced: true,
    });
    expect(campaign.honours.showcase).toEqual(['forge-delivers']);

    const tools = createTestingTools(pinia);
    tools.mineStage(1);
    games.push(useGameStore(pinia));
    tools.completeMine();
    expect(campaign.honours.earned['perfect-prospector'].at).toBeGreaterThan(0);
  }, 20000);
});

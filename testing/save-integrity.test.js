import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { isReactive, reactive, watch } from 'vue';
import {
  acknowledgeIntegrity,
  appendIntegrityAction,
  createIntegrity,
  loadIntegrity,
  mergeIntegrity,
  prepareIntegritySnapshot,
} from '../src/services/saveIntegrity';
import { useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { townStorage } from '../src/services/townStorage';
import { CONTINUOUS_COIN_CAP, chestReward } from '../src/data/rewards';
import * as rewards from '../src/data/rewards';
import { miningPayout } from '../src/game/town/TownRules';

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

it('keeps immutable receipt trees raw through creation, loading, staging and acknowledgment', () => {
  const initial = createIntegrity();
  const first = appendIntegrityAction(initial, 'run-start', { runId: 1, at: 100 });
  const live = appendIntegrityAction(first, 'victory', { runId: 1, at: 200 });
  const loaded = loadIntegrity(JSON.parse(JSON.stringify(live)));
  const ack = { version: 1, epoch: live.epoch, ackSequence: 1, checkpoint: 'signed' };
  const acknowledged = acknowledgeIntegrity(live, ack);
  const merged = mergeIntegrity(loaded, acknowledged);
  const staged = prepareIntegritySnapshot({ integrity: merged }, 300).integrity;
  for (const integrity of [initial, first, live, loaded, acknowledged, merged, staged]) {
    const state = reactive({ integrity });
    expect(isReactive(state.integrity)).toBe(false);
    expect(isReactive(state.integrity.actions)).toBe(false);
    for (const action of state.integrity.actions) {
      expect(isReactive(action)).toBe(false);
      expect(isReactive(action.data)).toBe(false);
    }
    expect(JSON.stringify(state.integrity)).toBe(JSON.stringify(integrity));
    expect(JSON.stringify(integrity)).not.toContain('__v_skip');
  }
});

it('keeps journals raw across actual store saves and reloads while observing replacement', () => {
  const campaign = useCampaignStore();
  expect(isReactive(campaign.integrity)).toBe(false);
  const replaced = vi.fn();
  const stop = watch(() => campaign.integrity, replaced, { flush: 'sync' });
  campaign.upgradeBuilding('well', 0);
  expect(replaced).toHaveBeenCalled();
  const root = JSON.parse(saved.get(SAVE_KEY));
  root.integrity = acknowledgeIntegrity(root.integrity, {
    version: 1,
    epoch: campaign.integrity.epoch,
    ackSequence: 1,
    checkpoint: 'signed-server-checkpoint',
  });
  saved.set(SAVE_KEY, JSON.stringify(root));
  expect(campaign.save()).toBe(true);
  expect(campaign.integrity.baseSequence).toBe(1);
  campaign.beginRun('normal', 1);
  expect(isReactive(campaign.integrity)).toBe(false);
  expect(isReactive(campaign.integrity.actions[0].data)).toBe(false);
  stop();
  setActivePinia(createPinia());
  const restored = useCampaignStore();
  expect(isReactive(restored.integrity)).toBe(false);
  expect(isReactive(restored.integrity.actions)).toBe(false);
  expect(isReactive(restored.integrity.actions[0].data)).toBe(false);
  expect(restored.integrity).toEqual(JSON.parse(saved.get(SAVE_KEY)).integrity);
});

it('keeps stable command identities and independent payloads through a durable retry', () => {
  const initial = createIntegrity();
  const data = { buildingId: 'well', expectedStage: 0, at: 100 };
  const appended = appendIntegrityAction(initial, 'building-buy', data);
  data.expectedStage = 10;
  expect(initial.actions).toEqual([]);
  expect(appended.actions[0]).toMatchObject({
    sequence: 1,
    kind: 'building-buy',
    data: { buildingId: 'well', expectedStage: 0, at: 100 },
  });
  expect(loadIntegrity(JSON.parse(JSON.stringify(appended)))).toEqual(appended);
  const second = appendIntegrityAction(appended, 'run-start', { runId: 1, at: 200 });
  expect(second.actions[1].sequence).toBe(2);
  expect(second.actions[1].id).not.toBe(second.actions[0].id);
});

it('acknowledges only the uploaded prefix while retaining commands made during sync', () => {
  const first = appendIntegrityAction(createIntegrity(), 'run-start', { runId: 1, at: 100 });
  const live = appendIntegrityAction(first, 'victory', { runId: 1, at: 200 });
  const ack = { version: 1, epoch: live.epoch, ackSequence: 1, status: 'accepted' };
  const pruned = acknowledgeIntegrity(live, ack);
  expect(pruned.baseSequence).toBe(1);
  expect(pruned.actions).toEqual([live.actions[1]]);
  expect(acknowledgeIntegrity(pruned, ack)).toBe(pruned);
  expect(
    appendIntegrityAction(pruned, 'run-start', { runId: 2, at: 300 }).actions[1].sequence,
  ).toBe(3);
  expect(mergeIntegrity(live, pruned)).toEqual(pruned);
});

it('does not prune another town, an unsubmitted sequence or a malformed response', () => {
  const integrity = appendIntegrityAction(createIntegrity(), 'run-start', { runId: 1, at: 100 });
  for (const ack of [
    { version: 1, epoch: createIntegrity().epoch, ackSequence: 1 },
    { version: 2, epoch: integrity.epoch, ackSequence: 1 },
    { version: 1, epoch: integrity.epoch, ackSequence: 2 },
    { version: 1, epoch: integrity.epoch, ackSequence: -1 },
    { version: 1, epoch: integrity.epoch, ackSequence: 0.5 },
    null,
  ])
    expect(acknowledgeIntegrity(integrity, ack)).toBe(integrity);
});

it('copies a signed checkpoint at the same sequence without losing unsent commands', () => {
  const integrity = appendIntegrityAction(createIntegrity(), 'run-start', { runId: 1, at: 100 });
  const ack = {
    version: 1,
    epoch: integrity.epoch,
    ackSequence: 0,
    checkpoint: 'opaque-server-signed-checkpoint',
  };
  const anchored = acknowledgeIntegrity(integrity, ack);
  expect(anchored.checkpoint).toBe(ack.checkpoint);
  expect(anchored.actions).toEqual(integrity.actions);
  expect(mergeIntegrity(integrity, anchored)).toEqual(anchored);
  expect(
    acknowledgeIntegrity(anchored, { ...ack, ackSequence: 2, checkpoint: 'invalid-prefix' }),
  ).toBe(anchored);
  expect(acknowledgeIntegrity(anchored, { ...ack, epoch: createIntegrity().epoch })).toBe(anchored);
});

it.each([null, { version: 5, opaque: ['preserve'] }, { version: 1, actions: 'damaged' }])(
  'preserves an existing unknown or damaged integrity record: %j',
  (existing) => {
    const restored = loadIntegrity(existing);
    expect(restored).toEqual(existing);
    expect(appendIntegrityAction(restored, 'run-start', { at: 100 })).toBe(restored);
  },
);

it('anchors client time when an upload is staged without changing gameplay or its journal', () => {
  const profile = { town: { coins: 50 }, integrity: createIntegrity() };
  const staged = prepareIntegritySnapshot(profile, 12345);
  expect(staged.integrity.clientAt).toBe(12345);
  expect(staged.town).toBe(profile.town);
  expect(staged.integrity.actions).toBe(profile.integrity.actions);
  expect(profile.integrity.clientAt).not.toBe(12345);
  const newer = { integrity: { version: 5 } };
  expect(prepareIntegritySnapshot(newer, 12345)).toBe(newer);
});

it('journals a long successful puzzle and chest claim with exact existing earnings and no API', () => {
  const fetch = vi.fn();
  vi.stubGlobal('fetch', fetch);
  vi.spyOn(rewards, 'rollChestReward').mockReturnValue(chestReward('tnt'));
  const campaign = useCampaignStore();
  const runId = campaign.beginRun('normal', 1);
  const chests = campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    elapsedMs: 10000000,
    speedTargetMs: 60000,
    jewels: 12000,
    bonusGems: 7,
    comboCounts: { 2: 30 },
    multiMatchCounts: { 3: 4 },
    chooseRewards: true,
  });
  expect(chests).toHaveLength(1);
  const coins = miningPayout(12000, 7, { 2: 30 }, { 3: 4 }, 1);
  expect(campaign.town.coins).toBe(coins);
  expect(campaign.claimChest(chests[0].id, 'tnt').id).toBe('tnt');
  expect(campaign.claimChest(chests[0].id, 'coins')).toBeNull();
  expect(campaign.integrity.actions.map((action) => action.kind)).toEqual([
    'run-start',
    'victory',
    'chest-claim',
  ]);
  expect(campaign.integrity.actions[1].data).toMatchObject({
    levelId: 1,
    elapsedMs: 10000000,
    jewels: 12000,
    chests: [{ source: 'completion', rewardId: 'tnt' }],
  });
  expect(fetch).not.toHaveBeenCalled();
  const durable = JSON.parse(saved.get(SAVE_KEY));
  expect(durable.integrity).toEqual(campaign.integrity);
  setActivePinia(createPinia());
  const restored = useCampaignStore();
  expect(restored.town.coins).toBe(coins);
  expect(restored.powers.find((power) => power.id === 'tnt').quantity).toBe(1);
  expect(restored.integrity).toEqual(durable.integrity);
});

it('does not create commands for idle refreshes, guidance or score-only continuous matches', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.museum = 1;
  const runId = campaign.beginRun('continuous', 1);
  expect(campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 100 })).toBe(true);
  expect(campaign.continuousRecords[1].coins).toBe(CONTINUOUS_COIN_CAP);
  const actions = campaign.integrity.actions;
  for (let count = 1; count <= 200; count++) {
    campaign.accrueSaloonIncome(Date.now() + count);
    expect(
      campaign.recordContinuous({ id: 1, runId, jewels: 250 + count, score: 100 + count }),
    ).toBe(true);
  }
  campaign.visitVillage();
  expect(campaign.integrity.actions).toEqual(actions);
  expect(campaign.continuousRecords[1].score).toBe(300);
  expect(campaign.town.coins).toBe(CONTINUOUS_COIN_CAP);
});

it('rolls back a collection command together with inventory when local persistence fails', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.blacksmith = 1;
  campaign.town.forge.charge = 1;
  campaign.save();
  const before = saved.get(SAVE_KEY);
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(campaign.collectForgeTNT()).toBe(false);
  expect(campaign.town.forge.charge).toBe(1);
  expect(campaign.powers.find((power) => power.id === 'tnt').quantity).toBe(0);
  expect(campaign.integrity.actions).toEqual([]);
  expect(saved.get(SAVE_KEY)).toBe(before);
});

it('retains the existing in-memory purchase when persistence fails and saves its receipt on retry', () => {
  const campaign = useCampaignStore();
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  expect(campaign.town.buildings.well).toBe(1);
  expect(campaign.integrity.actions).toHaveLength(1);
  const receipt = campaign.integrity.actions[0];
  write.mockRestore();
  expect(campaign.save()).toBe(true);
  expect(JSON.parse(saved.get(SAVE_KEY)).integrity.actions).toEqual([receipt]);
});

it('starts a local reset with the same new journal in memory and durable storage', () => {
  const campaign = useCampaignStore();
  campaign.upgradeBuilding('well', 0);
  const previousEpoch = campaign.integrity.epoch;
  expect(campaign.resetProgress()).toBe(true);
  expect(campaign.integrity.epoch).not.toBe(previousEpoch);
  expect(campaign.integrity.actions).toEqual([]);
  expect(JSON.parse(saved.get(SAVE_KEY)).integrity).toEqual(campaign.integrity);
  const runId = campaign.beginRun('normal', 1);
  expect(runId).toBe(1);
  expect(JSON.parse(saved.get(SAVE_KEY)).integrity).toEqual(campaign.integrity);
});

it('keeps asynchronous acknowledgements out of the next gameplay save', () => {
  const campaign = useCampaignStore();
  expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  const receipt = campaign.integrity.actions[0];
  const entry = townStorage.active();
  const root = JSON.parse(saved.get(SAVE_KEY));
  root.integrity = acknowledgeIntegrity(entry.profile.integrity, {
    version: 1,
    epoch: campaign.integrity.epoch,
    ackSequence: 1,
    status: 'accepted',
  });
  saved.set(SAVE_KEY, JSON.stringify(root));
  const runId = campaign.beginRun('normal', 1);
  expect(runId).toBe(1);
  expect(campaign.integrity.baseSequence).toBe(1);
  expect(campaign.integrity.actions).toHaveLength(1);
  expect(campaign.integrity.actions[0].sequence).toBe(2);
  expect(campaign.integrity.actions[0].id).not.toBe(receipt.id);
  expect(JSON.parse(saved.get(SAVE_KEY)).integrity).toEqual(campaign.integrity);
});

it('refreshes the acknowledged journal using the existing storage parse during a save', () => {
  const campaign = useCampaignStore();
  campaign.save();
  const durable = saved.get(SAVE_KEY);
  const read = vi.spyOn(localStorage, 'getItem');
  const parse = vi.spyOn(JSON, 'parse');
  expect(campaign.save()).toBe(true);
  // Read the durable town once and compare it before writing. Accounting must not
  // add another read/parse; unrelated profile/asset JSON is outside this assertion.
  expect(read.mock.calls.filter(([key]) => key === SAVE_KEY)).toHaveLength(2);
  expect(parse.mock.calls.filter(([text]) => text === durable)).toHaveLength(1);
});

it('writes item consumption and its receipt once while preserving offline use', () => {
  const campaign = useCampaignStore();
  campaign.powers.find((power) => power.id === 'tnt').quantity = 1;
  const inventory = useInventoryStore();
  expect(inventory.consumeItem('tnt')).toBe(true);
  expect(inventory.consumeItem('tnt')).toBe(false);
  expect(campaign.integrity.actions).toHaveLength(1);
  expect(campaign.integrity.actions[0]).toMatchObject({
    kind: 'power-spend',
    data: { itemId: 'tnt' },
  });
  expect(JSON.parse(saved.get(SAVE_KEY)).powers.find((power) => power.id === 'tnt').quantity).toBe(
    0,
  );
});

it('records initial shop stock once while folding puzzle restocks into their victory receipt', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.shop = 1;
  campaign.ensureShopStock();
  campaign.ensureShopStock();
  expect(campaign.integrity.actions.map((action) => action.kind)).toEqual(['shop-stock']);
  expect(campaign.integrity.actions[0].data).toMatchObject({
    stock: campaign.shopStock,
    visit: campaign.shopVisit,
  });
  const runId = campaign.beginRun('normal', 1);
  campaign.recordVictory({ id: 1, runId, score: 100, target: 6000, combo: 1 });
  expect(campaign.integrity.actions.map((action) => action.kind)).toEqual([
    'shop-stock',
    'run-start',
    'victory',
  ]);
  expect(campaign.integrity.actions.at(-1).data).toMatchObject({
    shopStock: campaign.shopStock,
    shopVisit: campaign.shopVisit,
  });
});

it('recovers an interrupted reward reveal with one durable claim on reload', () => {
  vi.spyOn(rewards, 'rollChestReward').mockReturnValue(chestReward('tnt'));
  const campaign = useCampaignStore();
  const runId = campaign.beginRun('normal', 1);
  campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    chooseRewards: true,
  });
  setActivePinia(createPinia());
  const recovered = useCampaignStore();
  expect(recovered.pendingChests).toEqual([]);
  expect(recovered.integrity.actions.map((action) => action.kind)).toEqual([
    'run-start',
    'victory',
    'chest-claim',
  ]);
  const receipt = recovered.integrity.actions[2];
  setActivePinia(createPinia());
  expect(useCampaignStore().integrity.actions).toHaveLength(3);
  expect(useCampaignStore().integrity.actions[2]).toEqual(receipt);
});

it('preserves full-hammer-bag guaranteed rewards and accounting across a reload', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.museum = 1;
  campaign.builderHammers = 5;
  campaign.chestsWithoutBuilderHammer = 9;
  const play = (store) => {
    const runId = store.beginRun('normal', 1);
    return store.recordVictory({ id: 1, runId, score: 100, target: 6000, combo: 1 });
  };
  expect(play(campaign)[0].items[0].kind).toBe('coins');
  const profile = JSON.parse(saved.get(SAVE_KEY));
  const coins = campaign.town.coins;
  setActivePinia(createPinia());
  const restored = useCampaignStore();
  expect(restored.chestsWithoutBuilderHammer).toBe(profile.chestsWithoutBuilderHammer);
  expect(restored.integrity).toEqual(profile.integrity);
  expect(play(restored)[0].items[0].kind).toBe('coins');
  expect(restored.town.coins).toBe(coins + chestReward('coins', 1).quantity);
  expect(restored.builderHammers).toBe(5);
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createApp } from 'vue';
import { createPinia, setActivePinia } from 'pinia';
import {
  createLocalIntegrityPlugin,
  runRegisteredTestingMutation,
} from '../src/services/localIntegrity';
import { freshProfile, useCampaignStore, SAVE_KEY } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { useGameStore } from '../src/stores/gameStore';
import { createTestingTools } from '../src/services/testingTools';
import { townStorage } from '../src/services/townStorage';
import { acknowledgeIntegrity } from '../src/services/saveIntegrity';
import { upgradeOffer } from '../src/game/town/TownRules';
import { SHOP_ITEMS } from '../src/data/shop';
import { CONTINUOUS_COIN_CAP } from '../src/data/rewards';
import { HintEngine } from '../src/game/engine/HintEngine';
import * as rewards from '../src/data/rewards';

let values, pinia;
function open(profile = freshProfile()) {
  values.set(SAVE_KEY, JSON.stringify(profile));
  pinia = createPinia();
  pinia.use(createLocalIntegrityPlugin());
  createApp({}).use(pinia);
  setActivePinia(pinia);
  return useCampaignStore(pinia);
}
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  });
});
afterEach(() => {
  useGameStore(pinia).cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const finish = (campaign, id = 1, options = {}) =>
  campaign.recordVictory({
    id,
    runId: campaign.beginRun('normal', id),
    score: 100,
    target: 6000,
    combo: 1,
    elapsedMs: 9000000,
    speedTargetMs: 60000,
    ...options,
  });

it('blocks direct money and level injection before the first action or save', () => {
  const campaign = open();
  campaign.town.coins = 1000000;
  campaign.records[1] = { score: 999999, stars: 3 };
  campaign.$patch({ town: { coins: 99999 }, records: { 1: { score: 1, stars: 1 } } });
  campaign.$state = { ...campaign.$state, builderHammers: 500 };
  expect(campaign.town.coins).toBe(0);
  expect(campaign.builderHammers).toBe(0);
  expect(campaign.records).toEqual({});
  expect(campaign.canPlay(2)).toBe(false);
  expect(campaign.isUnlocked(2)).toBe(false);
  expect(campaign.save()).toBe(true);
  expect(JSON.parse(values.get(SAVE_KEY)).town.coins).toBe(0);
});

it('guards deletion, property definitions and alternate state references', () => {
  const profile = freshProfile();
  profile.town.coins = 12;
  profile.records[1] = { score: 10, stars: 1 };
  const campaign = open(profile);
  delete campaign.records[1];
  campaign.$patch((state) => {
    state.town.coins += 999;
  });
  expect(() => Object.defineProperty(campaign.town, 'coins', { value: 888 })).toThrow();
  expect(() => Object.defineProperty(campaign.$state, 'records', { value: {} })).toThrow();
  expect(() => Object.setPrototypeOf(campaign.town, { coins: 777 })).toThrow();
  expect(campaign.town.coins).toBe(12);
  expect(campaign.records[1]).toEqual({ score: 10, stars: 1 });
});

it('does not give arbitrary commits, callbacks or reward helpers a mutation capability', () => {
  const campaign = open();
  const epoch = campaign.integrity.epoch;
  expect(campaign.commit({ town: { ...campaign.town, coins: 99999 } })).toBe(false);
  expect(
    campaign.transaction(['records'], () => {
      campaign.records[1] = { stars: 3 };
    }),
  ).toBe(false);
  expect(campaign.awardReward({ kind: 'coins', quantity: 99999 })).toBe(false);
  expect(campaign.recordAction('reward-grant', { quantity: 99999 })).toBe(false);
  expect(campaign.completeProject({ ...campaign.town, coins: 99999 })).toBe(false);
  expect(campaign.town.coins).toBe(0);
  expect(campaign.records).toEqual({});
  expect(campaign.integrity.epoch).toBe(epoch);
  expect(campaign.integrity.actions).toEqual([]);
});

it('preserves normal purchases, long victories and durable chest recovery', () => {
  const profile = freshProfile();
  profile.town.coins = 1000;
  let campaign = open(profile);
  vi.spyOn(rewards, 'rollChestReward').mockReturnValue(rewards.chestReward('tnt'));
  expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  const runId = campaign.beginRun('normal', 1);
  const chest = campaign.recordVictory({
    id: 1,
    runId,
    score: 100,
    target: 6000,
    combo: 1,
    elapsedMs: 9000000,
    speedTargetMs: 60000,
    jewels: 321,
    chooseRewards: true,
  });
  expect(campaign.town.coins).toBe(1321);
  expect(campaign.isUnlocked(2)).toBe(true);
  const durable = values.get(SAVE_KEY);
  campaign = open(JSON.parse(durable));
  expect(campaign.pendingChests).toEqual([]);
  expect(campaign.powers.find((power) => power.id === 'tnt').quantity).toBe(1);
  expect(campaign.claimChest(chest[0].id)).toBeNull();
  expect(campaign.integrity.actions.map((action) => action.kind)).toEqual([
    'building-buy',
    'run-start',
    'victory',
    'chest-claim',
  ]);
});

it('consumes items through the bounded campaign action and blocks injected inventory', () => {
  const profile = freshProfile();
  profile.powers.find((power) => power.id === 'tnt').quantity = 1;
  const campaign = open(profile);
  const slot = campaign.powers.find((power) => power.id === 'tnt');
  slot.quantity = 99;
  const inventory = useInventoryStore(pinia);
  expect(inventory.consumeItem('tnt')).toBe(true);
  expect(inventory.consumeItem('tnt')).toBe(false);
  expect(slot.quantity).toBe(0);
  expect(campaign.integrity.actions.at(-1).kind).toBe('power-spend');
});

it('keeps registered testing grants and chapter codes explicit without opening generic commits', () => {
  const campaign = open();
  const tools = createTestingTools(pinia);
  expect(tools.grant({ coins: 500, hammers: 2 })).toEqual({ coins: 500, builderHammers: 2 });
  expect(campaign.commit({ builderHammers: 5 })).toBe(false);
  const chapter = tools.mineStage(2);
  expect(chapter.level).toBe(7);
  expect(campaign.isUnlocked(7)).toBe(true);
  campaign.town.coins = 999999;
  expect(campaign.town.coins).toBe(500);
  expect(() =>
    runRegisteredTestingMutation(campaign, {}, () => campaign.commit({ builderHammers: 5 })),
  ).toThrow('unavailable');
}, 20000);

it('rolls normal and registered transactions back when persistence fails', () => {
  const profile = freshProfile();
  profile.town.buildings.blacksmith = 1;
  profile.town.forge.charge = 1;
  const campaign = open(profile);
  const write = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('Quota exceeded');
  });
  expect(campaign.collectForgeTNT()).toBe(false);
  expect(campaign.town.forge.charge).toBe(1);
  expect(campaign.powers.find((power) => power.id === 'tnt').quantity).toBe(0);
  expect(campaign.integrity.actions).toEqual([]);
  expect(() => createTestingTools(pinia).grant()).toThrow('Balances were restored');
  expect(campaign.town.coins).toBe(0);
  write.mockRestore();
  expect(campaign.collectForgeTNT()).toBe(true);
  expect(campaign.save()).toBe(true);
});

it('claims an existing delayed reward once without allowing pending-chest edits', () => {
  const campaign = open();
  vi.spyOn(rewards, 'rollChestReward').mockReturnValue(rewards.chestReward('tnt'));
  const [chest] = finish(campaign, 1, { chooseRewards: true });
  campaign.pendingChests[0].items[0].quantity = 100;
  expect(campaign.claimChest(chest.id, 'tnt').id).toBe('tnt');
  expect(campaign.claimChest(chest.id, 'tnt')).toBeNull();
  expect(campaign.powers.find((power) => power.id === 'tnt').quantity).toBe(1);
  expect(campaign.pendingChests).toEqual([]);
});

it('preserves paid construction, completion and hammer spending', () => {
  const profile = freshProfile();
  profile.town.coins = 2000;
  profile.town.buildings.well = profile.town.buildings.farm = profile.town.buildings.home = 1;
  profile.builderHammers = 2;
  const campaign = open(profile);
  const cost = upgradeOffer(campaign.town, 'armory').cost;
  expect(campaign.upgradeBuilding('armory', 0)).toBe(true);
  expect(campaign.town.coins).toBe(2000 - cost);
  expect(campaign.town.projects.armory.wins).toBe(0);
  finish(campaign);
  expect(campaign.finishConstruction('armory', 1)).toBe(true);
  expect(campaign.town.buildings.armory).toBe(1);
  const hammers = campaign.builderHammers;
  expect(campaign.useBuilderHammer('museum', 0)).toBe(true);
  expect(campaign.builderHammers).toBe(hammers - 1);
  expect(campaign.canReplay).toBe(true);
  expect(campaign.integrity.actions.map((action) => action.kind)).toContain('building-finish');
});

it('buys the quoted shop item once and keeps its exact inventory and price', () => {
  const profile = freshProfile();
  profile.town.coins = 1000;
  profile.town.buildings.shop = 1;
  const campaign = open(profile);
  campaign.ensureShopStock();
  const offer = campaign.shopStock.find(({ id }) => id !== 'coins');
  const price = SHOP_ITEMS.find(({ id }) => id === offer.id).price;
  expect(campaign.buyShopItem(offer.id, campaign.shopVisit)).toBe(true);
  expect(campaign.town.coins).toBe(1000 - price);
  expect(campaign.buyShopItem(offer.id, campaign.shopVisit)).toBe(false);
  expect(campaign.integrity.actions.at(-1).kind).toBe('shop-buy');
});

it('keeps continuous earnings capped by their existing rule and allows score-only play', () => {
  const profile = freshProfile();
  profile.records[1] = { score: 100, stars: 1 };
  profile.town.buildings.museum = 1;
  const campaign = open(profile);
  const runId = campaign.beginRun('continuous', 1);
  expect(campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 100 })).toBe(true);
  const actions = campaign.integrity.actions.length;
  expect(campaign.recordContinuous({ id: 1, runId, jewels: 12000, score: 10000 })).toBe(true);
  expect(campaign.town.coins).toBe(CONTINUOUS_COIN_CAP);
  expect(campaign.continuousRecords[1].score).toBe(10000);
  expect(campaign.integrity.actions).toHaveLength(actions);
  campaign.continuousRecords[1].coins = 999999;
  expect(campaign.continuousRecords[1].coins).toBe(CONTINUOUS_COIN_CAP);
});

it('preserves registered era preparation and mine completion, then normal era advancement', () => {
  const campaign = open();
  const tools = createTestingTools(pinia);
  const prepared = tools.prepareEra('frontier');
  expect(prepared.readyToChange).toBe(true);
  expect(campaign.advanceEra('frontier')).toBe(true);
  expect(campaign.town.era).toBe(prepared.nextEra);
  tools.mineStage(1);
  expect(tools.completeMine().stars).toBeGreaterThan(100);
  expect(campaign.records[1].stars).toBe(3);
  campaign.records[1].stars = 1;
  expect(campaign.records[1].stars).toBe(3);
}, 20000);

it('imports and reloads a confirmed backup without adding journal flags or losing resources', () => {
  const profile = freshProfile();
  profile.town.coins = 44;
  const campaign = open(profile);
  campaign.upgradeBuilding('well', 0);
  const backup = campaign.exportSave();
  const epoch = campaign.integrity.epoch;
  expect(campaign.resetProgress()).toBe(true);
  campaign.importSave(backup);
  expect(campaign.town.coins).toBe(44);
  expect(campaign.integrity.epoch).toBe(epoch);
  campaign.reloadLocal();
  expect(campaign.town.buildings.well).toBe(1);
  expect(campaign.town.coins).toBe(44);
  campaign.town.coins = 999;
  expect(campaign.town.coins).toBe(44);
  expect(campaign.integrity.actions[0].kind).toBe('building-buy');
  expect(campaign.profile()).not.toHaveProperty('localIntegrity');
});

it('merges cloud receipt prefixes without discarding later local actions', () => {
  const campaign = open();
  campaign.upgradeBuilding('well', 0);
  campaign.beginRun('normal', 1);
  const root = JSON.parse(values.get(SAVE_KEY));
  root.integrity = acknowledgeIntegrity(root.integrity, {
    version: 1,
    epoch: root.integrity.epoch,
    ackSequence: 1,
    checkpoint: 'signed',
  });
  values.set(SAVE_KEY, JSON.stringify(root));
  expect(campaign.save()).toBe(true);
  expect(campaign.integrity.baseSequence).toBe(1);
  expect(campaign.integrity.actions.map(({ sequence }) => sequence)).toEqual([2]);
  expect(townStorage.active().profile.integrity).toEqual(campaign.integrity);
});

it('allows an actual guarded puzzle to match beyond 100 moves after its optional speed target', async () => {
  const campaign = open();
  const game = useGameStore(pinia);
  game.bootstrap();
  expect(game.startLevel(1)).toBe(true);
  game.moves = 100;
  game.playClock.elapsed = game.speedTargetMs + 60000;
  game.playClock.started = true;
  const hint = new HintEngine().findBestMove(
    game.board,
    game.tiles,
    game.boardCols,
    game.boardRows,
  );
  expect(await game.resolveSwap(hint.swap.aIndex, hint.swap.bIndex)).toBe(true);
  expect(game.moves).toBe(101);
  expect(game.sessionActive).toBe(true);
  game.remainingLayers = 0;
  game.completeLevel();
  expect(game.levelCleared).toBe(true);
  expect(campaign.nextLevel).toBe(2);
  expect(campaign.integrity.actions.at(-1).kind).toBe('victory');
}, 20000);

it('preserves stored income collection and prevented raid-loss refunds', () => {
  const profile = freshProfile();
  profile.town.coins = 1000;
  profile.town.buildings.well = profile.town.buildings.farm = profile.town.buildings.home = 1;
  profile.town.buildings.saloon = 1;
  profile.town.income = { at: Date.now(), stored: 73, remainder: 0 };
  profile.town.nextRaidRun = 0;
  profile.builderHammers = 1;
  const campaign = open(profile);
  expect(campaign.collectSaloonIncome()).toBe(73);
  expect(campaign.town.coins).toBe(1073);
  expect(campaign.town.income.stored).toBe(0);
  vi.spyOn(Math, 'random').mockReturnValue(0.5);
  expect(campaign.resolveBandits()).toBe(true);
  const damaged = campaign.town.coins;
  expect(damaged).toBeLessThan(1073);
  expect(campaign.useBuilderHammer('bank', 0)).toBe(true);
  expect(campaign.town.coins).toBeGreaterThan(damaged);
  expect(campaign.town.coins).toBeLessThanOrEqual(1073);
  expect(campaign.integrity.actions.map(({ kind }) => kind)).toContain('saloon-collect');
});

it('saves personalisation and paid monument replacements through the production mutation guard', () => {
  const profile = freshProfile();
  profile.town.era = 'industrial';
  profile.town.coins = 30000;
  const campaign = open(profile);
  expect(campaign.personalise([{ kind: 'paint', group: 'walls', value: '#123456' }])).toBe(true);
  const purchase = {
    kind: 'area',
    id: 'monument',
    slot: 0,
    value: 'crystal-spire',
    expectedChoice: null,
    expectedLevel: 0,
  };
  expect(campaign.personalise([purchase])).toBe(true);
  expect(campaign.town.coins).toBe(22000);
  expect(campaign.integrity.actions.at(-1).kind).toBe('landmark-buy');
  const distinction = { ...campaign.honours.earned['monument-gold'] };
  expect(distinction.at).toBeGreaterThan(0);
  expect(campaign.personalise([purchase])).toBe(false);
  expect(
    campaign.personalise([
      { ...purchase, value: 'guardian', expectedChoice: 'crystal-spire', expectedLevel: 1 },
    ]),
  ).toBe(true);
  expect(campaign.town.coins).toBe(12000);
  const saved = JSON.parse(values.get(SAVE_KEY));
  expect(saved.town.personalisation.areas.monument).toEqual(['guardian']);
  expect(saved.town.personalisation.paint.all.walls).toBe('#123456');
  const restored = open(saved);
  expect(restored.town.coins).toBe(12000);
  expect(restored.honours.earned['monument-gold']).toEqual(distinction);
  expect(
    restored.personalise([
      { ...purchase, value: 'celestial-sphere', expectedChoice: 'guardian', expectedLevel: 1 },
    ]),
  ).toBe(false);
  expect(restored.town.personalisation.areas.monument).toEqual(['guardian']);
  // The named action authorizes its rules, never arbitrary property assignment.
  restored.town.coins = 1e9;
  expect(restored.town.coins).toBe(12000);
});

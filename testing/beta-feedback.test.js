import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { SAVE_KEY } from '../src/services/localProfile';
import { detectBonusFromMatches } from '../src/game/engine/MatchPatterns';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { createGem } from '../src/game/engine/GemFactory';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { OBSTACLES, obstaclesInLevel } from '../src/data/obstacles';
import { CHEST_DROPS } from '../src/data/rewards';
import { SHOP_ITEMS, rollShopStock } from '../src/data/shop';
import { createTown, BANDIT_EVENT } from '../src/data/town';
import { banditEncounter, raidProtection, miningPayout } from '../src/game/town/TownRules';

let saves;
beforeEach(() => {
  saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const win = (campaign, chooseRewards = true) =>
  campaign.recordVictory({
    id: 1,
    runId: campaign.beginRun(),
    score: 10000,
    target: 1000,
    elapsedMs: 1000,
    speedTargetMs: 60000,
    combo: 1,
    chooseRewards,
  });

it.each([3, 4, 5])(
  'keeps a cross for an L with a %i-gem arm, even at the swap destination',
  (length) => {
    const bonuses = detectBonusFromMatches(
      [
        { type: 'ruby', orientation: 'horizontal', indices: Array.from({ length }, (_, n) => n) },
        { type: 'ruby', orientation: 'vertical', indices: [0, 7, 14] },
      ],
      { swap: { aIndex: 0, bIndex: 1 } },
    );
    expect(bonuses).toEqual([{ type: 'cross', index: 0 }]);
  },
);
it('keeps independent line bonuses alongside a T/L', () => {
  expect(
    detectBonusFromMatches([
      { type: 'ruby', orientation: 'horizontal', indices: [0, 1, 2] },
      { type: 'ruby', orientation: 'vertical', indices: [1, 8, 15] },
      { type: 'emerald', orientation: 'horizontal', indices: [21, 22, 23, 24] },
    ]),
  ).toEqual([
    { type: 'cross', index: 1 },
    { type: 'bomb', index: 23 },
  ]);
});

it.each(['bomb', 'cross', 'rainbow'])(
  'activates a %s in place using its own footprint without swapping or inventing a fusion',
  (type) => {
    const engine = new MatchEngine();
    const board = Array.from({ length: 9 }, (_, i) =>
      createGem(i === 4 ? type : i === 5 ? 'bomb' : 'ruby'),
    );
    const result = engine.evaluateActivation(board, 3, 3, 4);
    expect(result.swap).toBeNull();
    expect(result.matches[0].indices).toContain(4);
    expect(result.matches[0].fusion).toBeUndefined();
    expect(result.board[4]).toBe(board[4]);
    if (type === 'rainbow') {
      expect(result.matches[0].indices).not.toContain(5);
      expect(result.matches[0].indices).toHaveLength(8);
    } else expect(result.matches[0].indices).toContain(5);
    for (const tile of [{ chainHealth: 1 }, { state: 'FROZEN' }, { type: 'blocker', health: 1 }])
      expect(engine.evaluateActivation(board, 3, 3, 4, { 4: tile }).matches).toEqual([]);
  },
);
it('double-taps only the same current bonus and cancels the gesture across resets and changes', () => {
  let now = 0;
  vi.spyOn(Date, 'now').mockImplementation(() => now);
  const store = {
    sessionActive: true,
    board: [createGem('bomb'), createGem('ruby')],
    boardVersion: 0,
    activateBonusGem: vi.fn(),
    resolveSwap: vi.fn(),
    clearBonusPreview: vi.fn(),
  };
  const input = new BoardInput({ scene: {}, boardContainer: {}, gameStore: store });
  input.setLayout({ boardCols: 2, boardRows: 1, cellSize: 60 });
  input.activateCell(0);
  now = 100;
  input.activateCell(0);
  expect(store.activateBonusGem).toHaveBeenCalledExactlyOnceWith(0);
  input.activateCell(0);
  now += 400;
  input.activateCell(0);
  expect(store.activateBonusGem).toHaveBeenCalledTimes(1);
  input.reset();
  input.activateCell(0);
  input.reset();
  input.activateCell(0);
  expect(store.activateBonusGem).toHaveBeenCalledTimes(1);
  store.boardVersion++;
  input.activateCell(0);
  expect(store.activateBonusGem).toHaveBeenCalledTimes(1);
  store.inputPaused = true;
  input.activateCell(0);
  expect(store.activateBonusGem).toHaveBeenCalledTimes(1);
});
it('charges one move and no inventory for activation in place, and rejects paused/busy activation', async () => {
  const game = useGameStore();
  game.bootstrap();
  game.startLevel(1);
  game.board[0] = createGem('bomb');
  const moves = game.moves;
  expect(await game.activateBonusGem(0)).toBe(true);
  expect(game.moves).toBe(moves + 1);
  expect(useCampaignStore().powers.every((slot) => slot.quantity === 0)).toBe(true);
  game.board[0] = createGem('cross');
  for (const field of ['inputPaused', 'animationInProgress']) {
    game[field] = true;
    expect(await game.activateBonusGem(0)).toBe(false);
    game[field] = false;
  }
});

it('starts empty and persists only completed chapters as free mine appearance stages', () => {
  let campaign = useCampaignStore();
  expect(campaign.powers.every((slot) => slot.quantity === 0)).toBe(true);
  expect(campaign.bonusLimit).toBe(3);
  for (let id = 1; id <= 60; id++) {
    campaign.records[id] = { score: 1, stars: 1 };
    expect(campaign.mineStage).toBe(Math.floor(id / 6));
  }
  const coins = campaign.town.coins;
  campaign.save();
  setActivePinia(createPinia());
  campaign = useCampaignStore();
  expect(campaign.mineStage).toBe(10);
  expect(campaign.town.coins).toBe(coins);
  campaign.resetProgress();
  expect(campaign.mineStage).toBe(0);
});
it('identifies new obstacles from actual level tiles and remembers help across reloads', () => {
  const levels = generateLevelConfigs();
  const seen = new Set();
  for (const level of levels) for (const item of obstaclesInLevel(level.tiles)) seen.add(item.id);
  for (const id of [
    'ice',
    'stone',
    'double-ice',
    'reinforced',
    'chain',
    'seal-ruby',
    'seal-sapphire',
    'seal-emerald',
    'relic',
  ])
    expect(seen.has(id)).toBe(true);
  expect(obstaclesInLevel(levels[0].tiles).map((item) => item.id)).toEqual(['ice']);
  const campaign = useCampaignStore();
  campaign.markObstaclesSeen(['ice', 'chain']);
  campaign.finishTownTour();
  setActivePinia(createPinia());
  expect(useCampaignStore().seenObstacles).toEqual(['ice', 'chain']);
  expect(useCampaignStore().town.tourSeen).toBe(true);
  expect(OBSTACLES.every((item) => item.instruction && item.art)).toBe(true);
});

describe('Roulette receipts', () => {
  it('awards the tapped object exactly once and saves the choice before continuing', () => {
    const campaign = useCampaignStore();
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const rewards = win(campaign);
    expect(campaign.town.coins).toBe(0);
    expect(campaign.pendingChests).toHaveLength(2);
    expect(campaign.claimChest(rewards[0].id, 'builder-hammer')).toMatchObject({
      id: 'builder-hammer',
      quantity: 1,
    });
    expect(campaign.claimChest(rewards[0].id, 'tnt')).toBeNull();
    expect(campaign.builderHammers).toBe(1);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.builderHammers).toBe(1);
    expect(reloaded.town.coins).toBe(500); // The unopened speed chest falls back to coins.
    expect(reloaded.pendingChests).toEqual([]);
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(500);
  });
  it('settles skipped chests and converts a tapped full item within the storage rules', () => {
    const campaign = useCampaignStore();
    campaign.powers[0].quantity = 3;
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    const rewards = win(campaign);
    expect(campaign.claimChest(rewards[0].id, 'clear-row')).toMatchObject({
      kind: 'coins',
      quantity: 10,
    });
    expect(campaign.powers[0].quantity).toBe(3);
    expect(campaign.settlePendingChests()).toHaveLength(1);
    expect(campaign.settlePendingChests()).toEqual([]);
    expect(campaign.town.coins).toBe(510);
  });
  it('guarantees an automatic builder hammer within ten chests and persists the countdown', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.8);
    let campaign = useCampaignStore();
    for (let run = 0; run < 4; run++) win(campaign, false);
    expect(campaign.chestsWithoutBuilderHammer).toBe(8);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    const rewards = win(campaign, false);
    expect(rewards[1].items[0].id).toBe('builder-hammer');
    expect(campaign.builderHammers).toBe(1);
    expect(campaign.chestsWithoutBuilderHammer).toBe(0);
  });
  it('does not lose overflow value while recovering a pending chest from an older inventory', () => {
    saves.set(
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        issuedRun: 1,
        settledRun: 1,
        powers: [{ id: 'tnt', quantity: 5 }],
        pendingChests: [{ id: '1-score', source: 'score', runId: 1, items: [{ id: 'coins' }] }],
      }),
    );
    expect(useCampaignStore().town.coins).toBe(520);
    setActivePinia(createPinia());
    expect(useCampaignStore().town.coins).toBe(520);
  });
});

describe('Shop purchases and refresh', () => {
  it.each([
    [1, 1],
    [2, 2],
    [3, 5],
  ])('offers level %i stock without exceeding the catalog', (level, slots) => {
    const stock = rollShopStock(level, () => 0);
    expect(stock).toHaveLength(slots);
    expect(new Set(stock.map((item) => item.id)).size).toBe(slots);
    expect(stock.every((offer) => SHOP_ITEMS.some((item) => item.id === offer.id))).toBe(true);
  });
  it('requires a shop, funds purchases once, rejects full storage, and preserves stock after reload', () => {
    let campaign = useCampaignStore();
    campaign.town.coins = 300;
    expect(campaign.buyShopItem('tnt', 0)).toBe(false);
    campaign.town.buildings.shop = 2;
    campaign.shopStock = [
      { id: 'tnt', sold: false },
      { id: 'clear-row', sold: false },
    ];
    campaign.powers.find((power) => power.id === 'tnt').quantity = 3;
    expect(campaign.buyShopItem('tnt', 0)).toBe(false);
    expect(campaign.town.coins).toBe(300);
    campaign.powers.find((power) => power.id === 'tnt').quantity = 2;
    expect(campaign.buyShopItem('tnt', 0)).toBe(true);
    expect(campaign.buyShopItem('tnt', 0)).toBe(false);
    expect(campaign.town.coins).toBe(210);
    const stock = JSON.stringify(campaign.shopStock);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    campaign.ensureShopStock();
    expect(JSON.stringify(campaign.shopStock)).toBe(stock);
    expect(campaign.powers.find((power) => power.id === 'tnt').quantity).toBe(3);
  });
  it('removes legacy builder hammer offers while preserving purchases and earned hammers', () => {
    let campaign = useCampaignStore();
    campaign.town.buildings.shop = 3;
    campaign.town.coins = 300;
    campaign.builderHammers = 2;
    campaign.shopStock = [
      { id: 'builder-hammer', sold: false },
      { id: 'clear-row', sold: true },
    ];
    expect(campaign.buyShopItem('builder-hammer', campaign.shopVisit)).toBe(false);
    campaign.save();
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    campaign.ensureShopStock();
    expect(campaign.shopStock).toHaveLength(5);
    expect(campaign.shopStock.some((offer) => offer.id === 'builder-hammer')).toBe(false);
    expect(campaign.shopStock.find((offer) => offer.id === 'clear-row').sold).toBe(true);
    expect(campaign.builderHammers).toBe(2);
    expect(campaign.town.coins).toBe(300);
    expect(rollShopStock(5, () => 0, [{ id: 'builder-hammer', sold: false }])).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ id: 'builder-hammer' })]),
    );
  });
  it('refreshes on a completed normal mine only; stale purchases and duplicate victories cannot reroll', () => {
    const campaign = useCampaignStore();
    campaign.town.buildings.shop = 1;
    campaign.town.coins = 300;
    campaign.ensureShopStock();
    const visit = campaign.shopVisit;
    const before = JSON.stringify(campaign.shopStock);
    campaign.beginRun();
    campaign.beginRun();
    expect(JSON.stringify(campaign.shopStock)).toBe(before);
    const rewards = win(campaign);
    expect(campaign.shopVisit).toBe(visit + 1);
    expect(campaign.buyShopItem(campaign.shopStock[0].id, visit)).toBe(false);
    campaign.recordVictory({ id: 1, runId: rewards[0].runId, score: 10, target: 1 });
    expect(campaign.shopVisit).toBe(visit + 1);
    campaign.town.buildings.museum = 1;
    const runId = campaign.beginRun('continuous', 1);
    campaign.recordContinuous({ id: 1, runId, jewels: 250, score: 1000 });
    expect(campaign.shopVisit).toBe(visit + 1);
  });
  it('adds a shelf on upgrade without restocking already purchased offers', () => {
    const campaign = useCampaignStore();
    campaign.town.buildings.shop = 1;
    campaign.ensureShopStock();
    campaign.shopStock[0].sold = true;
    const sold = campaign.shopStock[0].id;
    campaign.town.buildings.shop = 2;
    campaign.ensureShopStock();
    expect(campaign.shopStock).toHaveLength(2);
    expect(campaign.shopStock.find((offer) => offer.id === sold).sold).toBe(true);
  });
});
it('requires bank and sheriff for full protection, each separately covers at most half', () => {
  for (const level of [1, 2, 3]) {
    const town = createTown();
    town.nextRaidRun = 0;
    town.coins = 1000;
    town.buildings.well = town.buildings.farm = town.buildings.home = 1;
    for (const [bank, sheriff, protection] of [
      [level, 0, 0.5],
      [0, level, 0.5],
      [level, level, 1],
    ]) {
      town.buildings.bank = bank;
      town.buildings.sheriff = sheriff;
      expect(raidProtection(town, level * 2)).toBe(protection);
    }
    expect(banditEncounter(town).events[BANDIT_EVENT].loss).toBe(0);
  }
});

describe('Collected gems and unused board bonuses fund the village', () => {
  it.each([
    [48, 3, 78],
    [1200, 0, 1200],
    [0, 2, 20],
    [-1, -2, 0],
    [1.5, NaN, 0],
    [10, Infinity, 10],
    [Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER],
  ])('values %s gems and %s bonuses at %s coins', (gems, bonuses, coins) => {
    expect(miningPayout(gems, bonuses)).toBe(coins);
  });
  it('snapshots unused bonuses at completion, saves the displayed payout once, and resets on the next mine', () => {
    // Leaving the results claims the guaranteed chest; keep this payout test on a power reward.
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const game = useGameStore(),
      campaign = useCampaignStore();
    game.bootstrap();
    game.startLevel(1);
    game.collectedJewels = 48;
    game.board = ['bomb', 'cross', 'rainbow', 'ruby'].map((type) => createGem(type));
    game.remainingLayers = 0;
    game.completeLevel();
    expect(game.remainingBonusGems).toBe(3);
    expect(game.coinReward).toBe(78);
    expect(campaign.town.coins).toBe(78);
    game.board[0] = createGem('ruby');
    game.completeLevel();
    expect(game.remainingBonusGems).toBe(3);
    expect(campaign.town.coins).toBe(78);
    expect(JSON.parse(saves.get(SAVE_KEY)).town.coins).toBe(78);
    game.startLevel(2);
    expect(game.remainingBonusGems).toBe(0);
    expect(game.coinReward).toBe(0);
    expect(campaign.town.coins).toBe(78);
  });
});

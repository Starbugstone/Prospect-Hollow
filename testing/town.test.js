import * as chestRewards from '../src/data/rewards';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, BANDIT_EVENT, createTown } from '../src/data/town';
import {
  advanceConstruction,
  finishConstruction,
  projectRuns,
  constructionRuns,
  banditEncounter,
  miningPayout,
  nextGoal,
  normalizeTown,
  population,
  purchase,
} from '../src/game/town/TownRules';
import { SAVE_KEY } from '../src/services/localProfile';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { useGameStore } from '../src/stores/gameStore';
import { TileManager } from '../src/game/engine/TileManager';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { createGem } from '../src/game/engine/GemFactory';

let saved;
beforeEach(() => {
  saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const victory = (runId, jewels = 90) => ({
  id: 1,
  score: 9000,
  target: 6000,
  combo: 1,
  elapsedMs: 10000,
  speedTargetMs: 60000,
  runId,
  jewels,
});
const settledTown = (coins = 200) => ({
  ...createTown(),
  nextRaidRun: 0,
  coins,
  buildings: { ...createTown().buildings, well: 1, farm: 1, home: 1 },
});

describe('A small, reachable town', () => {
  it.each([
    [0, 0],
    [1, 1],
    [90, 90],
    [100, 100],
    [500000, 500000],
    [-2, 0],
    [NaN, 0],
    [Infinity, 0],
  ])('pays %s jewels as %s coins', (gems, coins) => {
    expect(miningPayout(gems)).toBe(coins);
  });
  it('opens a basic first building immediately, while waiting for food and water to welcome residents', () => {
    const town = purchase(createTown(), 'home', 0);
    expect(town.coins).toBe(0);
    expect(town.buildings.home).toBe(1);
    expect(population(town)).toBe(0);
    expect(town.projects).toEqual({});
  });
  it('lets the player choose any first building without duplicate starts or a second free project', () => {
    for (const building of BUILDINGS.filter((b) => !b.unlock)) {
      const town = purchase(createTown(), building.id, 0);
      const immediate = building.upgrades[0].runs === 0;
      expect(town.buildings[building.id]).toBe(immediate ? 1 : 0);
      if (!immediate)
        expect(town.projects[building.id]).toMatchObject({ id: building.id, required: 1 });
      expect(purchase(town, building.id, 0)).toBeNull();
      expect(purchase(town, building.id === 'well' ? 'farm' : 'well', 0)).toBeNull();
    }
    expect(purchase(createTown(), '__proto__', 0)).toBeNull();
    expect(purchase(createTown(), 'home', 1)).toBeNull();
  });
  it('requires materials after the free project and keeps every improvement reachable', () => {
    let town = createTown(),
      runs = 0;
    while (nextGoal(town)) {
      const goal = nextGoal(town);
      while (town.coins < goal.cost || town.completedRuns < (goal.unlockRuns ?? 0)) {
        town.coins += miningPayout(60);
        runs++;
        town.completedRuns++;
      }
      town = purchase(town, goal.id, town.buildings[goal.id]);
      expect(town).not.toBeNull();
      const required = town.projects[goal.id] ? constructionRuns(town.projects[goal.id]) : 0;
      for (let i = 0; i < required; i++) {
        town.coins += miningPayout(60);
        town = advanceConstruction(town);
        runs++;
        town.completedRuns++;
      }
      if (required) town = finishConstruction(town, goal.id, town.projects[goal.id].stage);
    }
    expect(runs).toBeGreaterThan(0);
    expect(
      BUILDINGS.filter((b) => b.introducedEra === 'frontier').every(
        (b) => town.buildings[b.id] === b.upgrades.length,
      ),
    ).toBe(true);
    expect(population(town)).toBe(58);
    expect(town.coins).toBeGreaterThanOrEqual(0);
    expect(purchase(town, 'well', 5)).toBeNull();
    const broke = { ...settledTown(0) };
    expect(purchase(broke, 'saloon', 0)).toBeNull();
  });
  it('funds several larger buildings and opens each on a tap after one completion', () => {
    let town = { ...createTown(), coins: 300 };
    for (const id of ['saloon', 'stable', 'sheriff']) town = purchase(town, id, 0);
    expect(town.coins).toBe(0);
    expect(Object.keys(town.projects)).toHaveLength(3);
    expect(purchase(town, 'saloon', 0)).toBeNull();
    expect(town.buildings).toMatchObject({ saloon: 0, stable: 0, sheriff: 0 });
    town = advanceConstruction(town);
    expect(town.buildings).toMatchObject({ saloon: 0, stable: 0, sheriff: 0 });
    for (const id of ['saloon', 'stable', 'sheriff']) town = finishConstruction(town, id, 1);
    expect(town.buildings).toMatchObject({ saloon: 1, stable: 1, sheriff: 1 });
    expect(town.projects).toEqual({});
  });
  it('gives each later construction its own next-puzzle completion', () => {
    let town = purchase({ ...createTown(), coins: 200 }, 'saloon', 0);
    town = finishConstruction(advanceConstruction(town), 'saloon', 1);
    town = purchase(town, 'stable', 0);
    expect(town.buildings).toMatchObject({ saloon: 1, stable: 0 });
    expect(town.projects.stable).toMatchObject({ wins: 0, required: 1 });
    town = finishConstruction(advanceConstruction(town), 'stable', 1);
    expect(town.buildings.stable).toBe(1);
    expect(town.projects).toEqual({});
  });
  it('keeps existing services until one puzzle completes both an extension and a new building', () => {
    let town = purchase(settledTown(375), 'home', 1);
    town = purchase(town, 'sheriff', 0);
    expect(town.coins).toBe(0);
    expect(population(town)).toBe(2);
    expect(town.buildings.sheriff).toBe(0);
    town = advanceConstruction(town);
    expect(population(town)).toBe(2);
    town = finishConstruction(town, 'home', 2);
    town = finishConstruction(town, 'sheriff', 1);
    expect(population(town)).toBe(4);
    expect(town.buildings.sheriff).toBe(1);
  });
  it('welcomes households after the last essential building finishes, in any chosen order', () => {
    for (const order of [
      ['home', 'farm', 'well'],
      ['farm', 'well', 'home'],
      ['well', 'home', 'farm'],
    ]) {
      let town = { ...createTown(), coins: 500 };
      order.forEach((id, index) => {
        town = purchase(town, id, 0);
        for (let i = 0; i < projectRuns(id, 1); i++) {
          town = advanceConstruction(town);
          expect(population(town)).toBe(index === 2 && i === projectRuns(id, 1) - 1 ? 2 : 0);
        }
        expect(population(town)).toBe(index === 2 ? 2 : 0);
      });
    }
  });
  it('preserves a valid unfinished project and discards invalid work markers', () => {
    const town = purchase(createTown(), 'sheriff', 0);
    expect(normalizeTown(JSON.parse(JSON.stringify(town)))).toEqual(town);
    for (const project of [
      { id: '__proto__', stage: 1, wins: 1 },
      { id: 'sheriff', stage: 2, wins: 1 },
      { id: 'sheriff', stage: 1, wins: 3 },
    ])
      expect(normalizeTown({ ...town, projects: { [project.id]: project } }).projects).toEqual({});
  });
  it('retains valid concurrent receipts while discarding mismatched, duplicate and invalid work', () => {
    const museum = { id: 'museum', stage: 1, wins: 1, required: 1 };
    const saloon = { id: 'saloon', stage: 1, wins: 0, required: 1 };
    const town = normalizeTown({
      ...createTown(),
      projects: {
        museum,
        saloon,
        home: { id: 'home', stage: 1, wins: 0, required: 1 }, // Basic builds are immediate.
        well: { id: 'home', stage: 1, wins: 0, required: 1 },
        sheriff: { id: 'sheriff', stage: 1, wins: -1, required: 1 },
        copy: museum,
        bank: { id: 'bank', stage: 1, wins: 0, required: 4 },
      },
    });
    expect(town.projects).toEqual({ museum, saloon });
    expect(Object.values(town.buildings).every((stage) => stage === 0)).toBe(true);
  });
  it('warns through an optional event only after onboarding, caps loss, and preserves savings', () => {
    expect(banditEncounter(createTown())).toBeNull();
    for (const [coins, loss] of [
      [200, 10],
      [90, 9],
      [53, 3],
      [50, 0],
      [0, 0],
    ]) {
      const next = banditEncounter(settledTown(coins));
      expect(next.events[BANDIT_EVENT].loss).toBe(loss);
      expect(next.coins).toBe(coins - loss);
      expect(banditEncounter(next)).toBeNull();
    }
  });
  it('protects a small village with both bank and sheriff and cannot reroll saved outcomes', () => {
    const town = settledTown();
    town.buildings.sheriff = town.buildings.bank = 1;
    const next = banditEncounter(town);
    expect(next.events[BANDIT_EVENT]).toMatchObject({ outcome: 'protected', loss: 0, gangSize: 2 });
    expect(next.coins).toBe(200);
    expect(banditEncounter(normalizeTown(JSON.parse(JSON.stringify(next))))).toBeNull();
  });
});

describe('Profile and reward integrity', () => {
  it('resets both earlier profile generations once and preserves new progress', () => {
    const oldProfile = JSON.stringify({
      schemaVersion: 2,
      records: { 1: { score: 15000, stars: 3, bestTimeMs: 4321 } },
      continuousRecords: { 1: { score: 10000, coins: 50 } },
      powers: [{ id: 'tnt', quantity: 17 }],
      builderHammers: 5,
      pendingChests: [{ runId: 1, source: 'score', items: [{ id: 'coins' }] }],
      issuedRun: 1,
      settledRun: 1,
      town: { ...createTown(), coins: 10000, tourSeen: true },
    });
    for (const key of ['crystal-cascade-campaign-v1', 'crystal-cascade-profile-v2'])
      saved.set(key, oldProfile);
    const campaign = useCampaignStore();
    expect(campaign.records).toEqual({});
    expect(campaign.continuousRecords).toEqual({});
    expect(campaign.town).toEqual(createTown());
    expect(campaign.powers.every(({ quantity }) => quantity === 0)).toBe(true);
    expect(campaign.builderHammers).toBe(0);
    expect(campaign.pendingChests).toEqual([]);
    expect(campaign.issuedRun).toBe(0);
    campaign.town.coins = 27;
    campaign.records[1] = { score: 12345, stars: 2 };
    campaign.save();
    // An old open tab cannot resurrect progress into the new generation.
    saved.set('crystal-cascade-profile-v2', oldProfile);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.nextLevel).toBe(2);
    expect(reloaded.town.coins).toBe(27);
    expect(JSON.parse(saved.get(SAVE_KEY)).schemaVersion).toBe(2);
  });
  it('saves coins, chests, progress and settlement together; duplicate calls and reloads never pay twice', () => {
    const campaign = useCampaignStore();
    const id = campaign.beginRun();
    const rewards = campaign.recordVictory(victory(id));
    const checkpoint = JSON.parse(saved.get(SAVE_KEY));
    expect(checkpoint.town.coins).toBe(1090);
    expect(checkpoint.settledRun).toBe(id);
    expect(checkpoint.powers.reduce((sum, power) => sum + power.quantity, 0)).toBe(0);
    expect(rewards).toHaveLength(2);
    expect(campaign.recordVictory(victory(id))).toEqual([]);
    expect(JSON.parse(saved.get(SAVE_KEY))).toEqual(checkpoint);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.recordVictory(victory(id))).toEqual([]);
    reloaded.recordVictory(victory(reloaded.beginRun()));
    expect(reloaded.town.coins).toBe(2180);
  });
  it('rejects a replaced run and leaves power spending consistent with town purchases', () => {
    const campaign = useCampaignStore();
    const abandonedId = campaign.beginRun();
    const currentId = campaign.beginRun();
    expect(campaign.recordVictory(victory(abandonedId))).toEqual([]);
    expect(campaign.town.coins).toBe(0);
    campaign.recordVictory(victory(currentId));
    expect(campaign.upgradeBuilding('well', 0)).toBe(true);
    expect(campaign.upgradeBuilding('well', 0)).toBe(false);
    campaign.awardReward({ id: 'tnt', kind: 'power', label: 'Hammer', quantity: 1 });
    const hammerBefore = campaign.powers.find((power) => power.id === 'tnt').quantity;
    useInventoryStore().consumeItem('tnt');
    setActivePinia(createPinia());
    expect(useCampaignStore().town).toMatchObject({
      coins: 1090,
      buildings: { well: 1 },
      projects: {},
    });
    expect(useCampaignStore().powers.find((power) => power.id === 'tnt').quantity).toBe(
      hammerBefore - 1,
    );
  });
  it('settles a one-puzzle construction once and preserves its benefit across reloads', () => {
    let campaign = useCampaignStore();
    campaign.upgradeBuilding('museum', 0);
    expect(campaign.canReplay).toBe(false);
    const id = campaign.beginRun();
    campaign.recordVictory(victory(id));
    expect(campaign.lastConstruction).toMatchObject([{ wins: 1, ready: true }]);
    expect(campaign.recordVictory(victory(id))).toEqual([]);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(campaign.canReplay).toBe(false);
    expect(campaign.finishConstruction('museum', 1)).toBe(true);
    expect(campaign.finishConstruction('museum', 1)).toBe(false);
    expect(campaign.canReplay).toBe(true);
    expect(campaign.town.projects).toEqual({});
    expect(campaign.town.coins).toBe(1090);
  });
  it('settles all construction and one payout atomically, including retries after reload', () => {
    let campaign = useCampaignStore();
    campaign.town.coins = 300;
    for (const id of ['saloon', 'stable', 'sheriff'])
      expect(campaign.upgradeBuilding(id, 0)).toBe(true);
    const run = campaign.beginRun();
    campaign.recordVictory(victory(run));
    expect(campaign.lastConstruction).toHaveLength(3);
    expect(campaign.lastConstruction.every((p) => p.wins === 1 && p.ready)).toBe(true);
    const checkpoint = saved.get(SAVE_KEY);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(campaign.recordVictory(victory(run))).toEqual([]);
    expect(saved.get(SAVE_KEY)).toBe(checkpoint);
    expect(campaign.town.coins).toBe(1090);
    expect(Object.keys(campaign.town.projects)).toHaveLength(3);
    for (const id of ['saloon', 'stable', 'sheriff'])
      expect(campaign.finishConstruction(id, 1)).toBe(true);
    expect(campaign.town.projects).toEqual({});
  });
  it('resets town, campaign and powers durably without changing language or settings', () => {
    const campaign = useCampaignStore();
    campaign.recordVictory(victory(campaign.beginRun()));
    campaign.upgradeBuilding('home', 0);
    campaign.upgradeBuilding('farm', 0);
    expect(campaign.town.buildings).toMatchObject({ home: 1, farm: 1 });
    expect(campaign.resetProgress()).toBe(true);
    setActivePinia(createPinia());
    const reset = useCampaignStore();
    expect(reset.town).toEqual(createTown());
    expect(reset.records).toEqual({});
    expect(reset.powers.every((power) => power.quantity === 0)).toBe(true);
    expect(reset.issuedRun).toBe(0);
  });
  it('keeps a bandit result and its deduction in the same snapshot', () => {
    const campaign = useCampaignStore();
    campaign.town = settledTown(95);
    expect(campaign.resolveBandits()).toBe(true);
    setActivePinia(createPinia());
    const reloaded = useCampaignStore();
    expect(reloaded.town.coins).toBe(86);
    expect(reloaded.resolveBandits()).toBe(false);
    expect(reloaded.town.coins).toBe(86);
  });
  it('repairs malformed town fields without losing valid campaign records', () => {
    saved.set(
      SAVE_KEY,
      JSON.stringify({
        schemaVersion: 2,
        records: { 1: { stars: 2, score: 500 } },
        town: {
          coins: -15,
          buildings: { well: 99, farm: '1', home: 1 },
          events: { [BANDIT_EVENT]: { outcome: 'stolen', loss: -99 } },
        },
      }),
    );
    const campaign = useCampaignStore();
    expect(campaign.records[1].score).toBe(500);
    expect(campaign.town.coins).toBe(0);
    expect(campaign.town.buildings).toMatchObject({ well: 0, farm: 0, home: 1 });
    expect(campaign.town.events).toEqual({});
  });
  it('keeps gameplay usable and reports unavailable storage instead of claiming a save', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const campaign = useCampaignStore();
    campaign.recordVictory(victory(campaign.beginRun()));
    expect(campaign.town.coins).toBe(1090);
    expect(campaign.saveWarning).toContain('not saving');
    expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  });
  it('does not overwrite a corrupt or future-version save', () => {
    for (const data of ['{broken', '{"schemaVersion":99,"town":{"coins":400}}']) {
      saved.set(SAVE_KEY, data);
      setActivePinia(createPinia());
      const campaign = useCampaignStore();
      campaign.beginRun();
      expect(campaign.saveWarning).toBeTruthy();
      expect(saved.get(SAVE_KEY)).toBe(data);
    }
  });
});

describe('Jewels come from real removals', () => {
  it('counts overlapping blast targets once and excludes specials, relics, barriers, frozen and chained jewels', () => {
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValue([]);
    const board = [
      'ruby',
      'emerald',
      'bomb',
      'relic',
      null,
      'topaz',
      'sapphire',
      'bomb',
      'amethyst',
    ].map((type) => (type ? createGem(type) : null));
    const tiles = board.map(() => ({ type: 'standard', health: 0 }));
    tiles[4] = { type: 'blocker', health: 1 };
    tiles[5].chainHealth = 1;
    tiles[6].state = 'FROZEN';
    const result = new TileManager().getResolution({
      board,
      tiles,
      cols: 3,
      rows: 3,
      matches: [
        { type: 'tnt', indices: [0, 1, 2, 3, 4, 5, 6, 7, 8] },
        { type: 'clear-row', indices: [0, 1, 2] },
      ],
      bonuses: [{ type: 'bomb', index: 7 }],
    });
    expect(result.steps[0].collectedJewels).toEqual(
      [board[0], board[1], board[8]].map(({ id, type }) => ({ id, type })),
    );
  });
  it('counts newly refilled jewels on later cascade steps, even in the same cells', () => {
    const matches = [{ type: 'ruby', indices: [0, 1, 2] }];
    vi.spyOn(MatchEngine.prototype, 'findMatches').mockReturnValueOnce(matches).mockReturnValue([]);
    const result = new TileManager().getResolution({
      board: Array.from({ length: 3 }, () => createGem('ruby')),
      tiles: [{}, {}, {}],
      cols: 3,
      rows: 1,
      matches,
    });
    const jewels = result.steps.flatMap((step) => step.collectedJewels ?? []);
    expect(jewels).toHaveLength(6);
    expect(new Set(jewels.map((gem) => gem.id)).size).toBe(6);
  });
  it('banks a real run only on completion and resets collection on replay or abandonment', async () => {
    const game = useGameStore(),
      campaign = useCampaignStore();
    game.bootstrap();
    game.startLevel(1);
    const move = new MatchEngine();
    let pair;
    for (let a = 0; a < game.board.length && !pair; a++)
      for (const b of [a + 1, a + game.boardCols]) {
        if (
          move.evaluateSwap(game.board, game.boardCols, game.boardRows, a, b, game.tiles).matches
            .length
        ) {
          pair = [a, b];
          break;
        }
      }
    expect(await game.resolveSwap(...pair)).toBe(true);
    expect(game.collectedJewels).toBeGreaterThan(0);
    expect(campaign.town.coins).toBe(0);
    const payout = miningPayout(
      game.collectedJewels,
      game.board.filter((gem) => ['bomb', 'cross', 'rainbow'].includes(gem?.type)).length,
      game.comboCounts,
      game.multiMatchCounts,
    );
    game.remainingLayers = 0;
    game.completeLevel();
    expect(game.coinReward).toBe(payout);
    campaign.settlePendingChests();
    expect(campaign.town.coins).toBe(
      payout + game.levelRewards.reduce((sum, r) => sum + r.items[0].quantity, 0),
    );
    game.completeLevel();
    expect(campaign.town.coins).toBe(
      payout + game.levelRewards.reduce((sum, r) => sum + r.items[0].quantity, 0),
    );
    const savedCoins = campaign.town.coins;
    campaign.town.buildings.museum = 1;
    game.startLevel(1);
    expect(game.collectedJewels).toBe(0);
    game.exitLevel();
    expect(campaign.town.coins).toBe(savedCoins);
  });
});

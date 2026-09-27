import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import { useInventoryStore } from '../src/stores/inventoryStore';
import { AD_POLICY } from '../src/data/advertising';
import { AD_CHEST_DROPS, chestReward } from '../src/data/rewards';
import {
  canOfferRewardedShuffle,
  canRewardShuffle,
  rewardBonusChest,
  rewardManualShuffle,
} from '../src/services/adGameplay';

beforeEach(() => {
  const saves = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
    removeItem: (key) => saves.delete(key),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
function win(campaign, id = 1) {
  for (let i = 1; i < id; i++) campaign.records[i] = { score: 0, stars: 1 };
  return campaign.recordVictory({ id, score: 0, target: 100, combo: 1, chooseRewards: true });
}
function fakeAds(outcome = { rewarded: true, status: 'rewarded' }) {
  return { isAvailable: () => true, showRewarded: vi.fn(async () => outcome) };
}

it.each(['tap', 'skip', 'reload', 'import'])(
  'settles one bounded ad chest through %s without changing normal progression',
  (route) => {
    let campaign = useCampaignStore();
    win(campaign);
    expect(campaign.canOfferAdChest(campaign.settledRun)).toBe(false);
    campaign.settlePendingChests();
    const before = {
      coins: campaign.town.coins,
      hammers: campaign.builderHammers,
      runs: campaign.town.completedRuns,
      records: JSON.stringify(campaign.records),
      projects: JSON.stringify(campaign.town.projects),
      pity: campaign.chestsWithoutBuilderHammer,
    };
    vi.spyOn(Math, 'random').mockReturnValue(0.999);
    const run = campaign.settledRun;
    const chest = campaign.grantAdChest(run, 1);
    expect(chest.source).toBe('ad');
    expect(campaign.grantAdChest(run, 1)).toBeNull();
    expect(campaign.town.coins).toBe(before.coins);
    if (route === 'tap') {
      expect(campaign.claimChest(chest.id, 'builder-hammer').quantity).toBe(AD_POLICY.chestCoins);
      expect(campaign.claimChest(chest.id)).toBeNull();
    }
    if (route === 'skip') campaign.settlePendingChests();
    if (route === 'import') campaign.importSave(campaign.exportSave());
    if (route === 'reload') {
      setActivePinia(createPinia());
      campaign = useCampaignStore();
    }
    expect(campaign.town.coins).toBe(before.coins + AD_POLICY.chestCoins);
    expect(campaign.builderHammers).toBe(before.hammers);
    expect(campaign.town.completedRuns).toBe(before.runs);
    expect(JSON.stringify(campaign.records)).toBe(before.records);
    expect(JSON.stringify(campaign.town.projects)).toBe(before.projects);
    expect(campaign.chestsWithoutBuilderHammer).toBe(before.pity);
    setActivePinia(createPinia());
    expect(useCampaignStore().canOfferAdChest(run)).toBe(false);
    expect(useCampaignStore().pendingChests).toEqual([]);
  },
);

it('caps optional chests per local day, does not reset on clock rollback, and has no hammer drop', () => {
  const campaign = useCampaignStore();
  const today = new Date(2026, 8, 27, 12);
  for (let i = 0; i < AD_POLICY.chestsPerDay; i++) {
    win(campaign);
    campaign.settlePendingChests();
    expect(campaign.grantAdChest(campaign.settledRun, 1, today)).toBeTruthy();
    campaign.settlePendingChests();
  }
  win(campaign);
  campaign.settlePendingChests();
  expect(campaign.canOfferAdChest(campaign.settledRun, today)).toBe(false);
  expect(campaign.canOfferAdChest(campaign.settledRun, new Date(2026, 8, 26))).toBe(false);
  expect(campaign.canOfferAdChest(campaign.settledRun, new Date(2026, 8, 28))).toBe(true);
  expect(AD_CHEST_DROPS.some((drop) => drop.kind === 'builder-hammer')).toBe(false);
  expect(chestReward('coins', 144, 2, 'ad').quantity).toBe(AD_POLICY.chestCoins);
});

it('does not commit an optional benefit when its receipt cannot be saved', () => {
  const campaign = useCampaignStore();
  win(campaign);
  campaign.settlePendingChests();
  const before = JSON.stringify(campaign.advertising);
  vi.spyOn(campaign, 'save').mockReturnValue(false);
  expect(campaign.grantAdChest(campaign.settledRun, 1)).toBeNull();
  expect(JSON.stringify(campaign.advertising)).toBe(before);
  expect(campaign.pendingChests).toEqual([]);
});

it.each([6, 12, 60])(
  'persists and consumes the chapter %i transition once across reload and replay',
  (id) => {
    let campaign = useCampaignStore();
    win(campaign, id);
    campaign.settlePendingChests();
    expect(campaign.advertising.pendingChapterAd.nextLevelId).toBe(id + 1);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(campaign.consumeChapterAd(id)).toBe(false);
    expect(campaign.consumeChapterAd(id + 1)).toBe(true);
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    expect(campaign.consumeChapterAd(id + 1)).toBe(false);
    win(campaign, id);
    expect(campaign.advertising.pendingChapterAd).toBeNull();
  },
);

it.each(['dismissed', 'not-available', 'error'])('grants no chest for %s', async (status) => {
  const campaign = useCampaignStore(),
    game = useGameStore();
  game.bootstrap();
  game.startLevel(1);
  game.remainingLayers = 0;
  game.completeLevel();
  campaign.settlePendingChests();
  const before = JSON.parse(campaign.exportSave()).profile;
  expect(
    await rewardBonusChest({ game, campaign, ads: fakeAds({ status, rewarded: false }) }),
  ).toBeNull();
  expect(JSON.parse(campaign.exportSave()).profile).toEqual(before);
});

it('rejects a late completion after the mine session has changed', async () => {
  const campaign = useCampaignStore(),
    game = useGameStore();
  game.bootstrap();
  game.startLevel(1);
  game.remainingLayers = 0;
  game.completeLevel();
  campaign.settlePendingChests();
  let complete;
  const ads = fakeAds();
  ads.showRewarded = () =>
    new Promise((resolve) => {
      complete = resolve;
    });
  const pending = rewardBonusChest({ game, campaign, ads });
  game.exitLevel();
  complete({ rewarded: true });
  expect(await pending).toBeNull();
  expect(campaign.advertising.lastChestRun).toBe(0);
});

it('gives stored shuffle priority and permits one immediate rewarded shuffle without inventory', async () => {
  const game = useGameStore(),
    campaign = useCampaignStore(),
    inventory = useInventoryStore();
  game.bootstrap();
  game.startLevel(1);
  const slot = campaign.powers.find((power) => power.id === 'shuffle');
  slot.quantity = 1;
  const ads = fakeAds();
  expect(await rewardManualShuffle({ game, campaign, inventory, ads })).toBe(false);
  expect(ads.showRewarded).not.toHaveBeenCalled();
  slot.quantity = 0;
  expect(await rewardManualShuffle({ game, campaign, inventory, ads })).toBe(true);
  expect(slot.quantity).toBe(0);
  expect(await rewardManualShuffle({ game, campaign, inventory, ads })).toBe(false);
  expect(ads.showRewarded).toHaveBeenCalledTimes(1);
});

it.each([
  ['animationInProgress', true],
  ['inputPaused', true],
  ['activeBonusMode', 'color_wand'],
])('keeps the shuffle offer visible during %s without starting an ad', async (property, value) => {
  const game = useGameStore(),
    campaign = useCampaignStore(),
    inventory = useInventoryStore();
  game.bootstrap();
  game.startLevel(1);
  const previous = game[property];
  game[property] = value;
  const ads = fakeAds();
  expect(canOfferRewardedShuffle(game, campaign, inventory)).toBe(true);
  expect(await rewardManualShuffle({ game, campaign, inventory, ads })).toBe(false);
  expect(ads.showRewarded).not.toHaveBeenCalled();
  game[property] = previous;
  expect(canRewardShuffle(game, campaign, inventory)).toBe(true);
});

it('leaves no-fill boards untouched, excludes continuous play, and keeps automatic dead-board recovery free', async () => {
  const game = useGameStore(),
    campaign = useCampaignStore(),
    inventory = useInventoryStore();
  game.bootstrap();
  game.startLevel(1);
  const board = JSON.stringify(game.board);
  const ads = fakeAds({ rewarded: false, status: 'not-available' });
  expect(await rewardManualShuffle({ game, campaign, inventory, ads })).toBe(false);
  expect(JSON.stringify(game.board)).toBe(board);
  game.playMode = 'continuous';
  expect(canRewardShuffle(game, campaign, inventory)).toBe(false);
  game.playMode = 'normal';
  const playable = vi.spyOn(game, '_hasPlayableMove').mockReturnValue(false);
  expect(canRewardShuffle(game, campaign, inventory)).toBe(false);
  const shuffle = vi.spyOn(game, 'shuffleBoard').mockImplementation(async () => {
    playable.mockReturnValue(true);
    return true;
  });
  await game.ensurePlayableBoard();
  expect(shuffle).toHaveBeenCalledTimes(1);
  expect(ads.showRewarded).toHaveBeenCalledTimes(1); // only the earlier voluntary no-fill attempt
  expect(campaign.advertising.lastShuffleRun).toBe(0);
});

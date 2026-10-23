import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createTown } from '../src/data/town';
import { normalizeTown, buildWithHammer, finishConstruction } from '../src/game/town/TownRules';
import { useCampaignStore } from '../src/stores/campaignStore';
import { advanceMoonstoneProduction, MOONSTONE_ECONOMY } from '../src/data/moonstones';
import { priceCurrency, currencyBalance, canAffordPrice, payPrice } from '../src/data/townCurrency';
import { createSaveFile, parseSaveFile } from '../src/services/saveTransfer';

let values;
beforeEach(() => {
  values = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => values.get(k) ?? null,
    setItem: (k, v) => values.set(k, v),
    removeItem: (k) => values.delete(k),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const legacy = () => {
  const town = createTown();
  for (const key of ['moonstoneVersion', 'moonstones', 'moonstonesEarned', 'moonstoneProduction'])
    delete town[key];
  town.buildings.ribbonLanding = 2;
  town.buildings.moonstoneWorkshop = 3;
  return town;
};
it('credits old keepsakes exactly once, including after spending and export/import', () => {
  const town = normalizeTown(legacy());
  expect(town).toMatchObject({ moonstones: 5, moonstonesEarned: 5, moonstoneVersion: 1 });
  expect(normalizeTown(town)).toEqual(town);
  const campaign = useCampaignStore();
  campaign.town = town;
  expect(campaign.spendMoonstones(4, 'future-monument')).toBe(true);
  campaign.importSave(createSaveFile(campaign.profile()));
  campaign.reloadLocal();
  expect(campaign.town).toMatchObject({ moonstones: 1, moonstonesEarned: 5 });
  expect(parseSaveFile(campaign.exportSave()).schemaVersion).toBe(3);
});
it('fallback for empty saves and malformed modern balances is bounded', () => {
  expect(normalizeTown()).toMatchObject({ moonstones: 0, moonstonesEarned: 0 });
  expect(normalizeTown({ ...createTown(), moonstones: 999, moonstonesEarned: 3 })).toMatchObject({
    moonstones: 3,
    moonstonesEarned: 3,
  });
  expect(normalizeTown({ ...createTown(), moonstones: -4, moonstonesEarned: NaN })).toMatchObject({
    moonstones: 0,
    moonstonesEarned: 0,
  });
});
it('rewards construction and hammer completion once per real Moon level', () => {
  const town = { ...createTown(), era: 'twin-hollows' };
  town.buildings.spaceElevator = 1;
  town.projects.ribbonLanding = { id: 'ribbonLanding', stage: 1, wins: 2, required: 2 };
  const next = finishConstruction(town, 'ribbonLanding', 1);
  expect(next).toMatchObject({ moonstones: 1, moonstonesEarned: 1 });
  expect(finishConstruction(next, 'ribbonLanding', 1)).toBeNull();
  const hammered = buildWithHammer(next, 'ribbonLanding', 1);
  expect(hammered).toMatchObject({ moonstones: 2, moonstonesEarned: 2 });
  expect(buildWithHammer(hammered, 'ribbonLanding', 1)).toBeNull();
});
it.each([1, 2, 3])(
  'produces a capped level-%s batch after three puzzles and collects atomically',
  (level) => {
    const campaign = useCampaignStore();
    campaign.town.buildings.moonstoneWorkshop = level;
    campaign.town = advanceMoonstoneProduction(advanceMoonstoneProduction(campaign.town));
    expect(campaign.collectMoonstones()).toBe(0);
    campaign.town = advanceMoonstoneProduction(campaign.town);
    for (let i = 0; i < 100; i++) campaign.town = advanceMoonstoneProduction(campaign.town);
    expect(campaign.town.moonstoneProduction.charge).toBe(level);
    expect(campaign.collectMoonstones()).toBe(level);
    expect(campaign.collectMoonstones()).toBe(0);
    expect(campaign.town).toMatchObject({ moonstones: level, moonstonesEarned: level });
  },
);
it('normal victories advance production; continuous mode and opening a run do not', () => {
  const campaign = useCampaignStore();
  campaign.town.buildings.moonstoneWorkshop = 3;
  campaign.town.buildings.museum = 1;
  for (let i = 0; i < 3; i++) {
    const runId = campaign.beginRun('normal', 1);
    campaign.recordVictory({
      id: 1,
      runId,
      jewels: 10,
      score: 100,
      target: 100,
      combo: 1,
      elapsedMs: 1000,
      speedTargetMs: 60000,
    });
  }
  expect(campaign.town.moonstoneProduction.charge).toBe(3);
  campaign.collectMoonstones();
  const runId = campaign.beginRun('continuous', 1);
  campaign.recordContinuous({ id: 1, runId, jewels: 100, score: 1000 });
  expect(campaign.town.moonstoneProduction).toEqual({ charge: 0, progress: 0 });
});
it('sells exact amounts at the shared rate, retains lifetime credit and rejects overflow', () => {
  const campaign = useCampaignStore();
  campaign.town = normalizeTown(legacy());
  expect(campaign.sellMoonstones(1)).toBe(true);
  expect(campaign.town).toMatchObject({
    moonstones: 4,
    moonstonesEarned: 5,
    coins: MOONSTONE_ECONOMY.saleCoins,
  });
  expect(campaign.sellMoonstones(10)).toBe(false);
  expect(campaign.sellMoonstones(4)).toBe(true);
  expect(campaign.town).toMatchObject({ moonstones: 0, coins: 5 * MOONSTONE_ECONOMY.saleCoins });
  expect(campaign.sellMoonstones(1)).toBe(false);
  campaign.town.moonstones = 1;
  campaign.town.coins = Number.MAX_SAFE_INTEGER;
  expect(campaign.sellMoonstones(1)).toBe(false);
  expect(campaign.town.moonstones).toBe(1);
});
it.each([0, -1, NaN, Infinity, 1.5, 6, Number.MAX_SAFE_INTEGER])(
  'never overspends an invalid or unaffordable amount %s',
  (amount) => {
    const campaign = useCampaignStore();
    campaign.town = normalizeTown(legacy());
    expect(campaign.spendMoonstones(amount, 'monument')).toBe(false);
    expect(campaign.town.moonstones).toBe(5);
  },
);
it('rolls back both currencies and the receipt when persistence fails', () => {
  const campaign = useCampaignStore();
  campaign.town = normalizeTown(legacy());
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('disk full');
  });
  expect(campaign.sellMoonstones(5)).toBe(false);
  expect(campaign.spendMoonstones(5, 'monument')).toBe(false);
  expect(campaign.town).toMatchObject({ moonstones: 5, coins: 0 });
  expect(campaign.integrity.actions).toEqual([]);
});
it('offers a currency hook for future sites, with a safe default and unknown-currency fallback', () => {
  const town = { coins: 50, moonstones: 5 };
  expect(priceCurrency({ currency: 'moonstones' })).toBe('moonstones');
  expect(currencyBalance(town, 'moonstones')).toBe(5);
  expect(payPrice(town, { price: 4, currency: 'moonstones' })).toEqual({
    coins: 50,
    moonstones: 1,
  });
  expect(payPrice(town, { price: 50 })).toEqual({ coins: 0, moonstones: 5 });
  expect(canAffordPrice(town, { price: 6, currency: 'moonstones' })).toBe(false);
  expect(payPrice(town, { price: 0, currency: 'unknown' })).toBeNull();
});

it('rejects damaged version-3 transfers without changing the live town', () => {
  const campaign = useCampaignStore();
  campaign.town = normalizeTown(legacy());
  const file = JSON.parse(campaign.exportSave());
  file.profile.town.moonstoneProduction = { charge: 4, progress: 0 };
  expect(() => campaign.importSave(JSON.stringify(file))).toThrow('invalid moonstones');
  expect(campaign.town.moonstones).toBe(5);
});

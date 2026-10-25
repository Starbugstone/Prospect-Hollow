import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createApp, createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { loadFrench, setLocale } from '../src/i18n';
import TownMoonstoneWorkshop from '../src/components/town/TownMoonstoneWorkshop.vue';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import { createTown } from '../src/data/town';
import { normalizeTown, buildWithHammer, finishConstruction } from '../src/game/town/TownRules';
import { freshProfile, SAVE_KEY, useCampaignStore } from '../src/stores/campaignStore';
import { createLocalIntegrityPlugin } from '../src/services/localIntegrity';
import { advanceMoonstoneProduction, MOONSTONE_ECONOMY } from '../src/data/moonstones';
import { priceCurrency, currencyBalance, canAffordPrice, payPrice } from '../src/data/townCurrency';
import { AREA_BY_ID, landmarkOffer } from '../src/data/townLandmarks';
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
  setLocale('en');
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
  expect(town).toMatchObject({ moonstones: 5, moonstonesEarned: 5, moonstoneVersion: 2 });
  expect(normalizeTown(town)).toEqual(town);
  const campaign = useCampaignStore();
  campaign.town = town;
  expect(campaign.spendMoonstones(4, 'future-monument')).toBe(true);
  campaign.importSave(createSaveFile(campaign.profile()));
  campaign.reloadLocal();
  expect(campaign.town).toMatchObject({ moonstones: 1, moonstonesEarned: 5 });
  expect(parseSaveFile(campaign.exportSave()).schemaVersion).toBe(4);
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
  'stores up to ten level-%s batches after three puzzles and collects atomically',
  (level) => {
    const campaign = useCampaignStore();
    campaign.town.buildings.moonstoneWorkshop = level;
    campaign.town = advanceMoonstoneProduction(advanceMoonstoneProduction(campaign.town));
    expect(campaign.collectMoonstones()).toBe(0);
    campaign.town = advanceMoonstoneProduction(campaign.town);
    for (let i = 0; i < 100; i++) campaign.town = advanceMoonstoneProduction(campaign.town);
    expect(campaign.town.moonstoneProduction.stored).toBe(10 * level);
    expect(campaign.collectMoonstones()).toBe(10 * level);
    expect(campaign.collectMoonstones()).toBe(0);
    expect(campaign.town).toMatchObject({ moonstones: 10 * level, moonstonesEarned: 10 * level });
  },
);
// The shipped game installs the integrity guard before any store exists; every
// moonstone action must open its mutation scope, or nothing it changes can be saved.
it('collects, sells and spends moonstones through the shipped integrity guard', () => {
  const profile = freshProfile();
  profile.town = normalizeTown(legacy());
  profile.town.moonstoneProduction = { ...profile.town.moonstoneProduction, stored: 3 };
  values.set(SAVE_KEY, JSON.stringify(profile));
  const pinia = createPinia();
  pinia.use(createLocalIntegrityPlugin());
  createApp({}).use(pinia);
  setActivePinia(pinia);
  const campaign = useCampaignStore(pinia);
  campaign.town.moonstones = 999;
  expect(campaign.town.moonstones).toBe(5);
  expect(campaign.collectMoonstones()).toBe(3);
  expect(campaign.town).toMatchObject({ moonstones: 8, moonstonesEarned: 8 });
  expect(campaign.town.moonstoneProduction.stored).toBe(0);
  expect(campaign.sellMoonstones(2)).toBe(true);
  expect(campaign.town).toMatchObject({ moonstones: 6, coins: 2 * MOONSTONE_ECONOMY.saleCoins });
  expect(campaign.spendMoonstones(1, 'future-monument')).toBe(true);
  expect(campaign.integrity.actions.map(({ kind }) => kind)).toEqual([
    'moonstone-collect',
    'moonstone-sell',
    'moonstone-spend',
  ]);
  expect(JSON.parse(values.get(SAVE_KEY)).town).toMatchObject({
    moonstones: 5,
    moonstonesEarned: 8,
    coins: 2 * MOONSTONE_ECONOMY.saleCoins,
  });
});
it('normal victories and continuous gems advance production; opening a run does not', () => {
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
  expect(campaign.town.moonstoneProduction.stored).toBe(3);
  campaign.collectMoonstones();
  const runId = campaign.beginRun('continuous', 1);
  campaign.recordContinuous({ id: 1, runId, jewels: 300, score: 1000 });
  expect(campaign.town.moonstoneProduction).toEqual({ stored: 0, progress: 1 });
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
it('pays the scheduled moonstone offer exactly without changing coins or lifetime earnings', () => {
  const area = AREA_BY_ID['moonstone-garden'];
  const town = {
    ...createTown(),
    era: area.era,
    coins: 5000,
    moonstones: 20,
    moonstonesEarned: 60,
  };
  const terms = { ...landmarkOffer(town, area, area.choices[0]), currency: area.currency };
  expect(terms.price).toBe(20);
  expect(canAffordPrice({ ...town, moonstones: 19 }, terms)).toBe(false);
  expect(payPrice({ ...town, moonstones: 19 }, terms)).toBeNull();
  expect(payPrice(town, terms)).toEqual({ ...town, moonstones: 0 });
  expect(town.moonstones).toBe(20);
});

it('rejects damaged version-3 transfers without changing the live town', () => {
  const campaign = useCampaignStore();
  campaign.town = normalizeTown(legacy());
  const file = JSON.parse(campaign.exportSave());
  file.profile.town.moonstoneProduction = { stored: 31, progress: 0 };
  expect(() => campaign.importSave(JSON.stringify(file))).toThrow('invalid moonstones');
  expect(campaign.town.moonstones).toBe(5);
});

it('migrates a v1 ready batch once without recrediting spent balances on reload/import', () => {
  const campaign = useCampaignStore();
  const file = JSON.parse(campaign.exportSave());
  Object.assign(file.profile.town, {
    moonstoneVersion: 1,
    moonstones: 2,
    moonstonesEarned: 9,
    moonstoneProduction: { progress: 0, charge: 3 },
  });
  file.profile.town.buildings.moonstoneWorkshop = 3;
  file.profile.schemaVersion = 3;
  campaign.importSave(JSON.stringify(file));
  campaign.reloadLocal();
  expect(campaign.town).toMatchObject({
    moonstoneVersion: 2,
    moonstones: 2,
    moonstonesEarned: 9,
    moonstoneProduction: { progress: 0, stored: 3 },
  });
  expect(campaign.collectMoonstones(1000)).toBe(3);
  campaign.importSave(campaign.exportSave());
  campaign.reloadLocal();
  expect(campaign.town).toMatchObject({
    moonstones: 5,
    moonstonesEarned: 12,
    moonstoneProduction: { progress: 0, stored: 0 },
  });
});
it('accumulates batches while retaining partial progress through collection and upgrades', () => {
  const c = useCampaignStore();
  c.town.era = 'twin-hollows';
  c.town.buildings.spaceElevator = 1;
  c.town.buildings.moonstoneWorkshop = 1;
  for (let n = 0; n < 8; n++) c.town = advanceMoonstoneProduction(c.town);
  expect(c.town.moonstoneProduction).toEqual({ progress: 2, stored: 2 });
  c.town = buildWithHammer(c.town, 'moonstoneWorkshop', 1);
  expect(c.town.moonstoneProduction).toEqual({ progress: 2, stored: 2 });
  expect(c.collectMoonstones(1000)).toBe(2);
  c.town = advanceMoonstoneProduction(c.town);
  expect(c.town.moonstoneProduction).toEqual({ progress: 0, stored: 2 });
  c.town.moonstoneProduction = { progress: 2, stored: 20 };
  for (let n = 0; n < 10; n++) c.town = advanceMoonstoneProduction(c.town);
  expect(c.town.moonstoneProduction).toEqual({ progress: 2, stored: 20 });
  expect(c.collectMoonstones(31000)).toBe(20);
  c.town = advanceMoonstoneProduction(c.town);
  expect(c.town.moonstoneProduction).toEqual({ progress: 0, stored: 2 });
});
it('bounds the final batch after an upgrade with a stock not divisible by the new level', () => {
  const c = useCampaignStore();
  c.town.buildings.moonstoneWorkshop = 3;
  c.town.moonstoneProduction = { progress: 2, stored: 29 };
  c.town = advanceMoonstoneProduction(c.town);
  expect(c.town.moonstoneProduction).toEqual({ progress: 0, stored: 30 });
});
const continuous = (c, id, jewels, runId = c.beginRun('continuous', id)) => {
  expect(c.recordContinuous({ id, runId, jewels, score: jewels })).toBe(true);
  return runId;
};
it('credits continuous gems incrementally, with a separate lifetime allowance per level', () => {
  let c = useCampaignStore();
  c.town.buildings.museum = 1;
  c.town.buildings.moonstoneWorkshop = 3;
  c.records[1] = { score: 100, stars: 1 };
  const run = continuous(c, 1, 299);
  expect(c.town.moonstoneProduction.progress).toBe(0);
  continuous(c, 1, 299, run);
  continuous(c, 1, 300, run);
  expect(c.town.moonstoneProduction).toEqual({ progress: 1, stored: 0 });
  continuous(c, 1, 600, run);
  expect(c.town.moonstoneProduction).toEqual({ progress: 2, stored: 0 });
  c.reloadLocal();
  continuous(c, 1, 299);
  expect(c.continuousRecords[1].moonstoneGems).toBe(899);
  continuous(c, 1, 9999);
  expect(c.continuousRecords[1].moonstoneGems).toBe(900);
  expect(c.town.moonstoneProduction).toEqual({ progress: 0, stored: 3 });
  continuous(c, 1, 9999);
  expect(c.town.moonstoneProduction.stored).toBe(3);
  continuous(c, 2, 900);
  expect(c.town.moonstoneProduction.stored).toBe(6);
  expect(c.records[2]).toBeUndefined();
  expect(c.town.completedRuns).toBe(0);
  expect(c.pendingChests).toEqual([]);
});
it('discards gems while unbuilt/full and resumes without consuming unused allowance', () => {
  const c = useCampaignStore();
  c.town.buildings.museum = 1;
  continuous(c, 1, 999);
  expect(c.continuousRecords[1].moonstoneGems ?? 0).toBe(0);
  c.town.buildings.moonstoneWorkshop = 1;
  c.town.moonstoneProduction = { progress: 2, stored: 9 };
  const run = continuous(c, 1, 750);
  expect(c.town.moonstoneProduction.stored).toBe(10);
  expect(c.continuousRecords[1].moonstoneGems).toBe(300);
  continuous(c, 1, 1000, run);
  expect(c.continuousRecords[1].moonstoneGems).toBe(300);
  expect(c.collectMoonstones(1000)).toBe(10);
  continuous(c, 1, 1300, run);
  expect(c.continuousRecords[1].moonstoneGems).toBe(600);
  expect(c.town.moonstoneProduction.progress).toBe(1);
});
it('rolls back continuous allowance, progress, coins and receipt when storage fails', () => {
  const c = useCampaignStore();
  c.town.buildings.museum = 1;
  c.town.buildings.moonstoneWorkshop = 3;
  const run = c.beginRun('continuous', 1);
  const before = JSON.parse(
    JSON.stringify({ town: c.town, records: c.continuousRecords, integrity: c.integrity }),
  );
  vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
    throw new Error('full');
  });
  expect(c.recordContinuous({ id: 1, runId: run, jewels: 900, score: 100 })).toBe(false);
  expect(c.town).toEqual(before.town);
  expect(c.continuousRecords).toEqual(before.records);
  expect(c.integrity).toEqual(before.integrity);
});

it('keeps v1 partial progress and bounds malformed continuous allowance on reload', () => {
  const c = useCampaignStore();
  c.town.buildings.moonstoneWorkshop = 2;
  const migrated = normalizeTown({
    ...c.town,
    moonstoneVersion: 1,
    moonstoneProduction: { progress: 2, charge: 0 },
  });
  expect(migrated.moonstoneProduction).toEqual({ progress: 2, stored: 0 });
  c.town = migrated;
  c.continuousRecords[1] = { coins: 0, score: 0, moonstoneGems: 999 };
  c.save();
  c.reloadLocal();
  expect(c.continuousRecords[1].moonstoneGems).toBe(900);
  expect(advanceMoonstoneProduction(c.town).moonstoneProduction).toEqual({
    progress: 0,
    stored: 2,
  });
});

it.each([1, 2, 3])(
  'previews workshop level %s production and storage ahead of generic visitors',
  (level) => {
    const town = createTown();
    town.era = 'twin-hollows';
    town.buildings.moonstoneWorkshop = level - 1;
    expect(buildingBenefit(town, 'moonstoneWorkshop', level)).toEqual({
      icon: 'moonstone',
      label: 'Moonstones per batch',
      before: level - 1,
      after: level,
      suffix: '',
      additional: [
        {
          icon: 'moonstone',
          label: 'Moonstone storage capacity',
          before: (level - 1) * 10,
          after: level * 10,
          suffix: '',
        },
      ],
    });
    expect(town.buildings.moonstoneWorkshop).toBe(level - 1);
  },
);

it('rolls back collect-all stock, partial progress, balances and cooldown on a failed save', () => {
  const c = useCampaignStore();
  c.town.buildings.moonstoneWorkshop = 3;
  c.town.moonstoneProduction = { progress: 2, stored: 12 };
  const before = JSON.parse(JSON.stringify(c.town));
  vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.collectMoonstones(1000)).toBe(0);
  expect(c.town).toEqual(before);
  expect(c.integrity.actions).toEqual([]);
});

it.each([
  ['en', 'every 300 gems advances production by one puzzle'],
  ['fr', 'chaque groupe de 300 gemmes fait avancer la production d’un puzzle'],
])('shows the shared continuous rate in the %s workshop panel', async (language, phrase) => {
  await loadFrench();
  setLocale(language);
  const town = createTown();
  town.buildings.moonstoneWorkshop = 3;
  const html = await renderToString(
    createSSRApp({ render: () => h(TownMoonstoneWorkshop, { town, sellMoonstones: () => false }) }),
  );
  expect(html).toContain(phrase);
});

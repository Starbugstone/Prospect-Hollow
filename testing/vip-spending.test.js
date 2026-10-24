import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownResourceCollection from '../src/components/town/TownResourceCollection.vue';
import { vipSpend, VIP_SPEND_VERSION } from '../src/data/vipVisits';
import { LEVEL_COUNT } from '../src/data/campaign';
import { chapterLevelIds } from '../src/data/chapters';
import { useCampaignStore } from '../src/stores/campaignStore';
import { loadIntegrity } from '../src/services/saveIntegrity';

beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const record = { score: 1000, stars: 1 };
const receipt = { tour: 'depth-tour', stop: 0, building: 'saloon', visitor: { vip: true } };

it.each([1, 30, 60, 91])(
  'pays five times completed chapter %i, independent of town era',
  (chapter) => {
    const id = chapterLevelIds(chapter - 1)[0];
    expect(vipSpend({ [id]: record })).toBe(5 * chapter);
  },
);
it('ignores unsupported records and falls back to chapter one beyond the catalog', () => {
  expect(vipSpend()).toBe(5);
  expect(vipSpend({ [LEVEL_COUNT + 1]: record, '-1': record, bad: record })).toBe(5);
  expect(vipSpend({ 175: record, [LEVEL_COUNT + 1]: record })).toBe(150);
  expect(vipSpend({ 541: record }, 0)).toBe(5);
  expect(vipSpend({ 541: record }, 2)).toBe(0);
});
it('credits the scaled wallet and versioned receipt atomically, persists and prevents duplicate payments', () => {
  let c = useCampaignStore();
  c.town.buildings.saloon = 1;
  c.records[541] = record;
  const coins = c.town.coins;
  expect(c.collectVipSpending(receipt)).toBe(455);
  expect(c.town.coins).toBe(coins + 455);
  expect(c.integrity.actions.at(-1)).toMatchObject({
    kind: 'vip-spend',
    data: {
      key: 'depth-tour:0',
      buildingId: 'saloon',
      economyVersion: VIP_SPEND_VERSION,
    },
  });
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.collectVipSpending(receipt)).toBe(0);
  expect(c.town.coins).toBe(coins + 455);
  const journal = c.integrity;
  vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.collectVipSpending({ ...receipt, stop: 1 })).toBe(0);
  expect(c.town.coins).toBe(coins + 455);
  expect(c.vipReceipts).toEqual(['depth-tour:0']);
  expect(c.integrity).toEqual(journal);
});
it('rejects a scaled payment when the wallet cannot hold the full amount', () => {
  const c = useCampaignStore();
  c.records[541] = record;
  c.town.buildings.saloon = 1;
  c.town.coins = Number.MAX_SAFE_INTEGER - 454;
  expect(c.collectVipSpending(receipt)).toBe(0);
  expect(c.vipReceipts).toEqual([]);
});
it('loads pending legacy and new receipts without rewriting their terms', () => {
  const legacy = {
    version: 1,
    epoch: 'old',
    baseSequence: 0,
    actions: [
      { sequence: 1, kind: 'vip-spend', data: { key: 'old:0', buildingId: 'saloon' } },
      {
        sequence: 2,
        kind: 'vip-spend',
        data: { key: 'new:0', buildingId: 'saloon', economyVersion: 1 },
      },
    ],
  };
  expect(loadIntegrity(legacy)).toEqual(legacy);
  expect(vipSpend({ 541: record }, legacy.actions[0].data.economyVersion ?? 0)).toBe(5);
  expect(vipSpend({ 541: record }, legacy.actions[1].data.economyVersion)).toBe(455);
});
it('shows the credited late-depth amount in the VIP coin popup and accessible receipt', async () => {
  const c = useCampaignStore();
  c.records[541] = record;
  c.town.buildings.saloon = 1;
  const amount = c.collectVipSpending(receipt);
  const html = await renderToString(
    createSSRApp(TownResourceCollection, { resource: 'vip-coins', amount }),
  );
  expect(html).toContain('+455');
  expect(html).toContain('A VIP spent 455 coins at your mine depth!');
});

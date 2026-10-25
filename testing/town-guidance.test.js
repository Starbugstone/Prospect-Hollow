import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { BUILDINGS, createTown } from '../src/data/town';
import {
  needChips,
  needsReport,
  nextGoal,
  openOffers,
  townOffers,
  upgradeOffer,
} from '../src/game/town/TownRules';
import { useCampaignStore } from '../src/stores/campaignStore';

// The village's offers, needs report, next goal and need chips are computed once per town
// state in the campaign store, and every view reads them there.

beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
  setActivePinia(createPinia());
});
afterEach(() => vi.unstubAllGlobals());

function grownTown() {
  const town = createTown();
  Object.assign(town.buildings, { well: 1, farm: 1, home: 2 });
  town.coins = 900;
  return town;
}

it('derives the same offers, needs and goal as each rule on its own', () => {
  const campaign = useCampaignStore();
  campaign.town = grownTown();
  const town = grownTown();
  expect([...campaign.townOffers]).toEqual(BUILDINGS.map(({ id }) => [id, upgradeOffer(town, id)]));
  expect(campaign.openOffers).toEqual(openOffers(town));
  expect(campaign.townNeeds).toEqual(needsReport(town));
  expect(campaign.townGoal).toEqual(nextGoal(town));
  expect(campaign.needChips).toEqual(needChips(needsReport(town)));
  // The shared offers feed the other rules exactly as their own would.
  expect(nextGoal(town, townOffers(town))).toEqual(nextGoal(town));
});

it('computes once per town state and again after the town changes', () => {
  const campaign = useCampaignStore();
  campaign.town = grownTown();
  const offers = campaign.townOffers;
  expect(campaign.townOffers).toBe(offers);
  expect(campaign.townGoal).toBe(campaign.townGoal);
  campaign.town = { ...campaign.town, coins: 0 };
  expect(campaign.townOffers).not.toBe(offers);
});

it('gives the map water, food and happiness, and the Build tab every relevant need', () => {
  const report = needsReport(grownTown());
  const chips = needChips(report);
  expect(chips.filter((chip) => chip.map).map(({ stat }) => stat)).toEqual([
    'water',
    'food',
    'comfort',
  ]);
  expect(chips.map(({ stat }) => stat)).toEqual(['water', 'food', 'housing', 'comfort']);
  const water = chips[0];
  expect(water).toMatchObject({
    icon: 'water',
    id: report.fixes.water ?? 'well',
    value: `${report.water}/${report.demand}`,
    short: report.short.water,
    label: `Water: ${report.water}/${report.demand}`,
  });
  // A town nobody lives in yet shows no people or happiness.
  const empty = needChips(needsReport(createTown()));
  expect(empty.filter((chip) => chip.relevant).map(({ stat }) => stat)).toEqual([]);
});

it.each([
  'src/components/town/TownView.vue',
  'src/components/town/TownNextStep.vue',
  'src/components/VictoryModal.vue',
])('%s reads the shared guidance instead of computing its own', (path) => {
  const source = readFileSync(path, 'utf8');
  for (const rule of ['needsReport(', 'nextGoal(', 'openOffers(', 'upgradeOffer('])
    expect(source, rule).not.toContain(rule);
});

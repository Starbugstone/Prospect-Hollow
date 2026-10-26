import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { TUTORIAL_PUZZLE_LIMIT, townTip, villageTutorial } from '../src/data/guidance';
import fr from '../src/i18n/fr.json';

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
const step = (campaign) => {
  const next = villageTutorial(campaign);
  return next && [next.id, next.target.plot ?? next.target.tab];
};
const win = (campaign) => {
  const id = campaign.completedCount + 1;
  campaign.records[id] = { stars: 1, score: 1 };
};

it('walks a new town through its first buildings, one tap at a time', () => {
  const campaign = useCampaignStore();
  const texts = new Set();
  const expectStep = (expected) => {
    expect(step(campaign)).toEqual(expected);
    texts.add(villageTutorial(campaign).text);
  };
  expectStep(['well', 'well']);
  expect(campaign.upgradeBuilding('well', 0)).toBe(true);
  expectStep(['mine', 'mine']);
  win(campaign);
  // Short of coins, the mine is the way to the next building.
  campaign.town.coins = 0;
  expectStep(['farm-coins', 'mine']);
  campaign.town.coins = 1000;
  expectStep(['farm', 'farm']);
  expect(campaign.upgradeBuilding('farm', 0)).toBe(true);
  expectStep(['home', 'home']);
  expect(campaign.upgradeBuilding('home', 0)).toBe(true);
  expectStep(['saloon', 'saloon']);
  expect(campaign.upgradeBuilding('saloon', 0)).toBe(true);
  expectStep(['construction', 'mine']);
  win(campaign);
  campaign.town.projects.saloon.wins = 1;
  expectStep(['finish', 'saloon']);
  expect(campaign.finishConstruction('saloon', 1)).toBeTruthy();
  expectStep(['next', 'build']);
  // Each step speaks in both languages.
  for (const text of texts) expect(fr[text], text).toBeTruthy();
  campaign.finishTownTour();
  expect(villageTutorial(campaign)).toBe(null);
  // The remaining village tips carry on once the tutorial is done.
  expect(townTip(campaign)?.id).toBe('happiness');
  // Finishing is saved with the town, so a reload does not start it again.
  setActivePinia(createPinia());
  expect(villageTutorial(useCampaignStore())).toBe(null);
});

it('resumes from what the town has built, whatever was built first', () => {
  const campaign = useCampaignStore();
  // A first free building elsewhere still leads on to the mine and the starter homes.
  expect(campaign.upgradeBuilding('shop', 0)).toBe(true);
  expect(step(campaign)).toEqual(['mine', 'mine']);
  win(campaign);
  campaign.town.coins = 1000;
  campaign.town.buildings.farm = 1;
  expect(step(campaign)).toEqual(['home', 'home']);
});

it('stays out of the way of finished, skipped, shared and established towns', () => {
  const campaign = useCampaignStore();
  expect(villageTutorial(campaign)).not.toBe(null);
  campaign.readOnly = true;
  expect(villageTutorial(campaign)).toBe(null);
  campaign.readOnly = false;
  campaign.town.era = 'river-rail';
  expect(villageTutorial(campaign)).toBe(null);
  campaign.town.era = 'frontier';
  for (let i = 0; i <= TUTORIAL_PUZZLE_LIMIT; i++) win(campaign);
  expect(villageTutorial(campaign)).toBe(null);
  campaign.records = {};
  campaign.finishTownTour();
  expect(villageTutorial(campaign)).toBe(null);
});

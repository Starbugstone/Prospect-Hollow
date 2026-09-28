import { expect, it } from 'vitest';
import { runChests } from '../src/data/campaign';

const summary = (chests) => chests.map(({ source, tier }) => `${source}:${tier.id}`);

it('always gives a finished run one chest', () => {
  expect(summary(runChests(0, 9000, 500000, 60000))).toEqual(['completion:crystal']);
  expect(summary(runChests(0, 0, null, 0))).toEqual(['completion:crystal']);
});

it('upgrades the score chest at 100%, 150% and 200% of the target', () => {
  expect(summary(runChests(9000, 9000, 500000, 60000))).toEqual(['score:crystal']);
  expect(summary(runChests(13500, 9000, 500000, 60000))).toEqual(['score:radiant']);
  expect(summary(runChests(18000, 9000, 500000, 60000))).toEqual(['score:celestial']);
});

it('adds a speed chest without a separate completion chest', () => {
  expect(summary(runChests(0, 9000, 30000, 60000))).toEqual(['speed:celestial']);
  expect(summary(runChests(9000, 9000, 60000, 60000))).toEqual(['score:crystal', 'speed:crystal']);
  // Missing the optional speed target never removes the chests already earned.
  expect(summary(runChests(9000, 9000, 60001, 60000))).toEqual(['score:crystal']);
});

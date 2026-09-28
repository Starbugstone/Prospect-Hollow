import { expect, it } from 'vitest';
import { runChests } from '../src/data/campaign';

const sources = (chests) => chests.map(({ source }) => source);

it('always gives a finished run one chest', () => {
  expect(sources(runChests(0, 9000, 500000, 60000))).toEqual(['completion']);
  expect(sources(runChests(0, 0, null, 0))).toEqual(['completion']);
});

it('gives a score chest at the target, with no larger chest for higher scores', () => {
  expect(runChests(9000, 9000, 500000, 60000)).toEqual([{ source: 'score', label: 'Score chest' }]);
  expect(runChests(18000, 9000, 500000, 60000)).toEqual(runChests(9000, 9000, 500000, 60000));
});

it('adds a speed chest without a separate completion chest', () => {
  expect(sources(runChests(0, 9000, 30000, 60000))).toEqual(['speed']);
  expect(runChests(0, 9000, 1, 60000)).toEqual(runChests(0, 9000, 60000, 60000));
  expect(sources(runChests(9000, 9000, 60000, 60000))).toEqual(['score', 'speed']);
  // Missing the optional speed target never removes the chests already earned.
  expect(sources(runChests(9000, 9000, 60001, 60000))).toEqual(['score']);
});

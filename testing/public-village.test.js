import { it, expect } from 'vitest';
import { villageAppearance } from '../src/services/publicVillage';
import { createTown } from '../src/data/town';

it('builds an isolated visit model without importing private balances or actions', () => {
  const own = createTown();
  own.coins = 700;
  const appearance = createTown();
  appearance.buildings.well = 2;
  appearance.coins = 999999;
  appearance.forge.charge = 1;
  appearance.events = { attack: { loss: 100 } };
  appearance.projects.well = {
    id: 'well',
    stage: 3,
    visualStage: 2,
    cost: 999,
    wins: 100,
    required: 1,
  };
  const village = {
    appearance,
    profile: { town: own },
    powers: [{ quantity: 100 }],
    run: { runId: 'private' },
  };
  const visited = villageAppearance(village);
  expect(visited.buildings.well).toBe(2);
  expect(visited.coins).toBe(0);
  expect(visited.forge.charge).toBe(0);
  expect(visited.events).toEqual({});
  expect(visited.projects.well).toMatchObject({ wins: 2, required: 3 });
  expect(visited.projects.well.cost).toBeUndefined();
  visited.buildings.well = 5;
  visited.projects.well.wins = 0;
  expect(appearance.buildings.well).toBe(2);
  expect(appearance.projects.well.wins).toBe(100);
  expect(own.coins).toBe(700);
  expect(own.buildings.well).toBe(0);
});

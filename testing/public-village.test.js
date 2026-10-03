import { it, expect } from 'vitest';
import { villageAppearance, villageLevels } from '../src/services/publicVillage';
import { createTown } from '../src/data/town';
import { SPACE_HELMET } from '../src/data/townAnimals';
import { spaceHelmetWearer } from '../src/game/town/TownSpaceHelmet';
import { LEVEL_COUNT } from '../src/data/campaign';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MuseumLevelGrid from '../src/components/town/MuseumLevelGrid.vue';

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

it('shows unlocked levels and all earned awards using only the visited town', () => {
  const village = {
    appearance: {
      mineLevel: 3,
      levelRecords: {
        1: { stars: 3, score: 900 },
        2: { stars: 1 },
        4: { stars: 2 },
      },
    },
  };
  const levels = villageLevels(village);
  expect(levels).toEqual({
    available: true,
    levelIds: [1, 2, 3, 4],
    records: {
      1: { stars: 3 },
      2: { stars: 1 },
      4: { stars: 2 },
    },
  });
  levels.records[1].stars = 1;
  expect(village.appearance.levelRecords[1].stars).toBe(3);
});

it('handles new, legacy, invalid and fully completed public collections', () => {
  expect(villageLevels({ appearance: { mineLevel: 1, levelRecords: {} } })).toEqual({
    available: true,
    levelIds: [1],
    records: {},
  });
  expect(villageLevels({ appearance: { mineLevel: 3 }, records: { 1: { stars: 3 } } })).toEqual({
    available: false,
    levelIds: [1, 2, 3],
    records: {},
  });
  expect(
    villageLevels({
      appearance: {
        mineLevel: '3',
        levelRecords: {
          0: { stars: 2 },
          [LEVEL_COUNT + 1]: { stars: 3 },
          1: { stars: 4 },
          2: null,
          3: { stars: '2' },
          4: { stars: -1 },
        },
      },
    }),
  ).toEqual({ available: true, levelIds: [], records: {} });
  const records = Object.fromEntries(
    Array.from({ length: LEVEL_COUNT }, (_, i) => [i + 1, { stars: 3 }]),
  );
  const complete = villageLevels({ appearance: { mineLevel: LEVEL_COUNT, levelRecords: records } });
  expect(complete.levelIds).toHaveLength(LEVEL_COUNT);
  expect(complete.records).toEqual(records);
});

it('renders visitor chapter cards and star awards without replay controls or locked levels', async () => {
  const html = await renderToString(
    createSSRApp(MuseumLevelGrid, {
      levelIds: [1, 2, 3, 7],
      records: { 1: { stars: 3 }, 2: { stars: 1 }, 7: { stars: 2 } },
      readOnly: true,
    }),
  );
  expect(html.match(/<article/g)).toHaveLength(4);
  expect(html.match(/class="museum-chapter"/g)).toHaveLength(2);
  for (const stars of [1, 2, 3]) expect(html).toContain(`aria-label="${stars} of 3 stars"`);
  expect(html).toContain('Not completed yet');
  expect(html).not.toContain('<button');
  expect(html).not.toContain('Play again');
  expect(html).not.toContain('Level 4:');
});

it('keeps replay and continuous controls in the player museum grid', async () => {
  for (const continuous of [false, true]) {
    const html = await renderToString(
      createSSRApp(MuseumLevelGrid, {
        levelIds: [1],
        records: { 1: { stars: 2 } },
        continuous,
      }),
    );
    expect(html).toContain('<button');
    expect(html).toContain(continuous ? 'Keep matching' : 'Play again');
    expect(html).toContain(continuous ? 'Continuous play, level 1:' : 'Replay level 1:');
  }
});

it('shows visitors the space-helmet wearer the owner sees after each puzzle', () => {
  const cast = new Set(SPACE_HELMET.wearers);
  for (const completedRuns of [0, 1, 2, 17, 4096]) {
    const owner = { ...createTown(), era: 'riverlight', completedRuns };
    const appearance = { ...createTown(), era: 'riverlight', completedRuns };
    expect(villageAppearance({ appearance }).completedRuns).toBe(completedRuns);
    expect(spaceHelmetWearer(villageAppearance({ appearance }), cast)).toBe(
      spaceHelmetWearer(owner, cast),
    );
  }
  // A share saved before the run count existed, or a corrupt one, starts the rotation.
  for (const completedRuns of [undefined, -1, 2.5, '9'])
    expect(
      villageAppearance({ appearance: { ...createTown(), era: 'riverlight', completedRuns } })
        .completedRuns,
    ).toBe(0);
});

import { expect, it } from 'vitest';
import { ERAS } from '../src/data/eras';
import { MINE_PROFILES, mineProfile, validateMineProfiles } from '../src/data/mineEvolution';
import { mineGrowth, GEM_COLOURS } from '../src/data/mineGrowth';
import { MINE_FEATURES } from '../src/game/town/mine/MineFeatures';
import { haulCycle } from '../src/game/town/mine/MineRollingStock';
it('resolves every era through supported feature definitions and safe inherited substitutes', () => {
  expect(validateMineProfiles()).toEqual([]);
  for (const { id } of ERAS) {
    const p = mineProfile(id);
    for (const slot of ['portal', 'works', 'machine', 'cart', 'site', 'motion'])
      expect(p[slot]).toBeTruthy();
    for (const item of p.site) {
      const f = typeof item === 'string' ? { feature: item } : item;
      expect(MINE_FEATURES[f.feature]).toBeTypeOf('function');
      if (f.requires) expect(MINE_FEATURES[f.substitute]).toBeTypeOf('function');
    }
  }
  expect(mineProfile('missing').portal).toBe('timber');
  const definitions = {
    ...MINE_PROFILES,
    future: { inherits: 'industrial' },
    broken: { inherits: 'industrial', machine: 'missing', site: ['missing'] },
    conditional: {
      inherits: 'industrial',
      site: [{ feature: 'rail-hopper', requires: 'railway', substitute: 'missing' }],
    },
    cycleA: { inherits: 'cycleB' },
    cycleB: { inherits: 'cycleA' },
  };
  expect(mineProfile('future', definitions).cart).toBe(mineProfile('industrial').cart);
  expect(mineProfile('broken', definitions).machine).toBe('crusher');
  expect(mineProfile('conditional', definitions).site).toEqual(mineProfile('industrial').site);
  expect(mineProfile('cycleA', definitions).portal).toBe('timber');
  expect(validateMineProfiles(definitions)).toEqual(
    expect.arrayContaining(['broken: unknown missing', 'cycleA: inheritance cycle']),
  );
});
it.each([0, 1, 5, 6, 11, 12, 23, 24, 35, 36, 53, 54])(
  'maps chapter %s to bounded global growth',
  (n) => {
    const growth = mineGrowth(n);
    expect(growth.veins).toHaveLength(n);
    expect(growth.stockpile).toBe(n < 6 ? 0 : n < 12 ? 1 : n < 24 ? 2 : 3);
    for (let i = 0; i < n; i++)
      expect(growth.veins[i]).toEqual({
        segmentIndex: i,
        seamIndex: Math.floor(i / 9),
        colour: GEM_COLOURS[i % 5],
      });
    expect(growth.plaque).toBe(n === 54);
    expect(growth.aditLights).toBe(n >= 24);
  },
);
it.each([55, 60, 108])('groups a %s chapter campaign into the same 54 display slots', (count) => {
  expect(mineGrowth(count, count).veins).toHaveLength(54);
  expect(mineGrowth(0, count).veins).toHaveLength(0);
  expect(mineGrowth(1, count).veins).toHaveLength(1);
  for (const vein of mineGrowth(count, count).veins)
    expect(vein.colour).toBe(GEM_COLOURS[Math.floor((vein.segmentIndex * count) / 54) % 5]);
});
it('shares an explicit load, travel, unload and return clock', () => {
  expect([0, 3, 8, 12].map((t) => haulCycle(t).state)).toEqual([
    'load',
    'travel',
    'unload',
    'return',
  ]);
  expect(haulCycle(8).loaded).toBe(true);
  expect(haulCycle(9).loaded).toBe(false);
  expect(haulCycle(16)).toEqual(haulCycle(0));
});

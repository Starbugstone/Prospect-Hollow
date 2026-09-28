import { expect, it } from 'vitest';
import { ERAS } from '../src/data/eras';
import { MINE_PROFILES, mineProfile, validateMineProfiles } from '../src/data/mineEvolution';
import { mineGrowth, CART_GEMS } from '../src/data/mineGrowth';
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
it('retains every earlier site feature while later eras update their appearance', () => {
  let previous = [];
  for (const { id } of ERAS) {
    const profile = mineProfile(id);
    const features = profile.site.map((item) => (typeof item === 'string' ? item : item.feature));
    // Only a feature that explicitly encloses an earlier one may supersede it.
    const replaced = profile.site.flatMap((item) => item.replaces ?? []);
    expect(features).toEqual(
      expect.arrayContaining(previous.filter((feature) => !replaced.includes(feature))),
    );
    expect(new Set(features).size).toBe(features.length);
    previous = features;
  }
  const motor = mineProfile('motor-age');
  expect(motor.site).toEqual(
    expect.arrayContaining(['crusher', 'fan-house', 'upper-terrace', 'truck-bay']),
  );
  expect(
    mineProfile('future', { ...MINE_PROFILES, future: { inherits: 'motor-age' } }).site,
  ).toEqual(motor.site);
});
it('lets the Tomorrow sorting dome supersede only the structures it encloses', () => {
  const contemporary = mineProfile('contemporary').site.map((item) =>
    typeof item === 'string' ? item : item.feature,
  );
  const tomorrow = mineProfile('tomorrow');
  const keys = tomorrow.site.map((item) => (typeof item === 'string' ? item : item.feature));
  expect(tomorrow.portal).toBe('rounded-arch');
  expect(keys).toContain('sorting-dome');
  expect(keys).not.toContain('sorting-plant');
  expect(keys).not.toContain('solar-canopy');
  const kept = contemporary.filter((f) => !['sorting-plant', 'solar-canopy'].includes(f));
  expect(keys).toEqual(expect.arrayContaining(kept));
  expect(
    validateMineProfiles({
      ...MINE_PROFILES,
      broken: { site: [{ feature: 'sorting-dome', replaces: ['not-a-feature'] }] },
    }),
  ).toContain('broken: unknown not-a-feature');
});
it.each([54, 324, 600])('fills bounded cart cargo across a %s level campaign', (total) => {
  let count = 0;
  for (let level = 0; level <= total; level++) {
    const growth = mineGrowth(level, total);
    expect(Object.keys(growth)).toEqual(['gems']);
    expect(growth.gems.length).toBeGreaterThanOrEqual(count);
    expect(growth.gems.length).toBeLessThanOrEqual(CART_GEMS.length);
    expect(growth.gems).toEqual(CART_GEMS.slice(0, growth.gems.length));
    count = growth.gems.length;
  }
  expect(mineGrowth(0, total).gems).toHaveLength(1);
  expect(mineGrowth(total, total).gems).toHaveLength(CART_GEMS.length);
  expect(mineGrowth(total * 2, total)).toEqual(mineGrowth(total, total));
  expect(mineGrowth(-10, total)).toEqual(mineGrowth(0, total));
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

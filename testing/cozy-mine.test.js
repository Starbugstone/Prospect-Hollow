import { afterEach, expect, it } from 'vitest';
import { Group } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { createTown } from '../src/data/town';
import { mineAppearance, mineProfile, validateMineProfiles } from '../src/data/mineEvolution';
import { COZY_PALETTES } from '../src/data/cozyArchitecture';
import { addMineSite } from '../src/game/town/mine/addMineSite';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import TownMine from '../src/components/town/TownMine.vue';

const views = [];
function fixture(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    town: { ...createTown(), era },
    sign() {},
  });
  d.world = new Group();
  views.push(d);
  return d;
}
const featureKeys = (profile) =>
  profile.site.map((entry) => (typeof entry === 'string' ? entry : entry.feature));
function signature(root) {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((part) => {
    if (part.isMesh)
      parts.push([part.geometry.uuid, part.material.color.getHex(), part.matrixWorld.toArray()]);
  });
  return JSON.stringify(parts);
}
afterEach(() => {
  delete ERA_BY_ID['cozy-mine-successor'];
  for (const d of views.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((geometry) => geometry.dispose());
    d.materials.forEach((material) => material.dispose());
  }
});

it.each([
  ['canopy', 'tomorrow', 'garden-arch', 'garden-sorting', 'sorting-dome'],
  ['riverlight', 'canopy', 'lantern-arch', 'lantern-sorting', 'garden-sorting'],
])(
  'refits the %s sorting site while retaining mine heritage and operating machinery',
  (era, before, portal, sorting, replaced) => {
    const prior = mineProfile(before);
    const profile = mineProfile(era);
    const features = featureKeys(profile);
    expect(validateMineProfiles()).toEqual([]);
    expect(profile.portal).toBe(portal);
    expect(features).toContain(sorting);
    expect(features).not.toContain(replaced);
    expect(features).toEqual(
      expect.arrayContaining(featureKeys(prior).filter((key) => key !== replaced)),
    );
    expect(profile.heritage).toEqual(prior.heritage);
    expect(profile.motion).toEqual(prior.motion);
    expect(profile.cart).toBe(prior.cart);
    expect(mineAppearance(era).palette).toBe(COZY_PALETTES[era]);

    const d = fixture(era);
    const oldSite = addMineSite(d, d.world, before);
    const site = addMineSite(d, d.world, era);
    expect(site.getObjectByName(`Mine feature ${sorting}`)).toBeDefined();
    expect(site.getObjectByName('1884 keystone')).toBeDefined();
    expect(site.getObjectByName('Mine feature heritage-wheel')).toBeDefined();
    expect(site.getObjectByName('Working hoist drum')).toBeDefined();
    for (const key of ['crusher', 'fan-house', 'upper-terrace'])
      expect(site.getObjectByName(`Mine feature ${key}`).children[0].position).toEqual(
        oldSite.getObjectByName(`Mine feature ${key}`).children[0].position,
      );
    const primitives = new Set(Object.values(d.geometries));
    site.traverse((part) => {
      if (part.isMesh) expect(primitives.has(part.geometry)).toBe(true);
    });
    site.userData.mineUpdate(4);
    expect(site.getObjectByName('Working hoist drum').rotation.x).toBeGreaterThan(0);
  },
);

it.each(['canopy', 'riverlight'])(
  'lets a future %s-style era inherit the full mine without an id-specific renderer',
  (era) => {
    ERA_BY_ID['cozy-mine-successor'] = { evolution: { ...eraEvolution(era) } };
    expect(mineProfile('cozy-mine-successor')).toEqual(mineProfile(era));
    expect(mineAppearance('cozy-mine-successor')).toBe(mineAppearance(era));
    const d = fixture(era);
    expect(signature(addMineSite(d, d.world, 'cozy-mine-successor'))).toBe(
      signature(addMineSite(d, d.world, era)),
    );
  },
);

it('falls back to supported mine art for incomplete or unsupported cozy saves', () => {
  ERA_BY_ID['cozy-mine-successor'] = {
    evolution: { ...eraEvolution('canopy'), cozyStyle: 'unsupported-garden' },
  };
  expect(mineAppearance('cozy-mine-successor')).toBe(mineAppearance('canopy'));
  ERA_BY_ID['cozy-mine-successor'].evolution.cozyStyle = 'constructor';
  expect(mineAppearance('cozy-mine-successor')).toBe(mineAppearance('canopy'));
  ERA_BY_ID['cozy-mine-successor'].evolution.cityAssets = 'unsupported-assets';
  expect(mineAppearance('cozy-mine-successor')).toBe(mineAppearance('canopy'));
  ERA_BY_ID['cozy-mine-successor'].evolution.architecture = 'standard';
  expect(mineAppearance('cozy-mine-successor')).toBe(mineAppearance('frontier'));
  expect(mineProfile('unknown-cozy-save').portal).toBe('timber');
});

it.each([
  ['canopy', 'garden-sorting'],
  ['riverlight', 'lantern-sorting'],
])(
  'draws the same %s sorting hall and palette in the accessible mine illustration',
  async (era, sorting) => {
    const svg = await renderToString(
      createSSRApp({ render: () => h(TownMine, { era, decorative: true }) }),
    );
    expect(svg).toContain(`data-feature="${sorting}"`);
    expect(svg).not.toContain('data-feature="sorting-dome"');
    for (const color of [
      COZY_PALETTES[era].roof,
      COZY_PALETTES[era].timber,
      COZY_PALETTES[era].light,
    ])
      expect(svg).toContain(color);
  },
);

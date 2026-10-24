import { afterEach, expect, it, vi } from 'vitest';
import { Group, PerspectiveCamera, Scene } from 'three';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { EARTH_BUILDINGS, createTown } from '../src/data/town';
import { LEVEL_COUNT } from '../src/data/campaign';
import { mineProfile, ERA_CONSTRUCTION } from '../src/data/mineEvolution';
import generated from '../src/data/generated/mineSignMounts.json';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownActors } from '../src/game/town/TownActors';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { TownMineEraConstruction } from '../src/game/town/TownMineEraConstruction';
import { addMineSite } from '../src/game/town/mine/addMineSite';
import { addMinePortal } from '../src/game/town/mine/MinePortal';
import * as mineCatalog from '../src/game/town/mine/MineSignCatalog';
import * as catalog from '../src/game/town/FootprintCatalog';
import * as mounts from '../src/game/town/TownSignMounts';
import { geometryFootprints } from '../src/game/town/BuildingFootprints';
import { eraIndex, finishEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';

const eras = ERAS.filter((era) => era.enabled).map((era) => era.id);
const labels = {
  ...Object.fromEntries(EARTH_BUILDINGS.map((building) => [building.id, building.shortName])),
  mine: 'Mine',
};
const drawings = [];

function drawing(era, { railway = false, electricity = false, progress = 0 } = {}) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  d.town = { ...createTown(), era };
  d.town.buildings.railDepot = railway ? 3 : 0;
  d.town.buildings.powerHouse = electricity ? 3 : 0;
  d.mineProgress = progress;
  d.motions = [];
  d.camera = new PerspectiveCamera(40, 1.6, 0.1, 400);
  d.staticScenery = { entries: new Map() };
  d.buildingRenderer = { setVisible() {} };
  drawings.push(d);
  return d;
}

function entrance(d, text = labels.mine) {
  const root = d.group(d.world, PLOTS.mine[0], 0.08, PLOTS.mine[1]);
  root.userData.plot = 'mine';
  d.buildPlot('mine', root, d.town, { ...labels, mine: text });
  return root;
}

function portalOf(site) {
  return site.children.find((child) => child.name.startsWith('Mine portal '));
}

afterEach(() => {
  vi.restoreAllMocks();
  delete ERA_BY_ID['ungenerated-mine-sign-era'];
  for (const d of drawings.splice(0)) {
    d.effect?.dispose();
    d.actorRenderer?.dispose();
    d.buildingRenderer?.dispose?.();
    d.upgradeGlow?.dispose();
    d.staticScenery?.dispose?.(d);
    d.clearGroup(d.world);
    d.disposePrimitives();
  }
});

it('ships exactly the entrance and actually drawn historic portal records for every mine era', () => {
  const expected = [];
  for (const era of eras) {
    expected.push(mineCatalog.mineSignKey(mineCatalog.MINE_SIGN_BOARDS.entrance, era));
    if (mineProfile(era).portal !== 'timber' && mineProfile(era).heritage.includes('keystone-1884'))
      expected.push(mineCatalog.mineSignKey(mineCatalog.MINE_SIGN_BOARDS.portal, era));
  }
  expect(generated.format).toBe(1);
  expect(Object.keys(generated.keys).sort()).toEqual(expected.sort());
  for (const index of Object.values(generated.keys)) {
    expect(Number.isInteger(index) && index >= 0).toBe(true);
    const record = generated.mounts[index];
    expect(record).toBeTruthy();
    expect(mounts.generatedSignMount(record, record.input)).toEqual(record.mount);
  }
  expect(new Set(Object.values(generated.keys)).size).toBe(generated.mounts.length);
  expect(new Set(generated.mounts.map((record) => JSON.stringify(record))).size).toBe(
    generated.mounts.length,
  );
});

const siteStates = [
  { railway: false, electricity: false, progress: 0 },
  { railway: true, electricity: false, progress: 0 },
  { railway: false, electricity: true, progress: LEVEL_COUNT },
  { railway: true, electricity: true, progress: LEVEL_COUNT },
];

it.each(eras.flatMap((era) => siteStates.map((state) => [era, state])))(
  'uses exact live-resolver geometry for both %s mine boards across access/growth state %j',
  (era, state) => {
    const d = drawing(era, state);
    const saved = JSON.stringify(d.town);
    const resolver = vi.spyOn(mounts, 'signMount');
    const fastEntrance = entrance(d, 'A translated permanent mine entrance name');
    const fastSite = addMineSite(d, d.world, era);
    const fastPortal = portalOf(fastSite);
    expect(resolver).not.toHaveBeenCalled();
    const entranceRecord = catalog.signMountFor('mine', d.town);
    expect(fastEntrance.userData.signMountSource).toBe('generated');
    expect(fastEntrance.userData.resolvedSignMount).toEqual(entranceRecord);
    const portalRecord = mineCatalog.mineSignMountFor(mineCatalog.MINE_SIGN_BOARDS.portal, era);
    if (portalRecord) {
      expect(fastPortal.userData.signMountSource).toBe('generated');
      expect(fastPortal.userData.resolvedSignMount).toEqual(portalRecord);
    } else expect(fastPortal.userData.resolvedSignMount).toBeUndefined();
    const entranceSolids = geometryFootprints(fastEntrance);
    const siteSolids = geometryFootprints(fastSite);

    vi.spyOn(mineCatalog, 'mineSignMountFor').mockReturnValue(null);
    d.signMountCache?.clear();
    const liveEntrance = entrance(d);
    const liveSite = addMineSite(d, d.world, era);
    const livePortal = portalOf(liveSite);
    expect(resolver).toHaveBeenCalledTimes(portalRecord ? 2 : 1);
    expect(liveEntrance.userData.signMountSource).toBe('resolver');
    expect(liveEntrance.userData.resolvedSignMount).toEqual(entranceRecord);
    if (portalRecord) {
      expect(livePortal.userData.signMountSource).toBe('resolver');
      expect(livePortal.userData.resolvedSignMount).toEqual(portalRecord);
    }
    expect(geometryFootprints(liveEntrance)).toEqual(entranceSolids);
    expect(geometryFootprints(liveSite)).toEqual(siteSolids);
    expect(JSON.stringify(d.town)).toBe(saved);
  },
);

it.each([
  ...eras.slice(1).map((era, index) => [eras[index], era]),
  // Accepted migrated saves can retain these older, skipped-era receipts.
  ['industrial', 'motor-age'],
  ['motor-age', 'contemporary'],
])(
  'reuses both %s → %s construction assemblies without resolving a board or changing the town',
  (from, to) => {
    // The receipt can arrive while the diorama still carries the previous era.
    const d = drawing(from, { railway: true, progress: LEVEL_COUNT });
    d.town.transition = { from, to, pending: true };
    const saved = JSON.stringify(d.town);
    const resolver = vi.spyOn(mounts, 'signMount');
    d.effect = new TownMineEraConstruction(d, d.town.transition);
    for (const [site, era] of [
      [d.effect.previous, from],
      [d.effect.next, to],
    ]) {
      const record = mineCatalog.mineSignMountFor(mineCatalog.MINE_SIGN_BOARDS.portal, era);
      if (record) {
        expect(portalOf(site).userData.signMountSource).toBe('generated');
        expect(portalOf(site).userData.resolvedSignMount).toEqual(record);
      } else expect(portalOf(site).userData.resolvedSignMount).toBeUndefined();
    }
    for (const time of [0, ERA_CONSTRUCTION.buildStart, ERA_CONSTRUCTION.duration])
      d.effect.frame(time);
    expect(resolver).not.toHaveBeenCalled();
    expect(JSON.stringify(d.town)).toBe(saved);
  },
);

it('uses no resolver in a complete cold Riverlight town, including both physical mine boards', () => {
  const d = drawing('riverlight', { railway: true, electricity: true, progress: LEVEL_COUNT });
  for (const building of EARTH_BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(d.town.era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, d.town.era);
    d.town.buildingEraLevels[building.id] = 3;
  }
  d.elapsed = 0;
  d.controls = {};
  d.renderer = { shadowMap: {} };
  d.frameCache = { valid: false };
  d.render = () => {};
  d.actorRenderer = new TownActors(d.scene);
  d.buildingRenderer = new TownStatics(d.scene);
  d.upgradeGlow = new TownUpgradeGlow(d.scene);
  delete d.staticScenery;
  const saved = JSON.stringify(d.town);
  const resolver = vi.spyOn(mounts, 'signMount');
  // Production rebuild, scenery, plot batching and population; sign is real.
  d.update(d.town, labels, LEVEL_COUNT);
  expect(resolver).not.toHaveBeenCalled();
  const mine = d.plotCache.get('mine').group;
  const works = d.staticScenery.entries.get('mine-works').group;
  expect(mine.userData.signMountSource).toBe('generated');
  expect(portalOf(works).userData.signMountSource).toBe('generated');
  expect(mine.getObjectByName('Mounted building nameboard')).toBeTruthy();
  expect(works.getObjectByName('Mounted building nameboard')).toBeTruthy();
  const sources = [...d.plotCache.values()].map(({ group }) => group.userData.signMountSource);
  expect(sources).toContain('authored');
  expect(sources).toContain('generated');
  expect(sources).not.toContain('resolver');
  expect(d.signMountCache?.size ?? 0).toBe(0);
  expect(JSON.stringify(d.town)).toBe(saved);
}, 20000);

it('keeps the one-unit rounded-matrix tolerance but resolves changed mine requests faithfully', () => {
  const d = drawing('riverlight');
  const physicalSign = d.sign;
  d.sign = function (parent, text, width, x, y, z) {
    const record = parent.userData.generatedSignMount;
    if (record)
      parent.userData.generatedSignMount = {
        ...record,
        input: record.input.map((value, index) => value + (index === 4 ? 1 : 0)),
      };
    return physicalSign.call(this, parent, text, width, x, y, z);
  };
  const resolver = vi.spyOn(mounts, 'signMount');
  const root = d.group(d.world, PLOTS.mine[0], 0.08, PLOTS.mine[1]);
  const tolerant = addMinePortal(d, root, 'riverlight');
  expect(tolerant.userData.signMountSource).toBe('generated');
  expect(resolver).not.toHaveBeenCalled();
  d.sign = function (parent, text, width, x, y, z) {
    return physicalSign.call(this, parent, text, width + 0.2, x, y, z);
  };
  const custom = addMinePortal(d, root, 'riverlight');
  expect(custom.userData.signMountSource).toBe('resolver');
  expect(resolver).toHaveBeenCalledOnce();
  expect(custom.userData.resolvedSignMount.input[0]).toBeCloseTo(0.62);
  vi.spyOn(mineCatalog, 'mineSignMountFor').mockReturnValue(null);
  const live = addMinePortal(d, root, 'riverlight');
  expect(custom.userData.resolvedSignMount).toEqual(live.userData.resolvedSignMount);
  expect(geometryFootprints(custom)).toEqual(geometryFootprints(live));
});

it('resolves unknown successors and custom scene transforms instead of reusing an unrelated record', () => {
  ERA_BY_ID['ungenerated-mine-sign-era'] = { evolution: { ...eraEvolution('riverlight') } };
  const d = drawing('ungenerated-mine-sign-era');
  expect(catalog.signMountFor('mine', d.town)).toBeNull();
  expect(mineCatalog.mineSignMountFor(mineCatalog.MINE_SIGN_BOARDS.portal, d.town.era)).toBeNull();
  const resolver = vi.spyOn(mounts, 'signMount');
  const unknownEntrance = entrance(d);
  const unknownSite = addMineSite(d, d.world, d.town.era);
  expect(unknownEntrance.userData.signMountSource).toBe('resolver');
  expect(portalOf(unknownSite).userData.signMountSource).toBe('resolver');
  expect(resolver).toHaveBeenCalledTimes(2);

  d.town.era = 'riverlight';
  d.world.rotation.y = 0.2;
  d.world.scale.set(1.1, 1, 0.9);
  const customEntrance = entrance(d);
  const customSite = addMineSite(d, d.world, d.town.era);
  expect(customEntrance.userData.signMountSource).toBe('resolver');
  expect(portalOf(customSite).userData.signMountSource).toBe('resolver');
  expect(resolver).toHaveBeenCalledTimes(4);
  const original = customEntrance.userData.resolvedSignMount;
  const repeated = entrance(d);
  expect(repeated.userData.resolvedSignMount).toEqual(original);
});

it('has its mine records before any asynchronous era footprint family has been loaded', async () => {
  vi.resetModules();
  const freshCatalog = await import('../src/game/town/FootprintCatalog');
  const freshMounts = await import('../src/game/town/TownSignMounts');
  const { TownDiorama: FreshDiorama } = await import('../src/game/town/TownDiorama');
  const { TownMineEraConstruction: FreshConstruction } =
    await import('../src/game/town/TownMineEraConstruction');
  const d = drawing('canopy', { railway: true });
  Object.setPrototypeOf(d, FreshDiorama.prototype);
  d.town.buildings.school = 3;
  d.town.buildingEras.school = 'canopy';
  expect(freshCatalog.matureEnvelopeFor('school', d.town)).toBeNull();
  expect(freshCatalog.signMountFor('mine', d.town)).toBeTruthy();
  const resolver = vi.spyOn(freshMounts, 'signMount');
  const permanent = entrance(d);
  d.effect = new FreshConstruction(d, { from: 'canopy', to: 'riverlight' });
  expect(permanent.userData.signMountSource).toBe('generated');
  expect(portalOf(d.effect.previous).userData.signMountSource).toBe('generated');
  expect(portalOf(d.effect.next).userData.signMountSource).toBe('generated');
  expect(resolver).not.toHaveBeenCalled();
});

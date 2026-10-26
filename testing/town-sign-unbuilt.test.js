import { afterEach, expect, it, vi } from 'vitest';
import { Group, Raycaster } from 'three';
import { ERAS } from '../src/data/eras';
import { BUILDINGS, EARTH_BUILDINGS, createTown } from '../src/data/town';
import { geometryFootprints } from '../src/game/town/BuildingFootprints';
import * as catalog from '../src/game/town/FootprintCatalog';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { eraIndex, finishEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import * as mounts from '../src/game/town/TownSignMounts';

const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.name]));
const drawings = [];
const openPlots = ERAS.filter((era) => era.enabled).flatMap((era) => {
  const first = EARTH_BUILDINGS.find(
    (building) =>
      building.introducedEra === era.id &&
      !['bridge', 'mine'].includes(building.id) &&
      PLOTS[building.id],
  );
  return first ? [[era.id, first.id]] : [];
});

function drawing(era) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = createTown();
  d.town.era = era;
  const previous = ERAS[Math.max(0, eraIndex(era) - 1)].id;
  for (const building of EARTH_BUILDINGS) {
    if (eraIndex(building.introducedEra) >= eraIndex(era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, previous);
    d.town.buildingEraLevels[building.id] = previous === 'frontier' ? 0 : 3;
  }
  drawings.push(d);
  return d;
}

function render(d, id, names = labels) {
  const root = new Group();
  root.position.set(PLOTS[id][0], 0.08, PLOTS[id][1]);
  root.userData.plot = id;
  d.buildPlot(id, root, d.town, names);
  return root;
}

afterEach(() => {
  vi.restoreAllMocks();
  for (const d of drawings.splice(0)) d.disposePrimitives();
});

it('covers a newly introduced unbuilt valley plot in every shipped era', () => {
  expect(openPlots.map(([era]) => era)).toEqual(
    ERAS.filter((era) => era.enabled).map((era) => era.id),
  );
});

it.each(openPlots)(
  'uses the existing %s stage-zero metadata for newly unlocked %s without changing its collision key',
  (era, id) => {
    const d = drawing(era);
    const building = EARTH_BUILDINGS.find((candidate) => candidate.id === id);
    expect(d.town.buildings[id]).toBe(0);
    expect(d.town.buildingEras[id]).toBe('frontier');
    const beforeTown = JSON.stringify(d.town);
    const collisionKey = catalog.plotFootprintKey(id, d.town);
    const record = catalog.signMountFor(id, d.town);
    expect(record).not.toBeNull();
    const ray = vi.spyOn(Raycaster.prototype, 'intersectObjects');
    const fast = render(d, id, { ...labels, [id]: `${building.name}: a newly opened town site` });
    expect(ray).not.toHaveBeenCalled();
    expect(fast.userData.signMountSource).toBe('generated');
    expect(fast.userData.resolvedSignMount).toEqual(record);
    const width = building.kind === 'well' ? 2.1 : 3.05;
    const depth = building.kind === 'well' ? 2.1 : 2.7;
    expect(record.input.slice(0, 4)).toEqual([1.05, -width / 2 + 0.25, 0.52, depth / 2 - 0.25]);
    expect(JSON.stringify(d.town)).toBe(beforeTown);
    expect(catalog.plotFootprintKey(id, d.town)).toBe(collisionKey);
    const solids = geometryFootprints(fast);

    vi.spyOn(catalog, 'signMountFor').mockReturnValue(null);
    d.signMountCache?.clear();
    ray.mockClear();
    const live = render(d, id);
    expect(ray).toHaveBeenCalled();
    expect(live.userData.signMountSource).toBe('resolver');
    expect(live.userData.resolvedSignMount).toEqual(record);
    expect(geometryFootprints(live)).toEqual(solids);
    expect(JSON.stringify(d.town)).toBe(beforeTown);
    expect(catalog.plotFootprintKey(id, d.town)).toBe(collisionKey);
    d.clearGroup(fast);
    d.clearGroup(live);
  },
);

it.each(openPlots.flatMap(([era, id]) => [0, 1, 2].map((progress) => [era, id, progress])))(
  'keeps %s/%s stage-zero construction%i framings free of fabricated nameboards',
  (era, id, progress) => {
    const d = drawing(era);
    d.town.projects[id] = { id, stage: 1, wins: (progress / 3) * 2, required: 2 };
    const beforeTown = JSON.stringify(d.town);
    const collisionKey = catalog.plotFootprintKey(id, d.town);
    expect(catalog.signMountFor(id, d.town)).toBeNull();
    const ray = vi.spyOn(Raycaster.prototype, 'intersectObjects');
    const root = render(d, id);
    expect(ray).not.toHaveBeenCalled();
    expect(root.getObjectByName('Mounted building nameboard')).toBeUndefined();
    expect(root.userData.resolvedSignMount).toBeUndefined();
    expect(geometryFootprints(root).length).toBeGreaterThan(0);
    expect(JSON.stringify(d.town)).toBe(beforeTown);
    expect(catalog.plotFootprintKey(id, d.town)).toBe(collisionKey);
    d.clearGroup(root);
  },
);

it.each([null, 0, 1, 2])(
  'preserves the unbuilt bridge stakes and project%s without inventing a sign',
  (progress) => {
    const d = drawing('river-rail');
    d.town.buildings.bridge = 0;
    if (progress !== null)
      d.town.projects.bridge = { id: 'bridge', stage: 1, wins: (progress / 3) * 2, required: 2 };
    const collisionKey = catalog.plotFootprintKey('bridge', d.town);
    expect(catalog.signMountFor('bridge', d.town)).toBeNull();
    const ray = vi.spyOn(Raycaster.prototype, 'intersectObjects');
    const root = render(d, 'bridge');
    expect(ray).not.toHaveBeenCalled();
    expect(root.getObjectByName('Mounted building nameboard')).toBeUndefined();
    expect(root.userData.resolvedSignMount).toBeUndefined();
    expect(geometryFootprints(root).length).toBeGreaterThanOrEqual(2);
    expect(catalog.plotFootprintKey('bridge', d.town)).toBe(collisionKey);
    d.clearGroup(root);
  },
);

it('retains the physical resolver when an unbuilt custom marker changes the canonical input', () => {
  const [era, id] = openPlots.find(([candidate]) => candidate === 'riverlight');
  const d = drawing(era);
  const record = catalog.signMountFor(id, d.town);
  expect(record).not.toBeNull();
  const sign = d.sign;
  d.sign = function (parent, text, width, x, y, z) {
    return sign.call(this, parent, text, this.pendingPlotSigns ? width : width + 0.2, x, y, z);
  };
  const resolver = vi.spyOn(mounts, 'signMount');
  const root = render(d, id);
  expect(resolver).toHaveBeenCalled();
  expect(root.userData.signMountSource).toBe('resolver');
  expect(root.userData.resolvedSignMount.input[0]).toBeCloseTo(1.25);
  expect(mounts.generatedSignMount(record, root.userData.resolvedSignMount.input)).toBeNull();
  d.clearGroup(root);
});

it('continues to select the actual retained finish family once a building exists', () => {
  const d = drawing('riverlight');
  expect(d.town.buildings.school).toBeGreaterThan(0);
  expect(d.town.buildingEras.school).toBe('canopy');
  const expected = catalog.signMountFor('school', d.town);
  expect(expected).not.toBeNull();
  d.town.era = 'moonward';
  expect(catalog.signMountFor('school', d.town)).toEqual(expected);
});

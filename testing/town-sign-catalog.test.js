import { afterEach, expect, it, vi } from 'vitest';
import { Group, Raycaster } from 'three';
import { ERAS, ERA_BY_ID } from '../src/data/eras';
import { BUILDINGS, EARTH_BUILDINGS, createTown } from '../src/data/town';
import { geometryFootprints } from '../src/game/town/BuildingFootprints';
import * as catalog from '../src/game/town/FootprintCatalog';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { eraIndex, finishEra } from '../src/game/town/TownEras';
import { PLOTS } from '../src/game/town/TownLayout';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import * as mounts from '../src/game/town/TownSignMounts';

const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.name]));
const originalEraCount = ERAS.length;
const syntheticEra = 'sign-catalog-successor';
const drawings = [];

function drawing(era) {
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = createTown();
  d.town.era = era;
  for (const building of EARTH_BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, era);
    d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
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

function wall(d, offset = 0) {
  const root = new Group();
  root.position.x = offset;
  d.box(root, 3.4, 2.5, 2.6, 0, 1.35, 0, '#aa8855');
  return root;
}

function inputFixture() {
  const context = new Group();
  context.position.set(30, 0.08, -17);
  context.rotation.y = 0.35;
  context.scale.set(1.1, 0.9, 0.85);
  context.userData.signCameraScale = [0.82, 1, 0.93];
  const parent = new Group();
  parent.position.set(0.4, 1.8, -0.7);
  parent.rotation.y = -0.2;
  parent.scale.set(0.9, 1.2, 0.95);
  context.add(parent);
  return { context, parent, args: [2.4, 0.25, 2.35, 1.8] };
}

afterEach(() => {
  vi.restoreAllMocks();
  ERAS.splice(originalEraCount);
  delete ERA_BY_ID[syntheticEra];
  for (const d of drawings.splice(0)) d.disposePrimitives();
});

it('keys a mount by its exact request, quantized parent transform and final camera scale', () => {
  const { context, parent, args } = inputFixture();
  const actual = mounts.signMountInput(parent, ...args, context);
  context.updateWorldMatrix(true, true);
  const relative = context.matrixWorld.clone().invert().multiply(parent.matrixWorld);
  expect(actual).toEqual([
    ...args,
    ...relative.elements.map((value) => Math.round(value * 1e5)),
    ...context.userData.signCameraScale,
  ]);
  expect(actual).toHaveLength(23);
  expect(actual.every(Number.isFinite)).toBe(true);
  context.position.set(-12, 3.7, 51);
  expect(mounts.signMountInput(parent, ...args, context)).toEqual(actual);
  parent.position.x += 0.125;
  expect(mounts.signMountInput(parent, ...args, context)).not.toEqual(actual);
  parent.position.x -= 0.125;
  context.userData.signCameraScale[0] += 0.125;
  expect(mounts.signMountInput(parent, ...args, context)).not.toEqual(actual);
});

it('validates records without changing them and rejects changed width, position or camera input', () => {
  const root = new Group();
  const input = mounts.signMountInput(root, 2.4, 0, 2.35, 1.8, root);
  const mount = { type: 'facade', width: 2.4, x: 0, y: 2.35, z: 1.351, brackets: [] };
  const record = { input: [...input], mount };
  const before = JSON.stringify(record);
  expect(mounts.generatedSignMount(record, input)).toEqual(mount);
  expect(JSON.stringify(record)).toBe(before);
  for (const index of [0, 1, 2, 3, 4, 20, 21, 22]) {
    const changed = [...input];
    changed[index] += 0.125;
    expect(
      mounts.generatedSignMount(record, changed),
      `changed input component ${index}`,
    ).toBeNull();
  }
});

it('accepts only one rounded integer unit of relative-matrix drift without changing the mount', () => {
  const { context, parent, args } = inputFixture();
  const input = mounts.signMountInput(parent, ...args, context);
  const mount = { type: 'facade', width: 2.4, x: 0, y: 2.35, z: 1.351, brackets: [] };
  const record = { input: [...input], mount };
  const before = JSON.stringify(record);
  for (let index = 4; index < 20; index++) {
    for (const delta of [-1, 1]) {
      const changed = [...input];
      changed[index] += delta;
      expect(mounts.generatedSignMount(record, changed), `live matrix ${index}/${delta}`).toBe(
        mount,
      );
      expect(
        mounts.generatedSignMount({ input: changed, mount }, input),
        `record matrix ${index}/${delta}`,
      ).toBe(mount);
    }
    for (const delta of [-2, 2, -0.125, 0.125]) {
      const changed = [...input];
      changed[index] += delta;
      expect(
        mounts.generatedSignMount(record, changed),
        `live matrix ${index}/${delta}`,
      ).toBeNull();
      expect(
        mounts.generatedSignMount({ input: changed, mount }, input),
        `record matrix ${index}/${delta}`,
      ).toBeNull();
      if (!Number.isInteger(changed[index]))
        expect(mounts.generatedSignMount({ input: changed, mount }, changed)).toBeNull();
    }
  }
  expect(JSON.stringify(record)).toBe(before);
});

it('does not apply matrix tolerance to small raw request or camera-scale changes', () => {
  const root = new Group();
  const input = mounts.signMountInput(root, 2.4, 0, 2.35, 1.8, root);
  const mount = { type: 'facade', width: 2.4, x: 0, y: 2.35, z: 1.351, brackets: [] };
  for (const index of [0, 1, 2, 3, 20, 21, 22])
    for (const delta of [-1e-6, 1e-6]) {
      const changed = [...input];
      changed[index] += delta;
      expect(
        mounts.generatedSignMount({ input, mount }, changed),
        `live raw component ${index}/${delta}`,
      ).toBeNull();
      expect(
        mounts.generatedSignMount({ input: changed, mount }, input),
        `record raw component ${index}/${delta}`,
      ).toBeNull();
    }
});

it('rejects malformed or nonfinite generated data rather than trusting an unsafe mount', () => {
  const root = new Group();
  const input = mounts.signMountInput(root, 2.4, 0, 2.35, 1.8, root);
  const mount = { type: 'facade', width: 2.4, x: 0, y: 2.35, z: 1.351, brackets: [] };
  const invalid = [
    null,
    {},
    { input, mount: null },
    { input: input.slice(1), mount },
    { input: input.map((value, index) => (index === 4 ? NaN : value)), mount },
    { input, mount: { ...mount, type: 'unknown-mount' } },
    { input, mount: { ...mount, width: 0 } },
    { input, mount: { ...mount, width: -1 } },
    { input, mount: { ...mount, x: NaN } },
    { input, mount: { ...mount, y: Infinity } },
    { input, mount: { ...mount, z: '1.351' } },
    { input, mount: { ...mount, brackets: [{ x: 0, y: 2.35, back: 1.2, front: NaN }] } },
    { input, mount: { ...mount, type: 'roof', legs: [{ x: 0, z: 0, base: Infinity }] } },
  ];
  for (const record of invalid) expect(mounts.generatedSignMount(record, input)).toBeNull();
});

const representativeStates = ERAS.filter((era) => era.enabled).flatMap((era) =>
  ['home', 'school', 'shop'].flatMap((id) => {
    const building = EARTH_BUILDINGS.find((candidate) => candidate.id === id);
    if (eraIndex(building.introducedEra) > eraIndex(era.id)) return [];
    return [1, 2, 3].map((tier) => [era.id, id, tier]);
  }),
);

it.each(representativeStates)(
  'uses the %s/%s tier%i catalog mount with exact live-resolver solids and zero runtime resolution',
  (era, id, tier) => {
    const d = drawing(era);
    const building = EARTH_BUILDINGS.find((candidate) => candidate.id === id);
    if (building.introducedEra === era)
      d.town.buildings[id] = Math.min(tier, building.upgrades.length);
    d.town.buildingEraLevels[id] = d.town.buildingEras[id] === 'frontier' ? 0 : tier;
    const record = catalog.signMountFor(id, d.town);
    expect(record, catalog.plotFootprintKey(id, d.town)).not.toBeNull();
    const resolver = vi.spyOn(mounts, 'signMount');
    const fast = render(d, id);
    expect(resolver).not.toHaveBeenCalled();
    expect(fast.userData.signMountSource).toBe('generated');
    expect(fast.userData.resolvedSignMount).toEqual(record);
    const expectedSolids = geometryFootprints(fast);

    const reader = vi.spyOn(catalog, 'signMountFor').mockReturnValue(null);
    d.signMountCache?.clear();
    const live = render(d, id);
    expect(resolver).toHaveBeenCalled();
    expect(live.userData.signMountSource).toBe('resolver');
    expect(live.userData.resolvedSignMount).toEqual(record);
    expect(geometryFootprints(live)).toEqual(expectedSolids);
    reader.mockRestore();
    d.clearGroup(fast);
    d.clearGroup(live);
  },
);

it('looks up a pending Canopy finish in its own family and safely reuses it for new label text', () => {
  const d = drawing('canopy');
  const record = catalog.signMountFor('school', d.town);
  expect(record).not.toBeNull();
  d.town.era = 'riverlight';
  expect(d.town.buildingEras.school).toBe('canopy');
  expect(catalog.signMountFor('school', d.town)).toEqual(record);
  const resolver = vi.spyOn(mounts, 'signMount');
  const pending = render(d, 'school', { ...labels, school: 'Willow and Friends Community School' });
  expect(resolver).not.toHaveBeenCalled();
  expect(pending.userData.signMountSource).toBe('generated');
  expect(pending.userData.resolvedSignMount).toEqual(record);
  d.clearGroup(pending);
});

it('honors an authored fascia ahead of a generated record without invoking the resolver', () => {
  const d = drawing('canopy');
  const root = wall(d);
  const input = mounts.signMountInput(root, 2.4, 0, 3.2, 2.3, root);
  root.userData.generatedSignMount = {
    input,
    mount: { type: 'facade', width: 2.4, x: 0, y: 3.2, z: 1.351, brackets: [] },
  };
  const authored = { type: 'facade', width: 1.8, x: 0, y: 2.35, z: 1.351, brackets: [] };
  root.userData.authoredSignMount = authored;
  const resolver = vi.spyOn(Raycaster.prototype, 'intersectObjects');
  d.sign(root, 'Authored fascia', 2.4, 0, 3.2, 2.3);
  expect(resolver).not.toHaveBeenCalled();
  expect(root.userData.signMountSource).toBe('authored');
  expect(root.userData.resolvedSignMount).toEqual({ input, mount: authored });
  d.clearGroup(root);
});

it('falls back to the physical resolver when a custom sign request changes its catalog input', () => {
  const d = drawing('canopy');
  const first = wall(d);
  d.sign(first, 'Original', 2.4, 0, 3.2, 2.3);
  const record = first.userData.resolvedSignMount;
  expect(record).toBeTruthy();
  const custom = wall(d);
  custom.userData.generatedSignMount = record;
  const resolver = vi.spyOn(mounts, 'signMount');
  d.sign(custom, 'Wider custom nameboard', 2.75, 0, 3.2, 2.3);
  expect(resolver).toHaveBeenCalled();
  expect(custom.userData.signMountSource).toBe('resolver');
  expect(custom.userData.resolvedSignMount.input[0]).toBe(2.75);
  expect(mounts.generatedSignMount(record, custom.userData.resolvedSignMount.input)).toBeNull();
  d.clearGroup(first);
  d.clearGroup(custom);
});

it('returns no record for unknown keys and keeps ungenerated successor fallback repeatable', () => {
  const d = drawing('riverlight');
  expect(catalog.signMountFor('not-a-town-plot', d.town)).toBeNull();
  const unshippedKey = {
    ...d.town,
    buildingEraLevels: { ...d.town.buildingEraLevels, school: 99 },
  };
  expect(catalog.signMountFor('school', unshippedKey)).toBeNull();
  const definition = { ...ERAS.find((era) => era.id === 'riverlight'), id: syntheticEra };
  ERAS.push(definition);
  ERA_BY_ID[syntheticEra] = definition;
  d.town.era = syntheticEra;
  d.town.buildingEras.school = syntheticEra;
  d.town.buildingEraLevels.school = 2;
  expect(catalog.signMountFor('school', d.town)).toBeNull();
  const resolver = vi.spyOn(mounts, 'signMount');
  const first = render(d, 'school');
  expect(resolver).toHaveBeenCalled();
  expect(first.userData.signMountSource).toBe('resolver');
  const cacheSize = d.signMountCache.size;
  const next = render(d, 'school');
  expect(next.userData.signMountSource).toBe('resolver');
  expect(next.userData.resolvedSignMount).toEqual(first.userData.resolvedSignMount);
  expect(geometryFootprints(next)).toEqual(geometryFootprints(first));
  expect(d.signMountCache.size).toBe(cacheSize);
  expect(cacheSize).toBeLessThanOrEqual(2048);
  d.clearGroup(first);
  d.clearGroup(next);
});

it('bounds fallback mount caching and reuses an identical translated physical scene', () => {
  const d = drawing('canopy');
  d.signMountCache = new Map(Array.from({ length: 2048 }, (_, index) => [`old-${index}`, {}]));
  const first = wall(d);
  d.sign(first, 'First', 2.4, 0, 3.2, 2.3);
  expect(first.userData.signMountSource).toBe('resolver');
  expect(d.signMountCache.size).toBe(2048);
  expect(d.signMountCache.has('old-0')).toBe(false);
  const ray = vi.spyOn(Raycaster.prototype, 'intersectObjects');
  const translated = wall(d, 20);
  d.sign(translated, 'Same shape, other text', 2.4, 0, 3.2, 2.3);
  expect(ray).not.toHaveBeenCalled();
  expect(d.signMountCache.size).toBe(2048);
  expect(translated.userData.resolvedSignMount).toEqual(first.userData.resolvedSignMount);
  d.clearGroup(first);
  d.clearGroup(translated);
});

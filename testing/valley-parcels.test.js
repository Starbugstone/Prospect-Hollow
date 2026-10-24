import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  Box3,
  Group,
  MeshBasicMaterial,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector3,
} from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { AREA_BY_ID, areaUnlocked } from '../src/data/townLandmarks';
import { addConstructionPlot } from '../src/game/town/buildings/frontierParts';
import { TownActors } from '../src/game/town/TownActors';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { AIRPORT, PLOTS } from '../src/game/town/TownLayout';
import {
  PARCEL_BASE_HEIGHT,
  VALLEY_LOT,
  VALLEY_WELL_LOT,
  parcelBounds,
  valleyLot,
  valleyParcel,
  valleySites,
} from '../src/game/town/TownParcels';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { PARCEL_OUTLINE } from '../src/game/town/TownParcelOutline';
import { plotUnlocked } from '../src/game/town/TownRules';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';

// Permanent rule (AGENTS.md, settlement maps): every valley plot is one rectangle and
// every monument site one circle. The upgrade glow, the tap fallback and the selection
// outline all read that parcel, and a plot redrawn in place refreshes it.
const RIM = PARCEL_OUTLINE.gap + PARCEL_OUTLINE.width;
const extent = (parcel) => [
  parcel.maxX - parcel.minX,
  parcel.maxZ - parcel.minZ,
  (parcel.minX + parcel.maxX) / 2,
  (parcel.minZ + parcel.maxZ) / 2,
];

it('gives every plot its lot from one definition, and the empty lot fence uses it', () => {
  for (const id of Object.keys(PLOTS)) {
    const lot = valleyLot(id);
    const expected =
      id === 'airport'
        ? AIRPORT
        : (GARDEN_PARCELS[id] ?? (id === 'well' ? VALLEY_WELL_LOT : VALLEY_LOT));
    expect(extent(lot), id).toEqual(
      [expected.halfWidth * 2, expected.halfDepth * 2, PLOTS[id][0], PLOTS[id][1]].map((value) =>
        expect.closeTo(value, 9),
      ),
    );
  }
  const d = new TownPrimitives();
  d.sign = () => {};
  for (const [id, lot] of [
    ['home', VALLEY_LOT],
    ['well', VALLEY_WELL_LOT],
  ]) {
    const fence = new Group();
    addConstructionPlot(d, fence, id, -1, id);
    const posts = fence.children.filter((part) => part.isMesh && part.scale.y === 0.6);
    expect(Math.max(...posts.map(({ position }) => position.x)), id).toBeCloseTo(lot.halfWidth);
    expect(Math.max(...posts.map(({ position }) => position.z)), id).toBeCloseTo(lot.halfDepth);
  }
  d.disposePrimitives();
});

const SIZE = 400;
const lateTown = () => ({ ...createTown(), era: ERAS.at(-1).id });
function valley(town) {
  const d = Object.assign(Object.create(TownDiorama.prototype), {
    town,
    targets: [],
    world: new Group(),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: SIZE, height: SIZE }) },
    raycaster: new Raycaster(),
    camera: new PerspectiveCamera(50, 1, 0.1, 500),
    controls: { target: new Vector3(), update: vi.fn() },
    showVillager: () => false,
    render: vi.fn(),
    onSelect: vi.fn(),
  });
  return d;
}
// Taps the ground at (x, z) from above and reports what answered.
function tapGround(d, x, z) {
  d.camera.position.set(x + 2, 30, z + 12);
  d.camera.lookAt(x, 0, z);
  d.camera.updateMatrixWorld();
  const eye = d.camera.position.clone();
  d.onSelect.mockClear();
  const screen = new Vector3(x, 0.08, z).project(d.camera);
  d.pickTown(((screen.x + 1) / 2) * SIZE, ((1 - screen.y) / 2) * SIZE);
  expect(d.camera.position.equals(eye)).toBe(true);
  return d.onSelect.mock.calls[0]?.[0] ?? null;
}

describe('the valley tap fallback covers each whole parcel', () => {
  it('answers anywhere inside every open plot, the airport field and garden parcels included', () => {
    const town = lateTown();
    const d = valley(town);
    const open = Object.keys(PLOTS).filter((id) => id !== 'mine' && plotUnlocked(town, id));
    expect(open.length).toBeGreaterThan(20);
    expect(open).toContain('airport');
    for (const id of open) {
      const lot = valleyLot(id);
      // Near each corner of the lot, well outside the old fixed 1.55 × 1.4 box for large lots.
      for (const [fx, fz] of [
        [0.9, 0.9],
        [-0.9, -0.9],
        [0.9, -0.9],
      ]) {
        const x = (lot.minX + lot.maxX) / 2 + (fx * (lot.maxX - lot.minX)) / 2;
        const z = (lot.minZ + lot.maxZ) / 2 + (fz * (lot.maxZ - lot.minZ)) / 2;
        expect(tapGround(d, x, z), `${id} at ${fx},${fz}`).toBe(id);
      }
    }
  });

  it('follows a drawn parcel larger than its lot, nearest centre first', () => {
    const d = valley(lateTown());
    const lot = valleyLot('home');
    d.parcels = new Map([['home', { ...lot, maxX: lot.maxX + 2 }]]);
    expect(tapGround(d, lot.maxX + 1.5, lot.z)).toBe('home');
    expect(tapGround(d, lot.maxX + 3, lot.z)).not.toBe('home');
  });

  it('answers inside each open monument site circle', () => {
    const town = lateTown();
    const d = valley(town);
    const sites = valleySites().filter((site) => areaUnlocked(town, AREA_BY_ID[site.id]));
    expect(sites.length).toBeGreaterThan(0);
    for (const site of sites) {
      expect(tapGround(d, site.x + site.radius * 0.9, site.z), site.id).toBe(site.id);
      expect(site.radius).toBeCloseTo(AREA_BY_ID[site.id].radius * 0.75);
    }
  });
});

describe('the selection outline takes each parcel’s shape', () => {
  it('frames a plot’s rectangle and rings a monument site', () => {
    const d = valley(lateTown());
    const bounds = new Box3();
    const lot = valleyLot('airport');
    d.select('airport');
    bounds.setFromObject(d.selection);
    expect(bounds.min.x).toBeCloseTo(lot.minX - RIM);
    expect(bounds.max.x).toBeCloseTo(lot.maxX + RIM);
    expect(bounds.min.z).toBeCloseTo(lot.minZ - RIM);
    expect(bounds.max.z).toBeCloseTo(lot.maxZ + RIM);
    const site = valleySites()[0];
    d.select(site.id);
    expect(d.selection.parent).toBe(d.world);
    bounds.setFromObject(d.selection);
    expect((bounds.max.x - bounds.min.x) / 2).toBeCloseTo(site.radius + RIM, 1);
    expect([(bounds.min.x + bounds.max.x) / 2, (bounds.min.z + bounds.max.z) / 2]).toEqual([
      expect.closeTo(site.x, 1),
      expect.closeTo(site.z, 1),
    ]);
    // A Moon building has no valley parcel: nothing is outlined.
    d.select('settlerDomes');
    expect(d.selection).toBeNull();
  });
});

// A real valley rebuild, as testing/town-plot-cache.test.js builds it.
const views = [];
function townView() {
  const view = Object.create(TownDiorama.prototype);
  Object.assign(view, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    sign: () => {},
    elapsed: 0,
    controls: {},
    renderer: { shadowMap: {} },
    frameCache: { valid: false },
    render: () => {},
  });
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  views.push(view);
  const town = createTown();
  Object.assign(town.buildings, { home: 2, farm: 3, well: 1 });
  const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
  labels.mine = 'Mine';
  return { view, town, labels };
}
afterEach(() => {
  for (const view of views.splice(0)) {
    view.actorRenderer.dispose();
    view.buildingRenderer.dispose();
    view.upgradeGlow.dispose();
    view.staticScenery?.dispose(view);
    view.clearGroup(view.world);
    Object.values(view.geometries).forEach((geometry) => geometry.dispose());
    view.materials.forEach((material) => material.dispose());
    view.contactShadowMaterial.dispose();
  }
});
const glowMatches = (view, id) => {
  const glow = view.upgradeGlow.plots.get(id);
  const box = parcelBounds(view.parcels.get(id));
  const [halo] = glow.children;
  expect(glow.position.x, id).toBeCloseTo((box.min.x + box.max.x) / 2);
  expect(glow.position.z, id).toBeCloseTo((box.min.z + box.max.z) / 2);
  expect(halo.scale.x, id).toBeCloseTo(box.max.x - box.min.x + 1.8);
  expect(halo.scale.y, id).toBeCloseTo(box.max.z - box.min.z + 1.8);
};

describe('the glow follows each drawn parcel', () => {
  // Parcels are measured as each plot is drawn, before the renderer batches its meshes.
  const coversLot = (parcel, id) => {
    const lot = valleyLot(id);
    expect(parcel.minX, id).toBeLessThanOrEqual(lot.minX);
    expect(parcel.maxX, id).toBeGreaterThanOrEqual(lot.maxX);
    expect(parcel.minZ, id).toBeLessThanOrEqual(lot.minZ);
    expect(parcel.maxZ, id).toBeGreaterThanOrEqual(lot.maxZ);
    expect(parcel.top, id).toBeGreaterThan(0);
  };

  it('registers every drawn plot’s parcel, covering its lot, with a glow of that parcel', () => {
    const { view, town, labels } = townView();
    const measured = vi.spyOn(view.upgradeGlow, 'add');
    view.update(town, labels);
    expect([...view.parcels.keys()].sort()).toEqual([...view.plotCache.keys()].sort());
    for (const [id, parcel] of view.parcels) {
      coversLot(parcel, id);
      if (id !== 'mine') glowMatches(view, id);
    }
    expect(measured.mock.calls.map(([id]) => id).sort()).toEqual(
      [...view.parcels.keys()].filter((id) => id !== 'mine').sort(),
    );
  });

  it('refreshes a swapped plot’s parcel, glow and outline, keeping the glow showing', () => {
    const { view, town, labels } = townView();
    view.update(town, labels);
    view.setUpgradeable(['home']);
    view.select('home');
    const before = view.upgradeGlow.plots.get('home'),
      beforeParcel = view.parcels.get('home');
    const clear = vi.spyOn(view, 'plotVacant').mockReturnValue(true);
    try {
      view.changeTown({ ...town, buildings: { ...town.buildings, home: 3 } }, labels, 0, null);
    } finally {
      clear.mockRestore();
    }
    const parcel = view.parcels.get('home');
    expect(parcel).not.toBe(beforeParcel);
    coversLot(parcel, 'home');
    const glow = view.upgradeGlow.plots.get('home');
    expect(glow).not.toBe(before);
    expect(before.parent).toBeNull();
    expect(glow.visible).toBe(true);
    glowMatches(view, 'home');
    const outline = new Box3().setFromObject(view.selection);
    expect(outline.max.x).toBeCloseTo(view.parcels.get('home').maxX + RIM);
  });
});

describe('a town grown by a tap keeps the camera', () => {
  it('skips the overview reframe for a tapped finish, and only for that change', () => {
    const { view, town, labels } = townView();
    view.update(town, labels);
    const frame = vi.spyOn(view, 'frameTown').mockImplementation(() => {});
    view.overview = true;
    // A new plot opens: the topology changes and the town is rebuilt.
    const grown = {
      ...town,
      buildings: { ...town.buildings, home: 3, farm: 3, well: 3, saloon: 1, stable: 1 },
    };
    const rebuild = vi.spyOn(view, 'update');
    view.changeTown(grown, labels, 0, null, { keepCamera: true });
    expect(rebuild).toHaveBeenCalledOnce();
    expect(frame).not.toHaveBeenCalled();
    expect(view.keepCamera).toBe(false);
    view.changeTown(
      { ...grown, buildings: { ...grown.buildings, sheriff: 1, bank: 1 } },
      labels,
      0,
      null,
    );
    expect(frame).toHaveBeenCalled();
  });
});

it('takes a parcel from the ground a building stands on, not from parts overhead', () => {
  const d = new TownPrimitives();
  const [x, z] = PLOTS.spaceElevator;
  const plot = d.group(new Group(), x, 0.08, z);
  // A slender tower on the lot and a wide orbital ring high above it.
  d.box(plot, 1.2, 30, 1.2, 0, 15, 0, '#ffffff');
  d.box(plot, 18, 0.4, 18, 0, 12, 0, '#ffffff');
  const parcel = valleyParcel('spaceElevator', plot);
  const lot = valleyLot('spaceElevator');
  expect([parcel.minX, parcel.maxX, parcel.minZ, parcel.maxZ]).toEqual(
    [lot.minX, lot.maxX, lot.minZ, lot.maxZ].map((value) => expect.closeTo(value, 6)),
  );
  expect(parcel.top).toBeCloseTo(30.08);
  // The glow hugs the tower's base, not the whole garden parcel or the ring above it.
  const glow = parcelBounds(parcel);
  expect([glow.min.x, glow.max.x]).toEqual([
    expect.closeTo(x - 0.6, 6),
    expect.closeTo(x + 0.6, 6),
  ]);
  // A base on the ground wider than the lot does widen the parcel.
  d.box(plot, 20, 0.5, 20, 0, PARCEL_BASE_HEIGHT / 4, 0, '#ffffff');
  expect(valleyParcel('spaceElevator', plot).maxX).toBeCloseTo(x + 10);
  d.disposePrimitives();
});

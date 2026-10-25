import { afterEach, expect, it } from 'vitest';
import { Group, PerspectiveCamera, Raycaster, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import {
  MOON_LOTS,
  MOON_PARCEL_SIDES,
  MOON_SITE_PAD,
  moonPadApothem,
  moonPadRadius,
  moonParcels,
} from '../src/data/moonSettlement';
import {
  advanceMonumentWorks,
  areasForSettlement,
  landmarkOffer,
  monumentWork,
  purchaseLandmark,
  unveilLandmark,
} from '../src/data/townLandmarks';
import { MOON_FORMS, renderMoonBuilding } from '../src/game/town/buildings/moon';
import { buildMoonMonuments } from '../src/game/town/moon/MoonMonuments';
import { MoonScene, moonRoofHeight } from '../src/game/town/moon/MoonScene';
import { MoonConstruction } from '../src/game/town/moon/MoonConstruction';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';

// Permanent rule (AGENTS.md): every Moon parcel, built, empty, under construction or
// added in a future update, stands on the one octagonal pad, and its glow, tap
// target and selection outline follow that same shape.
const primitives = [];
const kit = () => {
  const d = new TownPrimitives();
  primitives.push(d);
  return d;
};
afterEach(() => primitives.splice(0).forEach((d) => d.disposePrimitives()));
const pads = (root) => {
  const found = [];
  root.traverse((mesh) => mesh.userData.parcelPad && found.push(mesh));
  return found;
};
const expectParcelPad = (root, radius, label) => {
  const [pad, ...extra] = pads(root);
  expect(extra, `${label} has one parcel pad`).toHaveLength(0);
  expect(pad, `${label} stands on a parcel pad`).toBeDefined();
  expect(pad.geometry.parameters.radialSegments, label).toBe(MOON_PARCEL_SIDES);
  expect(pad.scale.x, label).toBeCloseTo(radius);
  expect(pad.scale.z, label).toBeCloseTo(radius);
  expect([pad.position.x, pad.position.z], label).toEqual([0, 0]);
};
const moonTown = () => ({ ...createTown(), era: 'twin-hollows', coins: 1e9, moonstones: 1e6 });

it('lists every Moon lot and monument site as a parcel of the one shape', () => {
  const parcels = moonParcels();
  const sites = areasForSettlement('moon');
  expect(parcels.map(({ id }) => id).sort()).toEqual(
    [...Object.keys(MOON_LOTS), ...sites.map(({ id }) => id)].sort(),
  );
  for (const parcel of parcels) {
    expect(parcel.sides, parcel.id).toBe(MOON_PARCEL_SIDES);
    expect(parcel.radius, parcel.id).toBe(
      parcel.kind === 'lot' ? moonPadRadius(parcel.id) : MOON_SITE_PAD,
    );
    expect(Number.isFinite(parcel.rotation), parcel.id).toBe(true);
  }
  // A future lot or site joins the same contract without further edits.
  const future = moonParcels({ ...MOON_LOTS, futureLot: [40, 0] }, [
    { id: 'future-site', positions: [[0, 40]], facing: 'south' },
  ]);
  expect(future.find(({ id }) => id === 'futureLot')).toMatchObject({
    kind: 'lot',
    sides: MOON_PARCEL_SIDES,
    radius: moonPadRadius('futureLot'),
  });
  expect(future.find(({ id }) => id === 'future-site')).toMatchObject({
    kind: 'site',
    sides: MOON_PARCEL_SIDES,
    radius: MOON_SITE_PAD,
  });
  expect(moonPadApothem(1)).toBeCloseTo(Math.cos(Math.PI / MOON_PARCEL_SIDES));
});

it.each(MOON_FORMS)('draws %s on the shared parcel pad at every level, empty included', (id) => {
  const d = kit();
  for (const level of [0, 1, 2, 3])
    expectParcelPad(renderMoonBuilding(d, new Group(), id, level), moonPadRadius(id), level);
  // Lots without a form yet (future content) still get the pad.
  expectParcelPad(renderMoonBuilding(d, new Group(), 'futureLot', 1), moonPadRadius('futureLot'));
});

it.each(areasForSettlement('moon').map((area) => [area.id, area]))(
  'keeps the %s monument site on the parcel shape when open, in work and built',
  (id, area) => {
    const d = kit();
    const siteIn = (town) => {
      const root = buildMoonMonuments(d, new Group(), town);
      let site;
      root.traverse((group) => group.userData.monumentSite === id && (site ??= group));
      return site;
    };
    // buildMoonMonuments merges meshes; the pad is checked before batching.
    const batch = d.batch;
    d.batch = () => {};
    let town = moonTown();
    expectParcelPad(siteIn(town), MOON_SITE_PAD, 'open');
    const choice = area.choices[0];
    const offer = landmarkOffer(town, area, choice);
    expect(offer, 'the fixture can afford the monument').toBeTruthy();
    town = purchaseLandmark(town, { id, slot: 0, value: choice, ...offer });
    expect(monumentWork(town, area)).toBeTruthy();
    expectParcelPad(siteIn(town), MOON_SITE_PAD, 'work');
    while (!monumentWork(town, area).ready) town = advanceMonumentWorks(town);
    town = unveilLandmark(town, id, 1);
    expectParcelPad(siteIn(town), MOON_SITE_PAD, 'built');
    d.batch = batch;
  },
);

// MoonScene needs WebGL; the parcel half of it runs on a bare prototype that is its own
// drawing kit, as the real scene is.
function parcelScene(town = moonTown()) {
  const scene = Object.assign(Object.create(MoonScene.prototype), kit(), {
    scene: new Scene(),
    town,
    raycaster: new Raycaster(),
    camera: new PerspectiveCamera(48, 1, 0.1, 600),
    canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }) },
    hitsEarth: () => false,
    requestFrame() {},
    picked: [],
    onSelect(id) {
      this.picked.push(id);
    },
  });
  scene.d = scene;
  scene.raycaster.layers.set(3);
  scene.upgradeGlow = new TownUpgradeGlow(scene.scene);
  scene.pickTargets = new Group();
  scene.scene.add(scene.pickTargets);
  scene.addParcels();
  scene.scene.updateMatrixWorld(true);
  return scene;
}
// Corner bearings (around +y, from +z) of a mesh's outline, folded into one sector.
const sector = (sides) => (Math.PI * 2) / sides;
const fold = (bearing, sides) =>
  Math.round((((bearing % sector(sides)) + sector(sides)) % sector(sides)) * 1000) %
  Math.round(sector(sides) * 1000);
const corners = (mesh, centre, sides) => {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.attributes.position,
    found = new Set(),
    point = new Vector3();
  for (let n = 0; n < position.count; n++) {
    point.fromBufferAttribute(position, n).applyMatrix4(mesh.matrixWorld);
    if (Math.hypot(point.x - centre.x, point.z - centre.z) < 0.5) continue;
    found.add(fold(Math.atan2(point.x - centre.x, point.z - centre.z), sides));
  }
  return [...found];
};

it('gives every parcel a glow, tap target and selection outline of its pad shape', () => {
  const scene = parcelScene();
  for (const parcel of moonParcels()) {
    // The drawn pad has a corner on its lot's local +z, turned by the parcel's rotation.
    const expected = [fold(parcel.rotation, parcel.sides)];
    const glow = scene.upgradeGlow.plots.get(parcel.id);
    expect(glow, `${parcel.id} glow`).toBeDefined();
    const [halo, aura] = glow.children;
    expect(halo.geometry.parameters.segments, parcel.id).toBe(parcel.sides);
    expect(aura.geometry.parameters.radialSegments, parcel.id).toBe(parcel.sides);
    expect(corners(halo, parcel, parcel.sides), `${parcel.id} glow`).toEqual(expected);
    expect(corners(aura, parcel, parcel.sides), `${parcel.id} aura`).toEqual(expected);
    const target = scene.pickTargets.children.find((mesh) => mesh.userData.lot === parcel.id);
    expect(target, `${parcel.id} tap target`).toBeDefined();
    expect(target.geometry.parameters.radialSegments).toBe(parcel.sides);
    expect(target.scale.x).toBeCloseTo(parcel.radius);
    expect(corners(target, parcel, parcel.sides), `${parcel.id} target`).toEqual(expected);
    scene.setSelected(parcel.id);
    expect(scene.selection.geometry.parameters.thetaSegments).toBe(parcel.sides);
    expect(corners(scene.selection, parcel, parcel.sides), `${parcel.id} outline`).toEqual(
      expected,
    );
  }
  scene.setSelected(null);
  expect(scene.selectionRoot.parent).toBeNull();
  scene.upgradeGlow.dispose();
});

it('opens every parcel from a tap on it without moving the camera', () => {
  const scene = parcelScene();
  for (const parcel of moonParcels()) {
    scene.camera.position.set(parcel.x + 0.5, 30, parcel.z + 12);
    scene.camera.lookAt(parcel.x, 0, parcel.z);
    scene.camera.updateMatrixWorld(true);
    const eye = scene.camera.position.clone(),
      facing = scene.camera.quaternion.clone();
    const centre = new Vector3(parcel.x, 0.3, parcel.z).project(scene.camera);
    const event = { clientX: (centre.x + 1) * 50, clientY: (1 - centre.y) * 50 };
    expect(scene.tap(event), parcel.id).toBe(parcel.id);
    expect(scene.camera.position.equals(eye), `${parcel.id} camera`).toBe(true);
    expect(scene.camera.quaternion.equals(facing), `${parcel.id} camera`).toBe(true);
  }
  expect(scene.picked).toEqual(moonParcels().map(({ id }) => id));
  // Sky and bare regolith answer nothing.
  expect(scene.tap({ clientX: 50, clientY: 1 })).toBeNull();
  scene.upgradeGlow.dispose();
});

it('ignores monument sites the town has not opened yet', () => {
  const scene = parcelScene({ ...createTown(), era: 'frontier' });
  const site = moonParcels().find(({ kind }) => kind === 'site');
  scene.camera.position.set(site.x, 30, site.z + 12);
  scene.camera.lookAt(site.x, 0, site.z);
  scene.camera.updateMatrixWorld(true);
  const centre = new Vector3(site.x, 0.3, site.z).project(scene.camera);
  expect(scene.tap({ clientX: (centre.x + 1) * 50, clientY: (1 - centre.y) * 50 })).toBeNull();
  scene.upgradeGlow.dispose();
});

// update() rebuilds and batches the lots, sizing each tap target from the unbatched roof.
function builtScene(town) {
  const scene = parcelScene(town);
  Object.assign(scene, {
    signature: '',
    access: { geometry: { dispose() {} } },
    populate() {},
    construction: { sync() {} },
    saucer: { update() {} },
  });
  scene.update(town);
  return scene;
}
const tapAt = (scene, eye, point) => {
  scene.camera.position.set(...eye);
  scene.camera.lookAt(...point);
  scene.camera.updateMatrixWorld(true);
  const screen = new Vector3(...point).project(scene.camera);
  return scene.tap({ clientX: (screen.x + 1) * 50, clientY: (1 - screen.y) * 50 });
};

it('fits every tap target to its roof and leaves the ribbon above the landing to the sky', () => {
  const town = moonTown();
  town.buildings = {
    ...town.buildings,
    ...Object.fromEntries(Object.keys(MOON_LOTS).map((id) => [id, 3])),
  };
  const scene = builtScene(town);
  for (const id of Object.keys(MOON_LOTS)) {
    const roof = moonRoofHeight(renderMoonBuilding(kit(), new Group(), id, 3));
    const target = scene.pickTargets.children.find((mesh) => mesh.userData.lot === id);
    expect(target.scale.y, id).toBeCloseTo(Math.max(1.2, roof + 0.2));
    expect(target.scale.y, id).toBeLessThan(8);
  }
  // Sky over the landing is not the landing; the Commons behind it stays reachable.
  expect(tapAt(scene, [0, 12, 40], [0, 20, -8])).toBeNull();
  expect(tapAt(scene, [0, 30, -40], [0, 1, 11])).toBe('newHollowCommons');
  scene.upgradeGlow.dispose();
});

it('fits a built monument site’s tap target to the monument, measured before batching', () => {
  const area = areasForSettlement('moon')[0];
  let town = moonTown();
  const choice = area.choices[0];
  town = purchaseLandmark(town, {
    id: area.id,
    slot: 0,
    value: choice,
    ...landmarkOffer(town, area, choice),
  });
  while (!monumentWork(town, area).ready) town = advanceMonumentWorks(town);
  town = unveilLandmark(town, area.id, 1);
  const scene = builtScene(town);
  let site;
  scene.monuments.traverse((group) => group.userData.monumentSite === area.id && (site = group));
  expect(site.userData.height).toBeGreaterThan(0.5);
  const target = scene.pickTargets.children.find((mesh) => mesh.userData.lot === area.id);
  expect(target.scale.y).toBeCloseTo(Math.max(1.2, site.userData.height + 0.2));
  scene.upgradeGlow.dispose();
});

it('answers a tap on a worksite’s scaffolding and crane, not only on its pad', () => {
  const town = moonTown();
  town.buildings = { ...town.buildings, ribbonLanding: 1 };
  town.projects = { settlerDomes: { id: 'settlerDomes', stage: 1, wins: 2, required: 2 } };
  const scene = parcelScene(town);
  Object.assign(scene, {
    signature: '',
    elapsed: 0,
    reducedMotion: false,
    access: { geometry: { dispose() {} } },
    populate() {},
    saucer: { update() {} },
  });
  scene.construction = new MoonConstruction(scene);
  scene.update(town);
  const site = scene.construction.sites.get('settlerDomes').root;
  const crane = moonRoofHeight(site);
  expect(crane).toBeGreaterThan(4);
  const target = scene.pickTargets.children.find((mesh) => mesh.userData.lot === 'settlerDomes');
  expect(target.scale.y).toBeGreaterThanOrEqual(crane);
  // A tap high on the gantry, where the empty pad alone would have missed.
  const lot = moonParcels().find(({ id }) => id === 'settlerDomes');
  expect(tapAt(scene, [lot.x + 6, 4, lot.z + 30], [lot.x, crane - 0.5, lot.z])).toBe(
    'settlerDomes',
  );
  scene.construction.dispose();
  scene.upgradeGlow.dispose();
});

// MoonScene.update with real buildings and a real MoonConstruction.
function liveScene(town, reducedMotion = false) {
  const scene = parcelScene(town);
  Object.assign(scene, {
    signature: '',
    elapsed: 0,
    reducedMotion,
    access: { geometry: { dispose() {} } },
    populate() {},
    saucer: { update() {}, step() {} },
  });
  scene.construction = new MoonConstruction(scene);
  scene.update(town);
  return scene;
}
const withLevel = (town, id, level) => ({
  ...town,
  buildings: { ...town.buildings, [id]: level },
  projects: {},
});

it('finishes a Moon building with the valley’s construction reveal, then merges it', () => {
  const town = { ...moonTown(), buildings: { ...moonTown().buildings, ribbonLanding: 1 } };
  const scene = liveScene(town);
  expect(scene.lotReveals?.size ?? 0).toBe(0);
  const finished = withLevel(town, 'roverBarn', 1);
  scene.update(finished);
  const { reveal, lot } = scene.lotReveals.get('roverBarn');
  // Drawn on its own, outside the merged settlement, until it settles.
  expect(lot.parent).toBe(scene.scene);
  expect(reveal.hammer.parent).toBeTruthy();
  // The pad was already there: only the building's new pieces settle into place.
  expect(reveal.pieces.some(({ object }) => object.userData.parcelPad)).toBe(false);
  expect(reveal.pieces.length).toBeGreaterThan(5);
  for (let time = 0; time <= 0.5; time += 1 / 60) scene.move(time);
  expect(reveal.pieces.some(({ object, y }) => object.position.y > y)).toBe(true);
  for (let time = 0.5; time <= 3; time += 1 / 60) scene.move(time);
  expect(scene.lotReveals.size).toBe(0);
  expect(lot.parent).toBeNull();
  expect(scene.buildings.getObjectByName('Moon roverBarn level 1')).toBeDefined();
  scene.construction.dispose();
  scene.upgradeGlow.dispose();
});

it('reveals a finished upgrade and a later era finish, but not on load or in reduced motion', () => {
  const base = { ...moonTown(), buildings: { ...moonTown().buildings, settlerDomes: 1 } };
  const scene = liveScene(base);
  scene.update(withLevel(base, 'settlerDomes', 2));
  expect([...scene.lotReveals.keys()]).toEqual(['settlerDomes']);
  scene.move(0);
  scene.setReducedMotion(true);
  expect(scene.lotReveals.size).toBe(0);
  scene.reducedMotion = false;
  // A modernization keeps the level; its saved finish is the completion signal.
  const modern = withLevel(base, 'settlerDomes', 2);
  modern.buildingEraLevels = { ...modern.buildingEraLevels, settlerDomes: 3 };
  scene.update(modern);
  expect([...scene.lotReveals.keys()]).toEqual(['settlerDomes']);
  scene.endLotReveals();
  // Reduced motion and a first load show the finished building at once.
  const still = liveScene(withLevel(base, 'settlerDomes', 2), true);
  expect(still.lotReveals?.size ?? 0).toBe(0);
  still.update(withLevel(base, 'settlerDomes', 3));
  expect(still.lotReveals?.size ?? 0).toBe(0);
  for (const view of [scene, still]) {
    view.construction.dispose();
    view.upgradeGlow.dispose();
  }
});

import { afterEach, describe, expect, it } from 'vitest';
import { MeshBasicMaterial, PerspectiveCamera, Scene, Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { areaUnlocked, areasForSettlement } from '../src/data/townLandmarks';
import { TownActors } from '../src/game/town/TownActors';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { plotInEra } from '../src/game/town/TownEras';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { projectLabelPositions } from '../src/game/town/TownLabelProjection';
import { PLOTS } from '../src/game/town/TownLayout';
import { TownStatics } from '../src/game/town/TownStatics';
import { TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';

// The shared marker contract (TownMarkers.js) in the valley, as testing/moon-label-layout
// checks it on the Moon: with every plot and every monument or commission site ready at
// once, each marker is over its own place, just above what stands there, sized by how wide
// the place is drawn (a floor on a phone, full size on a large plot) and never pushed onto
// another plot.
const views = [];
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
function valley(era) {
  const view = Object.create(TownDiorama.prototype);
  Object.assign(view, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    sign() {},
    elapsed: 0,
    controls: { target: new Vector3() },
    renderer: { shadowMap: {} },
    frameCache: { valid: false },
    render() {},
  });
  view.actorRenderer = new TownActors(view.scene);
  view.buildingRenderer = new TownStatics(view.scene);
  view.upgradeGlow = new TownUpgradeGlow(view.scene);
  const town = { ...createTown(), era, coins: 1e9 };
  for (const building of BUILDINGS)
    if (PLOTS[building.id] && plotInEra(town, building.id)) town.buildings[building.id] = 1;
  if (town.buildings.homecomingHall) town.buildings.homecomingHall = 3;
  const labels = Object.fromEntries(BUILDINGS.map(({ id, shortName }) => [id, shortName]));
  labels.mine = 'Mine';
  views.push(view);
  view.update(town, labels);
  return { view, town };
}
// Camera poses a player really reaches: the whole town, the old streets close up, and the
// far field of monument and commission sites.
const POSES = {
  overview: [
    [8, 0, -10],
    [8, 120, 120],
  ],
  'close on the old town': [
    [0, 0, 2],
    [6, 13, 20],
  ],
  'the far sites': [
    [66, 0, -88],
    [70, 30, -52],
  ],
};
const SIZES = [
  [375, 675],
  [412, 850],
  [1440, 841],
];
const LATE = ERAS.findLast((era) => era.enabled).id;

describe.each([
  ['a dense late-era town', LATE, Object.keys(POSES)],
  ['an early town', 'river-rail', ['overview', 'close on the old town']],
])('ready markers over their own places: %s', (_, era, poses) => {
  it.each(SIZES.flatMap((size) => poses.map((pose) => [...size, pose])))(
    'at %sx%s, %s',
    (width, height, pose) => {
      const { view, town } = valley(era);
      const camera = new PerspectiveCamera(width < height ? 62 : 48, width / height, 0.1, 900);
      const [target, eye] = POSES[pose];
      // A phone stands further back to keep the town in view.
      const back = pose === 'overview' && width < height ? 1.7 : 1;
      camera.position.set(
        target[0] + (eye[0] - target[0]) * back,
        eye[1] * back,
        target[2] + (eye[2] - target[2]) * back,
      );
      camera.lookAt(...target);
      camera.updateMatrixWorld(true);
      camera.updateProjectionMatrix();
      view.camera = camera;
      view.controls.target.set(...target);
      view.canvas = { clientWidth: width, clientHeight: height };
      // Every plot and every open site is ready to finish at once.
      view.labelActions = new Set(view.anchors.map(({ id }) => id));
      let placed;
      view.onLabels = (labels) => (placed = labels);
      projectLabelPositions(view);
      const screen = (x, y, z) => {
        const p = new Vector3(x, y, z).project(camera);
        return [((p.x + 1) * width) / 2, ((1 - p.y) * height) / 2];
      };
      const sites = Object.fromEntries(
        areasForSettlement()
          .filter((area) => areaUnlocked(town, area))
          .map((area) => [area.id, area]),
      );
      const shown = placed.filter((label) => label.collection?.visible && label.id !== 'mine');
      // A narrow phone sees fewer of the far sites at once.
      expect(shown.length).toBeGreaterThan(
        pose === 'overview' ? 12 : pose === 'the far sites' ? 0 : 2,
      );
      if (pose === 'the far sites') expect(shown.some(({ id }) => sites[id])).toBe(true);
      if (pose === 'overview' && era === LATE)
        expect(shown.some(({ id }) => id === 'airport')).toBe(true);
      for (const label of shown) {
        const site = sites[label.id];
        const parcel = site ? null : view.parcels.get(label.id);
        const [x, z] = site ? site.positions[0] : PLOTS[label.id];
        // How wide the place is, and how high what stands on it reaches (no higher than
        // the marker rule looks).
        const span = site
          ? site.radius * 1.5
          : (parcel.base ?? parcel).maxX - (parcel.base ?? parcel).minX;
        const top = Math.min(4.5, site ? 3 : (parcel.top ?? 0));
        const ground = site ? (view.terrainHeight?.(x, z) ?? 0) : (parcel.bottom ?? 0);
        const [cx, cy] = screen(x, ground, z),
          [, roof] = screen(x, ground + top, z),
          [, above] = screen(x, ground + top + 2.2, z);
        const unit = Math.hypot(...screen(x, ground + 1, z).map((v, n) => v - [cx, cy][n]));
        const drawnSpan = span * unit;
        const [ix, iy] = [(label.collection.x * width) / 100, (label.collection.y * height) / 100];
        // An icon without a size of its own is the old fixed 67-pixel target.
        const drawn = (label.collection.size ?? 67 / 50) * 50;
        // The little a crowded icon may be moved from its own place: its leash.
        const leash = drawn * 1.36 * 0.3 + 1;
        // Over its own place: no further sideways than the place reaches.
        expect(Math.abs(ix - cx), `${label.id} sideways`).toBeLessThanOrEqual(
          drawnSpan / 2 + leash,
        );
        // Just above what stands there: not below its roof, not floating far over it.
        expect(iy, `${label.id} below its roof`).toBeLessThanOrEqual(roof + leash);
        expect(iy, `${label.id} floats`).toBeGreaterThanOrEqual(above - leash);
        // Sized by the place: a floor that reads on a phone, a cap, and full size on a
        // place drawn large.
        expect(drawn, `${label.id} floor`).toBeGreaterThanOrEqual(30);
        expect(drawn, `${label.id} cap`).toBeLessThanOrEqual(50);
        if (drawnSpan * 0.42 >= 52) expect(drawn, `${label.id} on a large place`).toBe(50);
        if (drawnSpan * 0.42 <= 28) expect(drawn, `${label.id} on a small place`).toBe(30);
      }
    },
  );
});

import { expect, it } from 'vitest';
import { Box3, BoxGeometry, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { MOTOR_AGE_VARIANTS, MOTOR_AGE_BUILDINGS } from '../src/data/motorAge';
import { createTown } from '../src/data/town';
import { renderMotorLandmark, addMotorModernization } from '../src/game/town/buildings/motorAge';
import { addMotorActivity } from '../src/game/town/TownMotorActivity';
import { PLOTS, townTracks } from '../src/game/town/TownLayout';
function diorama() {
  const d = Object.create(TownDiorama.prototype);
  d.scene = new Scene();
  d.world = new Group();
  d.scene.add(d.world);
  const geometry = new BoxGeometry();
  d.geometries = Object.fromEntries(
    ['box', 'rounded', 'sphere', 'rock', 'cylinder', 'cone', 'shadow'].map((key) => [
      key,
      geometry,
    ]),
  );
  d.materials = new Map();
  d.contactShadowMaterial = new MeshBasicMaterial();
  d.sign = () => {};
  d.motions = [];
  return d;
}
it.each([...Object.keys(MOTOR_AGE_VARIANTS), ...MOTOR_AGE_BUILDINGS.map((b) => b.kind)])(
  'keeps %s upgrades visible and inside its parcel',
  (kind) => {
    const d = diorama(),
      stages = [];
    for (let level = 1; level <= 3; level++) {
      const root = new Group();
      if (['fisherman', 'riverPort'].includes(kind))
        root.position.set(PLOTS[kind][0], 0, PLOTS[kind][1]);
      if (!renderMotorLandmark(d, root, kind, kind, level))
        addMotorModernization(d, root, kind, level);
      let meshes = 0,
        triangles = 0;
      root.traverse((part) => {
        if (part.isMesh) {
          meshes++;
          triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
        }
      });
      const size = new Box3().setFromObject(root).getSize(new Vector3());
      expect(meshes).toBeGreaterThan(0);
      expect(size.x).toBeLessThan(
        kind === 'bridge' ? 15 : ['fisherman', 'riverPort'].includes(kind) ? 12 : 7.5,
      );
      expect(size.z).toBeLessThan(7.5);
      expect(size.y).toBeLessThan(8);
      expect(size.toArray().every(Number.isFinite)).toBe(true);
      stages.push({ meshes, triangles, size: size.length() });
    }
    for (let i = 1; i < stages.length; i++)
      expect(
        stages[i].meshes > stages[i - 1].meshes ||
          stages[i].triangles > stages[i - 1].triangles ||
          stages[i].size > stages[i - 1].size,
      ).toBe(true);
  },
);
it('runs one bus on connected roads with bounded geometry and a pausable shared clock', () => {
  const d = diorama(),
    town = createTown();
  town.era = 'motor-age';
  addMotorActivity(d, town);
  expect(d.motions).toHaveLength(0);
  Object.assign(town.buildings, { garage: 1, busDepot: 1, bridge: 3 });
  addMotorActivity(d, town);
  expect(d.motions).toHaveLength(1);
  const bus = d.world.children[0],
    count = bus.children.length,
    visited = new Set();
  const roads = townTracks(town);
  const segmentDistance = (p, a, b) => {
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = Math.max(
      0,
      Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz)),
    );
    return Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz);
  };
  for (let n = 0; n < 900; n++) {
    d.motions[0](n / 10);
    expect(
      Math.min(...roads.map((road) => segmentDistance(bus.position, road.from, road.to))),
    ).toBeLessThan(0.01);
    visited.add(Math.round(bus.position.z));
    const position = bus.position.clone();
    d.motions[0](n / 10);
    expect(bus.position).toEqual(position);
    expect(bus.children).toHaveLength(count);
    for (const id of ['garage', 'busDepot'])
      expect(
        Math.abs(bus.position.x - PLOTS[id][0]) > 2 ||
          Math.abs(bus.position.z - PLOTS[id][1]) > 2.5,
      ).toBe(true);
  }
  expect(visited.size).toBeGreaterThan(5);
});

it('keeps all 24 mine chapter jewels attached around the entrance', () => {
  const d = diorama();
  d.mine(d.world, 'Mine', 24);
  const jewels = d.world.getObjectByName('Mine chapter jewels');
  expect(jewels.children).toHaveLength(24);
  const bounds = new Box3().setFromObject(jewels);
  expect(bounds.max.y).toBeLessThan(4.7);
  expect(bounds.max.x - bounds.min.x).toBeLessThan(5);
});

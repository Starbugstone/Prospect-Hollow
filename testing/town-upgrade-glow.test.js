import { afterEach, expect, it, vi } from 'vitest';
import { Box3, CylinderGeometry, Group, Quaternion, Scene, Vector3 } from 'three';
import { MOON_LOTS, moonLotPose, moonPadRadius } from '../src/data/moonSettlement';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { GLOW_WALL, TownUpgradeGlow } from '../src/game/town/TownUpgradeGlow';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';

const glows = [];
const fixture = () => {
  const scene = new Scene(),
    glow = new TownUpgradeGlow(scene);
  glows.push(glow);
  return { scene, glow };
};
afterEach(() => glows.splice(0).forEach((glow) => glow.dispose()));

// World-space positions of a mesh's vertices.
const world = (mesh) => {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.attributes.position;
  return Array.from({ length: position.count }, (_, n) =>
    new Vector3().fromBufferAttribute(position, n).applyMatrix4(mesh.matrixWorld),
  );
};
// Distinct outline corners (float32 vertices) in the ground plane, as angles and distances from a centre.
const corners = (points, x, z) => {
  const out = [];
  for (const point of points) {
    const dx = point.x - x,
      dz = point.z - z,
      distance = Math.hypot(dx, dz);
    if (distance < 1e-6) continue;
    const angle = Math.atan2(dz, dx);
    if (!out.some((c) => Math.abs(Math.sin((c.angle - angle) / 2)) < 1e-5))
      out.push({ angle, distance });
  }
  return out.sort((a, b) => a.angle - b.angle);
};
const sameAngles = (a, b) =>
  a.length === b.length &&
  a.every(({ angle }) => b.some((c) => Math.abs(Math.sin((c.angle - angle) / 2)) < 1e-5));

// The real lot as MoonScene builds it, and its outer parcel pad from moonParcelPad().
function moonPad(id) {
  const d = new TownPrimitives(),
    pose = moonLotPose(id),
    lot = new Group();
  lot.position.set(pose.x, 0, pose.z);
  lot.rotation.y = pose.rotation;
  renderMoonBuilding(d, lot, id, 1);
  let pad = null;
  lot.traverse((part) => {
    if (part.userData.parcelPad && Math.abs(part.scale.x - moonPadRadius(id)) < 1e-9) pad ??= part;
  });
  return { pose, pad };
}

it.each(Object.keys(MOON_LOTS))(
  'the %s glow follows the corners of its rotated octagonal pad',
  (id) => {
    const { glow } = fixture();
    const { pose, pad } = moonPad(id),
      radius = moonPadRadius(id);
    expect(pad, `${id} pad`).not.toBeNull();
    glow.addPolygon(id, { x: pose.x, z: pose.z, radius, sides: 8, rotation: pose.rotation });
    const group = glow.plots.get(id);
    const [halo, aura] = group.children;
    const padCorners = corners(world(pad), pose.x, pose.z);
    expect(padCorners).toHaveLength(8);
    padCorners.forEach(({ distance }) => expect(distance).toBeCloseTo(radius, 5));

    const haloCorners = corners(world(halo), pose.x, pose.z);
    expect(sameAngles(haloCorners, padCorners), `${id} halo corners`).toBe(true);
    haloCorners.forEach(({ distance }) => expect(distance).toBeCloseTo(radius + 1.1, 5));
    // The halo lies flat on the ground and faces the sky.
    const up = new Vector3(0, 0, 1).applyQuaternion(halo.getWorldQuaternion(new Quaternion()));
    expect(up.y).toBeCloseTo(1, 9);
    world(halo).forEach(({ y }) => expect(y).toBeCloseTo(0.08, 5));

    const auraCorners = corners(world(aura), pose.x, pose.z);
    expect(sameAngles(auraCorners, padCorners), `${id} aura corners`).toBe(true);
    auraCorners.forEach(({ distance }) => expect(distance).toBeCloseTo(radius + 0.12, 5));
    // The aura wall rises from the halo with no lid or floor.
    const box = new Box3().setFromObject(aura);
    expect(box.min.y).toBeCloseTo(0.08, 5);
    expect(box.max.y).toBeCloseTo(0.08 + GLOW_WALL.max, 5);
    expect(aura.geometry.parameters.openEnded).toBe(true);
    expect(group.visible).toBe(false);
  },
);

it('fades the polygon halo to its outline and shares one shape per side count', () => {
  const { glow } = fixture();
  glow.addPolygon('settlerDomes', { x: -12, z: 2, radius: 4.6, sides: 8, rotation: 1 });
  glow.addPolygon('craterIceWell', { x: 12, z: 2, radius: 4.4, sides: 8, rotation: -1 });
  glow.addPolygon('hexagon', { x: 0, z: 30, radius: 3, sides: 6 });
  const [a, b, c] = ['settlerDomes', 'craterIceWell', 'hexagon'].map((id) => glow.plots.get(id));
  expect(a.children[0].geometry).toBe(b.children[0].geometry);
  expect(a.children[0].material).toBe(b.children[0].material);
  expect(a.children[1].geometry).toBe(b.children[1].geometry);
  expect(c.children[0].geometry).not.toBe(a.children[0].geometry);
  expect(glow.polygons.size).toBe(2);
  // The square glow's material is unchanged; the octagon has its own edge rule.
  expect(a.children[0].material).not.toBe(glow.halo);
  expect(a.children[1].material).toBe(glow.aura);
  expect(glow.halo.fragmentShader).toContain('max(abs(vUv.x - .5), abs(vUv.y - .5))');
  const shader = a.children[0].material.fragmentShader;
  expect(shader).toContain((Math.PI / 4).toFixed(6));
  expect(shader).toContain(Math.cos(Math.PI / 8).toFixed(6));
  // The same edge rule in JavaScript: 0 at the centre, 1 at every outline vertex.
  const edge = (u, v) => {
    const x = (u - 0.5) * 2,
      y = (v - 0.5) * 2,
      sector = Math.PI / 4;
    const angle = (((Math.atan2(y, x) % sector) + sector) % sector) - sector / 2;
    return (Math.hypot(x, y) * Math.cos(angle)) / Math.cos(sector / 2);
  };
  const uv = a.children[0].geometry.attributes.uv;
  expect(edge(uv.getX(0), uv.getY(0))).toBeCloseTo(0, 9);
  for (let n = 1; n < uv.count; n++) expect(edge(uv.getX(n), uv.getY(n))).toBeCloseTo(1, 6);
});

it('setAvailable toggles square and polygon glows together', () => {
  const { glow } = fixture();
  glow.add('farm', { min: { x: 0, y: 0, z: 0 }, max: { x: 2, y: 1, z: 2 } });
  glow.addPolygon('settlerDomes', { x: -12, z: 2, radius: 4.6, sides: 8 });
  const farm = glow.plots.get('farm'),
    dome = glow.plots.get('settlerDomes');
  expect(glow.root.children).toEqual([farm, dome]);
  expect(glow.setAvailable([])).toBe(false);
  expect(glow.setAvailable(['settlerDomes'])).toBe(true);
  expect([farm.visible, dome.visible]).toEqual([false, true]);
  expect(glow.setAvailable(['settlerDomes'])).toBe(false);
  expect(glow.setAvailable(['farm', 'settlerDomes', 'missing'])).toBe(true);
  expect([farm.visible, dome.visible]).toEqual([true, true]);
  expect(glow.setAvailable(['farm'])).toBe(true);
  expect([farm.visible, dome.visible]).toEqual([true, false]);
  glow.clear();
  expect(glow.plots.size).toBe(0);
  expect(glow.root.children).toHaveLength(0);
  // Shapes stay cached for the next rebuild of the lots.
  expect(glow.polygons.size).toBe(1);
});

it('dispose releases polygon geometries and materials with the shared ones', () => {
  const { scene, glow } = fixture();
  glows.pop();
  glow.addPolygon('settlerDomes', { x: -12, z: 2, radius: 4.6, sides: 8 });
  glow.addPolygon('saucerPad', { x: 15, z: -30, radius: 6.4, sides: 6 });
  const owned = [...glow.polygons.values()].flatMap(({ halo, plane, wall }) => [halo, plane, wall]);
  const shared = [glow.box, glow.plane, glow.halo, glow.aura];
  const spies = [...owned, ...shared].map((resource) => vi.spyOn(resource, 'dispose'));
  glow.dispose();
  spies.forEach((spy) => expect(spy).toHaveBeenCalledTimes(1));
  expect(glow.polygons.size).toBe(0);
  expect(glow.plots.size).toBe(0);
  expect(scene.children).not.toContain(glow.root);
});

it('square plots keep their box glow', () => {
  const { glow } = fixture();
  glow.add('farm', { min: { x: 1, y: 0.5, z: -2 }, max: { x: 4, y: 3.5, z: 1 } });
  const group = glow.plots.get('farm');
  const [halo, aura] = group.children;
  expect(group.visible).toBe(false);
  expect(group.position.toArray()).toEqual([2.5, 0.65, -0.5]);
  expect(halo.geometry).toBe(glow.plane);
  expect(halo.material).toBe(glow.halo);
  expect(halo.rotation.x).toBeCloseTo(-Math.PI / 2, 12);
  expect([halo.rotation.y, halo.rotation.z]).toEqual([0, 0]);
  expect(halo.scale.toArray()).toEqual([4.8, 4.8, 1]);
  expect(aura.geometry).toBe(glow.box);
  expect(aura.material).toBe(glow.aura);
  expect(aura.scale.x).toBeCloseTo(3.25, 12);
  // A 3-unit building: 45% of its height, capped to the faint band around the base.
  expect(aura.scale.y).toBeCloseTo(GLOW_WALL.max, 12);
  expect(aura.scale.z).toBeCloseTo(3.25, 12);
  expect(aura.position.y).toBeCloseTo(GLOW_WALL.max / 2, 12);
  // Only the four vertical faces of the box are drawn.
  expect(glow.box.index.count).toBe(24);
  expect(glow.box.groups).toHaveLength(0);
  // Low buildings still get a visible wall.
  glow.add('well', { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 0.2, z: 1 } });
  expect(glow.plots.get('well').children[1].scale.y).toBe(0.6);
  expect(new CylinderGeometry(1, 1, 1, 8).parameters.radialSegments).toBe(8);
});

it('keeps the glow a low band around the base, however tall the building', () => {
  const glow = new TownUpgradeGlow(new Scene());
  // A space elevator tower forty units tall.
  glow.add('spaceElevator', new Box3(new Vector3(-2, 0, -2), new Vector3(2, 40, 2)));
  const aura = glow.plots.get('spaceElevator').children[1];
  expect(aura.scale.y).toBe(GLOW_WALL.max);
  glow.addPolygon('tallPad', { x: 0, z: 0, radius: 4, sides: 8, height: 40 });
  expect(glow.plots.get('tallPad').children[1].scale.y).toBe(GLOW_WALL.max);
  glow.dispose();
});

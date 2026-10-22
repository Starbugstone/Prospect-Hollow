import { afterEach, beforeAll, expect, it } from 'vitest';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TOWN_CAMERA_POSITION, TOWN_CAMERA_FOCUS_HEIGHT } from '../src/data/townCamera';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { renderMotorLandmark } from '../src/game/town/buildings/motorAge';
import TownCityBuilding from '../src/components/town/TownCityBuilding.vue';

const eras = ['post-war', 'aviation', 'broadcast', 'contemporary'];
const drawings = [];
beforeAll(() => loadFamilies(eras));
afterEach(() => drawings.splice(0).forEach((d) => d.disposePrimitives()));

function draw(era, level) {
  const d = new TownPrimitives();
  d.sign = () => {};
  drawings.push(d);
  const root = new Group();
  expect(
    era === 'motor-age'
      ? renderMotorLandmark(d, root, 'home', 'Home', level, era, 3)
      : renderCityBuilding(d, root, 'home', 'Home', level, era, 3),
  ).toBe(true);
  root.updateMatrixWorld(true);
  const modules = [];
  root.traverse((part) => {
    if (part.userData.purposeModule) modules.push(part);
  });
  expect(modules).toHaveLength(1);
  return { root, module: modules[0] };
}

function meshes(object, semantic) {
  const result = [];
  object.traverse((part) => {
    if (!part.isMesh || /plant|pot|lamp|rail|sign/i.test(part.name)) return;
    if (!semantic) {
      result.push(part);
      return;
    }
    for (let parent = part; parent && parent !== object; parent = parent.parent) {
      if (!parent.userData.modulePart) continue;
      if (parent.userData.modulePart === semantic) result.push(part);
      break;
    }
  });
  return result;
}

const bounds = (object) => new Box3().setFromObject(object);
function signature(parts) {
  return JSON.stringify(
    parts.map((part) => [
      Array.from(part.geometry.attributes.position.array),
      Array.from(part.geometry.index?.array ?? []),
      part.matrixWorld.elements.map((value) => Number(value.toFixed(6))),
    ]),
  );
}

it.each(eras)(
  '%s home completes a supported, visible working shade inside its mature envelope',
  (era) => {
    const stages = [1, 2, 3].map((level) => draw(era, level));
    const structural = stages.map(({ module }) => meshes(module, 'structure'));
    expect(signature(structural[1])).toBe(signature(structural[0]));
    expect(signature(structural[2])).toBe(signature(structural[0]));
    // Exclude the new bearing frame when recovering the established module's
    // reservation, so growing the frame cannot make the containment test pass.
    const mature = new Box3();
    structural[0]
      .filter((part) => !part.name.startsWith('Terrace canopy'))
      .forEach((part) => mature.union(bounds(part)));

    for (const { root } of stages) {
      const deck = bounds(root.getObjectByName('Occupied balcony deck'));
      const beam = bounds(root.getObjectByName('Terrace canopy front beam'));
      expect(mature.clone().expandByScalar(1e-6).containsBox(beam)).toBe(true);
      const posts = meshes(root).filter((part) => part.name === 'Terrace canopy bearing post');
      expect(posts).toHaveLength(2);
      for (const post of posts) {
        const box = bounds(post);
        expect(mature.clone().expandByScalar(1e-6).containsBox(box)).toBe(true);
        expect(box.min.y).toBeCloseTo(deck.max.y, 6);
        expect(box.max.y).toBeCloseTo(beam.min.y, 6);
        expect(beam.min.x).toBeLessThan(box.min.x);
        expect(beam.max.x).toBeGreaterThan(box.max.x);
        expect(deck.min.z).toBeLessThan(box.min.z);
        expect(deck.max.z).toBeGreaterThan(box.max.z);
      }
    }
    expect(stages[1].root.getObjectByName('Working terrace shade louver')).toBeUndefined();
    const { root, module } = stages[2];
    const louvers = meshes(module, 'operation').filter(
      (part) => part.name === 'Working terrace shade louver',
    );
    expect(louvers).toHaveLength(3);
    const beam = bounds(root.getObjectByName('Terrace canopy front beam'));
    const cowl = bounds(root.getObjectByName('Purpose equipment cowl'));
    const approach = new Box3(new Vector3(-0.39, 0.05, 1.5), new Vector3(0.39, 1.7, 3.2));
    const direction = new Vector3(...TOWN_CAMERA_POSITION);
    direction.y -= TOWN_CAMERA_FOCUS_HEIGHT;
    direction.normalize();
    let shadeArea = 0;
    let exposed = 0;
    for (const louver of louvers) {
      const box = bounds(louver);
      expect(mature.clone().expandByScalar(1e-6).containsBox(box)).toBe(true);
      expect(box.intersectsBox(approach)).toBe(false);
      expect(box.min.y).toBeCloseTo(beam.max.y, 6);
      expect(box.max.y).toBeCloseTo(cowl.min.y, 6);
      expect(box.min.z).toBeLessThan(cowl.max.z);
      expect(box.max.z).toBeGreaterThan(beam.min.z);
      const size = box.getSize(new Vector3());
      shadeArea += size.x * size.z;
      const target = box.getCenter(new Vector3());
      target.y = box.max.y;
      target.z = box.max.z - 0.04;
      const origin = target.clone().addScaledVector(direction, 30);
      const hit = new Raycaster(origin, direction.clone().negate()).intersectObject(root, true)[0];
      if (hit?.object === louver) exposed++;
    }
    // A useful roof plane must appear from the actual default view direction,
    // rather than passing because furniture changed colour or a rail was added.
    expect(shadeArea).toBeGreaterThan(0.4);
    expect(exposed).toBeGreaterThanOrEqual(2);
    expect(signature(meshes(stages[1].module, 'operation'))).not.toBe(
      signature(meshes(module, 'operation')),
    );
    const triangles = (parts) =>
      parts.reduce(
        (sum, part) =>
          sum + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
        0,
      );
    expect(triangles(meshes(module)) - triangles(meshes(stages[1].module))).toBeLessThanOrEqual(72);
    expect(meshes(module).length).toBeLessThanOrEqual(64);
    expect(triangles(meshes(module))).toBeLessThanOrEqual(3200);
  },
);

it.each([
  ['motor-age', 'aviation'],
  ['aviation', 'broadcast'],
])('keeps the %s mature home room, balcony and bearing frame at %s finish1', (before, after) => {
  const old = draw(before, 3);
  const next = draw(after, 1);
  for (const name of [
    'Attached upper service room',
    'Occupied balcony deck',
    'Terrace canopy bearing post',
    'Terrace canopy front beam',
  ]) {
    const oldParts = meshes(old.module).filter((part) => part.name === name);
    const newParts = meshes(next.module).filter((part) => part.name === name);
    expect(oldParts.length, name).toBeGreaterThan(0);
    expect(signature(newParts), name).toBe(signature(oldParts));
  }
});

it('shows the retained frame and final working shade in the SVG fallback', async () => {
  const render = (level) =>
    renderToString(
      createSSRApp({
        render: () =>
          h(TownCityBuilding, {
            kind: 'home',
            era: 'aviation',
            level,
            serviceLevel: 3,
          }),
      }),
    );
  const second = await render(2);
  const third = await render(3);
  expect(second).toContain('data-terrace-canopy-frame="true"');
  expect(third).toContain('data-terrace-canopy-frame="true"');
  expect(second).not.toContain('data-working-terrace-shade="true"');
  expect(third).toContain('data-working-terrace-shade="true"');
  expect(third.match(/data-terrace-shade-louver="true"/g)).toHaveLength(3);
});

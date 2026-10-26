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

const eras = ['post-war', 'motor-age', 'aviation', 'broadcast', 'contemporary'];
const drawings = [];
beforeAll(() => loadFamilies(eras));
afterEach(() => drawings.splice(0).forEach((d) => d.disposePrimitives()));

function draw(era, level, serviceLevel = 3) {
  const d = new TownPrimitives();
  d.sign = () => {};
  drawings.push(d);
  const root = new Group();
  expect(
    era === 'motor-age'
      ? renderMotorLandmark(d, root, 'home', 'Home', level, era, serviceLevel)
      : renderCityBuilding(d, root, 'home', 'Home', level, era, serviceLevel),
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
  '%s home retains its working shade and gives both paid finishes substantial geometric grades',
  (era) => {
    const stages = [1, 2, 3].map((level) => draw(era, level));
    const structural = stages.map(({ module }) => meshes(module, 'structure'));
    expect(signature(structural[1])).toBe(signature(structural[0]));
    expect(signature(structural[2])).toBe(signature(structural[0]));
    // Exclude the new bearing frame when recovering the established module's
    // reservation, so growing the frame cannot make the containment test pass.
    const mature = new Box3();
    structural[0]
      .filter((part) => !/^Terrace (canopy|louver axle)/.test(part.name))
      .forEach((part) => mature.union(bounds(part)));

    const approach = new Box3(new Vector3(-0.39, 0.05, 1.5), new Vector3(0.39, 1.7, 3.2));
    const direction = new Vector3(...TOWN_CAMERA_POSITION);
    direction.y -= TOWN_CAMERA_FOCUS_HEIGHT;
    direction.normalize();
    const bladeProfiles = [];
    const fasciaAreas = [];
    const fasciaVolumes = [];
    for (const { root, module } of stages) {
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
      const fascia = bounds(root.getObjectByName('Working terrace weather fascia'));
      expect(mature.clone().expandByScalar(1e-6).containsBox(fascia)).toBe(true);
      expect(fascia.intersectsBox(approach)).toBe(false);
      expect(fascia.min.y).toBeCloseTo(beam.min.y, 6);
      expect(fascia.min.z).toBeLessThan(beam.max.z);
      const fasciaSize = fascia.getSize(new Vector3());
      fasciaAreas.push(fasciaSize.x * fasciaSize.y);
      fasciaVolumes.push(fasciaSize.x * fasciaSize.y * fasciaSize.z);
      const louvers = meshes(module, 'operation').filter(
        (part) => part.name === 'Working terrace shade louver',
      );
      expect(louvers).toHaveLength(3);
      const cowl = bounds(root.getObjectByName('Purpose equipment cowl'));
      const bearings = meshes(module, 'structure').filter(
        (part) => part.name === 'Terrace louver axle bearing',
      );
      expect(bearings).toHaveLength(3);
      for (const bearing of bearings) {
        const box = bounds(bearing);
        expect(mature.clone().expandByScalar(1e-6).containsBox(box)).toBe(true);
        expect(box.min.y).toBeCloseTo(beam.max.y, 6);
        expect(box.max.y).toBeCloseTo(cowl.min.y, 6);
        expect(box.min.z).toBeLessThan(cowl.max.z);
        expect(box.max.z).toBeGreaterThan(beam.min.z);
      }
      let shadeArea = 0;
      let exposed = 0;
      let profile = 0;
      for (const louver of louvers) {
        const box = bounds(louver);
        expect(mature.clone().expandByScalar(1e-6).containsBox(box)).toBe(true);
        expect(box.intersectsBox(approach)).toBe(false);
        expect(
          bearings.some((bearing) =>
            bounds(bearing).containsPoint(louver.getWorldPosition(new Vector3())),
          ),
        ).toBe(true);
        // Actual points on each blade's surfaces penetrate the real bearings
        // in BOTH closed and open poses, rather than only overlapping AABBs.
        const frontBearing = new Vector3(-0.3, -0.5, 0.5 - 0.02 / louver.scale.z).applyMatrix4(
          louver.matrixWorld,
        );
        const backBearing = new Vector3(0.3, 0.5, -0.5 + 0.02 / louver.scale.z).applyMatrix4(
          louver.matrixWorld,
        );
        expect(beam.clone().expandByScalar(1e-6).containsPoint(frontBearing)).toBe(true);
        expect(cowl.clone().expandByScalar(1e-6).containsPoint(backBearing)).toBe(true);
        const size = box.getSize(new Vector3());
        shadeArea += size.x * size.z;
        profile += size.x * size.y;
        const target = new Vector3(0.25, 0.5, 0.5 - 0.24 / louver.scale.z).applyMatrix4(
          louver.matrixWorld,
        );
        const origin = target.clone().addScaledVector(direction, 30);
        const hit = new Raycaster(origin, direction.clone().negate()).intersectObject(
          root,
          true,
        )[0];
        if (hit?.object === louver) exposed++;
      }
      expect(shadeArea).toBeGreaterThan(0.6);
      expect(exposed).toBeGreaterThanOrEqual(2);
      bladeProfiles.push(profile);
      expect(root.getObjectByName('Terrace bench back')).toBeDefined();
      expect(root.getObjectByName('Terrace working table')).toBeDefined();
    }
    // These thresholds count functional surfaces and actual mesh transforms;
    // plants, lamps, rails, signs, material swaps and furniture do not supply
    // either required paid-tier difference.
    expect(fasciaAreas[1] - fasciaAreas[0]).toBeGreaterThan(0.18);
    expect(fasciaVolumes[1] - fasciaVolumes[0]).toBeGreaterThan(0.02);
    expect(signature(meshes(stages[1].module, 'frontage'))).not.toBe(
      signature(meshes(stages[0].module, 'frontage')),
    );
    expect(bladeProfiles[2] - bladeProfiles[1]).toBeGreaterThan(0.15);
    expect(signature(meshes(stages[1].module, 'operation'))).not.toBe(
      signature(meshes(stages[2].module, 'operation')),
    );
    const triangles = (parts) =>
      parts.reduce(
        (sum, part) =>
          sum + (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3,
        0,
      );
    for (const { module } of stages) {
      expect(meshes(module)).toHaveLength(meshes(stages[0].module).length);
      expect(triangles(meshes(module))).toBe(triangles(meshes(stages[0].module)));
      expect(meshes(module).length).toBeLessThanOrEqual(64);
      expect(triangles(meshes(module))).toBeLessThanOrEqual(3200);
    }
  },
);

it.each([
  ['motor-age', 'aviation'],
  ['aviation', 'broadcast'],
])(
  'keeps the %s mature home room, balcony, seating and paid shade at %s finish1',
  (before, after) => {
    const old = draw(before, 3);
    const next = draw(after, 1);
    for (const name of [
      'Attached upper service room',
      'Occupied balcony deck',
      'Terrace canopy bearing post',
      'Terrace canopy front beam',
      'Terrace louver axle bearing',
      'Terrace bench',
      'Terrace bench back',
      'Terrace working table',
    ]) {
      const oldParts = meshes(old.module).filter((part) => part.name === name);
      const newParts = meshes(next.module).filter((part) => part.name === name);
      expect(oldParts.length, name).toBeGreaterThan(0);
      expect(signature(newParts), name).toBe(signature(oldParts));
    }
    const blades = (module) =>
      meshes(module, 'operation').filter((part) => part.name === 'Working terrace shade louver');
    const oldBlades = blades(old.module);
    const newBlades = blades(next.module);
    expect(oldBlades).toHaveLength(3);
    expect(newBlades).toHaveLength(3);
    let oldCoverage = 0;
    let newCoverage = 0;
    for (let index = 0; index < oldBlades.length; index++) {
      const before = oldBlades[index];
      const after = newBlades[index];
      expect(Array.from(after.geometry.attributes.position.array)).toEqual(
        Array.from(before.geometry.attributes.position.array),
      );
      expect(after.scale.toArray()).toEqual(before.scale.toArray());
      expect(after.getWorldPosition(new Vector3()).toArray()).toEqual(
        before.getWorldPosition(new Vector3()).toArray(),
      );
      const oldSize = bounds(before).getSize(new Vector3());
      const newSize = bounds(after).getSize(new Vector3());
      oldCoverage += oldSize.x * oldSize.z;
      newCoverage += newSize.x * newSize.z;
    }
    // The new era can close/restyle its existing blades, but cannot delete the
    // paid shade, reduce it to a token fitting, or buy a second purpose module.
    expect(newCoverage).toBeGreaterThanOrEqual(oldCoverage * 0.9);
  },
);

it('keeps full working shade gated on the mature service module', () => {
  const { root } = draw('aviation', 2, 2);
  expect(root.getObjectByName('Working terrace shade louver')).toBeUndefined();
  expect(root.getObjectByName('Terrace bench back')).toBeUndefined();
});

it('shows the retained shade and both geometric finish grades in the SVG fallback', async () => {
  const render = (level, serviceLevel = 3) =>
    renderToString(
      createSSRApp({
        render: () =>
          h(TownCityBuilding, {
            kind: 'home',
            era: 'aviation',
            level,
            serviceLevel,
          }),
      }),
    );
  const stages = await Promise.all([1, 2, 3].map((level) => render(level)));
  for (const html of stages) {
    expect(html).toContain('data-terrace-canopy-frame="true"');
    expect(html).toContain('data-working-terrace-shade="true"');
    expect(html).toContain('data-terrace-shade-bearings="true"');
    expect(html.match(/data-terrace-shade-louver="true"/g)).toHaveLength(3);
    expect(html).toContain('data-terrace-weather-fascia="true"');
  }
  expect(stages[0]).toContain('data-shade-pose="closed"');
  expect(stages[1]).toContain('data-shade-pose="closed"');
  expect(stages[2]).toContain('data-shade-pose="ventilating"');
  expect(stages[0]).toContain('M-131-123-93-112v3l-38-11Z');
  expect(stages[1]).toContain('M-131-129-93-118v9l-38-11Z');
  expect(stages[2]).toContain('M-128-128-112-140-103-133-119-121Z');
  expect(await render(2, 2)).not.toContain('data-working-terrace-shade="true"');
});

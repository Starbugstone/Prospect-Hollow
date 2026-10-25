import { describe, expect, it, vi } from 'vitest';
import { Box3, Group, PerspectiveCamera, Vector3 } from 'three';
import {
  MOON_LOTS,
  MOON_RING_ROAD,
  moonLotPose,
  moonPathDistance,
} from '../src/data/moonSettlement';
import { skySaucer } from '../src/data/skyCraft';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';
import {
  MoonSaucer,
  MOON_SAUCER_CYCLE,
  MOON_SAUCER_PAD,
  moonSaucerBuilt,
  moonSaucerFlightPoint,
  moonSaucerPose,
} from '../src/game/town/moon/MoonSaucer';

const townAt = (level = 1, era = 'moonward') => ({
  era: 'twin-hollows',
  buildings: { saucerPad: level },
  buildingEras: { airport: era },
});
function fixture() {
  const d = new TownPrimitives(),
    scene = new Group();
  const saucer = new MoonSaucer(d, scene, { camera: new PerspectiveCamera() });
  return {
    d,
    scene,
    saucer,
    dispose() {
      saucer.dispose();
      d.clearGroup(scene);
      d.disposePrimitives();
    },
  };
}

describe('Moon saucer visits', () => {
  it('requires a completed Saucer Pad, including while construction is pending', () => {
    const f = fixture();
    try {
      for (const town of [
        undefined,
        {},
        { buildings: {} },
        townAt(0),
        {
          ...townAt(0),
          projects: { saucerPad: { id: 'saucerPad', stage: 1, wins: 0, required: 1 } },
        },
        {
          ...townAt(0),
          projects: { saucerPad: { id: 'saucerPad', stage: 1, wins: 1, required: 1 } },
        },
      ]) {
        expect(moonSaucerBuilt(town)).toBe(false);
        f.saucer.update(town, 34, false);
        expect(f.scene.children).toHaveLength(0);
      }
      for (const level of [1, 2, 3]) {
        f.saucer.update(townAt(level), 34, false);
        expect(f.saucer.craft.root.visible).toBe(true);
        expect(f.scene.children).toHaveLength(2);
      }
      const root = f.saucer.craft.root;
      f.saucer.update(townAt(2), 34, false);
      expect(f.saucer.craft.root).toBe(root);
      f.saucer.update(townAt(0), 34, false);
      expect(f.scene.children).toHaveLength(0);
    } finally {
      f.dispose();
    }
  });

  it.each(['moonward', 'canopy', 'unknown', undefined])(
    'uses the valley airport paint (%s), including retained Moonward paint in Twin Hollows',
    (era) => {
      const f = fixture();
      try {
        const town = townAt(1);
        town.buildingEras.airport = era;
        f.saucer.update(town, 34, false);
        const hull = f.saucer.craft.root.children[0];
        expect(`#${hull.material.color.getHexString()}`).toBe(skySaucer(era).shell);
        const original = f.saucer.craft.root;
        f.saucer.update(townAt(1, 'stargazer'), 34, false);
        expect(original.parent).toBe(null);
        expect(`#${f.saucer.craft.root.children[0].material.color.getHexString()}`).toBe(
          skySaucer('stargazer').shell,
        );
      } finally {
        f.dispose();
      }
    },
  );

  it('parks on the pad with extended feet, clear of the hatch, ring road and every finished building', () => {
    const f = fixture(),
      pad = MOON_SAUCER_PAD;
    try {
      f.saucer.update(townAt(3), 34, false);
      f.scene.updateMatrixWorld(true);
      const legs = f.saucer.craft.root.getObjectByName('saucerLegs');
      const feet = new Box3().setFromObject(legs);
      expect(feet.min.y).toBeGreaterThanOrEqual(pad.y - 0.01);
      expect(feet.min.y).toBeLessThan(pad.y + 0.03);
      // Each actual foot stays inside the octagonal top, including its diagonal edges.
      const topRadius = pad.radius - 0.25;
      for (const leg of legs.children) {
        const point = new Vector3(0, -0.5, 0).applyMatrix4(leg.matrixWorld);
        for (let n = 0; n < 8; n++) {
          const angle = ((n + 0.5) * Math.PI) / 4;
          expect(
            (point.x - MOON_LOTS.saucerPad[0]) * Math.sin(angle) +
              (point.z - MOON_LOTS.saucerPad[1]) * Math.cos(angle),
          ).toBeLessThan(topRadius * Math.cos(Math.PI / 8));
        }
      }
      const buildings = new Group();
      f.scene.add(buildings);
      const solids = [];
      for (const id of Object.keys(MOON_LOTS)) {
        const pose = moonLotPose(id),
          lot = f.d.group(buildings, pose.x, 0, pose.z);
        lot.rotation.y = pose.rotation;
        renderMoonBuilding(f.d, lot, id, 3);
      }
      buildings.updateMatrixWorld(true);
      buildings.traverse((object) => {
        if (!object.isMesh) return;
        const box = new Box3().setFromObject(object);
        if (box.max.y <= pad.y + 0.02) return; // The supporting pad itself.
        solids.push({ object, box });
      });
      const root = f.saucer.craft.root;
      for (let time = 6; time < 92; time += 0.25) {
        f.saucer.step(time);
        // Exclude the world-space sparkle wake from the hull's collision bounds.
        const trail = root.getObjectByName('saucerTrail');
        root.remove(trail);
        const craftBox = new Box3().setFromObject(root);
        root.add(trail);
        for (const { object, box } of solids) {
          if (object.geometry === f.d.geometries['future-hoop']) {
            // A hoop's box includes its empty centre; use its actual radial envelope.
            if (craftBox.max.y < box.min.y || craftBox.min.y > box.max.y) continue;
            const center = box.getCenter(new Vector3());
            const separation = Math.hypot(root.position.x - center.x, root.position.z - center.z);
            expect(separation - 2.56 * pad.scale).toBeGreaterThan(object.scale.x * 1.13);
          } else if (craftBox.max.y >= box.min.y && craftBox.min.y <= box.max.y) {
            // A cylindrical hull does not fill the corners of its rotated AABB.
            // Test its conservative horizontal radius against each solid's box.
            const dx = Math.max(box.min.x - root.position.x, 0, root.position.x - box.max.x);
            const dz = Math.max(box.min.z - root.position.z, 0, root.position.z - box.max.z);
            expect(
              Math.hypot(dx, dz),
              `solid collision at ${time}: ${object.name}, ${object.position.toArray()}`,
            ).toBeGreaterThan(2.56 * pad.scale);
          }
        }
        if (root.position.y < 3) {
          expect(
            Math.abs(MOON_RING_ROAD - Math.hypot(root.position.x, root.position.z)),
          ).toBeGreaterThan(2.56 * pad.scale + 1.2);
          expect(moonPathDistance(root.position.x, root.position.z)).toBeGreaterThan(
            2.56 * pad.scale + 0.6,
          );
        }
      }
    } finally {
      f.dispose();
    }
  });

  it('shares its sky path with the wake, descends vertically, dwells and repeats', () => {
    for (const time of [6, 10, 17.99, 80, 85, 91.99]) {
      const pose = moonSaucerPose(time),
        point = moonSaucerFlightPoint(time, true, new Vector3());
      for (const key of ['x', 'y', 'z']) expect(pose[key]).toBeCloseTo(point[key], 10);
    }
    for (let time = 18; time < 80; time += 0.1) {
      const pose = moonSaucerPose(time);
      expect(pose.x).toBe(MOON_SAUCER_PAD.x);
      expect(pose.z).toBe(MOON_SAUCER_PAD.z);
      expect(pose.y).toBeGreaterThanOrEqual(MOON_SAUCER_PAD.y);
    }
    expect(moonSaucerPose(34)).toEqual(moonSaucerPose(69));
    for (let time = 0; time < MOON_SAUCER_CYCLE; time += 0.5) {
      expect(moonSaucerPose(time)).toEqual(moonSaucerPose(time + MOON_SAUCER_CYCLE));
    }
  });

  it('keeps flying with reduced motion, as the valley saucer does, without its wake or dust', () => {
    const f = fixture();
    try {
      f.saucer.update(townAt(), 10, true);
      for (const time of [0, 10, 33, 74, 81, 140]) {
        f.saucer.step(time, true);
        const pose = moonSaucerPose(time);
        expect(f.saucer.craft.root.visible, `${time}`).toBe(pose.visible);
        if (pose.visible)
          expect(f.saucer.craft.root.position.toArray()).toEqual([pose.x, pose.y, pose.z]);
        expect(f.saucer.dust.visible).toBe(false);
        expect(f.saucer.craft.root.getObjectByName('saucerTrail').visible).toBe(false);
      }
      // Its flight differs through the cycle: it is not held parked on the pad.
      expect(moonSaucerPose(10).phase).not.toBe(moonSaucerPose(34).phase);
    } finally {
      f.dispose();
    }
  });

  it('uses the shared sparkle wake and flash only while arriving/departing, then disposes owned resources once', () => {
    const f = fixture();
    f.saucer.update(townAt(), 10, false);
    const root = f.saucer.craft.root,
      trail = root.getObjectByName('saucerTrail');
    for (const time of [6.3, 10, 80.2, 86]) {
      f.saucer.step(time);
      expect(trail.visible).toBe(true);
    }
    for (const time of [20, 34, 72, 95]) {
      f.saucer.step(time);
      expect(trail.visible).toBe(false);
    }
    const owned = new Set();
    f.scene.traverse((object) => {
      if (object.geometry?.userData.owned) owned.add(object.geometry);
      if (object.material?.userData.transient) owned.add(object.material);
    });
    const disposals = [...owned].map((resource) => vi.spyOn(resource, 'dispose'));
    const shared = vi.spyOn(f.d.geometries.sphere, 'dispose');
    f.saucer.dispose();
    f.saucer.dispose();
    expect(f.scene.children).toHaveLength(0);
    disposals.forEach((dispose) => expect(dispose).toHaveBeenCalledTimes(1));
    expect(shared).not.toHaveBeenCalled();
    f.d.disposePrimitives();
  });
});

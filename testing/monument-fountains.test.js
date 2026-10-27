import { describe, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { PERSONAL_AREAS } from '../src/data/townLandmarks';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { buildLandmark } from '../src/game/town/TownLandmarks';

const named = (root, name) => {
  const nodes = [];
  root.traverse((node) => {
    if (node.name === name) nodes.push(node);
  });
  return nodes;
};

describe('Shared monument fountains', () => {
  it('uses the shaped fountain for every eligible choice and milestone', () => {
    const d = new TownPrimitives();
    try {
      for (const area of PERSONAL_AREAS)
        for (const choice of area.choices)
          for (const tier of area.timeless ? [1] : [1, 2, 3, 4, 5]) {
            const root = buildLandmark(d, new Group(), choice, tier, area.timeless);
            const fountain = root.getObjectByName('Monument fountain court');
            const expected =
              area.settlement !== 'moon' &&
              area.currency !== 'moonstones' &&
              (area.timeless || tier >= 3);
            expect(!!fountain, `${choice} ${tier}`).toBe(expected);
            if (!expected) continue;
            expect(fountain.getObjectByName('Carved fountain basin')).toBeTruthy();
            expect(fountain.getObjectByName('Fountain raised cup')).toBeTruthy();
            expect(named(fountain, 'Continuous curved water streams')).toHaveLength(1);
            expect(named(fountain, 'Fountain expanding ripple')).toHaveLength(12);
          }
    } finally {
      d.disposePrimitives();
    }
  });

  it('moves droplets along fixed arcs into the pool without stretching the water', () => {
    const d = new TownPrimitives();
    try {
      const root = buildLandmark(d, new Group(), 'guardian', 1, true);
      const fountain = root.getObjectByName('Monument fountain court');
      const water = fountain.getObjectByName('Fountain recessed pool');
      const droplets = named(fountain, 'Fountain travelling droplet');
      const droplet = droplets[0];
      const stream = named(fountain, 'Continuous curved water streams')[0];
      const geometry = stream.geometry.attributes.position.array.slice();
      const initial = droplet.position.clone();
      const size = droplet.scale.toArray();
      root.userData.sceneryUpdate(0.5);
      expect(droplet.position.y).toBeGreaterThan(initial.y);
      expect(droplet.position.z).toBeGreaterThan(initial.z);
      root.userData.sceneryUpdate(1.5);
      expect(droplet.position.y).toBeLessThan(initial.y);
      for (const time of [0, 0.5, 1, 1.5, 3.7, 15, 100]) {
        root.userData.sceneryUpdate(time);
        fountain.updateWorldMatrix(true, true);
        for (const drop of droplets) {
          const point = fountain.worldToLocal(drop.getWorldPosition(new Vector3()));
          expect(Math.hypot(point.x, point.z)).toBeLessThan(water.scale.x);
          expect(point.y).toBeGreaterThanOrEqual(water.position.y - 1e-8);
          expect(drop.scale.toArray()).toEqual(size);
        }
      }
      root.userData.sceneryUpdate(0);
      expect(droplet.position.equals(initial)).toBe(true);
      expect(stream.geometry.attributes.position.array).toEqual(geometry);
      const ripple = named(fountain, 'Fountain expanding ripple')[0];
      const radius = ripple.scale.x;
      root.userData.sceneryUpdate(0.5);
      expect(ripple.scale.x).toBeGreaterThan(radius);
    } finally {
      d.disposePrimitives();
    }
  });

  it('holds construction still and shares/disposes the fountain geometry with the town', () => {
    const d = new TownPrimitives();
    const live = buildLandmark(d, new Group(), 'guardian', 1, true);
    const before = Object.keys(d.geometries).length;
    const still = buildLandmark(d, new Group(), 'founders-arch', 1, true, true);
    const pose = () =>
      named(still, 'Fountain travelling droplet').map((node) => node.position.toArray());
    const initial = pose();
    still.userData.sceneryUpdate(20);
    expect(pose()).toEqual(initial);
    expect(still.userData.movingParts).toEqual([]);
    const a = live.getObjectByName('Carved fountain basin').geometry;
    expect(still.getObjectByName('Carved fountain basin').geometry).toBe(a);
    expect(Object.keys(d.geometries).length).toBeGreaterThanOrEqual(before);
    const extra = Object.keys(d.geometries).length;
    buildLandmark(d, new Group(), 'guardian', 1, true);
    expect(Object.keys(d.geometries)).toHaveLength(extra);
    let disposed = 0;
    a.addEventListener('dispose', () => disposed++);
    d.disposePrimitives();
    expect(disposed).toBe(1);
  });
});

import { expect, it } from 'vitest';
import { Box3, Group, Raycaster, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { addMineSite } from '../src/game/town/mine/addMineSite';
import { ERAS } from '../src/data/eras';
import { BUILDINGS, createTown } from '../src/data/town';
import { MINE_SHAFT, mineYardEnvelope } from '../src/data/mineSite';
import { tunnelCeilingAt } from '../src/game/town/TownRailTunnel';
import { mineGrowth } from '../src/data/mineGrowth';

it.each(ERAS.map((e) => e.id))(
  'keeps the complete %s mine out of the forecourt, bore and reserved road',
  (era) => {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      geometries: createTownGeometries(),
      materials: new Map(),
      town: createTown(),
      sign() {},
    });
    d.town.era = era;
    d.town.buildings.railDepot = 3;
    const root = addMineSite(d, new Group(), era, mineGrowth(54));
    let triangles = 0,
      animated = 0;
    root.traverse((o) => {
      if (o.userData.animated) {
        let parent = o.parent;
        while (parent && parent !== root) {
          if (parent.userData.animated) return;
          parent = parent.parent;
        }
        animated++;
      }
      if (!o.isMesh || o.isInstancedMesh) return;
      let parent = o;
      while (parent) {
        if (parent.userData.animated) return;
        parent = parent.parent;
      }
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    expect(triangles).toBeLessThanOrEqual(6000);
    expect(animated).toBeLessThanOrEqual(12);
    const ray = new Raycaster();
    ray.layers.enableAll();
    for (const time of [0, 4, 8, 12]) {
      root.userData.mineUpdate(time);
      root.updateMatrixWorld(true);
      for (const z of [-24.35, -23, -21.65])
        for (const y of [0.3, 1.8, tunnelCeilingAt(z, -23) - 0.12]) {
          ray.set(new Vector3(-18, y, z), new Vector3(1, 0, 0));
          ray.far = 36;
          expect(ray.intersectObject(root, true), `${era} rail bore ${z},${y}`).toHaveLength(0);
        }
      root.traverse((o) => {
        if (!o.isMesh || o.isInstancedMesh) return;
        const b = new Box3().setFromObject(o);
        if (b.max.y <= 0.07) return;
        const forecourt = b.max.x > -3.4 && b.min.x < 3.4 && b.max.z > -16.5 && b.min.z < -9.8;
        expect(forecourt, `${era} forecourt: ${o.name}`).toBe(false);
        if (b.min.x > 5.2 && b.max.x < 12 && b.min.z > -20.8)
          expect(b.max.z).toBeLessThanOrEqual(mineYardEnvelope().maxZ + 1e-5);
      });
    }
    expect(root.userData.profile.portal).toBeTruthy();
    expect(root.userData.footprints.every((o) => o.owner === 'mine-site')).toBe(true);
    expect(root.getObjectByName('Sunken mine entrance')).toBeUndefined();
    expect(root.userData.veins.count).toBe(54);
    d.clearGroup(root);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  },
);

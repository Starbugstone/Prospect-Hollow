import { describe, expect, it } from 'vitest';
import { Box3, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { MILLRACE, landscapeGeometry } from '../src/game/town/TownMillrace';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderWatermill } from '../src/game/town/buildings/watermill';
import { addMineCliff, groundHeight } from '../src/game/town/TownLandscape';
import { PLOTS, RAIL_EDGE, plotStreet, routeBetween } from '../src/game/town/TownLayout';
import { RIVER, riverCenterX } from '../src/game/town/TownRiver';
import { ERAS } from '../src/data/eras';
import { BUILDING_BY_ID, createTown } from '../src/data/town';
import { watermillAppearance } from '../src/data/watermill';
import {
  normalizeTown,
  plotUnlocked,
  purchase,
  advanceConstruction,
  finishConstruction,
  upgradeOffer,
} from '../src/game/town/TownRules';

function drawing(run) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.sign = () => {};
  d.batch = () => {};
  try {
    run(d);
  } finally {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
}

describe('A mountain mine and a separate bank-side watermill', () => {
  it('keeps the cliff behind the entrance and the future railway clear', () =>
    drawing((d) => {
      const root = new Group();
      addMineCliff(d, root);
      const bounds = new Box3().setFromObject(root);
      expect(bounds.max.y).toBeGreaterThan(5);
      expect(bounds.max.z).toBeLessThan(PLOTS.mine[1] + 0.48);
      expect(bounds.min.z).toBeGreaterThan(RAIL_EDGE.from[1] + 1.5);
      expect(groundHeight(0, -32)).toBeGreaterThan(8);
      for (let x = -30; x <= 30; x++)
        for (const dz of [-1.5, 0, 1.5]) expect(groundHeight(x, -23 + dz)).toBeLessThanOrEqual(0);
    }));
  it('keeps every mill tier out of the shipping channel and all future lots', () =>
    drawing((d) => {
      for (const era of ERAS)
        for (const level of [1, 2, 3]) {
          const root = new Group();
          root.position.set(PLOTS.watermill[0], 0, PLOTS.watermill[1]);
          renderWatermill(d, root, era.id, level, 'Watermill');
          expect(root.getObjectByName('Watermill wheel')).toBeDefined();
          const bounds = new Box3().setFromObject(root);
          for (let z = bounds.min.z; z <= bounds.max.z; z += 0.25)
            expect(bounds.max.x, era.id).toBeLessThan(riverCenterX(z) - 2.2);
          for (const [id, [x, z]] of Object.entries(PLOTS)) {
            if (id === 'watermill') continue;
            expect(
              bounds.max.x < x - 3 ||
                bounds.min.x > x + 3 ||
                bounds.max.z < z - 3 ||
                bounds.min.z > z + 3,
              `${era.id}: ${id}`,
            ).toBe(true);
          }
        }
    }));
  it('excavates a continuous channel below river level in the rendered ground, with the wheel dipping into it', () => {
    const geometry = landscapeGeometry();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, groundHeight(positions.getX(i), positions.getZ(i)));
    const material = new MeshBasicMaterial();
    const ground = new Mesh(geometry, material);
    ground.updateMatrixWorld();
    try {
      for (const [x, z] of MILLRACE.path) {
        const ray = new Raycaster(new Vector3(x, 3, z), new Vector3(0, -1, 0));
        const hit = ray.intersectObject(ground)[0];
        expect(hit, `channel at ${x}, ${z}`).toBeDefined();
        expect(hit.point.y).toBeLessThan(RIVER.waterHeight - 0.15);
      }
      // Both ends join the existing river; the house foundation remains dry.
      for (const [x, z] of [MILLRACE.path[0], MILLRACE.path.at(-1)])
        expect(x).toBeGreaterThan(riverCenterX(z) - RIVER.halfWidth);
      expect(groundHeight(PLOTS.watermill[0] + 1.25, PLOTS.watermill[1])).toBe(0);
      drawing((d) => {
        const root = new Group();
        renderWatermill(d, root, 'frontier', 1, 'Watermill');
        const wheel = new Box3().setFromObject(root.getObjectByName('Watermill wheel'));
        expect(wheel.min.y).toBeLessThan(RIVER.waterHeight);
        expect(wheel.min.y).toBeGreaterThan(
          groundHeight(PLOTS.watermill[0] + 2.35, PLOTS.watermill[1]),
        );
      });
    } finally {
      geometry.dispose();
      material.dispose();
    }
  });
  it('builds, persists and connects the new Frontier plot through the common lifecycle', () => {
    let town = createTown();
    town.coins = 10000;
    expect(plotUnlocked(town, 'watermill')).toBe(false);
    town.buildings.farm = 1;
    expect(plotUnlocked(town, 'watermill')).toBe(true);
    expect(routeBetween(town, plotStreet('farm'), plotStreet('watermill')).length).toBeGreaterThan(
      1,
    );
    for (let stage = 0; stage < BUILDING_BY_ID.watermill.upgrades.length; stage++) {
      town = purchase(town, 'watermill', stage);
      town = normalizeTown(town);
      town = finishConstruction(advanceConstruction(town), 'watermill', stage + 1);
      expect(town.buildings.watermill).toBe(stage + 1);
    }
    expect(normalizeTown(town).buildings.watermill).toBe(3);
    town.era = 'river-rail';
    expect(upgradeOffer(town, 'watermill')).toMatchObject({
      type: 'modernization',
      available: true,
    });
  });
  it('adds an empty mill to older saves without altering existing progress', () => {
    const saved = createTown();
    saved.era = 'industrial';
    saved.buildings.farm = 3;
    saved.coins = 1234;
    delete saved.buildings.watermill;
    delete saved.buildingEras.watermill;
    const restored = normalizeTown(saved);
    expect(restored).toMatchObject({
      era: 'industrial',
      coins: 1234,
      buildings: { farm: 3, watermill: 0 },
    });
    expect(upgradeOffer(restored, 'watermill').available).toBe(true);
    expect(watermillAppearance('unknown')).toEqual(watermillAppearance('frontier'));
  });
});

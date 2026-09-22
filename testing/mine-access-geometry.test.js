import { expect, it } from 'vitest';
import { Scene, Raycaster, Vector3, Mesh, MeshStandardMaterial } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownStatics } from '../src/game/town/TownStatics';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { buildMineHillside } from '../src/game/town/TownMineHillside';
import { groundHeight, landscapeGroundHeight } from '../src/game/town/TownLandscape';
import { landscapeGeometry } from '../src/game/town/TownMillrace';
import { RAIL_TUNNEL, tunnelCeilingAt, tunnelOuterHeightAt } from '../src/game/town/TownRailTunnel';
import {
  MINE_SHAFT,
  addMineExcavation,
  addMineShaft,
  mineTrackHeight,
  mineTrackPitch,
} from '../src/game/town/TownMineShaft';
import { PLOTS, RAIL_EDGE } from '../src/game/town/TownLayout';

function fixture(build, check) {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  const scene = new Scene(),
    root = d.group(scene);
  build(d, root);
  // Check the geometry the camera draws, including production material culling.
  const statics = new TownStatics(scene);
  statics.rebuild([root]);
  const ray = new Raycaster();
  const hit = (position, direction, far = 100) => {
    ray.set(new Vector3(...position), new Vector3(...direction).normalize());
    ray.far = far;
    scene.updateMatrixWorld(true);
    return ray.intersectObject(statics.mesh, true);
  };
  try {
    check({ hit, root });
  } finally {
    statics.dispose();
    d.clearGroup(root);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
}
it('fits both stone arches and their terrain collar to the same bore without intrusions or gaps', () => {
  fixture(
    (d, root) => buildMineHillside(d, root, PLOTS.mine[1], RAIL_EDGE.from[1], groundHeight, true),
    ({ hit }) => {
      const railZ = RAIL_EDGE.from[1];
      for (const side of [-1, 1]) {
        for (let dz = -1.44; dz <= 1.44; dz += 0.12) {
          const z = railZ + dz,
            ceiling = tunnelCeilingAt(z, railZ);
          for (const y of [0.1, 1.8, ceiling - 0.04])
            expect(
              hit([side * 19, y, z], [-side, 0, 0], 38),
              `bore ${side}, ${dz}, ${y}`,
            ).toHaveLength(0);
        }
        // The rock ends exactly on the outside masonry profile at each portal.
        for (let dz = -1.9; dz <= 1.9; dz += 0.1) {
          const z = railZ + dz,
            hits = hit([side * (RAIL_TUNNEL.portalX - 0.001), 20, z], [0, -1, 0]);
          expect(hits.length).toBeGreaterThan(0);
          expect(hits[0].point.y).toBeCloseTo(tunnelOuterHeightAt(z, railZ), 2);
        }
      }
    },
  );
});
it('keeps the decline open in the terrain and seals the earth around its entrance', () => {
  fixture(
    (d, root) => {
      const geometry = landscapeGeometry(),
        p = geometry.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, landscapeGroundHeight(p.getX(i), p.getZ(i)));
      geometry.userData.owned = true;
      const material = new MeshStandardMaterial();
      material.userData.transient = true;
      root.add(new Mesh(geometry, material));
      addMineExcavation(d, root);
    },
    ({ hit }) => {
      for (let z = MINE_SHAFT.rampStartZ - 0.25; z > MINE_SHAFT.portalZ + 0.1; z -= 0.25) {
        const hits = hit([0, 10, z], [0, -1, 0]);
        expect(hits[0].point.y).toBeCloseTo(mineTrackHeight(z), 2);
      }
      for (const x of [-1.35, 1.35]) {
        const hits = hit([x, -0.3, MINE_SHAFT.portalZ + 1], [0, 0, -1], 2);
        expect(hits).toHaveLength(1);
        expect(hits[0].point.z).toBeCloseTo(MINE_SHAFT.portalZ, 5);
      }
    },
  );
});
it('continues the shaft physically below the full railway width, with smooth cart pitch', () => {
  for (
    let z = RAIL_EDGE.from[1] - RAIL_TUNNEL.halfWidth;
    z <= RAIL_EDGE.from[1] + RAIL_TUNNEL.halfWidth;
    z += 0.1
  )
    expect(mineTrackHeight(z) + MINE_SHAFT.height).toBeLessThan(-1);
  expect(mineTrackPitch(MINE_SHAFT.rampStartZ)).toBeCloseTo(0, 2);
  expect(mineTrackPitch(MINE_SHAFT.portalZ - 0.03)).toBeCloseTo(
    mineTrackPitch(MINE_SHAFT.portalZ + 0.03),
    1,
  );
  fixture(
    (d, root) => {
      const plot = d.group(root, 0, 0.08, PLOTS.mine[1]);
      addMineShaft(d, plot);
    },
    ({ hit }) => {
      const start = [0, MINE_SHAFT.portalFloor + 0.75, MINE_SHAFT.portalZ - 0.02];
      const hits = hit(start, [0, -0.42, -1]);
      expect(hits[0].point.z).toBeCloseTo(MINE_SHAFT.endZ + 0.03, 2);
      for (const side of [-1, 1]) {
        const z = RAIL_EDGE.from[1],
          hits = hit([0, mineTrackHeight(z) + 0.7, z], [side, 0, 0], 2);
        expect(hits.length).toBeGreaterThan(0);
        expect(hits[0].point.x).toBeCloseTo(side * MINE_SHAFT.halfWidth, 2);
      }
    },
  );
});

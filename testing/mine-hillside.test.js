import { expect, it } from 'vitest';
import { Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  addMineCliff,
  groundHeight,
  landscapeGroundHeight,
  cameraTerrainHeight,
} from '../src/game/town/TownLandscape';
import { buildMineHillside } from '../src/game/town/TownMineHillside';
import { landscapeGeometry } from '../src/game/town/TownMillrace';
import { PLOTS, RAIL_EDGE } from '../src/game/town/TownLayout';

it.each([false, true])(
  'connects solid rock to the hill and cuts a tunnel only with railway=%s',
  (railway) => {
    const d = Object.create(TownDiorama.prototype);
    d.geometries = createTownGeometries();
    d.materials = new Map();
    const root = new Group();
    addMineCliff(d, root);
    buildMineHillside(d, root, PLOTS.mine[1], RAIL_EDGE.from[1], groundHeight, railway);
    const geometry = landscapeGeometry();
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++)
      positions.setY(i, landscapeGroundHeight(positions.getX(i), positions.getZ(i)));
    const material = new MeshBasicMaterial();
    root.add(new Mesh(geometry, material));
    root.updateMatrixWorld(true);
    const ray = new Raycaster();
    try {
      // Sample the actual rendered roof from the cliff crest into the original
      // hill: a detached facade would leave a long strip of ground-level hits.
      for (const x of [-2, 0, 2])
        for (let z = -21.15; z >= -33; z -= 0.25) {
          ray.set(new Vector3(x, 30, z), new Vector3(0, -1, 0));
          const hit = ray.intersectObject(root, true)[0];
          expect(hit, `${x}, ${z}`).toBeDefined();
          expect(hit.point.y, `${x}, ${z}`).toBeGreaterThan(4);
          expect(Math.abs(hit.point.y - cameraTerrainHeight(x, z))).toBeLessThan(1);
        }
      // Side-on clearance includes the roof, tunnel walls and natural terrain.
      for (const z of [-24.2, -23, -21.8])
        for (const y of [0.2, 1, 2, 3.5]) {
          ray.set(new Vector3(-20, y, z), new Vector3(1, 0, 0));
          ray.far = 40;
          const hits = ray.intersectObject(root, true);
          if (railway) expect(hits, `train at ${y}, ${z}`).toHaveLength(0);
          else expect(hits.length, `solid rock at ${y}, ${z}`).toBeGreaterThan(0);
        }
    } finally {
      const owned = new Set();
      root.traverse((o) => {
        if (o.geometry?.userData.owned) owned.add(o.geometry);
        if (o.material?.userData.transient) o.material.dispose();
      });
      owned.forEach((g) => g.dispose());
      geometry.dispose();
      material.dispose();
      Object.values(d.geometries).forEach((g) => g.dispose());
      d.materials.forEach((m) => m.dispose());
    }
  },
);

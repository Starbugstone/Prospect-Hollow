import { expect, it } from 'vitest';
import { Color, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  addMineCliff,
  groundHeight,
  landscapeColor,
  landscapeGroundHeight,
  cameraTerrainHeight,
} from '../src/game/town/TownLandscape';
import { MINE_HILLSIDE, buildMineHillside } from '../src/game/town/TownMineHillside';
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
    buildMineHillside(
      d,
      root,
      PLOTS.mine[1],
      RAIL_EDGE.from[1],
      groundHeight,
      landscapeColor,
      railway,
    );
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
        for (const y of [0.2, 1, 2, z === -23 ? 3.5 : 3]) {
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

it('leaves the flat future rail cutting to the landscape before the railway opens', () => {
  const d = Object.create(TownDiorama.prototype);
  const railZ = RAIL_EDGE.from[1];
  const root = buildMineHillside(
    d,
    new Group(),
    PLOTS.mine[1],
    railZ,
    groundHeight,
    landscapeColor,
  );
  const mesh = root.getObjectByName('Mine shoulder and tunnel');
  const { index, attributes } = mesh.geometry;
  const { position, color } = attributes;
  const expected = new Color();
  try {
    let plain = 0;
    for (let i = 0; i < position.count; i++) {
      const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
      if (Math.abs(y - groundHeight(x, z)) > 1e-6) continue;
      // Rock resting on the plain wears the plain's tint: no pale patch.
      landscapeColor(x, z, expected);
      expect(color.getX(i), `${x}, ${z}`).toBeCloseTo(expected.r, 5);
      expect(color.getY(i), `${x}, ${z}`).toBeCloseTo(expected.g, 5);
      expect(color.getZ(i), `${x}, ${z}`).toBeCloseTo(expected.b, 5);
      plain++;
    }
    expect(plain).toBeGreaterThan(0);
    // The unrecessed landscape already covers this strip. A second surface at
    // the same height would flicker against it.
    for (let i = 0; i < index.count; i += 3) {
      const corners = [0, 1, 2].map((k) => index.getX(i + k));
      const inside = corners.every(
        (v) =>
          Math.abs(position.getZ(v) - railZ) <= MINE_HILLSIDE.tunnelHalfWidth &&
          Math.abs(position.getY(v) - groundHeight(position.getX(v), position.getZ(v))) < 1e-6,
      );
      expect(inside, `triangle ${i / 3}`).toBe(false);
    }
  } finally {
    mesh.geometry.dispose();
    mesh.material.dispose();
  }
});

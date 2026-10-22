import { Box3, Matrix3, Matrix4, Raycaster, Vector3 } from 'three';
import { TOWN_CAMERA_POSITION, TOWN_CAMERA_FOCUS_HEIGHT } from '../../data/townCamera';

// Only the authored sign dimensions/parent transform and reserved camera scale
// vary within one generated plot key. Text is painted inside a fixed board.
export function signMountInput(parent, width, x, y, z, context = parent) {
  context.updateWorldMatrix(true, false);
  parent.updateWorldMatrix(true, false);
  const relative = context.matrixWorld.clone().invert().multiply(parent.matrixWorld);
  return [
    width,
    x,
    y,
    z,
    ...relative.elements.map((value) => Math.round(value * 1e5)),
    ...(context.userData.signCameraScale ?? [1, 1, 1]),
  ];
}

// Generated placement is used only for the same authored input. Missing data or
// a custom parent/board retains the exact surface/visibility resolver below.
export function generatedSignMount(record, input) {
  const mount = record?.mount;
  if (
    !Array.isArray(input) ||
    input.length !== 23 ||
    !input.every(Number.isFinite) ||
    !Array.isArray(record?.input) ||
    record.input.length !== input.length ||
    !record.input.every((value, index) => value === input[index]) ||
    !['facade', 'roof', 'directory'].includes(mount?.type) ||
    ![mount.width, mount.x, mount.y, mount.z].every(Number.isFinite) ||
    mount.width <= 0 ||
    !Array.isArray(mount.brackets) ||
    !mount.brackets.every(
      (part) =>
        [part?.x, part?.y, part?.back, part?.front].every(Number.isFinite) &&
        part.front >= part.back,
    ) ||
    (mount.legs !== undefined &&
      (!Array.isArray(mount.legs) ||
        !mount.legs.every(
          (part) =>
            [part?.x, part?.z, part?.base].every(Number.isFinite) && part.base < mount.y + 0.08,
        ))) ||
    (mount.type === 'roof' && !mount.legs?.length) ||
    (mount.type === 'directory' && (!Number.isFinite(mount.base) || mount.base >= mount.y + 0.08))
  )
    return null;
  return mount;
}

// Resolve physical attachment once, when a plot is built. Exact surface probes
// also work on timber planks and the packed same-colour Blender meshes. Boards
// default to a facade above the doorway; open sites use a private side directory.
export function signMount(parent, width, x, y, z, cache, context = parent) {
  // A purpose-built porch may author its own fascia. The renderer supplies the
  // same physical mount contract as the surface resolver, in parent space.
  if (parent.userData.authoredSignMount)
    return { brackets: [], ...parent.userData.authoredSignMount };
  context.updateWorldMatrix(true, true);
  const inverse = new Matrix4().copy(parent.matrixWorld).invert();
  const surfaces = [];
  context.traverse((mesh) => {
    if (
      !mesh.isMesh ||
      mesh.material?.transparent ||
      mesh.material?.userData.signAtlas ||
      mesh.userData.signMount
    )
      return;
    for (let node = mesh; node && node !== parent; node = node.parent)
      if (node.userData.animated || node.userData.vehicleBox) return;
    surfaces.push(mesh);
  });
  const viewScale = context.userData.signCameraScale ?? [1, 1, 1];
  const key =
    cache &&
    [
      width,
      x,
      y,
      z,
      ...viewScale,
      ...parent.matrixWorld.elements.map((v, i) => (i >= 12 && i <= 14 ? 0 : Math.round(v * 1e5))),
      ...surfaces.map((mesh) =>
        [
          mesh.geometry.uuid,
          ...inverse
            .clone()
            .multiply(mesh.matrixWorld)
            .elements.map((v) => Math.round(v * 1e5)),
        ].join(','),
      ),
    ].join('|');
  if (cache?.has(key)) return cache.get(key);
  const finish = (mount) => {
    if (cache) {
      if (cache.size >= 2048) cache.delete(cache.keys().next().value);
      cache.set(key, mount);
    }
    return mount;
  };
  const ray = new Raycaster();
  const bounds = new Box3().setFromObject(context).applyMatrix4(inverse);
  const rayFront = Math.max(z + 0.4, bounds.max.z + 0.4);
  const cameraDirection = new Vector3(...TOWN_CAMERA_POSITION);
  cameraDirection.y -= TOWN_CAMERA_FOCUS_HEIGHT;
  cameraDirection.normalize();
  // Trace in the current pre-setback scene from the equivalent final camera.
  // Nonuniform parcel compression otherwise hides a board's outer letters.
  const inverseScale = context.matrixWorld
    .clone()
    .multiply(new Matrix4().makeScale(...viewScale.map((value) => 1 / value)))
    .multiply(context.matrixWorld.clone().invert());
  cameraDirection.applyMatrix3(new Matrix3().setFromMatrix4(inverseScale));
  function visible(mount) {
    const origin = new Vector3(mount.x, mount.y, mount.z + 0.062)
      .applyMatrix4(parent.matrixWorld)
      .addScaledVector(cameraDirection, 35);
    for (const u of [-0.47, 0, 0.47])
      for (const v of [-0.16, 0, 0.16]) {
        const target = new Vector3(
          mount.x + u * mount.width,
          mount.y + v,
          mount.z + 0.062,
        ).applyMatrix4(parent.matrixWorld);
        ray.set(origin, target.clone().sub(origin).normalize());
        ray.far = origin.distanceTo(target) - 0.01;
        if (ray.intersectObjects(surfaces, false).length) {
          ray.far = Infinity;
          return false;
        }
      }
    ray.far = Infinity;
    return true;
  }
  function probe(px, py, pz, down = false) {
    const origin = new Vector3(px, py, pz).applyMatrix4(parent.matrixWorld);
    const direction = new Vector3(0, down ? -1 : 0, down ? 0 : -1).transformDirection(
      parent.matrixWorld,
    );
    ray.set(origin, direction);
    for (const hit of ray.intersectObjects(surfaces, false)) {
      const point = hit.point.clone().applyMatrix4(inverse);
      if (down) return point;
      if (point.z < z - 4) break;
      const normal = hit.face?.normal
        .clone()
        .transformDirection(hit.object.matrixWorld)
        .transformDirection(inverse);
      if (normal && normal.z > 0.65) return point;
    }
    return null;
  }
  const heights = [...new Set([Math.max(2.05, y), y - 0.25, y - 0.5, y - 0.75, 2.25, 2.05])].filter(
    (height) => height >= 2.05,
  );
  for (const height of heights) {
    const surface = probe(x, height, rayFront);
    if (!surface) continue;
    for (const factor of [1, 0.75, 0.55]) {
      const mountedWidth = width * factor;
      const left = probe(x - mountedWidth * 0.3, height, rayFront);
      const right = probe(x + mountedWidth * 0.3, height, rayFront);
      if (!left || !right) continue;
      const front = Math.max(surface.z, left.z, right.z);
      const mount = {
        type: 'facade',
        width: mountedWidth,
        x,
        y: height,
        z: front + 0.051,
        brackets: [left, right]
          .filter((p) => front - p.z > 0.02)
          .map((p) => ({ x: p.x, y: height, back: p.z, front })),
      };
      if (visible(mount)) return finish(mount);
    }
  }
  // Leaf overhangs can hide a valid wall mount. A small roof directory seats
  // both legs on real roof hits, keeping its lettering above the overhang and
  // every new solid above the clear entrance approach.
  const roofWidth = Math.min(width, 1.8);
  for (const cz of [z, z - 0.5, z - 1, z - 1.5, z - 2, z - 2.5, z - 3.5])
    for (const cx of [x, x + 1, x - 1, x + 2, x - 2]) {
      const legs = [-1, 1].map((side) =>
        probe(cx + side * roofWidth * 0.35, bounds.max.y + 0.5, cz, true),
      );
      if (legs.some((p) => !p || p.y < 1.65)) continue;
      const top = Math.max(...legs.map((p) => p.y));
      const mount = {
        type: 'roof',
        width: roofWidth,
        x: cx,
        y: top + 0.44,
        z: cz + 0.051,
        brackets: [],
        legs: legs.map((p) => ({ x: p.x, z: p.z, base: p.y - 0.02 })),
      };
      if (visible(mount)) return finish(mount);
    }
  const directoryWidth = Math.min(width, 1.25);
  // The front apron (z >= 2) contains private entry paths, including the
  // sideways approach to a central well. Keep the entire directory behind
  // that apron, even after the plot's shared road setback compresses its width.
  const positions = [
    [x - 2.05, Math.min(z, 0.65)],
    [x + 2.05, Math.min(z, 0.65)],
    [x - 2.3, Math.min(z, 0.65)],
    [x + 2.3, Math.min(z, 0.65)],
    [x - 2.3, Math.min(z, 0.15)],
    [x + 2.3, Math.min(z, 0.15)],
    [x - 2.3, Math.min(z, -0.65)],
    [x + 2.3, Math.min(z, -0.65)],
  ];
  const score = ([cx, cz]) =>
    [-1, 1].reduce((total, side) => {
      const hit = probe(cx + side * directoryWidth * 0.38, 1.55, cz, true);
      return total + (hit && hit.y > 0.32 ? 1 : 0);
    }, 0);
  positions.sort((a, b) => score(a) - score(b));
  const clearPosition = positions.find(([cx, cz]) =>
    visible({ x: cx, y: 1.35, z: cz, width: directoryWidth }),
  );
  const position = clearPosition ?? positions[0];
  return finish({
    type: 'directory',
    width: directoryWidth,
    x: position[0],
    y: 1.35,
    z: position[1],
    base: 0.08,
    brackets: [],
  });
}

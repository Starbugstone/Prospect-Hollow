import { DoubleSide, Raycaster, Vector3 } from 'three';

// Test the drawn solid, not its bounding box: a rounded flank can leave a socket
// outside the skin even though their axis-aligned bounds overlap.
export function insideMesh(mesh, worldPoint) {
  const ray = new Raycaster(worldPoint, new Vector3(0.319, 0.817, 0.481).normalize());
  const side = mesh.material.side;
  mesh.material.side = DoubleSide;
  const hits = ray.intersectObject(mesh, false);
  mesh.material.side = side;
  const distances = hits.map((hit) => hit.distance);
  const crossings = distances.filter((distance, n) => !n || distance - distances[n - 1] > 1e-6);
  return crossings.length % 2 === 1;
}

export function socketEmbedded(socket, skin) {
  socket.updateWorldMatrix(true, true);
  const point = socket.getWorldPosition(new Vector3());
  return skin.some((mesh) => insideMesh(mesh, point));
}

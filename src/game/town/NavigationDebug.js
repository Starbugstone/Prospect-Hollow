import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
} from 'three';
let enabled = false,
  current;
function clear(d) {
  if (!d.navigationOverlay) return;
  d.navigationOverlay.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  d.navigationOverlay.removeFromParent();
  d.navigationOverlay = null;
}
export function navigationScene(scene) {
  current = scene;
}
export function releaseNavigation(scene) {
  clear(scene);
  if (current === scene) current = null;
}
export function showNavigation(value = true) {
  enabled = !!value;
  if (current) {
    drawNavigation(current);
    current.render();
  }
  return {
    owners:
      current?.navigation?.obstacles.map(({ owner, activation, version, provisional }) => ({
        owner,
        activation,
        version,
        provisional,
      })) ?? [],
    agents: (current?.locomotionAgents ?? []).map((a) => ({
      id: a.id,
      state: a.motion.state,
      accepted: [a.motion.x, a.motion.z],
      preferred: [a.targetX, a.targetZ],
    })),
  };
}
export function drawNavigation(d) {
  clear(d);
  if (!enabled || !d.navigation) return;
  const root = (d.navigationOverlay = new Group());
  root.name = 'Navigation diagnostics';
  d.scene.add(root);
  const lines = (points, color, name) => {
    if (!points.length) return;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points, 3));
    const line = new LineSegments(geometry, new LineBasicMaterial({ color, depthTest: false }));
    line.name = name;
    line.layers.set(2);
    root.add(line);
  };
  for (const o of d.navigation.obstacles) {
    const ring =
        o.polygon ??
        Array.from({ length: 16 }, (_, i) => [
          o.x + Math.cos((i * Math.PI) / 8) * o.radius,
          o.z + Math.sin((i * Math.PI) / 8) * o.radius,
        ]),
      v = [];
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i],
        b = ring[(i + 1) % ring.length];
      v.push(a[0], o.y + 0.2, a[1], b[0], o.y + 0.2, b[1]);
    }
    lines(
      v,
      o.provisional ? '#ff9d32' : '#f14bd1',
      `${o.owner}: ${o.activation} v${o.version ?? 0}`,
    );
  }
  for (const actor of [...(d.actors ?? []), ...(d.animals ?? [])]) {
    const v = [],
      points = (actor.walkPath ?? actor.path)?.points ?? [];
    for (let i = 1; i < points.length; i++)
      v.push(
        points[i - 1][0],
        points[i - 1][1] + 0.3,
        points[i - 1][2],
        points[i][0],
        points[i][1] + 0.3,
        points[i][2],
      );
    lines(v, '#72e273', 'Prepared route');
    if (actor.motion)
      lines(
        [
          actor.motion.x,
          actor.y + 0.4,
          actor.motion.z,
          actor.targetX ?? actor.motion.x,
          actor.y + 0.4,
          actor.targetZ ?? actor.motion.z,
        ],
        '#f2e167',
        `${actor.id}: ${actor.motion.state}`,
      );
  }
  for (const { group } of d.plotCache?.values() ?? [])
    for (const [kind, points] of Object.entries(group.userData.navigationAnchors ?? {}))
      for (const [x, y, z] of points)
        lines(
          [x - 0.2, y + 0.2, z, x + 0.2, y + 0.2, z, x, y + 0.2, z - 0.2, x, y + 0.2, z + 0.2],
          '#47dfeb',
          `${group.userData.plot} ${kind}`,
        );
}

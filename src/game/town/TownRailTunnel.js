import * as THREE from 'three';

export const RAIL_TUNNEL = Object.freeze({
  halfWidth: 1.5,
  spring: 2.25,
  radius: 1.5,
  thickness: 0.5,
  portalX: 6.3,
  portalDepth: 1,
  approachHalfWidth: 2.15,
  segments: 13,
});
export const tunnelRearX = RAIL_TUNNEL.portalX - RAIL_TUNNEL.portalDepth;
// The bore, masonry and terrain all use these same polygonal arch sections.
export function tunnelProfile(radius = RAIL_TUNNEL.radius) {
  return Array.from({ length: RAIL_TUNNEL.segments + 1 }, (_, i) => {
    const angle = Math.PI - (i * Math.PI) / RAIL_TUNNEL.segments;
    return [radius * Math.cos(angle), RAIL_TUNNEL.spring + radius * Math.sin(angle)];
  });
}
export const tunnelInnerProfile = tunnelProfile();
export const tunnelOuterProfile = tunnelProfile(RAIL_TUNNEL.radius + RAIL_TUNNEL.thickness);
export function profileHeight(profile, offset) {
  for (let i = 1; i < profile.length; i++) {
    const [a, ay] = profile[i - 1],
      [b, by] = profile[i];
    if (offset >= a && offset <= b) return THREE.MathUtils.lerp(ay, by, (offset - a) / (b - a));
  }
  return RAIL_TUNNEL.spring;
}
export const tunnelCeilingAt = (z, railZ) => profileHeight(tunnelInnerProfile, z - railZ);
export const tunnelOuterHeightAt = (z, railZ) => profileHeight(tunnelOuterProfile, z - railZ);

function archBand(d, parent, side, innerA, innerB, outerA, outerB, from, to, color) {
  const shape = new THREE.Shape();
  for (const [i, p] of [innerA, outerA, outerB, innerB].entries())
    shape[i ? 'lineTo' : 'moveTo'](...p);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: to - from,
    bevelEnabled: false,
    steps: 1,
  });
  // Shape x is world z. Rotate and reflect both ends identically along the rails.
  geometry.rotateY(Math.PI / 2);
  geometry.scale(side, 1, -1);
  geometry.translate(side * from, 0, 0);
  if (side > 0) {
    // Reflection reverses winding. Restore it before normals and static batching.
    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i += 3) {
      const a = [positions.getX(i), positions.getY(i), positions.getZ(i)];
      positions.setXYZ(i, positions.getX(i + 2), positions.getY(i + 2), positions.getZ(i + 2));
      positions.setXYZ(i + 2, ...a);
    }
  }
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const mesh = new THREE.Mesh(geometry, d.material(color));
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
export function addTunnelPortals(d, parent, railZ) {
  const portals = d.group(parent, 0, 0, railZ);
  portals.name = 'Stone railway tunnel portals';
  const { radius, spring, portalX, thickness, segments } = RAIL_TUNNEL;
  const colors = ['#aaa18c', '#c2b7a0', '#b3a78f', '#cabea6'];
  for (const side of [-1, 1]) {
    const portal = d.group(portals);
    portal.name = side < 0 ? 'West stone arch' : 'East stone arch';
    for (const edge of [-1, 1]) {
      const backing = d.box(
        portal,
        portalX - tunnelRearX - 0.24,
        spring,
        thickness,
        (side * (tunnelRearX + portalX - 0.24)) / 2,
        spring / 2,
        edge * (radius + thickness / 2),
        '#908a78',
      );
      backing.userData.buildHeight = 0;
      for (let row = 0; row < 5; row++) {
        const block = d.box(
          portal,
          0.24,
          spring / 5 - 0.018,
          thickness,
          side * (portalX - 0.12),
          ((row + 0.5) * spring) / 5,
          edge * (radius + thickness / 2),
          colors[row % 4],
        );
        block.userData.buildHeight = row / 5;
      }
      d.box(
        portal,
        1.1,
        0.16,
        0.6,
        side * (portalX - 0.48),
        0.08,
        edge * (radius + thickness / 2 + 0.05),
        '#978d77',
      );
    }
    for (let i = 0; i < segments; i++) {
      const a = tunnelInnerProfile[i],
        b = tunnelInnerProfile[i + 1],
        c = tunnelOuterProfile[i],
        e = tunnelOuterProfile[i + 1];
      const backing = archBand(d, portal, side, a, b, c, e, tunnelRearX, portalX - 0.24, '#908a78');
      const mix = (p, q, t) => p.map((v, axis) => THREE.MathUtils.lerp(v, q[axis], t));
      const block = archBand(
        d,
        portal,
        side,
        mix(a, b, 0.015),
        mix(a, b, 0.985),
        mix(c, e, 0.015),
        mix(c, e, 0.985),
        portalX - 0.24,
        portalX,
        colors[i % 4],
      );
      block.userData.buildHeight = backing.userData.buildHeight =
        1 + Math.sin(((i + 0.5) * Math.PI) / segments);
    }
  }
  return portals;
}

import { BRIDGE, bridgeDeckHeight } from '../TownRiver';
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { eraEvolution } from '../../../data/eras';
import { resolveRoadStyle } from '../../../data/roadStyles';

function roadDeck(d, parent, profile) {
  const style = resolveRoadStyle(profile.roadStyle);
  const ribbon = (key, spans, color, solid = false) => {
    const cache = `bridge-road:${key}`;
    if (!d.geometries[cache]) {
      const positions = [],
        indices = [];
      for (const [from, to, left, right] of spans) {
        const steps = Math.ceil((to - from) / 0.25);
        const base = positions.length / 3;
        for (let n = 0; n <= steps; n++) {
          const x = from + ((to - from) * n) / steps;
          const y = bridgeDeckHeight(BRIDGE.centerX + x) + (solid ? 0.01 : 0.018);
          positions.push(x, y, left, x, y, right);
          if (solid) positions.push(x, y - 0.18, left, x, y - 0.18, right);
          if (!n) continue;
          const stride = solid ? 4 : 2,
            a = base + (n - 1) * stride,
            b = a + stride;
          indices.push(a, a + 1, b, a + 1, b + 1, b);
          if (solid)
            indices.push(
              a + 2,
              b + 2,
              a + 3,
              a + 3,
              b + 2,
              b + 3,
              a,
              b,
              a + 2,
              a + 2,
              b,
              b + 2,
              a + 1,
              a + 3,
              b + 1,
              a + 3,
              b + 3,
              b + 1,
            );
        }
        if (solid) {
          const end = base + steps * 4;
          indices.push(
            base,
            base + 2,
            base + 1,
            base + 1,
            base + 2,
            base + 3,
            end,
            end + 1,
            end + 2,
            end + 1,
            end + 3,
            end + 2,
          );
        }
      }
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
      geometry.setAttribute(
        'uv',
        new Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2),
      );
      geometry.setIndex(indices);
      geometry.computeVertexNormals();
      d.geometries[cache] = geometry;
    }
    d.mesh(parent, cache, [1, 1, 1], [0, 0, 0], color).name = `Bridge ${key}`;
  };
  ribbon(
    'road deck',
    [[-7, 7, -BRIDGE.halfWidth, BRIDGE.halfWidth]],
    profile.roadColor ?? style.color,
    true,
  );
  ribbon(
    'road edges',
    [
      [-7, 7, -1.06, -1],
      [-7, 7, 1, 1.06],
    ],
    style.edge ?? '#ddd2b7',
  );
  const lines = [];
  for (let x = -6.5; x < 6.5; x += 1.5)
    for (const z of style.line === 'double' ? [-0.07, 0.07] : [0])
      lines.push([
        x,
        Math.min(6.5, x + (style.line === 'double' ? 1.5 : 0.75)),
        z - 0.02,
        z + 0.02,
      ]);
  ribbon(
    `road ${style.line === 'double' ? 'double' : 'dashed'} line`,
    lines,
    style.paint ?? '#eee6d0',
  );
}

export function renderBridge(d, parent, level, era = d.town?.buildingEras?.bridge ?? d.town?.era) {
  if (!level) {
    for (const x of [-6, 6]) d.box(parent, 0.22, 1, 0.22, x, 0.5, 0, '#b1976c');
    return;
  }
  const profile = eraEvolution(era);
  if (profile.roadBridge) roadDeck(d, parent, profile);
  const center = BRIDGE.centerX;
  for (let i = 0; i < 56; i++) {
    const x = -7 + i * 0.25,
      height = bridgeDeckHeight(center + x);
    if (!profile.roadBridge)
      d.box(parent, 0.26, 0.18, BRIDGE.halfWidth * 2, x, height - 0.08, 0, '#a48e69');
    for (const z of [-1.12, 1.12]) {
      d.rod(
        parent,
        [x, height + 0.75, z],
        [x + 0.25, bridgeDeckHeight(center + x + 0.25) + 0.75, z],
        0.055,
        '#646e66',
      );
      if (i % 4 === 0) d.rod(parent, [x, height, z], [x, height + 0.75, z], 0.045, '#677269');
    }
  }
  if (level >= 2)
    for (const x of [-4.4, 4.4]) {
      const capTop =
        Math.min(bridgeDeckHeight(center + x - 0.45), bridgeDeckHeight(center + x + 0.45)) - 0.19;
      const bottom = -0.6,
        top = capTop - 0.2;
      d.box(parent, 0.75, top - bottom, 2.3, x, (top + bottom) / 2, 0, '#b7ae98');
      d.box(parent, 0.9, 0.2, 2.5, x, capTop - 0.1, 0, '#d9ccad');
    }
  if (level >= 3)
    for (const x of [-3.5, 3.5])
      for (const z of [-1.1, 1.1]) {
        d.rod(parent, [x, 2.65, z], [x, 4.15, z], 0.055, '#526e70');
        d.box(parent, 0.25, 0.4, 0.25, x, 4.35, z, '#f5dc9c');
        d.mesh(parent, 'cone', [0.22, 0.25, 0.22], [x, 4.65, z], '#526e70');
      }
  // Side piers leave the central navigation channel open for boats.
  for (const x of [-4.4, 4.4])
    for (const z of [-1.12, 1.12]) d.box(parent, 0.5, 2.5, 0.5, x, 0.65, z, '#8c9183');
}
export function addStationDetails(d, parent) {
  d.box(parent, 6, 0.22, 1.8, 0, 0.17, -2.4, '#b5a27e');
  d.box(parent, 5.8, 0.15, 1.6, 0, 2.3, -2.3, '#728a82');
  for (const x of [-2.6, 2.6]) d.rod(parent, [x, 0.2, -2.4], [x, 2.3, -2.4], 0.065, '#a58d61');
  d.ball(parent, 0, 2.5, 1.5, [0.22, 0.22, 0.06], '#efe1b6');
}

import { townTracks, segmentDistance } from './TownLayout';
import { roadAppearance } from './TownEvolution';
import { BRIDGE } from './TownRiver';

const BRIDGE_FLARE = 0.55;
export const roadHalfWidth = (track, paved) =>
  track.approach === 'bridge' ? BRIDGE.halfWidth + BRIDGE_FLARE : track.width * (paved ? 0.7 : 0.5);

// A flat, full-width landing with rounded corners into the bank street. These
// shared polygons are visual only; the prepared road graph and heights stay put.
export function bridgeApproachSurfaces(town, tracks = townTracks(town)) {
  const approach = tracks.find((track) => track.approach === 'bridge');
  if (!approach) return [];
  const street = tracks.find(
    ({ from, to }) =>
      from[0] === approach.to[0] &&
      to[0] === approach.to[0] &&
      from[1] < BRIDGE.z &&
      to[1] > BRIDGE.z,
  );
  if (!street) return [];
  const style = roadAppearance(town);
  const start = approach.from[0] - 0.12;
  const end = approach.to[0] - roadHalfWidth(street, style.paved);
  const length = end - start;
  const sides = [-1, 1].map((side) => {
    const outer = [],
      trim = [],
      inner = [];
    for (let n = 0; n <= 8; n++) {
      const t = n / 8,
        angle = (t * Math.PI) / 2;
      const x = start + length * Math.sin(angle);
      const z = BRIDGE.halfWidth + BRIDGE_FLARE * (1 - Math.cos(angle));
      const dx = length * Math.cos(angle),
        dz = BRIDGE_FLARE * Math.sin(angle);
      const normalLength = Math.hypot(dx, dz);
      const inset = (amount) => [
        x + (dz / normalLength) * amount,
        BRIDGE.z + side * (z - (dx / normalLength) * amount),
      ];
      outer.push(inset(0));
      // Match the bridge's thin edge at one end and the street's 13 cm edging
      // at the other. Nothing raised is added across the pedestrian walkway.
      trim.push(inset(0.09 * (1 - t)));
      inner.push(inset(0.15 * (1 - t) + 0.13 * t));
    }
    // Reach the next street-edge segment so its regular tiling cannot leave a
    // visible break immediately after the rounded corner.
    const join = BRIDGE.z + side * (BRIDGE.halfWidth + BRIDGE_FLARE + 0.9);
    trim.push([end, join]);
    inner.push([end + 0.13, join]);
    return { outer, trim, inner };
  });
  const surfaces = [
    {
      kind: 'bridge-approach',
      color: style.color,
      points: [
        ...sides[0].outer,
        ...sides.map(({ outer }) => [end + 0.14, outer.at(-1)[1]]),
        ...sides[1].outer.toReversed(),
      ],
    },
  ];
  if (style.edge)
    for (const { trim, inner } of sides)
      surfaces.push({
        kind: 'bridge-approach-edge',
        color: style.edge,
        points: [...trim, ...inner.toReversed()],
      });
  return surfaces;
}

export function roadDetailCorners({ from, to, width }) {
  const dx = to[0] - from[0],
    dz = to[1] - from[1],
    length = Math.hypot(dx, dz);
  if (!length) return [];
  const x = ((-dz / length) * width) / 2,
    z = ((dx / length) * width) / 2;
  return [
    [from, -1],
    [to, -1],
    [to, 1],
    [from, 1],
  ].map(([p, side]) => [p[0] + x * side, p[1] + z * side]);
}

// Flat strips shared by the WebGL scenery and the SVG map. Prepared only when
// the street layout/era changes; these never become navigation obstacles.
export function roadDetails(town, tracks = townTracks(town)) {
  const style = roadAppearance(town),
    details = [];
  const streets = tracks
    .filter((track) => !track.crossing)
    .map((track) => {
      const dx = track.to[0] - track.from[0],
        dz = track.to[1] - track.from[1];
      const length = Math.hypot(dx, dz);
      return {
        ...track,
        length,
        dx: dx / length,
        dz: dz / length,
        half: roadHalfWidth(track, style.paved),
      };
    })
    .filter(({ length }) => length > 0);
  for (const [index, road] of streets.entries()) {
    const { from, dx, dz, length, half } = road;
    const point = (along, across = 0) => [
      from[0] + dx * along - dz * across,
      from[1] + dz * along + dx * across,
    ];
    const junctions = [];
    const overlaps = streets
      .slice(0, index)
      .filter((other) => Math.abs(dx * other.dz - dz * other.dx) < 0.01);
    for (const other of streets) {
      const cross = dx * other.dz - dz * other.dx;
      if (Math.abs(cross) < 0.01) continue;
      const x = other.from[0] - from[0],
        z = other.from[1] - from[1];
      const along = (x * other.dz - z * other.dx) / cross;
      const across = (x * dz - z * dx) / cross;
      if (along >= 0 && along <= length && across >= -0.01 && across <= other.length + 0.01)
        junctions.push({ at: along, half: other.half, main: !other.plot });
    }
    const clear = (along, span, margin = 0.06) => {
      if (along - span / 2 < 0.03 || along + span / 2 > length - 0.03) return false;
      if (junctions.some(({ at, half }) => Math.abs(along - at) < half + span / 2 + margin))
        return false;
      const p = point(along);
      // Collinear service branches can overlap. Give their shared surface one owner.
      return !overlaps.some(
        (other) => segmentDistance(...p, other.from, other.to) < other.half * 0.5,
      );
    };
    const strip = (along, across, span, width, color, kind, sideways = false) => {
      const a = sideways ? point(along, across - span / 2) : point(along - span / 2, across);
      const b = sideways ? point(along, across + span / 2) : point(along + span / 2, across);
      details.push({ from: a, to: b, width, color, kind });
    };
    // Small service paths remain unmarked. Long streets receive the era's finish.
    if (length < 3) continue;
    for (let s = 0.45; s < length; s += 0.9) {
      if (!clear(s, 0.86)) continue;
      if (style.edge)
        for (const side of [-1, 1]) strip(s, side * (half - 0.065), 0.9, 0.13, style.edge, 'edge');
      if (style.pattern === 'ruts')
        for (const side of [-1, 1]) strip(s, side * half * 0.48, 0.8, 0.09, style.detail, 'ruts');
      if (style.pattern === 'gravel')
        for (let n = 0; n < 2; n++) {
          const offset = Math.sin(s * 3.7 + n * 2 + index) * (half - 0.16);
          strip(s + n * 0.2 - 0.1, offset, 0.09, 0.065, style.detail, 'gravel');
        }
      if (style.edgeLine)
        for (const side of [-1, 1])
          strip(s, side * (half - 0.2), 0.9, 0.035, '#e5e0cb', 'edge-line');
    }
    if (style.pattern === 'brick') {
      const rows = 3,
        width = (half * 2 - 0.3) / rows;
      for (let row = 0; row < rows; row++)
        for (let s = 0.35 + (row % 2) * 0.25; s < length; s += 0.5) {
          if (!clear(s, 0.45)) continue;
          strip(s, (row - 1) * width, 0.45, width - 0.035, style.detail, 'brick');
        }
    }
    if (style.pattern === 'slabs')
      for (let s = 1; s < length; s += 2)
        if (clear(s, 0.04)) strip(s, 0, half * 2 - 0.28, 0.035, style.detail, 'joint', true);
    if (style.line && road.width >= 0.85)
      for (let s = 1; s < length; s += style.line === 'double' ? 0.9 : 2.4) {
        const span = style.line === 'double' ? 0.9 : 0.95;
        if (!clear(s, span, style.crossing ? 1.25 : 0.12)) continue;
        for (const offset of style.line === 'double' ? [-0.07, 0.07] : [0])
          strip(s, offset, span, 0.04, style.paint, 'center-line');
      }
    if (style.crossing && road.width >= 1 && !road.plot) {
      const seen = new Set();
      for (const { at, half: gap, main } of junctions) {
        if (!main || seen.has(at)) continue;
        seen.add(at);
        for (const side of [-1, 1]) {
          const center = at + side * (gap + 0.65);
          if (!clear(center, 0.8)) continue;
          if (style.crossingColor)
            strip(center, 0, 0.9, half * 2 - 0.27, style.crossingColor, 'crossing-bed');
          // Four stripes and three gaps span the street; each stripe follows traffic.
          const stripeWidth = (half * 2 - 0.36) / 7;
          for (let n = 0; n < 4; n++)
            strip(center, (n - 1.5) * stripeWidth * 2, 0.78, stripeWidth, '#f0e9d3', 'crossing');
        }
      }
    }
  }
  return details;
}

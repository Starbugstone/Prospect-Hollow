import { cityAppearance } from '../../../data/cityAppearance';
import { COZY_LANDMARKS, cozyAppearance, cozyForm } from '../../../data/cozyArchitecture';
import { addSquareModernization, buildTownSquare } from '../TownSquare';
import { addFishingDock } from './river';
import { leisureModel } from '../LeisureAssets';
import { BRIDGE, bridgeDeckHeight } from '../TownRiver';
import { parkedVehicle } from '../TownVehicles';
import { BufferGeometry, Float32BufferAttribute } from 'three';

// Every part uses the diorama's cached primitives. Geometry is built once per
// plot purchase and merged by material; no animations, particles or light pools.
const TAU = Math.PI * 2;
const drum = (d, g, r, h, x, y, z, color, rz = r) =>
  d.mesh(g, 'cylinder', [r, h, rz], [x, y + h / 2, z], color);
const disc = (d, g, r, y, x, z, color, rz = r, h = 0.1) =>
  d.mesh(g, 'cylinder', [r, h, rz], [x, y, z], color);
const pod = (d, g, x, y, z, size, color, shape = 'sphere') =>
  d.ball(g, x, y, z, size, color, shape);

function cachedSurface(d, key, points, faces) {
  if (!d.geometries[key]) {
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute(
      'uv',
      new Float32BufferAttribute(
        points.flatMap(([x, , z]) => [x, z]),
        2,
      ),
    );
    geometry.setIndex(faces.flat());
    geometry.computeVertexNormals();
    d.geometries[key] = geometry;
  }
  return key;
}
function leafSurface(d) {
  if (d.geometries['cozy-leaf']) return 'cozy-leaf';
  const outline = [
    [0, -1],
    [-0.45, -0.68],
    [-0.6, -0.15],
    [-0.5, 0.4],
    [0, 1],
    [0.5, 0.4],
    [0.6, -0.15],
    [0.45, -0.68],
  ];
  const points = [
    [0, 0.2, -0.1],
    [0, -0.06, 0],
    ...outline.map(([x, z]) => [x, 0, z]),
    ...outline.map(([x, z]) => [x, -0.05, z]),
  ];
  const faces = [];
  for (let n = 0; n < 8; n++) {
    const next = (n + 1) % 8;
    faces.push(
      [0, 2 + n, 2 + next],
      [1, 10 + next, 10 + n],
      [2 + n, 10 + n, 2 + next],
      [2 + next, 10 + n, 10 + next],
    );
  }
  return cachedSurface(d, 'cozy-leaf', points, faces);
}
function seedPanel(d) {
  if (d.geometries['cozy-seed-panel']) return 'cozy-seed-panel';
  const rings = [
    [1, 0],
    [0.92, 0.5],
    [0.48, 0.86],
    [0.12, 1],
  ];
  const points = rings.flatMap(([r, y]) =>
    [-Math.PI / 8, Math.PI / 8].map((a) => [Math.sin(a) * r, y, Math.cos(a) * r]),
  );
  const faces = [];
  for (let n = 0; n < rings.length - 1; n++)
    faces.push([n * 2, n * 2 + 1, n * 2 + 2], [n * 2 + 1, n * 2 + 3, n * 2 + 2]);
  return cachedSurface(d, 'cozy-seed-panel', points, faces);
}
function seedRoof(d, g, s, x, y, z, r, h) {
  const p = s.palette;
  for (let n = 0; n < 8; n++) {
    const panel = d.mesh(
      g,
      seedPanel(d),
      [r, h, r],
      [x, y, z],
      n % 3 ? p.roof : s.style === 'canopy' ? p.green : p.glass,
    );
    panel.rotation.y = (n * TAU) / 8;
    const a = ((n + 0.5) * TAU) / 8;
    d.rod(
      g,
      [x + Math.sin(a) * r, y, z + Math.cos(a) * r],
      [x + Math.sin(a) * r * 0.48, y + h * 0.86, z + Math.cos(a) * r * 0.48],
      0.027,
      p.timber,
    );
  }
  disc(d, g, r * 0.2, y + h, x, z, p.shell, r * 0.2, 0.1);
  d.rod(g, [x, y + h, z], [x, y + h + 0.3, z], 0.04, p.timber);
}

/** Overlapping low-poly leaves in Canopy; pearl-edged glass petals in Riverlight. */
export function addCozyRoof(d, g, x, y, z, radius, era, depth = radius, petals = 6) {
  const { style, palette: p } = cozyAppearance(era);
  if (style === 'riverlight') disc(d, g, radius, y - 0.025, x, z, p.shell, depth, 0.14);
  for (let n = 0; n < petals; n++) {
    const a = (n / petals) * TAU;
    const leaf = d.mesh(
      g,
      leafSurface(d),
      [radius * 0.72, radius * 0.3, depth * 0.7],
      [x + Math.sin(a) * radius * 0.4, y + 0.13, z + Math.cos(a) * depth * 0.4],
      n % 3 === 0 ? (style === 'canopy' ? p.green : p.glass) : p.roof,
    );
    leaf.rotation.y = a;
    // A gentle pitch forms a layered crown instead of a flat round lid.
    leaf.rotation.x = -0.15;
  }
  disc(d, g, radius * 0.24, y + radius * 0.25, x, z, p.shell, depth * 0.24, 0.1);
}

function doorway(d, g, x, z, p, width = 0.55, height = 1.15) {
  d.box(g, width + 0.16, height + 0.14, 0.12, x, height / 2 + 0.08, z, p.timber);
  d.box(g, width, height, 0.14, x, height / 2 + 0.08, z + 0.025, p.deep);
  pod(d, g, x + width * 0.28, 0.65, z + 0.11, 0.035, p.light);
}
function planter(d, g, x, z, p, r = 0.28, y = 0) {
  disc(d, g, r + 0.06, y + 0.12, x, z, p.shell, r + 0.06, 0.22);
  pod(d, g, x, y + 0.35, z, [r, r * 0.86, r], p.green);
  pod(d, g, x - r * 0.45, y + 0.53, z + r * 0.25, r * 0.33, p.flower);
}
function lantern(d, g, x, z, p, y = 0, height = 1.25) {
  d.rod(g, [x, y + 0.08, z], [x, y + height, z], 0.04, p.deep);
  pod(d, g, x, y + height, z, [0.13, 0.16, 0.13], p.light);
  disc(d, g, 0.15, y + height + 0.14, x, z, p.timber, 0.15, 0.06);
}
function pergola(d, g, x, y, z, width, depth, p) {
  for (const side of [-1, 1])
    for (const end of [-1, 1])
      d.rod(
        g,
        [x + (side * width) / 2, y, z + (end * depth) / 2],
        [x + (side * width) / 2, y + 1.5, z + (end * depth) / 2],
        0.055,
        p.timber,
      );
  for (let n = 0; n < 5; n++)
    d.box(g, 0.09, 0.09, depth + 0.18, x - width / 2 + (n * width) / 4, y + 1.5, z, p.timber);
  for (const end of [-1, 1])
    d.box(g, width + 0.15, 0.1, 0.1, x, y + 1.45, z + (end * depth) / 2, p.timber);
  pod(d, g, x - width * 0.32, y + 1.57, z - depth * 0.3, [0.34, 0.13, 0.35], p.green);
}
function cottage(d, g, s, x, z, r = 1, h = 1.8) {
  const p = s.palette;
  disc(d, g, r + 0.12, 0.12, x, z, p.shell, r + 0.12, 0.22);
  drum(d, g, r, h, x, 0.2, z, p.shell);
  for (const side of [-1, 1])
    d.box(g, 0.28, 0.64, 0.1, x + side * r * 0.63, 1.1, z + r * 0.8, p.light);
  doorway(d, g, x, z + r + 0.03, p, Math.min(0.55, r * 0.7));
  addCozyRoof(d, g, x, h + 0.2, z, r * 1.25, s.era);
  return { top: h + 0.55, radius: r, x, z };
}
function greenhouse(d, g, s, x, z, r, floor = 0) {
  const p = s.palette;
  disc(d, g, r + 0.1, floor + 0.15, x, z, p.shell, r + 0.1, 0.24);
  pod(d, g, x, floor + 0.3, z, [r, r * 0.88, r], p.glass);
  // Polygonal timber arches frame opaque glass, keeping sorting and shadows cheap.
  for (const angle of [0, Math.PI / 2]) {
    const arc = [];
    for (let n = 0; n <= 6; n++) {
      const a = (n * Math.PI) / 6;
      arc.push([
        x + Math.cos(a) * r * Math.cos(angle),
        floor + 0.3 + Math.sin(a) * r * 0.88,
        z + Math.cos(a) * r * Math.sin(angle),
      ]);
    }
    for (let n = 1; n < arc.length; n++) d.rod(g, arc[n - 1], arc[n], 0.035, p.timber);
  }
}
function crystal(d, g, x, y, z, r, p) {
  pod(d, g, x, y + r * 1.3, z, [r * 0.62, r * 1.3, r * 0.62], p.light, 'rock');
}

const FORMS = {
  homes(d, g, s) {
    const p = s.palette;
    if (['porch', 'row', 'court'].includes(s.identity)) {
      if (s.identity === 'porch') return cottage(d, g, s, 0, -0.25, 1.12, 2.3);
      for (const x of [-1.55, 0, 1.55]) cottage(d, g, s, x, x ? -0.35 : -0.7, 0.68, x ? 1.4 : 1.7);
      return { top: 2.2, radius: 0.7, x: 0, z: -0.7 };
    }
    if (s.identity === 'pods') {
      drum(d, g, 0.42, s.height, 0, 0.1, -0.4, p.shell);
      for (let n = 0; n < 5; n++) {
        const x = (n % 2 ? -1 : 1) * 0.9,
          y = 1 + n * 1.05;
        pod(d, g, x, y, -0.4, [0.8, 0.52, 0.82], p.shell);
        disc(d, g, 0.9, y - 0.3, x, -0.4, p.green, 0.88, 0.1);
        d.box(g, 0.54, 0.37, 0.1, x, y, 0.4, p.light);
      }
      addCozyRoof(d, g, 0, s.height + 0.15, -0.4, 1.15, s.era);
      doorway(d, g, 0, 0.12, p);
      return { top: s.height + 0.5, radius: 0.75, z: -0.4 };
    }
    const towers =
      s.identity === 'twin'
        ? [
            [-1, 0.85, s.height],
            [1, 0.85, s.height - 1.2],
          ]
        : [[0, 1.25, s.height]];
    for (const [x, r, h] of towers) {
      drum(d, g, r, h, x, 0.15, -0.35, p.shell);
      for (let y = 1; y < h; y += 1.2) {
        disc(d, g, r + 0.12, y, x, -0.35, p.deep, r + 0.12, 0.1);
        disc(d, g, r + 0.14, y + 0.13, x, -0.35, p.green, r + 0.14, 0.12);
        for (const side of [-1, 1])
          d.box(g, 0.3, 0.63, 0.1, x + side * r * 0.52, y + 0.65, -0.35 + r * 0.9, p.light);
      }
      addCozyRoof(d, g, x, h + 0.15, -0.35, r + 0.28, s.era);
      doorway(d, g, x, r - 0.3, p);
    }
    return { top: s.height + 0.5, radius: towers[0][1], x: towers[0][0], z: -0.35 };
  },
  hall(d, g, s) {
    const p = s.palette,
      r = Math.min(1.4, s.width * 0.34),
      h = Math.max(1.7, s.height * 0.72);
    const crown = cottage(d, g, s, 0, -0.25, r, h);
    if (s.identity === 'columns')
      for (const x of [-1.1, 1.1]) drum(d, g, 0.09, 1.5, x, 0.1, 1.15, p.timber);
    if (['clock', 'bell', 'patrol', 'post'].includes(s.identity)) {
      drum(d, g, 0.3, 0.65, 0, crown.top - 0.1, -0.25, p.shell);
      addCozyRoof(d, g, 0, crown.top + 0.55, -0.25, 0.45, s.era);
      d.box(g, 0.32, 0.3, 0.07, 0, crown.top + 0.19, 0.07, p.light, true);
    }
    if (s.identity === 'clinic') {
      d.box(g, 0.45, 0.13, 0.09, 0, 1.8, r - 0.15, p.deep);
      d.box(g, 0.13, 0.45, 0.09, 0, 1.8, r - 0.15, p.deep);
    }
    return crown;
  },
  arcade(d, g, s) {
    const p = s.palette,
      r = Math.min(1.45, s.width * 0.4),
      h = s.kind === 'saloon' ? 1.75 : 1.35;
    drum(d, g, r, h, 0, 0.15, -0.35, p.shell, 1.05);
    drum(d, g, r * 0.91, h * 0.64, 0, 0.3, -0.35, p.glass, 1.08);
    for (const x of [-r * 0.82, r * 0.82])
      d.rod(g, [x, 0.1, 1.3], [x, h + 0.15, 1.3], 0.06, p.timber);
    addCozyRoof(d, g, 0, h + 0.2, -0.15, r + 0.35, s.era, 1.55);
    doorway(d, g, 0, 0.82, p);
    if (s.kind === 'saloon') {
      const medallion = disc(d, g, 0.32, h + 0.6, 0, 1.07, p.light, 0.32, 0.1);
      medallion.rotation.x = Math.PI / 2;
      medallion.name = 'Golden Hour saloon medallion';
    }
    return { top: h + 0.65, radius: r, z: -0.35 };
  },
  workshop(d, g, s) {
    const p = s.palette,
      w = Math.min(3.7, s.width),
      h = Math.min(2.4, s.height * 0.78);
    d.box(g, w, h, 2.4, 0, h / 2 + 0.12, -0.35, s.identity === 'fire' ? p.flower : p.shell, true);
    d.box(g, w * 0.58, h * 0.68, 0.12, 0, h * 0.36 + 0.1, 0.88, p.deep, true);
    addCozyRoof(d, g, 0, h + 0.15, -0.35, w * 0.56, s.era, 1.45);
    if (['forge', 'mill', 'warehouse'].includes(s.identity)) {
      drum(d, g, 0.22, h + 1.05, -w * 0.3, 0.1, -0.8, p.shell);
      disc(d, g, 0.27, h + 1.2, -w * 0.3, -0.8, p.deep, 0.27, 0.13);
    }
    return { top: h + 0.5, radius: w * 0.4, z: -0.35 };
  },
  watergarden(d, g, s) {
    const p = s.palette;
    if (s.identity === 'well') {
      drum(d, g, 0.72, 0.64, 0, 0.05, -0.1, p.shell);
      disc(d, g, 0.58, 0.72, 0, -0.1, p.glass, 0.58, 0.04);
      for (const x of [-0.65, 0.65]) d.rod(g, [x, 0.1, -0.1], [x, 1.8, -0.1], 0.055, p.timber);
      addCozyRoof(d, g, 0, 1.85, -0.1, 1, s.era);
      return { top: 2.1, radius: 0.6, z: -0.1 };
    }
    for (const [x, r] of [
      [-0.8, 0.82],
      [0.95, 0.66],
    ]) {
      drum(d, g, r, 1.5, x, 0.1, -0.3, p.shell);
      disc(d, g, r + 0.03, 0.95, x, -0.3, p.glass, r + 0.03, 0.38);
      addCozyRoof(d, g, x, 1.65, -0.3, r + 0.2, s.era);
    }
    if (s.identity === 'power') crystal(d, g, -0.8, 1.9, -0.3, 0.3, p);
    return { top: 2.25, radius: 0.8, x: -0.8, z: -0.3 };
  },
  concourse(d, g, s) {
    const p = s.palette,
      crown = cottage(d, g, s, 0, -0.5, 1.05, 1.6);
    for (const x of [-1.7, 1.7]) d.rod(g, [x, 0.1, -0.8], [x, 1.8, -0.8], 0.06, p.timber);
    addCozyRoof(d, g, 0, 1.85, -0.7, 2.1, s.era, 0.65);
    return crown;
  },
  gallery(d, g, s) {
    const crown = cottage(d, g, s, -0.45, -0.5, 1.1, 2.2);
    greenhouse(d, g, s, 1.15, -0.3, 0.9);
    if (s.identity === 'museum') crystal(d, g, 1.15, 0.25, -0.3, 0.26, s.palette);
    return crown;
  },
  atrium(d, g, s) {
    const crown = cottage(d, g, s, 0, -0.6, 1.1, 2.4);
    greenhouse(d, g, s, -1.3, -0.7, 0.7);
    greenhouse(d, g, s, 1.3, -0.7, 0.7);
    return crown;
  },
  greenhouse(d, g, s) {
    const big = s.kind === 'biodome';
    greenhouse(d, g, s, -0.6, -0.45, big ? 1.55 : 1.15);
    greenhouse(d, g, s, 1.2, -0.25, big ? 0.88 : 0.65);
    addCozyRoof(d, g, -0.6, big ? 1.55 : 1.2, -0.45, big ? 0.8 : 0.6, s.era);
    return { top: big ? 1.85 : 1.5, radius: big ? 1.3 : 1, x: -0.6, z: -0.45 };
  },
  landing(d, g, s) {
    const p = s.palette;
    drum(d, g, 0.7, 1.1, 0, 0.12, -0.25, p.glass);
    for (const x of [-1.05, 1.05]) d.rod(g, [x, 0.1, 0.7], [x, 1.7, 0.7], 0.055, p.timber);
    addCozyRoof(d, g, 0, 1.75, -0.2, 1.55, s.era, 1.1);
    return { top: 2.1, radius: 0.7, z: -0.25 };
  },
  garden(d, g, s) {
    leisureModel(
      d,
      g,
      `${s.kind === 'horseField' ? 'field' : 'park'}${Math.min(3, s.serviceLevel)}`,
    );
    addCozyRoof(d, g, -1.5, 2.1, -1.65, 0.9, s.era);
    d.rod(g, [-1.5, 0.1, -1.65], [-1.5, 2.1, -1.65], 0.075, s.palette.timber);
    return null;
  },
  mast(d, g, s) {
    const crown = cottage(d, g, s, 0, -0.4, 1.1, 1.6);
    d.rod(g, [0, 1.7, -0.4], [0, 8.2, -0.4], 0.07, s.palette.deep);
    for (const y of [4.6, 6, 7.4]) disc(d, g, 0.38, y, 0, -0.4, s.palette.roof, 0.38, 0.08);
    return crown;
  },
  auditorium(d, g, s) {
    const p = s.palette;
    drum(d, g, 2, 1.4, 0, 0.1, -0.6, p.shell, 1.4);
    drum(d, g, 1.9, 0.9, 0, 0.25, -0.6, p.glass, 1.4);
    addCozyRoof(d, g, 0, 1.6, -0.6, 2.3, s.era, 1.6, 7);
    doorway(d, g, 0, 0.85, p, 0.8);
    return { top: 2.1, radius: 1.5, z: -0.6 };
  },
  studio(d, g, s) {
    const crown = cottage(d, g, s, 0, -0.4, 1.35, 1.8),
      p = s.palette;
    drum(d, g, 0.23, 3.4, 0, 2.05, -0.4, p.shell);
    pod(d, g, 0, 5.6, -0.4, [0.85, 0.8, 0.85], p.glass);
    addCozyRoof(d, g, 0, 6.1, -0.4, 1.05, s.era);
    return crown;
  },
  skyterraces(d, g, s) {
    const p = s.palette;
    let y = 0.2;
    for (const [r, h] of [
      [1.45, 3.8],
      [1.15, 3.1],
      [0.8, 2.6],
    ]) {
      drum(d, g, r, h, 0, y, -0.4, p.glass);
      for (let f = 1; f < h; f += 1.15)
        disc(d, g, r + 0.12, y + f, 0, -0.4, p.shell, r + 0.12, 0.1);
      disc(d, g, r + 0.23, y + h, 0, -0.4, p.green, r + 0.23, 0.2);
      y += h;
    }
    addCozyRoof(d, g, 0, y + 0.15, -0.4, 1, s.era);
    doorway(d, g, 0, 1.1, p, 0.8);
    return { top: y + 0.4, radius: 0.8, z: -0.4 };
  },
  square(d, g, s) {
    const p = s.palette;
    buildTownSquare(d, g, s.serviceLevel, false, s.era);
    addSquareModernization(d, g, s.level, p.deep);
    if (s.level >= 2) pergola(d, g, -1.9, 0, -1.5, 1.15, 0.75, p);
    if (s.level >= 3) pergola(d, g, 1.9, 0, -1.5, 1.15, 0.75, p);
    return null;
  },
  teahouse(d, g, s) {
    const p = s.palette;
    disc(d, g, 2.5, 0.15, 0, -0.3, p.shell, 2.15, 0.28);
    drum(d, g, 1.3, 1.5, 0, 0.25, -0.6, p.glass);
    for (const x of [-1.9, 1.9])
      for (const z of [-1.4, 1.05]) d.rod(g, [x, 0.25, z], [x, 2.1, z], 0.07, p.timber);
    addCozyRoof(d, g, 0, 2.1, -0.3, 2.5, s.era, 2.15, 7);
    for (const x of [-1.65, 1.65]) {
      disc(d, g, 0.34, 0.75, x, 0.9, p.timber);
      d.rod(g, [x, 0.2, 0.9], [x, 0.75, 0.9], 0.05, p.timber);
    }
    if (s.level >= 2) greenhouse(d, g, s, -1.7, -1.2, 0.9);
    if (s.level >= 3) {
      pergola(d, g, 1.8, 0.2, -1.4, 1.1, 1.1, p);
      for (const x of [-2.1, 2.1]) planter(d, g, x, 1.6, p, 0.4);
    }
    return { landmark: true };
  },
  atelier(d, g, s) {
    const p = s.palette;
    drum(d, g, 1.35, 1.45, 0, 0.2, -0.7, p.shell);
    doorway(d, g, 0, 0.69, p, 0.7, 1.3);
    seedRoof(d, g, s, 0, 1.65, -0.7, 1.5, 1.95);
    greenhouse(d, g, s, -2.05, -0.8, 1.55);
    drum(d, g, 0.35, 0.65, -2.8, 0.05, 1.15, p.glass);
    disc(d, g, 0.4, 0.7, -2.8, 1.15, p.shell);
    if (s.level >= 2) greenhouse(d, g, s, 2.05, -0.8, 1.55);
    if (s.level >= 3) {
      greenhouse(d, g, s, 1.65, 1.3, 0.9);
      for (const x of [-2.5, -1.5, 1.5, 2.5]) planter(d, g, x, 1.8, p, 0.33);
      pergola(d, g, 0, 0, 1.8, 1.4, 0.8, p);
      disc(d, g, 1.65, 1.25, 0, -0.7, p.shell, 1.65, 0.18);
      for (const x of [-1.3, 1.3]) {
        planter(d, g, x, 0.3, p, 0.26, 1.3);
        d.rod(g, [x, 1.35, -1.9], [x, 1.65, -0.6], 0.035, p.timber);
      }
    }
    return { landmark: true };
  },
  orchard(d, g, s) {
    const p = s.palette;
    cottage(d, g, s, 0, -1.65, 1, 2.15);
    cottage(d, g, s, -2.1, 0, 0.95, 1.65);
    if (s.level >= 2) cottage(d, g, s, 2.1, 0, 0.95, 1.65);
    if (s.level >= 3) {
      pergola(d, g, -1.1, 0.1, -0.85, 1.1, 1, p);
      pergola(d, g, 1.1, 0.1, -0.85, 1.1, 1, p);
      d.rod(g, [0, 0.1, 0.85], [0, 1.5, 0.85], 0.12, p.timber);
      pod(d, g, 0, 1.75, 0.85, [0.75, 0.72, 0.75], p.green);
      for (const x of [-0.4, 0.4]) pod(d, g, x, 1.9, 1.35, 0.15, p.flower);
    }
    return { landmark: true };
  },
  glassworks(d, g, s) {
    const p = s.palette;
    FORMS.workshop(d, g, { ...s, identity: 'forge', width: 3.8, height: 2.8 });
    for (const x of [-1.9, 1.9]) {
      disc(d, g, 0.42, 0.22, x, 1.15, p.shell, 0.42, 0.4);
      crystal(d, g, x, 0.45, 1.15, 0.4, p);
    }
    if (s.level >= 2) greenhouse(d, g, s, 2.2, -0.7, 1);
    if (s.level >= 3) {
      pergola(d, g, 0, 0.1, 1.35, 2.5, 0.75, p);
      for (const x of [-2.7, 2.8]) planter(d, g, x, 0.8, p, 0.35);
    }
    return { landmark: true };
  },
  springs(d, g, s) {
    const p = s.palette;
    const pool = (x, z, r, y) => {
      drum(d, g, r + 0.14, y + 0.3, x, 0.05, z, p.shell, r * 0.75 + 0.14);
      disc(d, g, r, y + 0.35, x, z, p.glass, r * 0.75, 0.05);
    };
    pool(-0.45, 0.6, 2, 0.9);
    cottage(d, g, s, 2.1, -0.5, 0.95, 2.6);
    if (s.level >= 2) {
      pool(-0.35, -1.3, 1.4, 2.05);
      d.box(g, 0.6, 1.2, 0.13, -0.35, 1.82, -0.13, p.glass, true).name =
        'Warm springs water ribbon';
      pergola(d, g, -2.4, 0.1, -1.4, 1.2, 1.3, p);
      addCozyRoof(d, g, -2.4, 1.65, -1.4, 0.85, s.era, 0.9);
    }
    if (s.level >= 3) {
      pool(-0.35, 2.15, 1.25, 0.15);
      for (const x of [-2.6, 2.4]) planter(d, g, x, 1.6, p, 0.4);
      lantern(d, g, 2.5, 1.25, p, 0, 1.7);
    }
    return { landmark: true };
  },
  pavilion(d, g, s) {
    const p = s.palette,
      r = s.level >= 2 ? 2.8 : 2.4,
      columns = s.level >= 2 ? 10 : 8;
    disc(d, g, r + 0.15, 0.15, 0, -0.1, p.shell, r + 0.15, 0.25);
    for (let n = 0; n < columns; n++) {
      const a = (n * TAU) / columns + TAU / (columns * 2);
      if (Math.cos(a) > 0.84) continue; // wide, legible front entrance
      const x = Math.sin(a) * r * 0.85,
        z = Math.cos(a) * r * 0.85 - 0.1;
      drum(d, g, 0.09, 2.25, x, 0.25, z, p.deep);
      lantern(d, g, x, z, p, 0.4, 1.65);
    }
    addCozyRoof(d, g, 0, 2.6, -0.1, r + 0.28, s.era, r + 0.28, 10);
    crystal(d, g, 0, 3.2, -0.1, 0.46, p);
    disc(d, g, 0.6, 0.42, 0, -0.1, p.deep, 0.6, 0.35);
    crystal(d, g, 0, 0.62, -0.1, 0.25, p);
    if (s.level >= 3)
      for (const side of [-1, 1]) {
        d.box(g, 1.3, 0.18, 0.38, side * 2.15, 0.48, 1.8, p.timber, true);
        planter(d, g, side * 2.9, 1.5, p, 0.38);
      }
    return { landmark: true };
  },
};

export function renderCozyBuilding(d, parent, kind, label, level, era, serviceLevel = 3) {
  const form = cozyForm(kind);
  if (!form) return false;
  const appearance = cozyAppearance(era);
  const s = { ...cityAppearance(era, kind), ...appearance, kind, era, level, serviceLevel };
  if (['fisherman', 'riverPort'].includes(kind))
    addFishingDock(d, parent, serviceLevel, kind === 'riverPort');
  const root = d.group(parent);
  root.name = `${era} cozy ${kind} level ${level}`;
  root.userData.eraLevel = level;
  const landmark = COZY_LANDMARKS[kind];
  if (landmark) root.scale.setScalar(landmark.scale);
  const crown = FORMS[form](d, root, s),
    p = appearance.palette;
  if (!landmark && crown) {
    if (level >= 2) {
      // A rear garden room alters the outline without using the front sidewalk.
      const x = -Math.min(1.75, (s.width ?? 3.4) / 2 - 0.15);
      greenhouse(d, root, s, x, -0.95, 0.65);
    }
    if (level >= 3) {
      disc(
        d,
        root,
        crown.radius + 0.13,
        ['stable', 'garage', 'busDepot'].includes(kind)
          ? Math.max(1.9, crown.top * 0.72)
          : crown.top * 0.56,
        crown.x ?? 0,
        crown.z ?? -0.3,
        p.green,
        crown.radius + 0.13,
        0.1,
      );
      const sides = kind === 'busDepot' ? [-1.85, 1.85] : [-1.4, 1.4];
      for (const x of sides) {
        planter(d, root, x, 1.4, p, 0.23);
        if (s.style === 'riverlight') lantern(d, root, x, 1.35, p, 0, 1.3);
      }
    }
  } else if (form === 'garden') {
    if (level >= 2) pergola(d, root, 1.4, 0, -1.6, 1.2, 0.8, p);
    if (level >= 3) for (const x of [-1.5, 1.5]) planter(d, root, x, 1.55, p, 0.25);
  }
  if (['stable', 'garage', 'busDepot'].includes(kind)) {
    // Park sideways on the private forecourt, in front of the wall and beneath
    // the high roof. Even the bus leaves a clear gap to both garden planters.
    const vehicle = parkedVehicle(d, d.group(root, 0, 0, 1.4), kind, era);
    vehicle.rotation.y = Math.PI / 2;
  }
  if (!['square', 'garden'].includes(form)) {
    d.sign(root, label, landmark ? 2 : 2.4, 0, landmark ? 1.35 : 1.45, landmark ? 2.3 : 1.72);
  }
  return true;
}

/** Rooftop lounge and sheltered frontage retain the airport's runway and exits. */
export function addCozyLounge(d, g, x, floor, z, era) {
  const p = cozyAppearance(era).palette;
  d.box(g, 4.1, 1.25, 2.6, x, floor + 0.65, z, p.glass, true);
  addCozyRoof(d, g, x, floor + 1.35, z, 2.35, era, 1.5);
  for (const side of [-1, 1]) planter(d, g, x + side * 1.75, z + 1, p, 0.25, floor);
}

export function addCozyAirportDetails(d, g, era, level) {
  const p = cozyAppearance(era).palette;
  addCozyRoof(d, g, 4.4, 3.45, -2.7, 2.55, era, 1.65);
  if (level >= 2) addCozyRoof(d, g, -0.3, 2.4, -3.1, 1.35, era, 1);
  if (level >= 3) for (const x of [2.3, 6.7]) planter(d, g, x, -4.5, p, 0.4);
}

/** Approach furniture is beside the bridge; the road and boat channel stay open. */
export function addCozyBridge(d, parent, era, level) {
  const p = cozyAppearance(era).palette,
    root = d.group(parent);
  root.name = `${era} cozy bridge approaches ${level}`;
  for (const x of [-5.8, 5.8]) {
    const y = bridgeDeckHeight(BRIDGE.centerX + x);
    for (const z of [-1.75, 1.75]) {
      lantern(d, root, x, z, p, y, 1.25);
      if (level >= 2) planter(d, root, x + Math.sign(x) * 0.55, z, p, 0.22, y);
    }
    if (level >= 3) {
      // Tall arches rest beyond the rail, clear of all traffic headroom.
      for (const z of [-1.75, 1.75]) d.rod(root, [x, y, z], [x, y + 3.8, z], 0.055, p.timber);
      addCozyRoof(d, root, x, y + 3.9, 0, 0.6, era, 2.05);
    }
  }
}

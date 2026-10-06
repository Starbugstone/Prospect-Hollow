import { cityAppearance } from '../../../data/cityAppearance';
import { CITY_FAMILIES } from '../../../data/city';
import { ROUNDED_PALETTE as P, roundedForm } from '../../../data/roundedArchitecture';
import { addFishingDock } from './river';
import { leisureModel } from '../LeisureAssets';
import { motorVehicle, parkedVehicle } from '../TownVehicles';

// Rounded city architecture: domes, drums, vaults and pods from the shared sphere and
// cylinder primitives. Nothing here allocates geometry; the plot batch merges every
// part by material, so these buildings cost the same draw calls as their neighbors.
const TAU = Math.PI * 2;
const DEPTH = 2.9;
const RIVER_KINDS = new Set(['fisherman', 'riverPort']);
const LANDMARKS = {
  radio: { width: 3.4, height: 9 },
  concert: { width: 5.6, height: 3.6 },
  television: { width: 4.7, height: 8 },
  skyline: { width: 4.3, height: 12 },
};

// A vertical drum standing on `y`.
const drum = (d, g, r, h, x, y, z, color, rz = r) =>
  d.mesh(g, 'cylinder', [r, h, rz], [x, y + h / 2, z], color);
// Sphere-based forms: the lower half of a dome sits inside the drum below it.
const pod = (d, g, rx, ry, rz, x, y, z, color) =>
  d.mesh(g, 'sphere', [rx, ry, rz], [x, y, z], color);
const disc = (d, g, r, y, x, z, color, thickness = 0.09, rz = r) =>
  d.mesh(g, 'cylinder', [r, thickness, rz], [x, y, z], color);
// A cylinder lying along X (a barrel vault) or Z (a hangar).
function barrel(d, g, r, length, x, y, z, color, alongZ = false) {
  const mesh = d.mesh(g, 'cylinder', [r, length, r], [x, y, z], color);
  if (alongZ) mesh.rotation.x = Math.PI / 2;
  else mesh.rotation.z = Math.PI / 2;
  return mesh;
}
const doorway = (d, g, x, z, width = 0.7, height = 1.15) =>
  d.box(g, width, height, 0.14, x, height / 2 + 0.05, z, P.deep, true);
const lamp = (d, g, x, z, height = 1.5) => {
  d.rod(g, [x, 0.05, z], [x, height, z], 0.045, P.accent);
  pod(d, g, 0.15, 0.1, 0.15, x, height + 0.05, z, P.light);
};
const shrub = (d, g, x, z, size = 0.3) => {
  disc(d, g, size + 0.08, 0.14, x, z, P.shell, 0.2);
  pod(d, g, size, size * 0.9, size, x, 0.4, z, P.green);
};

// A glazed tower: balcony rings at each floor and a shallow crown dome.
function tower(d, g, x, z, r, h, rz = r) {
  const floors = Math.max(1, Math.round((h - 0.4) / 1.25));
  const floor = (h - 0.4) / floors;
  disc(d, g, r + 0.18, 0.12, x, z, P.shell, 0.2, rz + 0.18);
  drum(d, g, r * 0.92, h - 0.4, x, 0.2, z, P.glass, rz * 0.92);
  for (let n = 1; n <= floors; n++)
    disc(d, g, r + 0.2, 0.2 + n * floor, x, z, n === floors ? P.accent : P.shell, 0.12, rz + 0.2);
  pod(d, g, r * 0.95, r * 0.42, rz * 0.95, x, h - 0.2, z, P.shell);
  return h - 0.2 + r * 0.42;
}
// A round cottage: drum walls under a generous dome.
function cottage(d, g, x, z, r, wall, color = P.shell) {
  drum(d, g, r, wall, x, 0.05, z, color);
  disc(d, g, r * 0.95, wall * 0.62, x, z, P.glass, wall * 0.34);
  pod(d, g, r * 1.06, r * 0.78, r * 1.06, x, wall + 0.05, z, P.accent);
  return wall + 0.05 + r * 0.78;
}

const FORMS = {
  tower(d, g, s) {
    if (s.identity === 'porch') {
      const top = cottage(d, g, 0, -0.1, 1.2, 1.45);
      disc(d, g, 0.9, 1.5, 0, 1.15, P.shell, 0.1, 0.45);
      doorway(d, g, 0, 1.12);
      return { top, radius: 1.2 };
    }
    if (s.identity === 'row') {
      for (const x of [-1.5, 0, 1.5]) {
        cottage(d, g, x, 0, 0.72, 1.7, x ? P.shell : P.warm);
        doorway(d, g, x, 0.7, 0.45, 0.95);
      }
      return { top: 2.3, radius: 0.9, x: 1.5 };
    }
    if (s.identity === 'court') {
      for (const [x, z, r] of [
        [-1.6, -0.3, 0.8],
        [0, 0.1, 1],
        [1.6, -0.3, 0.8],
      ]) {
        drum(d, g, r, 0.9, x, 0.05, z, P.shell);
        pod(d, g, r, r * 0.9, r, x, 0.95, z, x ? P.green : P.accent);
      }
      doorway(d, g, 0, 1.05, 0.6, 0.9);
      return { top: 1.9, radius: 1 };
    }
    if (s.identity === 'twin') {
      tower(d, g, -1.15, -0.2, 0.95, s.height);
      const top = tower(d, g, 1.15, -0.2, 0.95, s.height - 1.2);
      d.box(g, 1.2, 0.3, 0.9, 0, 2.6, -0.2, P.glass, true);
      doorway(d, g, -1.15, 0.8);
      return { top, radius: 0.95, x: 1.15 };
    }
    if (s.identity === 'pods') {
      // A slender core with homes cantilevered in a slow spiral.
      disc(d, g, 1.5, 0.12, 0, 0, P.shell, 0.2);
      drum(d, g, 0.5, s.height, 0, 0.2, 0, P.shell);
      const pods = Math.round(s.height / 0.95);
      for (let n = 0; n < pods; n++) {
        const a = n * 2.1,
          y = 1 + n * 0.85;
        pod(
          d,
          g,
          0.72,
          0.5,
          0.62,
          Math.cos(a) * 1.05,
          y,
          Math.sin(a) * 0.7,
          n % 3 ? P.shell : P.warm,
        );
        pod(d, g, 0.5, 0.2, 0.44, Math.cos(a) * 1.35, y + 0.05, Math.sin(a) * 0.9, P.glass);
      }
      pod(d, g, 0.75, 0.45, 0.75, 0, s.height + 0.2, 0, P.accent);
      doorway(d, g, 0, 0.62, 0.6, 1);
      return { top: s.height + 0.65, radius: 0.8 };
    }
    // Apartments and hotels: one broad elliptical tower.
    const top = tower(d, g, 0, -0.1, s.width * 0.34, s.height, 1.2);
    doorway(d, g, 0, 1.28);
    return { top, radius: s.width * 0.34 };
  },
  rotunda(d, g, s) {
    const r = Math.min(1.45, s.width * 0.36),
      h = Math.max(1.5, s.height * 0.6);
    disc(d, g, r + 0.35, 0.1, 0, -0.1, P.shell, 0.2);
    drum(d, g, r, h, 0, 0.2, -0.1, P.shell);
    disc(d, g, r + 0.03, 0.2 + h * 0.55, 0, -0.1, P.glass, h * 0.42);
    disc(d, g, r + 0.12, 0.2 + h, 0, -0.1, P.accent, 0.12);
    pod(
      d,
      g,
      r * 0.95,
      r * 0.68,
      r * 0.95,
      0,
      0.2 + h,
      -0.1,
      s.identity === 'columns' ? P.light : P.accent,
    );
    // A rounded porch with a floating canopy.
    d.box(g, 1.3, 1.35, 0.9, 0, 0.72, r - 0.05, P.glass, true);
    disc(d, g, 0.95, 1.5, 0, r, P.shell, 0.12, 0.6);
    let top = 0.2 + h + r * 0.68;
    if (s.identity === 'columns')
      for (let n = 0; n < 8; n++) {
        const a = (n / 8) * TAU + TAU / 16;
        if (Math.sin(a) > 0.55) continue; // keep the porch open
        drum(
          d,
          g,
          0.09,
          h,
          Math.cos(a) * (r + 0.25),
          0.2,
          -0.1 + Math.sin(a) * (r + 0.25),
          P.shell,
        );
      }
    if (['clock', 'bell', 'patrol', 'post'].includes(s.identity)) {
      const lantern = s.identity === 'patrol' ? P.warm : P.light;
      drum(d, g, 0.08, 0.9, 0, top - 0.1, -0.1, P.accent);
      pod(d, g, 0.2, 0.2, 0.2, 0, top + 0.9, -0.1, lantern);
      top += 1.1;
    }
    if (s.identity === 'clinic') {
      d.box(g, 0.5, 0.14, 0.06, 0, 2.1, r + 0.45, P.warm);
      d.box(g, 0.14, 0.5, 0.06, 0, 2.1, r + 0.45, P.warm);
    }
    return { top, radius: r };
  },
  vault(d, g, s) {
    const r = Math.min(1.35, s.height * 0.5),
      length = s.width - 0.2;
    disc(d, g, s.width * 0.52, 0.08, 0, -0.1, P.shell, 0.16, 1.55);
    barrel(d, g, r, length, 0, 0.1, -0.1, P.shell);
    for (const x of [-length / 2 + 0.3, 0, length / 2 - 0.3])
      barrel(d, g, r + 0.05, 0.14, x, 0.1, -0.1, P.accent);
    d.box(g, length * 0.7, 0.95, 0.5, 0, 0.55, r - 0.35, P.glass, true);
    pod(
      d,
      g,
      length * 0.42,
      0.14,
      0.55,
      0,
      1.2,
      r + 0.05,
      s.identity === 'diner' ? P.warm : P.accent,
    );
    if (s.detail === 'billboard' || s.identity === 'terrace') {
      d.rod(g, [length / 2 - 0.3, 0.1, r + 0.4], [length / 2 - 0.3, 1.9, r + 0.4], 0.05, P.accent);
      disc(d, g, 0.35, 2.1, length / 2 - 0.3, r + 0.4, P.light, 0.3).rotation.x = Math.PI / 2;
    }
    return { top: r + 0.1, radius: Math.min(1.2, r) };
  },
  hangar(d, g, s) {
    const r = Math.min(1.35, s.height * 0.55),
      length = DEPTH - 0.2;
    disc(d, g, s.width * 0.5, 0.08, 0, 0, P.shell, 0.16, 1.6);
    barrel(d, g, r, length, 0, 0.1, 0, s.identity === 'fire' ? P.warm : P.shell, true);
    for (const z of [-length / 2 + 0.25, length / 2 - 0.25])
      barrel(d, g, r + 0.05, 0.12, 0, 0.1, z, P.accent, true);
    d.box(g, r * 1.1, r * 0.85, 0.1, 0, r * 0.45, length / 2 + 0.02, P.deep, true);
    if (s.identity === 'mill' || s.identity === 'freight' || s.identity === 'warehouse') {
      const x = s.width / 2 - 0.55;
      drum(d, g, 0.45, 2.4, x, 0.05, -0.6, P.shell);
      pod(d, g, 0.45, 0.3, 0.45, x, 2.45, -0.6, P.accent);
    }
    if (s.identity === 'forge') {
      d.rod(g, [0.6, 0.4, -0.6], [0.6, 2.4, -0.6], 0.14, P.deep);
      pod(d, g, 0.22, 0.12, 0.22, 0.6, 2.45, -0.6, P.warm);
    }
    if (['garage', 'stable'].includes(s.kind) || s.identity === 'fire') {
      const vehicle = parkedVehicle(d, d.group(g, 0, 0, 2.35), s.kind, s.era);
      vehicle.rotation.y = Math.PI / 2;
    }
    return { top: r + 0.1, radius: Math.min(1.2, r) };
  },
  tanks(d, g, s) {
    if (s.identity === 'well') {
      drum(d, g, 0.7, 0.6, 0, 0.05, 0, P.shell);
      disc(d, g, 0.62, 0.66, 0, 0, P.glass, 0.03);
      for (let n = 0; n < 3; n++) {
        const a = (n / 3) * TAU + 0.5;
        d.rod(g, [Math.cos(a) * 0.62, 0.6, Math.sin(a) * 0.62], [0, 1.9, 0], 0.05, P.accent);
      }
      pod(d, g, 0.5, 0.5, 0.5, 0, 2.2, 0, P.glass);
      disc(d, g, 0.54, 2.2, 0, 0, P.shell, 0.08);
      return { top: 2.7, radius: 0.6 };
    }
    if (s.identity === 'power') {
      // A compact fusion sphere wrapped in a bright equatorial ring.
      drum(d, g, 1.2, 0.8, 0, 0.05, 0, P.shell);
      pod(d, g, 1.05, 1.05, 1.05, 0, 1.85, 0, P.glass);
      const ring = disc(d, g, 1.45, 1.85, 0, 0, P.light, 0.09);
      ring.rotation.x = 0.35;
      doorway(d, g, 0, 1.22, 0.6, 0.75);
      return { top: 2.9, radius: 1.1 };
    }
    for (const [x, r] of [
      [-0.95, 0.85],
      [0.95, 0.7],
    ]) {
      drum(d, g, r * 0.8, 0.7, x, 0.05, -0.1, P.shell);
      pod(d, g, r, r, r, x, 0.75 + r * 0.7, -0.1, x < 0 ? P.glass : P.shell);
      disc(d, g, r + 0.04, 0.75 + r * 0.7, x, -0.1, P.accent, 0.08);
    }
    d.rod(g, [-0.2, 1.3, -0.1], [0.3, 1.3, -0.1], 0.1, P.accent);
    return { top: 2.4, radius: 0.85, x: -0.95 };
  },
  tube(d, g, s) {
    // A rounded concourse under an elevated glass tube and its waiting pod.
    const length = s.width,
      y = 2.35;
    drum(d, g, 1.05, 1.5, -0.4, 0.05, -0.2, P.shell);
    pod(d, g, 1.05, 0.7, 1.05, -0.4, 1.55, -0.2, P.accent);
    disc(d, g, 1.08, 0.85, -0.4, -0.2, P.glass, 0.7);
    doorway(d, g, -0.4, 0.88);
    for (const x of [-length / 2 + 0.35, length / 2 - 0.35])
      drum(d, g, 0.14, y - 0.35, x, 0.05, 0.9, P.shell);
    barrel(d, g, 0.5, length, 0, y, 0.9, P.glass);
    if (s.identity === 'maglev' || s.identity === 'transit')
      pod(d, g, 1.1, 0.34, 0.36, 0.6, y, 0.9, P.shell);
    disc(d, g, 0.52, y + 0.5, 0, 0.9, P.accent, 0.08, 0.3).scale.x = length / 2;
    return { top: 2.25, radius: 1.05, x: -0.4 };
  },
  shell(d, g, s) {
    // Overlapping shells over a glazed foyer, like pebbles on the plaza.
    const w = s.width;
    disc(d, g, w * 0.5, 0.08, 0, 0, P.shell, 0.16, 1.7);
    d.box(g, w * 0.7, 1.1, 0.8, 0, 0.6, 0.9, P.glass, true);
    pod(d, g, w * 0.36, s.height * 0.8, 1.35, -w * 0.12, 0.1, -0.2, P.shell);
    pod(d, g, w * 0.26, s.height * 0.62, 1.05, w * 0.22, 0.1, 0.25, P.accent);
    disc(d, g, 0.35, s.height * 0.8 + 0.08, -w * 0.12, -0.2, P.glass, 0.06);
    doorway(d, g, 0, 1.32);
    return { top: s.height * 0.8 + 0.1, radius: w * 0.3, x: -w * 0.12 };
  },
  geodesic(d, g, s) {
    drum(d, g, 1.5, 0.35, 0, 0.05, -0.1, P.shell);
    d.ball(g, 0, 0.9, -0.1, [1.55, 1.55, 1.45], P.glass, 'rock');
    d.ball(g, 0, 2.55, -0.1, [0.35, 0.55, 0.35], P.light, 'rock');
    d.box(g, 1.1, 1.05, 0.9, 0, 0.6, 1.25, P.shell, true);
    doorway(d, g, 0, 1.72, 0.55, 0.9);
    return { top: 3.1, radius: 1.3 };
  },
  greenhouse(d, g, s) {
    const big = s.identity === 'biodome';
    const domes = big
      ? [
          [-0.2, -0.2, 1.75],
          [1.75, 0.55, 0.62],
          [-1.9, 0.7, 0.55],
        ]
      : [
          [-0.75, -0.2, 0.95],
          [0.95, 0.1, 0.72],
        ];
    for (const [x, z, r] of domes) {
      disc(d, g, r + 0.1, 0.1, x, z, P.shell, 0.18);
      pod(d, g, r, r * 0.85, r, x, 0.18, z, P.glass);
      // Rib hoops read as the dome's frame without transparent materials.
      for (const turn of [0, Math.PI / 2]) {
        const hoop = disc(d, g, r + 0.02, 0.18, x, z, P.shell, 0.05, r * 0.85 + 0.02);
        hoop.rotation.set(Math.PI / 2, 0, turn);
      }
    }
    for (const x of [-1.8, -1.2, 1.3, 1.9])
      if (!big || Math.abs(x) < 1.5) shrub(d, g, x, 1.45, 0.24);
    return {
      top: (big ? 1.75 : 0.95) * 0.85 + 0.2,
      radius: big ? 1.6 : 0.9,
      x: big ? -0.2 : -0.75,
    };
  },
  pavilion(d, g, s) {
    for (let n = 0; n < 4; n++) {
      const a = (n / 4) * TAU + TAU / 8;
      d.rod(
        g,
        [Math.cos(a) * 1, 0.05, Math.sin(a) * 0.8],
        [Math.cos(a) * 1, 1.8, Math.sin(a) * 0.8],
        0.06,
        P.shell,
      );
    }
    drum(d, g, 0.8, 1.2, 0, 0.05, -0.2, P.glass);
    disc(d, g, 1.45, 1.85, 0, 0, P.shell, 0.14, 1.15);
    pod(d, g, 0.8, 0.45, 0.8, 0, 1.9, 0, P.accent);
    return { top: 2.35, radius: 0.9 };
  },
  garden(d, g, s) {
    leisureModel(
      d,
      g,
      `${s.kind === 'horseField' ? 'field' : 'park'}${Math.min(3, s.serviceLevel)}`,
    );
    for (const x of s.level >= 2 ? [-2, 2] : [2]) {
      d.rod(g, [x, 0.05, -1.6], [x, 1.9, -1.6], 0.06, P.accent);
      pod(d, g, 0.95, 0.25, 0.95, x, 2, -1.6, x < 0 ? P.shell : P.glass);
    }
    if (s.level >= 3) {
      // Evening lights and a round planter along the garden's front edge.
      for (const x of [-1.2, 1.2]) lamp(d, g, x, 2.1, 1.4);
      shrub(d, g, 0, 2.1, 0.35);
    }
    return null;
  },
  mast(d, g, s) {
    const z = 1.2;
    const top = cottage(d, g, 0, z, 1, 1.2);
    d.rod(g, [0, top - 0.2, z], [0, s.height, z], 0.09, P.shell);
    [0.65, 0.45, 0.3].forEach((r, n) =>
      disc(d, g, r, s.height * (0.45 + n * 0.18), 0, z, n % 2 ? P.accent : P.shell, 0.08),
    );
    pod(d, g, 0.2, 0.2, 0.2, 0, s.height + 0.15, z, P.warm);
    return { top: top, radius: 1, z };
  },
  orb(d, g, s) {
    // A television orb on a slender stem, rising from a domed studio.
    const top = cottage(d, g, 0, 0, 1.7, 1.6);
    drum(d, g, 0.3, s.height - 1.4, 0, 1.6, 0, P.shell);
    pod(d, g, 1.05, 1, 1.05, 0, s.height, 0, P.glass);
    disc(d, g, 1.2, s.height, 0, 0, P.accent, 0.12);
    d.rod(g, [0, s.height + 0.9, 0], [0, s.height + 2.1, 0], 0.06, P.shell);
    pod(d, g, 0.14, 0.14, 0.14, 0, s.height + 2.15, 0, P.warm);
    return { top, radius: 1.7 };
  },
  spire(d, g, s) {
    // The business tower becomes a tapering glass spire with sky-garden rings.
    const sections = [
      [1.55, 4.6],
      [1.2, 4],
      [0.85, 3.2],
    ];
    let y = 0.2;
    disc(d, g, 1.95, 0.12, 0, 0, P.shell, 0.2, 1.6);
    for (const [r, h] of sections) {
      drum(d, g, r, h, 0, y, 0, P.glass, r * 0.85);
      for (let n = 1; n < h / 1.1; n++)
        disc(d, g, r + 0.1, y + n * 1.1, 0, 0, P.shell, 0.1, r * 0.85 + 0.1);
      disc(d, g, r + 0.3, y + h, 0, 0, P.green, 0.18, r * 0.85 + 0.3);
      y += h;
    }
    pod(d, g, 0.85, 0.7, 0.75, 0, y, 0, P.accent);
    d.rod(g, [0, y + 0.5, 0], [0, y + 2.4, 0], 0.07, P.shell);
    pod(d, g, 0.14, 0.14, 0.14, 0, y + 2.45, 0, P.warm);
    doorway(d, g, 0, 1.5, 0.9, 1.3);
    return { top: y + 0.7, radius: 0.85 };
  },
};

/** A glazed dome lounge for landmarks that keep their shared shell (the airport). */
export function addRoundedLounge(d, parent, x, floor, z) {
  pod(d, parent, 2.3, 1.45, 1.5, x, floor + 0.1, z, P.glass);
  disc(d, parent, 2.45, floor + 0.12, x, z, P.accent, 0.12, 1.65);
  pod(d, parent, 0.45, 0.3, 0.45, x, floor + 1.5, z, P.light);
}

/**
 * Render a city building in the rounded architecture. Returns false for kinds whose
 * shared renderer already fits every architecture (airport, square, bridge).
 * Level 2 adds a capsule wing; level 3 a ring terrace, garden pods and lights.
 */
export function renderRoundedBuilding(d, parent, kind, label, level, era, serviceLevel = 3) {
  const form = roundedForm(kind);
  if (!form) return false;
  const style = {
    ...cityAppearance(era, kind),
    ...LANDMARKS[CITY_FAMILIES[kind]],
    kind,
    era,
    level,
    serviceLevel,
  };
  if (RIVER_KINDS.has(kind)) addFishingDock(d, parent, serviceLevel, kind === 'riverPort');
  const root = d.group(parent);
  root.name = `${era} rounded ${kind} level ${level}`;
  root.userData.eraLevel = level;
  const crown = FORMS[form](d, root, style);
  const w = style.width ?? 3.6;
  if (level >= 2 && crown) {
    // A glazed capsule wing tucked behind the main volume.
    const x = -w / 2 + 0.15;
    pod(d, root, 0.75, 0.62, 0.95, x, 0.62, -0.75, P.shell);
    pod(d, root, 0.62, 0.22, 0.8, x, 0.95, -0.7, P.glass);
  }
  if (level >= 3 && crown) {
    const x = crown.x ?? 0,
      z = crown.z ?? (form === 'tower' ? -0.1 : 0);
    disc(d, root, crown.radius + 0.3, crown.top * 0.62, x, z, P.green, 0.1);
    for (const side of [-1, 1]) lamp(d, root, side * Math.min(w / 2, 2), 1.75);
    shrub(d, root, w / 2 - 0.1, -1.2, 0.28);
  }
  if (kind === 'busDepot') {
    const vehicle = motorVehicle(d, d.group(root, 0, 0, 2.5), true, era);
    vehicle.rotation.y = Math.PI / 2;
  }
  // Low vaults and domes carry their sign at the entrance, not floating above.
  d.sign(root, label, 2.9, 0, Math.min(2.8, Math.max(1.55, (crown?.top ?? 2.8) - 0.2)), 1.8);
  return true;
}

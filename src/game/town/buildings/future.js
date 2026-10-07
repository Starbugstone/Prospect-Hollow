import { cityAppearance } from '../../../data/cityAppearance';
import { FUTURE_LANDMARKS, futureAppearance, futureForm } from '../../../data/futureArchitecture';
import { addSquareModernization, buildTownSquare } from '../TownSquare';
import { addFishingDock } from './river';
import { leisureModel } from '../LeisureAssets';
import { BRIDGE, bridgeDeckHeight } from '../TownRiver';
import { parkedVehicle } from '../TownVehicles';
import { futureShape } from './futureShapes';
import { sailKit } from './future/sail';
import { observatoryKit } from './future/observatory';
import { homesteadKit } from './future/homestead';
import { homecomingHall, twinKit } from './future/twin';

// The eras after Riverlight share one set of archetypes. Each architecture's kit
// draws its own walls, roofs, doors, annex and finishing flourish, so a family
// keeps its massing while every era gives it a distinct silhouette. Geometry is
// built once per plot purchase from shared primitives and merged by material.
const KITS = {
  sail: sailKit,
  observatory: observatoryKit,
  homestead: homesteadKit,
  twin: twinKit,
};
const TAU = Math.PI * 2;

// A rectangular building: body, roof and front door. Returns its crown.
function house(d, g, s, { x = 0, z = -0.35, w, dep, h, accent = false, door = true }) {
  const k = s.kit;
  const top = k.block(d, g, s, { x, z, w, dep, h });
  const peak = k.roof(d, g, s, { x, z, w, dep, y: top, accent });
  if (door) k.door(d, g, s, x, z + dep / 2 + 0.02);
  return { top: peak, eave: top, radius: Math.min(w, dep) / 2, x, z };
}
// A round building: drum and cap. Returns its crown.
function tower(d, g, s, { x = 0, z = -0.35, r, h, accent = false, door = true }) {
  const k = s.kit;
  const top = k.round(d, g, s, { x, z, r, h });
  const peak = k.cap(d, g, s, { x, z, r, y: top, accent });
  if (door) k.door(d, g, s, x, z + r + 0.02);
  return { top: peak, eave: top, radius: r, x, z };
}
// Low beds of planted rows, shared by farms and gardens.
function beds(d, g, s, x, z, w, rows = 3) {
  const p = s.palette;
  for (let n = 0; n < rows; n++) {
    d.box(g, w, 0.16, 0.42, x, 0.08, z + n * 0.62, p.timber);
    for (let m = 0; m < Math.round(w / 0.5); m++)
      d.ball(g, x - w / 2 + 0.25 + m * 0.5, 0.28, z + n * 0.62, [0.2, 0.17, 0.2], p.green, 'rock');
  }
}

const FORMS = {
  homes(d, g, s) {
    const h = Math.max(2.4, s.height ?? 3);
    if (['row', 'court'].includes(s.identity)) {
      for (const x of [-1.45, 0, 1.45])
        house(d, g, s, { x, w: 1.3, dep: 1.9, h: x ? 1.9 : 2.3, accent: !x });
      return { top: 3.2, eave: 2.3, radius: 0.7, x: 0, z: -0.35 };
    }
    if (['twin', 'pods', 'balconies', 'hotel'].includes(s.identity)) {
      const towers =
        s.identity === 'twin' || s.identity === 'pods'
          ? [
              [-0.95, 0.8, h],
              [0.95, 0.8, h - 1.1],
            ]
          : [[0, 1.15, h]];
      const crowns = towers.map(([x, r, height], n) =>
        tower(d, g, s, { x, r, h: height, accent: n === 1 }),
      );
      return crowns[0];
    }
    return house(d, g, s, { w: Math.min(2.8, s.width ?? 2.8), dep: 2.1, h: Math.min(h, 2.6) });
  },
  hall(d, g, s) {
    const crown = house(d, g, s, { w: Math.min(3.6, s.width ?? 3.6), dep: 2.4, h: 2.3 });
    if (['clock', 'bell', 'patrol', 'post'].includes(s.identity)) {
      const r = 0.42;
      const top = s.kit.round(d, g, s, { x: 0, z: -1.05, r, h: crown.top + 0.7 });
      s.kit.cap(d, g, s, { x: 0, z: -1.05, r, y: top, accent: true });
    }
    return crown;
  },
  shop(d, g, s) {
    const w = Math.min(3.7, (s.width ?? 3.4) + 0.2);
    const crown = house(d, g, s, { w, dep: 2.2, h: s.kind === 'saloon' ? 2.4 : 2, accent: true });
    // A long market counter under the eaves.
    d.box(g, w * 0.7, 0.42, 0.34, 0, 0.36, 1.05, s.palette.timber);
    d.box(g, w * 0.7, 0.06, 0.4, 0, 0.6, 1.05, s.palette.shell);
    if (s.kind === 'saloon') {
      const medallion = d.mesh(
        g,
        'cylinder',
        [0.3, 0.1, 0.3],
        [0, crown.eave + 0.35, 0.82],
        s.palette.light,
      );
      medallion.rotation.x = Math.PI / 2;
      medallion.name = 'Golden Hour saloon medallion';
    }
    return crown;
  },
  workshop(d, g, s) {
    const w = Math.min(3.7, s.width ?? 3.6);
    const crown = house(d, g, s, { w, dep: 2.4, h: 2.3 });
    if (['forge', 'mill', 'warehouse', 'fire'].includes(s.identity)) {
      const top = s.kit.round(d, g, s, { x: -w * 0.32, z: -1.1, r: 0.32, h: crown.top + 0.5 });
      s.kit.cap(d, g, s, { x: -w * 0.32, z: -1.1, r: 0.32, y: top, accent: true });
    }
    return crown;
  },
  water(d, g, s) {
    if (s.identity === 'well') return tower(d, g, s, { r: 0.75, h: 1.25, z: -0.1, door: false });
    tower(d, g, s, { x: 0.95, r: 0.62, h: 1.6, accent: true, door: false });
    return tower(d, g, s, { x: -0.8, r: 0.82, h: 2.1 });
  },
  station(d, g, s) {
    const crown = house(d, g, s, { w: 3.6, dep: 1.8, h: 2.2, z: -0.7 });
    // A long platform canopy on slender posts.
    for (const x of [-1.6, 1.6]) d.rod(g, [x, 0, 0.7], [x, 1.7, 0.7], 0.05, s.palette.deep);
    d.box(g, 3.7, 0.08, 0.9, 0, 1.72, 0.55, s.palette.roof);
    return crown;
  },
  culture(d, g, s) {
    const crown = house(d, g, s, { x: -0.5, w: 2.4, dep: 2.2, h: 2.4 });
    tower(d, g, s, { x: 1.25, z: -0.2, r: 0.7, h: 1.6, accent: true, door: false });
    return crown;
  },
  research(d, g, s) {
    for (const x of [-1.35, 1.35]) house(d, g, s, { x, w: 1.1, dep: 1.6, h: 1.6, door: false });
    return tower(d, g, s, { r: 1.05, h: 2.6 });
  },
  farm(d, g, s) {
    const crown = house(d, g, s, { x: -0.8, z: -0.75, w: 2, dep: 1.6, h: 1.8 });
    tower(d, g, s, { x: 1.3, z: -0.85, r: 0.55, h: 2.4, accent: true, door: false });
    beds(d, g, s, 0.75, 0.25, 1.9, 2);
    return crown;
  },
  landing(d, g, s) {
    const p = s.palette;
    d.box(g, 3.2, 0.14, 1.2, 0, 0.12, 0.6, p.timber);
    return house(d, g, s, { w: 1.9, dep: 1.5, h: 1.8, z: -0.6 });
  },
  garden(d, g, s) {
    leisureModel(
      d,
      g,
      `${s.kind === 'horseField' ? 'field' : 'park'}${Math.min(3, s.serviceLevel)}`,
    );
    tower(d, g, s, { x: -1.5, z: -1.65, r: 0.42, h: 1.2, door: false });
    return null;
  },
  mast(d, g, s) {
    const crown = house(d, g, s, { w: 2.2, dep: 1.9, h: 1.9 });
    d.rod(g, [0.7, crown.top - 0.3, -0.6], [0.7, 8.2, -0.6], 0.07, s.palette.deep);
    for (const y of [4.6, 6, 7.4])
      d.mesh(
        g,
        futureShape(d, 'hoop'),
        [0.35, 0.35, 0.35],
        [0.7, y, -0.6],
        s.palette.timber,
      ).rotation.x = Math.PI / 2;
    return crown;
  },
  concert(d, g, s) {
    return tower(d, g, s, { r: 1.75, h: 1.7, z: -0.5 });
  },
  studio(d, g, s) {
    const crown = house(d, g, s, { w: 2.8, dep: 2, h: 1.9 });
    const top = s.kit.round(d, g, s, { x: 0.9, z: -0.9, r: 0.42, h: 4.6 });
    s.kit.cap(d, g, s, { x: 0.9, z: -0.9, r: 0.55, y: top, accent: true });
    return crown;
  },
  tower(d, g, s) {
    const k = s.kit;
    let y = 0;
    for (const [r, h] of [
      [1.35, 3.6],
      [1.05, 3],
      [0.75, 2.4],
    ])
      y += k.round(d, d.group(g, 0, y, 0), s, { x: 0, z: -0.4, r, h }) - 0.25;
    const top = k.cap(d, g, s, { x: 0, z: -0.4, r: 0.8, y: y + 0.25 });
    k.door(d, g, s, 0, 0.97);
    return { top, eave: y, radius: 0.8, x: 0, z: -0.4 };
  },
  square(d, g, s) {
    buildTownSquare(d, g, s.serviceLevel, false, s.era);
    addSquareModernization(d, g, s.level, s.palette.deep);
    if (s.level >= 2) for (const x of [-2.15, 2.15]) s.kit.prop(d, g, s, x, -2.15);
    if (s.level >= 3) for (const x of [-2.15, 2.15]) s.kit.prop(d, g, s, x, 2.15);
    return null;
  },

  // ---------- Skysail landmarks ----------
  skyHarbour(d, g, s) {
    const p = s.palette;
    d.mesh(g, 'cylinder', [2.6, 0.2, 2.2], [0, 0.1, -0.3], p.shell);
    // The mooring mast: a slender tower with a turning platform at its head.
    const top = s.kit.round(d, g, s, { x: -0.9, z: -0.6, r: 0.55, h: 4.4 });
    s.kit.cap(d, g, s, { x: -0.9, z: -0.6, r: 0.75, y: top + 0.1, accent: true });
    d.mesh(g, 'cylinder', [0.95, 0.12, 0.95], [-0.9, top + 0.05, -0.6], p.timber);
    airship(d, g, s, 1.2, top - 0.2, -0.6, 1);
    house(d, g, s, { x: 1.1, z: 0.5, w: 1.6, dep: 1.2, h: 1.5, door: true });
    if (s.level >= 2) {
      const second = s.kit.round(d, g, s, { x: 2.2, z: -1.4, r: 0.35, h: 3.2 });
      s.kit.cap(d, g, s, { x: 2.2, z: -1.4, r: 0.5, y: second });
      airship(d, g, s, 0.3, second + 1.3, -2.1, 0.7);
    }
    if (s.level >= 3) for (const x of [-2.3, 2.4]) s.kit.prop(d, g, s, x, 1.6);
    return { landmark: true };
  },
  cloudOrchard(d, g, s) {
    beds(d, g, s, 0, -1.6, 4, 3);
    house(d, g, s, { x: -1.6, z: 0.9, w: 1.4, dep: 1.1, h: 1.5 });
    const islands = [
      [1.2, 3.1, 0.2, 1.05],
      [-0.6, 4, -1.4, 0.85],
      [2.1, 4.4, -1.6, 0.75],
    ].slice(0, s.level >= 3 ? 3 : s.level >= 2 ? 2 : 1);
    for (const [x, y, z, r] of islands) island(d, g, s, x, y, z, r, true);
    if (s.level >= 3) s.kit.prop(d, g, s, 2.3, 1.4);
    return { landmark: true };
  },
  windsongLofts(d, g, s) {
    const lofts = [
      [-1.5, -0.9, 3],
      [0.6, -1.4, 3.8],
      [1.8, 0.4, 2.4],
    ].slice(0, s.level >= 2 ? 3 : 2);
    lofts.forEach(([x, z, h], n) => house(d, g, s, { x, z, w: 1.5, dep: 1.4, h, accent: n === 1 }));
    // Rope bridges join neighbors high above the lane.
    for (let n = 1; n < lofts.length; n++) {
      const [ax, az, ah] = lofts[n - 1],
        [bx, bz, bh] = lofts[n];
      d.rod(
        g,
        [ax, Math.min(ah, bh) - 0.3, az],
        [bx, Math.min(ah, bh) - 0.3, bz],
        0.06,
        s.palette.timber,
      );
    }
    if (s.level >= 3) s.kit.crown(d, g, s, { x: 0.6, z: -1.4, y: 5.4, r: 1 });
    return { landmark: true };
  },

  // ---------- Stargazer landmarks ----------
  greatTelescope(d, g, s) {
    const p = s.palette;
    const crown = tower(d, g, s, { r: 2.1, h: 2.4, z: -0.6 });
    // The great tube points through the dome toward the Moon.
    d.rod(g, [0, crown.eave + 0.7, -0.6], [0.6, crown.eave + 3.4, 1.0], 0.36, p.timber);
    d.ball(g, 0.6, crown.eave + 3.4, 1.0, [0.38, 0.1, 0.38], p.glass);
    if (s.level >= 2) {
      house(d, g, s, { x: -2.4, z: 0.2, w: 1.6, dep: 1.6, h: 1.7, door: false });
      tower(d, g, s, { x: 2.5, z: 0.2, r: 0.8, h: 1.3, door: false });
    }
    if (s.level >= 3) {
      const ring = d.mesh(
        g,
        futureShape(d, 'hoop'),
        [2.9, 2.9, 0.6],
        [0, crown.eave + 0.6, -0.6],
        p.flower,
      );
      ring.rotation.set(Math.PI / 2 - 0.25, 0, 0.12);
      for (const x of [-1.9, 1.9]) s.kit.prop(d, g, s, x, 1.9);
    }
    return { landmark: true };
  },
  dewlightGardens(d, g, s) {
    const p = s.palette;
    beds(d, g, s, 0, -0.2, 3.6, 3);
    const towers = [
      [-1.9, -1.5],
      [1.9, -1.5],
      [0, -2.2],
    ].slice(0, s.level >= 3 ? 3 : 2);
    for (const [x, z] of towers) {
      // Tall glass dew towers gather the night mist into the beds below.
      d.mesh(g, 'cylinder', [0.38, 3, 0.38], [x, 1.5, z], p.glass);
      s.kit.cap(d, g, s, { x, z, r: 0.42, y: 3 });
    }
    if (s.level >= 2)
      for (const [x, z] of [
        [-1.6, 1.6],
        [1.6, 1.6],
        [0, 1.9],
      ])
        d.ball(g, x, 0.3, z, 0.18, p.light);
    house(d, g, s, { x: 2.3, z: 1.2, w: 1.2, dep: 1, h: 1.4 });
    return { landmark: true };
  },
  starlightTerraces(d, g, s) {
    const steps = [
      [-1.7, -1.2, 2.2],
      [0, -1.6, 3.2],
      [1.7, -1.2, 2.2],
    ];
    for (const [x, z, h] of steps.slice(0, s.level >= 2 ? 3 : 2)) {
      const crown = house(d, g, s, { x, z, w: 1.5, dep: 1.6, h });
      if (s.level >= 3 && x === 0) s.kit.crown(d, g, s, { ...crown, y: crown.top, r: 0.8 });
    }
    if (s.level >= 3) for (const x of [-2.3, 2.3]) s.kit.prop(d, g, s, x, 1.3);
    return { landmark: true };
  },

  // ---------- Moonward landmarks ----------
  moonpost(d, g, s) {
    const p = s.palette;
    house(d, g, s, { z: -0.4, w: 3.2, dep: 2.3, h: 2.4 });
    // A parcel rail points a little capsule toward the Moon.
    d.rod(g, [1.9, 0.2, 0.6], [2.6, 2.6, -1.3], 0.07, p.deep);
    d.box(g, 0.3, 0.3, 0.6, 2.45, 2.1, -0.9, p.light, true).rotation.x = 0.9;
    if (s.level >= 2) s.kit.wing(d, g, s, { x: -2.1, z: -1.3 });
    if (s.level >= 3) {
      const top = s.kit.round(d, g, s, { x: -1.3, z: -1.5, r: 0.4, h: 4 });
      s.kit.cap(d, g, s, { x: -1.3, z: -1.5, r: 0.45, y: top });
      d.mesh(g, 'cylinder', [0.3, 0.06, 0.3], [-1.3, 3.4, -1.08], p.light).rotation.x = Math.PI / 2;
    }
    return { landmark: true };
  },
  missionHomesteads(d, g, s) {
    const homes = [
      [-1.8, -1, 2.1],
      [0.4, -1.5, 2.4],
      [2.2, 0.2, 2],
    ].slice(0, s.level >= 2 ? 3 : 2);
    for (const [x, z, h] of homes) house(d, g, s, { x, z, w: 1.6, dep: 1.6, h });
    if (s.level >= 3) {
      // A shared flagpole with the mission's moon pennant.
      d.rod(g, [-0.6, 0, 1.4], [-0.6, 3.2, 1.4], 0.04, s.palette.deep);
      d.mesh(g, futureShape(d, 'pennant'), [0.75, 0.45, 1], [-0.6, 2.7, 1.4], s.palette.light);
      for (const x of [1.2, 2.6]) s.kit.prop(d, g, s, x, 1.6);
    }
    return { landmark: true };
  },
  homecomingHall(d, g, s) {
    return homecomingHall(d, g, s, house);
  },
  spaceElevator(d, g, s) {
    return renderSpaceElevator(d, g, s);
  },
};

function island(d, g, s, x, y, z, r, orchard = false) {
  const p = s.palette;
  d.rod(g, [x, 0.15, z], [x, y - r * 0.6, z], 0.02, p.deep);
  const rock = d.ball(g, x, y - r * 0.32, z, [r, r * 0.8, r * 0.92], p.timber, 'rock');
  rock.rotation.set(Math.PI, x, 0);
  d.mesh(g, 'cylinder', [r, 0.15, r * 0.92], [x, y, z], p.green);
  const trees = orchard ? 2 : 1;
  for (let n = 0; n < trees; n++) {
    const tx = x + (n - (trees - 1) / 2) * r * 0.8;
    d.rod(g, [tx, y, z], [tx, y + 0.5, z], 0.05, p.timber);
    d.ball(g, tx, y + 0.78, z, [0.4, 0.36, 0.4], p.green, futureShape(d, 'leafy'));
    if (orchard)
      for (const a of [0, 2.1, 4.2])
        d.ball(g, tx + Math.sin(a) * 0.3, y + 0.72, z + Math.cos(a) * 0.3, 0.08, p.flower, 'rock');
  }
}
function airship(d, g, s, x, y, z, scale = 1) {
  const p = s.palette;
  d.ball(g, x, y, z, [1.55 * scale, 0.62 * scale, 0.62 * scale], p.shell);
  d.mesh(
    g,
    'cylinder',
    [0.64 * scale, 0.22 * scale, 0.64 * scale],
    [x, y, z],
    p.flower,
  ).rotation.z = Math.PI / 2;
  for (const side of [-1, 1]) {
    const fin = d.box(
      g,
      0.45 * scale,
      0.04,
      0.5 * scale,
      x - 1.35 * scale,
      y + side * 0.32 * scale,
      z,
      p.deep,
    );
    fin.rotation.x = side * 0.5;
  }
  d.box(
    g,
    0.7 * scale,
    0.26 * scale,
    0.32 * scale,
    x + 0.1 * scale,
    y - 0.72 * scale,
    z,
    p.timber,
    true,
  );
  d.rod(
    g,
    [x - 0.6 * scale, y - 0.6 * scale, z],
    [x + 0.6 * scale, y - 0.6 * scale, z],
    0.02,
    p.deep,
  );
}

// The space elevator: an anchor tower, cargo docks for the mine carts, a silver
// ribbon rising beyond the sky, climbers and, finally, a halo station.
const RIBBON_HEIGHT = 140;
function renderSpaceElevator(d, g, s) {
  const p = s.palette,
    level = s.level;
  d.mesh(g, futureShape(d, 'octagon'), [6.2, 0.3, 6.2], [0, 0.15, 0], p.deep);
  d.mesh(g, futureShape(d, 'octagon'), [5.6, 0.12, 5.6], [0, 0.34, 0], p.shell);
  d.mesh(g, futureShape(d, 'hoop'), [5.65, 5.65, 2.2], [0, 0.4, 0], p.light).rotation.x =
    Math.PI / 2;
  // Anchor tower with buttresses.
  d.mesh(g, futureShape(d, 'octagon'), [1.7, 5.2, 1.7], [0, 2.9, 0], p.shell);
  d.mesh(g, futureShape(d, 'octagon'), [1.85, 0.25, 1.85], [0, 5.55, 0], p.light);
  for (let n = 0; n < 4; n++) {
    const a = (n * TAU) / 4 + TAU / 8;
    d.rod(
      g,
      [Math.sin(a) * 3.4, 0.4, Math.cos(a) * 3.4],
      [Math.sin(a) * 1.6, 4.6, Math.cos(a) * 1.6],
      0.22,
      p.roof,
    );
  }
  // The ribbon: thin, silver and too tall to cast a useful shadow.
  const ribbon = d.mesh(
    g,
    'cylinder',
    [0.09, RIBBON_HEIGHT, 0.09],
    [0, 5.6 + RIBBON_HEIGHT / 2, 0],
    p.glass,
  );
  ribbon.castShadow = false;
  ribbon.name = 'Space elevator ribbon';
  for (const y of [5.8, 6.6, 7.4])
    d.mesh(g, futureShape(d, 'hoop'), [0.32, 0.32, 0.32], [0, y, 0], p.light).rotation.x =
      Math.PI / 2;
  // Cargo docks: the mine carts unload into the climbers here.
  for (const side of [-1, 1]) {
    house(d, g, s, { x: side * 3.6, z: 2.2, w: 2.2, dep: 1.8, h: 1.9, door: side < 0 });
    d.box(g, 0.9, 0.7, 0.9, side * 1.8, 0.75, 2.6, p.timber);
    d.box(g, 0.92, 0.08, 0.92, side * 1.8, 1.12, 2.6, p.light);
  }
  // Climbers ride the ribbon together as one moving part; each carries supplies up.
  const climbers = d.group(g);
  climbers.name = ELEVATOR_CLIMBERS;
  climber(d, climbers, s, 9);
  if (level >= 2) {
    climber(d, climbers, s, 24);
    // Loading gantries reach from the docks to the anchor.
    for (const side of [-1, 1]) {
      d.rod(g, [side * 3.6, 2.6, 1.6], [side * 1.1, 4.2, 0.2], 0.08, p.deep);
      d.rod(g, [side * 3.6, 2.6, 1.6], [side * 3.6, 0.4, 1.6], 0.08, p.deep);
    }
    for (const side of [-1, 1]) {
      const fin = d.box(g, 2.4, 0.06, 1, side * 2.2, 6.4, -1.6, p.roof);
      fin.rotation.z = side * 0.18;
    }
  }
  if (level >= 3) {
    // The halo station rides the ribbon high above the valley.
    const halo = d.mesh(g, futureShape(d, 'hoop'), [3.2, 3.2, 3.2], [0, 17, 0], p.shell);
    halo.rotation.x = Math.PI / 2;
    halo.castShadow = false;
    d.mesh(g, 'cylinder', [0.9, 0.7, 0.9], [0, 17, 0], p.light).castShadow = false;
    for (let n = 0; n < 4; n++) {
      const a = (n * TAU) / 4;
      d.rod(g, [0, 17, 0], [Math.sin(a) * 3.1, 17, Math.cos(a) * 3.1], 0.06, p.deep).castShadow =
        false;
    }
    for (const [x, z] of [
      [-5.2, -4.2],
      [5.2, -4.2],
      [-5.2, 4.6],
      [5.2, 4.6],
    ])
      s.kit.prop(d, g, s, x, z, 0.4);
    climber(d, climbers, s, 46);
  }
  return { landmark: true };
}
function climber(d, parent, s, y) {
  const p = s.palette,
    g = d.group(parent, 0, y, 0);
  g.name = 'Space elevator climber';
  d.box(g, 0.9, 1.2, 0.9, 0, 0, 0, p.shell, true);
  d.mesh(g, futureShape(d, 'hoop'), [0.62, 0.62, 0.62], [0, 0.35, 0], p.light).rotation.x =
    Math.PI / 2;
  d.box(g, 0.94, 0.18, 0.94, 0, -0.25, 0, p.flower);
  g.traverse((part) => (part.castShadow = false));
}
export const ELEVATOR_CLIMBERS = 'Space elevator climbers';
const CLIMB = { bottom: 6.6, top: 64, period: 46, dwell: 3.5 };
/** The first climber reaches the docks once per trip; Moon guests step off then. */
export function elevatorArrival(time) {
  const since = ((time % CLIMB.period) + CLIMB.period) % CLIMB.period;
  return {
    arrived: since < CLIMB.dwell,
    sinceArrival: since,
    visit: Math.floor(time / CLIMB.period),
  };
}
/** The elevator's per-frame motion: climbers ride the ribbon and, each time one
 * reaches the docks, Moon guests may step off (the climber group frames them). */
export const elevatorMotion = (d, climbers) => (time) => {
  moveClimbers(climbers, time);
  d.visitorTransports?.set('spaceElevator', { ...elevatorArrival(time), root: climbers });
};
/** Climbers rise with supplies and glide back down, evenly spaced along the ribbon. */
export function moveClimbers(group, time) {
  const climbers = group.children;
  climbers.forEach((climber, n) => {
    const phase = (time / CLIMB.period + n / climbers.length) % 1;
    const rise = phase < 0.5 ? phase * 2 : 2 - phase * 2;
    climber.position.y = CLIMB.bottom + rise * rise * (3 - 2 * rise) * (CLIMB.top - CLIMB.bottom);
  });
}

export function renderFutureBuilding(d, parent, kind, label, level, era, serviceLevel = 3) {
  const form = futureForm(kind);
  if (!form) return false;
  const appearance = futureAppearance(era);
  const s = {
    ...cityAppearance(era, kind),
    ...appearance,
    kit: KITS[appearance.style],
    kind,
    era,
    level,
    serviceLevel,
  };
  if (['fisherman', 'riverPort'].includes(kind))
    addFishingDock(d, parent, serviceLevel, kind === 'riverPort');
  const root = d.group(parent);
  root.name = `${era} ${appearance.style} ${kind} level ${level}`;
  root.userData.eraLevel = level;
  const landmark = FUTURE_LANDMARKS[kind];
  if (landmark) root.scale.setScalar(landmark.scale);
  const crown = FORMS[form](d, root, s);
  if (!landmark && crown) {
    // A rear annex alters the outline without using the front sidewalk.
    if (level >= 2)
      s.kit.wing(d, root, s, { x: -Math.min(1.75, (s.width ?? 3.4) / 2 - 0.1), z: -1.35 });
    if (level >= 3) {
      s.kit.crown(d, root, s, {
        x: crown.x ?? 0,
        z: crown.z ?? -0.35,
        y: crown.top,
        r: crown.radius,
      });
      const sides = kind === 'busDepot' ? [-1.85, 1.85] : [-1.45, 1.45];
      for (const x of sides) s.kit.prop(d, root, s, x, 1.5);
    }
  } else if (form === 'garden') {
    if (level >= 2) s.kit.prop(d, root, s, 1.4, -1.6);
    if (level >= 3) for (const x of [-1.5, 1.5]) s.kit.prop(d, root, s, x, 1.55);
  }
  if (['stable', 'garage', 'busDepot'].includes(kind)) {
    const vehicle = parkedVehicle(d, d.group(root, 0, 0, 1.4), kind, era);
    vehicle.rotation.y = Math.PI / 2;
  }
  if (!['square', 'garden'].includes(form) && kind !== 'spaceElevator')
    d.sign(root, label, landmark ? 2 : 2.4, 0, landmark ? 1.35 : 1.45, landmark ? 2.3 : 1.72);
  return true;
}

/** Rooftop lounge in the era's own style; the runway and exits stay clear. */
export function addFutureLounge(d, g, x, floor, z, era) {
  const appearance = futureAppearance(era),
    s = { ...appearance, kit: KITS[appearance.style], era };
  const group = d.group(g, x, floor, z);
  const top = s.kit.block(d, group, s, { w: 3.6, dep: 2.2, h: 1.4 });
  s.kit.roof(d, group, s, { w: 3.6, dep: 2.2, y: top });
}

export function addFutureAirportDetails(d, g, era, level) {
  const appearance = futureAppearance(era),
    s = { ...appearance, kit: KITS[appearance.style], era };
  s.kit.prop(d, g, s, 2.3, -4.5);
  if (level >= 2) s.kit.prop(d, g, s, 6.7, -4.5);
  if (level >= 3) s.kit.crown(d, g, s, { x: 4.4, z: -2.7, y: 3.5, r: 1 });
}

/** Approach furniture sits beside the bridge; the road and boat channel stay open. */
export function addFutureBridge(d, parent, era, level) {
  const appearance = futureAppearance(era),
    s = { ...appearance, kit: KITS[appearance.style], era },
    root = d.group(parent);
  root.name = `${era} ${appearance.style} bridge approaches ${level}`;
  for (const x of [-5.8, 5.8]) {
    const y = bridgeDeckHeight(BRIDGE.centerX + x);
    for (const z of [-1.75, 1.75]) if (level >= 2 || z < 0) s.kit.prop(d, root, s, x, z, y);
    // The finished crossing gains a second pair beyond each approach rail.
    if (level >= 3)
      for (const z of [-1.75, 1.75]) {
        const outer = x + Math.sign(x) * 1.2;
        s.kit.prop(d, root, s, outer, z, bridgeDeckHeight(BRIDGE.centerX + outer));
      }
  }
}

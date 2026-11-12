import { futureShape } from '../futureShapes';

// Each working building takes its own massing. The eras after Riverlight share one set of
// archetypes, and a bank, a school and a sheriff's office used to be the same hall with a
// different sign. Here every identity (`cityBuildingStyles.json`) arranges the kit's own
// blocks and towers differently, so the architecture stays the era's and the outline
// becomes the building's. An identity without an entry keeps its family's plain form.

// A flat shelter on slender posts, in front of a block.
function canopy(d, g, s, { x = 0, z = 0.6, w, dep = 0.9, y = 1.7, color }) {
  const p = s.palette;
  for (const side of [-1, 1])
    d.rod(
      g,
      [x + side * (w / 2 - 0.1), 0, z + dep / 2 - 0.12],
      [x + side * (w / 2 - 0.1), y, z + dep / 2 - 0.12],
      0.05,
      p.deep,
    );
  d.box(g, w, 0.08, dep, x, y + 0.02, z, color ?? p.roof);
}
// A thin round shaft with the kit's cap: a chimney, a bell tower or a hose tower.
function shaft(d, g, s, { x, z, r, h, cap = r }) {
  const top = s.kit.round(d, g, s, { x, z, r, h });
  return s.kit.cap(d, g, s, { x, z, r: cap, y: top, accent: true });
}
// Two market stalls leave a real central route to the door.
function stalls(d, g, s, w, z = 1.05) {
  for (const side of [-1, 1]) {
    const width = Math.max(0.55, (w * 0.7 - 0.9) / 2);
    const x = side * (0.45 + width / 2);
    d.box(g, width, 0.42, 0.34, x, 0.36, z, s.palette.timber);
    d.box(g, width + 0.04, 0.06, 0.4, x, 0.6, z, s.palette.shell);
  }
}
function crates(d, g, s, x, z) {
  const p = s.palette;
  d.box(g, 0.46, 0.46, 0.46, x, 0.23, z, p.timber);
  d.box(g, 0.36, 0.36, 0.36, x + 0.42, 0.18, z + 0.1, p.timber);
  d.box(g, 0.34, 0.34, 0.34, x + 0.06, 0.63, z, p.light);
}

export function purposeForms(house, tower) {
  const HALL = {
    // The bank: a broad low hall behind a columned portico.
    columns(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { w: 3.3, dep: 2.1, h: 2.5, z: -0.55 });
      for (const x of [-1.05, -0.38, 0.38, 1.05])
        d.mesh(g, 'cylinder', [0.1, 1.95, 0.1], [x, 0.975, 1.02], p.shell);
      d.box(g, 2.6, 0.2, 0.62, 0, 2.05, 0.82, p.light);
      d.mesh(g, futureShape(d, 'gable'), [2.6, 0.5, 0.62], [0, 2.15, 0.82], p.roof);
      return crown;
    },
    // City hall: a tall centre standing forward of one long lower range, and the clock tower behind.
    clock(d, g, s) {
      const crown = house(d, g, s, { w: 1.7, dep: 2.3, h: 3.2, accent: true });
      house(d, g, s, { z: -0.65, w: 3.9, dep: 1.5, h: 1.9, door: false });
      shaft(d, g, s, { x: 0, z: -1.15, r: 0.42, h: crown.top + 0.8 });
      return crown;
    },
    // The doctor's office: a main house with a low ward to one side.
    clinic(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { x: -0.5, w: 2.2, dep: 2.2, h: 2.3 });
      house(d, g, s, { x: 1.25, z: -0.15, w: 1.25, dep: 1.6, h: 1.5, accent: true, door: false });
      d.box(g, 0.12, 0.44, 0.06, 1.25, 1.02, 0.7, p.flower);
      d.box(g, 0.44, 0.12, 0.06, 1.25, 1.02, 0.7, p.flower);
      return crown;
    },
    // The school: one long low classroom range and a bell tower at its end.
    bell(d, g, s) {
      const crown = house(d, g, s, { x: -0.3, w: 3.1, dep: 1.8, h: 1.8, z: -0.5 });
      shaft(d, g, s, { x: 1.55, z: -0.35, r: 0.44, h: 3.5 });
      return crown;
    },
    // The sheriff: a square keep with a round watch tower on the corner.
    patrol(d, g, s) {
      const crown = house(d, g, s, { x: 0.3, w: 2.5, dep: 2.3, h: 2.7 });
      shaft(d, g, s, { x: -1.3, z: 0.25, r: 0.46, h: 3.9, cap: 0.56 });
      return crown;
    },
    // The post office: a counter hall, a sorting room and the signal tower behind.
    post(d, g, s) {
      const crown = house(d, g, s, { x: -0.45, w: 2.4, dep: 2.2, h: 2.2 });
      house(d, g, s, { x: 1.3, z: -0.55, w: 1.1, dep: 1.5, h: 1.4, door: false });
      shaft(d, g, s, { x: -0.45, z: -1.1, r: 0.4, h: crown.top + 0.7 });
      crates(d, g, s, 1.15, 0.75);
      return crown;
    },
  };
  const SHOP = {
    // The Golden Hour: two storeys with a balcony over the door.
    terrace(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { w: 3, dep: 2.2, h: 3, accent: true });
      d.box(g, 3.1, 0.09, 0.62, 0, 1.78, 1.02, p.timber);
      for (const x of [-1.45, 1.45]) d.rod(g, [x, 0, 1.25], [x, 1.78, 1.25], 0.05, p.deep);
      for (let x = -1.45; x <= 1.46; x += 0.58)
        d.rod(g, [x, 1.8, 1.3], [x, 2.2, 1.3], 0.025, p.deep);
      d.rod(g, [-1.5, 2.2, 1.3], [1.5, 2.2, 1.3], 0.035, p.deep);
      const medallion = d.mesh(
        g,
        'cylinder',
        [0.3, 0.1, 0.3],
        [0, crown.eave - 0.3, 0.82],
        p.light,
      );
      medallion.rotation.x = Math.PI / 2;
      medallion.name = 'Golden Hour saloon medallion';
      return crown;
    },
    // The diner: a long low dining car with a round end.
    diner(d, g, s) {
      const crown = house(d, g, s, { x: 0.45, w: 2.9, dep: 1.7, h: 1.7, z: -0.5, accent: true });
      tower(d, g, s, { x: -1.4, z: -0.5, r: 0.85, h: 1.7, door: false });
      canopy(d, g, s, { x: 0.45, z: 0.8, w: 2.6, dep: 0.8, y: 1.5, color: s.palette.flower });
      return crown;
    },
    // The trading post: a tall narrow shopfront.
    shop(d, g, s) {
      const crown = house(d, g, s, { w: 2.4, dep: 2.1, h: 2.7, accent: true });
      stalls(d, g, s, 2.6);
      return crown;
    },
    // The market: two little kiosks and an open hall between them.
    market(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { x: -1.3, z: -0.7, w: 1.2, dep: 1.6, h: 1.9, accent: true });
      house(d, g, s, { x: 1.3, z: -0.7, w: 1.2, dep: 1.6, h: 1.9, accent: true, door: false });
      for (const x of [-1.85, 1.85]) d.rod(g, [x, 0, 1.05], [x, 1.85, 1.05], 0.05, p.deep);
      d.box(g, 3.95, 0.09, 2.3, 0, 1.9, -0.05, p.flower);
      stalls(d, g, s, 3.6, 0.55);
      return crown;
    },
    // The food hall: one big shed with a low delivery room.
    supermarket(d, g, s) {
      const crown = house(d, g, s, { x: -0.4, w: 3, dep: 2.5, h: 2.1, accent: true });
      house(d, g, s, { x: 1.55, z: -0.7, w: 0.95, dep: 1.6, h: 1.4, door: false });
      canopy(d, g, s, { x: -0.4, z: 1.25, w: 2.8, dep: 0.7, y: 1.55, color: s.palette.flower });
      return crown;
    },
  };
  const WORKSHOP = {
    // The armory and freight store: a strong room with a lean-to and stacked crates.
    freight(d, g, s) {
      const crown = house(d, g, s, { x: -0.45, w: 2.5, dep: 2.4, h: 2.4 });
      house(d, g, s, { x: 1.3, z: -0.55, w: 1.05, dep: 1.6, h: 1.4, door: false });
      crates(d, g, s, 1.1, 0.75);
      return crown;
    },
    // The warehouse: two long sheds side by side.
    warehouse(d, g, s) {
      const crown = house(d, g, s, { x: -0.92, w: 1.75, dep: 2.5, h: 2.2 });
      house(d, g, s, { x: 0.92, w: 1.75, dep: 2.5, h: 2.2, accent: true, door: false });
      crates(d, g, s, 0.75, 1.15);
      return crown;
    },
    // The smithy: a small shop, a tall chimney and an open forge shelter.
    forge(d, g, s) {
      const crown = house(d, g, s, { x: -0.4, w: 2.4, dep: 2.2, h: 2 });
      shaft(d, g, s, { x: -1.1, z: -1.1, r: 0.34, h: crown.top + 1 });
      canopy(d, g, s, { x: 1.45, z: -0.2, w: 1.2, dep: 1.5, y: 1.45 });
      d.box(g, 0.5, 0.42, 0.34, 1.45, 0.21, -0.3, s.palette.deep);
      return crown;
    },
    // The fire station: an engine bay beside a tall hose tower.
    fire(d, g, s) {
      const crown = house(d, g, s, { x: 0.45, w: 2.6, dep: 2.3, h: 2.2 });
      tower(d, g, s, { x: -1.35, z: -0.45, r: 0.52, h: 3.7, accent: true, door: false });
      return crown;
    },
    // The mill: a tall narrow mill house and its silo.
    mill(d, g, s) {
      const crown = house(d, g, s, { x: 0.5, w: 2.2, dep: 2.2, h: 3.2 });
      tower(d, g, s, { x: -1.2, z: -0.6, r: 0.66, h: 2.5, accent: true, door: false });
      return crown;
    },
    // The stables: one long low range with hay stacked at the end.
    stable(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { w: 3.5, dep: 2.2, h: 1.7 });
      for (const [x, y] of [
        [-1.5, 0.2],
        [-1.05, 0.2],
        [-1.28, 0.58],
      ])
        d.box(g, 0.42, 0.38, 0.6, x, y, 1.15, p.light);
      return crown;
    },
    // The garage: a low wide bay and a taller office beside it.
    garage(d, g, s) {
      const crown = house(d, g, s, { x: 0.5, w: 2.7, dep: 2.4, h: 1.7 });
      house(d, g, s, { x: -1.4, z: -0.35, w: 1, dep: 1.6, h: 2.6, accent: true, door: false });
      return crown;
    },
  };
  const STATION = {
    // The bus station: a small ticket hall under a wide shelter.
    bus(d, g, s) {
      const crown = house(d, g, s, { w: 2.5, dep: 1.6, h: 1.9, z: -0.85 });
      canopy(d, g, s, { z: 0.45, w: 4, dep: 1.5, y: 1.75 });
      return crown;
    },
    // The interchange: a tall concourse with a round stair tower.
    transit(d, g, s) {
      const crown = house(d, g, s, { x: 0.5, w: 2.7, dep: 1.8, h: 2.7, z: -0.7 });
      tower(d, g, s, { x: -1.45, z: -0.7, r: 0.7, h: 3.3, accent: true, door: false });
      canopy(d, g, s, { x: 0.5, z: 0.6, w: 2.7, dep: 0.9, y: 1.7 });
      return crown;
    },
    // The maglev loop: a low hall under a raised guideway carrying a pod.
    maglev(d, g, s) {
      const p = s.palette;
      const crown = house(d, g, s, { w: 3, dep: 1.7, h: 1.9, z: -0.8 });
      for (const x of [-1.95, 1.95]) {
        d.rod(g, [x, 0, 0.65], [x, 2.75, 0.65], 0.08, p.deep);
        d.box(g, 0.5, 0.1, 0.9, x, 2.78, 0.65, p.deep);
      }
      d.box(g, 4.3, 0.12, 0.5, 0, 2.86, 0.65, p.shell);
      d.ball(g, 0.5, 3.12, 0.65, [0.7, 0.24, 0.3], p.light);
      return crown;
    },
  };
  const CULTURE = {
    // The library: a tall book tower of a house with a low reading room.
    reading(d, g, s) {
      const crown = house(d, g, s, { x: 0.5, w: 2.1, dep: 2.2, h: 2.9 });
      house(d, g, s, { x: -1.15, z: 0.05, w: 1.2, dep: 1.5, h: 1.4, accent: true, door: false });
      return crown;
    },
  };
  /** The identity's own massing, or `fallback` for an identity this file does not know. */
  const pick = (table, fallback) => (d, g, s) =>
    (Object.hasOwn(table, s.identity) ? table[s.identity] : fallback)(d, g, s);
  return { HALL, SHOP, WORKSHOP, STATION, CULTURE, pick, stalls };
}
/** Every identity that has a massing of its own, for the regression check. */
export const PURPOSE_MASSINGS = Object.freeze([
  ...['columns', 'clock', 'clinic', 'bell', 'patrol', 'post'],
  ...['terrace', 'diner', 'shop', 'market', 'supermarket'],
  ...['freight', 'warehouse', 'forge', 'fire', 'mill', 'stable', 'garage'],
  ...['bus', 'transit', 'maglev', 'reading'],
]);

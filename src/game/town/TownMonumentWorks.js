import { Box3, Group, Vector3 } from 'three';
import { buildLandmark } from './TownLandmarks';
import { ERAS } from '../../data/eras';
import { LANDMARK_BY_ID } from '../../data/townLandmarks';

// A monument level under construction, as the town shows it between puzzles. The
// first level rises from its foundation; later levels keep the standing monument
// inside growing scaffolding. A ready level stands complete, still wrapped, with
// bunting and a ribbon waiting for the player to unveil it.
const TIMBER = { post: '#9a754c', ledger: '#9e794c', plank: '#c2a16b', brace: '#a8835a' };
const STEEL = { post: '#7f8b94', ledger: '#a5adb3', plank: '#c2a16b', brace: '#8f9aa3' };
const BUNTING = ['#d9734f', '#e8bf79', '#52948e', '#f4ead5'];
const eraIndex = (id) => ERAS.findIndex((era) => era.id === id);
// Timber scaffolding until the industrial era brings steel tubes.
const palette = (era) => (eraIndex(era) >= eraIndex('industrial') ? STEEL : TIMBER);

// The raised structure of a monument model (everything above its stone court), in
// the model's own coordinates. Scaffolding and cameras frame what is being built.
function monumentExtent(model) {
  const probe = model.parent;
  probe?.updateMatrixWorld(true);
  const box = new Box3(),
    part = new Box3();
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    part.setFromObject(mesh);
    if ((part.min.y + part.max.y) / 2 > 1) box.union(part);
  });
  return box.isEmpty() ? new Box3(new Vector3(-2, 0, -2), new Vector3(2, 4, 2)) : box;
}
// A still copy of the finished level, built away from the town so it can be measured.
export function monumentModel(d, choice, level, timeless) {
  const probe = new Group();
  const model = buildLandmark(d, probe, choice, level, timeless, true);
  return { model, extent: monumentExtent(model) };
}

// Posts, ledgers, planks and braces on all four sides, with a ladder at the front.
export function addMonumentScaffold(d, parent, extent, top, era) {
  const s = d.group(parent);
  s.name = 'Monument scaffolding';
  const c = palette(era);
  const x0 = extent.min.x - 0.7,
    x1 = extent.max.x + 0.7,
    z0 = extent.min.z - 0.7,
    z1 = extent.max.z + 0.7;
  const levels = Math.max(1, Math.round(top / 1.7)),
    lift = top / levels;
  const sides = [
    [x0, z1, x1, z1],
    [x1, z1, x1, z0],
    [x1, z0, x0, z0],
    [x0, z0, x0, z1],
  ];
  for (const [ax, az, bx, bz] of sides) {
    const length = Math.hypot(bx - ax, bz - az),
      along = ax !== bx;
    const posts = Math.max(2, Math.ceil(length / 2.2) + 1);
    // Each side owns its first corner, so no post is drawn twice.
    for (let n = 0; n < posts - 1; n++) {
      const t = n / (posts - 1);
      d.box(s, 0.1, top, 0.1, ax + (bx - ax) * t, top / 2, az + (bz - az) * t, c.post);
    }
    const mx = (ax + bx) / 2,
      mz = (az + bz) / 2;
    for (let k = 1; k <= levels; k++) {
      const y = k * lift;
      d.rod(s, [ax, y, az], [bx, y, bz], 0.04, c.ledger);
      d.box(s, along ? length : 0.45, 0.07, along ? 0.45 : length, mx, y - 0.06, mz, c.plank);
      d.rod(s, [ax, y - lift, az], [bx, y, bz], 0.03, c.brace);
    }
  }
  for (const x of [x1 - 0.2, x1 + 0.2])
    d.rod(s, [x, 0, z1 + 0.5], [x, top, z1 + 0.2], 0.035, c.ledger);
  for (let y = 0.4; y < top; y += 0.5)
    d.rod(
      s,
      [x1 - 0.2, y, z1 + 0.5 - (y / top) * 0.3],
      [x1 + 0.2, y, z1 + 0.5 - (y / top) * 0.3],
      0.025,
      c.plank,
    );
  return s;
}

// Flags along the top of the scaffolding and a ribbon across the court entrance.
export function addUnveilingDressing(d, parent, extent, top, radius) {
  const bunting = d.group(parent);
  bunting.name = 'Monument bunting';
  const x0 = extent.min.x - 0.7,
    x1 = extent.max.x + 0.7,
    z0 = extent.min.z - 0.7,
    z1 = extent.max.z + 0.7;
  let flag = 0;
  for (const [ax, az, bx, bz] of [
    [x0, z1, x1, z1],
    [x1, z1, x1, z0],
    [x1, z0, x0, z0],
    [x0, z0, x0, z1],
  ]) {
    const y = top + 0.15,
      length = Math.hypot(bx - ax, bz - az);
    d.rod(bunting, [ax, y, az], [bx, y, bz], 0.02, '#f4ead5');
    const count = Math.max(2, Math.round(length / 0.9));
    for (let n = 0; n < count; n++) {
      const t = (n + 0.5) / count;
      const pennant = d.mesh(
        bunting,
        'cone',
        [0.18, 0.42, 0.04],
        [ax + (bx - ax) * t, y - 0.24, az + (bz - az) * t],
        BUNTING[flag++ % BUNTING.length],
      );
      pennant.rotation.x = Math.PI;
      pennant.rotation.y = Math.atan2(bx - ax, bz - az) + Math.PI / 2;
    }
  }
  // The ribbon closes the front of the court until the unveiling.
  const ribbon = d.group(parent, 0, 0, radius * 0.8);
  ribbon.name = 'Monument opening ribbon';
  for (const x of [-2.3, 2.3]) {
    d.rod(ribbon, [x, 0, 0], [x, 1.25, 0], 0.06, '#e8bf79');
    d.ball(ribbon, x, 1.28, 0, 0.1, '#e8bf79');
  }
  const halves = [-1, 1].map((side) => {
    const half = d.group(ribbon, side * 2.3, 1.05, 0);
    d.box(half, 2.3, 0.14, 0.03, -side * 1.15, 0, 0, '#c8483f');
    return half;
  });
  const bow = d.group(ribbon, 0, 1.05, 0.03);
  d.ball(bow, 0, 0, 0, [0.22, 0.16, 0.07], '#c8483f');
  return { bunting, ribbon, halves, bow };
}

// Timber stacks, cut stone and a sand heap around the edge of the court. Fewer
// remain as the work goes on.
function addMaterials(d, parent, radius, left) {
  const r = radius * 0.86;
  const spots = [140, 220, 75, 285].slice(0, left);
  for (const [n, degrees] of spots.entries()) {
    const a = (degrees * Math.PI) / 180;
    const pile = d.group(parent, Math.sin(a) * r, 0, Math.cos(a) * r);
    pile.rotation.y = a;
    pile.name = 'Monument building materials';
    if (n % 2 === 0)
      for (let k = 0; k < 3; k++)
        d.box(pile, 1.9, 0.18, 0.7, 0, 0.1 + k * 0.19, 0, k % 2 ? '#b08657' : '#c29a69');
    else {
      for (const [x, y, z] of [
        [-0.4, 0.22, 0],
        [0.32, 0.22, 0.1],
        [-0.05, 0.62, 0.05],
      ])
        d.box(pile, 0.62, 0.42, 0.5, x, y, z, '#cfc3a6');
      d.mesh(pile, 'cone', [0.55, 0.5, 0.55], [0.9, 0.25, -0.3], '#d8c49a');
    }
  }
}
// A working crane beside the site whose jib reaches over the structure.
function addCrane(d, parent, radius, top, era) {
  const c = palette(era);
  const height = top + 2.6;
  const crane = d.group(parent, -radius * 0.78, 0, -radius * 0.5);
  crane.name = 'Monument crane';
  crane.rotation.y = Math.atan2(radius * 0.78, radius * 0.5);
  d.box(crane, 0.5, 0.3, 0.5, 0, 0.15, 0, '#8a8478');
  for (const [x, z] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [0.18, 0.18],
    [-0.18, 0.18],
  ])
    d.rod(crane, [x, 0.3, z], [x, height, z], 0.04, c.post);
  for (let y = 1; y < height; y += 1.2)
    d.rod(crane, [-0.18, y, -0.18], [0.18, y + 1.2, 0.18], 0.025, c.brace);
  d.box(crane, 0.3, 0.3, 7, 0, height + 0.15, 2.4, c.ledger);
  d.box(crane, 0.75, 0.6, 0.8, 0, height - 0.15, -1.3, '#8a8478');
  d.rod(crane, [0, height, 5.4], [0, top * 0.55, 5.4], 0.015, '#3d3a35');
  d.box(crane, 0.5, 0.3, 0.3, 0, top * 0.55 - 0.15, 5.4, c.plank);
  return crane;
}

function removeAbove(model, height) {
  model.parent?.updateMatrixWorld(true);
  const box = new Box3(),
    above = [];
  model.traverse((mesh) => {
    if (!mesh.isMesh) return;
    box.setFromObject(mesh);
    if ((box.min.y + box.max.y) / 2 > height) above.push(mesh);
  });
  for (const mesh of above) mesh.removeFromParent();
}

// Each completed puzzle shows a new step: the first level rises from its foundation;
// later levels grow scaffolding and bring the crane around the standing monument.
export function buildMonumentWorks(d, parent, choice, work, area, era) {
  const g = d.group(parent);
  g.name = `${LANDMARK_BY_ID[choice].label} under construction`;
  const { model, extent } = monumentModel(d, choice, work.level, area.timeless);
  const height = extent.max.y,
    progress = work.wins / work.required;
  let top = height * (0.5 + 0.5 * progress) + 0.8;
  if (work.ready) top = height + 0.8;
  else if (work.level === 1 || area.timeless) {
    // Foundation first, then the structure in courses under its scaffolding.
    const course = work.wins ? (0.1 + progress * 0.95) * height : 0.9;
    removeAbove(model, course);
    top = work.wins ? Math.min(height + 0.8, course + 1.2) : 0;
  }
  if (work.ready || work.level === 1 || area.timeless) g.add(model);
  else {
    d.clearGroup(model.parent);
    buildLandmark(d, g, choice, work.level - 1, area.timeless, true);
  }
  if (top) addMonumentScaffold(d, g, extent, top, era);
  if (work.ready) addUnveilingDressing(d, g, extent, top, area.radius);
  else {
    addMaterials(d, g, area.radius, 4 - Math.round(progress * 2));
    if (work.wins) addCrane(d, g, area.radius, Math.max(top, height * 0.6), era);
  }
  return g;
}

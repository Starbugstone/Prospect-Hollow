import { BufferGeometry, CylinderGeometry, Float32BufferAttribute, RingGeometry } from 'three';
import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { heritageUpgrade } from '../../../data/heritageUpgrades';
import { MOON_PAD_TOP, MOON_PARCEL_SIDES } from '../../../data/moonSettlement';
import { futureShape } from './futureShapes';

// The lunar kit every New Hollow building is drawn from: moon-white ceramic drums under
// glass domes, steel ribs, round airlocks, gold foil and solar fins. Geometry comes from
// the shared primitives and cached future shapes.

function vaultFrameShape(d, key, sections) {
  if (d.geometries[key]) return key;
  const points = sections.flat(),
    faces = [];
  for (let n = 0; n < sections.length - 1; n++)
    for (let side = 0; side < 4; side++) {
      const a = n * 4 + side,
        b = n * 4 + ((side + 1) % 4);
      faces.push(a, a + 4, b, b, a + 4, b + 4);
    }
  const end = (sections.length - 1) * 4;
  faces.push(0, 1, 2, 0, 2, 3, end, end + 2, end + 1, end, end + 3, end + 2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
  geometry.setAttribute(
    'uv',
    new Float32BufferAttribute(
      points.flatMap(([x, y]) => [x, y]),
      2,
    ),
  );
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  d.geometries[key] = geometry;
  return key;
}
const VAULT_RISE = Math.sqrt(0.75);
/** A unit half hoop standing across a vault: the steel arch of every glazed vault and net. */
export function vaultArch(d) {
  const sections = Array.from({ length: 9 }, (_, n) => {
    const a = (n / 8) * Math.PI;
    return [
      [-0.5, 0.97],
      [0.5, 0.97],
      [0.5, 1.03],
      [-0.5, 1.03],
    ].map(([side, radius]) => [side, Math.sin(a) * radius, Math.cos(a) * radius]);
  });
  return vaultFrameShape(d, 'moon-vault-arch', sections);
}
/**
 * The steel frame of a glazed vault along x: two bearing arches and a sealed ridge. `half` is
 * the vault's half width, `height` its rise and `base` the height its glass starts at.
 */
export function vaultFrame(d, g, x, z, length, { half = 0.9, height = 0.95, base = 0.55 } = {}) {
  const frame = d.group(g);
  frame.name = 'Sealed greenhouse vault frame';
  const arch = vaultArch(d),
    rise = VAULT_RISE;
  for (const side of [-1, 1])
    d.mesh(
      frame,
      arch,
      [0.055, height * rise, half * rise],
      [x + (side * length) / 4, base, z],
      p.roof,
    ).name = 'Greenhouse bearing arch';
  const ridge = vaultFrameShape(
    d,
    'moon-vault-ridge',
    [-0.5, 0, 0.5].map((px) => {
      const y = px ? rise : 1;
      return [
        [px, y - 0.025, -0.5],
        [px, y - 0.025, 0.5],
        [px, y + 0.025, 0.5],
        [px, y + 0.025, -0.5],
      ];
    }),
  );
  d.mesh(frame, ridge, [length / 2, height, 0.045], [x, base, z], p.roof).name =
    'Greenhouse sealed ridge';
}

export function habitatGlass(d, mesh) {
  const key = 'moon-habitat-glass';
  if (!d.materials.has(key)) {
    const material = d.material(p.glass).clone();
    material.transparent = true;
    material.opacity = 0.38;
    material.roughness = 0.32;
    material.depthWrite = false;
    d.materials.set(key, material);
  }
  mesh.material = d.materials.get(key);
  mesh.renderOrder = 10;
  // Opaque ribs provide the habitat shadow; the clear shell must not hide its garden in shade.
  mesh.castShadow = false;
  mesh.name = 'Sealed lunar habitat glazing';
  return mesh;
}
export function purposeModule(d, g, kind, x, z, w, dep, h) {
  // The nursery shares the dome's steel-blue trim, avoiding a ninth material
  // beside its cached clear shell and the seven opaque habitat colours.
  const root = module(
    d,
    g,
    x,
    z,
    w,
    dep,
    h,
    0,
    heritageUpgrade(kind) === 'garden' ? p.roof : p.glass,
  );
  root.name = `Lunar purpose module ${heritageUpgrade(kind)}`;
  root.userData.upgradeFeature = heritageUpgrade(kind);
  return root;
}

/**
 * The pad every Moon parcel stands on: building lots, empty lots and monument sites.
 * renderMoonBuilding and the monument sites draw it, so no building form can change it.
 */
export function moonParcelPad(d, g, r, { flush = false } = {}) {
  d.geometries['moon-parcel'] ??= new CylinderGeometry(1, 1, 1, MOON_PARCEL_SIDES);
  // Monuments build from the ground, so their parcel is a flush plate of the same shape.
  // A raised pad's rim and deck reach MOON_PAD_TOP, where its building and walkers stand.
  const [rim, top] = flush ? [0.03, 0.02] : [MOON_PAD_TOP - 0.08, 0.08];
  const base = d.mesh(g, 'moon-parcel', [r, rim, r], [0, rim / 2, 0], p.deep);
  base.name = 'Moon parcel pad';
  base.userData.parcelPad = { radius: r, sides: MOON_PARCEL_SIDES };
  d.mesh(g, 'moon-parcel', [r - 0.25, top, r - 0.25], [0, rim + top / 2, 0], p.shell);
  return base;
}
export function airlock(d, g, x, y, z, turn = 0, scale = 1) {
  const door = d.group(g, x, y, z);
  door.rotation.y = turn;
  door.scale.setScalar(scale);
  d.mesh(door, futureShape(d, 'octagon'), [0.42, 0.1, 0.42], [0, 0, 0], p.deep).rotation.x =
    Math.PI / 2;
  d.mesh(door, futureShape(d, 'octagon'), [0.5, 0.06, 0.5], [0, 0, -0.03], p.light).rotation.x =
    Math.PI / 2;
}
/** A flat gold ring of outer radius `r`: a rim is a ring, not a gold floor under clear glass. */
export function habitatRim(d, g, x, y, z, r) {
  d.geometries['moon-habitat-rim'] ??= new RingGeometry(0.95, 1, 24);
  const rim = d.mesh(g, 'moon-habitat-rim', [r, r, 1], [x, y, z], p.light);
  rim.rotation.x = -Math.PI / 2;
  rim.name = 'Lunar habitat gold rim';
  return rim;
}
/** A ceramic drum under a ribbed glass dome; returns the dome's top. */
export function dome(d, g, x, z, r, h = 0.9, glass = true) {
  d.mesh(g, 'cylinder', [r, h, r], [x, 0.25 + h / 2, z], p.shell);
  habitatRim(d, g, x, 0.256 + h, z, r + 0.04);
  const shell = d.mesh(
    g,
    futureShape(d, 'dome'),
    [r * 0.97, r * 0.85, r * 0.97],
    [x, 0.25 + h, z],
    glass ? p.glass : p.shell,
  );
  if (glass) habitatGlass(d, shell);
  for (const turn of [0, Math.PI / 2]) {
    let last = null;
    for (let n = 0; n <= 6; n++) {
      const a = (n / 6) * Math.PI;
      const point = [
        x + Math.cos(a) * r * Math.cos(turn),
        0.25 + h + Math.sin(a) * r * 0.86,
        z + Math.cos(a) * r * Math.sin(turn),
      ];
      if (last) d.rod(g, last, point, 0.035, p.roof);
      last = point;
    }
  }
  airlock(d, g, x, 0.65, z + r + 0.02);
  return 0.25 + h + r * 0.85;
}
/** A white ceramic module with a gold band and a window strip. */
export function module(d, g, x, z, w, dep, h, turn = 0, windowColor = p.glass) {
  const m = d.group(g, x, 0, z);
  m.rotation.y = turn;
  d.box(m, w, h, dep, 0, 0.25 + h / 2, 0, p.shell, true);
  d.box(m, w + 0.04, 0.08, dep + 0.04, 0, 0.45, 0, p.light);
  d.box(m, w * 0.7, 0.26, 0.05, 0, 0.25 + h * 0.8, dep / 2 + 0.01, windowColor);
  const hatchScale = Math.min(1, h);
  airlock(d, m, 0, 0.25 + hatchScale / 2, dep / 2 + 0.03, 0, hatchScale);
  return m;
}
export function solarFin(d, g, x, z, turn = 0) {
  d.rod(g, [x, 0.2, z], [x, 1.3, z], 0.04, p.deep);
  const fin = d.box(g, 1.1, 0.05, 0.55, x, 1.3, z, p.roof);
  fin.rotation.set(-0.5, turn, 0);
}
export function lamp(d, g, x, z, y = 0) {
  d.rod(g, [x, y, z], [x, y + 1.1, z], 0.035, p.deep);
  d.ball(g, x, y + 1.16, z, [0.11, 0.14, 0.11], p.light, 'rock');
}
export function gable(d, g, x, z, w, dep, h, roof = p.roof) {
  d.box(g, w, h, dep, x, 0.25 + h / 2, z, p.shell);
  d.mesh(g, futureShape(d, 'gable'), [w + 0.3, w * 0.32, dep + 0.25], [x, 0.25 + h, z], roof);
  d.rod(
    g,
    [x, 0.27 + h + w * 0.32, z - dep / 2 - 0.12],
    [x, 0.27 + h + w * 0.32, z + dep / 2 + 0.12],
    0.03,
    p.light,
  );
  airlock(d, g, x, 0.65, z + dep / 2 + 0.02);
}
/** New Hollow's rover, facing +z like the valley's vehicles and shared walk poses. */
export function moonRover(d, g, x = 0, z = 0, turn = 0) {
  const r = d.group(g, x, 0, z);
  r.rotation.y = turn;
  d.box(r, 0.65, 0.35, 1.1, 0, 0.5, 0, p.shell, true);
  d.box(r, 0.55, 0.25, 0.45, 0, 0.78, 0.15, p.glass).name = 'Rover cabin';
  for (const dx of [-0.36, 0.36])
    for (const dz of [-0.38, 0.38]) {
      const wheel = d.mesh(r, 'cylinder', [0.17, 0.1, 0.17], [dx, 0.2, dz], p.deep);
      wheel.rotation.z = Math.PI / 2;
      wheel.name = 'Rover wheel';
    }
  d.rod(r, [0.2, 0.68, -0.4], [0.2, 1.2, -0.4], 0.02, p.deep);
  d.ball(r, 0.2, 1.24, -0.4, 0.05, p.flower, 'rock');
  return r;
}
export function willowkinTree(d, g, x, y, z, scale = 1) {
  d.rod(g, [x, y, z], [x, y + 1.1 * scale, z], 0.09 * scale, p.timber);
  for (const [dx, dy, dz, r] of [
    [0, 1.45, 0, 0.55],
    [-0.35, 1.2, 0.15, 0.38],
    [0.35, 1.25, -0.1, 0.4],
  ])
    d.ball(
      g,
      x + dx * scale,
      y + dy * scale,
      z + dz * scale,
      [r * scale, r * 0.85 * scale, r * scale],
      p.green,
      futureShape(d, 'leafy'),
    );
  d.ball(g, x + 0.15 * scale, y + 1.55 * scale, z + 0.4 * scale, 0.08 * scale, p.flower, 'rock');
}

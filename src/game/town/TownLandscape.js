import { addMineExcavation } from './TownMineShaft';
import * as THREE from 'three';
import { MINE_FACE_COLUMNS, MINE_HILLSIDE, mineHillsideHeight } from './TownMineHillside';
import { MILLRACE, millraceDistance, millraceHeight, landscapeGeometry } from './TownMillrace';
import { TOWN_TRACKS, PLOTS, RAIL_EDGE, segmentDistance } from './TownLayout';
import { RIVER, riverDistance, wetBank, buildRiver } from './TownRiver';

const smooth = (a, b, value) => {
  const t = THREE.MathUtils.clamp((value - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const random = (n) => {
  const value = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
function noise(x, z) {
  const ix = Math.floor(x),
    iz = Math.floor(z);
  const tx = smooth(0, 1, x - ix),
    tz = smooth(0, 1, z - iz);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(random(ix + iz * 157), random(ix + 1 + iz * 157), tx),
    THREE.MathUtils.lerp(random(ix + (iz + 1) * 157), random(ix + 1 + (iz + 1) * 157), tx),
    tz,
  );
}

// A level clearing for foundations blends into rolling prairie in every direction.
export function groundHeight(x, z) {
  const distance = Math.hypot(x, z);
  const hills =
    1.8 +
    noise(x * 0.048, z * 0.048) * 6.5 +
    Math.sin(x * 0.065 + z * 0.027) * 1.9 +
    noise(x * 0.14, z * 0.14) * 0.7;
  const ridges = [
    [-38, -42, 11],
    [32, -45, 14],
    [55, 4, 12],
    [-45, 28, 9],
    [5, 58, 11],
  ].reduce(
    (height, [hx, hz, rise]) => height + rise * Math.exp(-((x - hx) ** 2 + (z - hz) ** 2) / 440),
    0,
  );
  const eastClearing = Math.hypot(Math.max(37 - x, 0, x - 62), Math.max(-17 - z, 0, z - 33));
  const westClearing = Math.hypot(Math.max(-59 - x, 0, x + 28), Math.max(-18 - z, 0, z - 26));
  // Low rolling hills leave room for orbiting and a north/south flight corridor.
  const flightCorridor = smooth(4, 13, Math.abs(x + 53));
  const prairie =
    smooth(34, 49, distance) *
    smooth(0, 7, eastClearing) *
    smooth(0, 7, westClearing) *
    (hills + ridges) *
    0.24 *
    flightCorridor;
  // A local mountain shoulder rises north of the mine. The existing railway
  // cutting below keeps the full train corridor open in every era.
  const mineRidge =
    (1 - smooth(8, 23, Math.abs(x + 1))) *
    smooth(25, 30, -z) *
    (1 - smooth(37, 52, -z)) *
    (8 + noise(x * 0.19, z * 0.18) * 5);
  const bank = riverDistance(x, z);
  // Lower the surrounding hills gradually so the shallow bank never becomes a cliff.
  const valley = Math.max(prairie, mineRidge) * smooth(RIVER.bankWidth, RIVER.bankWidth + 18, bank);
  const surface = THREE.MathUtils.lerp(
    -1.25,
    valley,
    smooth(RIVER.halfWidth - 0.4, RIVER.bankWidth, bank),
  );
  // A graded railway cutting clears the entire train, not just the engine's center.
  // Preserve the river bed below the bridge instead of filling the water with an embankment.
  const cutting = 1 - smooth(1.6, 6, Math.abs(z - RAIL_EDGE.from[1]));
  return Math.min(
    THREE.MathUtils.lerp(surface, Math.min(surface, 0), cutting),
    millraceHeight(x, z, RIVER.waterHeight),
  );
}
// The shoulder replaces this patch of the old heightfield. Recess the hidden
// base slightly so differently tessellated surfaces cannot flicker through it.
export function landscapeGroundHeight(x, z) {
  const base = groundHeight(x, z);
  const depth = PLOTS.mine[1] + MINE_HILLSIDE.frontOffset - z;
  if (
    depth <= -0.25 ||
    depth >= 11.4 ||
    Math.abs(z - RAIL_EDGE.from[1]) <= MINE_HILLSIDE.tunnelHalfWidth
  )
    return base;
  const edge = 20 - Math.abs(x);
  const inset = smooth(-0.25, 0.6, depth) * smooth(0, 0.6, 11.4 - depth) * smooth(0, 0.6, edge);
  return base - inset * 0.8;
}

const reservedGround = (x, z) =>
  (z < PLOTS.mine[1] && z > PLOTS.mine[1] - 13 && Math.abs(x) < 12) ||
  millraceDistance(x, z) < MILLRACE.bankWidth + 0.4 ||
  (x > -63 && x < -28 && z > -20 && z < 28) ||
  Math.abs(x + 53) < 6 ||
  (Math.abs(x) < 4.7 && z > PLOTS.mine[1] + 2 && z < -8) ||
  Object.values(PLOTS).some(([px, pz]) => Math.hypot(x - px, z - pz) < 4.5) ||
  segmentDistance(x, z, RAIL_EDGE.from, RAIL_EDGE.to) < 2;

function trackDistance(x, z) {
  const streets = Math.min(
    ...TOWN_TRACKS.filter(({ plot }) => !plot).map(
      ({ from, to, width }) => segmentDistance(x, z, from, to) - width / 2,
    ),
  );
  const bend = smooth(28, 50, Math.abs(z)) * Math.sin(z * 0.045) * 8;
  const trail = Math.min(Math.abs(x - 3.5 - bend), Math.abs(x + 3.5 - bend));
  return Math.min(streets, Math.abs(z) > 27 ? trail : Infinity);
}

// The orbit guard protects the camera and its near plane. Hills hiding distant
// parcels are normal occlusion, not a reason to force the player overhead.
export function cameraTerrainHeight(x, z) {
  return mineHillsideHeight(x, z, PLOTS.mine[1], groundHeight(x, z));
}
function cameraFloor(position) {
  return (
    Math.max(
      ...[
        [0, 0],
        [-0.35, 0],
        [0.35, 0],
        [0, -0.35],
        [0, 0.35],
      ].map(([dx, dz]) => cameraTerrainHeight(position.x + dx, position.z + dz)),
    ) + 1.2
  );
}
export function keepCameraAboveTerrain(position, target, minPolarAngle = 0.25) {
  if (position.y >= cameraFloor(position)) return false;
  const orbit = new THREE.Spherical().setFromVector3(position.clone().sub(target));
  let blocked = orbit.phi;
  while (orbit.phi > minPolarAngle) {
    blocked = orbit.phi;
    orbit.phi = Math.max(minPolarAngle, orbit.phi - 0.025);
    position.setFromSpherical(orbit).add(target);
    if (position.y >= cameraFloor(position)) break;
  }
  if (position.y < cameraFloor(position)) {
    // A panned focus can be beneath a tall ridge at minimum zoom. In that case
    // lift the camera out instead of leaving it buried at the rotation limit.
    position.y = cameraFloor(position) + 0.001;
    return true;
  }
  let clear = orbit.phi;
  for (let i = 0; i < 12; i++) {
    orbit.phi = (clear + blocked) / 2;
    position.setFromSpherical(orbit).add(target);
    if (position.y >= cameraFloor(position) + 0.001) clear = orbit.phi;
    else blocked = orbit.phi;
  }
  orbit.phi = clear;
  position.setFromSpherical(orbit).add(target);
  return true;
}

export function buildLandscape(town) {
  const landscape = new THREE.Group();
  const geometry = landscapeGeometry();
  const positions = geometry.attributes.position;
  const colors = [],
    sand = new THREE.Color('#cdbb8b'),
    sage = new THREE.Color('#a8af80');
  const track = new THREE.Color('#bd9c6e'),
    color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i),
      z = positions.getZ(i),
      height = landscapeGroundHeight(x, z);
    positions.setY(i, height);
    const meadow = smooth(0.32, 0.78, noise(x * 0.095 + 18, z * 0.095));
    color.copy(sand).lerp(sage, meadow * 0.64);
    if (Math.abs(x + 1) < 24 && z < -25 && z > -53) {
      const slope = Math.hypot(
        groundHeight(x + 0.65, z) - groundHeight(x - 0.65, z),
        groundHeight(x, z + 0.65) - groundHeight(x, z - 0.65),
      );
      color.lerp(new THREE.Color('#a3967c'), smooth(0.6, 2.5, slope) * 0.78);
    }
    color.multiplyScalar(0.96 + noise(x * 0.35, z * 0.35) * 0.09);
    color.lerp(track, (1 - smooth(0.05, 0.35, trackDistance(x, z))) * 0.5);
    color.lerp(
      new THREE.Color('#a79570'),
      1 - smooth(RIVER.halfWidth, RIVER.bankWidth, riverDistance(x, z)),
    );
    color.lerp(
      new THREE.Color('#968569'),
      1 - smooth(0.45, MILLRACE.bankWidth + 0.1, millraceDistance(x, z)),
    );
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
  material.userData.transient = true;
  const ground = new THREE.Mesh(geometry, material);
  ground.receiveShadow = true;
  landscape.add(ground);
  buildRiver(town, landscape);
  addMineCliff(town, landscape);
  addMineExcavation(town, landscape);

  const plants = town.group(landscape);
  // Cottonwoods near the settlement, with smaller junipers scattered into the hills.
  for (const [x, z, scale, seed] of [
    [-24, -14, 1.15, 1],
    [24, -14, 1.25, 2],
    [-25, 8, 1.2, 3],
    [25, 9, 1.05, 4],
    [-17, 28, 0.9, 5],
    [18, 29, 0.8, 6],
    [-20, -23, 1.1, 7],
    [19, -25, 0.9, 8],
  ])
    tree(town, plants, x, z, scale, seed);
  for (let i = 0; i < 48; i++) {
    const angle = random(i + 32) * Math.PI * 2;
    const radius = 36 + random(i + 190) * 48;
    const x = Math.cos(angle) * radius,
      z = Math.sin(angle) * radius;
    if (trackDistance(x, z) > 3) tree(town, plants, x, z, 0.7 + random(i + 4) * 0.8, i + 12);
  }
  for (let i = 0; i < 620; i++) {
    const x = (random(i * 3 + 5) - 0.5) * 105;
    const z = (random(i * 3 + 6) - 0.5) * 105;
    if (
      Math.hypot(x, z) < 25 ||
      trackDistance(x, z) < 2 ||
      wetBank(x, z, 0.5) ||
      reservedGround(x, z)
    )
      continue;
    const y = groundHeight(x, z),
      size = 0.15 + random(i + 91) * 0.25;
    if (i % 5 === 0) {
      town.ball(plants, x, y + size * 0.35, z, [size * 1.6, size * 0.7, size], '#b9aa86', 'rock');
    } else {
      const tuft = town.group(plants, x, y, z);
      for (let blade = 0; blade < 3; blade++) {
        const stem = town.box(
          tuft,
          0.025,
          size,
          0.035,
          (blade - 1) * 0.07,
          size * 0.45,
          0,
          i % 2 ? '#a3aa79' : '#b8ab74',
        );
        stem.rotation.z = (blade - 1) * 0.5;
        stem.rotation.y = i;
      }
    }
  }
  for (const [x, z] of [
    [-25, -1],
    [25, 1],
    [-23, 18],
    [24, -20],
    [-29, -8],
    [25, 22],
  ]) {
    if (wetBank(x, z, 0.6) || reservedGround(x, z)) continue;
    const plant = town.group(plants, x, groundHeight(x, z), z);
    town.cactus(plant, 0, 0);
  }
  town.batch(plants);
  return landscape;
}

function tree(town, parent, x, z, scale, seed) {
  if (wetBank(x, z, 1.8)) return;
  if (reservedGround(x, z)) return;
  const tree = town.group(parent, x, groundHeight(x, z), z);
  tree.scale.setScalar(scale);
  tree.rotation.y = random(seed) * Math.PI * 2;
  const tall = seed % 3 !== 0,
    height = tall ? 3.5 : 2.5;
  const bark = '#8b7858',
    branchColor = '#a18a62';
  town.rod(tree, [0, 0, 0], [0.12, height * 0.48, 0.05], 0.14, bark);
  town.rod(tree, [0.12, height * 0.48, 0.05], [-0.16, height * 0.83, 0], 0.095, bark);
  for (let i = 0; i < 6; i++) {
    const angle = i * 2.4 + random(seed + i) * 0.8;
    const reach = 0.8 + random(seed * 7 + i) * 0.55;
    const tip = [
      Math.cos(angle) * reach,
      height * (0.66 + random(seed + i * 11) * 0.34),
      Math.sin(angle) * reach,
    ];
    const fork = [tip[0] * 0.55, height * 0.61, tip[2] * 0.55];
    town.rod(tree, [0.1, height * 0.38, 0], fork, 0.065, bark);
    town.rod(tree, fork, tip, 0.038, branchColor);
    for (let cluster = 0; cluster < 3; cluster++) {
      const radius = 0.48 + random(seed * 17 + i * 3 + cluster) * 0.28;
      town.ball(
        tree,
        tip[0] + Math.cos(cluster * 2.4 + i) * 0.36,
        tip[1] + (cluster === 1 ? 0.38 : 0.02),
        tip[2] + Math.sin(cluster * 2.4 + i) * 0.36,
        [radius, radius * (tall ? 0.88 : 0.65), radius * 0.85],
        ['#82976b', '#91a477', '#a5b383', '#b0ba8d'][(i + cluster + seed) % 4],
        'foliage',
      );
    }
  }
  for (let i = 0; i < 3; i++) {
    const angle = i * 2.1;
    town.rod(tree, [Math.cos(angle) * 0.4, 0.03, Math.sin(angle) * 0.4], [0, 0.35, 0], 0.055, bark);
  }
}

// The exposed face is the front of the connected hillside, not a separate wall.
export function addMineCliff(town, parent) {
  const cliff = town.group(parent, 0, 0, PLOTS.mine[1]);
  cliff.name = 'Mine cliff';
  const columns = MINE_FACE_COLUMNS;
  const vertices = [],
    colors = [];
  const bands = ['#a49579', '#bcaa89', '#a4967d', '#c1b08e'];
  const vertex = (column, band) => {
    const [x, height] = columns[column];
    return [
      x,
      band === 4 ? height : Math.min(height, band * 1.25),
      band === 4 ? MINE_HILLSIDE.frontOffset : -0.12 - band * 0.23 - (column % 2) * 0.09,
    ];
  };
  const triangle = (a, b, c, color) => {
    vertices.push(...a, ...b, ...c);
    const tone = new THREE.Color(color);
    for (let i = 0; i < 3; i++) colors.push(tone.r, tone.g, tone.b);
  };
  for (let col = 0; col < columns.length - 1; col++) {
    for (let band = 0; band < 4; band++) {
      const a = vertex(col, band),
        b = vertex(col + 1, band);
      const c = vertex(col + 1, band + 1),
        e = vertex(col, band + 1);
      triangle(a, b, c, bands[band]);
      triangle(a, c, e, bands[band]);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.userData.owned = true;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    side: THREE.DoubleSide,
  });
  material.userData.transient = true;
  const face = new THREE.Mesh(geometry, material);
  face.castShadow = true;
  face.receiveShadow = true;
  cliff.add(face);
  for (const [x, y, sx, sy] of [
    [-5.7, 0.4, 1.4, 0.6],
    [-3.5, 0.35, 1.2, 0.5],
    [3.5, 0.4, 1.3, 0.6],
    [5.6, 0.35, 1.2, 0.5],
  ])
    town.ball(cliff, x, y, -0.2, [sx, sy, 0.4], '#b5a587', 'rock');
  return cliff;
}

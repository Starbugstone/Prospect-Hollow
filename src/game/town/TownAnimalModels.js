import { Box3, Matrix4, MeshStandardMaterial, Vector3 } from 'three';
import { RING_TUBE } from './TownGeometries';
import { SPACE_HELMET, TOWN_ANIMALS } from '../../data/townAnimals';
import { horizonMaterial } from './TownAtmosphere';
import { catGeometries, pigeonGeometries } from './TownAnimalGeometries';
import { gardenAnimalModel } from './GardenAnimalModels';
import { flyingAnimal } from '../../data/townAnimals';

function finishModel(d, model, costume = null) {
  const { root, head, species } = model;
  if (costume === 'space-helmet') addSpaceSuit(d, model);
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  const bird = species === 'hen' || flyingAnimal(species);
  d.contactShadow(root, bird ? 0.2 : 0.25, bird ? 0.3 : 0.48);
  return {
    ...model,
    headRest: head.position.clone(),
    beak: root.getObjectByName('Pigeon beak'),
    shadow: root.children.at(-1),
  };
}

function catModel(d, root, costume) {
  catGeometries(d);
  const coat = '#b77e4e',
    light = '#f0e3cc',
    stripe = '#76543e';
  const body = d.group(root);
  d.mesh(body, 'catBody', [1, 1, 1], [0, 0, 0], coat);
  d.ball(body, 0, 0.41, 0.25, [0.095, 0.125, 0.045], light);
  const head = d.group(body, 0, 0.565, 0.22);
  d.ball(head, 0, 0, 0, [0.16, 0.145, 0.135], coat);
  for (const side of [-1, 1]) {
    const ear = d.group(head, side * 0.105, 0.095, -0.015);
    ear.rotation.z = side * -0.18;
    d.mesh(ear, 'catEar', [0.14, 0.18, 0.16], [0, 0, 0], coat);
    d.mesh(ear, 'catEar', [0.075, 0.125, 0.05], [0, 0.023, 0.034], '#d49d87');
    d.ball(head, side * 0.085, 0.032, 0.114, [0.036, 0.04, 0.018], '#a2b877');
    d.ball(head, side * 0.085, 0.032, 0.132, [0.009, 0.029, 0.007], '#29322a');
    d.ball(head, side * 0.049, -0.035, 0.116, [0.054, 0.043, 0.046], light);
    for (const y of [-0.02, 0.005])
      d.rod(head, [side * 0.055, y - 0.02, 0.148], [side * 0.205, y, 0.11], 0.004, light);
  }
  d.ball(head, 0, -0.077, 0.106, [0.055, 0.023, 0.04], light);
  const nose = d.mesh(head, 'catEar', [0.043, 0.028, 0.04], [0, -0.019, 0.165], '#956c63');
  nose.rotation.z = Math.PI;
  const legs = [];
  for (const side of [-1, 1])
    for (const z of [-0.19, 0.18]) {
      const leg = d.group(body, side * 0.1, 0.29, z);
      d.rod(leg, [0, 0, 0], [0, -0.25, 0.005], 0.035, coat);
      d.ball(leg, 0, -0.254, 0.024, [0.045, 0.035, 0.06], light);
      legs.push(leg);
    }
  const tail = d.group(body, 0, 0.35, -0.265);
  d.mesh(tail, 'catTail', [1, 1, 1], [0, 0, 0], coat);
  d.mesh(tail, 'catTailTip', [1, 1, 1], [0, 0, 0], stripe);
  d.ball(tail, 0.12, 0.45, 0, 0.043, stripe);
  return finishModel(d, { root, body, head, legs, wings: [], tail, species: 'cat' }, costume);
}

// Small articulated meshes use the same geometry/material caches and instancing
// as villagers. All species face +Z and put their feet at the root's ground plane.
export function animalModel(d, species, variant = 0, costume = null) {
  const root = d.group(d.world);
  root.name = TOWN_ANIMALS[species].name;
  root.userData.animated = true;
  root.userData.species = species;
  if (species === 'cat') return catModel(d, root, costume);
  if (TOWN_ANIMALS[species].model === 'garden')
    return finishModel(d, { ...gardenAnimalModel(d, species, root), species }, costume);
  if (flyingAnimal(species)) pigeonGeometries(d);
  const bird = species === 'hen' || flyingAnimal(species);
  const colors = {
    dog: ['#c69b6b', '#e4c99e'],
    fox: ['#bd6f3c', '#f0dfbb'],
    raccoon: ['#908b7d', '#d8d2bc'],
    hen: [variant % 2 ? '#c89560' : '#efe2c3', '#efe2c3'],
    pigeon: ['#8497a7', '#b2bec4'],
    bluebird: ['#7296ad', '#e8dfc8'],
  };
  const [coat, light] = colors[species];
  const body = d.group(root);
  d.ball(body, 0, bird ? 0.22 : 0.3, 0, bird ? [0.16, 0.2, 0.25] : [0.18, 0.21, 0.36], coat);
  const head = d.group(body, 0, bird ? 0.4 : 0.47, bird ? 0.16 : 0.28);
  d.ball(head, 0, 0, 0, bird ? 0.105 : [0.14, 0.15, 0.16], coat);
  const legs = [],
    wings = [];
  for (const side of [-1, 1]) {
    d.ball(head, side * (bird ? 0.085 : 0.11), 0.035, 0.06, 0.02, '#303c37');
    if (bird) {
      const leg = d.group(body, side * 0.065, 0.14, 0);
      d.rod(leg, [0, 0, 0], [0, -0.14, 0.045], 0.016, '#ba8868');
      legs.push(leg);
      const wing = d.group(body, side * 0.13, 0.29, 0);
      if (flyingAnimal(species)) {
        d.mesh(wing, `pigeonWing${side}`, [1, 1, 1], [0, 0, 0], light);
        if (species === 'pigeon')
          d.mesh(wing, `pigeonWing${side}Bars`, [1, 1, 1], [0, 0, 0], '#526471');
      } else d.ball(wing, side * 0.055, -0.035, -0.03, [0.075, 0.13, 0.22], light);
      wings.push(wing);
    } else {
      if (species === 'dog')
        d.ball(head, side * 0.14, -0.015, -0.035, [0.055, 0.15, 0.08], '#96724f');
      else {
        d.mesh(head, 'cone', [0.075, 0.18, 0.07], [side * 0.095, 0.14, -0.035], coat);
        d.mesh(head, 'cone', [0.038, 0.11, 0.035], [side * 0.095, 0.145, 0.008], light);
      }
      for (const z of [-0.22, 0.22]) {
        const leg = d.group(body, side * 0.105, 0.24, z);
        d.rod(leg, [0, 0, 0], [0, -0.21, 0], 0.04, coat);
        d.ball(leg, 0, -0.21, 0.025, [0.05, 0.035, 0.075], species === 'fox' ? '#564b3d' : light);
        legs.push(leg);
      }
    }
  }
  if (bird) {
    if (flyingAnimal(species)) {
      const beak = d.mesh(head, 'pigeonBeak', [1, 1, 1], [0, -0.015, 0.126], '#575c60');
      beak.name = 'Pigeon beak';
      d.ball(head, 0, 0.002, 0.1, [0.026, 0.018, 0.023], '#d4d4c9');
    } else d.ball(head, 0, -0.025, 0.12, [0.04, 0.03, 0.09], '#d5a15b');
    if (species === 'hen') d.ball(head, 0, 0.1, 0, [0.04, 0.065, 0.07], '#b86c50');
    else d.ball(head, 0, -0.1, -0.015, [0.1, 0.1, 0.1], species === 'bluebird' ? light : '#649b91');
  } else {
    d.ball(head, 0, -0.045, 0.13, [0.1, 0.075, species === 'fox' ? 0.19 : 0.12], light);
    d.ball(head, 0, -0.025, species === 'fox' ? 0.3 : 0.24, 0.032, '#383b31');
    if (species === 'raccoon')
      for (const side of [-1, 1]) {
        d.ball(head, side * 0.097, 0.028, 0.088, [0.064, 0.056, 0.075], '#464b46');
        d.ball(head, side * 0.11, 0.04, 0.15, 0.019, '#161f20');
      }
  }
  const tail = d.group(body, 0, bird ? 0.25 : 0.35, bird ? -0.2 : -0.3);
  if (bird) d.ball(tail, 0, 0.02, -0.13, [0.12, 0.04, 0.2], light);
  else if (species === 'dog') d.rod(tail, [0, 0, 0], [0, 0.2, -0.24], 0.045, coat);
  else {
    d.ball(tail, 0, -0.02, -0.23, [0.14, 0.14, 0.32], coat);
    d.ball(tail, 0, -0.04, -0.48, [0.1, 0.1, 0.14], light);
    if (species === 'raccoon')
      for (const z of [-0.1, -0.25, -0.4])
        d.ball(tail, 0, -0.02, z, [0.143, 0.143, 0.045], '#535b54');
  }
  return finishModel(d, { root, body, head, legs, wings, tail, species }, costume);
}

const SUIT = '#ece5d3',
  SUIT_RED = '#c9504a',
  HELMET_KEY = 'space-helmet-glass';
function helmetGlass(d) {
  if (!d.materials.has(HELMET_KEY))
    d.materials.set(
      HELMET_KEY,
      horizonMaterial(
        new MeshStandardMaterial({
          color: '#dff3f4',
          roughness: 0.15,
          transparent: true,
          opacity: 0.4,
          depthWrite: false,
        }),
      ),
    );
  return d.materials.get(HELMET_KEY);
}
const relative = new Matrix4(),
  vertex = new Vector3();
// Visits each vertex of the meshes below `group` in the group's own coordinates.
function eachVertex(group, visit, meshes = []) {
  if (!meshes.length) group.traverse((o) => o.isMesh && meshes.push(o));
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  for (const mesh of meshes) {
    relative.multiplyMatrices(inverse, mesh.matrixWorld);
    const position = mesh.geometry.attributes.position;
    for (let n = 0; n < position.count; n++)
      visit(vertex.fromBufferAttribute(position, n).applyMatrix4(relative));
  }
}
// The farthest any surface between depths lo and hi along `axis` from `center` lies
// from that axis. Distance from a line is convex along an edge, so clipping each
// triangle edge to the slab gives the exact maximum.
const edgeA = new Vector3(),
  edgeB = new Vector3(),
  edgeAt = new Vector3(),
  edgePoint = new Vector3();
function slabReach(group, meshes, center, axis, lo, hi) {
  if (!meshes.length) group.traverse((o) => o.isMesh && meshes.push(o));
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  let reach = 0;
  const base = center.dot(axis);
  const radial = (p) => {
    edgePoint.copy(p).sub(center);
    const along = edgePoint.dot(axis);
    reach = Math.max(reach, edgePoint.addScaledVector(axis, -along).length());
  };
  for (const mesh of meshes) {
    relative.multiplyMatrices(inverse, mesh.matrixWorld);
    const position = mesh.geometry.attributes.position,
      index = mesh.geometry.index;
    const corner = (n) => (index ? index.getX(n) : n);
    const count = index ? index.count : position.count;
    for (let n = 0; n < count; n += 3)
      for (const [i, j] of [
        [n, n + 1],
        [n + 1, n + 2],
        [n + 2, n],
      ]) {
        edgeA.fromBufferAttribute(position, corner(i)).applyMatrix4(relative);
        edgeB.fromBufferAttribute(position, corner(j)).applyMatrix4(relative);
        const a = edgeA.dot(axis) - base,
          b = edgeB.dot(axis) - base;
        const from = Math.max(lo, Math.min(a, b)),
          to = Math.min(hi, Math.max(a, b));
        if (from > to) continue;
        for (const at of [from, to]) {
          const t = a === b ? 0 : (at - a) / (b - a);
          radial(edgeAt.lerpVectors(edgeA, edgeB, t));
        }
      }
  }
  return reach;
}
function boundsOf(group, meshes) {
  const box = new Box3();
  eachVertex(group, (v) => box.expandByPoint(v), meshes);
  return box;
}

// The bubble encloses every head vertex. Its collar ring lies just beyond the head,
// tilted halfway between straight down and the neck, so it rests on the shoulders and
// never cuts the face; the neck passes through it, and the bubble grows only as far as
// the ring's rim needs. A head carried low tilts the ring toward the neck instead, so
// it stays above the ground.
function fitHelmet(d, root, head, coat, torso) {
  const center = boundsOf(head).getCenter(new Vector3()),
    offset = new Vector3();
  let reach = 0;
  eachVertex(head, (v) => (reach = Math.max(reach, v.distanceTo(center))));
  const r = reach * 1.06;
  const neck = boundsOf(head, [torso]).getCenter(new Vector3()).sub(center).normalize();
  // Head coordinates relative to the animal, whose feet stand at y = 0.
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert().multiply(head.matrixWorld);
  const necks = coat.filter((mesh) => mesh !== torso);
  let fit;
  for (const down of [1, 0.6, 0.3, 0]) {
    const axis = neck
      .clone()
      .add(new Vector3(0, -down, 0))
      .normalize();
    let back = 0;
    eachVertex(head, (v) => (back = Math.max(back, offset.copy(v).sub(center).dot(axis))));
    // A neck between head and trunk must pass through the opening.
    let ring = r * 0.6,
      depth = 0;
    for (let pass = 0; pass < 2; pass++) {
      const tube = ring * RING_TUBE;
      depth = back + tube * 1.4;
      const opening = necks.length
        ? slabReach(head, [...necks], center, axis, depth - tube * 1.4, depth + tube * 1.4)
        : 0;
      ring = Math.min(r * 1.2, Math.max(r * 0.6, (opening + tube * 0.6) / (1 - RING_TUBE)));
    }
    const middle = center.clone().addScaledVector(axis, depth).applyMatrix4(toRoot);
    const tilt = axis.clone().transformDirection(toRoot);
    const lowest = middle.y - ring * Math.sqrt(Math.max(0, 1 - tilt.y ** 2)) - ring * RING_TUBE;
    if (!fit || lowest > fit.lowest) fit = { axis, ring, depth, back, lowest, tilt };
    if (lowest > 0.02) break;
  }
  let { axis, ring, depth } = fit;
  // Even upright, a ring around a head this low would touch the ground: a smaller ring
  // still lies beyond the head along its axis, so it cannot reach the face either.
  if (fit.lowest <= 0.02) {
    const slope = Math.sqrt(Math.max(0, 1 - fit.tilt.y ** 2)) + RING_TUBE;
    for (let pass = 0; pass < 2; pass++) {
      depth = fit.back + ring * RING_TUBE * 1.4;
      const middle = center.clone().addScaledVector(axis, depth).applyMatrix4(toRoot);
      ring = Math.min(ring, Math.max(0, middle.y - 0.02) / slope);
    }
  }
  const radius = Math.max(r, Math.hypot(depth, ring));
  const helmet = d.group(head);
  helmet.name = 'Space helmet';
  const shape = groundedBubble(head, center, radius, toRoot);
  const bubble = d.ball(helmet, ...shape.center.toArray(), shape.size, '#dff3f4');
  bubble.material = helmetGlass(d);
  const collar = d.mesh(
    helmet,
    'ring',
    [ring, ring, ring],
    center.clone().addScaledVector(axis, depth).toArray(),
    SUIT,
  );
  collar.name = 'Space helmet collar';
  collar.quaternion.setFromUnitVectors(new Vector3(0, 0, 1), axis);
}

// A bubble that would sink into the ground is flattened from below instead, keeping
// its top; it widens only as far as the head still needs. A head that itself reaches
// the ground keeps the round bubble.
function groundedBubble(head, center, radius, toRoot) {
  const round = { center, size: radius };
  const ground = new Vector3(0, 0.015, 0).applyMatrix4(toRoot.clone().invert()).y;
  const top = center.y + radius;
  if (center.y - radius >= ground) return round;
  const middle = new Vector3(center.x, (top + ground) / 2, center.z),
    height = (top - ground) / 2;
  let lowest = Infinity;
  eachVertex(head, (v) => (lowest = Math.min(lowest, v.y)));
  if (lowest <= ground) return round;
  for (let width = radius; width < radius * 2; width *= 1.04) {
    let inside = true;
    eachVertex(head, (v) => {
      const x = (v.x - middle.x) / width,
        y = (v.y - middle.y) / height,
        z = (v.z - middle.z) / width;
      if (x * x + y * y + z * z > 1 / 1.06 ** 2) inside = false;
    });
    if (inside) return { center: middle, size: [width, height, width] };
  }
  return round;
}

// Cosmo-style space suit, fitted to whichever animal wears it this era: a clear bubble
// enclosing the whole head on a white collar ring, a white suit with red star patches
// and red boots. Only shared primitives; one extra (transparent) material.
function addSpaceSuit(d, { root, body, head, legs, species }) {
  root.userData.costume = 'space-helmet';
  const volume = (box) =>
    box
      .getSize(new Vector3())
      .toArray()
      .reduce((a, b) => a * b);
  const coat = body.children.filter((o) => o.isMesh);
  const [torso, trunk] = coat
    .map((mesh) => [mesh, boundsOf(body, [mesh])])
    .reduce((a, b) => (volume(b[1]) > volume(a[1]) ? b : a));
  fitHelmet(d, root, head, coat, torso);
  torso.material = d.material(SPACE_HELMET.suits[species] ?? SUIT);
  const middle = trunk.getCenter(new Vector3()),
    half = trunk.getSize(new Vector3()).multiplyScalar(0.5);
  for (const side of [-1, 1])
    d.ball(
      body,
      side * trunk.max.x,
      middle.y + half.y * 0.15,
      middle.z,
      [0.02, 0.06, 0.06],
      SUIT_RED,
    );
  for (const leg of legs) {
    const foot = boundsOf(leg),
      size = foot.getSize(new Vector3());
    d.ball(
      leg,
      (foot.min.x + foot.max.x) / 2,
      foot.min.y + Math.min(0.045, size.y * 0.2),
      (foot.min.z + foot.max.z) / 2,
      [size.x * 0.58, Math.min(0.045, size.y * 0.2), size.z * 0.58],
      SUIT_RED,
    );
  }
}

export function animateAnimal(model, time, state, moving) {
  const { species, body, head, legs, wings, tail } = model;
  const bird = species === 'hen' || flyingAnimal(species);
  const feeding = state === 'feeding' || state === 'pecking' || state === 'foraging';
  const flight = state === 'flying' || state === 'startled';
  const running = state === 'chasing' || state === 'fleeing';
  const step = time * (bird ? 10 : running ? 12 : 7);
  body.position.y =
    moving && !flight ? Math.abs(Math.sin(step)) * 0.025 : Math.sin(time * 2) * 0.006;
  head.rotation.x = feeding
    ? Math.max(0, Math.sin(time * 4)) * 0.85
    : state === 'sniffing'
      ? 0.55
      : 0;
  head.rotation.z = state === 'grooming' ? Math.sin(time * 3) * 0.3 : 0;
  head.rotation.y = moving ? Math.sin(time) * 0.08 : Math.sin(time * 0.8) * 0.3;
  if (flyingAnimal(species)) {
    // A brief peck with a still interval, instead of continuously swaying the
    // head and long beak. The neck lowers with the head so pecks reach the food.
    const phase = ((time % 1.65) + 1.65) % 1.65;
    const peck = feeding && phase < 0.48 ? Math.sin((phase / 0.48) * Math.PI) ** 2 : 0;
    model.peck = peck;
    head.position.copy(model.headRest);
    head.position.y -= peck * 0.26;
    head.position.z += peck * 0.06;
    head.rotation.set(peck * 0.95, 0, 0);
    if (!feeding && !flight) {
      const glance = ((time % 5) + 5) % 5;
      if (glance > 3.8) head.rotation.y = Math.sin(((glance - 3.8) / 1.2) * Math.PI) ** 2 * 0.22;
    }
  }
  legs.forEach((leg, n) => {
    leg.rotation.x =
      moving && !flight
        ? Math.sin(step + (n === 0 || n === 3 ? 0 : Math.PI)) * (running ? 0.55 : 0.4)
        : 0;
  });
  wings.forEach((wing, n) => {
    wing.rotation.z = flight ? (n ? -1 : 1) * (1.1 + Math.sin(time * 22) * 0.75) : 0;
    wing.scale.x = flight ? 2.4 : 1;
  });
  tail.rotation.z = Math.sin(time * (species === 'dog' ? 8 : 2)) * (species === 'dog' ? 0.4 : 0.16);
  for (const [n, arm] of (model.arms ?? []).entries())
    arm.rotation.x = moving ? Math.sin(step + n * Math.PI) * 0.2 : Math.sin(time * 0.8 + n) * 0.04;
}

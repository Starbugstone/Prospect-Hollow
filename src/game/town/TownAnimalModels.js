import { TOWN_ANIMALS } from '../../data/townAnimals';
import { catGeometries, pigeonGeometries } from './TownAnimalGeometries';

function finishModel(d, model) {
  const { root, head, species } = model;
  root.traverse((object) => {
    if (object.isMesh) object.castShadow = false;
  });
  const bird = species === 'hen' || species === 'pigeon';
  d.contactShadow(root, bird ? 0.2 : 0.25, bird ? 0.3 : 0.48);
  return {
    ...model,
    headRest: head.position.clone(),
    beak: root.getObjectByName('Pigeon beak'),
    shadow: root.children.at(-1),
  };
}

function catModel(d, root) {
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
  return finishModel(d, { root, body, head, legs, wings: [], tail, species: 'cat' });
}

// Small articulated meshes use the same geometry/material caches and instancing
// as villagers. All species face +Z and put their feet at the root's ground plane.
export function animalModel(d, species, variant = 0) {
  const root = d.group(d.world);
  root.name = TOWN_ANIMALS[species].name;
  root.userData.animated = true;
  root.userData.species = species;
  if (species === 'cat') return catModel(d, root);
  if (species === 'pigeon') pigeonGeometries(d);
  const bird = species === 'hen' || species === 'pigeon';
  const colors = {
    dog: ['#c69b6b', '#e4c99e'],
    fox: ['#bd6f3c', '#f0dfbb'],
    raccoon: ['#908b7d', '#d8d2bc'],
    hen: [variant % 2 ? '#c89560' : '#efe2c3', '#efe2c3'],
    pigeon: ['#8497a7', '#b2bec4'],
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
      if (species === 'pigeon') {
        d.mesh(wing, `pigeonWing${side}`, [1, 1, 1], [0, 0, 0], light);
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
    if (species === 'pigeon') {
      const beak = d.mesh(head, 'pigeonBeak', [1, 1, 1], [0, -0.015, 0.126], '#575c60');
      beak.name = 'Pigeon beak';
      d.ball(head, 0, 0.002, 0.1, [0.026, 0.018, 0.023], '#d4d4c9');
    } else d.ball(head, 0, -0.025, 0.12, [0.04, 0.03, 0.09], '#d5a15b');
    if (species === 'hen') d.ball(head, 0, 0.1, 0, [0.04, 0.065, 0.07], '#b86c50');
    else d.ball(head, 0, -0.1, -0.015, [0.1, 0.1, 0.1], '#649b91');
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
  return finishModel(d, { root, body, head, legs, wings, tail, species });
}

export function animateAnimal(model, time, state, moving) {
  const { species, body, head, legs, wings, tail } = model;
  const bird = species === 'hen' || species === 'pigeon';
  const feeding = state === 'feeding' || state === 'pecking' || state === 'foraging';
  const flight = state === 'flying' || state === 'startled';
  const step = time * (bird ? 10 : 7);
  body.position.y =
    moving && !flight ? Math.abs(Math.sin(step)) * 0.025 : Math.sin(time * 2) * 0.006;
  head.rotation.x = feeding
    ? Math.max(0, Math.sin(time * 4)) * 0.85
    : state === 'sniffing'
      ? 0.55
      : 0;
  head.rotation.z = state === 'grooming' ? Math.sin(time * 3) * 0.3 : 0;
  head.rotation.y = moving ? Math.sin(time) * 0.08 : Math.sin(time * 0.8) * 0.3;
  if (species === 'pigeon') {
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
      moving && !flight ? Math.sin(step + (n === 0 || n === 3 ? 0 : Math.PI)) * 0.4 : 0;
  });
  wings.forEach((wing, n) => {
    wing.rotation.z = flight ? (n ? -1 : 1) * (1.1 + Math.sin(time * 22) * 0.75) : 0;
    wing.scale.x = flight ? 2.4 : 1;
  });
  tail.rotation.z = Math.sin(time * (species === 'dog' ? 8 : 2)) * (species === 'dog' ? 0.4 : 0.16);
}

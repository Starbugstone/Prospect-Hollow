import { COZY_PALETTES } from '../../data/cozyArchitecture';

// The new garden cast shares the town's cached primitives and actor instances.
// Every joint is created once; motion only changes transforms.
function eyes(d, head, x, y, z, color = '#353f35') {
  for (const side of [-1, 1]) d.ball(head, side * x, y, z, [0.016, 0.022, 0.013], color);
}

function quadruped(d, body, height, spread, length, coat, foot) {
  const legs = [];
  for (const side of [-1, 1])
    for (const z of [-length, length]) {
      const leg = d.group(body, side * spread, height, z);
      d.rod(leg, [0, 0, 0], [0, -height + 0.045, 0], 0.032, coat);
      d.ball(leg, 0, -height + 0.035, 0.025, [0.048, 0.035, 0.07], foot);
      legs.push(leg);
    }
  return legs;
}

function deer(d, root) {
  const coat = '#c79768',
    light = '#ead6b3';
  const body = d.group(root);
  d.ball(body, 0, 0.66, 0, [0.18, 0.235, 0.4], coat);
  d.ball(body, 0, 0.62, 0.31, [0.12, 0.17, 0.1], light);
  d.rod(body, [0, 0.72, 0.26], [0, 1.04, 0.37], 0.095, coat);
  const head = d.group(body, 0, 1.11, 0.4);
  d.ball(head, 0, 0, 0, [0.13, 0.14, 0.17], coat);
  d.ball(head, 0, -0.055, 0.14, [0.08, 0.075, 0.15], light);
  d.ball(head, 0, -0.035, 0.255, [0.05, 0.038, 0.034], '#50463c');
  eyes(d, head, 0.115, 0.025, 0.085);
  for (const side of [-1, 1]) {
    const ear = d.mesh(head, 'rock', [0.065, 0.19, 0.045], [side * 0.135, 0.16, -0.015], coat);
    ear.rotation.z = -side * 0.45;
    d.mesh(ear, 'rock', [0.6, 0.65, 0.3], [0, 0, 0.45], light);
  }
  const legs = quadruped(d, body, 0.58, 0.13, 0.25, coat, '#78634b');
  const tail = d.group(body, 0, 0.7, -0.37);
  d.ball(tail, 0, 0.015, -0.08, [0.065, 0.065, 0.12], light);
  return { root, body, head, legs, wings: [], tail };
}

function otter(d, root) {
  const coat = '#9c7558',
    light = '#e6d6b9';
  const body = d.group(root);
  d.ball(body, 0, 0.27, 0, [0.18, 0.2, 0.38], coat);
  d.ball(body, 0, 0.32, 0.255, [0.13, 0.16, 0.07], light);
  const head = d.group(body, 0, 0.44, 0.29);
  d.ball(head, 0, 0, 0, [0.15, 0.135, 0.15], coat);
  for (const side of [-1, 1]) {
    d.ball(head, side * 0.13, 0.095, -0.02, 0.046, coat);
    d.ball(head, side * 0.052, -0.035, 0.11, [0.065, 0.047, 0.065], light);
  }
  eyes(d, head, 0.085, 0.025, 0.119);
  d.ball(head, 0, -0.014, 0.168, [0.032, 0.022, 0.025], '#403b32');
  const legs = quadruped(d, body, 0.18, 0.13, 0.23, coat, '#77563f');
  const tail = d.group(body, 0, 0.21, -0.32);
  d.rod(tail, [0, 0, 0], [0, -0.14, -0.37], 0.085, coat);
  d.ball(tail, 0, -0.15, -0.39, [0.035, 0.028, 0.055], coat);
  return { root, body, head, legs, wings: [], tail };
}

function hedgehog(d, root) {
  const body = d.group(root);
  d.ball(body, 0, 0.19, -0.04, [0.2, 0.18, 0.25], '#9a826a');
  // A handful of broad back plates gives a readable silhouette, not dense spines.
  for (let n = 0; n < 7; n++) {
    const x = Math.sin(n * 2.4) * 0.12,
      z = Math.cos(n * 2.4) * 0.15 - 0.07;
    const plate = d.mesh(
      body,
      'rock',
      [0.065, 0.12, 0.08],
      [x, 0.32, z],
      n % 2 ? '#806953' : '#a38b72',
    );
    plate.rotation.z = x * -3;
  }
  const head = d.group(body, 0, 0.16, 0.19);
  d.ball(head, 0, 0, 0, [0.105, 0.105, 0.13], '#dfc8a0');
  d.ball(head, 0, -0.02, 0.12, [0.045, 0.035, 0.06], '#554537');
  eyes(d, head, 0.068, 0.025, 0.085);
  const legs = quadruped(d, body, 0.06, 0.11, 0.14, '#9a826a', '#755e46');
  const tail = d.group(body);
  return { root, body, head, legs, wings: [], tail };
}

function hare(d, root) {
  const coat = '#ae9273',
    light = '#e9ddc6';
  const body = d.group(root);
  d.ball(body, 0, 0.32, -0.04, [0.18, 0.24, 0.28], coat);
  const head = d.group(body, 0, 0.52, 0.2);
  d.ball(head, 0, 0, 0, [0.12, 0.14, 0.14], coat);
  for (const side of [-1, 1]) {
    const ear = d.group(head, side * 0.065, 0.13, -0.02);
    ear.rotation.z = -side * 0.16;
    d.ball(ear, 0, 0.17, 0, [0.045, 0.23, 0.04], coat);
    d.ball(ear, 0, 0.17, 0.033, [0.022, 0.17, 0.012], '#cba796');
    d.ball(head, side * 0.045, -0.045, 0.115, [0.052, 0.04, 0.04], light);
    d.ball(body, side * 0.13, 0.2, -0.17, [0.11, 0.16, 0.15], coat);
  }
  eyes(d, head, 0.097, 0.025, 0.082);
  d.ball(head, 0, -0.025, 0.157, [0.025, 0.02, 0.019], '#71544c');
  const legs = quadruped(d, body, 0.16, 0.12, 0.17, coat, light);
  const tail = d.group(body, 0, 0.32, -0.3);
  d.ball(tail, 0, 0, 0, 0.09, light);
  return { root, body, head, legs, wings: [], tail };
}

function squirrel(d, root) {
  const coat = '#b77442',
    light = '#e8cfaa';
  const body = d.group(root);
  d.ball(body, 0, 0.26, 0, [0.13, 0.19, 0.24], coat);
  d.ball(body, 0, 0.29, 0.18, [0.09, 0.12, 0.07], light);
  const head = d.group(body, 0, 0.44, 0.19);
  d.ball(head, 0, 0, 0, [0.11, 0.12, 0.12], coat);
  for (const side of [-1, 1]) {
    d.mesh(head, 'cone', [0.045, 0.13, 0.04], [side * 0.075, 0.13, -0.025], coat);
    d.ball(head, side * 0.045, -0.04, 0.09, [0.045, 0.035, 0.05], light);
  }
  eyes(d, head, 0.08, 0.02, 0.085);
  d.ball(head, 0, -0.01, 0.14, 0.022, '#463b30');
  const legs = quadruped(d, body, 0.13, 0.1, 0.15, coat, '#775034');
  const tail = d.group(body, 0, 0.25, -0.2);
  d.ball(tail, 0, 0.18, -0.15, [0.13, 0.27, 0.15], coat);
  d.ball(tail, 0, 0.43, -0.13, [0.14, 0.18, 0.13], coat);
  d.ball(tail, 0, 0.51, -0.035, [0.11, 0.09, 0.12], light);
  return { root, body, head, legs, wings: [], tail };
}

function badger(d, root) {
  const coat = '#87867d',
    light = '#eee4ce',
    dark = '#454740';
  const body = d.group(root);
  d.ball(body, 0, 0.3, -0.07, [0.25, 0.23, 0.36], coat);
  const head = d.group(body, 0, 0.34, 0.29);
  d.ball(head, 0, 0, 0, [0.17, 0.14, 0.22], light);
  for (const side of [-1, 1]) {
    d.ball(head, side * 0.105, 0.03, 0.055, [0.045, 0.115, 0.17], dark);
    d.ball(head, side * 0.14, 0.105, -0.09, [0.05, 0.055, 0.04], light);
    d.ball(head, side * 0.137, 0.025, 0.12, 0.018, '#191f1b');
  }
  d.ball(head, 0, -0.035, 0.21, [0.045, 0.03, 0.035], dark);
  const legs = quadruped(d, body, 0.16, 0.17, 0.22, dark, dark);
  const tail = d.group(body, 0, 0.28, -0.4);
  d.ball(tail, 0, -0.015, -0.055, [0.065, 0.06, 0.12], light);
  return { root, body, head, legs, wings: [], tail };
}

function willowkin(d, root) {
  const wood = '#dfc99e',
    leaf = '#8da572',
    deep = '#728b60';
  const body = d.group(root);
  d.ball(body, 0, 0.78, 0, [0.18, 0.3, 0.135], wood);
  d.rod(body, [0, 0.91, 0], [0, 1.2, 0], 0.065, wood);
  const head = d.group(body, 0, 1.32, 0);
  d.ball(head, 0, 0, 0, [0.13, 0.17, 0.09], wood);
  eyes(d, head, 0.046, 0.012, 0.085, '#b88848');
  d.rod(head, [-0.027, -0.059, 0.087], [0, -0.069, 0.095], 0.007, '#92724e');
  d.rod(head, [0, -0.069, 0.095], [0.027, -0.059, 0.087], 0.007, '#92724e');
  // The sideways willow umbrella is its identity, rather than a branch crown.
  for (const [x, y, z, scale] of [
    [-0.29, 0.17, -0.06, [0.39, 0.17, 0.28]],
    [0.13, 0.23, -0.07, [0.4, 0.17, 0.29]],
    [0.4, 0.14, -0.075, [0.25, 0.15, 0.25]],
  ])
    d.mesh(head, 'rock', scale, [x, y, z], leaf);
  for (let n = 0; n < 3; n++)
    d.mesh(head, 'rock', [0.045, 0.075, 0.025], [-0.55, 0.04 - n * 0.1, 0], deep);
  d.rod(head, [0.57, 0.1, 0], [0.6, -0.08, 0], 0.015, wood);
  d.mesh(head, 'rock', [0.062, 0.072, 0.062], [0.6, -0.12, 0], '#d3a37d');
  for (const side of [-1, 1]) {
    const collar = d.mesh(body, 'rock', [0.07, 0.13, 0.025], [side * 0.075, 1.055, 0.1], leaf);
    collar.rotation.z = side * 0.55;
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = d.group(body, side * 0.13, 0.98, 0);
    d.rod(arm, [0, 0, 0], [side * 0.14, -0.23, 0], 0.03, wood);
    d.rod(arm, [side * 0.14, -0.23, 0], [side * 0.2, -0.44, 0.025], 0.025, wood);
    d.mesh(arm, 'rock', [0.085, 0.12, 0.035], [side * 0.2, -0.49, 0.025], leaf);
    arms.push(arm);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = d.group(body, side * 0.085, 0.56, 0);
    d.rod(leg, [0, 0, 0], [side * 0.025, -0.45, 0], 0.04, wood);
    for (const offset of [-0.04, 0, 0.04])
      d.ball(leg, offset, -0.515, 0.075, [0.03, 0.045, 0.11], wood);
    legs.push(leg);
  }
  const tail = d.group(body);
  return { root, body, head, legs, arms, wings: [], tail };
}

function willowkinResident(d, root) {
  const wood = '#dfc99e',
    p = COZY_PALETTES.riverlight;
  const body = d.group(root);
  d.ball(body, 0, 0.91, 0, [0.175, 0.34, 0.14], wood);
  d.rod(body, [0, 1.12, 0], [0, 1.4, 0], 0.067, wood);
  const head = d.group(body, 0, 1.48, 0);
  head.name = 'Willowkin resident willow crown';
  d.ball(head, 0, 0, 0, [0.13, 0.17, 0.1], wood);
  eyes(d, head, 0.046, 0.012, 0.094, '#b88848');
  d.rod(head, [-0.027, -0.059, 0.096], [0, -0.069, 0.104], 0.007, '#92724e');
  d.rod(head, [0, -0.069, 0.104], [0.027, -0.059, 0.096], 0.007, '#92724e');
  // The mature umbrella folds close to the head so it fits ordinary sidewalks.
  for (const [x, y, z, scale] of [
    [-0.21, 0.18, -0.06, [0.27, 0.15, 0.21]],
    [0.1, 0.25, -0.06, [0.28, 0.14, 0.22]],
    [0.3, 0.15, -0.065, [0.19, 0.13, 0.19]],
  ])
    d.mesh(head, 'rock', scale, [x, y, z], p.green);
  for (let n = 0; n < 3; n++)
    d.mesh(head, 'rock', [0.035, 0.058, 0.022], [-0.43, 0.05 - n * 0.085, 0], p.deep);
  d.rod(head, [0.43, 0.08, 0], [0.45, -0.065, 0], 0.013, wood);
  d.mesh(head, 'rock', [0.045, 0.052, 0.045], [0.45, -0.11, 0], p.flower);

  const scarf = d.group(body);
  scarf.name = 'Willowkin resident linen scarf';
  d.mesh(scarf, 'cylinder', [0.15, 0.055, 0.125], [0, 1.25, 0], p.roof);
  d.box(scarf, 0.06, 0.23, 0.025, 0.075, 1.145, 0.155, p.roof);
  const satchel = d.group(body);
  satchel.name = 'Willowkin resident civic satchel';
  d.rod(satchel, [-0.11, 1.21, 0.145], [0.23, 0.88, 0.145], 0.015, p.timber);
  d.box(satchel, 0.17, 0.23, 0.1, 0.22, 0.925, 0.105, p.deep, true);
  d.box(satchel, 0.18, 0.055, 0.115, 0.22, 1.01, 0.11, p.timber, true);
  d.mesh(body, 'rock', [0.022, 0.03, 0.012], [-0.085, 1.145, 0.145], p.light).name =
    'Willowkin resident craft pin';

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = d.group(body, side * 0.135, 1.11, 0);
    d.rod(arm, [0, 0, 0], [side * 0.11, -0.26, 0], 0.03, wood);
    d.rod(arm, [side * 0.11, -0.26, 0], [side * 0.16, -0.49, 0.025], 0.025, wood);
    d.mesh(arm, 'rock', [0.07, 0.1, 0.03], [side * 0.16, -0.52, 0.025], p.green);
    arms.push(arm);
  }
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = d.group(body, side * 0.085, 0.63, 0);
    d.rod(leg, [0, 0, 0], [side * 0.025, -0.51, 0], 0.04, wood);
    for (const offset of [-0.04, 0, 0.04])
      d.ball(leg, offset, -0.585, 0.08, [0.03, 0.045, 0.11], wood);
    legs.push(leg);
  }
  const tail = d.group(body);
  return { root, body, head, legs, arms, wings: [], tail };
}

const MODELS = { deer, otter, hedgehog, hare, squirrel, badger, willowkin, willowkinResident };
export const gardenAnimalModel = (d, species, root) => MODELS[species](d, root);

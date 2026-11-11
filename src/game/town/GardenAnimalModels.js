import { COZY_PALETTES } from '../../data/cozyArchitecture';
import { ERAS, eraEvolution } from '../../data/eras';
import { FUTURE_PALETTES } from '../../data/futureArchitecture';
import {
  WILLOWKIN_CROWNS,
  WILLOWKIN_ELDERS_FROM,
  WILLOWKIN_KEEPSAKES,
  WILLOWKIN_LEAVES,
} from '../../data/townAnimals';

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

function deer(d, root, { look }) {
  const { coat, light, form } = look;
  const body = d.group(root);
  body.scale.setScalar(look.size);
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
  if (form === 'stag')
    for (const side of [-1, 1]) {
      // Low, swept antlers stay inside the doe's height.
      const antler = d.group(head, side * 0.07, 0.12, -0.02);
      antler.name = 'Stag antler';
      d.rod(antler, [0, 0, 0], [side * 0.13, 0.17, -0.05], 0.018, '#d9c7a2');
      d.rod(antler, [side * 0.07, 0.09, -0.025], [side * 0.07, 0.2, 0.05], 0.014, '#d9c7a2');
      d.rod(antler, [side * 0.13, 0.17, -0.05], [side * 0.2, 0.21, 0.01], 0.013, '#d9c7a2');
    }
  else if (form === 'fawn')
    for (const [x, z] of [
      [-0.07, -0.12],
      [0.08, 0.02],
      [-0.05, 0.16],
      [0.06, -0.24],
    ])
      d.ball(body, x, 0.87, z, [0.035, 0.02, 0.04], light);
  const legs = quadruped(d, body, 0.58, 0.13, 0.25, coat, '#78634b');
  const tail = d.group(body, 0, 0.7, -0.37);
  d.ball(tail, 0, 0.015, -0.08, [0.065, 0.065, 0.12], light);
  return { root, body, head, legs, wings: [], tail };
}

function otter(d, root, { look }) {
  const { coat, light } = look;
  const body = d.group(root);
  body.scale.setScalar(look.size);
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

function hedgehog(d, root, { look }) {
  const body = d.group(root);
  body.scale.setScalar(look.size);
  d.ball(body, 0, 0.19, -0.04, [0.2, 0.18, 0.25], look.coat);
  // A handful of broad back plates gives a readable silhouette, not dense spines.
  for (let n = 0; n < 7; n++) {
    const x = Math.sin(n * 2.4) * 0.12,
      z = Math.cos(n * 2.4) * 0.15 - 0.07;
    const plate = d.mesh(
      body,
      'rock',
      [0.065, 0.12, 0.08],
      [x, 0.32, z],
      n % 2 ? look.dark : look.coat,
    );
    plate.rotation.z = x * -3;
  }
  const head = d.group(body, 0, 0.16, 0.19);
  d.ball(head, 0, 0, 0, [0.105, 0.105, 0.13], look.light);
  d.ball(head, 0, -0.02, 0.12, [0.045, 0.035, 0.06], '#554537');
  eyes(d, head, 0.068, 0.025, 0.085);
  const legs = quadruped(d, body, 0.06, 0.11, 0.14, look.coat, '#755e46');
  const tail = d.group(body);
  return { root, body, head, legs, wings: [], tail };
}

function hare(d, root, { look }) {
  const { coat, light } = look;
  const body = d.group(root);
  body.scale.setScalar(look.size);
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

function squirrel(d, root, { look }) {
  const { coat, light } = look;
  const body = d.group(root);
  body.scale.setScalar(look.size);
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

function badger(d, root, { look }) {
  const { coat, light, dark } = look;
  const body = d.group(root);
  body.scale.setScalar(look.size);
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

// The clothes and lights of a Willowkin take the colours of the era it lives in.
function eraPalette(era) {
  const profile = eraEvolution(era);
  const cozy = profile?.cozyStyle,
    future = profile?.architecture;
  if (cozy && Object.hasOwn(COZY_PALETTES, cozy)) return COZY_PALETTES[cozy];
  if (future && Object.hasOwn(FUTURE_PALETTES, future)) return FUTURE_PALETTES[future];
  return COZY_PALETTES.riverlight;
}
const eraAt = (era) => ERAS.findIndex(({ id }) => id === era);
/** Its own crown and leaf colour, and whether it has grown old, fixed by its seed. */
export function willowkinCharacter(variant = 0, era) {
  const seed = Math.abs(Math.trunc(variant));
  const leaf =
    WILLOWKIN_LEAVES[Math.floor(seed / WILLOWKIN_CROWNS.length) % WILLOWKIN_LEAVES.length];
  return {
    crown: WILLOWKIN_CROWNS[seed % WILLOWKIN_CROWNS.length],
    leaf: leaf === 'era' ? null : leaf,
    // One Willowkin in three has grown old once the first saplings are a century on.
    elder: seed % 3 === 1 && eraAt(era) >= eraAt(WILLOWKIN_ELDERS_FROM) && eraAt(era) >= 0,
    keepsake: WILLOWKIN_KEEPSAKES[eraEvolution(era)?.wardrobe] ?? null,
  };
}

// Three crowns on the same head: the sideways willow umbrella, a round crown in bloom
// and a tall plume. `reach` is how far the widest crown may spread from the head.
function willowCrown(d, head, crown, reach, leaf, deep, bloom, fronds) {
  if (crown === 'blossom') {
    for (const [x, y, z, size] of [
      [-0.12, 0.2, -0.03, [0.2, 0.15, 0.19]],
      [0.13, 0.22, -0.04, [0.2, 0.16, 0.19]],
      [0, 0.31, -0.02, [0.18, 0.13, 0.17]],
    ])
      d.mesh(head, 'rock', size, [x, y, z], leaf);
    for (const [x, y, z] of [
      [-0.2, 0.27, 0.1],
      [0.05, 0.4, 0.09],
      [0.24, 0.29, 0.08],
    ])
      d.mesh(head, 'rock', [0.04, 0.04, 0.04], [x, y, z], bloom);
  } else if (crown === 'plume') {
    for (const [x, y, size] of [
      [0, 0.2, [0.19, 0.12, 0.17]],
      [0.03, 0.31, [0.15, 0.11, 0.14]],
      [0.07, 0.4, [0.1, 0.08, 0.1]],
    ])
      d.mesh(head, 'rock', size, [x, y, -0.03], leaf);
    d.mesh(head, 'rock', [0.035, 0.04, 0.035], [0.12, 0.45, -0.03], bloom);
  } else {
    for (const [x, y, z, scale] of [
      [-0.21, 0.18, -0.06, [0.27, 0.15, 0.21]],
      [0.1, 0.25, -0.06, [0.28, 0.14, 0.22]],
      [0.3, 0.15, -0.065, [0.19, 0.13, 0.19]],
    ])
      d.mesh(head, 'rock', scale, [x, y, z], leaf);
    d.rod(head, [reach, 0.08, 0], [reach + 0.02, -0.065, 0], 0.013, '#dfc99e');
    d.mesh(head, 'rock', [0.045, 0.052, 0.045], [reach + 0.02, -0.11, 0], bloom);
  }
  // Hanging fronds; an elder's have grown long.
  const side = crown === 'umbrella' ? -reach : -0.22;
  for (let n = 0; n < fronds; n++)
    d.mesh(head, 'rock', [0.035, 0.058, 0.022], [side, 0.05 - n * 0.085, 0], deep);
}

function willowkin(d, root, { variant = 0, era } = {}) {
  const wood = '#dfc99e',
    character = willowkinCharacter(variant, era),
    leaf = character.leaf ?? '#8da572',
    deep = '#728b60';
  const body = d.group(root);
  // The youngest are seedlings, a head shorter than their friends.
  if (Math.abs(Math.trunc(variant)) % 4 === 3) body.scale.setScalar(0.74);
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

function willowkinResident(d, root, { variant = 0, era } = {}) {
  const p = eraPalette(era),
    character = willowkinCharacter(variant, era),
    wood = character.elder ? '#c8b088' : '#dfc99e',
    leaf = character.leaf ?? p.green;
  root.userData.willowkin = character;
  const body = d.group(root);
  d.ball(body, 0, 0.91, 0, [0.175, 0.34, 0.14], wood);
  d.rod(body, [0, 1.12, 0], [0, 1.4, 0], 0.067, wood);
  const head = d.group(body, 0, 1.48, 0);
  head.name = 'Willowkin resident willow crown';
  d.ball(head, 0, 0, 0, [0.13, 0.17, 0.1], wood);
  eyes(d, head, 0.046, 0.012, 0.094, '#b88848');
  d.rod(head, [-0.027, -0.059, 0.096], [0, -0.069, 0.104], 0.007, '#92724e');
  d.rod(head, [0, -0.069, 0.104], [0.027, -0.059, 0.096], 0.007, '#92724e');
  // The mature crown folds close to the head so it fits ordinary sidewalks.
  willowCrown(d, head, character.crown, 0.43, leaf, p.deep, p.flower, character.elder ? 5 : 3);
  if (character.elder) {
    // Moss on the shoulders and a long brow: the saplings of the Canopy Age, grown old.
    for (const side of [-1, 1]) {
      d.mesh(body, 'rock', [0.07, 0.035, 0.06], [side * 0.13, 1.17, -0.02], p.green);
      d.rod(head, [side * 0.02, 0.055, 0.098], [side * 0.085, 0.035, 0.085], 0.009, '#f1ead8');
    }
    d.mesh(head, 'rock', [0.05, 0.1, 0.03], [0, -0.13, 0.07], '#f1ead8').name =
      'Willowkin elder beard';
  }

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
    d.mesh(arm, 'rock', [0.07, 0.1, 0.03], [side * 0.16, -0.52, 0.025], leaf);
    arms.push(arm);
  }
  // What the period gave it to carry.
  const keepsake = d.group(body);
  keepsake.name = 'Willowkin keepsake';
  if (character.keepsake === 'sail') {
    const sail = d.box(keepsake, 0.3, 0.42, 0.015, 0, 0.98, -0.15, p.shell);
    sail.rotation.x = 0.14;
    d.box(keepsake, 0.3, 0.03, 0.02, 0, 1.2, -0.12, p.flower);
  } else if (character.keepsake === 'lantern') {
    d.rod(arms[0], [-0.16, -0.5, 0.03], [-0.16, -0.62, 0.03], 0.008, p.timber);
    d.mesh(arms[0], 'rock', [0.045, 0.06, 0.045], [-0.16, -0.68, 0.03], p.light);
    d.mesh(arms[0], 'cylinder', [0.04, 0.015, 0.04], [-0.16, -0.625, 0.03], p.timber);
  } else if (character.keepsake === 'visor') {
    d.mesh(head, 'cylinder', [0.135, 0.03, 0.105], [0, 0.03, 0.005], p.light);
    d.box(keepsake, 0.2, 0.2, 0.08, 0, 1.0, -0.16, p.shell, true);
  } else if (character.keepsake === 'twinLights') {
    d.mesh(keepsake, 'rock', [0.03, 0.04, 0.03], [-0.07, 1.16, 0.16], p.flower);
    d.mesh(keepsake, 'rock', [0.03, 0.04, 0.03], [0.0, 1.13, 0.165], p.light);
  } else if (character.keepsake === 'cap') {
    d.mesh(head, 'cylinder', [0.115, 0.06, 0.1], [0, 0.12, 0.01], '#5b8fc9');
    d.box(head, 0.14, 0.02, 0.08, 0, 0.1, 0.1, '#5b8fc9', true);
  } else if (character.keepsake === 'longScarf') {
    d.box(keepsake, 0.06, 0.4, 0.025, -0.07, 1.05, 0.158, '#f3ecd9');
  }
  if (character.elder) {
    d.rod(arms[1], [0.16, -0.5, 0.05], [0.16, -1.06, 0.12], 0.014, '#a98a5c').name =
      'Willowkin elder staff';
    d.mesh(arms[1], 'rock', [0.03, 0.04, 0.03], [0.16, -0.46, 0.045], p.light);
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
const PLAIN = Object.freeze({ size: 1 });
/** `options` carries the animal's look, its own seed (`variant`) and the town's era. */
export const gardenAnimalModel = (d, species, root, options = {}) =>
  MODELS[species](d, root, { look: PLAIN, ...options });

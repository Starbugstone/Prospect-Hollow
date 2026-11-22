import { Vector3 } from 'three';
import { BUILDINGS } from '../../data/town';
import { HOME_SETTLEMENT, MOON_SETTLEMENT, settlementPlaces } from '../../data/settlements';
import { swingLimbs } from './TownGait';
import { findHash } from './TownHiddenFinds';
import { plotInEra } from './TownEras';
import { RACCOON_EYE, raccoonGeometries, raccoonHeadPoint } from './TownRaccoonGeometries';
import { hiddenFindOut } from './TownRules';

// The wandering pair: a raccoon who walks upright and the Willowkin it never leaves. They
// are the `wanderers` hidden find (src/data/hiddenFinds.js): after each completed puzzle
// they are strolling either the valley or New Hollow on the Moon.
export const WANDERERS = 'wanderers';
const point = new Vector3();
const runs = (town) =>
  Number.isSafeInteger(town?.completedRuns) && town.completedRuns > 0 ? town.completedRuns : 0;

/**
 * The settlement the pair walks after this town's completed puzzles, or null before
 * their debut era. Owner and visitors derive it from the same public town (its era,
 * its plots and `completedRuns`), so they agree without any stored choice. The Moon only
 * counts once the town can build there.
 */
export function wanderersPlace(town) {
  if (!hiddenFindOut(town, WANDERERS)) return null;
  const moon = settlementPlaces(MOON_SETTLEMENT, BUILDINGS).some(({ id }) => plotInEra(town, id));
  return moon && findHash(runs(town) + 977) % 2 ? MOON_SETTLEMENT : HOME_SETTLEMENT;
}

const COAT = '#8f8a7c',
  LIGHT = '#e6dfca',
  MASK = '#45413d',
  INK = '#16171a',
  SHINE = '#ffffff',
  EAR = '#ecd2c2',
  SUIT = '#ece5d3',
  BOOT = '#c9504a',
  PACK = '#b9c2c9',
  SCARF = '#d9a441';
export const RACCOON_HEIGHT = 0.98;
const HIP = 0.27;
const HEAD = [0.19, 0.165, 0.165];
const EAR_TILT = 0.38;
// Fur tufts on each cheek: [out, up, forward, lean from upright, length, width, colour].
const TUFTS = [
  [0.17, 0.005, 0.01, 1.2, 0.085, 0.075, COAT],
  [0.16, -0.05, 0.035, 1.65, 0.1, 0.085, LIGHT],
  [0.135, -0.092, 0.04, 2.1, 0.085, 0.075, LIGHT],
];
// The tail from rump to tip: [up, back, radius], a ring to each band.
const TAIL = [
  [0, -0.03, 0.06],
  [0.03, -0.1, 0.075],
  [0.09, -0.16, 0.086],
  [0.17, -0.2, 0.092],
  [0.26, -0.215, 0.092],
  [0.345, -0.235, 0.083],
  [0.415, -0.275, 0.07],
  [0.465, -0.33, 0.052],
];
const TAIL_TIP = 4,
  TAIL_LEAN = 0.42;
const PUFF = 'raccoonPuff';

/**
 * The raccoon, upright on the valley villager's skeleton (body at hip height, `{ upper,
 * lower }` arms and legs) so the shared walk cycle drives it: a big head with a bandit
 * mask that wraps round its eyes, cheek tufts, gloved paws and a ringed tail carried up
 * in a curl. In the valley it wears a mustard neckerchief; `glass` (the space helmet's
 * material) dresses it for the Moon in a suit, boots and a bubble, with its tail left out
 * behind. Each rigid part is merged into one mesh per colour.
 */
export function uprightRaccoon(d, parent, glass = null) {
  raccoonGeometries(d);
  const root = d.group(parent);
  root.name = 'Upright raccoon';
  const cloth = glass ? SUIT : COAT,
    glove = glass ? BOOT : MASK;
  const parts = [];
  const part = (...at) => {
    const group = d.group(...at);
    group.userData.animated = true;
    parts.push(group);
    return group;
  };
  const body = part(root, 0, HIP, 0);
  const torso = part(body);
  // A pear of a body with narrow shoulders, and a pale front.
  d.ball(torso, 0, 0.13, 0, [0.15, 0.17, 0.13], cloth);
  d.ball(torso, 0, 0.235, 0, [0.115, 0.09, 0.105], cloth);
  if (glass) {
    d.box(torso, 0.17, 0.18, 0.07, 0, 0.17, -0.125, PACK, true);
    d.box(torso, 0.1, 0.07, 0.03, 0, 0.16, 0.122, PACK, true);
    d.ball(torso, -0.022, 0.16, 0.14, 0.012, BOOT);
    d.ball(torso, 0.02, 0.16, 0.14, 0.012, SCARF);
    d.mesh(torso, 'cylinder', [0.118, 0.035, 0.108], [0, 0.305, 0.005], BOOT);
  } else {
    d.ball(torso, 0, 0.12, 0.045, [0.105, 0.135, 0.1], LIGHT);
    // The neckerchief: a band, a corner hanging on the chest and a knot behind.
    d.mesh(torso, 'cylinder', [0.118, 0.04, 0.108], [0, 0.3, 0.005], SCARF);
    d.mesh(torso, 'raccoonTuft', [0.2, 0.14, 0.05], [0, 0.31, 0.092], SCARF).rotation.x =
      Math.PI - 0.3;
    d.ball(torso, 0, 0.3, -0.108, 0.028, SCARF);
    for (const side of [-1, 1])
      d.mesh(torso, 'rock', [0.02, 0.045, 0.012], [side * 0.03, 0.262, -0.12], SCARF).rotation.z =
        side * 0.45;
  }

  const head = part(torso, 0, 0.46, 0.02);
  d.mesh(head, 'raccoonHead', HEAD, [0, 0, 0], COAT);
  d.mesh(head, 'raccoonMask', HEAD, [0, 0, 0], MASK);
  d.mesh(head, 'raccoonBlaze', HEAD, [0, 0, 0], MASK);
  d.mesh(head, 'raccoonPale', HEAD, [0, 0, 0], LIGHT);
  // A quiff between the ears.
  for (const [x, lean] of [
    [-0.018, 0.35],
    [0.014, -0.2],
  ])
    d.mesh(head, 'raccoonTuft', [0.04, 0.06, 0.035], [x, 0.135, 0.04], COAT).rotation.set(
      0.5,
      0,
      lean,
    );
  // A short pale muzzle, a button nose and a small smile.
  d.ball(head, 0, -0.048, 0.132, [0.072, 0.052, 0.062], LIGHT);
  d.ball(head, 0, -0.024, 0.189, [0.027, 0.02, 0.018], INK, PUFF);
  for (const side of [-1, 1])
    d.box(head, 0.03, 0.007, 0.01, side * 0.012, -0.056, 0.187, MASK).rotation.z = side * 0.45;
  const eye = raccoonHeadPoint(...RACCOON_EYE).multiply(point.set(...HEAD));
  const ears = [-1, 1].map((side) => {
    const socket = d.ball(head, side * eye.x, eye.y, eye.z, [0.035, 0.04, 0.02], INK, PUFF);
    socket.rotation.y = side * RACCOON_EYE[0] * (Math.PI / 180);
    // The catch-light sits on the same side of both eyes, as one light would put it.
    d.ball(head, side * eye.x + 0.011, eye.y + 0.013, eye.z + 0.016, 0.011, SHINE, PUFF);
    d.ball(head, side * eye.x - 0.01, eye.y - 0.011, eye.z + 0.017, 0.005, SHINE, 'rock');
    for (const [out, up, forward, lean, length, width, color] of TUFTS)
      d.mesh(
        head,
        'raccoonTuft',
        [width, length, width * 0.8],
        [side * out, up, forward],
        color,
      ).rotation.z = -side * lean;
    // Round ears: a dark rim behind a pale inner ear.
    const ear = part(head, side * 0.122, 0.118, -0.01);
    ear.rotation.z = -side * EAR_TILT;
    d.ball(ear, 0, 0.04, 0, [0.064, 0.066, 0.028], MASK, PUFF);
    d.ball(ear, 0, 0.036, 0.014, [0.042, 0.044, 0.018], EAR, PUFF);
    return ear;
  });
  if (glass) d.ball(head, 0, 0.03, 0.01, 0.275, '#dff3f4').material = glass;

  // Soft, tapering limbs: each joint is one rounded piece that overlaps the next.
  const limb = (parent, x, y, radius, upperLength, lowerLength, end) => {
    const upper = part(parent, x, y, 0);
    d.ball(
      upper,
      0,
      -upperLength / 2,
      0,
      [radius, upperLength / 2 + radius * 0.9, radius],
      cloth,
      PUFF,
    );
    const lower = part(upper, 0, -upperLength, 0);
    const slim = radius * 0.94;
    d.ball(lower, 0, -lowerLength / 2, 0, [slim, lowerLength / 2 + slim * 0.8, slim], cloth, PUFF);
    end(lower, -lowerLength);
    return { upper, lower };
  };
  const arms = [-1, 1].map((side) =>
    limb(torso, side * 0.148, 0.25, 0.038, 0.1, 0.085, (lower, y) =>
      d.ball(lower, 0, y - 0.012, 0.008, [0.04, 0.042, 0.044], glove, PUFF),
    ),
  );
  const legs = [-1, 1].map((side) =>
    limb(body, side * 0.074, 0, 0.056, 0.115, 0.1, (lower, y) =>
      d.ball(lower, 0, y - 0.018, 0.034, [0.054, 0.034, 0.08], glove, PUFF),
    ),
  );

  // The ringed tail rises behind and flicks back at the tip; the tip half trails the base.
  const tail = part(body, 0, 0.04, -0.1);
  const tailTip = part(tail, 0, TAIL[TAIL_TIP][0], TAIL[TAIL_TIP][1]);
  TAIL.forEach(([up, back, radius], n) => {
    const tip = n >= TAIL_TIP;
    d.ball(
      tip ? tailTip : tail,
      0,
      up - (tip ? TAIL[TAIL_TIP][0] : 0),
      back - (tip ? TAIL[TAIL_TIP][1] : 0),
      radius,
      n % 2 ? MASK : COAT,
    );
  });
  for (const group of parts) d.batch(group);
  d.contactShadow(root, 0.22, 0.32);
  return {
    root,
    body,
    torso,
    head,
    ears,
    arms,
    legs,
    tail,
    tailTip,
    // Decorative motion follows the map's reduced-motion setting.
    calm: () => !!d.reducedMotion,
  };
}

const EAR_EVERY = 3.7,
  EAR_FLICK = 0.32;
/**
 * The shared walk cycle on the raccoon: `step` turns once per stride. Its own touches
 * (a swaying tail, an ear flick, a look up at its friend) rest under reduced motion.
 */
export function strideRaccoon(raccoon, step, walking, time = step) {
  const { body, head, ears, arms, legs, tail, tailTip } = raccoon;
  body.position.y = HIP + (walking ? Math.abs(Math.sin(step)) * 0.02 : 0);
  swingLimbs(arms, legs, step, walking);
  const lively = !raccoon.calm?.();
  // The Willowkin walks on its left: it looks up there now and then, and when they stop.
  const look = !lively ? 0.35 : walking ? Math.max(0, Math.sin(time * 0.45)) ** 2 : 1;
  head.rotation.set(look * -0.26, look * 0.5, look * -0.1);
  const sway = lively ? Math.sin(time * 1.7) : 0;
  // The tail leans out to the raccoon's right, where it shows from the front.
  tail.rotation.set(lively && walking ? Math.sin(step * 0.5) * 0.07 : 0, sway * 0.2, TAIL_LEAN);
  tailTip.rotation.set(0, 0, lively ? Math.sin(time * 1.7 - 0.9) * 0.22 : 0);
  const beat = ((time % EAR_EVERY) + EAR_EVERY) % EAR_EVERY;
  const flick = lively && beat < EAR_FLICK ? Math.sin((beat / EAR_FLICK) * Math.PI * 2) : 0;
  const turn = Math.floor(time / EAR_EVERY) & 1;
  ears.forEach((ear, n) => {
    ear.rotation.z = (n ? -1 : 1) * (EAR_TILT - (n === turn ? flick * 0.3 : 0));
  });
}

/**
 * The valley's tap targets for the pair (see `hiddenFindTap`): the raccoon and its
 * Willowkin both answer, while they are in the valley.
 */
export function wanderersTargets(animals = []) {
  return animals
    .filter((animal) => animal.species === WANDERERS && animal.root.visible && !animal.away)
    .flatMap(pairTargets);
}
export const pairTargets = ({ raccoon, willowkin }) => [
  { root: raccoon.root, height: RACCOON_HEIGHT, find: WANDERERS, hint: WANDERERS },
  { root: willowkin.root, height: 1.9, find: WANDERERS, hint: WANDERERS },
];

/** Shows the valley's pair when this town's completed puzzles put them here. */
export function placeWanderers(d, town) {
  const here = wanderersPlace(town) === HOME_SETTLEMENT;
  for (const animal of d.animals ?? []) {
    if (animal.species !== WANDERERS) continue;
    animal.away = !here;
    animal.root.visible = here;
  }
}

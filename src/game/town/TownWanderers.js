import { BUILDINGS } from '../../data/town';
import { HOME_SETTLEMENT, MOON_SETTLEMENT, settlementPlaces } from '../../data/settlements';
import { swingLimbs } from './TownGait';
import { findHash } from './TownHiddenFinds';
import { plotInEra } from './TownEras';
import { hiddenFindOut } from './TownRules';

// The wandering pair: a raccoon who walks upright and the Willowkin it never leaves. They
// are the `wanderers` hidden find (src/data/hiddenFinds.js): after each completed puzzle
// they are strolling either the valley or New Hollow on the Moon.
export const WANDERERS = 'wanderers';
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
  LIGHT = '#ddd6c0',
  MASK = '#3b3835',
  SUIT = '#ece5d3',
  BOOT = '#c9504a',
  SCARF = '#d9a441';
export const RACCOON_HEIGHT = 0.98;
const HIP = 0.33;

/**
 * The raccoon, upright on the valley villager's skeleton (body at hip height, `{ upper,
 * lower }` arms and legs) so the shared walk cycle drives it. In the valley it wears a
 * mustard neckerchief; `glass` (the space helmet's material) dresses it for the Moon in a
 * suit, boots and a bubble, with its ringed tail left out behind.
 */
export function uprightRaccoon(d, parent, glass = null) {
  const root = d.group(parent);
  root.name = 'Upright raccoon';
  const cloth = glass ? SUIT : COAT;
  const body = d.group(root, 0, HIP, 0);
  const torso = d.group(body);
  d.ball(torso, 0, 0.17, 0, [0.15, 0.2, 0.13], cloth);
  if (!glass) d.ball(torso, 0, 0.15, 0.06, [0.1, 0.15, 0.08], LIGHT);
  d.mesh(torso, 'cylinder', [0.1, 0.035, 0.09], [0, 0.34, 0.01], glass ? BOOT : SCARF);
  if (!glass) d.box(torso, 0.05, 0.11, 0.02, 0.05, 0.28, 0.1, SCARF);
  else d.box(torso, 0.17, 0.2, 0.08, 0, 0.2, -0.13, '#b9c2c9');
  const head = d.group(torso, 0, 0.47, 0.02);
  d.ball(head, 0, 0, 0, [0.15, 0.125, 0.13], COAT);
  d.ball(head, 0, -0.035, 0.09, [0.075, 0.06, 0.075], LIGHT);
  d.ball(head, 0, -0.02, 0.165, 0.022, MASK);
  for (const side of [-1, 1]) {
    d.ball(head, side * 0.065, 0.02, 0.1, [0.055, 0.04, 0.035], MASK);
    d.ball(head, side * 0.06, 0.025, 0.128, 0.014, '#f4efe2');
    d.ball(head, side * 0.1, 0.11, 0, [0.04, 0.05, 0.025], COAT);
    d.ball(head, side * 0.1, 0.108, 0.012, [0.022, 0.03, 0.015], LIGHT);
  }
  d.ball(head, 0, 0.075, 0.07, [0.05, 0.03, 0.05], LIGHT);
  if (glass) d.ball(head, 0, 0.02, 0.02, 0.225, '#dff3f4').material = glass;
  const arms = [-1, 1].map((side) => {
    const upper = d.group(torso, side * 0.155, 0.29, 0);
    d.rod(upper, [0, 0, 0], [0, -0.13, 0], 0.036, cloth);
    const lower = d.group(upper, 0, -0.13, 0);
    d.rod(lower, [0, 0, 0], [0, -0.11, 0.01], 0.032, cloth);
    d.ball(lower, 0, -0.125, 0.015, 0.036, glass ? BOOT : MASK);
    return { upper, lower };
  });
  const legs = [-1, 1].map((side) => {
    const upper = d.group(body, side * 0.075, 0.02, 0);
    d.rod(upper, [0, 0, 0], [0, -0.16, 0], 0.046, cloth);
    const lower = d.group(upper, 0, -0.16, 0);
    d.rod(lower, [0, 0, 0], [0, -0.14, 0], 0.038, cloth);
    d.ball(lower, 0, -0.155, 0.03, [0.045, 0.03, 0.07], glass ? BOOT : MASK);
    return { upper, lower };
  });
  // The ringed tail curls up behind, a ring to each band.
  const tail = d.group(body, 0, 0.06, -0.11);
  for (let n = 0; n < 6; n++)
    d.ball(
      tail,
      0,
      0.02 + n * 0.05,
      -0.05 - n * 0.045 + n * n * 0.004,
      0.062 - Math.abs(n - 2.5) * 0.006,
      n % 2 ? MASK : COAT,
    );
  d.contactShadow(root, 0.2, 0.3);
  return { root, body, torso, head, arms, legs, tail };
}

/** The shared walk cycle on the raccoon: `step` turns once per stride. */
export function strideRaccoon({ body, head, arms, legs, tail }, step, walking, time = step) {
  body.position.y = HIP + (walking ? Math.abs(Math.sin(step)) * 0.02 : 0);
  swingLimbs(arms, legs, step, walking);
  tail.rotation.x = Math.sin(step * 0.5) * 0.12;
  // Now and then it looks up at its tall friend, who walks on its left.
  head.rotation.y = walking ? Math.sin(time * 0.13) * 0.18 - 0.1 : -0.55;
  head.rotation.x = walking ? 0 : -0.3;
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

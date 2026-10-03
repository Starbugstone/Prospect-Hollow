import { SPACE_HELMET } from '../../data/townAnimals';
import { eraIndex } from './TownEras';
import { animalModel } from './TownAnimalModels';
import { smooth01 } from './TownMath';

const COSTUME = 'space-helmet',
  // Seconds to shrink the old outfit away, then to grow the new one back.
  SWAP = 0.35;

// An integer hash, so the owner's and every visitor's browser agree exactly.
function hash(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return (x ^ (x >>> 16)) >>> 0;
}
function shuffled(list, round) {
  const order = [...list];
  for (let n = order.length - 1; n > 0; n--) {
    const pick = hash(round * 64 + n) % (n + 1);
    [order[n], order[pick]] = [order[pick], order[n]];
  }
  return order;
}

/**
 * The species wearing the space helmet after `completedRuns` puzzles, chosen among the
 * wearers present in `cast`, or null before its debut era. Each round visits every
 * present wearer once in a shuffled order, and no animal wears it twice in a row.
 * Owner and visitors derive it from the same public town, so they agree without
 * any stored choice.
 */
export function spaceHelmetWearer(town, cast) {
  const index = eraIndex(town?.era);
  if (index < 0 || index < eraIndex(SPACE_HELMET.debut)) return null;
  const candidates = SPACE_HELMET.wearers.filter((species) => cast.has(species));
  if (candidates.length < 3) return candidates[(runs(town) % 2) % candidates.length] ?? null;
  const count = candidates.length,
    round = Math.floor(runs(town) / count),
    order = shuffled(candidates, round);
  // Only a round's first pick can repeat the previous round's last one.
  if (round > 0 && order[0] === shuffled(candidates, round - 1)[count - 1])
    [order[0], order[1]] = [order[1], order[0]];
  return order[runs(town) % count];
}
const runs = (town) =>
  Number.isSafeInteger(town?.completedRuns) && town.completedRuns > 0 ? town.completedRuns : 0;

// Rebuilds one animal's model with or without the costume, in place on its walk.
function restyle(d, animal, costume) {
  const old = animal.root,
    model = animalModel(d, animal.species, animal.seed, costume);
  model.root.position.copy(old.position);
  model.root.quaternion.copy(old.quaternion);
  model.root.scale.copy(old.scale);
  model.root.visible = old.visible;
  model.root.userData.behavior = old.userData.behavior;
  if (old.parent && model.root.parent !== old.parent) old.parent.add(model.root);
  d.clearGroup(old);
  Object.assign(animal, model, { costume });
}

/**
 * Gives the helmet to this town's wearer and takes it from anyone else. An animal
 * already on screen shrinks away and grows back in its new outfit when `animate`
 * (a visitor watching the owner's progress); otherwise the change is immediate.
 * A fresh cast leaves `rebuild` to its caller, which registers every new animal.
 */
export function dressSpaceHelmet(d, town, { animate = false, rebuild = true } = {}) {
  const animals = d.animals ?? [];
  const species = spaceHelmetWearer(town, new Set(animals.map((a) => a.species)));
  const wearer = animals.find((a) => a.species === species);
  let changed = false;
  for (const animal of animals) {
    const costume = animal === wearer ? COSTUME : null;
    const current = animal.dressing ? animal.dressing.costume : (animal.costume ?? null);
    if (current === costume) {
      animal.dressed = true;
      continue;
    }
    if (animate && animal.dressed && animal.root.visible && d.motionEnabled !== false) {
      animal.dressing = { costume, start: null, swapped: false };
      continue;
    }
    if (animal.dressing) animal.body.scale.setScalar(1);
    animal.dressing = null;
    if ((animal.costume ?? null) !== costume) {
      restyle(d, animal, costume);
      changed = true;
    }
    animal.dressed = true;
  }
  if (changed && rebuild) {
    d.rebuildActors?.();
    d.render?.();
  }
}

/** Advances a visitor-view outfit change on the diorama clock. */
export function updateDressing(d, animal, time) {
  const dressing = animal.dressing;
  dressing.start ??= time;
  const t = time - dressing.start;
  if (!dressing.swapped && t >= SWAP) {
    // A change back during the swap may already match the current outfit.
    if ((animal.costume ?? null) !== dressing.costume) {
      restyle(d, animal, dressing.costume);
      d.rebuildActors?.();
    }
    dressing.swapped = true;
    dressing.start = time - SWAP;
  }
  const scale = dressing.swapped ? smooth01(t / SWAP - 1) : 1 - smooth01(t / SWAP);
  animal.body.scale.setScalar(Math.max(0.001, scale));
  if (dressing.swapped && t >= 2 * SWAP) {
    animal.body.scale.setScalar(1);
    animal.dressing = null;
  }
}

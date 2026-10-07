import { Vector3 } from 'three';
import { SPACE_HELMET, TOWN_ANIMALS } from '../../data/townAnimals';
import { spaceHelmetOut } from './TownRules';
import { animalModel } from './TownAnimalModels';
import { smooth01 } from './TownMath';

const COSTUME = 'space-helmet',
  // Seconds to shrink the old outfit away, then to grow the new one back.
  SWAP = 0.35,
  // Seconds for a wild wearer to come out, or to go back to its own visits.
  STAY = 2;

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
  if (!spaceHelmetOut(town)) return null;
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

// The outfit an animal wears, or is changing into.
const outfit = (animal) => (animal.dressing ? animal.dressing.costume : (animal.costume ?? null));

/**
 * Wild animals only visit the town now and then, so a wild wearer stays out for as
 * long as it has the helmet and players can always find it. Returns how far it is held
 * out, from 0 to 1: it eases in with the helmet and back to its own visits without it.
 */
export function helmetStay(animal, dt) {
  const stay = animal.helmetStay ?? 0,
    step = dt / STAY;
  animal.helmetStay =
    outfit(animal) === COSTUME ? Math.min(1, stay + step) : Math.max(0, stay - step);
  return smooth01(animal.helmetStay);
}

const feet = new Vector3(),
  head = new Vector3();
/**
 * Where the helmet wearer is on the canvas, in percent, when a click lands on it; else
 * null. Animals are small and keep moving, so the hit area reaches past the body. An
 * animal still changing outfits or hidden on its wild visits cannot be found.
 */
export function spaceHelmetAt(d, clientX, clientY) {
  const animal = d.animals?.find((a) => a.costume === COSTUME && !a.dressing);
  const root = animal?.root;
  if (!root?.visible || root.scale.x < 0.5) return null;
  const rect = d.canvas.getBoundingClientRect();
  const toScreen = (p) => [
    rect.left + ((p.x + 1) * rect.width) / 2,
    rect.top + ((1 - p.y) * rect.height) / 2,
  ];
  feet.copy(root.position).project(d.camera);
  head.copy(root.position);
  head.y += (TOWN_ANIMALS[animal.species]?.height ?? 1) * root.scale.y;
  head.project(d.camera);
  if (feet.z < -1 || feet.z > 1) return null;
  const [fx, fy] = toScreen(feet),
    [hx, hy] = toScreen(head);
  const x = (fx + hx) / 2,
    y = (fy + hy) / 2,
    reach = Math.max(28, Math.hypot(hx - fx, hy - fy) / 2 + 14);
  if (Math.hypot(clientX - x, clientY - y) > reach) return null;
  return {
    x: ((x - rect.left) / rect.width) * 100,
    y: ((y - rect.top) / rect.height) * 100,
  };
}

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
  // A finished puzzle changes no building, so the scene can keep an older town object;
  // later animal refreshes dress for this latest one instead.
  d.helmetTown = town;
  const animals = d.animals ?? [];
  const species = spaceHelmetWearer(town, new Set(animals.map((a) => a.species)));
  const wearer = animals.find((a) => a.species === species);
  let changed = false;
  for (const animal of animals) {
    const costume = animal === wearer ? COSTUME : null;
    if (outfit(animal) === costume) {
      animal.dressed = true;
      continue;
    }
    if (animate && animal.dressed && animal.root.visible && d.motionEnabled !== false) {
      animal.dressing = { costume, start: null, swapped: false };
      continue;
    }
    if (animal.dressing) resize(animal, 1);
    animal.dressing = null;
    // A wild wearer is already out when the town opens or changes unwatched.
    if (!animate || !animal.dressed) animal.helmetStay = costume ? 1 : 0;
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

// The contact shadow shrinks with the body, so no empty shadow is left behind.
function resize(animal, scale) {
  animal.body.scale.setScalar(scale);
  const { shadow } = animal;
  if (!shadow) return;
  const base = (shadow.userData.baseScale ??= shadow.scale.clone());
  shadow.scale.set(base.x * scale, base.y * scale, base.z);
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
  resize(animal, Math.max(0.001, scale));
  if (dressing.swapped && t >= 2 * SWAP) {
    resize(animal, 1);
    animal.dressing = null;
  }
}

import { ANIMAL_CHASES, flyingAnimal } from '../../data/townAnimals';
import { hash01 } from './TownMath';
import { prepareAnimalChase } from './TownAnimalChase';

const CHECK_INTERVAL = 0.25;
const visible = (a) => !!a.root?.visible && a.root.scale.x > 0.95;
const distanceSquared = (a, b) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;

// The population is bounded. Build just the permitted pairs once, rather than
// scanning people/scenery or constructing a second spatial index every frame.
export function createAnimalBehavior(animals, navigation, space, time = 0) {
  for (const a of animals) a.encounter = null;
  const pairs = [];
  for (const rule of ANIMAL_CHASES)
    for (const predator of animals.filter((a) => a.species === rule.predator))
      for (const prey of animals.filter((a) => rule.prey.includes(a.species)))
        pairs.push({
          ...rule,
          predator,
          prey,
          bird: flyingAnimal(prey.species),
          goal: { x: 0, y: 0, z: 0 },
          from: [0, 0, 0],
          to: [0, 0, 0],
        });
  return {
    pairs,
    navigation,
    space,
    active: null,
    nextCheck: time + 0.5,
    cursor: 0,
    checks: 0,
    starts: 0,
    previous: time,
  };
}

function finishEncounter(ai, time) {
  const pair = ai.active;
  for (const a of [pair.predator, pair.prey]) {
    a.encounter = null;
    a.chaseCooldown = time + 20 + hash01(a.seed + ai.starts) * 12;
    a.rest = Math.max(a.rest ?? 0, 0.8);
  }
  ai.active = null;
}

export function updateAnimalBehavior(ai, time) {
  if (!ai || time <= ai.previous) return;
  ai.previous = time;
  if (ai.active) {
    const pair = ai.active;
    const { predator, prey } = pair;
    // Stop at a deadline, after separation, or when either visitor leaves. A
    // bird's last ground position is the cat's goal, never its airborne body.
    if (
      time >= pair.endsAt ||
      !visible(predator) ||
      !visible(prey) ||
      (!pair.bird && distanceSquared(predator.root.position, prey.root.position) > 64)
    )
      finishEncounter(ai, time);
    return;
  }
  if (!ai.pairs.length || time < ai.nextCheck) return;
  // No catch-up after a slow frame or a hidden tab: at most one pair per tick.
  ai.nextCheck = time + CHECK_INTERVAL;
  const pair = ai.pairs[ai.cursor++ % ai.pairs.length];
  ai.checks++;
  const { predator, prey } = pair;
  if (
    !visible(predator) ||
    !visible(prey) ||
    predator.chaseRoute ||
    prey.chaseRoute ||
    time < (predator.chaseCooldown ?? 0) ||
    time < (prey.chaseCooldown ?? 0) ||
    predator.state === 'alert' ||
    prey.state === 'alert' ||
    (pair.bird && (prey.flight || prey.habitat?.kind !== 'ground'))
  )
    return;
  const from = predator.root.position,
    to = prey.root.position;
  if (Math.abs(from.y - to.y) >= 0.8 || distanceSquared(from, to) > pair.range ** 2) return;
  pair.from[0] = from.x;
  pair.from[1] = from.y;
  pair.from[2] = from.z;
  pair.to[0] = to.x;
  pair.to[1] = from.y;
  pair.to[2] = to.z;
  // The corridor preparation also checks sight between the participants using
  // short swept bodies, so scenery beside a diagonal does not block the chase.
  pair.goal.x = to.x;
  pair.goal.y = to.y;
  pair.goal.z = to.z;
  if (!prepareAnimalChase(pair, ai.navigation, ai.space)) {
    predator.chaseCooldown = prey.chaseCooldown = time + 2;
    return;
  }
  pair.started = time;
  pair.endsAt = time + pair.duration;
  predator.encounter = prey.encounter = pair;
  predator.rest = prey.rest = 0;
  ai.active = pair;
  ai.starts++;
}

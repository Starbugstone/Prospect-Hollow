import { townWardrobe } from '../../data/townWardrobes';
import { scheduleWork } from '../PresentationWork';
import { AnimalSpaceBuilder } from './TownAnimalSpace';
import { Group, Vector3 } from 'three';
import { ANIMAL_HABITATS, TOWN_ANIMALS } from '../../data/townAnimals';
import { eraEvolution } from '../../data/eras';
import { atPlot, PLOTS, plotStreet, routeGraph, routeOnGraph } from './TownLayout';
import { TownNavigation, walkPose } from './TownNavigation';
import { groundHeight } from './TownLandscape';
import { population } from './TownRules';
import { animalModel, animateAnimal } from './TownAnimalModels';
import { animalNavigation, animalSpace } from './TownAnimalSpace';
import { setWorkRoutine } from './TownWorkRoutine';
import { buildingWalk } from './TownPedestrians';
import { prepareBirdApproaches, createBirdFlight, birdFlightPose } from './TownBirdFlight';

const clamp = (n) => Math.max(0, Math.min(1, n));
const smooth = (n) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};
const random = (seed) => {
  const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

function landingPoint(d, nav, point) {
  let safe = point;
  for (let n = 0; n < 4; n++) {
    safe = nav.safePoint(safe, 0.55, 0.7, true);
    if (!safe) return null;
    if (d.animalSpace) safe[1] = d.animalSpace.groundY(safe) + 0.02;
    if (nav.clear(safe, 0.55, 0.7) && (!d.animalSpace || d.animalSpace.openSky(safe))) return safe;
  }
  return null;
}

export function animalHabitats(d, town) {
  const work = prepareHabitats(d, town);
  let step;
  do {
    step = work.next();
  } while (!step.done);
  return step.value;
}
function* prepareHabitats(d, town) {
  const nav = d.animalNavigation ?? d.navigation ?? new TownNavigation(),
    habitats = [];
  for (const definition of ANIMAL_HABITATS) {
    if (!town.buildings[definition.building]) continue;
    const { building, point } = definition,
      [x, z] = atPlot(building, point[0], point[2]);
    const safe = landingPoint(d, nav, [x, point[1], z]);
    if (safe) habitats.push({ ...definition, kind: 'ground', point: safe });
    yield;
  }
  const habitatWorld = d.habitatWorld ?? d.world;
  habitatWorld.updateMatrixWorld(true);
  const roots = [];
  habitatWorld.traverse((root) => {
    if (root.userData.animalPerches) roots.push(root);
  });
  for (const root of roots) {
    for (const point of root.userData.animalPerches) {
      const position = root.localToWorld(new Vector3(...point)).toArray();
      if (!d.animalSpace || d.animalSpace.openSky(position))
        habitats.push({ kind: 'perch', point: position });
    }
    yield;
  }
  return habitats;
}

function groundRoute(nav, points, radius) {
  return nav.plan(
    points.map(([x, z]) => [x, 0.07, z]),
    radius,
  );
}

// Animal routes survive a re-population when the town around them still allows them,
// as villager routes do: only routes that a changed building now blocks are planned
// again. Keys name what a route connects; a route for other inputs is never reused.
function* keptRoute(previous, routes, key, nav, radius, plan) {
  const kept = previous?.get(key);
  const path = kept && (yield* nav.routeClearSteps(kept, radius)) ? kept : yield* plan();
  routes.set(key, path);
  return path;
}

// Resumable: the whole-town loop is the longest animal plan, so it yields between
// navigation steps when prepared in the background.
function* streetRoute(nav, graph, ids, radius) {
  const points = [];
  for (let n = 0; n < ids.length; n++) {
    const section = routeOnGraph(graph, plotStreet(ids[n]), plotStreet(ids[(n + 1) % ids.length]));
    if (!section.length) continue;
    points.push(...section.slice(points.length ? 1 : 0));
  }
  if (points.length < 2) return null;
  // Keep small animals on the verge, away from carriage wheels. The animal
  // itinerary stays on this bank; no unsupported straight-line river crossings.
  const path = yield* nav.routeSteps(points, 1.2, radius);
  // A return leg can approach the starting street from the opposite direction.
  // Close its sidewalk offset through navigation rather than jumping lanes.
  return path.points.length ? yield* nav.planSteps([...path.points, path.points[0]], radius) : path;
}

function threatNear(d, animal, profile) {
  const point = animal.root.position;
  let closest = null,
    nearest = Infinity;
  for (const root of d.trafficActors ?? []) {
    if (!root.visible || Math.abs(root.position.y - point.y) > 1) continue;
    const gap = distance(point, root.position) - (root.userData.trafficRadius ?? 0.8);
    if (gap < (profile.paved ? 2.4 : 1.8) && gap < nearest) {
      closest = root;
      nearest = gap;
    }
  }
  if (animal.species === 'pigeon' || animal.wild) {
    for (const { root } of d.actors ?? []) {
      if (!root.visible || root === d.animalFeeder?.root || Math.abs(root.position.y - point.y) > 1)
        continue;
      const gap = distance(point, root.position);
      if (gap < (animal.wild ? 3.5 : 1.05) && gap < nearest) {
        closest = root;
        nearest = gap;
      }
    }
    for (const other of d.animals ?? []) {
      if (!['dog', 'cat'].includes(other.species) || !other.root.visible) continue;
      const gap = distance(point, other.root.position);
      if (gap < 1.3 && gap < nearest) {
        closest = other.root;
        nearest = gap;
      }
    }
  }
  return closest;
}

// Retained animals are reused only when they would look the same (costume included).
export const animalKey = (a) => `${a.species}:${a.seed}:${a.costume ?? ''}`;

function addGroundAnimal(d, species, path, seed, options = {}) {
  if (!path?.total) return null;
  const model = animalModel(d, species, seed, options.costume);
  const animal = {
    ...model,
    ...TOWN_ANIMALS[species],
    ...options,
    path,
    seed,
    progress: random(seed) * path.total,
    direction: 1,
    rest: 0,
    untilStop: 2 + random(seed + 1) * 5,
    state: 'walking',
    pose: {},
  };
  model.root.visible = false;
  d.animals.push(animal);
  return animal;
}

function addFeeder(d, habitat, nav, era) {
  if (!habitat) return null;
  const [x, y, z] = habitat.point;
  const station = nav.safePoint([x + 1.05, y, z + 0.45], 0.45, 1.5);
  if (!station) return null;
  const clearance = (from, to, radius) => d.animalSpace.segment(from, to, radius, 1.5);
  const path = buildingWalk(d, habitat.building, { station, radius: 0.45, clearance });
  if (!path.total) return null;
  const actor = d.person({
    color: '#84946d',
    skin: '#cc9f79',
    hat: '#c4aa79',
    era,
    seed: 32,
    route: [
      [station[0], station[2]],
      [station[0], station[2] + 0.1],
    ],
    work: 'feed',
  });
  actor.root.name = 'Neighbor feeding animals';
  actor.radius = 0.45;
  actor.activityBuilding = habitat.building;
  actor.clearance = clearance;
  setWorkRoutine(actor, path, { work: 20, rest: 8 });
  const bag = d.group(actor.arms[0].lower, 0, -0.2, 0.07);
  d.ball(bag, 0, 0, 0, [0.12, 0.17, 0.1], '#c5aa76');
  const grain = d.group(d.world);
  grain.name = 'Scattered bird seed';
  grain.userData.animated = true;
  const birds = d.animals.filter((a) => a.species === 'pigeon');
  const feedingSites = birds.flatMap((a) =>
    a.habitats.filter((h) => h.kind === 'ground' && h.building === habitat.building),
  );
  if (!feedingSites.length) feedingSites.push(habitat);
  // Prepare small patches beside each landing site once. Seed lands between the
  // feeder and the bird, within reach of its beak, even after frontage relocation.
  const patches = new Map(
    feedingSites.map((site) => {
      const [sx, sy, sz] = site.point;
      const at = path.points.at(-1);
      const length = Math.hypot(at[0] - sx, at[2] - sz) || 1;
      const dx = (at[0] - sx) / length,
        dz = (at[2] - sz) / length;
      const targets = Array.from({ length: 7 }, (_, n) => {
        const reach = Math.min(0.28 + random(n) * 0.025, length * 0.45);
        const scatter = Math.sin(n * 2.4) * 0.055;
        const target = [sx + dx * reach + dz * scatter, sy, sz + dz * reach - dx * scatter];
        target[1] = d.animalSpace.groundY(target) + 0.01;
        return target;
      });
      return [site, targets];
    }),
  );
  const seedTargets = Array.from({ length: 14 }, (_, n) => patches.get(feedingSites[0])[n % 7]);
  const seeds = seedTargets.map((target, n) => {
    const seed = d.ball(grain, ...target, [0.018, 0.009, 0.026], n % 2 ? '#b89854' : '#dec27f');
    seed.name = `Scattered grain ${n + 1}`;
    seed.userData.grain = {
      generation: -1,
      consumed: false,
      grounded: false,
      age: 0,
      from: [0, 0, 0],
    };
    seed.visible = false;
    return seed;
  });
  return Object.assign(actor, {
    path,
    habitat,
    station: path.points.at(-1),
    grain,
    seeds,
    seedTargets,
    birds,
    feedingSites,
    patches,
    toss: { visit: -1, index: -1, from: 0, turn: 0 },
    hand: new Vector3(),
    active: false,
    pose: { x: actor.root.position.x, y: actor.root.position.y, z: actor.root.position.z },
  });
}

function updateFeeder(feeder, time) {
  if (!feeder) return;
  const routine = feeder.workRoutine;
  feeder.active = feeder.workActive === true;
  const phase = time - (routine.since ?? time);
  const tossIndex = Math.floor(phase / 1.6);
  const tossTime = phase - tossIndex * 1.6;
  const toss = feeder.toss;
  if (feeder.active) {
    if (toss.visit !== routine.visit || toss.index !== tossIndex) {
      toss.visit = routine.visit;
      toss.index = tossIndex;
      let site = feeder.feedingSites[tossIndex % feeder.feedingSites.length],
        nearest = Infinity;
      // At most three birds, once per throw; no navigation or scenery queries.
      for (const bird of feeder.birds) {
        if (!bird.root.visible || bird.flight || !feeder.patches.has(bird.habitat)) continue;
        const gap = distance(feeder.root.position, bird.root.position);
        if (gap < nearest) {
          nearest = gap;
          site = bird.habitat;
        }
      }
      toss.site = site;
      toss.from = feeder.root.rotation.y;
      const heading = Math.atan2(
        site.point[0] - feeder.root.position.x,
        site.point[2] - feeder.root.position.z,
      );
      toss.turn = Math.atan2(Math.sin(heading - toss.from), Math.cos(heading - toss.from));
      const targets = feeder.patches.get(site);
      for (let n = 0; n < 7; n++) feeder.seedTargets[(tossIndex % 2) * 7 + n] = targets[n];
    }
    // Finish turning before releasing grain, then hold the aim through its arc.
    feeder.root.rotation.y = toss.from + toss.turn * smooth(tossTime / 0.4);
    feeder.head.rotation.y = 0;
  }
  feeder.torso.rotation.x = feeder.active ? 0.16 : 0;
  feeder.arms[0].upper.rotation.x = -0.7;
  feeder.arms[1].upper.rotation.x = feeder.active
    ? -0.65 - Math.sin(clamp((tossTime - 0.15) / 0.85) * Math.PI) * 0.55
    : -0.12;
  feeder.head.rotation.x = feeder.active ? 0.22 : 0;
  feeder.grain.visible = feeder.active;
  if (!feeder.grain.visible) return;
  feeder.seeds.forEach((seed, n) => {
    const offset = 0.4 + Math.floor(n / 7) * 1.6 + (n % 7) * 0.045;
    const emission = Math.floor((phase - offset) / 3.2);
    const generation = routine.visit * 16 + emission;
    const age = phase - offset - emission * 3.2;
    const state = seed.userData.grain;
    if (state.generation !== generation) {
      state.generation = generation;
      state.consumed = false;
      if (emission >= 0 && age < 0.65) {
        feeder.hand.set(0, -0.19, 0.03);
        feeder.arms[1].lower.localToWorld(feeder.hand).toArray(state.from);
      }
    }
    state.age = age;
    state.grounded = age >= 0.65;
    seed.visible = emission >= 0 && !state.consumed && age >= 0 && age < 2.4;
    const flight = clamp(age / 0.65);
    const target = feeder.seedTargets[n];
    const from = state.from;
    // Each grain lands and rests for most of its lifetime. It stays in world
    // space and is never attached to a bird or recycled in midair.
    if (state.grounded) seed.position.fromArray(target);
    else
      seed.position.set(
        from[0] + (target[0] - from[0]) * flight,
        from[1] * (1 - flight) + target[1] * flight + Math.sin(flight * Math.PI) * 0.23,
        from[2] + (target[2] - from[2]) * flight,
      );
    seed.scale.set(0.018, 0.009, 0.026).multiplyScalar(1 - smooth((age - 2.1) / 0.3));
  });
}

function nearbyGrain(d, animal) {
  const food = d.animalFeeder;
  if (!food?.grain.visible || animal.habitat?.kind !== 'ground') return null;
  let target = null,
    nearest = 0.43;
  for (const seed of food.seeds) {
    if (!seed.visible || !seed.userData.grain.grounded) continue;
    const gap = distance(animal.root.position, seed.position);
    if (gap < nearest) {
      target = seed;
      nearest = gap;
    }
  }
  return target;
}

const beakTip = new Vector3();
function eatGrain(animal) {
  if (animal.peck < 0.2) animal.grainPeckDone = false;
  const seed = animal.grainTarget;
  if (!seed?.visible || animal.peck <= 0.8 || animal.grainPeckDone) return;
  beakTip.set(0, 0, 0.0375);
  animal.beak.localToWorld(beakTip);
  if (distance(beakTip, seed.position) > 0.12 || Math.abs(beakTip.y - seed.position.y) > 0.065)
    return;
  seed.userData.grain.consumed = true;
  seed.visible = false;
  animal.grainPeckDone = true;
}

function updateGround(d, animal, time, dt, profile) {
  const { path, root, wild } = animal;
  if (wild) {
    const cycle = profile.paved ? 150 : 115;
    const visit = Math.floor(time / cycle);
    const phase = (time % cycle) - (8 + random(visit + animal.seed) * 40);
    root.visible = phase >= 0 && phase < 42;
    root.scale.setScalar(Math.min(smooth(phase / 2), smooth((42 - phase) / 2)));
    if (!root.visible) return;
  }
  const threat = threatNear(d, animal, profile);
  const food = d.animalFeeder;
  const feeding =
    !wild &&
    food?.active &&
    Math.hypot(root.position.x - food.habitat.point[0], root.position.z - food.habitat.point[2]) <
      1.65;
  if (threat) {
    animal.state = wild ? 'retreating' : 'alert';
    animal.rest = Math.max(animal.rest, 1.5);
    if (wild) {
      const toward =
        Math.sin(animal.pose.heading) * (threat.position.x - root.position.x) +
        Math.cos(animal.pose.heading) * (threat.position.z - root.position.z);
      animal.direction = toward > 0 ? -1 : 1;
      if (!animal.motion) animal.progress += dt * animal.speed * 2 * animal.direction;
    }
    root.rotation.y = Math.atan2(
      threat.position.x - root.position.x,
      threat.position.z - root.position.z,
    );
  } else if (feeding) animal.state = 'feeding';
  else if (animal.rest > 0) {
    animal.rest -= dt;
    animal.state = animal.idle;
  } else {
    animal.state = 'walking';
    if (!animal.motion) animal.progress += dt * animal.speed * animal.direction;
    animal.untilStop -= dt;
    if (animal.untilStop <= 0) {
      animal.rest = TOWN_ANIMALS[animal.species].rest;
      animal.untilStop = 4 + random(animal.seed + Math.floor(time)) * 9;
    }
  }
  const pose = walkPose(
    path,
    (((animal.progress % path.total) + path.total) % path.total) / path.total,
    animal.pose,
  );
  if (!animal.motion)
    root.position.set(pose.x, wild ? groundHeight(pose.x, pose.z) + 0.07 : pose.y, pose.z);
  if (!threat || wild) root.rotation.y = pose.heading + (animal.direction < 0 ? Math.PI : 0);
  if (feeding)
    root.rotation.y = Math.atan2(food.habitat.point[0] - pose.x, food.habitat.point[2] - pose.z);
  root.userData.behavior = animal.state;
  animateAnimal(
    animal,
    time + animal.seed,
    animal.state,
    animal.motion
      ? animal.acceptedWalking
      : animal.state === 'walking' || animal.state === 'retreating',
  );
}

function startFlight(animal, target, startled = false) {
  animal.grainTarget = null;
  const from = animal.root.position.toArray();
  animal.flight = createBirdFlight(
    from,
    animal.habitat,
    target,
    animal.space.ceiling,
    animal.speed * (0.8 + random(animal.seed + animal.visit * 17) * 0.4),
    (random(animal.seed + animal.visit * 31) - 0.5) * 8,
  );
  animal.state = startled ? 'startled' : 'flying';
}

function updateBird(d, animal, time, dt, habitats, profile) {
  const { root } = animal;
  if (animal.flight) {
    const f = animal.flight;
    f.elapsed += dt;
    const pose = birdFlightPose(f, f.elapsed);
    root.position.set(pose.x, pose.y, pose.z);
    root.rotation.y = pose.heading;
    animal.body.rotation.x = pose.pitch;
    if (f.elapsed >= f.total) {
      root.position.fromArray(f.to);
      animal.body.rotation.x = 0;
      animal.recent = [animal.habitat, ...(animal.recent ?? [])].slice(0, 2);
      animal.habitat = f.target;
      animal.flight = null;
      animal.rest = f.target.kind === 'air' ? 0 : 4 + random(++animal.visit + animal.seed) * 19;
      animal.state = f.target.kind === 'perch' ? 'perching' : 'pecking';
    }
  } else {
    const threat = animal.habitat.kind === 'ground' && threatNear(d, animal, profile);
    const food = d.animalFeeder;
    const feeding = food?.active && animal.habitat.building === food.habitat.building;
    animal.rest -= dt;
    if (feeding && random(animal.seed + animal.visit * 19) < 0.45)
      animal.rest = Math.max(0.5, animal.rest);
    if (animal.rest <= 0 || threat) {
      let candidates = habitats.filter((h) => h !== animal.habitat && !animal.recent?.includes(h));
      if (!candidates.length) candidates = habitats.filter((h) => h !== animal.habitat);
      // Prefer nearby destinations and give open public spaces regular visits;
      // a large late-era power network must not overwhelm the ground habitats.
      const local = candidates.filter(
        (h) => Math.hypot(h.point[0] - root.position.x, h.point[2] - root.position.z) < 30,
      );
      if (local.length) candidates = local;
      const ground = candidates.filter((h) => h.kind === 'ground');
      if (!threat && ground.length && random(animal.seed + animal.visit * 13) < 0.65)
        candidates = ground;
      if (threat)
        candidates = candidates.filter(
          (h) =>
            h.kind === 'perch' ||
            Math.hypot(h.point[0] - root.position.x, h.point[2] - root.position.z) > 4,
        );
      let target =
        food?.active && !threat && !feeding && random(animal.seed + animal.visit * 23) < 0.6
          ? habitats.find((h) => h.building === food.habitat.building)
          : candidates[Math.floor(random(animal.seed + ++animal.visit) * candidates.length)];
      target ??= {
        kind: 'air',
        point: [root.position.x - 8, animal.space.ceiling, root.position.z + 6],
      };
      startFlight(animal, target, !!threat);
    } else {
      animal.state = animal.habitat.kind === 'perch' ? 'perching' : feeding ? 'feeding' : 'pecking';
      // Keep the aim through the whole peck, even after the grain is eaten.
      // Retargeting while the head is down makes the beak sweep sideways.
      if (!animal.grainTarget || animal.peck < 0.2) animal.grainTarget = nearbyGrain(d, animal);
      if (animal.grainTarget)
        root.rotation.y = Math.atan2(
          animal.grainTarget.position.x - root.position.x,
          animal.grainTarget.position.z - root.position.z,
        );
      else root.rotation.y += Math.sin(time + animal.seed) * dt * 0.3;
    }
  }
  if (animal.shadow) animal.shadow.visible = !animal.flight && animal.habitat.kind === 'ground';
  root.userData.behavior = animal.state;
  animateAnimal(animal, time + animal.seed, animal.state, !!animal.flight);
  eatGrain(animal);
}

// A bounded, disposable runtime on the diorama clock. Rebuilding the village
// replaces the cast and prepared routes; no timers, persistence or rewards.
export function addTownAnimals(d, town, preparedSpace) {
  if (!population(town) && !town.buildings.farm) {
    d.animals = [];
    return;
  }
  if (d.deferLife && !preparedSpace) {
    d.cancelAnimalWork?.();
    const generation = d.generation;
    const builder = AnimalSpaceBuilder(d);
    function* prepare() {
      let next;
      do {
        next = builder.next();
        if (!next.done) yield;
      } while (!next.done);
      if (generation !== d.generation) return;
      const stage = Object.create(d);
      Object.assign(stage, {
        world: new Group(),
        habitatWorld: d.world,
        animals: [],
        actors: [],
        motions: [],
        animalFeeder: null,
        retainedActors: null,
        retainedAnimals: null,
      });
      let committed = false;
      try {
        yield* populateAnimals(stage, town, next.value);
        if (generation !== d.generation) return;
        const retained =
          d.retainedAnimals ?? new Map((d.animals ?? []).map((a) => [animalKey(a), a]));
        stage.animals = stage.animals.map((fresh) => {
          const key = animalKey(fresh),
            old = retained.get(key);
          if (!old) return fresh;
          retained.delete(key);
          d.clearGroup(fresh.root);
          Object.assign(old, {
            path: fresh.path,
            habitats: fresh.habitats,
            space: stage.animalSpace,
          });
          old.clearance = fresh.clearance;
          return old;
        });
        for (const old of retained.values()) d.clearGroup(old.root);
        if (d.animalFeeder) {
          d.clearGroup(d.animalFeeder.root);
          d.clearGroup(d.animalFeeder.grain);
          d.actors = d.actors.filter((a) => a.root !== d.animalFeeder.root);
        }
        d.world.add(...stage.world.children);
        stage.world = d.world;
        for (const animal of stage.animals) d.world.add(animal.root);
        d.actors.push(...stage.actors);
        stage.actors = d.actors;
        for (const key of [
          'animals',
          'animalFeeder',
          'animalHabitats',
          'animalSpace',
          'animalNavigation',
          'animalRoutes',
          'animalMotion',
        ])
          d[key] = stage[key];
        d.retainedAnimals = null;
        d.motions.push(stage.animalMotion);
        committed = true;
      } finally {
        if (!committed) d.clearGroup(stage.world);
      }
      d.rebuildActors();
      d.render();
    }
    d.cancelAnimalWork = scheduleWork(prepare(), {
      budget: 8,
      isCurrent: () => generation === d.generation,
    });
    return;
  }
  const work = populateAnimals(d, town, preparedSpace);
  while (!work.next().done) {}
}
function* populateAnimals(d, town, preparedSpace) {
  const oldFeeder = d.animalFeeder;
  if (oldFeeder) {
    d.actors = d.actors.filter((actor) => actor.root !== oldFeeder.root);
    d.clearGroup(oldFeeder.root);
    d.clearGroup(oldFeeder.grain);
  }
  d.animals = [];
  d.animalFeeder = null;
  d.animalHabitats = [];
  d.animalSpace = preparedSpace ?? animalSpace(d);
  const nav = (d.animalNavigation = animalNavigation(d.navigation, d.animalSpace));
  const previousRoutes = d.animalRoutes;
  const routes = (d.animalRoutes = new Map());
  const route = (key, radius, plan) => keptRoute(previousRoutes, routes, key, nav, radius, plan);
  if (!population(town) && !town.buildings.farm) return;
  const profile = eraEvolution(town.era);
  const graph = routeGraph(town);
  const habitats = yield* prepareHabitats(d, town);
  d.animalHabitats = habitats;
  for (const species of ['dog', 'cat']) {
    if (!population(town)) continue;
    const ids = (
      species === 'dog' ? ['home', 'saloon', 'farm', 'shop'] : ['home', 'park', 'shop', 'farm']
    ).filter((id) => town.buildings[id]);
    const { radius } = TOWN_ANIMALS[species];
    let path =
      ids.length > 1
        ? yield* route(`street:${species}:${ids}`, radius, () =>
            streetRoute(nav, graph, ids, radius),
          )
        : null;
    if (!path?.total) {
      const [x, z] = plotStreet(ids[0] ?? 'home');
      path = yield* route(`yard:${species}:${ids[0] ?? 'home'}`, radius, function* () {
        return groundRoute(
          nav,
          [
            [x - 2, z + 0.6],
            [x + 2, z + 0.6],
            [x - 2, z + 0.6],
          ],
          radius,
        );
      });
    }
    // The era wardrobe may dress the village dog (Tomorrow City's space dog).
    const costume = species === 'dog' ? (townWardrobe(profile).petCostume ?? null) : null;
    addGroundAnimal(d, species, path, species === 'dog' ? 4 : 17, costume ? { costume } : {});
    yield;
  }
  if (town.buildings.farm)
    for (let n = 0; n < 3; n++) {
      const points = [
        [-2, 2.8],
        [-1, 3.1],
        [1.8, 3.15],
        [2.3, 3.55],
        [-1.8, 3.7],
        [-2, 2.8],
      ].map(([x, z]) => atPlot('farm', x, z + n * 0.13));
      const path = yield* route(`hen:${n}`, TOWN_ANIMALS.hen.radius, function* () {
        return groundRoute(nav, points, TOWN_ANIMALS.hen.radius);
      });
      addGroundAnimal(d, 'hen', path, 30 + n * 11);
      yield;
    }
  const ground = habitats.filter((h) => h.kind === 'ground');
  for (let n = 0; n < Math.min(3, ground.length + 1); n++) {
    if (!ground.length) break;
    const sites = habitats.flatMap((h) => {
      if (h.kind === 'perch') return [h];
      return [-0.8, 0.3, 1.2].flatMap((offset) => {
        const point = landingPoint(d, nav, [
          h.point[0] + (n - 1) * 0.9,
          h.point[1],
          h.point[2] + offset,
        ]);
        return point ? [{ ...h, point }] : [];
      });
    });
    for (const site of sites) {
      if (!site.approaches)
        site.approaches = prepareBirdApproaches(
          d.animalSpace,
          site.point,
          TOWN_ANIMALS.pigeon.radius,
        );
      yield;
    }
    const groundSites = sites.filter((h) => h.kind === 'ground');
    const habitat = groundSites[n % groundSites.length];
    if (!habitat) continue;
    const model = animalModel(d, 'pigeon', n);
    model.root.position.fromArray(habitat.point);
    const animal = {
      ...model,
      ...TOWN_ANIMALS.pigeon,
      habitat,
      habitats: sites,
      space: d.animalSpace,
      rest: 7 + n * 4,
      seed: 71 + n * 7,
      visit: 0,
      state: 'pecking',
    };
    model.root.visible = false;
    d.animals.push(animal);
    if (n === 2) {
      animal.root.position.add(new Vector3(-12, d.animalSpace.ceiling, 3));
      startFlight(animal, habitat);
    }
    yield;
  }
  d.animalFeeder = population(town)
    ? addFeeder(
        d,
        habitats.find((h) => h.feeding),
        nav,
        town.era,
      )
    : null;
  yield;
  const edge =
    Math.max(
      23,
      ...Object.entries(PLOTS)
        .filter(([id, [x]]) => town.buildings[id] && x > -28 && x < 20)
        .map(([, [, z]]) => z),
    ) + 6;
  for (const [n, species] of ['fox', 'raccoon'].entries()) {
    const z = edge + n * 2;
    const points = [
      [-20, z],
      [-17, z + 0.7],
      [-12, z + 0.1],
      [-9, z + 1.5],
      [-13, z + 2.5],
      [-20, z],
    ];
    const path = yield* route(`wild:${species}:${z}`, TOWN_ANIMALS[species].radius, function* () {
      return groundRoute(nav, points, TOWN_ANIMALS[species].radius);
    });
    addGroundAnimal(d, species, path, 91 + n * 43, { wild: true });
    yield;
  }
  for (const animal of d.animals) animal.root.visible = true;
  if (d.retainedAnimals) {
    d.animals = d.animals.map((fresh) => {
      const old = d.retainedAnimals.get(animalKey(fresh));
      if (!old) return fresh;
      d.retainedAnimals.delete(animalKey(fresh));
      d.clearGroup(fresh.root);
      Object.assign(old, {
        path: fresh.path,
        habitats: fresh.habitats,
        space: fresh.space ?? d.animalSpace,
      });
      d.world.add(old.root);
      return old;
    });
    for (const old of d.retainedAnimals.values()) d.clearGroup(old.root);
    d.retainedAnimals = null;
  }
  for (const animal of d.animals)
    if (animal.species !== 'pigeon')
      animal.clearance = (from, to, radius) =>
        d.animalSpace.segment(from, to, radius, animal.height ?? 0.6);
  let previous = d.elapsed ?? 0;
  let initialized = false;
  const update = (time) => {
    if (initialized && time === previous) return;
    initialized = true;
    const dt = Math.max(0, Math.min(0.5, time - previous));
    previous = time;
    updateFeeder(d.animalFeeder, time);
    for (const animal of d.animals) {
      if (animal.species === 'pigeon') updateBird(d, animal, time, dt, animal.habitats, profile);
      else updateGround(d, animal, time, dt, profile);
    }
  };
  update(previous);
  d.animalMotion = update;
  d.motions.push(update);
}

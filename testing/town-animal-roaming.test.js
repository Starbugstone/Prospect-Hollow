import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { animalSpace } from '../src/game/town/TownAnimalSpace';
import { TownNavigation, walkPath, walkPose } from '../src/game/town/TownNavigation';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { prepareAnimalRoaming, updateAnimalRoaming } from '../src/game/town/TownAnimalRoaming';

const square = [
  [-10, 0.07, -7],
  [-6, 0.07, -7],
  [-6, 0.07, -3],
  [-10, 0.07, -3],
  [-10, 0.07, -7],
];
function animal(species = 'dog', points = square, options = {}) {
  const root = new Group();
  root.position.fromArray(points[0]);
  return {
    root,
    species,
    seed: species === 'dog' ? 4 : 17,
    radius: 0.64,
    height: 1,
    speed: 0.8,
    state: 'walking',
    path: walkPath(points),
    progress: 0,
    ...options,
  };
}
function fixture(animals, wall = false) {
  const town = createTown();
  town.buildings.home = 3;
  town.buildings.farm = 3;
  town.buildings.bridge = 3;
  const landscape = new Group();
  const ground = new Mesh(new PlaneGeometry(200, 200), new MeshBasicMaterial());
  ground.rotation.x = -Math.PI / 2;
  landscape.add(ground);
  const world = new Group();
  if (wall) {
    const obstacle = new Mesh(new BoxGeometry(0.2, 3, 3), new MeshBasicMaterial());
    obstacle.position.set(-8, 1.5, -5);
    world.add(obstacle);
  }
  const d = {
    town,
    world,
    landscape,
    animals,
    actors: [],
    navigation: new TownNavigation(wall ? [{ x: -8, z: -5, radius: 1.5, y: 0, height: 3 }] : []),
  };
  d.animalSpace = animalSpace(d);
  for (const a of animals) a.space = d.animalSpace;
  return d;
}
function prepare(d) {
  const work = prepareAnimalRoaming(d);
  let step,
    yields = 0;
  do {
    step = work.next();
    if (!step.done) yields++;
  } while (!step.done);
  return yields;
}

describe('Prepared lightweight animal roaming', () => {
  it('prepares bounded finite legs with swept body certificates and leaves other cast members alone', () => {
    const dog = animal(),
      cat = animal('cat'),
      hen = animal('hen'),
      companion = animal('willowkin', square, { companion: true }),
      bird = animal('bluebird');
    const d = fixture([dog, cat, hen, companion, bird], true);
    const original = dog.path,
      position = dog.root.position.clone();
    expect(prepare(d)).toBeGreaterThan(10);
    expect(dog.path).toBe(original);
    expect(dog.root.position.equals(position)).toBe(true);
    expect(dog.roaming.nodes).toBe(cat.roaming.nodes);
    expect(dog.roaming.nodes.length).toBeLessThanOrEqual(40);
    expect(dog.roaming.legs.length).toBeLessThanOrEqual(96);
    expect(dog.roaming.legs.length).toBeGreaterThan(2);
    for (const a of [hen, companion, bird]) expect(a.roaming).toBeNull();
    for (const leg of dog.roaming.legs) {
      expect(Object.isFrozen(leg)).toBe(true);
      expect(Object.isFrozen(leg.path.points)).toBe(true);
      expect(leg.path.closed).toBe(false);
      expect(leg.path.total).toBeLessThanOrEqual(2.7);
      expect(leg.path.clearance).toMatchObject({
        navigation: d.navigation,
        revision: d.navigation.revision,
        margin: 0.64,
        space: d.animalSpace,
        height: 1,
      });
      for (let n = 1; n < leg.path.points.length; n++) {
        const a = leg.path.points[n - 1],
          b = leg.path.points[n];
        expect(d.navigation.segment(a, b, 0.64)).toBe(true);
        expect(d.animalSpace.segment(a, b, 0.64, 1)).toBe(true);
      }
    }
  });

  it('chooses varied cached branches and moves continuously through finite endpoints', () => {
    const a = animal(),
      d = fixture([a]);
    prepare(d);
    const positions = new Set(),
      selected = new Set();
    const navigation = vi.spyOn(d.navigation, 'segment'),
      geometry = vi.spyOn(d.animalSpace, 'segment');
    let previous = a.root.position.clone();
    for (let n = 0; n < 600; n++) {
      expect(updateAnimalRoaming(a, n * 0.05)).toBe(true);
      selected.add(a.walkPath);
      expect(a.routeLimit).toBe(a.walkPath.total);
      expect(a.direction).toBe(1);
      updateTownLocomotion(d, 0.05);
      expect(a.root.position.distanceTo(previous)).toBeLessThanOrEqual(0.04001);
      previous.copy(a.root.position);
      positions.add(`${Math.round(previous.x)},${Math.round(previous.z)}`);
    }
    expect(selected.size).toBeGreaterThan(3);
    expect(positions.size).toBeGreaterThan(5);
    expect(navigation).not.toHaveBeenCalled();
    expect(geometry).not.toHaveBeenCalled();
  });

  it('reverses the same certified edge toward or away from a nearby target without snapping', () => {
    const a = animal(),
      d = fixture([a]);
    prepare(d);
    updateAnimalRoaming(a, 0);
    const index = a.roaming.activeLeg,
      leg = a.roaming.legs[index],
      pose = walkPose(leg.path, 0.5);
    a.root.position.set(pose.x, pose.y, pose.z);
    const position = a.root.position.clone();
    const target = new Vector3(...a.roaming.nodes[leg.from].point);
    expect(updateAnimalRoaming(a, 1, target)).toBe(true);
    expect(a.roaming.activeLeg).toBe(leg.reverse);
    expect(a.root.position.equals(position)).toBe(true);
    expect(updateAnimalRoaming(a, 2, target, true)).toBe(true);
    expect(a.roaming.activeLeg).toBe(index);
    expect(a.root.position.equals(position)).toBe(true);
    updateTownLocomotion(d, 0.05);
    expect(a.root.position.distanceTo(position)).toBeLessThanOrEqual(0.04001);
  });

  it('keeps a safe original itinerary when a retained actor has no continuous prepared join', () => {
    const a = animal(),
      d = fixture([a]);
    const original = a.path;
    prepare(d);
    a.root.position.set(17, 0.07, 0);
    const position = a.root.position.clone();
    expect(updateAnimalRoaming(a, 0)).toBe(false);
    expect(a.walkPath).toBeUndefined();
    expect(a.path).toBe(original);
    expect(a.root.position.equals(position)).toBe(true);
  });

  it('shares an outskirts network between fox and deer and rebuilds it for a changed cast', () => {
    const fox = animal(
        'fox',
        [
          [-20, 0.07, 29],
          [-17, 0.07, 29.7],
          [-12, 0.07, 29.1],
          [-9, 0.07, 30.5],
          [-13, 0.07, 31.5],
          [-20, 0.07, 29],
        ],
        { wild: true, radius: 0.98, height: 1 },
      ),
      deer = animal(
        'deer',
        [
          [-15, 0.07, 27],
          [-13, 0.07, 27.8],
          [-13.5, 0.07, 29],
          [-15.8, 0.07, 28.5],
          [-15, 0.07, 27],
        ],
        { wild: true, radius: 0.9, height: 1.55 },
      );
    const d = fixture([fox, deer]);
    prepare(d);
    expect(fox.roaming.nodes).toBe(deer.roaming.nodes);
    expect(fox.roaming.legs.length).toBeGreaterThan(4);
    const nodes = fox.roaming.nodes,
      visited = new Set([0]),
      queue = [0];
    while (queue.length) {
      const node = queue.shift();
      for (const id of nodes[node].legs) {
        const next = fox.roaming.legs[id].to;
        if (!visited.has(next)) {
          visited.add(next);
          queue.push(next);
        }
      }
    }
    const deerStart = nodes.findIndex(
      (node) => Math.hypot(node.point[0] + 15, node.point[2] - 27) < 0.02,
    );
    expect(visited.has(deerStart)).toBe(true);
    expect(updateAnimalRoaming(fox, 0)).toBe(true);
    expect(updateAnimalRoaming(deer, 0)).toBe(true);
    const freshFox = animal('fox', fox.path.points, { wild: true, radius: 0.98, height: 1 }),
      hedgehog = animal(
        'hedgehog',
        [
          [-22, 0.07, 25],
          [-20, 0.07, 25.8],
          [-20.5, 0.07, 27],
          [-22.8, 0.07, 26.5],
          [-22, 0.07, 25],
        ],
        { wild: true, radius: 0.5, height: 0.45 },
      );
    const fresh = fixture([freshFox, hedgehog]);
    fresh.retainedAnimals = new Map([['fox', fox]]);
    prepare(fresh);
    expect(freshFox.roaming.nodes).not.toBe(nodes);
    expect(hedgehog.roaming.memberKey).toContain('hedgehog');
    expect(updateAnimalRoaming(hedgehog, 0)).toBe(true);
  });
});

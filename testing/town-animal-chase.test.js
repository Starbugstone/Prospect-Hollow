import { describe, expect, it, vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshBasicMaterial } from 'three';
import { createAnimalBehavior, updateAnimalBehavior } from '../src/game/town/TownAnimalBehavior';
import { updateAnimalChase } from '../src/game/town/TownAnimalChase';
import { updateAnimalRoaming } from '../src/game/town/TownAnimalRoaming';
import { animalSpace } from '../src/game/town/TownAnimalSpace';
import { TownNavigation, walkPath } from '../src/game/town/TownNavigation';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { MAIN_LANE_X } from '../src/data/townClearances';
import { RIVER, riverCenterX, riverDistance } from '../src/game/town/TownRiver';

function actor(species, x, speed, z = -7) {
  const root = new Group();
  root.position.set(x, 0.07, z);
  const path = walkPath([
    [x, 0.07, z],
    [x, 0.07, z + 5],
  ]);
  return {
    root,
    species,
    seed: x + 10,
    radius: 0.5,
    height: 0.8,
    speed,
    path,
    walkPath: path,
    direction: 1,
    routeLimit: path.total,
    state: 'walking',
    rest: 0,
  };
}

function prepare(d) {
  d.animalSpace = animalSpace(d);
  const prey = d.animals[1].root.position;
  const nodes = Array.from({ length: 10 }, (_, n) => ({
    point: [prey.x + n * 2, 0.07, prey.z],
    legs: [],
  }));
  const legs = [];
  const certificate = {
    navigation: d.navigation,
    revision: d.navigation.revision,
    space: d.animalSpace,
    margin: 0.5,
    height: 0.8,
  };
  for (let n = 1; n < nodes.length; n++) {
    const a = nodes[n - 1].point,
      b = nodes[n].point;
    if (
      [a, b].some((p) => riverDistance(p[0], p[2]) < RIVER.bankWidth + 0.5) ||
      !d.navigation.segment(a, b, 0.5) ||
      !d.animalSpace.segment(a, b, 0.5, 0.8)
    )
      continue;
    const id = legs.length;
    for (const [from, to, reverse] of [
      [n - 1, n, id + 1],
      [n, n - 1, id],
    ]) {
      const path = walkPath([nodes[from].point, nodes[to].point]);
      path.clearance = certificate;
      nodes[from].legs.push(legs.length);
      legs.push({ from, to, path, reverse });
    }
  }
  for (const a of d.animals) {
    a.space = d.animalSpace;
    a.path.clearance = certificate;
    a.roaming = { nodes, legs, activeLeg: null, node: -1, lastTurn: -Infinity, choice: 0 };
    a.clearance = (from, to, radius) => d.animalSpace.segment(from, to, radius, a.height);
  }
  d.ai = createAnimalBehavior(d.animals, d.navigation, d.animalSpace);
}

function fixture(animals = [actor('dog', 0, 0.85), actor('cat', 2, 0.65)]) {
  const d = { world: new Group(), animals, actors: [], navigation: new TownNavigation() };
  prepare(d);
  return d;
}
function tick(d, time) {
  updateAnimalBehavior(d.ai, time);
  for (const a of d.animals) {
    a.state = a.encounter ? (a.encounter.predator === a ? 'chasing' : 'fleeing') : 'walking';
    a.movementSpeed = a.speed;
    if (!updateAnimalChase(a, time) && a.escapeFrom) updateAnimalRoaming(a, time);
    a.behaviorHold = a.roamingHold;
  }
  updateTownLocomotion(d, 1 / 60);
}

describe('Faster one-way prey escapes', () => {
  it.each([
    ['dog', 'cat', 0.85, 0.65],
    ['fox', 'deer', 0.9, 0.85],
  ])(
    '%s breaks away while %s outruns it and continues forward after the chase',
    (hunter, quarry, hunterSpeed, preySpeed) => {
      const d = fixture([actor(hunter, 0, hunterSpeed), actor(quarry, 2, preySpeed)]);
      const [predator, prey] = d.animals;
      updateAnimalBehavior(d.ai, 0.5);
      expect(d.ai.active).toBeTruthy();
      expect(prey.chaseRoute.speed).toBeGreaterThanOrEqual(predator.chaseRoute.speed * 1.6);
      expect(prey.chaseRoute.path.total).toBeGreaterThan(9);
      const deadline = d.ai.active.endsAt;
      const original = predator.walkPath;
      const nav = vi.spyOn(d.navigation, 'segment'),
        mesh = vi.spyOn(d.animalSpace, 'segment');
      const previous = d.animals.map((a) => a.root.position.clone());
      let lastGap = 2,
        preyAtEnd,
        postRun = 0,
        hunterTurned = false;
      for (let n = 1; n <= 900; n++) {
        const time = 0.5 + n / 60;
        tick(d, time);
        for (const [i, a] of d.animals.entries()) {
          expect(a.root.position.distanceTo(previous[i])).toBeLessThanOrEqual(4 / 60 + 1e-6);
        }
        // The prey does not turn toward the hunter even after rejoining roaming.
        expect(prey.root.position.x).toBeGreaterThanOrEqual(previous[1].x - 1e-6);
        if (time < deadline) {
          const gap = prey.root.position.x - predator.root.position.x;
          expect(gap).toBeGreaterThanOrEqual(lastGap - 1e-6);
          lastGap = gap;
        } else {
          preyAtEnd ??= prey.root.position.x;
          postRun = Math.max(postRun, prey.root.position.x - preyAtEnd);
          if (predator.root.position.x < previous[0].x - 1e-6) hunterTurned = true;
        }
        d.animals.forEach((a, i) => previous[i].copy(a.root.position));
      }
      expect(preyAtEnd - 2).toBeGreaterThan(6);
      expect(postRun).toBeGreaterThan(2.5);
      expect(hunterTurned).toBe(true);
      expect(prey.root.position.x).toBeGreaterThan(MAIN_LANE_X + 8);
      expect(prey.chaseRoute).toBeNull();
      expect(predator.chaseRoute).toBeNull();
      expect(predator.walkPath).not.toBe(original);
      expect(d.ai.starts).toBe(1);
      expect(nav).not.toHaveBeenCalled();
      expect(mesh).not.toHaveBeenCalled();
    },
  );

  it('declines a cramped two-metre escape instead of staging a stop-and-return chase', () => {
    const d = fixture();
    const wall = new Mesh(new BoxGeometry(0.1, 3, 30), new MeshBasicMaterial());
    wall.position.set(4.6, 1.5, -7);
    d.world.add(wall);
    prepare(d);
    const nav = vi.spyOn(d.navigation, 'segment'),
      mesh = vi.spyOn(d.animalSpace, 'segment');
    updateAnimalBehavior(d.ai, 0.5);
    expect(d.ai.active).toBeNull();
    expect(d.animals.every((a) => !a.chaseRoute)).toBe(true);
    expect(nav.mock.calls.length).toBeLessThanOrEqual(8);
    expect(mesh.mock.calls.length).toBeLessThanOrEqual(33);
    expect(d.navigation.plans).toBe(0);
  });

  it('takes a longer outward branch when the straightest branch ends too soon', () => {
    const d = fixture();
    const [hunter, prey] = d.animals;
    const { nodes, legs } = prey.roaming;
    // An already certified route bends around scenery. The more directly
    // outward branch at its first junction is a short dead end.
    for (const node of nodes.slice(2)) node.point[2] += 2;
    for (const leg of legs) {
      const clearance = leg.path.clearance;
      leg.path = walkPath([nodes[leg.from].point, nodes[leg.to].point]);
      leg.path.clearance = clearance;
    }
    const deadEnd = nodes.length;
    nodes.push({ point: [6, 0.07, -7], legs: [legs.length + 1] });
    nodes[1].legs.push(legs.length);
    const id = legs.length;
    legs.push(
      {
        from: 1,
        to: deadEnd,
        reverse: id + 1,
        path: walkPath([nodes[1].point, nodes[deadEnd].point]),
      },
      { from: deadEnd, to: 1, reverse: id, path: walkPath([nodes[deadEnd].point, nodes[1].point]) },
    );
    // Scenery allows joining at the present waypoint, but blocks shortcuts to
    // later vertices. The prepared curved legs are the available way through.
    vi.spyOn(d.navigation, 'segment').mockImplementation(
      (from, to) => from[0] === hunter.root.position.x || to === nodes[0].point,
    );
    updateAnimalBehavior(d.ai, 0.5);
    expect(d.ai.active).toBeTruthy();
    expect(prey.chaseRoute.path.points).toContainEqual(nodes[2].point);
    expect(prey.chaseRoute.path.points).not.toContainEqual(nodes[deadEnd].point);
    expect(prey.chaseRoute.path.total).toBeGreaterThan(9);
  });

  it('keeps the escape clear of the river even when crossing roads is allowed', () => {
    const edge = riverCenterX(0) - RIVER.bankWidth;
    const d = fixture([actor('fox', edge - 3, 0.9, 0), actor('deer', edge - 1, 0.85, 0)]);
    updateAnimalBehavior(d.ai, 0.5);
    expect(d.ai.active).toBeNull();
  });

  it('revalidates cached geometry if a new obstruction appears during the run', () => {
    const d = fixture();
    updateAnimalBehavior(d.ai, 0.5);
    expect(d.ai.active).toBeTruthy();
    const positions = d.animals.map((a) => a.root.position.clone());
    d.navigation = new TownNavigation([{ x: 3, z: -7, radius: 1, y: 0, height: 3 }]);
    tick(d, 0.6);
    d.animals.forEach((a, i) => expect(a.root.position.equals(positions[i])).toBe(true));
  });

  it('leaves bird flight intact and makes the cat break off toward its own departure point', () => {
    const d = fixture([actor('cat', 2, 0.65), actor('bluebird', 4, 1)]);
    const [cat, bird] = d.animals;
    bird.habitat = { kind: 'ground' };
    updateAnimalBehavior(d.ai, 0.5);
    expect(d.ai.active).toBeTruthy();
    expect(bird.chaseRoute).toBeUndefined();
    bird.root.position.y = 8;
    for (let n = 1; n <= 90; n++) tick(d, 0.5 + n / 60);
    expect(cat.root.position.x).toBeCloseTo(4);
    expect(cat.root.position.y).toBeCloseTo(0.07);
    for (let n = 91; n <= 360; n++) tick(d, 0.5 + n / 60);
    expect(cat.chaseRoute).toBeNull();
    expect(cat.root.position.x).toBeCloseTo(2);
  });
});

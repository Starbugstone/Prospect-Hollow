import { afterEach, expect, it } from 'vitest';
import { Group, Scene } from 'three';
import { MOON_LOTS, moonEntrance } from '../src/data/moonSettlement';
import { animalModel, animateAnimal } from '../src/game/town/TownAnimalModels';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import {
  animateMoonSettler,
  moonSettlerPlan,
  moonSettlerPose,
} from '../src/game/town/moon/MoonSettlers';

const fixtures = [];
function scene() {
  const d = new TownPrimitives();
  const view = Object.assign(Object.create(MoonScene.prototype), {
    d,
    scene: new Scene(),
    life: new Group(),
    elapsed: 0,
    construction: { update() {} },
    updateLotReveals() {},
    saucer: { step() {} },
    moveTransports() {},
  });
  fixtures.push(view);
  return view;
}
const residents = (view) => view.settlers.filter(({ species }) => species === 'willowkinResident');
const levels = (level) => ({ ribbonLanding: 1, settlerDomes: 2, willowkinDome: level });
afterEach(() => {
  for (const view of fixtures.splice(0)) {
    view.d.clearGroup(view.scene);
    view.d.disposePrimitives();
  }
});

it.each([0, 1, 2, 3])(
  'a completed level %s dome adds its residents alongside the human settlers',
  (level) => {
    const view = scene();
    view.populate({ buildings: levels(level) });
    expect(residents(view)).toHaveLength(level ? level + 1 : 0);
    expect(view.settlers.filter(({ species }) => !species)).toHaveLength(6);
    for (const resident of residents(view)) {
      expect(resident.root.parent).toBe(view.life);
      expect(resident.plan.home).toBe('willowkinDome');
    }
  },
);

it('waits for construction to be finished, keeps residents during upgrades and replaces old actors', () => {
  const view = scene();
  for (const wins of [0, 2]) {
    view.populate({
      buildings: levels(0),
      projects: { willowkinDome: { stage: 1, wins, required: 2 } },
    });
    expect(residents(view)).toHaveLength(0);
  }
  view.populate({ buildings: levels(1) });
  expect(residents(view)).toHaveLength(2);
  const first = residents(view),
    previous = view.life;
  view.populate({
    buildings: levels(1),
    projects: { willowkinDome: { stage: 2, wins: 0, required: 2 } },
  });
  expect(residents(view)).toHaveLength(2);
  expect(previous.parent).toBeNull();
  expect(residents(view).some((resident) => first.includes(resident))).toBe(false);
  view.populate({ buildings: levels(0) });
  expect(residents(view)).toHaveLength(0);
});

it.each([1, 2, 3])(
  'level %s residents use the dome hatch and shared public paths, including after reload',
  (level) => {
    const view = scene();
    const buildings = Object.fromEntries(Object.keys(MOON_LOTS).map((id) => [id, 1]));
    buildings.willowkinDome = level;
    view.populate({ buildings });
    expect(residents(view)).toHaveLength(level + 1);
    const plans = residents(view).map(({ plan }) => plan);
    for (const plan of plans) {
      expect(plan.home).toBe('willowkinDome');
      for (const segment of plan.segments) {
        if (!segment.route) continue;
        const { from, to, points } = segment.route;
        expect([from, to]).toContain('willowkinDome');
        expect([from, to]).not.toContain('saucerPad');
        for (const [id, point] of [
          [from, points[0]],
          [to, points.at(-1)],
        ]) {
          expect([point[0], point[2]]).toEqual(moonEntrance(id, buildings[id]));
        }
        expect(points.flat().every(Number.isFinite)).toBe(true);
      }
    }
    view.populate({ buildings: { ...buildings } });
    expect(residents(view).map(({ plan }) => plan)).toEqual(plans);
  },
);

it('reuses the valley Willowkin and fitted space suit, with the shared animation and Moon hop', () => {
  const view = scene();
  view.populate({ buildings: levels(1) });
  expect(residents(view)).toHaveLength(2);
  const resident = residents(view)[0];
  view.d.world = new Group();
  const valley = animalModel(view.d, 'willowkinResident', 0, 'space-helmet');
  for (const name of [
    'Willowkin resident willow crown',
    'Willowkin resident linen scarf',
    'Willowkin resident civic satchel',
    'Space helmet',
  ]) {
    const actual = resident.root.getObjectByName(name),
      expected = valley.root.getObjectByName(name);
    expect(actual).toBeDefined();
    const meshes = (root) => {
      const result = [];
      root.traverse((part) => part.isMesh && result.push(part));
      return result;
    };
    const parts = meshes(actual),
      references = meshes(expected);
    expect(parts).toHaveLength(references.length);
    parts.forEach((part, n) => {
      expect(part.geometry).toBe(references[n].geometry);
      expect(part.material).toBe(references[n].material);
      expect(part.position.toArray()).toEqual(references[n].position.toArray());
      expect(part.scale.toArray()).toEqual(references[n].scale.toArray());
    });
  }
  expect(resident.root.userData.costume).toBe('space-helmet');
  const segment = resident.plan.segments.find(({ route }) => route);
  for (const fraction of [0.15, 0.35, 0.6, 0.8]) {
    const time = segment.start + segment.duration * fraction - resident.plan.offset;
    const pose = moonSettlerPose(resident.plan, time);
    animateMoonSettler(resident, time);
    animateAnimal(valley, ((pose.distance / 1.2) * Math.PI * 2) / 7, 'walking', true);
    expect(resident.root.position.toArray()).toEqual([pose.x, pose.y, pose.z]);
    expect(resident.root.rotation.y).toBe(pose.heading);
    expect(resident.legs.map((leg) => leg.rotation.x)).toEqual(
      valley.legs.map((leg) => leg.rotation.x),
    );
    expect(resident.arms.map((arm) => arm.rotation.x)).toEqual(
      valley.arms.map((arm) => arm.rotation.x),
    );
    expect(resident.body.position.y).toBeCloseTo(valley.body.position.y * (0.12 / 0.025));
  }
  const inside = resident.plan.segments.find(({ inside }) => inside);
  animateMoonSettler(resident, inside.start + 1 - resident.plan.offset);
  expect(resident.root.visible).toBe(false);
});

it('falls back to a built home when a preferred home is missing', () => {
  expect(moonSettlerPlan({ settlerDomes: 1 }, 0, 'willowkinDome').home).toBe('settlerDomes');
  expect(moonSettlerPlan({}, 0, 'willowkinDome').ring).toBe(true);
});

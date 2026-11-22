import { afterEach, expect, it } from 'vitest';
import { BoxGeometry, Group, MeshBasicMaterial, Scene } from 'three';
import { createTown } from '../src/data/town';
import { CHILD_SCALE, swingLimbs } from '../src/game/town/TownGait';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import {
  animateMoonSettler,
  createMoonSettlers,
  moonSettlerPlan,
  moonSuitFigure,
} from '../src/game/town/moon/MoonSettlers';

// Permanent rule (AGENTS.md, settlement maps): every settlement's villagers share the
// valley's skeleton and walk cycle, so the game keeps one feel from Earth to the Moon.
const limbs = () =>
  [0, 1].map(() => ({ upper: { rotation: { x: 0 } }, lower: { rotation: { x: 0 } } }));
const pose = ({ arms, legs }) =>
  [...legs, ...arms].flatMap(({ upper, lower }) => [upper.rotation.x, lower.rotation.x]);

it('keeps the valley walk cycle: knees bend, arms swing against the legs', () => {
  const figure = { arms: limbs(), legs: limbs() };
  swingLimbs(figure.arms, figure.legs, Math.PI / 2, true);
  expect(pose(figure).map((value) => +value.toFixed(6))).toEqual([
    0.36, 0, -0.36, 0.6, -0.28, -0.16, 0.28, -0.16,
  ]);
  swingLimbs(figure.arms, figure.legs, Math.PI / 2, false);
  expect(pose(figure)).toEqual([0, 0, 0, 0, -0.12, -0.16, -0.12, -0.16]);
});

const disposables = [];
afterEach(() => disposables.splice(0).forEach((dispose) => dispose()));
function valleyPerson() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    elapsed: 0,
    actors: [],
    motions: [],
    town: createTown(),
  });
  const geometry = new BoxGeometry();
  d.geometries = Object.fromEntries(
    ['box', 'rounded', 'sphere', 'rock', 'cylinder', 'cone', 'shadow'].map((key) => [
      key,
      geometry,
    ]),
  );
  disposables.push(() => {
    geometry.dispose();
    d.materials.forEach((material) => material.dispose());
  });
  const actor = d.person({
    color: '#809267',
    skin: '#af7b56',
    hat: '#d7b671',
    seed: 3,
    route: [
      [0, 0],
      [0, 4],
      [4, 8],
    ],
  });
  return { d, actor };
}

it('drives valley villagers and Moon settlers with the same skeleton and cycle', () => {
  const { d, actor } = valleyPerson();
  const kit = new TownPrimitives();
  disposables.push(() => kit.disposePrimitives());
  const settler = { ...moonSuitFigure(kit, { parent: new Group() }), plan: null };
  settler.plan = moonSettlerPlan({ settlerDomes: 1, craterIceWell: 1 }, 0);
  for (const figure of [actor, settler]) {
    // A valley villager's body hangs from a node that only scales it to its own height.
    const stature = figure.root.children.find((child) => child.name === 'Villager figure');
    expect(figure.body.parent).toBe(stature ?? figure.root);
    if (stature) {
      expect(stature.position.length()).toBe(0);
      expect(stature.scale.x).toBe(stature.scale.y);
      expect(stature.scale.x).toBe(stature.scale.z);
    }
    expect(figure.body.position.y).toBeCloseTo(0.54);
    for (const { upper, lower } of [...figure.arms, ...figure.legs]) {
      expect(lower.parent).toBe(upper);
      expect(upper.children.some((part) => part.isMesh)).toBe(true);
      expect(lower.children.some((part) => part.isMesh)).toBe(true);
    }
  }
  const check = (figure, walking) => {
    // Re-derive the step from the left thigh and confirm every joint follows the cycle.
    const reference = { arms: limbs(), legs: limbs() };
    const swing = figure.legs[0].upper.rotation.x / 0.36;
    swingLimbs(
      reference.arms,
      reference.legs,
      Math.asin(Math.max(-1, Math.min(1, swing))),
      walking,
    );
    const [thighs, knees] = [
      [figure.legs[0].upper, figure.legs[1].upper],
      [figure.legs[0].lower, figure.legs[1].lower],
    ];
    expect(thighs[1].rotation.x).toBeCloseTo(-thighs[0].rotation.x, 9);
    expect(knees.map((knee) => knee.rotation.x)).toEqual(
      thighs.map((thigh) => expect.closeTo(Math.max(0, -thigh.rotation.x / 0.36) * 0.6, 9)),
    );
    expect(figure.arms.map((arm) => arm.upper.rotation.x)).toEqual(
      thighs.map((thigh) => expect.closeTo((-thigh.rotation.x / 0.36) * 0.28, 9)),
    );
    expect(figure.arms.every((arm) => arm.lower.rotation.x === -0.16)).toBe(true);
  };
  let strides = 0;
  for (let time = 0.5; time < 6; time += 0.37) {
    d.animatePerson(actor, time);
    animateMoonSettler(settler, time);
    for (const figure of [actor, settler]) {
      if (!figure.root.visible) continue;
      check(figure, true);
      if (Math.abs(figure.legs[0].upper.rotation.x) > 0.1) strides++;
    }
  }
  expect(strides).toBeGreaterThan(10);
});

it('walks Moon-born children on the same skeleton and cycle, with a child’s shorter stride', () => {
  const kit = new TownPrimitives();
  disposables.push(() => kit.disposePrimitives());
  const levels = { lanternRow: 2, earthviewTerraces: 1, craterSchool: 1 };
  const children = createMoonSettlers(kit, new Group(), levels).filter(
    ({ root }) => root.name === 'New Hollow child',
  );
  expect(children.length).toBeGreaterThan(0);
  for (const child of children) {
    // The valley skeleton under a uniform child scale: body at hip height, paired joints.
    expect(child.size).toBe(CHILD_SCALE);
    expect(child.body.position.y).toBeCloseTo(0.54);
    for (let node = child.body.parent; node && node !== child.root; node = node.parent)
      expect([node.scale.x, node.scale.y, node.scale.z]).toEqual([1, 1, 1]);
    for (const { upper, lower } of [...child.arms, ...child.legs]) expect(lower.parent).toBe(upper);
    let strides = 0;
    for (let time = 0; time < child.plan.duration; time += 0.37) {
      const now = { ...animateMoonSettler(child, time) };
      if (!child.root.visible) continue;
      expect(child.root.scale.x).toBeCloseTo(now.scale * CHILD_SCALE, 9);
      // The joints a valley villager would have at the same step: a child's step is the
      // adult's at the distance divided by its scale, so its strides are shorter.
      const reference = { arms: limbs(), legs: limbs() };
      const step = (now.distance / CHILD_SCALE / 1.2) * Math.PI * 2;
      swingLimbs(reference.arms, reference.legs, step, now.walking);
      expect(pose(child)).toEqual(pose(reference).map((value) => expect.closeTo(value, 9)));
      if (now.walking) strides++;
    }
    expect(strides).toBeGreaterThan(10);
  }
});

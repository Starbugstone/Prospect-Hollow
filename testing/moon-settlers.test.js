import { describe, expect, it } from 'vitest';
import { Box3, Group } from 'three';
import {
  MOON_LOTS,
  MOON_RING_ROAD,
  MOON_ROADS,
  MOON_ROAD_WIDTH,
  moonApproaches,
  moonEntrance,
  moonPadRadius,
} from '../src/data/moonSettlement';
import {
  MOON_DOOR_TIME,
  MOON_OUTER_STROLLERS,
  MOON_SETTLER_LOOKS,
  moonSettlerLook,
  MOON_WALK_LANE,
  MOON_WALK_SPEED,
  animateMoonSettler,
  createMoonSettlers,
  moonOuterStrollers,
  moonSettlerBuildings,
  moonSuitFigure,
  moonSettlerPlan,
  moonSettlerPose,
  moonSettlerRoute,
  moonRoadWalk,
} from '../src/game/town/moon/MoonSettlers';
import { TownPrimitives } from '../src/game/town/TownPrimitives';

const ALL = Object.fromEntries(Object.keys(MOON_LOTS).map((id) => [id, 1]));
const LAYOUTS = {
  'every lot at level 1': ALL,
  'only the ribbon landing': { ribbonLanding: 1 },
  'homes and one other building': { settlerDomes: 1, craterHomesteads: 2, craterIceWell: 1 },
  'a home and the saucer pad': { settlerDomes: 2, saucerPad: 1 },
};
const HOMES = ['settlerDomes', 'craterHomesteads'];
const STEP = 0.02;
const flat = ([x, , z]) => [x, z];
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const walks = (plan) => plan.segments.filter(({ route }) => route);
// The pose a plan's segment has `elapsed` seconds into it.
const at = (plan, segment, elapsed) => segment.start + elapsed - plan.offset;
const levelOf = (levels, id) => levels[id] ?? 0;

// Every point along a route, including along each straight leg.
function* sampled(points, step = 0.25) {
  for (let n = 1; n < points.length; n++) {
    const [ax, , az] = points[n - 1],
      [bx, , bz] = points[n];
    const count = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / step));
    for (let s = 0; s <= count; s++)
      yield [ax + ((bx - ax) * s) / count, az + ((bz - az) * s) / count];
  }
}

describe.each(Object.entries(LAYOUTS))('settler routes with %s', (_, levels) => {
  const buildings = moonSettlerBuildings(levels);
  const pairs = buildings.flatMap((from) => buildings.map((to) => [from, to]));

  it('only enters built lots with a hatch, homes first and never the saucer pad', () => {
    const built = Object.keys(levels).filter((id) => levels[id] > 0 && id !== 'saucerPad');
    expect(buildings.map(({ id }) => id).sort()).toEqual(built.sort());
    const homes = buildings.filter(({ id }) => HOMES.includes(id)).length;
    expect(buildings.slice(0, homes).every(({ id }) => HOMES.includes(id))).toBe(true);
  });

  it('runs from one hatch to the other over finite, connected points', () => {
    for (const [from, to] of pairs) {
      const route = moonSettlerRoute(from, to),
        label = `${from.id} to ${to.id}`;
      expect(route.from).toBe(from.id);
      expect(route.to).toBe(to.id);
      expect(route.points.flat().every(Number.isFinite), label).toBe(true);
      const start = flat(route.points[0]),
        end = flat(route.points.at(-1));
      expect(gap(start, from.entry), label).toBeLessThan(1e-9);
      expect(gap(start, moonEntrance(from.id, levelOf(levels, from.id))), label).toBeLessThan(1e-9);
      expect(gap(end, to.entry), label).toBeLessThan(1e-9);
      expect(gap(end, moonEntrance(to.id, levelOf(levels, to.id))), label).toBeLessThan(1e-9);
      // The valley's walk path accumulates the polyline with no zero-length legs.
      const { ends } = route.path;
      expect(ends).toHaveLength(route.points.length - 1);
      ends.forEach((end, n) => expect(end - (ends[n - 1] ?? 0), label).toBeGreaterThan(1e-6));
      expect(route.length).toBeCloseTo(ends.at(-1), 9);
      // The public path meets the ring lane with a short step, not a jump.
      const out = from.points.length,
        back = route.points.length - to.points.length;
      expect(gap(route.points[out - 1], route.points[out]), label).toBeLessThan(1.5);
      expect(gap(route.points[back - 1], route.points[back]), label).toBeLessThan(1.5);
      // Pads are raised; walkers stand on them and on the road, never below the regolith.
      expect(
        route.points.every(([, y]) => y >= 0.04 - 1e-9 && y <= 0.27 + 1e-9),
        label,
      ).toBe(true);
    }
  });

  it('keeps off every pad except the two it connects', () => {
    const crossings = [];
    for (const [from, to] of pairs) {
      const route = moonSettlerRoute(from, to);
      const others = Object.entries(MOON_LOTS).filter(([id]) => id !== from.id && id !== to.id);
      for (const [x, z] of sampled(route.points))
        for (const [id, [lx, lz]] of others)
          if (Math.hypot(x - lx, z - lz) <= moonPadRadius(id))
            crossings.push(`${from.id} to ${to.id} crosses ${id}`);
    }
    expect([...new Set(crossings)]).toEqual([]);
  });

  it('plans the same day for the same settler, with the home being a home when one is built', () => {
    for (let n = 0; n < 6; n++) {
      const plan = moonSettlerPlan(levels, n);
      expect(moonSettlerPlan({ ...levels }, n)).toEqual(plan);
      const builtHome = HOMES.some((id) => levels[id] > 0);
      if (builtHome) expect(HOMES).toContain(plan.home);
      expect(plan.duration).toBeGreaterThan(0);
      expect(plan.offset).toBeGreaterThanOrEqual(0);
      expect(plan.offset).toBeLessThan(plan.duration);
      for (const segment of plan.segments) {
        expect(segment.route?.from ?? segment.inside).not.toBe('saucerPad');
        expect(segment.route?.to ?? segment.inside).not.toBe('saucerPad');
      }
      for (let t = 0; t < 40; t += 3.7)
        expect(moonSettlerPose(plan, t)).toEqual(moonSettlerPose(moonSettlerPlan(levels, n), t));
    }
  });

  it('walks continuously and appears or disappears only at a hatch', () => {
    for (let n = 0; n < 4; n++) {
      const plan = moonSettlerPlan(levels, n);
      const hatches = walks(plan).flatMap(({ route }) => [route.points[0], route.points.at(-1)]);
      const nearHatch = (pose) => Math.min(...hatches.map((h) => gap([pose.x, pose.z], flat(h))));
      // Collect problems and assert once: calling expect per frame is too slow.
      const problems = [];
      let previous = null,
        changes = 0;
      for (let t = 0; t <= plan.duration + STEP; t += STEP) {
        const pose = { ...moonSettlerPose(plan, t) };
        if (previous && previous.visible !== pose.visible) {
          changes++;
          const shown = pose.visible ? pose : previous;
          if (nearHatch(shown) >= 0.3 || shown.scale >= 0.1)
            problems.push(`appears or vanishes away from a hatch at ${t.toFixed(2)}`);
        }
        if (previous?.visible && pose.visible) {
          const step = Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z);
          if (step > MOON_WALK_SPEED * STEP + 1e-6)
            problems.push(`jumps ${step.toFixed(3)} at ${t.toFixed(2)}`);
        }
        if (
          pose.visible &&
          (![pose.x, pose.y, pose.z, pose.heading, pose.scale].every(Number.isFinite) ||
            pose.inside !== null)
        )
          problems.push(`invalid pose at ${t.toFixed(2)}`);
        previous = pose;
      }
      expect(problems, `settler ${n}`).toEqual([]);
      // Out and in for each of the six walks of the day (one may straddle the loop seam).
      expect(changes).toBeGreaterThanOrEqual(11);
      expect(changes).toBeLessThanOrEqual(12);
    }
  });

  it('hides the settler indoors and scales it through each hatch', () => {
    const plan = moonSettlerPlan(levels, 1);
    for (const segment of plan.segments) {
      if (segment.inside) {
        for (const f of [0.05, 0.5, 0.95]) {
          const pose = moonSettlerPose(plan, at(plan, segment, segment.duration * f));
          expect(pose.visible).toBe(false);
          expect(pose.scale).toBe(0);
          expect(pose.inside).toBe(segment.inside);
        }
        continue;
      }
      const door = (elapsed) => moonSettlerPose(plan, at(plan, segment, elapsed)).scale;
      expect(door(MOON_DOOR_TIME * 0.25)).toBeCloseTo(0.25, 6);
      expect(door(MOON_DOOR_TIME * 0.5)).toBeCloseTo(0.5, 6);
      expect(door(MOON_DOOR_TIME * 1.5)).toBe(1);
      expect(door(segment.duration / 2)).toBe(1);
      expect(door(segment.duration - MOON_DOOR_TIME * 0.5)).toBeCloseTo(0.5, 6);
      expect(door(segment.duration - MOON_DOOR_TIME * 0.25)).toBeCloseTo(0.25, 6);
      // Heading follows the path being walked.
      for (const f of [0.2, 0.4, 0.6, 0.8]) {
        const time = at(plan, segment, segment.duration * f);
        const a = { ...moonSettlerPose(plan, time - 1e-4) },
          b = moonSettlerPose(plan, time + 1e-4);
        const dx = b.x - a.x,
          dz = b.z - a.z;
        expect(Math.sin(b.heading) * dx + Math.cos(b.heading) * dz).toBeGreaterThan(0);
      }
    }
  });
});

it('only the ribbon landing: settlers stroll a full lap of the ring and come home', () => {
  const plan = moonSettlerPlan({ ribbonLanding: 1 }, 0);
  expect(plan.home).toBe('ribbonLanding');
  for (const { route } of walks(plan)) {
    expect(route.from).toBe('ribbonLanding');
    expect(route.to).toBe('ribbonLanding');
    expect(route.length).toBeGreaterThan(2 * Math.PI * (MOON_RING_ROAD - 0.5));
  }
});

it.each([
  ['no buildings', {}],
  ['null levels', null],
  ['undefined levels', undefined],
  ['only the saucer pad', { saucerPad: 1 }],
])('with %s the settler circles the ring road', (_, levels) => {
  expect(moonSettlerBuildings(levels)).toEqual([]);
  for (let n = 0; n < 4; n++) {
    const plan = moonSettlerPlan(levels, n);
    expect(plan.ring).toBe(true);
    expect(moonSettlerPlan(levels, n)).toEqual(plan);
    const problems = [];
    let previous = null;
    for (let t = 0; t < 120; t += 0.1) {
      const pose = { ...moonSettlerPose(plan, t) };
      if (!pose.visible || pose.scale !== 1) problems.push(`hidden at ${t}`);
      if (Math.abs(Math.hypot(pose.x, pose.z) - MOON_RING_ROAD) >= MOON_ROAD_WIDTH / 2)
        problems.push(`off the ring at ${t}`);
      if (previous) {
        const dx = pose.x - previous.x,
          dz = pose.z - previous.z;
        if (Math.hypot(dx, dz) >= 0.2) problems.push(`jumps at ${t}`);
        // Facing the direction of travel.
        if (Math.sin(pose.heading) * dx + Math.cos(pose.heading) * dz <= 0)
          problems.push(`walks backwards at ${t}`);
        if (pose.distance <= previous.distance) problems.push(`no stride at ${t}`);
      }
      previous = pose;
    }
    expect(problems, `settler ${n}`).toEqual([]);
  }
});

// Roads are data: a second ring with spokes, as a wider New Hollow lays them out.
describe('walking between ring roads', () => {
  const roads = { rings: [20.5, 45], spokes: [0, Math.PI / 2, Math.PI, -Math.PI / 2] };
  const at = (ring, angle) => [Math.cos(angle) * ring, Math.sin(angle) * ring];
  const radius = ([x, , z]) => Math.hypot(x, z);
  const angle = ([x, , z]) => Math.atan2(z, x);
  const near = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) < 1e-6;

  it('stays on one ring, the short way round, when both ends share it', () => {
    const walk = moonRoadWalk(at(45, 0.3), at(45, 0.9), 45, 45, roads);
    expect(walk.every((point) => Math.abs(radius(point) - 45) <= MOON_WALK_LANE + 0.01)).toBe(true);
    expect(near(angle(walk[0]), 0.3) && near(angle(walk.at(-1)), 0.9)).toBe(true);
  });

  it.each([
    ['out', 20.5, 0.2, 45, 1.2],
    ['in', 45, 2.9, 20.5, -2.6],
  ])('climbs %s by the spoke that makes the walk shortest', (_, fromRing, a, toRing, b) => {
    const walk = moonRoadWalk(at(fromRing, a), at(toRing, b), fromRing, toRing, roads);
    // It leaves on its own ring and arrives on the other, crossing once at a spoke.
    expect(Math.abs(radius(walk[0]) - fromRing)).toBeLessThanOrEqual(MOON_WALK_LANE + 0.01);
    expect(Math.abs(radius(walk.at(-1)) - toRing)).toBeLessThanOrEqual(MOON_WALK_LANE + 0.01);
    const jumps = walk.flatMap((point, n) =>
      n && Math.abs(radius(point) - radius(walk[n - 1])) > 1 ? [n] : [],
    );
    expect(jumps).toHaveLength(1);
    const spoke = angle(walk[jumps[0]]);
    expect(roads.spokes.some((s) => near(s, spoke))).toBe(true);
    // No other spoke gives a shorter walk.
    const cost = (s) =>
      Math.abs(Math.atan2(Math.sin(s - a), Math.cos(s - a))) * fromRing +
      Math.abs(Math.atan2(Math.sin(b - s), Math.cos(b - s))) * toRing;
    expect(cost(spoke)).toBeCloseTo(Math.min(...roads.spokes.map(cost)), 9);
    // The steps along each ring stay short, so walkers never cut across the ground.
    for (let n = 1; n < walk.length; n++)
      if (n !== jumps[0])
        expect(Math.hypot(walk[n][0] - walk[n - 1][0], walk[n][2] - walk[n - 1][2])).toBeLessThan(
          6,
        );
  });

  it('never laps a ring on the way between rings', () => {
    const walk = moonRoadWalk(at(20.5, 0), at(45, 0), 20.5, 45, roads);
    expect(walk.length).toBe(2);
  });
});

it('matches the shared access routes: settlers use each lot’s public path', () => {
  const approaches = moonApproaches(ALL);
  for (const building of moonSettlerBuildings(ALL))
    expect(approaches.find(({ id }) => id === building.id)).toStrictEqual(building);
});

describe('settler figure', () => {
  const d = new TownPrimitives(),
    parent = new Group();
  const figure = moonSuitFigure(d, { parent, suit: '#ece9e1' });
  const plan = moonSettlerPlan(ALL, 2);
  const settler = { ...figure, plan };
  const walk = walks(plan)[0],
    rest = plan.segments.find(({ inside }) => inside);

  it('builds a suited figure on the villager skeleton', () => {
    expect(figure.root.parent).toBe(parent);
    expect(figure.body.parent).toBe(figure.root);
    expect(figure.legs).toHaveLength(2);
    expect(figure.arms).toHaveLength(2);
    for (const { upper } of figure.legs) expect(upper.parent).toBe(figure.body);
    for (const { upper } of figure.arms) expect(upper.parent).toBe(figure.torso);
    for (const { upper, lower } of [...figure.legs, ...figure.arms]) {
      expect(lower.parent).toBe(upper);
      expect(upper.children.some((part) => part.isMesh)).toBe(true);
    }
  });

  it('swings legs and arms in opposition and bounces while walking', () => {
    let bounces = [];
    for (let elapsed = 1; elapsed < 4; elapsed += 0.13) {
      const pose = animateMoonSettler(settler, at(plan, walk, elapsed));
      expect(figure.root.visible).toBe(true);
      expect(figure.root.position.x).toBeCloseTo(pose.x, 9);
      expect(figure.root.position.z).toBeCloseTo(pose.z, 9);
      expect(figure.root.rotation.y).toBeCloseTo(pose.heading, 9);
      expect(figure.root.scale.x).toBeCloseTo(pose.scale, 9);
      const [left, right] = figure.legs.map(({ upper }) => upper),
        [leftArm, rightArm] = figure.arms.map(({ upper }) => upper);
      bounces.push(figure.body.position.y - 0.54);
      if (Math.abs(left.rotation.x) < 0.05) continue;
      expect(Math.sign(left.rotation.x)).toBe(-Math.sign(right.rotation.x));
      expect(left.rotation.x).toBeCloseTo(-right.rotation.x, 9);
      expect(Math.sign(leftArm.rotation.x)).toBe(-Math.sign(rightArm.rotation.x));
      // Each arm swings against the leg on its own side.
      expect(Math.sign(leftArm.rotation.x)).toBe(-Math.sign(left.rotation.x));
    }
    expect(Math.max(...bounces)).toBeGreaterThan(0.1);
    expect(Math.min(...bounces)).toBeLessThan(0.05);
    expect(Math.min(...bounces)).toBeGreaterThanOrEqual(0);
  });

  it('is hidden while resting indoors', () => {
    const pose = animateMoonSettler(settler, at(plan, rest, rest.duration / 2));
    expect(pose.visible).toBe(false);
    expect(figure.root.visible).toBe(false);
  });
});

// The outer ring is a long road: once something stands on it, settlers stroll round it.
describe('strollers on the outer ring', () => {
  const outer = MOON_ROADS.rings.at(-1);
  const outerLots = moonApproaches(null)
    .filter((route) => route.ring === outer)
    .map(({ id }) => id);
  const built = (count) => Object.fromEntries(outerLots.slice(0, count).map((id) => [id, 1]));

  it('sends one out for each built outer lot, up to the limit, and none before', () => {
    expect(outerLots.length).toBeGreaterThan(MOON_OUTER_STROLLERS);
    expect(moonOuterStrollers({})).toEqual([]);
    expect(moonOuterStrollers(null)).toEqual([]);
    expect(moonOuterStrollers({ settlerDomes: 3 })).toEqual([]);
    expect(moonOuterStrollers(built(1))).toHaveLength(1);
    expect(moonOuterStrollers(built(outerLots.length))).toHaveLength(MOON_OUTER_STROLLERS);
    // Both ways round.
    expect(new Set(moonOuterStrollers(built(4)).map(({ dir }) => dir)).size).toBe(2);
  });

  it('walks them along the edge of the outer ring at a walking pace', () => {
    for (const plan of moonOuterStrollers(built(4))) {
      const [a, b] = [10, 11].map((time) => ({ ...moonSettlerPose(plan, time) }));
      for (const pose of [a, b]) {
        const offset = Math.abs(Math.hypot(pose.x, pose.z) - outer);
        expect(offset).toBeCloseTo(MOON_WALK_LANE, 6);
        expect(offset).toBeLessThan(MOON_ROAD_WIDTH / 2);
      }
      const speed = Math.hypot(b.x - a.x, b.z - a.z);
      expect(speed).toBeGreaterThan(MOON_WALK_SPEED * 0.6);
      expect(speed).toBeLessThanOrEqual(MOON_WALK_SPEED);
    }
  });

  it('adds them after every other settler, whose days stay as they were', () => {
    const d = new TownPrimitives();
    const before = createMoonSettlers(d, new Group(), { settlerDomes: 2 });
    const after = createMoonSettlers(d, new Group(), { settlerDomes: 2, ...built(2) });
    expect(after.filter(({ plan }) => plan.radius === outer)).toHaveLength(2);
    expect(after.slice(-2).every(({ plan }) => plan.radius === outer)).toBe(true);
    expect(after.length - 2).toBe(before.length);
  });
});

describe('settlers told apart', () => {
  const d = new TownPrimitives();
  const signature = (figure) => {
    const parts = [];
    figure.root.updateMatrixWorld(true);
    figure.root.traverse((part) => {
      if (part.isMesh)
        parts.push(
          `${part.material.color.getHexString()} ${part.matrixWorld.elements.map((n) => n.toFixed(2))}`,
        );
    });
    return parts.sort().join('|');
  };
  const build = (look) => moonSuitFigure(d, { parent: new Group(), look });

  it('gives each look its own outline and colours', () => {
    const looks = MOON_SETTLER_LOOKS.map((look) => signature(build(look)));
    expect(new Set(looks).size).toBe(MOON_SETTLER_LOOKS.length);
    expect(new Set(MOON_SETTLER_LOOKS.map(({ suit }) => suit)).size).toBeGreaterThanOrEqual(6);
  });

  it('keeps the villager skeleton and the feet on the ground under every build', () => {
    for (const look of MOON_SETTLER_LOOKS) {
      const figure = build(look);
      expect(figure.body.position.y).toBeCloseTo(0.54, 6);
      expect(figure.legs).toHaveLength(2);
      for (const { upper } of figure.legs) expect(upper.parent).toBe(figure.body);
      expect(new Box3().setFromObject(figure.root).min.y).toBeCloseTo(0, 1);
      // The root stays unscaled: the walk's door scale is applied to it each frame.
      expect(figure.root.scale.toArray()).toEqual([1, 1, 1]);
    }
  });

  it('leaves a figure with no look as it was, for visitors and the unveiling crowd', () => {
    const plain = build(null);
    expect(plain.body.parent).toBe(plain.root);
    expect(signature(plain)).toBe(signature(moonSuitFigure(d, { parent: new Group() })));
    expect(signature(plain)).not.toBe(signature(build(MOON_SETTLER_LOOKS[0])));
  });

  it('lands any settler number on a look', () => {
    for (const n of [0, 7, 8, 205, -1, 2.9, NaN, undefined])
      expect(MOON_SETTLER_LOOKS).toContain(moonSettlerLook(n));
    expect(moonSettlerLook(8)).toBe(moonSettlerLook(0));
  });

  it('dresses a full settlement in several looks', () => {
    const settlers = createMoonSettlers(
      d,
      new Group(),
      Object.fromEntries(Object.keys(MOON_LOTS).map((id) => [id, 3])),
    );
    const suits = new Set();
    for (const settler of settlers.filter(({ root }) => root.name === 'New Hollow settler'))
      suits.add(settler.torso.children[0].material.color.getHexString());
    expect(suits.size).toBeGreaterThanOrEqual(5);
  });
});

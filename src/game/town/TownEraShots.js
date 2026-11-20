import { ERA_CONSTRUCTION } from '../../data/mineEvolution';
import { ERAS } from '../../data/eras';
import { BUILDINGS } from '../../data/town';
import { PLOTS } from './TownLayout';

// The era cinematic's camera, as one continuous move through five shots:
//
//   0 s   the town you built, seen from the south, leaning toward the ground the era you
//         are leaving opened;
//   3 s   a crane across the rooftops to the mine;
//   6 s   the works, circled slowly from one side to the other;
//   16 s  a lift away as the builders leave;
//   18 s  the new era, wide: the old town and the ground the era opens for building.
//
// No two eras play the same move: the opening follows the departing era, the circle round
// the works alternates its direction from one era to the next and the close follows the
// new one. Every key is [time, eye, focus] in world units; the camera eases between keys.
// Shots stay south of the mine, where the hillside cannot come between the lens and the works.
const MINE = [-2.8, 1.6, -17.8],
  HEART = [0, 1.2, 1];
const { buildStart, buildEnd, leave, duration } = ERA_CONSTRUCTION;
// The works, circled from the south-east to the south-west.
const ORBIT = [
  [buildStart, [8, 13, -4], MINE],
  [(buildStart + buildEnd) / 2, [-1.5, 9.5, -3.5], [-2.8, 1.2, -17.8]],
  [buildEnd, [-11, 12, -5.5], MINE],
  [leave, [-6, 20, 10], [-2.8, 2, -12]],
];
// The same circle the other way: mirrored across the line south from the mine.
const MIRRORED = ORBIT.map(([time, eye, focus]) => [
  time,
  [2 * MINE[0] - eye[0], eye[1], eye[2]],
  focus,
]);
/** How far the opening leans from the square toward the departing era's ground. */
export const ERA_OPENING_LEAN = 9;
/** The opening pair of keys: the town, leaning toward what the era `from` built. The
 * camera starts on the side of the square its circle round the works will begin from. */
function opening(from, mirrored) {
  const ground = eraNewGround(from);
  const far = ground ? Math.hypot(ground[0], ground[1]) : 0;
  // Ground beside the square leaves the town centred; ground far away pulls a little.
  const pull = far > 4 ? ERA_OPENING_LEAN / far : 0;
  // Never north: the mine's hillside stays out of the opening.
  const lean = ground ? [ground[0] * pull, Math.max(0, ground[1] * pull)] : [0, 0];
  const focus = [HEART[0] + lean[0], HEART[1], HEART[2] + lean[1]];
  const x = (east) => (mirrored ? 2 * MINE[0] - east : east);
  return [
    [0, [x(10) + lean[0] * 1.4, 24, 44 + lean[1]], focus],
    [3, [x(7) + lean[0] * 0.3, 17, 24 + lean[1] * 0.3], focus],
  ];
}
/** Whether the circle round the works runs the other way for the era `to`. */
export const eraOrbitMirrored = (to) =>
  Math.max(
    0,
    ERAS.findIndex(({ id }) => id === to),
  ) %
    2 ===
  1;

/**
 * Where the new era opens ground: the middle of the valley plots it introduces. An era
 * that adds none in the valley (its buildings rise on the Moon) looks at the town's heart.
 */
export function eraNewGround(era) {
  const points = BUILDINGS.filter((building) => building.introducedEra === era)
    .map(({ id }) => PLOTS[id])
    .filter(Boolean);
  if (!points.length) return null;
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, z]) => sum + z, 0) / points.length,
  ];
}
/** The closing wide shot: far enough back to hold the heart of town and the new ground. */
function finale(era) {
  const ground = eraNewGround(era) ?? [HEART[0], HEART[2]];
  // Lean from the square toward the new ground, keeping the town itself in the frame.
  const reach = Math.min(1, 26 / Math.max(1, Math.hypot(ground[0], ground[1])));
  const focus = [ground[0] * reach * 0.35, 1.2, ground[1] * reach * 0.35];
  const span = Math.hypot(focus[0], focus[2]);
  return [duration, [focus[0] * 0.55 + 6, 26 + span * 0.4, focus[2] + 27 + span * 0.4], focus];
}
const mix = (a, b, t) => a.map((value, i) => value + (b[i] - value) * t);
// A smooth path through the keys: the camera passes each one without stopping, and comes
// to rest only at the first and the last.
function along(keys, slot, n, t) {
  const point = (i) => keys[i][slot],
    at = (i) => keys[i][0];
  const tangent = (i) =>
    i === 0 || i === keys.length - 1
      ? point(i).map(() => 0)
      : point(i).map(
          (_, axis) => (point(i + 1)[axis] - point(i - 1)[axis]) / (at(i + 1) - at(i - 1)),
        );
  const span = at(n + 1) - at(n),
    s = (t - at(n)) / span,
    s2 = s * s,
    s3 = s2 * s;
  const from = tangent(n),
    to = tangent(n + 1);
  return point(n).map(
    (value, axis) =>
      (2 * s3 - 3 * s2 + 1) * value +
      (s3 - 2 * s2 + s) * span * from[axis] +
      (-2 * s3 + 3 * s2) * point(n + 1)[axis] +
      (s3 - s2) * span * to[axis],
  );
}

/**
 * The camera of the era cinematic at `time` seconds, leaving the era `from` and entering
 * the era `to`. A portrait screen stands farther back so the same subjects fit its width.
 * An unknown or missing era opens on the square, circles the usual way and closes on it.
 */
export function eraShot(time, { from, to, aspect = 1.6 } = {}) {
  const mirrored = eraOrbitMirrored(to);
  const keys = [...opening(from, mirrored), ...(mirrored ? MIRRORED : ORBIT), finale(to)];
  const t = Math.max(0, Math.min(duration, time));
  let n = 0;
  while (n < keys.length - 2 && t >= keys[n + 1][0]) n++;
  const focus = along(keys, 2, n, t);
  let eye = along(keys, 1, n, t);
  if (aspect < 0.8) eye = mix(focus, eye, 1.3);
  return { eye, focus };
}
export const ERA_SHOT_TIMES = Object.freeze([0, 3, ...ORBIT.map(([time]) => time), duration]);

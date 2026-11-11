import { ERA_CONSTRUCTION } from '../../data/mineEvolution';
import { BUILDINGS } from '../../data/town';
import { PLOTS } from './TownLayout';

// The era cinematic's camera, as one continuous move through five shots:
//
//   0 s   the town you built, seen from the south, drifting in over the square;
//   3 s   a crane across the rooftops to the mine;
//   6 s   the works, circled slowly from the south-east to the south-west;
//   16 s  a lift away as the builders leave;
//   18 s  the new era, wide: the old town and the ground the era opens for building.
//
// Every key is [time, eye, focus] in world units; the camera eases between keys. Shots
// stay south of the mine, where the hillside cannot come between the lens and the works.
const MINE = [-2.8, 1.6, -17.8],
  HEART = [0, 1.2, 1];
const { buildStart, buildEnd, leave, duration } = ERA_CONSTRUCTION;
const WORKS_KEYS = [
  [0, [10, 24, 44], HEART],
  [3, [7, 17, 27], HEART],
  [buildStart, [8, 13, -4], MINE],
  [(buildStart + buildEnd) / 2, [-1.5, 9.5, -3.5], [-2.8, 1.2, -17.8]],
  [buildEnd, [-11, 12, -5.5], MINE],
  [leave, [-6, 20, 10], [-2.8, 2, -12]],
];

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
 * The camera of the era cinematic at `time` seconds, entering the era `to`. A portrait
 * screen stands farther back so the same subjects fit its width.
 */
export function eraShot(time, { to, aspect = 1.6 } = {}) {
  const keys = [...WORKS_KEYS, finale(to)];
  const t = Math.max(0, Math.min(duration, time));
  let n = 0;
  while (n < keys.length - 2 && t >= keys[n + 1][0]) n++;
  const focus = along(keys, 2, n, t);
  let eye = along(keys, 1, n, t);
  if (aspect < 0.8) eye = mix(focus, eye, 1.3);
  return { eye, focus };
}
export const ERA_SHOT_TIMES = Object.freeze([...WORKS_KEYS.map(([time]) => time), duration]);

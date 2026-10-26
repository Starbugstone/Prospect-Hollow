import { isPlayableCell } from '../engine/BoardTopology';

// Grid-space outline, including the walls of interior holes and separate wells.
export function boardEdges(tiles, cols, rows) {
  const edges = [];
  const open = (x, y) =>
    x >= 0 && x < cols && y >= 0 && y < rows && isPlayableCell(tiles[y * cols + x]);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) {
      if (!open(x, y)) continue;
      if (!open(x, y - 1)) edges.push([x, y, x + 1, y]);
      if (!open(x + 1, y)) edges.push([x + 1, y, x + 1, y + 1]);
      if (!open(x, y + 1)) edges.push([x + 1, y + 1, x, y + 1]);
      if (!open(x - 1, y)) edges.push([x, y + 1, x, y]);
    }
  return edges;
}

// The cells a falling gem passes through, in grid units: `lead` cells queued straight
// above its entry cell (below it when the cavern falls up), then every cell of its
// gravity path. One point per cell lets a single tween carry the gem through bends at
// an even pace, without stopping.
export function fallRoute(path, cols, lead = 0, rise = false) {
  const entry = path[0];
  const col = entry % cols,
    row = Math.floor(entry / cols);
  const side = rise ? 1 : -1;
  return [
    ...Array.from({ length: lead }, (_, step) => ({ col, row: row + side * (lead - step) })),
    ...path.map((index) => ({ col: index % cols, row: Math.floor(index / cols) })),
  ];
}

// Phaser's Bounce.easeOut. A fall reaches its cell at IMPACT, then bounces three times.
const IMPACT = 1 / 2.75;
const bounceOut = (k) => {
  if (k < IMPACT) return 7.5625 * k * k;
  if (k < 2 / 2.75) return 7.5625 * (k - 1.5 / 2.75) ** 2 + 0.75;
  if (k < 2.5 / 2.75) return 7.5625 * (k - 2.25 / 2.75) ** 2 + 0.9375;
  return 7.5625 * (k - 2.625 / 2.75) ** 2 + 0.984375;
};

// A fall of `cells` cells, bounce included (ms).
export const fallDuration = (cells) => 190 + Math.min(5, cells) * 12;

// A floatstone moves against gravity at its own buoyant pace, a little calmer than the
// gems falling past it: it glides from rest for FLOAT_GLIDE of its motion, drifts
// FLOAT_OVERSHOOT cells past its cell and bobs gently back.
const FLOAT_LINGER = 70;
const FLOAT_GLIDE = 0.6;
const FLOAT_OVERSHOOT = 0.2;
export const floatDuration = (cells) => fallDuration(cells) + FLOAT_LINGER;

// How far along a route of `cells` cells a floatstone is, `u` (0–1) of the way through
// its motion: a smooth glide up to the drift past its cell, then a damped bob back.
function floatTravel(u, cells) {
  if (u < FLOAT_GLIDE)
    return ((cells + FLOAT_OVERSHOOT) * (1 - Math.cos((Math.PI * u) / FLOAT_GLIDE))) / 2;
  const w = Math.min(1, (u - FLOAT_GLIDE) / (1 - FLOAT_GLIDE));
  return cells + FLOAT_OVERSHOOT * Math.exp(-5 * w * w) * Math.cos(2.5 * Math.PI * w);
}

// Where a floatstone is, `k` (0–1) of the way through its motion, in grid units. It
// drifts past its cell along the route's last step, whichever way it travels.
function floatMotion(route) {
  const cells = route.length - 1;
  const end = route[cells],
    before = route[Math.max(0, cells - 1)];
  const point = { col: route[0].col, row: route[0].row, hidden: false, alpha: 1, beam: null };
  point.travelled = 0;
  const at = (k) => {
    const travelled = cells ? floatTravel(Math.min(1, Math.max(0, k)), cells) : 0;
    point.travelled = travelled;
    if (travelled >= cells) {
      point.col = end.col + (end.col - before.col) * (travelled - cells);
      point.row = end.row + (end.row - before.row) * (travelled - cells);
    } else {
      const step = Math.min(cells - 1, Math.floor(travelled));
      const part = travelled - step;
      point.col = route[step].col + (route[step + 1].col - route[step].col) * part;
      point.row = route[step].row + (route[step + 1].row - route[step].row) * part;
    }
    return point;
  };
  at.duration = floatDuration(cells);
  at.hides = false;
  at.dropsFrom = route[0];
  return at;
}
// A gem beamed through a portal shimmers out on the entrance pad for this long (ms),
// then shimmers back in on the exit pad for as long again before it drops out.
export const PORTAL_SHIMMER = 130;

// The two pads of a portal never touch (checked where levels are authored).
const leaps = (a, b) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) > 1;

// Where a shaped-board fall is, `k` (0–1) of the way through its `duration` (ms), in grid
// units. The gem accelerates through every cell of its route at the pace of a straight
// fall of the same length, then settles with the bounce of a one-cell drop, straight back
// against its fall. Bouncing a share of the whole route instead would carry a gem back
// around a bend or into the gem landing above it. Through a portal it falls on to the
// entrance pad, shimmers out (`beam: 'out'`, fading), shimmers in on the exit pad
// (`beam: 'in'`) and drops out of it from rest. It is hidden outside `frame` (a refill
// entering at a twin-gravity seam or out of a hole). A `float` (floatstone) moves with its
// own buoyant glide instead (see floatTravel).
export function fallMotion(route, { rise = false, frame = null, float = false } = {}) {
  // The legs between portal pads: each but the last ends on an entrance pad.
  const legs = [];
  let start = 0;
  for (let step = 1; step <= route.length; step++)
    if (step === route.length || leaps(route[step - 1], route[step])) {
      legs.push(route.slice(start, step));
      start = step;
    }
  if (float && legs.length === 1 && !frame) return floatMotion(route);
  let duration = 0;
  const phases = legs.flatMap((leg, index) => {
    const last = index === legs.length - 1;
    const fall = last ? fallDuration(leg.length - 1) : IMPACT * fallDuration(leg.length - 1);
    const phases = [{ leg, last, start: duration, duration: fall }];
    duration += fall;
    if (!last)
      for (const [beam, at] of [
        ['out', leg.at(-1)],
        ['in', legs[index + 1][0]],
      ]) {
        phases.push({ beam, at, start: duration, duration: PORTAL_SHIMMER });
        duration += PORTAL_SHIMMER;
      }
    return phases;
  });
  // One object per fall: the tween moves it on every frame.
  const point = { col: route[0].col, row: route[0].row, hidden: false, alpha: 1, beam: null };
  const at = (k) => {
    const time = Math.max(0, k) * duration;
    const phase = phases.find((phase) => time < phase.start + phase.duration) ?? phases.at(-1);
    const u = phase.duration ? Math.min(1, (time - phase.start) / phase.duration) : 1;
    Object.assign(point, { hidden: false, alpha: 1, beam: phase.beam ?? null });
    if (phase.beam) {
      point.col = phase.at.col;
      point.row = phase.at.row;
      point.alpha = phase.beam === 'out' ? 1 - u : u;
    } else {
      const { leg, last } = phase;
      const segments = leg.length - 1;
      const end = leg[segments];
      // On to a pad the whole phase is the fall; the last leg lands at IMPACT and bounces.
      const fall = last ? u : u * IMPACT;
      if (fall < IMPACT && segments > 0) {
        const travelled = segments * bounceOut(fall);
        const step = Math.min(segments - 1, Math.floor(travelled));
        const part = travelled - step;
        const from = leg[step],
          to = leg[step + 1];
        point.col = from.col + (to.col - from.col) * part;
        point.row = from.row + (to.row - from.row) * part;
      } else {
        point.col = end.col;
        point.row = end.row + (last ? (rise ? 1 : -1) * (1 - bounceOut(Math.min(1, fall))) : 0);
      }
    }
    if (frame && (point.row < frame[0] - 0.01 || point.row > frame[1] - 0.99)) point.hidden = true;
    return point;
  };
  at.duration = duration;
  at.hides = legs.length > 1 || !!frame;
  // Where its last drop starts: the start of the route, or the last exit pad on it.
  at.dropsFrom = legs.at(-1)[0];
  return at;
}

// Start delays (ms) for the shaped-board falls of one step. Every fall starts at once
// unless it would come within `gap` cells of another visible gem: where two routes
// merge, the gem that lands deeper goes first and the other waits behind it. Falls are
// `{ route, duration, motion, passes }`; `passes` marks a floatstone, which gems sink
// past on purpose. A fall that no wait can keep clear keeps its original timing.
export function fallDelays(falls, { gap = 0.7, tick = 2, wait = 8 } = {}) {
  // Cells as numbers; refills queue a few rows outside the board.
  const key = (col, row) => (row + 64) * 256 + col;
  const tracks = falls.map(({ route, duration, motion }) => {
    const count = Math.ceil(duration / tick) + 1;
    const cols = new Float64Array(count),
      rows = new Float64Array(count),
      hidden = new Uint8Array(count);
    for (let s = 0; s < count; s++) {
      const point = motion(Math.min(1, (s * tick) / duration));
      cols[s] = point.col;
      rows[s] = point.row;
      hidden[s] = point.hidden ? 1 : 0;
    }
    // Every cell the route passes and the cells around them.
    const reach = new Set();
    for (const { col, row } of route)
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) reach.add(key(col + dc, row + dr));
    return { count, cols, rows, hidden, route, reach };
  });
  // Gems on routes that never come within a cell of each other cannot meet.
  const near = (a, b) => b.route.some(({ col, row }) => a.reach.has(key(col, row)));
  // Routes that share a cell carry on together from there, so the gem with more of its
  // route left at any shared cell lands deeper and goes first.
  const visits = new Map();
  tracks.forEach(({ route }, fall) =>
    route.forEach((cell, step) => {
      const at = key(cell.col, cell.row);
      if (!visits.has(at)) visits.set(at, []);
      visits.get(at).push({ fall, left: route.length - 1 - step });
    }),
  );
  const before = falls.map(() => new Set());
  const blockers = falls.map(() => 0);
  for (const passing of visits.values())
    for (let a = 0; a < passing.length; a++)
      for (let b = a + 1; b < passing.length; b++) {
        const [first, second] =
          passing[a].left > passing[b].left ? [passing[a], passing[b]] : [passing[b], passing[a]];
        if (first.left === second.left || before[first.fall].has(second.fall)) continue;
        before[first.fall].add(second.fall);
        blockers[second.fall]++;
      }
  const order = [];
  const placed = new Set();
  while (order.length < falls.length) {
    let next = falls.findIndex((_, index) => !placed.has(index) && !blockers[index]);
    // Merging gravity never loops; should routes still disagree, keep the given order.
    if (next < 0) next = falls.findIndex((_, index) => !placed.has(index));
    placed.add(next);
    order.push(next);
    for (const later of before[next]) blockers[later]--;
  }
  const clash = (a, startA, b, startB) => {
    const end = Math.max(startA + a.count, startB + b.count);
    for (let t = Math.min(startA, startB); t < end; t++) {
      const sa = t - startA,
        sb = t - startB;
      // Only motion can bring gems together; gems at rest stay where the step left them.
      if ((sa <= 0 || sa >= a.count - 1) && (sb <= 0 || sb >= b.count - 1)) continue;
      const ia = Math.min(Math.max(sa, 0), a.count - 1),
        ib = Math.min(Math.max(sb, 0), b.count - 1);
      if (a.hidden[ia] || b.hidden[ib]) continue;
      const dc = a.cols[ia] - b.cols[ib],
        dr = a.rows[ia] - b.rows[ib];
      if (dc * dc + dr * dr < gap * gap) return true;
    }
    return false;
  };
  const starts = falls.map(() => 0);
  const done = [];
  const step = Math.max(1, Math.round(wait / tick));
  for (const index of order) {
    const track = tracks[index];
    const others = falls[index].passes
      ? []
      : done.filter((other) => !falls[other].passes && near(track, tracks[other]));
    const latest = Math.max(0, ...others.map((other) => starts[other] + tracks[other].count));
    for (let start = 0; start <= latest; start += step)
      if (!others.some((other) => clash(track, start, tracks[other], starts[other]))) {
        starts[index] = start;
        break;
      }
    done.push(index);
  }
  return starts.map((start) => start * tick);
}

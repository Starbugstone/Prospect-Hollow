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

// A portal hands a gem on to a cell that is not next to it.
const leaps = (a, b) => Math.max(Math.abs(a.col - b.col), Math.abs(a.row - b.row)) > 1;

// Where a shaped-board fall is, `k` (0–1) of the way through its tween, in grid units.
// The gem accelerates through every cell of its route at the pace of a straight fall of
// the same length, then settles with the bounce of a one-cell drop, straight back against
// its fall. Bouncing a share of the whole route instead would carry a gem back around a
// bend, through a portal or into the gem landing above it. It is hidden while it crosses
// a portal and outside `frame` (a refill entering at a twin-gravity seam or out of a hole).
export function fallMotion(route, { rise = false, frame = null } = {}) {
  const segments = route.length - 1;
  const end = route[segments];
  const jump = route.findIndex((cell, step) => step > 0 && leaps(route[step - 1], cell));
  const popsOut = jump === segments;
  // One object per fall: the tween moves it on every frame.
  const point = { col: route[0].col, row: route[0].row, hidden: false };
  const at = (k) => {
    point.hidden = false;
    if (k < IMPACT && segments > 0) {
      const travelled = segments * bounceOut(Math.max(0, k));
      const step = Math.min(segments - 1, Math.floor(travelled));
      const part = travelled - step;
      const from = route[step],
        to = route[step + 1];
      point.col = from.col + (to.col - from.col) * part;
      point.row = from.row + (to.row - from.row) * part;
      point.hidden = step === jump - 1 && part > 0.05 && part < 0.95;
    } else {
      point.col = end.col;
      // A gem that has just come out of a portal settles without a bounce.
      point.row = end.row + (popsOut ? 0 : (rise ? 1 : -1) * (1 - bounceOut(Math.min(1, k))));
    }
    if (frame && (point.row < frame[0] - 0.01 || point.row > frame[1] - 0.99)) point.hidden = true;
    return point;
  };
  at.hides = jump > 0 || !!frame;
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

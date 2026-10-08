import { gravityPath, isPlayableCell } from './BoardTopology.js';

// Low-gravity caverns: each playable cell may fall up (`tile.fall === 'up'`).
// Rows that share a direction form a frame; refill enters at the frame's far end.
// Floatstones are relics that travel against their cell's gravity. Boards without
// either feature keep the original gravity code and receipts unchanged.

const fallsUp = (tile) => tile?.fall === 'up';
const isFloatstone = (gem) => gem?.type === 'relic' && gem.float === true;
const isCargo = (gem) => gem?.type === 'relic';

export const usesGravityFrames = (board, tiles) =>
  tiles.some(fallsUp) || board.some(isFloatstone) || tiles.some((tile) => tile?.gravitySwitch);

// Contiguous row bands with one direction. A row takes the direction of its
// playable cells; rows without any playable cell join the band above them.
export function gravityFrames(tiles, cols, rows) {
  const frames = [];
  for (let row = 0; row < rows; row++) {
    const cells = Array.from({ length: cols }, (_, col) => tiles[row * cols + col]).filter(
      isPlayableCell,
    );
    const dir = cells.length ? (cells.some(fallsUp) ? 'up' : 'down') : frames.at(-1)?.dir;
    if (frames.at(-1)?.dir === dir || dir === undefined) {
      if (frames.length) frames.at(-1).end = row + 1;
      else frames.push({ start: row, end: row + 1, dir: 'down' });
    } else frames.push({ start: row, end: row + 1, dir });
  }
  return frames;
}

// Where cargo is heading: relics follow gravity, floatstones rise against it.
const cargoTravel = (gem, tile) => (fallsUp(tile) !== isFloatstone(gem) ? 'up' : 'down');

// Cargo is collected on an exit at the board edge it travels towards.
export const cargoCollects = (gem, tile, index, cols, rows) =>
  isCargo(gem) &&
  !!tile?.exit &&
  (cargoTravel(gem, tile) === 'down'
    ? Math.floor(index / cols) === rows - 1
    : Math.floor(index / cols) === 0);

// The cells cargo would pass through from `index`, including `index`. Framed
// boards move cargo straight along its column; other boards use the routed path.
export function cargoPath(board, tiles, index, cols, rows, gem = board[index]) {
  if (!usesGravityFrames(board, tiles) && !isFloatstone(gem))
    return gravityPath(tiles, index, cols, rows);
  const step = cargoTravel(gem, tiles[index]) === 'up' ? -cols : cols;
  const path = [];
  for (let cell = index; cell >= 0 && cell < cols * rows; cell += step) {
    if (!isPlayableCell(tiles[cell])) break;
    if (path.length && tiles[cell]?.fall !== tiles[index]?.fall) break;
    path.push(cell);
  }
  return path;
}

export const cargoReachesExit = (board, tiles, index, cols, rows, gem = board[index]) => {
  const end = cargoPath(board, tiles, index, cols, rows, gem).at(-1);
  return end !== undefined && cargoCollects(gem, tiles[end], end, cols, rows);
};

// Run a downward gravity routine inside one frame. Up frames are mirrored so the
// shared code sees an ordinary downward board; receipts map back with routes.
export function applyFrameGravity(board, tiles, cols, rows, frame, gravity, anchoredFloat) {
  const vrows = frame.end - frame.start;
  const real = (v) => {
    const vr = Math.floor(v / cols),
      col = v % cols;
    return (frame.dir === 'down' ? frame.start + vr : frame.end - 1 - vr) * cols + col;
  };
  const virtual = (index) => {
    const row = Math.floor(index / cols),
      col = index % cols;
    if (row < frame.start || row >= frame.end) return -1;
    return (frame.dir === 'down' ? row - frame.start : frame.end - 1 - row) * cols + col;
  };
  const size = vrows * cols;
  const vTiles = Array.from({ length: size }, (_, v) => {
    const tile = tiles[real(v)];
    const copy = { ...tile };
    for (const key of ['flowTo', 'portalTo'])
      if (Number.isInteger(tile?.[key])) {
        const target = virtual(tile[key]);
        if (target >= 0) copy[key] = target;
        else delete copy[key];
      }
    return copy;
  });
  const vBoard = Array.from({ length: size }, (_, v) => board[real(v)] ?? null);
  const vStep = { drops: [], spawns: [] };
  const rise = frame.dir === 'up';

  // Floatstones first: each rises through the empty cells straight above it.
  const pinned = new Set();
  for (let v = 0; v < size; v++) {
    if (!isFloatstone(vBoard[v]) || anchoredFloat(vTiles[v])) {
      if (isFloatstone(vBoard[v])) pinned.add(v);
      continue;
    }
    let target = v;
    while (
      target - cols >= 0 &&
      !vBoard[target - cols] &&
      isPlayableCell(vTiles[target - cols]) &&
      !anchoredFloat(vTiles[target - cols])
    )
      target -= cols;
    pinned.add(target);
    if (target === v) continue;
    const gem = vBoard[v];
    vBoard[v] = null;
    vBoard[target] = gem;
    const path = [];
    for (let cell = v; cell >= target; cell -= cols) path.push(cell);
    vStep.drops.push({ from: v, to: target, gem, path, float: true });
  }

  gravity(vBoard, vTiles, cols, vrows, vStep, pinned);

  for (let v = 0; v < size; v++) {
    const tile = tiles[real(v)];
    if (tile && vTiles[v].flowCursor !== undefined) tile.flowCursor = vTiles[v].flowCursor;
    board[real(v)] = vBoard[v];
  }
  const straight = (from, to) => {
    const path = [];
    for (let cell = from; cell <= to; cell += cols) path.push(cell);
    return path;
  };
  // Pinned floatstones never move again in the gravity pass, so every piece
  // keeps exactly one receipt. Rectangular receipts gain their straight route.
  const drops = vStep.drops.map((drop) => ({
    ...drop,
    path: drop.path ?? straight(drop.from, drop.to),
  }));
  // Rectangular refills enter at the frame's far edge, deepest first.
  const spawns = vStep.spawns.map((spawn) => ({
    ...spawn,
    path: spawn.path ?? straight(spawn.index % cols, spawn.index),
  }));
  return {
    drops: drops.map((drop) => ({
      ...drop,
      from: real(drop.from),
      to: real(drop.to),
      path: drop.path.map(real),
      ...(rise ? { rise } : {}),
    })),
    spawns: spawns.map((spawn) => ({
      ...spawn,
      index: real(spawn.index),
      path: spawn.path.map(real),
      ...(rise ? { rise } : {}),
      // Refills that enter at an inner seam stay hidden until they reach their own frame.
      ...((rise ? frame.end < rows : frame.start > 0) ? { frame: [frame.start, frame.end] } : {}),
    })),
  };
}

// The cargo items that cannot reach any exit in the current gravity, used by
// hints to value a gravity switch.
export const strandedCargo = (board, tiles, cols, rows) =>
  board.flatMap((gem, index) =>
    isCargo(gem) && !cargoReachesExit(board, tiles, index, cols, rows) ? [index] : [],
  );

// Gravity switches are floor markers on side or corner cells; gems pass freely. Only a
// bonus blast that covers one flips gravity, at most once per move: every cell that
// fell down now falls up and the other way round. A moon lock (`'lock'`) works once
// and leaves the board; a moon dial (`'dial'`) stays and flips again on a later move.
export const isGravitySwitch = (tile) =>
  tile?.gravitySwitch === 'lock' || tile?.gravitySwitch === 'dial';

export function flipGravity(tiles, switchIndex, step) {
  for (const tile of tiles) {
    if (!tile || tile.type === 'void') continue;
    if (fallsUp(tile)) delete tile.fall;
    else tile.fall = 'up';
  }
  const tile = tiles[switchIndex];
  if (tile.gravitySwitch === 'lock') tile.gravitySwitch = null;
  step.tileUpdates.push({ index: switchIndex, gravitySwitch: tile.gravitySwitch, fall: tile.fall });
  step.gravityFlip = { index: switchIndex, up: fallsUp(tile) };
}

// How many cargo pieces a flip would set free (positive) or strand (negative).
export function flipGain(board, tiles, cols, rows) {
  const flipped = tiles.map((tile) =>
    !tile || tile.type === 'void'
      ? tile
      : fallsUp(tile)
        ? { ...tile, fall: undefined }
        : { ...tile, fall: 'up' },
  );
  return (
    strandedCargo(board, tiles, cols, rows).length -
    strandedCargo(board, flipped, cols, rows).length
  );
}

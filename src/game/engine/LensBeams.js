import { isPlayableCell } from './BoardTopology.js';

// Lens mirrors sit on edge cells outside the playable board (`tile.lens` names the
// direction a beam leaves in). A row or column sweep that reaches a lens at either
// end of its line turns there: an orthogonal lens sends it along the board edge or
// back across it, a diagonal lens sends it corner to corner. A turned beam hits every
// playable cell on its way, and the next lens it meets turns it again. Each lens turns
// a given beam once, which also guards against loops.
const STEPS = Object.freeze({
  n: [-1, 0],
  s: [1, 0],
  e: [0, 1],
  w: [0, -1],
  ne: [-1, 1],
  nw: [-1, -1],
  se: [1, 1],
  sw: [1, -1],
});
export const isLens = (tile) => Object.hasOwn(STEPS, tile?.lens ?? '');
export const isDiagonalLens = (tile) => isLens(tile) && tile.lens.length === 2;
export const hasLenses = (tiles = []) => tiles.some(isLens);

const lineEnds = ({ axis, index }, cols, rows) =>
  axis === 'row' ? [index * cols, index * cols + cols - 1] : [index, (rows - 1) * cols + index];

// The cells a set of straight sweeps reaches through lenses, and each turned segment
// (for presentation): `{ cells, beams: [{ lens, cells }] }`.
export function bentBeams(tiles, cols, rows, lines) {
  const cells = new Set();
  const beams = [];
  const used = new Set();
  const queue = [];
  const enqueue = (index) => {
    if (used.has(index) || !isLens(tiles[index])) return;
    used.add(index);
    queue.push(index);
  };
  for (const line of lines) for (const end of lineEnds(line, cols, rows)) enqueue(end);
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const lens = queue[cursor];
    const [dr, dc] = STEPS[tiles[lens].lens];
    const segment = [];
    let row = Math.floor(lens / cols) + dr;
    let col = (lens % cols) + dc;
    while (row >= 0 && row < rows && col >= 0 && col < cols) {
      const cell = row * cols + col;
      if (isLens(tiles[cell])) {
        enqueue(cell);
        segment.push(cell);
        break;
      }
      if (isPlayableCell(tiles[cell])) {
        cells.add(cell);
        segment.push(cell);
      }
      row += dr;
      col += dc;
    }
    beams.push({ lens, cells: segment });
  }
  return { cells: [...cells], beams };
}

// Line sweeps of the board bonuses and powers that use rows and columns.
export function sweepLines(type, index, cols) {
  const row = Math.floor(index / cols),
    col = index % cols;
  if (type === 'cross' || type === 'tile-breaker')
    return [
      { axis: 'row', index: row },
      { axis: 'column', index: col },
    ];
  if (type === 'clear-row') return [{ axis: 'row', index: row }];
  return [];
}

// Presentation: the beam is assumed to arrive square to the edge the lens sits on
// (sideways at a corner). `out` is a unit vector; `angle` turns the mirror art, drawn
// with its face up, so that it reflects the incoming beam into `out`.
export function lensGeometry(index, direction, cols, rows) {
  const [dr, dc] = STEPS[direction];
  const length = Math.hypot(dr, dc);
  const out = [dc / length, dr / length];
  const row = Math.floor(index / cols),
    col = index % cols;
  const side = col === 0 || col === cols - 1;
  const ends = row === 0 || row === rows - 1;
  const horizontal = side && (!ends || dr !== 0);
  const incoming = horizontal ? [col === 0 ? -1 : 1, 0] : [0, row === 0 ? -1 : 1];
  const normal = [out[0] - incoming[0], out[1] - incoming[1]];
  const angle = (Math.atan2(normal[1], normal[0]) * 180) / Math.PI + 90;
  return { out, angle };
}

// A blast ledger (cell → separate blast count) that also records lens-turned beams.
export const blastLog = () => Object.assign(new Map(), { lenses: { bent: new Set(), beams: [] } });

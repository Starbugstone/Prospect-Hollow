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

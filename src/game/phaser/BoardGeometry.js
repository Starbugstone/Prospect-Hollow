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

// Keep bends, but animate a straight shaft as one fall instead of stopping at every cell.
export function fallWaypoints(path, cols) {
  return path.filter((index, position) => {
    if (position === 0 || position === path.length - 1) return true;
    const before = path[position - 1],
      after = path[position + 1];
    const dx1 = (index % cols) - (before % cols),
      dy1 = Math.floor(index / cols) - Math.floor(before / cols);
    const dx2 = (after % cols) - (index % cols),
      dy2 = Math.floor(after / cols) - Math.floor(index / cols);
    return dx1 * dy2 !== dx2 * dy1;
  });
}

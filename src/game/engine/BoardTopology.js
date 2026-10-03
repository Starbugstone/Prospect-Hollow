// A missing tile retains the rectangular-board fallback. Permanent voids are
// authored cells, not temporarily empty sockets or breakable stone.
export const isPlayableCell = (tile) => tile?.type !== 'void';

export function gravityDestination(tiles, index, cols, rows) {
  if (
    !cols ||
    !rows ||
    !Number.isInteger(index) ||
    index < 0 ||
    index >= cols * rows ||
    !isPlayableCell(tiles[index])
  )
    return -1;
  const row = Math.floor(index / cols);
  if (row + 1 >= rows) return -1;
  const flow = tiles[index]?.flowTo;
  if (
    Number.isInteger(flow) &&
    flow >= 0 &&
    flow < cols * rows &&
    Math.floor(flow / cols) === row + 1 &&
    Math.abs((flow % cols) - (index % cols)) <= 1 &&
    isPlayableCell(tiles[flow])
  )
    return flow;
  const below = index + cols;
  return isPlayableCell(tiles[below]) ? below : -1;
}

export function incomingGravity(tiles, cols, rows) {
  const incoming = Array.from({ length: cols * rows }, () => []);
  for (let index = 0; index < incoming.length; index++) {
    const target = gravityDestination(tiles, index, cols, rows);
    if (target >= 0) incoming[target].push(index);
  }
  return incoming;
}

export function gravityPath(tiles, index, cols, rows) {
  const path = [];
  while (index >= 0 && index < cols * rows && isPlayableCell(tiles[index])) {
    path.push(index);
    index = gravityDestination(tiles, index, cols, rows);
  }
  return path;
}

// A relic here can still fall to a collection exit on the bottom row. Breakable
// anchors on the way only delay it; permanent voids end the route.
export function drainsToExit(tiles, index, cols, rows) {
  const end = gravityPath(tiles, index, cols, rows).at(-1);
  return end >= (rows - 1) * cols && !!tiles[end]?.exit;
}

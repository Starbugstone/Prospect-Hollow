// Moon locks and dials fill their own side or corner cell: no gem enters or rests
// there, but a bonus blast that covers one turns gravity over (see GravityFrames.js).
export const isGravitySwitch = (tile) =>
  tile?.gravitySwitch === 'lock' || tile?.gravitySwitch === 'dial';

// Portal pads fill their own cell too. A gem falls into the entrance pad and drops
// out of the paired exit pad at the top of the board.
export const isPortalPad = (tile) => tile?.portal === 'in' || tile?.portal === 'out';

// Fixtures that fill their own cell: no gem enters or rests there.
export const isCellFixture = (tile) => isGravitySwitch(tile) || isPortalPad(tile);

// A missing tile retains the rectangular-board fallback. Permanent voids are
// authored cells, not temporarily empty sockets or breakable stone. A sealed cell
// belongs to a chamber that has not been broken into yet (see Breakthroughs.js).
// A used moon lock becomes an ordinary cell, like an opened chamber.
export const isPlayableCell = (tile) =>
  tile?.type !== 'void' && !tile?.sealed && !isCellFixture(tile);

// Cells a bonus blast reaches: playable cells and the gravity switches it can turn.
export const isBlastTarget = (tile) => isPlayableCell(tile) || isGravitySwitch(tile);

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
  // The cell above an entrance pad hands its gem to the cell below the exit pad.
  const portal = tiles[index]?.portalTo;
  if (
    Number.isInteger(portal) &&
    portal >= 0 &&
    portal < cols * rows &&
    portal !== index &&
    isPlayableCell(tiles[portal])
  )
    return portal;
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

// The cells a gem passes on its way, with the pads of each portal it rides: it sinks
// into the entrance below the cell it leaves and drops out of the exit above the next.
export function withPortalPads(tiles, path) {
  return path.flatMap((index, step) => {
    const from = path[step - 1];
    if (!step || tiles[from]?.portalTo !== index) return [index];
    const pad = (end) =>
      tiles.findIndex((tile) => tile?.portal === end && tile.portalPair === tiles[from].portalPair);
    const pads = [pad('in'), pad('out')];
    return pads.includes(-1) ? [index] : [...pads, index];
  });
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
  // Portals may jump upwards, so a misauthored loop must still end.
  while (
    index >= 0 &&
    index < cols * rows &&
    isPlayableCell(tiles[index]) &&
    !path.includes(index)
  ) {
    path.push(index);
    index = gravityDestination(tiles, index, cols, rows);
  }
  return path;
}

// Boards whose gravity is routed (shaped walls, diagonal flow or portals).
export const isRoutedBoard = (tiles) =>
  tiles.some(
    (tile) =>
      !isPlayableCell(tile) || Number.isInteger(tile?.flowTo) || Number.isInteger(tile?.portalTo),
  );

// A relic here can still fall to a collection exit on the bottom row. Breakable
// anchors on the way only delay it; permanent voids end the route.
export function drainsToExit(tiles, index, cols, rows) {
  const end = gravityPath(tiles, index, cols, rows).at(-1);
  return end >= (rows - 1) * cols && !!tiles[end]?.exit;
}

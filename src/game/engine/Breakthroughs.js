// Breakthrough caverns: a sealed chamber (`tile.sealed`, `tile.chamber`) waits behind
// a cracked wall of blast-only cells (`tile.waist` names the chamber). Once every
// piece of that wall is broken, the chamber opens: its cells become playable and fill
// from above in the same move. Opening is permanent and never needs anything else.
// A chain inside the chamber holds a gem, as a chain on the open board does: each empty
// chained cell receives one new ordinary gem (`newGem`) where it stands, before gravity.
export const hasSealedChambers = (tiles = []) => tiles.some((tile) => tile?.sealed);

export function openBreakthroughs(tiles, step, board, newGem) {
  const chambers = new Set(tiles.flatMap((tile) => (tile?.sealed ? [tile.chamber] : [])));
  for (const chamber of chambers) {
    const wall = tiles.filter((tile) => tile?.waist === chamber);
    if (wall.some((tile) => tile.health > 0)) continue;
    for (const [index, tile] of tiles.entries()) {
      if (!tile?.sealed || tile.chamber !== chamber) continue;
      tile.sealed = false;
      step.tileUpdates.push({ index, sealed: false });
      if (tile.chainHealth > 0 && !board[index]) {
        board[index] = newGem();
        step.spawns.push({ index, gem: board[index], appear: true });
      }
    }
    step.breakthroughs ??= [];
    step.breakthroughs.push(chamber);
  }
}

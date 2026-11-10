import { isPlayableCell } from './BoardTopology.js';
import { GEM_TYPES } from './GemFactory.js';

export const isCrystalSignal = (tile) => tile?.signal === 'trace';

export function applyCrystalSpec(tiles, spec) {
  for (const { cells, facet } of spec.tracePairs ?? []) {
    for (const [side, index] of cells.entries())
      Object.assign(tiles[index], {
        signal: 'trace',
        signalHealth: 1,
        tracePeer: cells[1 - side],
        traceFacet: facet,
      });
  }
}

// Pure footprint preview, shared by resolution and hints. Stamps copy only the
// swap's direct ordinary matches; a cascade, blast or shuffle cannot spend them.
export function traceCopies(tiles, matches, cols, rows, directSwap) {
  if (!directSwap) return [];
  const copies = [];
  const spent = new Set();
  for (let from = 0; from < tiles.length; from++) {
    const tile = tiles[from];
    if (
      tile?.signal !== 'trace' ||
      !tile.signalHealth ||
      spent.has(from) ||
      !isPlayableCell(tile) ||
      tile.state === 'FROZEN'
    )
      continue;
    const to = tile.tracePeer;
    if (!tiles[to]?.signalHealth || !isPlayableCell(tiles[to])) continue;
    const touching = matches.filter(
      (match) => GEM_TYPES.includes(match.type) && match.indices.includes(from),
    );
    if (!touching.length) continue;
    // Both twins may match at once: copy both footprints from this snapshot.
    for (const [source, target] of [
      [from, to],
      [to, from],
    ]) {
      if (tiles[source].state === 'FROZEN') continue;
      const footprint = new Set(
        matches
          .filter((match) => GEM_TYPES.includes(match.type) && match.indices.includes(source))
          .flatMap((match) => match.indices),
      );
      if (!footprint.size) continue;
      const targets = [...footprint].flatMap((cell) => {
        const x = (target % cols) + (cell % cols) - (source % cols);
        const y = Math.floor(target / cols) + Math.floor(cell / cols) - Math.floor(source / cols);
        const index = y * cols + x;
        return x >= 0 && x < cols && y >= 0 && y < rows && isPlayableCell(tiles[index])
          ? [index]
          : [];
      });
      copies.push({ from: source, to: target, facet: tile.traceFacet, targets });
    }
    spent.add(from);
    spent.add(to);
  }
  return copies;
}

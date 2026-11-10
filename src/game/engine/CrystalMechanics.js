import { isPlayableCell } from './BoardTopology.js';
import { GEM_TYPES } from './GemFactory.js';

export const isCrystalSignal = (tile) => ['trace', 'crossgrain', 'chord'].includes(tile?.signal);

export function applyCrystalSpec(tiles, spec) {
  for (const index of spec.chords ?? [])
    Object.assign(tiles[index], {
      signal: 'chord',
      signalHealth: 3,
      chordColors: '',
      chordWilds: 0,
    });
  for (const index of spec.crossgrains ?? [])
    Object.assign(tiles[index], { signal: 'crossgrain', signalHealth: 2, grainRemaining: 3 });
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

// Direction stays on each match, rather than being flattened into hit cells.
// The same pure rule values missing cracks in hints and resolves actual hits.
export function crystalHits(tiles, matches, blastIndices, blockedBlasts = new Set()) {
  const blasts = new Set(blastIndices);
  const updates = [];
  for (const [index, tile] of tiles.entries()) {
    if (
      !['crossgrain', 'chord'].includes(tile?.signal) ||
      !tile.signalHealth ||
      !isPlayableCell(tile) ||
      tile.state === 'FROZEN'
    )
      continue;
    if (tile.signal === 'chord') {
      const colors = (tile.chordColors ?? '').split(',').filter(Boolean);
      let wilds = tile.chordWilds ?? 0;
      for (const match of matches)
        if (
          GEM_TYPES.includes(match.type) &&
          match.indices.includes(index) &&
          !colors.includes(match.type) &&
          colors.length + wilds < 3
        )
          colors.push(match.type);
      const blast = blasts.has(index) && !blockedBlasts.has(index) && colors.length + wilds < 3;
      if (blast) wilds++;
      const health = Math.max(0, 3 - colors.length - wilds);
      if (health !== tile.signalHealth)
        updates.push({
          index,
          chordColors: colors.join(','),
          chordWilds: wilds,
          signalHealth: health,
          crystalBlast: blast,
        });
      continue;
    }
    let remaining = tile.grainRemaining;
    for (const match of matches) {
      if (!GEM_TYPES.includes(match.type) || !match.indices.includes(index)) continue;
      if (match.orientation === 'horizontal') remaining &= ~1;
      if (match.orientation === 'vertical') remaining &= ~2;
    }
    const blast = blasts.has(index) && !blockedBlasts.has(index) && remaining > 0;
    if (blast) remaining &= remaining - 1;
    if (remaining === tile.grainRemaining) continue;
    updates.push({
      index,
      grainRemaining: remaining,
      signalHealth: Number(!!(remaining & 1)) + Number(!!(remaining & 2)),
      crystalBlast: blast,
    });
  }
  return updates;
}

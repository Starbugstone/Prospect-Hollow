export const isAnchored = (tile) =>
  tile?.state === 'FROZEN' ||
  (tile?.chainHealth ?? 0) > 0 ||
  (tile?.type === 'blocker' && tile.health > 0);

export const canSwapGem = (gem, tile) => !!gem && gem.type !== 'relic' && !isAnchored(tile);

export const layerCount = (tile) =>
  (tile?.health ?? 0) + (tile?.chainHealth ?? 0) + (tile?.signalHealth ?? 0);

export const neighborsOf = (index, cols, rows) =>
  [
    index % cols > 0 ? index - 1 : -1,
    index % cols < cols - 1 ? index + 1 : -1,
    index - cols,
    index + cols,
  ].filter((neighbor) => neighbor >= 0 && neighbor < cols * rows);

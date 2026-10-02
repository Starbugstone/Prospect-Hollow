import { isPlayableCell } from './BoardTopology.js';

const validCell = (tiles, index) =>
  Number.isInteger(index) && index >= 0 && !!tiles[index] && isPlayableCell(tiles[index]);
const layersOf = (value) => (value === 2 ? 2 : 1);
const definitions = (value) => (Array.isArray(value) ? value : []);

// New chapters author footprints and links; resolution still uses the existing
// floor-health, blocker and chain rules. Missing definitions leave old levels alone.
export function applyDeepMineSpec(tiles, spec = {}) {
  for (const [order, fossil] of definitions(spec?.fossils).entries()) {
    const cells = [...new Set(definitions(fossil?.cells))].filter(
      (index) => validCell(tiles, index) && tiles[index].type !== 'blocker',
    );
    const group = fossil?.id ?? `fossil-${order + 1}`;
    for (const [part, index] of cells.entries())
      Object.assign(tiles[index], {
        fossilGroup: group,
        fossilPart: part,
        fossilCollected: false,
        health: layersOf(fossil.layers),
        maxHealth: layersOf(fossil.layers),
        ...(fossil.encased ? { type: 'blocker', bonusOnly: true } : {}),
      });
  }
  for (const [order, root] of definitions(spec?.roots).entries()) {
    if (!validCell(tiles, root?.knot)) continue;
    const group = root.id ?? `root-${order + 1}`;
    Object.assign(tiles[root.knot], {
      type: 'blocker',
      rootGroup: group,
      rootKnot: true,
      health: layersOf(root.knotHealth),
      maxHealth: layersOf(root.knotHealth),
    });
    for (const index of new Set(definitions(root.bindings))) {
      if (!validCell(tiles, index) || tiles[index].type === 'blocker') continue;
      Object.assign(tiles[index], {
        rootGroup: group,
        chainHealth: layersOf(root.bindingHealth),
        maxChainHealth: layersOf(root.bindingHealth),
      });
    }
  }
  for (const spore of definitions(spec?.spores)) {
    if (!validCell(tiles, spore?.index) || tiles[spore.index].type !== 'standard') continue;
    Object.assign(tiles[spore.index], {
      signal: 'spore',
      signalHealth: 1,
      sporeAxis: spore.axis === 'column' ? 'column' : 'row',
    });
  }
  return tiles;
}

const fossilGroups = (tiles) => {
  const groups = new Map();
  for (const [index, tile] of tiles.entries()) {
    if (tile?.fossilGroup == null) continue;
    if (!groups.has(tile.fossilGroup)) groups.set(tile.fossilGroup, []);
    groups.get(tile.fossilGroup).push(index);
  }
  return groups;
};

// Display counters are derived from the authoritative layers. They add no
// completion gate, move allowance or separately persisted progression state.
export function deepMineProgress(tiles = []) {
  const fossils = [...fossilGroups(tiles).values()];
  const knots = tiles.filter((tile) => tile?.rootKnot);
  return {
    fossils: {
      total: fossils.length,
      completed: fossils.filter((cells) => cells.every((index) => !tiles[index].health)).length,
    },
    roots: {
      total: knots.length,
      completed: knots.filter((tile) => !tile.health).length,
    },
  };
}

// Run after all hits, before gravity. A knot and one of its bindings may be hit
// simultaneously; the binding absorbs its own hit before the knot frees the rest.
export function releaseCutRoots(tiles, step) {
  const groups = new Set(
    step.tileUpdates.flatMap((update) =>
      update.health === 0 && tiles[update.index]?.rootKnot && tiles[update.index].rootGroup != null
        ? [tiles[update.index].rootGroup]
        : [],
    ),
  );
  let removed = 0;
  for (const [index, tile] of tiles.entries()) {
    if (!tile?.chainHealth || !groups.has(tile.rootGroup)) continue;
    removed += tile.chainHealth;
    tile.chainHealth = 0;
    step.tileUpdates.push({ index, chainHealth: 0 });
  }
  return removed;
}

// Revealed groups collect automatically once, including when the final patch
// was uncovered by a cascade or special effect. The receipt is presentation only.
export function collectFinishedFossils(tiles, step) {
  for (const [group, cells] of fossilGroups(tiles)) {
    if (cells.some((index) => tiles[index].health > 0)) continue;
    if (cells.every((index) => tiles[index].fossilCollected)) continue;
    for (const index of cells) {
      tiles[index].fossilCollected = true;
      step.tileUpdates.push({ index, fossilCollected: true });
    }
    step.collectedFossils ??= [];
    step.collectedFossils.push({ group, indices: [...cells] });
  }
}

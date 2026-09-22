import { MatchEngine } from './MatchEngine.js';
import { createGem, randomGemType, GEM_TYPES } from './GemFactory.js';
import { detectBonusFromMatches } from './MatchPatterns.js';
import { isAnchored, neighborsOf } from './TileRules.js';
import { BonusActivator } from './BonusActivator.js';
import { signalTargets } from './ChapterMechanics.js';

const matchEngine = new MatchEngine();
const bonusActivator = new BonusActivator();

export class TileManager {
  getResolution({
    board,
    tiles,
    matches,
    cols,
    rows,
    bonusesCreated,
    bonusIndices,
    pendingBonus = null,
    gemTypes = GEM_TYPES,
  }) {
    if (!matches?.length) {
      return { board, steps: [] };
    }

    const totalCols = cols;
    const inferredRows = cols ? board.length / cols : 0;
    const totalRows = rows ?? Math.max(0, Math.round(inferredRows));

    if (!totalCols || !totalRows) {
      return { board, steps: [] };
    }

    const workingBoard = [...board];
    const hasSignals = tiles.some((tile) => tile.signalHealth > 0);
    const steps = [];

    let iteration = 0;
    let pendingMatches = matches.map((match) => ({
      type: match.type,
      indices: [...match.indices],
      orientation: match.orientation,
      fusion: match.fusion,
    }));
    let totalLayersCleared = 0;
    let relicsCollected = 0;

    while (pendingMatches.length) {
      if (iteration >= 128) throw new Error('Cascade did not settle after 128 steps');
      const cleared = new Set();
      const impacted = new Set();
      const protectedIndices = new Set();
      const cascadeBonuses = [];
      const fusion = pendingMatches.find((match) => match.fusion)?.fusion;
      const fusionTargets = new Set(fusion?.targets ?? []);

      pendingMatches.forEach((match) => {
        match.indices.forEach((index) => {
          const tile = tiles[index];
          if (!tile || tile.state !== 'FROZEN' || fusionTargets.has(index)) {
            if (index < 0 || index >= workingBoard.length) return;
            impacted.add(index);
            if (workingBoard[index] && workingBoard[index].type !== 'relic' && !isAnchored(tile))
              cleared.add(index);
          }
        });
      });

      if (steps.length > 0) {
        const newBonuses = detectBonusFromMatches(pendingMatches);
        if (newBonuses.length > 0) {
          newBonuses.forEach((bonus) => {
            cascadeBonuses.push(bonus);
            workingBoard[bonus.index] = createGem(bonus.type);
          });
        }
      }

      // Only the first step creates and protects bonuses earned by the swap.
      if (steps.length === 0) {
        const hasBonusArrays = Array.isArray(bonusesCreated) && Array.isArray(bonusIndices);
        if (hasBonusArrays) {
          const loopCount = Math.min(bonusesCreated.length, bonusIndices.length);
          for (let i = 0; i < loopCount; i += 1) {
            const bonusIndex = bonusIndices[i];
            protectedIndices.add(bonusIndex);
            cleared.delete(bonusIndex);
            cascadeBonuses.push({ type: bonusesCreated[i], index: bonusIndex });
          }
          if (bonusesCreated.length !== bonusIndices.length) {
            console.warn('TileManager: bonus metadata length mismatch', {
              bonusesCreatedLength: bonusesCreated.length,
              bonusIndicesLength: bonusIndices.length,
            });
          }
        } else if (bonusesCreated || bonusIndices) {
          console.warn(
            'TileManager: expected arrays for bonusesCreated and bonusIndices during initial swap handling',
          );
        }
      }

      // Handle bonus from cascade
      cascadeBonuses.forEach((bonus) => {
        protectedIndices.add(bonus.index);
        cleared.delete(bonus.index);
      });

      const damageTargets = new Set([...impacted, ...protectedIndices]);
      // A block takes one hit per cascade step, even if several matched gems
      // or overlapping blast cells touch it. Diagonal matches do not damage it.
      for (const index of [...damageTargets]) {
        for (const neighbor of neighborsOf(index, totalCols, totalRows)) {
          if (tiles[neighbor]?.type === 'blocker' && tiles[neighbor].health > 0)
            damageTargets.add(neighbor);
        }
      }

      if (!damageTargets.size && !pendingBonus) {
        break;
      }

      const step = {
        index: iteration,
        matches: pendingMatches.map((match) => ({
          type: match.type,
          indices: [...match.indices],
          orientation: match.orientation,
        })),
        cleared: [...cleared].sort((a, b) => a - b),
        drops: [],
        spawns: [],
        bonuses: cascadeBonuses.map((b) => ({
          type: b.type,
          index: b.index,
          gem: workingBoard[b.index],
        })),
        tileUpdates: [],
        collectedJewels: [],
        ...(fusion ? { bonusFusion: { ...fusion, targets: [...impacted] } } : {}),
      };

      for (const index of hasSignals
        ? signalTargets(tiles, [...impacted, ...protectedIndices], totalCols, totalRows)
        : []) {
        tiles[index].signalHealth = 0;
        totalLayersCleared++;
        step.tileUpdates.push({ index, signalHealth: 0 });
      }
      damageTargets.forEach((index) => {
        if (fusionTargets.has(index)) {
          totalLayersCleared += this.applyFusionHit(
            workingBoard,
            tiles,
            index,
            step,
            cleared,
            protectedIndices,
          );
          return;
        }
        const tile = tiles[index];
        // A chain absorbs the hit and releases its gem. Ice beneath it survives
        // until a later match. Only a match/blast containing this cell hits it.
        if (tile?.chainHealth > 0) {
          tile.chainHealth--;
          totalLayersCleared++;
          step.tileUpdates.push({ index, chainHealth: tile.chainHealth });
          return;
        }
        const sealHit =
          !tile?.sealColor ||
          pendingMatches.some(
            (match) =>
              match.indices.includes(index) &&
              (match.type === tile.sealColor || !GEM_TYPES.includes(match.type)),
          );
        if (tile && tile.health > 0 && sealHit) {
          const before = tile.health;
          tile.health = Math.max(0, tile.health - 1);
          if (tile.maxHealth == null) {
            tile.maxHealth = before;
          }
          tile.cleared = tile.health === 0;
          const maxHealth = tile.maxHealth ?? before;
          if (before !== tile.health) {
            totalLayersCleared += before - tile.health;
            if (tile.type === 'blocker' && tile.health === 0) tile.type = 'standard';
            step.tileUpdates.push({ index, health: tile.health, maxHealth, type: tile.type });
          }
        }
        if (cleared.has(index) && !protectedIndices.has(index)) {
          const removed = workingBoard[index];
          if (removed && GEM_TYPES.includes(removed.type))
            step.collectedJewels.push({ id: removed.id, type: removed.type });
          workingBoard[index] = null;
        }
      });
      // A fusion can break through an anchor and remove its gem in the same step.
      step.cleared = [...cleared].sort((a, b) => a - b);

      // Unfreeze adjacent tiles
      cleared.forEach((index) => {
        const x = index % totalCols;
        const y = Math.floor(index / totalCols);
        const adjacent = [
          { x: x - 1, y },
          { x: x + 1, y },
          { x, y: y - 1 },
          { x, y: y + 1 },
        ];
        adjacent.forEach((pos) => {
          if (pos.x >= 0 && pos.x < totalCols && pos.y >= 0 && pos.y < totalRows) {
            const adjacentIndex = pos.y * totalCols + pos.x;
            const adjacentTile = tiles[adjacentIndex];
            if (adjacentTile && adjacentTile.state === 'FROZEN') {
              adjacentTile.state = 'PLAYABLE';
              step.tileUpdates.push({ index: adjacentIndex, state: 'PLAYABLE' });
            }
          }
        });
      });

      if (pendingBonus) {
        // Resolve the direct alignment, then blast the board before anything falls.
        // Both phases belong to the same cascade tier.
        steps.push(step);
        const { swap, fusion, swapGems } = pendingBonus;
        const indices = bonusActivator.activate(
          workingBoard,
          totalCols,
          totalRows,
          swap,
          fusion,
          swapGems,
        );
        pendingMatches = [{ type: 'bonus-activation', indices, ...(fusion ? { fusion } : {}) }];
        pendingBonus = null;
        continue;
      }

      this.applyGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step);
      steps.push(step);

      // Relics are collected only through a marked bottom exit, after falling.
      // A separate step lets the renderer finish the fall before the collection.
      while (true) {
        const collectedRelics = [];
        for (let index = (totalRows - 1) * totalCols; index < workingBoard.length; index++) {
          if (
            tiles[index]?.exit &&
            workingBoard[index]?.type === 'relic' &&
            !isAnchored(tiles[index])
          ) {
            collectedRelics.push({ index, gem: workingBoard[index] });
            workingBoard[index] = null;
          }
        }
        if (!collectedRelics.length) break;
        relicsCollected += collectedRelics.length;
        const collectionStep = {
          index: iteration,
          matches: [],
          cleared: [],
          drops: [],
          spawns: [],
          bonuses: [],
          tileUpdates: [],
          collectedRelics,
        };
        this.applyGravity(
          workingBoard,
          tiles,
          totalCols,
          totalRows,
          gemTypes,
          iteration,
          collectionStep,
        );
        steps.push(collectionStep);
      }

      pendingMatches = matchEngine.findMatches(workingBoard, totalCols, totalRows, tiles);
      iteration += 1;
    }

    return {
      board: workingBoard,
      steps,
      cols: totalCols,
      rows: totalRows,
      layersCleared: totalLayersCleared,
      relicsCollected,
    };
  }

  applyFusionHit(board, tiles, index, step, cleared, protectedIndices) {
    const tile = tiles[index];
    let hits = 2,
      removed = 0;
    if (tile?.state === 'FROZEN') {
      tile.state = 'PLAYABLE';
      step.tileUpdates.push({ index, state: 'PLAYABLE' });
    }
    // Chains absorb hits first. A second hit can reach the ice and gem beneath.
    if (tile?.chainHealth > 0) {
      const damage = Math.min(hits, tile.chainHealth);
      tile.chainHealth -= damage;
      hits -= damage;
      removed += damage;
      step.tileUpdates.push({ index, chainHealth: tile.chainHealth });
    }
    if (!hits) return removed;
    if (tile?.health > 0) {
      const before = tile.health;
      tile.maxHealth ??= before;
      tile.health = Math.max(0, before - hits);
      tile.cleared = tile.health === 0;
      removed += before - tile.health;
      if (tile.type === 'blocker' && tile.cleared) tile.type = 'standard';
      step.tileUpdates.push({
        index,
        health: tile.health,
        maxHealth: tile.maxHealth,
        type: tile.type,
      });
    }
    if (
      board[index] &&
      board[index].type !== 'relic' &&
      !isAnchored(tile) &&
      !protectedIndices.has(index)
    ) {
      cleared.add(index);
      // Keep the established payout ledger unchanged; ore objectives also count
      // ordinary gems removed by a fusion, including those released from chains.
      if (GEM_TYPES.includes(board[index].type)) {
        step.fusionOreJewels ??= [];
        step.fusionOreJewels.push({ id: board[index].id, type: board[index].type });
      }
      board[index] = null;
    }
    return removed;
  }

  applyGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step) {
    for (let col = 0; col < totalCols; col += 1) {
      let writeRow = totalRows - 1;
      for (let row = totalRows - 1; row >= 0; row -= 1) {
        const index = row * totalCols + col;
        // A chained gem stays pinned to its tile, but gems can fall past it.
        // Stone and frozen cells still separate the column into segments.
        if (
          tiles[index]?.chainHealth > 0 &&
          tiles[index]?.state !== 'FROZEN' &&
          tiles[index]?.type !== 'blocker'
        )
          continue;
        // Existing gems below a barrier can fall within their segment, but
        // refill only enters from the top. Breaking it reconnects the column.
        if (isAnchored(tiles[index])) {
          writeRow = row - 1;
          continue;
        }
        const gem = workingBoard[index];
        if (gem) {
          while (writeRow >= 0 && isAnchored(tiles[writeRow * totalCols + col])) writeRow--;
          const targetIndex = writeRow * totalCols + col;
          if (targetIndex !== index) {
            workingBoard[targetIndex] = gem;
            workingBoard[index] = null;
            step.drops.push({ from: index, to: targetIndex, gem });
          }
          writeRow -= 1;
        }
      }

      for (let spawnRow = writeRow; spawnRow >= 0; spawnRow -= 1) {
        const index = spawnRow * totalCols + col;
        if (isAnchored(tiles[index])) continue;
        let type = randomGemType(gemTypes);
        // A pathological RNG (or deterministic test) must not create an endless cascade.
        if (iteration >= 24) {
          const types = gemTypes;
          type =
            types.find(
              (candidate) =>
                ![1, totalCols].some((stride) =>
                  [-2, -1, 0].some((offset) => {
                    const run = [0, 1, 2].map((n) => index + (offset + n) * stride);
                    if (run.some((i) => i < 0 || i >= workingBoard.length)) return false;
                    if (stride === 1 && run.some((i) => Math.floor(i / totalCols) !== spawnRow))
                      return false;
                    return run.every((i) => i === index || workingBoard[i]?.type === candidate);
                  }),
                ),
            ) ?? type;
        }
        const newGem = createGem(type);
        workingBoard[index] = newGem;
        step.spawns.push({ index, gem: newGem });
      }
    }
  }

  applyMatchResult(payload) {
    return this.getResolution(payload).board;
  }
}

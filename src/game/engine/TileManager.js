import { MatchEngine } from './MatchEngine.js';
import { BASE_GEM_TYPES, createGem, randomGemType, GEM_TYPES } from './GemFactory.js';
import { detectBonusFromMatches } from './MatchPatterns.js';
import { isAnchored, neighborsOf } from './TileRules.js';
import { BonusActivator } from './BonusActivator.js';
import {
  signalTargets,
  sporeTargets,
  isChargeCore,
  coreReleaseTarget,
} from './ChapterMechanics.js';
import { collectFinishedFossils, releaseCutRoots } from './DeepMineMechanics.js';
import { bentBeams, blastLog, hasLenses } from './LensBeams.js';
import { hasPhaseSeals, shiftPhases } from './PhaseSeals.js';
import { hasSealedChambers, openBreakthroughs } from './Breakthroughs.js';
import { gravityPath, incomingGravity, isPlayableCell, isRoutedBoard } from './BoardTopology.js';
import {
  applyFrameGravity,
  cargoCollects,
  flipGravity,
  gravityFrames,
  isGravitySwitch,
  usesGravityFrames,
} from './GravityFrames.js';

const matchEngine = new MatchEngine();
const NONE = new Set();
const bonusActivator = new BonusActivator();

export class TileManager {
  getResolution({
    board,
    tiles,
    matches,
    cols,
    rows,
    bonuses = [],
    pendingBonus = null,
    gemTypes = BASE_GEM_TYPES,
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
    const hasFossils = tiles.some((tile) => tile.fossilGroup != null);
    const hasRoots = tiles.some((tile) => tile.rootKnot);
    const steps = [];

    let iteration = 0;
    let pendingMatches = matches.map((match) => ({
      type: match.type,
      indices: [...match.indices],
      orientation: match.orientation,
      fusion: match.fusion,
      sporeBursts: match.sporeBursts,
      blasts: match.blasts,
    }));
    let totalLayersCleared = 0;
    // A charge core gains at most one charge per move, however long the cascade.
    const chargedCores = new Set();
    let relicsCollected = 0;
    let queuedSpores = [];
    let phased = false;
    // A gravity switch flips at most once per move, however many blasts reach it.
    let flipped = false;

    while (pendingMatches.length) {
      if (iteration >= 128) throw new Error('Cascade did not settle after 128 steps');
      const cleared = new Set();
      const impacted = new Set();
      const protectedIndices = new Set();
      const cascadeBonuses = [];
      const fusion = pendingMatches.find((match) => match.fusion)?.fusion;
      const fusionTargets = new Set(fusion?.targets ?? []);
      // Starglass only breaks under a beam that a lens has turned.
      const bentHit = (index) =>
        pendingMatches.some((match) => match.blasts?.lenses?.bent.has(index));
      const lensBeams = pendingMatches.flatMap((match) => match.blasts?.lenses?.beams ?? []);
      // Blast-only obstacles take one hit from each separate bonus blast that
      // reaches them, so a cross that fires a bomb hits a crate in range of both.
      const extraBlastHits = (index) =>
        tiles[index]?.bonusOnly
          ? Math.max(
              0,
              pendingMatches.reduce((sum, match) => sum + (match.blasts?.get(index) ?? 0), 0) - 1,
            )
          : 0;

      pendingMatches.forEach((match) => {
        match.indices.forEach((index) => {
          const tile = tiles[index];
          if (!isPlayableCell(tile)) return;
          if (!tile || tile.state !== 'FROZEN' || fusionTargets.has(index)) {
            if (index < 0 || index >= workingBoard.length) return;
            impacted.add(index);
            if (workingBoard[index] && workingBoard[index].type !== 'relic' && !isAnchored(tile))
              cleared.add(index);
          }
        });
      });

      // The swap's own bonuses already sit on the board; cascades earn new ones.
      if (steps.length === 0) cascadeBonuses.push(...bonuses);
      else
        for (const bonus of detectBonusFromMatches(pendingMatches)) {
          cascadeBonuses.push(bonus);
          workingBoard[bonus.index] = createGem(bonus.type);
        }

      // Earned bonuses are protected from this step's clear.
      cascadeBonuses.forEach((bonus) => {
        protectedIndices.add(bonus.index);
        cleared.delete(bonus.index);
      });

      const damageTargets = new Set([...impacted, ...protectedIndices]);
      // Only ordinary matches damage adjacent blocks. Special effects must hit
      // the block itself; clearing a nearby gem does not extend their footprint.
      const matchedIndices = new Set(
        pendingMatches
          .filter((match) => GEM_TYPES.includes(match.type))
          .flatMap((match) => match.indices)
          .filter((index) => damageTargets.has(index)),
      );
      // A block takes at most one hit per step, including overlapping matches.
      for (const index of matchedIndices) {
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
        ...(pendingMatches.some((match) => match.sporeBursts)
          ? { sporeBursts: pendingMatches.flatMap((match) => match.sporeBursts ?? []) }
          : {}),
        ...(lensBeams.length ? { lensBeams } : {}),
      };

      for (const index of hasSignals
        ? signalTargets(tiles, [...impacted, ...protectedIndices], totalCols, totalRows, [
            ...matchedIndices,
          ])
        : []) {
        const core = isChargeCore(tiles[index]);
        if (core && chargedCores.has(index)) continue;
        if (core) chargedCores.add(index);
        // Lanterns and survey markers light at once; a core gains one charge.
        tiles[index].signalHealth = core ? tiles[index].signalHealth - 1 : 0;
        totalLayersCleared++;
        step.tileUpdates.push({ index, signalHealth: tiles[index].signalHealth });
        if (tiles[index].signal === 'spore') {
          const axis = tiles[index].sporeAxis === 'column' ? 'column' : 'row';
          const line = {
            axis,
            index: axis === 'column' ? index % totalCols : Math.floor(index / totalCols),
          };
          const bent = hasLenses(tiles)
            ? bentBeams(tiles, totalCols, totalRows, [line])
            : { cells: [], beams: [] };
          queuedSpores.push({
            index,
            axis,
            targets: [...sporeTargets(tiles, index, axis, totalCols, totalRows), ...bent.cells],
            ...(bent.beams.length ? { bent } : {}),
          });
        }
        if (!core || tiles[index].signalHealth) continue;
        const target = coreReleaseTarget(
          workingBoard,
          tiles,
          index,
          totalCols,
          totalRows,
          protectedIndices,
        );
        if (target < 0) continue;
        // Like an earned cascade bonus: the gem becomes the bonus and is not cleared.
        const gem = createGem(tiles[index].coreBonus ?? 'cross');
        workingBoard[target] = gem;
        protectedIndices.add(target);
        cleared.delete(target);
        step.bonuses.push({ type: gem.type, index: target, gem, core: index });
      }
      damageTargets.forEach((index) => {
        if (fusionTargets.has(index) && (!tiles[index]?.lensOnly || bentHit(index))) {
          totalLayersCleared += this.applyFusionHit(
            workingBoard,
            tiles,
            index,
            step,
            cleared,
            protectedIndices,
            2 + extraBlastHits(index),
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
        const specialHit =
          (!tile?.bonusOnly ||
            pendingMatches.some(
              (match) => !GEM_TYPES.includes(match.type) && match.indices.includes(index),
            )) &&
          (!tile?.lensOnly || bentHit(index));
        if (tile && tile.health > 0 && sealHit && specialHit) {
          const before = tile.health;
          tile.health = Math.max(0, tile.health - 1 - extraBlastHits(index));
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
      if (hasRoots) totalLayersCleared += releaseCutRoots(tiles, step);
      if (hasFossils) collectFinishedFossils(tiles, step);
      if (hasSealedChambers(tiles)) openBreakthroughs(tiles, step);
      if (!flipped) {
        const switchIndex = [...impacted].find(
          (index) =>
            isGravitySwitch(tiles[index]) &&
            pendingMatches.some(
              (match) => !GEM_TYPES.includes(match.type) && match.indices.includes(index),
            ),
        );
        if (switchIndex !== undefined) {
          flipped = true;
          flipGravity(tiles, switchIndex, step);
        }
      }
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
        const blasts = blastLog();
        const indices = bonusActivator.activate(
          workingBoard,
          totalCols,
          totalRows,
          swap,
          fusion,
          swapGems,
          tiles,
          blasts,
        );
        pendingMatches = [
          { type: 'bonus-activation', indices, blasts, ...(fusion ? { fusion } : {}) },
        ];
        pendingBonus = null;
        continue;
      }

      if (queuedSpores.length) {
        // Resolve every one-shot relay and its bonus reactions before gravity.
        // A bonus already fired by the preceding phase is absent from this board.
        steps.push(step);
        const bursts = queuedSpores;
        queuedSpores = [];
        const blasts = blastLog();
        for (const burst of bursts) {
          for (const cell of burst.bent?.cells ?? []) blasts.lenses.bent.add(cell);
          blasts.lenses.beams.push(...(burst.bent?.beams ?? []));
        }
        const indices = bonusActivator.resolveChain(workingBoard, totalCols, totalRows, {
          tiles,
          targets: bursts.flatMap((burst) => burst.targets),
          blasts,
        });
        pendingMatches = [{ type: 'spore-burst', indices, sporeBursts: bursts, blasts }];
        continue;
      }

      this.applyGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step);
      steps.push(step);

      // Relics are collected only through a marked bottom exit, after falling.
      // A separate step lets the renderer finish the fall before the collection.
      while (true) {
        const collectedRelics = [];
        // Framed boards also collect floatstones and up-falling relics on the top row.
        const framed = usesGravityFrames(workingBoard, tiles);
        for (
          let index = framed ? 0 : (totalRows - 1) * totalCols;
          index < workingBoard.length;
          index++
        ) {
          if (
            (framed
              ? cargoCollects(workingBoard[index], tiles[index], index, totalCols, totalRows)
              : tiles[index]?.exit && workingBoard[index]?.type === 'relic') &&
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
      // Once the move has settled, each phase seal changes its gem. A change that
      // lines up a match continues the cascade with its usual bonuses.
      if (!pendingMatches.length && !phased && hasPhaseSeals(tiles)) {
        phased = true;
        const shift = shiftPhases(workingBoard, tiles, gemTypes, iteration);
        if (shift) {
          steps.push(shift);
          pendingMatches = matchEngine.findMatches(workingBoard, totalCols, totalRows, tiles);
        }
      }
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

  applyFusionHit(board, tiles, index, step, cleared, protectedIndices, hits = 2) {
    const tile = tiles[index];
    let removed = 0;
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
      // Every removed jewel uses the same ledger for mining and ore objectives.
      if (GEM_TYPES.includes(board[index].type)) {
        step.collectedJewels.push({ id: board[index].id, type: board[index].type });
      }
      board[index] = null;
    }
    return removed;
  }

  applyGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step) {
    if (usesGravityFrames(workingBoard, tiles)) {
      this.applyFramedGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step);
      return;
    }
    if (isRoutedBoard(tiles)) {
      this.applyShapedGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step);
      return;
    }
    this.applyColumnGravity(workingBoard, tiles, totalCols, totalRows, gemTypes, iteration, step);
  }

  // Low-gravity frames and floatstones reuse the column and shaped routines on a
  // mirrored view of each frame. Floatstones stay pinned while gems pass them.
  applyFramedGravity(board, tiles, cols, rows, gemTypes, iteration, step) {
    const gravity = isRoutedBoard(tiles) ? this.applyShapedGravity : this.applyColumnGravity;
    for (const frame of gravityFrames(tiles, cols, rows)) {
      const receipts = applyFrameGravity(
        board,
        tiles,
        cols,
        rows,
        frame,
        (vBoard, vTiles, vCols, vRows, vStep, pinned) =>
          gravity.call(this, vBoard, vTiles, vCols, vRows, gemTypes, iteration, vStep, pinned),
        isAnchored,
      );
      step.drops.push(...receipts.drops);
      step.spawns.push(...receipts.spawns);
    }
  }

  applyColumnGravity(
    workingBoard,
    tiles,
    totalCols,
    totalRows,
    gemTypes,
    iteration,
    step,
    pinned = NONE,
  ) {
    const held = (index) => isAnchored(tiles[index]) || pinned.has(index);
    for (let col = 0; col < totalCols; col += 1) {
      let writeRow = totalRows - 1;
      for (let row = totalRows - 1; row >= 0; row -= 1) {
        const index = row * totalCols + col;
        // A chained gem stays pinned to its tile, but gems can fall past it.
        // Stone and frozen cells still separate the column into segments.
        if (
          pinned.has(index) ||
          (tiles[index]?.chainHealth > 0 &&
            tiles[index]?.state !== 'FROZEN' &&
            tiles[index]?.type !== 'blocker')
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
          while (writeRow >= 0 && held(writeRow * totalCols + col)) writeRow--;
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
        if (held(index)) continue;
        const newGem = createGem(
          this.refillType(workingBoard, index, totalCols, gemTypes, iteration),
        );
        workingBoard[index] = newGem;
        step.spawns.push({ index, gem: newGem });
      }
    }
  }

  refillType(board, index, cols, gemTypes, iteration) {
    const type = randomGemType(gemTypes);
    if (iteration < 24) return type;
    // A technical cascade guard, never a player allowance. Keep the original
    // rectangular refill order and RNG calls while sharing the shaped fallback.
    return (
      gemTypes.find(
        (candidate) =>
          ![1, cols].some((stride) =>
            [-2, -1, 0].some((offset) => {
              const run = [0, 1, 2].map((n) => index + (offset + n) * stride);
              if (run.some((cell) => cell < 0 || cell >= board.length)) return false;
              if (
                stride === 1 &&
                run.some((cell) => Math.floor(cell / cols) !== Math.floor(index / cols))
              )
                return false;
              return run.every((cell) => cell === index || board[cell]?.type === candidate);
            }),
          ),
      ) ?? type
    );
  }

  applyShapedGravity(board, tiles, cols, rows, gemTypes, iteration, step, pinned = NONE) {
    const incoming = incomingGravity(tiles, cols, rows);
    for (let index = 0; index < board.length; index++)
      if (!isPlayableCell(tiles[index])) board[index] = null;

    const candidatesAbove = (index, suffix = [], choices = []) => {
      const tile = tiles[index];
      if (
        !isPlayableCell(tile) ||
        tile?.state === 'FROZEN' ||
        (tile?.type === 'blocker' && tile.health > 0)
      )
        return [];
      const path = [index, ...suffix];
      if (board[index] && !(tile?.chainHealth > 0) && !pinned.has(index))
        return [{ from: index, path, choices }];
      const parents = incoming[index];
      if (!parents.length) return [{ entry: index, path, choices }];
      const cursor =
        Number.isInteger(tile?.flowCursor) && tile.flowCursor >= 0
          ? tile.flowCursor % parents.length
          : 0;
      return parents.flatMap((_, offset) => {
        const branch = (cursor + offset) % parents.length;
        return candidatesAbove(parents[branch], path, [
          ...choices,
          { index, cursor: (branch + 1) % parents.length },
        ]);
      });
    };

    // Lower rows only: each original gem can move once, with one final receipt.
    // A relic that can reach the cell falls first, then other upstream pieces,
    // then refill. Rotating merge choices prevents perpetual center refill from
    // starving either pearl arm and keeps relics from several arms taking turns.
    // Fill each cell before the cells that feed it. Downward flow means bottom first;
    // a portal can hand gems to a higher cell, so then order by route length to the end.
    const order = Array.from({ length: board.length }, (_, index) => board.length - 1 - index);
    if (tiles.some((tile) => Number.isInteger(tile?.portalTo))) {
      const remaining = Array.from(
        { length: board.length },
        (_, index) => gravityPath(tiles, index, cols, rows).length,
      );
      order.sort((a, b) => remaining[a] - remaining[b] || b - a);
    }
    for (const index of order) {
      if (board[index] || isAnchored(tiles[index]) || pinned.has(index)) continue;
      const candidates = candidatesAbove(index);
      const chosen =
        candidates.find((candidate) => board[candidate.from]?.type === 'relic') ??
        candidates.find((candidate) => candidate.from != null) ??
        candidates[0];
      if (!chosen) continue;
      for (const choice of chosen.choices) tiles[choice.index].flowCursor = choice.cursor;
      if (chosen.from != null) {
        const gem = board[chosen.from];
        board[chosen.from] = null;
        board[index] = gem;
        step.drops.push({ from: chosen.from, to: index, gem, path: chosen.path });
      } else {
        const gem = createGem(this.refillType(board, index, cols, gemTypes, iteration));
        board[index] = gem;
        step.spawns.push({ index, gem, path: chosen.path });
      }
    }
  }
}

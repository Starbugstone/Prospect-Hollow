import { afterEach, expect, it, vi } from 'vitest';
import { levelConfig } from '../src/game/engine/LevelGenerator';
import { LEVEL_COUNT } from '../src/data/campaign';
import { MatchEngine } from '../src/game/engine/MatchEngine';
import { TileManager } from '../src/game/engine/TileManager';
import { HintEngine } from '../src/game/engine/HintEngine';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { createGem, GEM_TYPES } from '../src/game/engine/GemFactory';
import {
  BOARD_BONUSES,
  canSwapCells,
  canSwapGem,
  isAdjacent,
  isAnchored,
  layerCount,
} from '../src/game/engine/TileRules';
import { isPlayableCell } from '../src/game/engine/BoardTopology';

// A seeded sweep of chain-heavy play across the campaign. Extra bonuses are dropped
// onto the board so nested chains, fusions, toolbar powers and relic swaps are common.
// Each resolution is checked against the rules the store and renderer rely on.
const engine = new MatchEngine();
const manager = new TileManager();
const hints = new HintEngine();
const activator = new BonusActivator();
const POWERS = ['tnt', 'clear-row', 'color-wand', 'tile-breaker'];
const totalLayers = (tiles) => tiles.reduce((sum, tile) => sum + layerCount(tile), 0);

afterEach(() => vi.restoreAllMocks());

function chooseMove({ board, tiles, cols, rows }, rnd) {
  const pick = (list) => list[Math.floor(rnd() * list.length)];
  const bonuses = board.flatMap((gem, i) =>
    BOARD_BONUSES.includes(gem?.type) && canSwapGem(gem, tiles[i]) ? [i] : [],
  );
  const roll = rnd();
  if (roll < 0.25 && bonuses.length)
    return engine.evaluateActivation(board, cols, rows, pick(bonuses), tiles);
  if (roll < 0.5 && bonuses.length) {
    // A bonus swapped with a gem, another bonus (a fusion) or a relic.
    const a = pick(bonuses);
    const partners = [a - 1, a + 1, a - cols, a + cols].filter(
      (b) =>
        b >= 0 &&
        b < board.length &&
        isAdjacent(a, b, cols) &&
        canSwapCells(board, tiles, a, b, cols, rows),
    );
    return partners.length
      ? engine.evaluateSwap(board, cols, rows, a, pick(partners), tiles)
      : null;
  }
  if (roll < 0.62) {
    const blasts = new Map();
    const type = pick(POWERS);
    const cells = tiles.flatMap((tile, i) => (isPlayableCell(tile) ? [i] : []));
    const indices = activator.activatePower(type, board, cols, rows, pick(cells), tiles, blasts);
    return { board, matches: indices.length ? [{ type, indices, blasts }] : [] };
  }
  const move = hints.findBestMove(board, tiles, cols, rows);
  if (!move) return null;
  const { aIndex, bIndex } = move.swap;
  const evaluation = move.activateInPlace
    ? engine.evaluateActivation(board, cols, rows, aIndex, tiles)
    : engine.evaluateSwap(board, cols, rows, aIndex, bIndex, tiles);
  // A hint must always be a move the engine accepts.
  expect(evaluation.matches.length).toBeGreaterThan(0);
  return evaluation;
}

// Replays the steps the way BoardAnimator.playSteps tracks sprites per cell.
function checkSteps({ before, tilesBefore, steps, cols, rows }, fail) {
  let cells = [...before];
  steps.forEach((step, s) => {
    const blastCells = new Set(
      step.matches.filter((m) => !GEM_TYPES.includes(m.type)).flatMap((m) => m.indices),
    );
    const earned = new Set(step.bonuses.map(({ index }) => index));
    for (const i of step.cleared) {
      if (!cells[i]) fail(`step ${s} clears empty cell ${i}`);
      if (cells[i]?.type === 'relic') fail(`step ${s} clears a relic at ${i}`);
      if (BOARD_BONUSES.includes(cells[i]?.type) && !blastCells.has(i))
        fail(`step ${s}: an ordinary match removed the ${cells[i].type} at ${i}`);
    }
    for (const i of blastCells) {
      const type = cells[i]?.type;
      if (!BOARD_BONUSES.includes(type) || earned.has(i) || isAnchored(tilesBefore[i])) continue;
      if (!step.cleared.includes(i)) fail(`step ${s}: the free ${type} at ${i} did not fire`);
      // A bomb or cross that fired adds its whole footprint to the blast.
      if (
        type !== 'rainbow' &&
        activator
          .activateBonus(type, cells, cols, rows, i)
          .some((cell) => isPlayableCell(tilesBefore[cell]) && !blastCells.has(cell))
      )
        fail(`step ${s}: the ${type} at ${i} was removed without its blast`);
    }
    const next = [...cells];
    for (const i of step.cleared) next[i] = null;
    for (const { index, gem } of step.collectedRelics ?? []) {
      if (cells[index]?.id !== gem.id) fail(`step ${s} collects a relic not shown at ${index}`);
      next[index] = null;
    }
    for (const { index, gem } of step.bonuses) next[index] = gem;
    for (const { from, gem } of step.drops) {
      if (next[from]?.id !== gem.id)
        fail(`step ${s} drops ${gem.id} from ${from}, not shown there`);
      else next[from] = null;
    }
    for (const { to, gem } of step.drops) {
      if (next[to] && next[to].id !== gem.id) fail(`step ${s} drops onto a shown gem at ${to}`);
      next[to] = gem;
    }
    for (const { index, gem } of step.spawns) {
      if (next[index]) fail(`step ${s} spawns over a shown gem at ${index}`);
      if (gem.type === 'relic') fail(`step ${s} spawns a relic`);
      next[index] = gem;
    }
    cells = next;
  });
  return cells;
}

it('keeps chain reactions consistent with layers, relics, bonuses and the renderer', () => {
  let seed = 20261003;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  vi.spyOn(Math, 'random').mockImplementation(rnd);
  const failures = [];
  let resolved = 0;
  for (let id = 1; id <= LEVEL_COUNT; id += 5) {
    const config = levelConfig(id);
    const state = {
      board: config.board.map((gem) => (gem ? createGem(gem.type) : null)),
      tiles: structuredClone(config.tiles),
      cols: config.boardCols,
      rows: config.boardRows,
    };
    for (let turn = 0; turn < 24; turn++) {
      const fail = (message) => failures.push(`level ${id} turn ${turn}: ${message}`);
      if (rnd() < 0.45) {
        const ordinary = state.board.flatMap((gem, i) =>
          GEM_TYPES.includes(gem?.type) && !isAnchored(state.tiles[i]) ? [i] : [],
        );
        for (let k = 0; k < 2 && ordinary.length; k++)
          state.board[ordinary[Math.floor(rnd() * ordinary.length)]] = createGem(
            BOARD_BONUSES[Math.floor(rnd() * BOARD_BONUSES.length)],
          );
      }
      const evaluation = chooseMove(state, rnd);
      if (!evaluation?.matches.length) continue;
      resolved++;
      const tilesBefore = structuredClone(state.tiles);
      const relics = (board) => board.filter((gem) => gem?.type === 'relic').length;
      const result = manager.getResolution({
        ...evaluation,
        tiles: state.tiles,
        cols: state.cols,
        rows: state.rows,
        gemTypes: config.boardLayout?.gemTypes ?? GEM_TYPES,
      });
      // Level completion counts down by layersCleared and relicsCollected.
      if (totalLayers(tilesBefore) - totalLayers(state.tiles) !== result.layersCleared)
        fail('layersCleared differs from the real layer change');
      if (relics(evaluation.board) - relics(result.board) !== result.relicsCollected)
        fail('a relic was lost or duplicated');
      if (state.tiles.some((t) => t.health < 0 || t.chainHealth < 0 || t.signalHealth < 0))
        fail('a tile layer went negative');
      const shown = checkSteps(
        { before: evaluation.board, tilesBefore, steps: result.steps, ...state },
        fail,
      );
      const ids = result.board.map((gem) => gem?.id ?? null);
      if (ids.some((gemId, i) => gemId !== (shown[i]?.id ?? null)))
        fail('the replayed steps differ from the settled board');
      if (new Set(ids.filter(Boolean)).size !== ids.filter(Boolean).length)
        fail('a gem id appears twice');
      if (result.board.some((gem, i) => gem && !isPlayableCell(state.tiles[i])))
        fail('a gem sits in a void');
      if (
        engine
          .findMatches(result.board, state.cols, state.rows, state.tiles)
          .some((m) => m.indices.some((i) => state.tiles[i]?.state !== 'FROZEN'))
      )
        fail('the settled board still holds a match');
      state.board = result.board;
    }
  }
  expect(resolved).toBeGreaterThan(1000);
  expect(failures.slice(0, 10)).toEqual([]);
}, 60_000);

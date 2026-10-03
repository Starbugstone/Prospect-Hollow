import { toRaw } from 'vue';
import { advanceOreOrders } from '../../game/engine/ChapterMechanics';
import { recoverBoard } from '../../game/engine/BoardRecovery';
import { isPlayableCell } from '../../game/engine/BoardTopology';
import { GEM_TYPES } from '../../game/engine/GemFactory';
import { MatchEngine } from '../../game/engine/MatchEngine';
import { cascadeTier, clearScore, simultaneousMatchCount } from '../../game/engine/MatchRewards';
import { TileManager } from '../../game/engine/TileManager';
import { BonusActivator } from '../../game/engine/BonusActivator';
import { HintEngine } from '../../game/engine/HintEngine';
import { applyBonuses, detectBonusFromMatches } from '../../game/engine/MatchPatterns';
import {
  BOARD_BONUSES,
  canSwapCells,
  canSwapGem,
  isAnchored,
  isAdjacent,
} from '../../game/engine/TileRules';
import { tallySteps } from '../../data/honours';
import { useInventoryStore } from '../inventoryStore';
import { plain, workingTiles } from './boardData';
import { storeTimers } from './storeTimers';

const matchEngine = new MatchEngine();
const tileManager = new TileManager();
const bonusActivator = new BonusActivator();
const hintEngine = new HintEngine();
const HINT_DELAY_MS = 15000;

const boardOf = (store) => toRaw(store.board);
const tilesOf = (store) => toRaw(store.tiles ?? []);
const activeBoardOf = (store) => toRaw(store.pendingBoardState ?? store.board);
const boardCenterIndex = (cols, rows) => {
  const cells = Math.max(1, (cols || 0) * (rows || 0));
  return Math.min(Math.floor(cells / 2), cells - 1);
};

function resolveMatches(store, { board, tiles, matches, bonuses, pendingBonus }) {
  return tileManager.getResolution({
    gemTypes: store.currentBoardLayout?.gemTypes ?? GEM_TYPES,
    board,
    tiles,
    matches,
    cols: store.boardCols,
    rows: store.boardRows,
    ...(bonuses ? { bonuses } : {}),
    ...(pendingBonus ? { pendingBonus } : {}),
  });
}

// Every move shows its resolved steps before the board changes. Returns false when
// the level was left or restarted while the move was still animating.
async function showResolution(store, resolution, session) {
  store.pendingBoardState = plain(resolution.board);
  const animator = store.renderer?.animator;
  if (animator && resolution.steps.length) {
    await animator.playSteps(resolution.steps);
    if (session !== store.sessionVersion) return false;
  }
  return true;
}

// The shared lifecycle of a move: input waits while it animates, and the board is
// settled (hint, queued input, free reshuffle) afterwards unless the level changed.
async function runMove(store, label, move, onSettle) {
  const session = store.sessionVersion;
  let boardUpdated = false;
  store.animationInProgress = true;
  try {
    boardUpdated = await move(session);
    return boardUpdated;
  } catch (error) {
    console.error(label, error);
    return false;
  } finally {
    if (session === store.sessionVersion) {
      onSettle?.();
      await store.settleMove(boardUpdated);
    }
  }
}

export function scheduleHint(store, delay = HINT_DELAY_MS) {
  if (!store.sessionActive) return;
  storeTimers(store).set('hint', () => store.computeHintMove(), delay);
}

export function cancelHint(store, clearVisual = false) {
  storeTimers(store).clear('hint');
  if (clearVisual) store.clearHint();
}

export function computeHintMove(store) {
  if (!store.sessionActive || store.inputPaused || store.levelCleared || store.activeBonusMode)
    return;
  if (store.animationInProgress) {
    store.scheduleHint();
    return;
  }
  const board = activeBoardOf(store);
  if (!Array.isArray(board) || !board.length) return;
  const hint = hintEngine.findBestMove(board, tilesOf(store), store.boardCols, store.boardRows, {
    oreOrders: toRaw(store.oreOrders),
  });
  store.hintMove = hint;
  if (hint) store.renderer?.animator?.showHintMove?.(hint.indices);
  else store.renderer?.animator?.clearHintMove?.();
}

export async function resolveBonusClick(store, index) {
  if (
    !store.sessionActive ||
    store.inputPaused ||
    !store.activeBonusMode ||
    store.levelCleared ||
    !isPlayableCell(tilesOf(store)[index])
  )
    return false;
  const bonusName = store.activeBonusMode;
  store.cancelHint(true);
  if (store.animationInProgress) {
    // Run the power once the current move has finished animating.
    store.queuedBonus = { index, bonusName };
    store.renderer?.animator?.showQueuedBonus?.(index);
    store.activeBonusMode = null;
    store.clearBonusPreview(true);
    return true;
  }
  store.renderer?.animator?.clearQueuedBonusHighlight?.();
  store.activeBonusMode = null;
  return store._activatePower(bonusName, index, true);
}

export async function activatePower(store, bonusName, index, consume = false) {
  if (!store.sessionActive || store.inputPaused || store.animationInProgress || store.levelCleared)
    return false;
  const rescue = bonusName === 'recovery_sweep';
  if (!rescue && !isPlayableCell(tilesOf(store)[index])) return false;
  const inventory = useInventoryStore();
  if (consume && inventory.availableQuantity(bonusName) <= 0) {
    store.clearBonusPreview(true);
    return false;
  }
  store.powerInUse = consume ? bonusName : null;
  store.bonusPreview = { indices: [], key: null };
  store.renderer?.animator?.fadeBonusPreview?.();
  return runMove(
    store,
    'Error activating bonus:',
    async (session) => {
      const board = boardOf(store);
      const blasts = new Map();
      const clearedIndices = rescue
        ? board.map((_, i) => i)
        : bonusActivator.activatePower(
            bonusName,
            board,
            store.boardCols,
            store.boardRows,
            index,
            tilesOf(store),
            blasts,
          );
      if (!clearedIndices.length) return false;
      const tiles = workingTiles(store.tiles);
      const resolution = resolveMatches(store, {
        board,
        tiles,
        matches: [
          {
            type: bonusName,
            indices: clearedIndices,
            blasts,
            ...(rescue ? { fusion: { targets: clearedIndices, damage: 2 } } : {}),
          },
        ],
      });
      if (resolution.steps[0])
        resolution.steps[0].bonusEffect = {
          type: rescue ? 'rainbow' : bonusName,
          originIndex: index,
        };
      // The free rescue sweep never counts towards honours.
      resolution.recovery = rescue;
      if (!(await showResolution(store, resolution, session))) return false;
      // Consume before committing so victory rewards see the updated inventory.
      if (consume && !inventory.consumeItem(bonusName)) return false;
      store.tiles = plain(tiles);
      store._applyScoring(resolution.steps);
      store.commitResolution(resolution);
      return true;
    },
    () => {
      store.powerInUse = null;
    },
  );
}

export function previewPowerEffect(store, index) {
  const mode = store.activeBonusMode;
  const board = activeBoardOf(store);
  const tiles = tilesOf(store);
  if (
    !store.sessionActive ||
    store.animationInProgress ||
    store.levelCleared ||
    !mode ||
    !Array.isArray(board) ||
    !board.length ||
    index == null ||
    index < 0 ||
    index >= board.length ||
    !isPlayableCell(tiles[index])
  ) {
    store.clearBonusPreview();
    return;
  }
  const indices =
    bonusActivator.previewBonus(mode, board, store.boardCols, store.boardRows, index, tiles) ?? [];
  if (!indices.length) {
    store.clearBonusPreview();
    return;
  }
  const key = `power-${mode}-${index}-${indices.join(',')}`;
  if (store.bonusPreview?.key === key) return;
  store.bonusPreview = { indices, key };
  store.renderer?.animator?.showBonusPreview?.(indices);
}

export function processQueuedInput(store) {
  if (store.animationInProgress || store.inputPaused || !store.sessionActive || store.levelCleared)
    return;
  if (store.queuedBonus) {
    const queued = store.queuedBonus;
    store.queuedBonus = null;
    store.activeBonusMode = queued.bonusName;
    store.resolveBonusClick(queued.index);
  } else if (store.queuedSwap) {
    const queued = store.queuedSwap;
    store.queuedSwap = null;
    store.renderer?.animator?.clearQueuedSwapHighlight?.();
    const board = boardOf(store);
    if (
      queued.gems?.some(
        ({ index, id, type }) => board[index]?.id !== id || board[index]?.type !== type,
      )
    )
      return;
    store.resolveSwap(queued.aIndex, queued.bIndex);
  }
}

export function activateOneTimeBonus(store, bonusName, { consume = false } = {}) {
  if (!store.sessionActive || store.inputPaused || store.animationInProgress || store.levelCleared)
    return false;
  store.clearBonusPreview(true);
  const { boardCols: cols, boardRows: rows } = store;
  const origin =
    bonusName === 'clear-row'
      ? Math.floor(Math.random() * rows) * cols
      : boardCenterIndex(cols, rows);
  return store._activatePower(bonusName, origin, consume);
}

export async function resolveSwap(store, aIndex, bIndex, { activateInPlace = false } = {}) {
  const session = store.sessionVersion;
  if (!store.sessionActive || store.inputPaused || store.levelCleared) return false;
  store.cancelHint(true);
  store.clearBonusPreview(true);
  if (store.animationInProgress) return store.queueSwap(aIndex, bIndex);
  const { boardCols: cols, boardRows: rows } = store;
  const board = boardOf(store);
  const tiles = tilesOf(store);
  if (
    activateInPlace
      ? !canSwapGem(board[aIndex], tiles[aIndex])
      : !canSwapCells(board, tiles, aIndex, bIndex, cols, rows)
  )
    return store.rejectSwap(aIndex, bIndex, session);
  const evaluation = activateInPlace
    ? matchEngine.evaluateActivation(board, cols, rows, aIndex, tiles)
    : matchEngine.evaluateSwap(board, cols, rows, aIndex, bIndex, tiles);
  if (!evaluation.matches.length) return store.rejectSwap(aIndex, bIndex, session);
  const animator = store.renderer?.animator;
  animator?.clearQueuedSwapHighlight();
  return runMove(store, 'Error in resolveSwap:', async () => {
    const swap = activateInPlace ? null : (evaluation.swap ?? { aIndex, bIndex });
    if (animator && swap) {
      await animator.animateSwap(swap);
      if (session !== store.sessionVersion) return false;
    }
    const nextTiles = workingTiles(store.tiles);
    const resolution = resolveMatches(store, {
      board: evaluation.board,
      tiles: nextTiles,
      matches: evaluation.matches,
      bonuses: evaluation.bonuses,
      pendingBonus: evaluation.pendingBonus,
    });
    if (resolution.steps.length && evaluation.bonusSwap) {
      const activation = resolution.steps.find((step) =>
        step.matches.some((match) => match.type === 'bonus-activation'),
      );
      if (activation) activation.bonusSwap = evaluation.bonusSwap;
    }
    store._applyScoring(resolution.steps);
    if (!(await showResolution(store, resolution, session))) return false;
    store.tiles = plain(nextTiles);
    store.commitResolution(resolution);
    store.moves += 1;
    return true;
  });
}

// After a move or power resolves: accept input again, then keep the board playable.
export async function settleMove(store, boardUpdated) {
  store.pendingBoardState = null;
  store.animationInProgress = false;
  if (store.sessionActive) store.scheduleHint();
  store.processQueuedInput();
  if (boardUpdated && store.sessionActive && !store.levelCleared) await store.ensurePlayableBoard();
}

// A swap that makes no match bounces back; the board and move count stay unchanged.
export async function rejectSwap(store, aIndex, bIndex, session) {
  const animator = store.renderer?.animator;
  if (animator && isAdjacent(aIndex, bIndex, store.boardCols)) {
    store.animationInProgress = true;
    try {
      await animator.animateInvalidSwap({ aIndex, bIndex });
    } finally {
      if (session === store.sessionVersion) {
        store.animationInProgress = false;
        store.processQueuedInput();
      }
    }
    if (session !== store.sessionVersion) return false;
  }
  if (store.sessionActive) store.scheduleHint();
  return false;
}

export function queueSwap(store, aIndex, bIndex) {
  if (!store.sessionActive || !store.animationInProgress || store.levelCleared) return false;
  const snapshot = activeBoardOf(store);
  if (
    !Array.isArray(snapshot) ||
    !snapshot.length ||
    !Number.isInteger(aIndex) ||
    !Number.isInteger(bIndex) ||
    aIndex < 0 ||
    bIndex < 0 ||
    aIndex >= snapshot.length ||
    bIndex >= snapshot.length ||
    !isAdjacent(aIndex, bIndex, store.boardCols)
  )
    return false;
  // Bind input to visible pieces, never the not-yet-shown final cascade board.
  const animator = store.renderer?.animator;
  const board = boardOf(store);
  const gems = [aIndex, bIndex].map((index) => {
    if (animator?.indexToGemId) {
      const id = animator.indexToGemId[index];
      return { index, id, type: animator.gemSprites.get(id)?.__gemType };
    }
    return { index, id: board[index]?.id, type: board[index]?.type };
  });
  if (gems.some((gem) => !gem.id || !gem.type)) return false;
  store.queuedSwap = { aIndex, bIndex, gems };
  animator?.showQueuedSwap(aIndex, bIndex);
  return true;
}

export function commitResolution(store, resolution) {
  // Only moves that finished animating count; victory credits the tally to honours.
  if (store.playMode === 'normal')
    tallySteps(toRaw(store.honourTally), resolution.steps, { recovery: resolution.recovery });
  store.board = plain(resolution.board);
  store.pendingBoardState = null;
  store.boardVersion += 1;
  store.remainingLayers = Math.max(0, store.remainingLayers - (resolution.layersCleared ?? 0));
  store.updateObjectives();
  if (store.renderer?.animator) store.renderer.animator.updateTiles(store.tiles);
  else store.refreshBoardVisuals(true);
  if (store.remainingLayers === 0 && store.sessionActive) store.completeLevel();
}

export function hasPlayableMove(store) {
  const { boardCols: cols, boardRows: rows } = store;
  const board = activeBoardOf(store);
  const tiles = tilesOf(store);
  if (!store.sessionActive || store.levelCleared || !Array.isArray(board) || !board.length)
    return false;
  if (!cols || !rows) return false;
  return (
    board.some(
      (gem, index) => BOARD_BONUSES.includes(gem?.type) && canSwapGem(gem, tiles[index]),
    ) || !!hintEngine.findBestMove(board, tiles, cols, rows, { first: true })
  );
}

function showReshuffleNotice(store) {
  store.reshuffleNotice = {
    message: 'No moves left. A free shuffle to keep you going.',
    timestamp: Date.now(),
  };
  storeTimers(store).set('reshuffle', () => (store.reshuffleNotice = null), 2000);
}
export const clearReshuffleNotice = (store) => storeTimers(store).clear('reshuffle');

// A board without a legal match is always recoverable: free shuffles, then a seeded
// repair, then a free rescue sweep. These attempts bound random work, never the player.
export async function ensurePlayableBoard(store) {
  if (
    store.animationInProgress ||
    !store.sessionActive ||
    store.levelCleared ||
    !store.board.length
  )
    return false;
  if (store._hasPlayableMove()) return false;
  const session = store.sessionVersion;
  showReshuffleNotice(store);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await store.shuffleBoard())) return false;
    if (session !== store.sessionVersion) return false;
    if (store.levelCleared || store._hasPlayableMove()) return true;
    if (store.animationInProgress) return false;
  }
  const repaired = recoverBoard(boardOf(store), tilesOf(store), store.boardCols, store.boardRows);
  if (repaired) {
    if (!(await store.shuffleBoard({ recoveryBoard: repaired }))) return false;
    return session === store.sessionVersion && (store.levelCleared || store._hasPlayableMove());
  }
  // With no movable gems, another permutation cannot help. Each free rescue sweep
  // releases anchors with the normal double-hit rules and never uses inventory.
  if (!tilesOf(store).some(isAnchored)) return false;
  if (!(await store._activatePower('recovery_sweep', 0))) return false;
  if (session !== store.sessionVersion) return false;
  return store.levelCleared || store._hasPlayableMove();
}

export function applyScoring(store, steps) {
  if (!Array.isArray(steps) || !steps.length) {
    store.cascadeMultiplier = 1;
    return 0;
  }
  advanceOreOrders(store.oreOrders, steps);
  let total = 0;
  let deepestCascade = 1;
  steps.forEach((step, index) => {
    store.collectedJewels += step.collectedJewels?.length ?? 0;
    if (!Array.isArray(step?.cleared) || !step.cleared.length) return;
    const cascade = cascadeTier(step, index);
    total += clearScore(step, index);
    deepestCascade = Math.max(deepestCascade, cascade);
    if (store.playMode === 'normal') {
      if (cascade >= 2) store.comboCounts[cascade] = (store.comboCounts[cascade] ?? 0) + 1;
      const matchCount = simultaneousMatchCount(step);
      if (matchCount >= 2)
        store.multiMatchCounts[matchCount] = (store.multiMatchCounts[matchCount] ?? 0) + 1;
    }
  });
  store.cascadeMultiplier = deepestCascade;
  store.maxCascade = Math.max(store.maxCascade ?? 1, deepestCascade);
  if (total > 0) {
    store.score += total;
    store.updateObjectives({ scoreDelta: total });
  }
  store.syncContinuous();
  return total;
}

export function shuffleBoard(store, { recoveryBoard = null } = {}) {
  if (!store.sessionActive || store.animationInProgress || store.levelCleared) return false;
  store.cancelHint(true);
  const session = store.sessionVersion;
  const animator = store.renderer?.animator;
  const board = boardOf(store);
  const tiles = tilesOf(store);
  const nextBoard = [...(recoveryBoard ?? board)];
  const movable = nextBoard
    .map((gem, index) => (canSwapGem(gem, tiles[index]) ? index : -1))
    .filter((index) => index >= 0);
  for (let i = recoveryBoard ? 0 : movable.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = movable[i],
      b = movable[j];
    [nextBoard[a], nextBoard[b]] = [nextBoard[b], nextBoard[a]];
  }
  const rescueBonuses = recoveryBoard
    ? nextBoard.flatMap((gem, index) =>
        gem && !board.some((old) => old?.id === gem.id) ? [{ type: gem.type, index, gem }] : [],
      )
    : [];
  store.animationInProgress = true;
  store.pendingBoardState = plain(nextBoard);
  return (async () => {
    try {
      if (animator?.animateShuffle)
        await animator
          .animateShuffle(nextBoard, { cols: store.boardCols, rows: store.boardRows })
          .catch((error) => console.error('Shuffle animation failed:', error));
      if (session === store.sessionVersion && rescueBonuses.length && animator?.playSteps)
        await animator.playSteps([
          {
            index: 0,
            matches: [],
            cleared: [],
            tileUpdates: [],
            bonuses: rescueBonuses,
            drops: [],
            spawns: [],
          },
        ]);
      return session === store.sessionVersion
        ? await store._resolveBoardAfterShuffle(nextBoard, {
            cols: store.boardCols,
            rows: store.boardRows,
            animator,
          })
        : false;
    } finally {
      // A shuffle never re-checks playability itself; ensurePlayableBoard owns that loop.
      if (session === store.sessionVersion) await store.settleMove(false);
    }
  })();
}

export async function resolveBoardAfterShuffle(store, nextBoard, { cols, rows }) {
  const session = store.sessionVersion;
  try {
    const matches = matchEngine.findMatches(nextBoard, cols, rows, tilesOf(store));
    const nextTiles = workingTiles(store.tiles);
    const resolution = resolveMatches(store, {
      board: nextBoard,
      tiles: nextTiles,
      matches,
      bonuses: applyBonuses(nextBoard, detectBonusFromMatches(matches)),
    });
    store._applyScoring(resolution.steps);
    if (!(await showResolution(store, resolution, session))) return false;
    store.tiles = plain(nextTiles);
    store.commitResolution(resolution);
    return true;
  } catch (error) {
    console.error('Error resolving board after shuffle:', error);
    return false;
  }
}

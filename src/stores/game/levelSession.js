import { levelConfig } from '../../game/engine/LevelGenerator';
import { miningPayout } from '../../game/town/TownRules';
import { BOARD_BONUSES, layerCount } from '../../game/engine/TileRules';
import { performanceMark } from '../../game/PresentationWork';
import { useCampaignStore } from '../campaignStore';
import { cloneBoard, freshTiles, plain } from './boardData';
import { boardReadiness } from './rendererBinding';
import { clearReshuffleNotice } from './moveResolution';
import { storeTimers } from './storeTimers';

// Logical mine state only. Renderer objects, timers and input queues belong to
// their original window and must never cross a town handoff.
const HANDOFF_FIELDS = [
  'board',
  'tiles',
  'boardSize',
  'boardCols',
  'boardRows',
  'score',
  'maxCascade',
  'cascadeMultiplier',
  'objectives',
  'oreOrders',
  'moves',
  'totalLayers',
  'remainingLayers',
  'totalRelics',
  'levelCleared',
  'levelRewards',
  'collectedJewels',
  'runId',
  'coinReward',
  'remainingBonusGems',
  'comboCounts',
  'multiMatchCounts',
  'playMode',
  'constructionReward',
  'speedTargetMs',
  'currentBoardLayout',
  'currentLevelId',
];
const copy = (value) => JSON.parse(JSON.stringify(value));

export function captureHandoff(store) {
  if (!store.sessionActive) return null;
  if (store.animationInProgress || store.pendingBoardState)
    throw new Error('The current move is still finishing. Try again shortly.');
  store.syncRunClock(false);
  return copy({
    version: 1,
    state: Object.fromEntries(HANDOFF_FIELDS.map((key) => [key, store[key]])),
    elapsedMs: store.elapsedMs,
    clockStarted: store.playClock.started,
    continuousRun: useCampaignStore().continuousRun,
  });
}

export function restoreHandoff(store, snapshot) {
  if (!snapshot) return;
  const campaign = useCampaignStore();
  const state = snapshot.state;
  if (
    snapshot.version !== 1 ||
    !state ||
    !HANDOFF_FIELDS.every((key) => Object.hasOwn(state, key)) ||
    state.runId !== campaign.issuedRun ||
    (!state.levelCleared && state.runId <= campaign.settledRun) ||
    !Array.isArray(state.board) ||
    state.board.length !== state.boardCols * state.boardRows
  )
    throw new Error('This puzzle transfer could not be restored. Its saved copy has been kept.');
  store.bootstrap();
  boardReadiness(store).cancel();
  const session = store.sessionVersion + 1;
  const restored = copy(Object.fromEntries(HANDOFF_FIELDS.map((key) => [key, state[key]])));
  store.$patch((target) =>
    Object.assign(target, {
      ...restored,
      board: plain(restored.board),
      tiles: plain(restored.tiles),
      sessionActive: true,
      sessionVersion: session,
      // The transferred puzzle has already played its intro. Recreating its
      // renderer (including context recovery) must resume that same session.
      introTaskSession: session,
      introFinalized: session,
      rendererRecovering: false,
      boardVersion: store.boardVersion + 1,
      animationInProgress: false,
      pendingBoardState: null,
      queuedSwap: null,
      queuedBonus: null,
      activeBonusMode: null,
      powerInUse: null,
      inputPaused: true,
    }),
  );
  store.playClock.reset();
  store.playClock.elapsed = Math.max(0, snapshot.elapsedMs);
  store.playClock.started = !!snapshot.clockStarted;
  store.elapsedMs = store.playClock.elapsed;
  campaign.activeRun = state.levelCleared ? null : state.runId;
  campaign.continuousRun = snapshot.continuousRun ? copy(snapshot.continuousRun) : null;
  store.audioManager?.playAmbientLoop?.();
}

export function bootstrap(store) {
  if (store.currentBoardLayout) return;
  store.board = plain(Array(64).fill(null));
  store.currentBoardLayout = {
    name: 'default',
    shape: 'RECTANGLE',
    dimensions: { cols: 8, rows: 8 },
    blockedCells: [],
    initialTilePlacements: [],
  };
}

export function resetRunPresentation(store) {
  store.levelCleared = false;
  store.powerInUse = null;
  store.levelRewards = [];
  store.collectedJewels = 0;
  store.coinReward = 0;
  store.remainingBonusGems = 0;
  store.comboCounts = {};
  store.multiMatchCounts = {};
  store.constructionReward = [];
  storeTimers(store).clear('impact');
  store.arcadeImpact = null;
  storeTimers(store).clear('banner');
  store.arcadeBanner = null;
  store.reshuffleNotice = null;
}

export function startLevel(store, levelId, mode = 'normal', { debugReplay = false } = {}) {
  performanceMark('mine-intent');
  const campaign = useCampaignStore();
  if (
    !['normal', 'continuous'].includes(mode) ||
    !(
      campaign.canPlay(levelId, mode) ||
      (debugReplay && mode === 'normal' && campaign.isUnlocked(levelId))
    )
  )
    return false;
  const config = levelConfig(levelId);
  if (!config) return false;
  store.playMode = mode;
  store.runId = campaign.beginRun(mode, levelId);
  boardReadiness(store).cancel();
  store.sessionVersion += 1;
  store.renderer?.animator?.clear();
  store.renderer?.input?.reset();
  store.playClock.reset();
  store.elapsedMs = 0;
  store.speedTargetMs = config.speedTargetMs ?? 0;
  store.currentLevelId = levelId;
  clearReshuffleNotice(store);
  store.sessionActive = true;
  // Start audio in the mine-entry gesture, before renderer/paint callbacks.
  store.audioManager?.playAmbientLoop?.();
  store.resetRunPresentation();
  store.boardCols = config.boardCols ?? config.boardSize ?? 8;
  store.boardRows = config.boardRows ?? config.boardCols ?? config.boardSize ?? 8;
  store.boardSize = store.boardCols;
  store.board = cloneBoard(config.board);
  store.tiles = freshTiles(config.tiles);
  store.currentBoardLayout = config.boardLayout || store.currentBoardLayout;
  store.oreOrders = (config.oreOrders ?? []).map((order) => ({ ...order, progress: 0 }));
  store.objectives = config.objectives.map((objective) => ({ ...objective, progress: 0 }));
  store.moves = 0;
  store.score = 0;
  store.maxCascade = 1;
  store.cascadeMultiplier = 1;
  store.animationInProgress = true;
  store.pendingBoardState = null;
  store.queuedSwap = null;
  store.queuedBonus = null;
  store.activeBonusMode = null;
  store.clearBonusPreview(true);
  store.renderer?.animator?.clearQueuedSwapHighlight?.();
  store.totalLayers = store.tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
  store.remainingLayers = store.totalLayers;
  store.totalRelics = store.remainingRelics;
  store.updateObjectives({ reset: true });
  store.boardVersion += 1;
  store.refreshBoardVisuals(true);
  store.cancelHint(true);
  store.requestIntro();
  return true;
}

export function exitLevel(store) {
  boardReadiness(store).cancel();
  const campaign = useCampaignStore();
  campaign.endRun(store.runId);
  campaign.settlePendingChests();
  store.syncContinuous();
  store.playMode = 'normal';
  store.syncRunClock(false);
  store.sessionVersion += 1;
  store.powerInUse = null;
  store.cancelHint(true);
  clearReshuffleNotice(store);
  store.sessionActive = false;
  store.board = plain([]);
  store.tiles = plain([]);
  store.objectives = [];
  store.oreOrders = [];
  store.score = 0;
  store.maxCascade = 1;
  store.cascadeMultiplier = 1;
  store.animationInProgress = false;
  store.pendingBoardState = null;
  store.queuedSwap = null;
  store.queuedBonus = null;
  store.activeBonusMode = null;
  store.renderer?.animator?.clearQueuedBonusHighlight?.();
  store.clearBonusPreview(true);
  store.totalLayers = 0;
  store.remainingLayers = 0;
  store.totalRelics = 0;
  store.resetRunPresentation();
  store.renderer?.animator?.clearQueuedSwapHighlight?.();
  if (store.renderer?.animator) store.renderer.animator.clear();
  else store.renderer?.boardContainer?.removeAll?.(true);
  store.renderer?.input?.reset();
  store.boardVersion += 1;
  store.currentLevelId = null;
}

export function syncContinuous(store) {
  if (!store.sessionActive || store.playMode !== 'continuous') return;
  useCampaignStore().recordContinuous({
    id: store.currentLevelId,
    runId: store.runId,
    jewels: store.collectedJewels,
    score: store.score,
  });
}

export function completeLevel(store) {
  if (store.playMode === 'continuous') return;
  if (
    store.levelCleared ||
    !store.sessionActive ||
    store.remainingLayers > 0 ||
    store.remainingRelics > 0 ||
    store.remainingOre > 0
  )
    return;
  const campaign = useCampaignStore();
  store.syncRunClock(false);
  store.remainingBonusGems = store.board.filter((gem) => BOARD_BONUSES.includes(gem?.type)).length;
  store.coinReward = miningPayout(
    store.collectedJewels,
    store.remainingBonusGems,
    store.comboCounts,
    store.multiMatchCounts,
    store.currentLevelId,
  );
  store.levelRewards = campaign.recordVictory({
    chooseRewards: true,
    bonusGems: store.remainingBonusGems,
    comboCounts: store.comboCounts,
    multiMatchCounts: store.multiMatchCounts,
    runId: store.runId,
    jewels: store.collectedJewels,
    elapsedMs: store.playClock.started ? store.elapsedMs : null,
    speedTargetMs: store.speedTargetMs,
    id: store.currentLevelId,
    score: store.score,
    combo: store.maxCascade,
    starTarget: store.starScoreTarget,
    target: store.objectives.find((objective) => objective.type === 'score')?.target ?? 0,
  });
  store.constructionReward = campaign.lastConstruction;
  store.cancelHint(true);
  clearReshuffleNotice(store);
  store.reshuffleNotice = null;
  store.remainingLayers = 0;
  store.levelCleared = true;
  store.animationInProgress = false;
  store.pendingBoardState = null;
  store.queuedSwap = null;
  store.queuedBonus = null;
  store.activeBonusMode = null;
  store.renderer?.animator?.clearQueuedSwapHighlight?.();
  store.renderer?.input?.reset();
  store.updateObjectives();
}

export function updateObjectives(store, { reset = false, scoreDelta = 0 } = {}) {
  const find = (type) => store.objectives.find((objective) => objective.type === type);
  const layers = find('clear-layers');
  const score = find('score');
  const relics = find('collect-relics');
  if (relics) relics.progress = store.totalRelics - store.remainingRelics;
  if (reset) {
    if (layers) layers.progress = layers.target - store.remainingLayers;
    if (score) score.progress = Math.min(score.target, store.score);
    return;
  }
  if (layers) layers.progress = Math.min(layers.target, layers.target - store.remainingLayers);
  if (score && scoreDelta)
    score.progress = Math.min(score.target, Math.max(0, (score.progress ?? 0) + scoreDelta));
}

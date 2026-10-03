import { markRaw } from 'vue';
import { defineStore } from 'pinia';
import { remainingOre } from '../game/engine/ChapterMechanics';
import { PlayClock } from '../game/engine/PlayClock';
import { levelConfig } from '../game/engine/LevelGenerator';
import { createRunTally } from '../data/honours';
import { useSettingsStore } from './settingsStore';
import { plain } from './game/boardData';
import { storeTimers } from './game/storeTimers';
import * as binding from './game/rendererBinding';
import * as moves from './game/moveResolution';
import * as level from './game/levelSession';

const ARCADE_CHAINS = ['fusion', 'multi-match'];

// The puzzle session store. State and getters live here; the level lifecycle,
// move resolution and Phaser binding live in ./game and receive this store.
export const useGameStore = defineStore('game', {
  state: () => ({
    sessionActive: false,
    sessionVersion: 0,
    introTaskSession: null,
    introFinalized: null,
    rendererRecovering: false,
    inputPaused: false,
    // Plain arrays, replaced on every committed move (see ./game/boardData).
    board: plain([]),
    tiles: plain([]),
    boardSize: 8,
    boardCols: 8,
    boardRows: 8,
    cellSize: 72,
    score: 0,
    maxCascade: 1,
    cascadeMultiplier: 1,
    objectives: [],
    oreOrders: [],
    boardVersion: 0,
    renderer: null,
    moves: 0,
    animationInProgress: false,
    pendingBoardState: null,
    queuedSwap: null,
    queuedBonus: null,
    activeBonusMode: null,
    powerInUse: null,
    bonusPreview: {
      indices: [],
      key: null,
    },
    totalLayers: 0,
    remainingLayers: 0,
    totalRelics: 0,
    levelCleared: false,
    levelRewards: [],
    collectedJewels: 0,
    runId: null,
    coinReward: 0,
    remainingBonusGems: 0,
    comboCounts: {},
    multiMatchCounts: {},
    // Gems and fusions from committed moves, credited to honours only at victory.
    honourTally: createRunTally(),
    playMode: 'normal',
    constructionReward: [],
    arcadeImpact: null,
    arcadeBanner: null,
    playClock: markRaw(new PlayClock()),
    elapsedMs: 0,
    speedTargetMs: 0,
    audioManager: null,
    hintMove: null,
    currentBoardLayout: null,
    currentLevelId: null,
    reshuffleNotice: null,
  }),
  getters: {
    // Levels are generated on first use; see levelConfig().
    currentLevel: (state) => {
      const config = levelConfig(state.currentLevelId);
      return config ? { id: config.id, summary: config.summary, config } : null;
    },
    starScoreTarget(state) {
      return (
        this.currentLevel?.config.starScoreTarget ??
        state.objectives.find((objective) => objective.type === 'score')?.target ??
        0
      );
    },
    activeBoard(state) {
      return state.pendingBoardState ?? state.board;
    },
    remainingRelics: (state) => state.board.filter((gem) => gem?.type === 'relic').length,
    remainingOre: (state) => remainingOre(state.oreOrders),
    goalTotal: (state) =>
      state.totalLayers +
      state.totalRelics +
      state.oreOrders.reduce((sum, order) => sum + order.target, 0),
    goalProgress() {
      return this.goalTotal - this.remainingLayers - this.remainingRelics - this.remainingOre;
    },
    layerLabel(state) {
      const tiles = this.currentLevel?.config.tiles ?? [];
      const fallback =
        state.objectives.find((objective) => objective.type === 'clear-layers')?.label ?? 'Layers';
      if (tiles.some((tile) => tile.sealColor || tile.chainHealth || tile.signal)) return fallback;
      const stone = tiles.some((tile) => tile.type === 'blocker' && tile.health > 0);
      const ice = tiles.some((tile) => tile.type !== 'blocker' && tile.health > 0);
      return ice ? (stone ? 'Ice & stone' : 'Ice') : stone ? 'Stone' : 'Layers';
    },
  },
  actions: {
    // Level lifecycle and the town handoff.
    bootstrap() {
      level.bootstrap(this);
    },
    startLevel(levelId, mode, options) {
      return level.startLevel(this, levelId, mode, options);
    },
    exitLevel() {
      level.exitLevel(this);
    },
    completeLevel() {
      level.completeLevel(this);
    },
    updateObjectives(options) {
      level.updateObjectives(this, options);
    },
    syncContinuous() {
      level.syncContinuous(this);
    },
    resetRunPresentation() {
      level.resetRunPresentation(this);
    },
    captureHandoff() {
      return level.captureHandoff(this);
    },
    restoreHandoff(snapshot) {
      level.restoreHandoff(this, snapshot);
    },

    // The play clock times only moments the player can act. Displays show whole
    // seconds, so a running clock publishes once per second; rewards and handoffs
    // pass `running` explicitly and always read the exact time.
    syncRunClock(running) {
      const canPlay =
        running ??
        (this.sessionActive &&
          !this.levelCleared &&
          !this.animationInProgress &&
          !this.inputPaused &&
          !!this.renderer);
      const elapsed = this.playClock.setRunning(canPlay);
      if (running !== undefined || Math.floor(elapsed / 1000) !== Math.floor(this.elapsedMs / 1000))
        this.elapsedMs = elapsed;
    },

    // Short arcade notices over the board.
    showArcadeBanner(banner) {
      if (!this.sessionActive || this.levelCleared) return;
      const chain = ARCADE_CHAINS.includes(banner.kind);
      if (ARCADE_CHAINS.includes(this.arcadeBanner?.kind) && !chain) return;
      this.arcadeBanner = {
        ...banner,
        ...(this.playMode === 'continuous' ? { coins: undefined } : {}),
        id: (this.arcadeBanner?.id ?? 0) + 1,
      };
      storeTimers(this).set('banner', () => (this.arcadeBanner = null), chain ? 3200 : 2000);
    },
    showArcadeImpact(effect) {
      if (useSettingsStore().reducedMotion || !this.sessionActive || this.levelCleared) return;
      this.arcadeImpact = { ...effect, id: (this.arcadeImpact?.id ?? 0) + 1 };
      storeTimers(this).set('impact', () => (this.arcadeImpact = null), 850);
    },
    setAudioManager(manager) {
      const changed = manager !== this.audioManager;
      this.audioManager = manager ? markRaw(manager) : null;
      // A transferred mine can resume before its App mounts the audio manager.
      if (changed && this.sessionActive) this.audioManager?.playAmbientLoop?.();
      this.renderer?.animator?.setAudioManager?.(this.audioManager);
    },

    // Hints.
    clearHint() {
      this.hintMove = null;
      this.renderer?.animator?.clearHintMove?.();
    },
    cancelHint(clearVisual = false) {
      moves.cancelHint(this, clearVisual);
    },
    scheduleHint(delay) {
      moves.scheduleHint(this, delay);
    },
    computeHintMove() {
      moves.computeHintMove(this);
    },
    notifyPlayerActivity() {
      this.cancelHint(true);
      if (this.sessionActive) this.scheduleHint();
    },

    // Powers. Choosing a power, choosing it again (toggle off) or null all drop any
    // queued target. Clearing works while paused; choosing needs a live board.
    setBonusMode(mode) {
      if (mode !== null) {
        if (!this.sessionActive || this.levelCleared || this.inputPaused) return false;
        this.cancelHint(true);
      }
      this.activeBonusMode = mode === this.activeBonusMode ? null : mode;
      this.queuedBonus = null;
      this.renderer?.animator?.clearQueuedBonusHighlight?.();
      this.clearBonusPreview(true);
      return true;
    },
    resolveBonusClick(index) {
      return moves.resolveBonusClick(this, index);
    },
    _activatePower(bonusName, index, consume) {
      return moves.activatePower(this, bonusName, index, consume);
    },
    activateOneTimeBonus(bonusName, options) {
      return moves.activateOneTimeBonus(this, bonusName, options);
    },
    clearBonusPreview(force = false) {
      if (!force && !this.bonusPreview?.indices?.length) return;
      this.bonusPreview = { indices: [], key: null };
      this.renderer?.animator?.clearBonusPreview?.();
    },
    previewPowerEffect(index) {
      moves.previewPowerEffect(this, index);
    },

    // Moves.
    activateBonusGem(index) {
      if (this.animationInProgress || this.inputPaused || this.activeBonusMode) return false;
      return this.resolveSwap(index, index, { activateInPlace: true });
    },
    resolveSwap(aIndex, bIndex, options) {
      return moves.resolveSwap(this, aIndex, bIndex, options);
    },
    rejectSwap(aIndex, bIndex, session) {
      return moves.rejectSwap(this, aIndex, bIndex, session);
    },
    queueSwap(aIndex, bIndex) {
      return moves.queueSwap(this, aIndex, bIndex);
    },
    processQueuedInput() {
      moves.processQueuedInput(this);
    },
    settleMove(boardUpdated) {
      return moves.settleMove(this, boardUpdated);
    },
    commitResolution(resolution) {
      moves.commitResolution(this, resolution);
    },
    _applyScoring(steps) {
      return moves.applyScoring(this, steps);
    },
    _hasPlayableMove() {
      return moves.hasPlayableMove(this);
    },
    ensurePlayableBoard() {
      return moves.ensurePlayableBoard(this);
    },
    shuffleBoard(options) {
      return moves.shuffleBoard(this, options);
    },
    _resolveBoardAfterShuffle(nextBoard, options) {
      return moves.resolveBoardAfterShuffle(this, nextBoard, options);
    },

    // The Phaser board.
    requestIntro() {
      binding.requestIntro(this);
    },
    attachRenderer(payload) {
      binding.attachRenderer(this, payload);
    },
    detachRenderer() {
      binding.detachRenderer(this);
    },
    refreshBoardVisuals(forceRedraw = false) {
      binding.refreshBoardVisuals(this, forceRedraw);
    },
  },
});

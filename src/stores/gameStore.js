import { BoardReadiness } from '../game/phaser/BoardReadiness';
import { afterPaint, performanceMark } from '../game/PresentationWork';
const readiness = new WeakMap();
const boardReadiness = (store) => {
  store = toRaw(store.$state);
  if (!readiness.has(store)) readiness.set(store, new BoardReadiness());
  return readiness.get(store);
};
import { advanceOreOrders, remainingOre } from '../game/engine/ChapterMechanics';
import { markRaw, toRaw } from 'vue';
import { miningPayout } from '../game/town/TownRules';
import { PlayClock } from '../game/engine/PlayClock';
import { useCampaignStore } from './campaignStore';
import { useSettingsStore } from './settingsStore';
import { defineStore } from 'pinia';
import { generateLevelConfigs } from '../game/engine/LevelGenerator';
import { GEM_TYPES } from '../game/engine/GemFactory';
import { recoverBoard } from '../game/engine/BoardRecovery';
import { MatchEngine } from '../game/engine/MatchEngine';
import { cascadeTier, clearScore, simultaneousMatchCount } from '../game/engine/MatchRewards';
import { TileManager } from '../game/engine/TileManager';
import { useInventoryStore } from './inventoryStore';
import { BonusActivator } from '../game/engine/BonusActivator';
import { HintEngine } from '../game/engine/HintEngine';
import { detectBonusFromMatches } from '../game/engine/MatchPatterns';
import { BoardAnimator } from '../game/phaser/BoardAnimator';
import { BoardInput } from '../game/phaser/BoardInput';
import { canSwapGem, isAnchored, layerCount } from '../game/engine/TileRules';

const matchEngine = new MatchEngine();
const tileManager = new TileManager();
const bonusActivator = new BonusActivator();
const hintEngine = new HintEngine();
const HINT_DELAY_MS = 15000;
let hintTimerId = null;
let arcadeImpactTimeout = null;
let arcadeBannerTimeout = null;
let reshuffleNoticeTimeoutId = null;

const getBoardCenterIndex = (cols, rows) => {
  const totalCells = Math.max(1, (cols || 0) * (rows || 0));
  const center = Math.floor(totalCells / 2);
  return Math.min(center, totalCells - 1);
};

const cloneBoardState = (board = []) => {
  if (!Array.isArray(board)) {
    return [];
  }
  return board.map((gem) => {
    if (!gem) {
      return null;
    }
    return { ...gem };
  });
};

const cloneTileLayers = (tiles = []) => {
  if (!Array.isArray(tiles)) {
    return [];
  }
  return tiles.map((tile) => {
    if (!tile) {
      return null;
    }
    const maxHealth = tile.maxHealth ?? tile.health ?? 0;
    return {
      ...tile,
      maxHealth,
      health: maxHealth,
      ...(tile.maxChainHealth != null ? { chainHealth: tile.maxChainHealth } : {}),
      cleared: false,
    };
  });
};

export const useGameStore = defineStore('game', {
  state: () => ({
    sessionActive: false,
    sessionVersion: 0,
    introTaskSession: null,
    introFinalized: null,
    introClaimed: null,
    rendererRecovering: false,
    inputPaused: false,
    board: [],
    tiles: [],
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
    availableLevels: [],
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
    starScoreTarget: (state) =>
      state.availableLevels.find((level) => level.id === state.currentLevelId)?.config
        .starScoreTarget ??
      state.objectives.find((objective) => objective.type === 'score')?.target ??
      0,
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
    layerLabel: (state) => {
      const tiles =
        state.availableLevels.find((level) => level.id === state.currentLevelId)?.config.tiles ??
        [];
      const fallback =
        state.objectives.find((objective) => objective.type === 'clear-layers')?.label ?? 'Layers';
      if (tiles.some((tile) => tile.sealColor || tile.chainHealth || tile.signal)) return fallback;
      const stone = tiles.some((tile) => tile.type === 'blocker' && tile.health > 0);
      const ice = tiles.some((tile) => tile.type !== 'blocker' && tile.health > 0);
      return ice ? (stone ? 'Ice & stone' : 'Ice') : stone ? 'Stone' : 'Layers';
    },
  },
  actions: {
    showArcadeBanner(banner) {
      if (!this.sessionActive || this.levelCleared) return;
      if (
        ['fusion', 'multi-match'].includes(this.arcadeBanner?.kind) &&
        !['fusion', 'multi-match'].includes(banner.kind)
      )
        return;
      clearTimeout(arcadeBannerTimeout);
      this.arcadeBanner = {
        ...banner,
        ...(this.playMode === 'continuous' ? { coins: undefined } : {}),
        id: (this.arcadeBanner?.id ?? 0) + 1,
      };
      arcadeBannerTimeout = setTimeout(
        () => (this.arcadeBanner = null),
        ['fusion', 'multi-match'].includes(banner.kind) ? 3200 : 2000,
      );
    },
    showArcadeImpact(effect) {
      if (useSettingsStore().reducedMotion || !this.sessionActive || this.levelCleared) return;
      clearTimeout(arcadeImpactTimeout);
      this.arcadeImpact = { ...effect, id: (this.arcadeImpact?.id ?? 0) + 1 };
      arcadeImpactTimeout = setTimeout(() => (this.arcadeImpact = null), 850);
    },
    syncRunClock(running) {
      const canPlay =
        running ??
        (this.sessionActive &&
          !this.levelCleared &&
          !this.animationInProgress &&
          !this.inputPaused &&
          !!this.renderer);
      this.elapsedMs = this.playClock.setRunning(canPlay);
    },
    setAudioManager(manager) {
      this.audioManager = manager ? markRaw(manager) : null;
      const animator = this.renderer?.animator;
      if (animator?.setAudioManager) {
        animator.setAudioManager(this.audioManager);
      }
    },
    clearHint() {
      this.hintMove = null;
      this.renderer?.animator?.clearHintMove?.();
    },
    cancelHint(clearVisual = false) {
      if (hintTimerId) {
        clearTimeout(hintTimerId);
        hintTimerId = null;
      }
      if (clearVisual) {
        this.clearHint();
      }
    },
    scheduleHint(delay = HINT_DELAY_MS) {
      if (!this.sessionActive) {
        return;
      }

      if (hintTimerId) {
        clearTimeout(hintTimerId);
      }

      hintTimerId = setTimeout(() => {
        hintTimerId = null;
        this.computeHintMove();
      }, delay);
    },
    setBonusMode(mode) {
      // Allow clearing even if session is paused; activation still requires sessionActive checks elsewhere
      if (mode === null) {
        this.activeBonusMode = null;
        this.queuedBonus = null;
        this.renderer?.animator?.clearQueuedBonusHighlight?.();
        this.clearBonusPreview(true);
        return true;
      }

      if (!this.sessionActive || this.levelCleared || this.inputPaused) {
        return false;
      }

      this.cancelHint(true);

      // Toggle off if already selected
      if (this.activeBonusMode === mode) {
        this.activeBonusMode = null;
        this.queuedBonus = null;
        this.renderer?.animator?.clearQueuedBonusHighlight?.();
        this.clearBonusPreview(true);
        return true;
      }

      // Switching modes clears any queued bonus target and previews
      this.activeBonusMode = mode;
      this.queuedBonus = null;
      this.renderer?.animator?.clearQueuedBonusHighlight?.();
      this.clearBonusPreview(true);
      return true;
    },
    async resolveBonusClick(index) {
      if (!this.sessionActive || this.inputPaused || !this.activeBonusMode || this.levelCleared) {
        return false;
      }

      const bonusName = this.activeBonusMode;
      this.cancelHint(true);
      if (this.animationInProgress) {
        // Queue the bonus activation to run once current animations finish
        this.queuedBonus = { index, bonusName };
        this.renderer?.animator?.showQueuedBonus?.(index);
        this.activeBonusMode = null;
        this.clearBonusPreview(true);
        return true;
      }

      this.renderer?.animator?.clearQueuedBonusHighlight?.();
      this.activeBonusMode = null;

      return this._activatePower(bonusName, index, true);
    },
    async _activatePower(bonusName, index, consume = false) {
      if (!this.sessionActive || this.inputPaused || this.animationInProgress || this.levelCleared)
        return false;
      const inventory = useInventoryStore();
      if (consume && inventory.availableQuantity(bonusName) <= 0) {
        this.clearBonusPreview(true);
        return false;
      }
      const session = this.sessionVersion;
      let boardUpdated = false;
      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const animator = this.renderer?.animator;

      this.powerInUse = consume ? bonusName.replaceAll('_', '-') : null;
      this.bonusPreview = { indices: [], key: null };
      animator?.fadeBonusPreview?.();
      this.animationInProgress = true;
      try {
        const rescue = bonusName === 'recovery_sweep';
        const clearedIndices = rescue
          ? this.board.map((_, i) => i)
          : bonusActivator.activatePower(bonusName, this.board, cols, rows, index, this.tiles);

        if (clearedIndices.length === 0) {
          console.log(`Bonus ${bonusName} had no effect.`);
          return false;
        }

        const matches = [
          {
            type: bonusName,
            indices: clearedIndices,
            ...(rescue ? { fusion: { targets: clearedIndices, damage: 2 } } : {}),
          },
        ];

        const nextTiles = this.tiles.map((tile) => ({ ...tile }));
        const resolution = tileManager.getResolution({
          gemTypes: this.currentBoardLayout?.gemTypes ?? GEM_TYPES,
          board: this.board,
          tiles: nextTiles,
          matches: matches,
          cols,
          rows,
        });

        if (resolution.steps[0]) {
          resolution.steps[0].bonusEffect = {
            type: rescue ? 'rainbow' : bonusName,
            originIndex: index,
          };
        }

        this.pendingBoardState = resolution.board;

        if (animator && resolution.steps.length) {
          await animator.playSteps(resolution.steps);
          if (session !== this.sessionVersion) return false;
        }

        // Consume before committing so victory rewards see the updated inventory.
        if (consume && !inventory.consumeItem(bonusName)) return false;
        this.tiles = nextTiles;
        this._applyScoring(resolution.steps);
        this.commitResolution(resolution);
        boardUpdated = true;
        return true;
      } catch (error) {
        console.error('Error activating bonus:', error);
        return false;
      } finally {
        if (session !== this.sessionVersion) return false;
        this.powerInUse = null;
        this.pendingBoardState = null;
        this.animationInProgress = false;
        if (this.sessionActive) {
          this.scheduleHint();
        }
        this.processQueuedInput();
        if (boardUpdated && this.sessionActive && !this.levelCleared) {
          await this.ensurePlayableBoard();
        }
      }
    },
    clearBonusPreview(force = false) {
      if (!force && !this.bonusPreview?.indices?.length) {
        return;
      }
      this.bonusPreview = { indices: [], key: null };
      this.renderer?.animator?.clearBonusPreview?.();
    },
    /**
     * Preview the effect of an interactive power (tnt, color_wand, tile_breaker) at a given tile index.
     * Shows which tiles will be affected when the power is activated.
     */
    previewPowerEffect(index) {
      if (!this.sessionActive || this.animationInProgress || this.levelCleared) {
        this.clearBonusPreview();
        return;
      }

      const bonusMode = this.activeBonusMode;
      if (!bonusMode) {
        this.clearBonusPreview();
        return;
      }

      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const board = this.activeBoard;

      if (
        !Array.isArray(board) ||
        !board.length ||
        index == null ||
        index < 0 ||
        index >= board.length
      ) {
        this.clearBonusPreview();
        return;
      }

      // Get the indices that would be affected
      const indices =
        bonusActivator.previewBonus(bonusMode, board, cols, rows, index, this.tiles) ?? [];

      if (!indices.length) {
        this.clearBonusPreview();
        return;
      }

      const cacheKey = `power-${bonusMode}-${index}-${indices.join(',')}`;
      if (this.bonusPreview?.key === cacheKey) {
        return; // Already showing this preview
      }

      this.bonusPreview = {
        indices,
        key: cacheKey,
      };
      this.renderer?.animator?.showBonusPreview?.(indices);
    },
    processQueuedInput() {
      if (this.animationInProgress || this.inputPaused || !this.sessionActive || this.levelCleared)
        return;
      if (this.queuedBonus) {
        const queued = this.queuedBonus;
        this.queuedBonus = null;
        this.activeBonusMode = queued.bonusName;
        this.resolveBonusClick(queued.index);
      } else if (this.queuedSwap) {
        const queued = this.queuedSwap;
        this.queuedSwap = null;
        this.renderer?.animator?.clearQueuedSwapHighlight?.();
        if (
          queued.gems?.some(
            ({ index, id, type }) =>
              this.board[index]?.id !== id || this.board[index]?.type !== type,
          )
        )
          return;
        this.resolveSwap(queued.aIndex, queued.bIndex);
      }
    },
    async activateOneTimeBonus(bonusName, { consume = false } = {}) {
      if (!this.sessionActive || this.inputPaused || this.animationInProgress || this.levelCleared)
        return false;
      this.clearBonusPreview(true);
      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const origin =
        bonusName === 'clear_row'
          ? Math.floor(Math.random() * rows) * cols
          : getBoardCenterIndex(cols, rows);
      return this._activatePower(bonusName, origin, consume);
    },
    notifyPlayerActivity() {
      this.cancelHint(true);
      if (this.sessionActive) {
        this.scheduleHint();
      }
    },
    computeHintMove() {
      if (!this.sessionActive || this.inputPaused || this.levelCleared || this.activeBonusMode) {
        return;
      }

      if (this.animationInProgress) {
        this.scheduleHint();
        return;
      }

      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const board = this.activeBoard;

      if (!Array.isArray(board) || !board.length) {
        return;
      }

      const hint = hintEngine.findBestMove(board, this.tiles ?? [], cols, rows, {
        oreOrders: this.oreOrders,
      });
      this.hintMove = hint;

      if (!hint) {
        this.renderer?.animator?.clearHintMove?.();
        return;
      }

      this.renderer?.animator?.showHintMove?.(hint.indices);
    },
    bootstrap() {
      if (this.availableLevels.length) {
        return;
      }

      this.availableLevels = generateLevelConfigs().map((level, index) => ({
        id: level.id ?? index + 1,
        label: `Level ${level.id ?? index + 1}`,
        summary: level.summary,
        config: level,
      }));

      // Initialize with a default empty board
      this.board = Array(64).fill(null);
      this.currentBoardLayout = {
        name: 'default',
        shape: 'RECTANGLE',
        dimensions: { cols: 8, rows: 8 },
        blockedCells: [],
        initialTilePlacements: [],
      };
    },
    resetRunPresentation() {
      this.levelCleared = false;
      this.powerInUse = null;
      this.levelRewards = [];
      this.collectedJewels = 0;
      this.coinReward = 0;
      this.remainingBonusGems = 0;
      this.comboCounts = {};
      this.multiMatchCounts = {};
      this.constructionReward = [];
      clearTimeout(arcadeImpactTimeout);
      this.arcadeImpact = null;
      clearTimeout(arcadeBannerTimeout);
      this.arcadeBanner = null;
      this.reshuffleNotice = null;
    },
    startLevel(levelId, mode = 'normal', { debugReplay = false } = {}) {
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
      const selected = this.availableLevels.find((entry) => entry.id === levelId);
      if (!selected) {
        console.warn('No level config found for id', levelId);
        return;
      }

      this.playMode = mode;
      this.runId = useCampaignStore().beginRun(mode, levelId);
      boardReadiness(this).cancel();
      this.sessionVersion += 1;
      const session = this.sessionVersion;
      this.renderer?.animator?.clear();
      this.renderer?.input?.reset();
      const { config } = selected;
      this.playClock.reset();
      this.elapsedMs = 0;
      this.speedTargetMs = config.speedTargetMs ?? 0;
      this.currentLevelId = levelId;
      if (reshuffleNoticeTimeoutId) {
        clearTimeout(reshuffleNoticeTimeoutId);
        reshuffleNoticeTimeoutId = null;
      }
      const freshBoard = cloneBoardState(config.board);
      const freshTiles = cloneTileLayers(config.tiles);
      this.sessionActive = true;
      this.resetRunPresentation();
      this.boardCols = config.boardCols ?? config.boardSize ?? 8;
      this.boardRows = config.boardRows ?? config.boardCols ?? config.boardSize ?? 8;
      this.boardSize = this.boardCols;
      this.board = freshBoard;
      this.clearBonusPreview(true);
      this.tiles = freshTiles;
      this.currentBoardLayout = config.boardLayout || this.currentBoardLayout;
      if (this.renderer?.animator) {
        this.renderer.animator.boardLayout = this.currentBoardLayout;
      }
      this.oreOrders = (config.oreOrders ?? []).map((order) => ({ ...order, progress: 0 }));
      this.objectives = config.objectives.map((objective) => ({ ...objective, progress: 0 }));
      this.moves = 0;
      this.score = 0;
      this.maxCascade = 1;
      this.cascadeMultiplier = 1;
      this.animationInProgress = true;
      this.pendingBoardState = null;
      this.queuedSwap = null;
      this.queuedBonus = null;
      this.activeBonusMode = null;
      this.clearBonusPreview(true);
      this.renderer?.animator?.clearQueuedSwapHighlight?.();
      this.totalLayers = this.tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
      this.remainingLayers = this.totalLayers;
      this.totalRelics = this.remainingRelics;
      this.updateObjectives({ reset: true });
      this.boardVersion += 1;
      this.refreshBoardVisuals(true);
      this.cancelHint(true);

      this.requestIntro();
    },
    requestIntro() {
      const session = this.sessionVersion;
      if (this.introTaskSession === session) return;
      this.introTaskSession = session;
      const ready = boardReadiness(this);
      const finalize = () => {
        if (
          session !== this.sessionVersion ||
          !this.sessionActive ||
          this.introFinalized === session
        )
          return;
        this.introFinalized = session;
        this.rendererRecovering = false;
        this.animationInProgress = false;
        this.renderer?.animator?.updateTiles?.(this.tiles);
        performanceMark('board-input-ready');
        this.scheduleHint();
        this.processQueuedInput();
        this.ensurePlayableBoard();
      };
      // The finite headless diagnostic runner has no canvas or renderer lifecycle.
      if (typeof window === 'undefined' && !this.renderer) {
        finalize();
        return;
      }
      if (typeof window === 'undefined' && this.renderer)
        ready.publish(session, this.renderer.animator);
      this.introTask = (async () => {
        let binding;
        while (session === this.sessionVersion && this.sessionActive) {
          binding = await ready.wait(session);
          if (!binding || session !== this.sessionVersion) return;
          if (ready.current(binding, session)) break;
        }
        if (!ready.current(binding, session) || session !== this.sessionVersion) return;
        this.introClaimed = session;
        try {
          await binding.animator.playIntroCascade?.();
        } catch (error) {
          if (session === this.sessionVersion)
            console.warn('Intro cascade animation failed:', error);
        }
        while (session === this.sessionVersion && this.sessionActive) {
          binding = await ready.wait(session);
          if (!binding) return;
          if (ready.current(binding, session)) {
            finalize();
            return;
          }
        }
      })();
    },
    detachRenderer() {
      boardReadiness(this).invalidate();
      this.renderer?.input?.destroy();
      this.renderer?.animator?.destroy();
      this.renderer = null;
    },
    attachRenderer(renderer) {
      boardReadiness(this).invalidate();
      if (this.renderer?.animator) {
        this.renderer.animator.destroy();
      }
      if (this.renderer?.input) {
        this.renderer.input.destroy();
      }

      const animator = new BoardAnimator({
        scene: renderer.scene,
        boardContainer: renderer.boardContainer,
        backgroundLayer: renderer.backgroundLayer,
        tileLayer: renderer.tileLayer,
        gemLayer: renderer.gemLayer,
        fxLayer: renderer.fxLayer,
        textures: renderer.textures,
        particles: renderer.particles,
        audio: this.audioManager,
        settings: useSettingsStore(),
        onImpact: (effect) => this.showArcadeImpact(effect),
        onBanner: (banner) => this.showArcadeBanner(banner),
        boardLayout: this.currentBoardLayout,
      });

      const input = new BoardInput({
        scene: renderer.scene,
        boardContainer: renderer.boardContainer,
        gameStore: this,
      });

      this.renderer = markRaw({ ...renderer, animator, input });
      this.clearBonusPreview(true);

      if (this.board.length > 0) {
        this.refreshBoardVisuals(true);
      }
      const session = this.sessionVersion;
      const generation = boardReadiness(this).generation;
      const present = () => {
        if (
          !this.sessionActive ||
          session !== this.sessionVersion ||
          generation !== boardReadiness(this).generation
        )
          return;
        performanceMark('first-visible-jewels');
        boardReadiness(this).publish(session, animator);
        if (this.introFinalized === session && this.rendererRecovering) {
          this.rendererRecovering = false;
          this.animationInProgress = false;
          this.scheduleHint();
          this.processQueuedInput();
        }
        this.audioManager?.playAmbientLoop?.();
      };
      if (typeof requestAnimationFrame === 'function') afterPaint(present);
      else present();
    },
    refreshBoardVisuals(forceRedraw = false) {
      if (!this.renderer || !this.currentBoardLayout) {
        return;
      }

      const { boardContainer, scene, animator } = this.renderer;
      animator.levelId = this.currentLevelId;
      const fallbackWidth =
        scene?.scale?.width ?? scene?.scale?.parentSize?.width ?? scene?.sys?.game?.canvas?.width;
      const fallbackHeight =
        scene?.scale?.height ??
        scene?.scale?.parentSize?.height ??
        scene?.sys?.game?.canvas?.height;

      const viewWidth = scene?.scale?.gameSize?.width ?? fallbackWidth;
      const viewHeight = scene?.scale?.gameSize?.height ?? fallbackHeight;

      if (!viewWidth || !viewHeight) {
        return;
      }

      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;

      if (!cols || !rows) {
        return;
      }

      const cellSize = Math.min(viewWidth / cols, viewHeight / rows);
      const boardWidth = cellSize * cols;
      const boardHeight = cellSize * rows;
      const offsetX = (viewWidth - boardWidth) / 2;
      const offsetY = (viewHeight - boardHeight) / 2;

      this.boardSize = cols;
      this.cellSize = cellSize;
      boardContainer.setPosition(offsetX, offsetY);

      if (!animator) {
        return;
      }

      animator.setLayout({ boardCols: cols, boardRows: rows, cellSize });
      this.renderer.input?.setLayout({ boardCols: cols, boardRows: rows, cellSize });
      animator.updateTiles(this.tiles);

      const shouldReset =
        (forceRedraw && !this.animationInProgress) || animator.indexToGemId.length === 0;

      if (shouldReset) {
        animator.reset(this.board, { boardCols: cols, boardRows: rows, cellSize });
      } else if (!this.animationInProgress) {
        animator.syncToBoard(this.board);
      }
    },
    activateBonusGem(index) {
      if (this.animationInProgress || this.inputPaused || this.activeBonusMode) return false;
      return this.resolveSwap(index, index, { activateInPlace: true });
    },
    async resolveSwap(aIndex, bIndex, { activateInPlace = false } = {}) {
      const session = this.sessionVersion;
      if (!this.sessionActive || this.inputPaused || this.levelCleared) {
        return false;
      }

      this.cancelHint(true);
      this.clearBonusPreview(true);

      if (this.animationInProgress) {
        return this.queueSwap(aIndex, bIndex);
      }

      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const animator = this.renderer?.animator;
      const tiles = this.tiles ?? [];
      const tileA = tiles[aIndex];
      const tileB = tiles[bIndex];
      let boardUpdated = false;
      if (!canSwapGem(this.board[aIndex], tileA) || !canSwapGem(this.board[bIndex], tileB)) {
        if (animator && matchEngine.areAdjacent(aIndex, bIndex, cols)) {
          this.animationInProgress = true;
          try {
            await animator.animateInvalidSwap({ aIndex, bIndex });
          } finally {
            if (session === this.sessionVersion) {
              this.animationInProgress = false;
              this.processQueuedInput();
            }
          }
          if (session !== this.sessionVersion) return false;
        }
        if (this.sessionActive) {
          this.scheduleHint();
        }
        return false;
      }

      const evaluation = activateInPlace
        ? matchEngine.evaluateActivation(this.board, cols, rows, aIndex, tiles)
        : matchEngine.evaluateSwap(this.board, cols, rows, aIndex, bIndex, tiles);
      const isAdjacent = matchEngine.areAdjacent(aIndex, bIndex, cols);

      if (!evaluation.matches.length) {
        if (isAdjacent && animator) {
          this.animationInProgress = true;
          try {
            await animator.animateInvalidSwap({ aIndex, bIndex });
          } finally {
            if (session === this.sessionVersion) {
              this.animationInProgress = false;
              this.processQueuedInput();
            }
          }
          if (session !== this.sessionVersion) return false;
        }
        if (this.sessionActive) {
          this.scheduleHint();
        }
        return false;
      }

      animator?.clearQueuedSwapHighlight();
      this.animationInProgress = true;

      try {
        const swapPayload = activateInPlace ? null : (evaluation.swap ?? { aIndex, bIndex });
        if (animator && swapPayload) {
          await animator.animateSwap(swapPayload);
          if (session !== this.sessionVersion) return false;
        }

        const resolution = tileManager.getResolution({
          gemTypes: this.currentBoardLayout?.gemTypes ?? GEM_TYPES,
          board: evaluation.board,
          tiles: this.tiles,
          matches: evaluation.matches,
          cols,
          rows,
          bonusesCreated: evaluation.bonusesCreated,
          bonusIndices: evaluation.bonusIndices,
          pendingBonus: evaluation.pendingBonus,
        });
        if (resolution.steps.length && evaluation.bonusSwap) {
          const activationStep = resolution.steps.find((step) =>
            step.matches.some((match) => match.type === 'bonus-activation'),
          );
          if (activationStep) activationStep.bonusSwap = evaluation.bonusSwap;
        }
        this._applyScoring(resolution.steps);

        this.pendingBoardState = resolution.board;

        if (animator && resolution.steps.length) {
          await animator.playSteps(resolution.steps);
          if (session !== this.sessionVersion) return false;
        }

        this.commitResolution(resolution);

        this.moves += 1;
        boardUpdated = true;
        return true;
      } catch (error) {
        console.error('Error in resolveSwap:', error);
        return false;
      } finally {
        if (session !== this.sessionVersion) return false;
        this.pendingBoardState = null;
        this.animationInProgress = false;
        if (this.sessionActive) {
          this.scheduleHint();
        }
        this.processQueuedInput();
        if (boardUpdated && this.sessionActive && !this.levelCleared) {
          await this.ensurePlayableBoard();
        }
      }
    },
    queueSwap(aIndex, bIndex) {
      if (!this.sessionActive || !this.animationInProgress || this.levelCleared) {
        return false;
      }

      const boardSnapshot = this.pendingBoardState ?? this.board;
      if (!Array.isArray(boardSnapshot) || !boardSnapshot.length) {
        return false;
      }

      if (!Number.isInteger(aIndex) || !Number.isInteger(bIndex)) {
        return false;
      }

      const boardLength = boardSnapshot.length;
      if (aIndex < 0 || bIndex < 0 || aIndex >= boardLength || bIndex >= boardLength) {
        return false;
      }

      const cols = this.boardCols ?? this.boardSize ?? 8;
      if (!matchEngine.areAdjacent(aIndex, bIndex, cols)) {
        return false;
      }

      // Bind input to visible pieces, never the not-yet-shown final cascade board.
      const animator = this.renderer?.animator;
      const gems = [aIndex, bIndex].map((index) => {
        if (animator?.indexToGemId) {
          const id = animator.indexToGemId[index];
          return { index, id, type: animator.gemSprites.get(id)?.__gemType };
        }
        return { index, id: this.board[index]?.id, type: this.board[index]?.type };
      });
      if (gems.some((gem) => !gem.id || !gem.type)) return false;
      this.queuedSwap = { aIndex, bIndex, gems };
      this.renderer?.animator?.showQueuedSwap(aIndex, bIndex);
      return true;
    },
    exitLevel() {
      boardReadiness(this).cancel();
      useCampaignStore().endRun(this.runId);
      useCampaignStore().settlePendingChests();
      this.syncContinuous();
      this.playMode = 'normal';
      this.syncRunClock(false);
      this.sessionVersion += 1;
      this.powerInUse = null;
      this.cancelHint(true);
      if (reshuffleNoticeTimeoutId) {
        clearTimeout(reshuffleNoticeTimeoutId);
        reshuffleNoticeTimeoutId = null;
      }
      this.sessionActive = false;
      this.board = [];
      this.tiles = [];
      this.objectives = [];
      this.oreOrders = [];
      this.score = 0;
      this.maxCascade = 1;
      this.cascadeMultiplier = 1;
      this.animationInProgress = false;
      this.pendingBoardState = null;
      this.queuedSwap = null;
      this.queuedBonus = null;
      this.activeBonusMode = null;
      this.renderer?.animator?.clearQueuedBonusHighlight?.();
      this.clearBonusPreview(true);
      this.totalLayers = 0;
      this.remainingLayers = 0;
      this.totalRelics = 0;
      this.resetRunPresentation();
      this.renderer?.animator?.clearQueuedSwapHighlight?.();
      if (this.renderer?.animator) {
        this.renderer.animator.clear();
      } else if (this.renderer?.boardContainer) {
        this.renderer.boardContainer.removeAll?.(true);
      }
      this.renderer?.input?.reset();
      this.boardVersion += 1;
      this.currentLevelId = null;
    },

    commitResolution(resolution) {
      this.board = resolution.board;
      this.pendingBoardState = null;
      this.boardVersion += 1;
      const layersCleared = resolution.layersCleared ?? 0;
      this.remainingLayers = Math.max(0, this.remainingLayers - layersCleared);
      this.updateObjectives({ layersCleared });
      if (this.renderer?.animator) this.renderer.animator.updateTiles(this.tiles);
      else this.refreshBoardVisuals(true);
      if (this.remainingLayers === 0 && this.sessionActive) this.completeLevel();
    },
    syncContinuous() {
      if (!this.sessionActive || this.playMode !== 'continuous') return;
      useCampaignStore().recordContinuous({
        id: this.currentLevelId,
        runId: this.runId,
        jewels: this.collectedJewels,
        score: this.score,
      });
    },
    completeLevel() {
      if (this.playMode === 'continuous') return;
      if (
        this.levelCleared ||
        !this.sessionActive ||
        this.remainingLayers > 0 ||
        this.remainingRelics > 0 ||
        this.remainingOre > 0
      )
        return;
      this.syncRunClock(false);
      this.remainingBonusGems = this.board.filter((gem) =>
        ['bomb', 'cross', 'rainbow'].includes(gem?.type),
      ).length;
      this.coinReward = miningPayout(
        this.collectedJewels,
        this.remainingBonusGems,
        this.comboCounts,
        this.multiMatchCounts,
        this.currentLevelId,
      );
      this.levelRewards = useCampaignStore().recordVictory({
        chooseRewards: true,
        bonusGems: this.remainingBonusGems,
        comboCounts: this.comboCounts,
        multiMatchCounts: this.multiMatchCounts,
        runId: this.runId,
        jewels: this.collectedJewels,
        elapsedMs: this.playClock.started ? this.elapsedMs : null,
        speedTargetMs: this.speedTargetMs,
        id: this.currentLevelId,
        score: this.score,
        combo: this.maxCascade,
        starTarget: this.starScoreTarget,
        target: this.objectives.find((objective) => objective.type === 'score')?.target ?? 0,
      });
      this.constructionReward = useCampaignStore().lastConstruction;
      this.cancelHint(true);
      if (reshuffleNoticeTimeoutId) {
        clearTimeout(reshuffleNoticeTimeoutId);
        reshuffleNoticeTimeoutId = null;
      }
      this.reshuffleNotice = null;
      this.remainingLayers = 0;
      this.levelCleared = true;
      this.animationInProgress = false;
      this.pendingBoardState = null;
      this.queuedSwap = null;
      this.queuedBonus = null;
      this.activeBonusMode = null;
      this.renderer?.animator?.clearQueuedSwapHighlight?.();
      this.renderer?.input?.reset();
      this.updateObjectives();
    },

    updateObjectives({ reset = false, scoreDelta = 0, layersCleared = 0 } = {}) {
      const layerObjective = this.objectives.find((objective) => objective.type === 'clear-layers');
      const scoreObjective = this.objectives.find((objective) => objective.type === 'score');
      const relicObjective = this.objectives.find(
        (objective) => objective.type === 'collect-relics',
      );
      if (relicObjective) relicObjective.progress = this.totalRelics - this.remainingRelics;

      if (reset) {
        if (layerObjective) {
          layerObjective.progress = layerObjective.target - this.remainingLayers;
        }
        if (scoreObjective) {
          scoreObjective.progress = Math.min(scoreObjective.target, this.score);
        }
        return;
      }

      if (layersCleared && layerObjective) {
        const newProgress = (layerObjective.progress ?? 0) + layersCleared;
        layerObjective.progress = Math.min(layerObjective.target, newProgress);
      } else if (layerObjective) {
        layerObjective.progress = Math.min(
          layerObjective.target,
          layerObjective.target - this.remainingLayers,
        );
      }

      if (scoreObjective && scoreDelta) {
        const newScoreProgress = Math.max(0, (scoreObjective.progress ?? 0) + scoreDelta);
        scoreObjective.progress = Math.min(scoreObjective.target, newScoreProgress);
      }
    },
    _hasPlayableMove() {
      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const board = this.activeBoard;

      if (
        !this.sessionActive ||
        this.levelCleared ||
        !Array.isArray(board) ||
        !board.length ||
        !cols ||
        !rows
      ) {
        return false;
      }

      return (
        board.some(
          (gem, index) =>
            ['bomb', 'cross', 'rainbow'].includes(gem?.type) && canSwapGem(gem, this.tiles[index]),
        ) || !!hintEngine.findBestMove(board, this.tiles ?? [], cols, rows, { first: true })
      );
    },
    _showReshuffleNotice() {
      if (reshuffleNoticeTimeoutId) {
        clearTimeout(reshuffleNoticeTimeoutId);
      }
      this.reshuffleNotice = {
        message: 'No moves left. A free shuffle to keep you going.',
        timestamp: Date.now(),
      };
      reshuffleNoticeTimeoutId = setTimeout(() => {
        this.reshuffleNotice = null;
      }, 2000);
    },
    async ensurePlayableBoard() {
      if (
        this.animationInProgress ||
        !this.sessionActive ||
        this.levelCleared ||
        !this.board.length
      )
        return false;
      if (this._hasPlayableMove()) return false;
      const session = this.sessionVersion;
      this._showReshuffleNotice();
      // These attempts limit random work, not the player's recovery opportunities.
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!(await this.shuffleBoard())) return false;
        if (session !== this.sessionVersion) return false;
        if (this.levelCleared || this._hasPlayableMove()) return true;
        if (this.animationInProgress) return false;
      }
      const repaired = recoverBoard(this.board, this.tiles, this.boardCols, this.boardRows);
      if (repaired) {
        if (!(await this.shuffleBoard({ recoveryBoard: repaired }))) return false;
        return session === this.sessionVersion && (this.levelCleared || this._hasPlayableMove());
      }
      // With no movable gems, another permutation cannot help. A free rescue
      // sweep releases anchors using the normal double-hit resolution rules.
      // Each sweep reduces the remaining anchors; it never consumes inventory.
      if (!this.tiles.some(isAnchored)) return false;
      if (!(await this._activatePower('recovery_sweep', 0))) return false;
      if (session !== this.sessionVersion) return false;
      return this.levelCleared || this._hasPlayableMove();
    },
    _applyScoring(steps) {
      if (!Array.isArray(steps) || !steps.length) {
        this.cascadeMultiplier = 1;
        return 0;
      }

      advanceOreOrders(this.oreOrders, steps);
      let total = 0;
      let deepestCascade = 1;

      steps.forEach((step, index) => {
        this.collectedJewels += step.collectedJewels?.length ?? 0;
        const clearedCount = Array.isArray(step?.cleared) ? step.cleared.length : 0;
        if (!clearedCount) {
          return;
        }
        const cascadeBonus = cascadeTier(step, index);
        total += clearScore(step, index);
        deepestCascade = Math.max(deepestCascade, cascadeBonus);
        if (this.playMode === 'normal') {
          if (cascadeBonus >= 2)
            this.comboCounts[cascadeBonus] = (this.comboCounts[cascadeBonus] ?? 0) + 1;
          const matchCount = simultaneousMatchCount(step);
          if (matchCount >= 2)
            this.multiMatchCounts[matchCount] = (this.multiMatchCounts[matchCount] ?? 0) + 1;
        }
      });

      this.cascadeMultiplier = deepestCascade;
      this.maxCascade = Math.max(this.maxCascade ?? 1, deepestCascade);

      if (total > 0) {
        this.score += total;
        this.updateObjectives({ scoreDelta: total });
      }

      this.syncContinuous();
      return total;
    },
    shuffleBoard({ recoveryBoard = null } = {}) {
      const session = this.sessionVersion;
      if (!this.sessionActive || this.animationInProgress || this.levelCleared) {
        return false;
      }
      this.cancelHint(true);
      const cols = this.boardCols ?? this.boardSize ?? 8;
      const rows = this.boardRows ?? this.boardSize ?? 8;
      const animator = this.renderer?.animator;

      const nextBoard = [...(recoveryBoard ?? this.board)];
      const movable = nextBoard
        .map((gem, index) => (canSwapGem(gem, this.tiles[index]) ? index : -1))
        .filter((index) => index >= 0);
      for (let i = recoveryBoard ? 0 : movable.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const a = movable[i],
          b = movable[j];
        [nextBoard[a], nextBoard[b]] = [nextBoard[b], nextBoard[a]];
      }

      const rescueBonuses = recoveryBoard
        ? nextBoard.flatMap((gem, index) =>
            gem && !this.board.some((old) => old?.id === gem.id)
              ? [{ type: gem.type, index, gem }]
              : [],
          )
        : [];
      this.animationInProgress = true;
      this.pendingBoardState = nextBoard;

      const runAnimation = animator?.animateShuffle
        ? animator
            .animateShuffle(nextBoard, { cols, rows })
            .catch((error) => console.error('Shuffle animation failed:', error))
        : Promise.resolve();

      return runAnimation
        .then(async () => {
          if (session === this.sessionVersion && rescueBonuses.length && animator?.playSteps)
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
        })
        .then(() =>
          session === this.sessionVersion
            ? this._resolveBoardAfterShuffle(nextBoard, { cols, rows, animator })
            : false,
        )
        .finally(() => {
          if (session !== this.sessionVersion) return;
          this.pendingBoardState = null;
          this.animationInProgress = false;
          if (this.sessionActive) {
            this.scheduleHint();
          }
          this.processQueuedInput();
        });
    },
    async _resolveBoardAfterShuffle(nextBoard, { cols, rows, animator }) {
      const session = this.sessionVersion;
      try {
        const matches = matchEngine.findMatches(nextBoard, cols, rows, this.tiles);

        let bonusesCreated = [];
        let bonusIndices = [];

        if (matches.length) {
          const bonuses = detectBonusFromMatches(matches, {});
          bonusesCreated = [];
          bonusIndices = [];
          bonuses.forEach((bonus) => {
            if (typeof bonus.index === 'number') {
              nextBoard[bonus.index] = { ...nextBoard[bonus.index], type: bonus.type };
              bonusesCreated.push(bonus.type);
              bonusIndices.push(bonus.index);
            }
          });
        }

        const resolution = tileManager.getResolution({
          gemTypes: this.currentBoardLayout?.gemTypes ?? GEM_TYPES,
          board: nextBoard,
          tiles: this.tiles,
          matches,
          cols,
          rows,
          bonusesCreated,
          bonusIndices,
        });
        this._applyScoring(resolution.steps);

        this.pendingBoardState = resolution.board;

        if (animator && resolution.steps.length) {
          await animator.playSteps(resolution.steps);
          if (session !== this.sessionVersion) return false;
        }

        this.commitResolution(resolution);
        return true;
      } catch (error) {
        console.error('Error resolving board after shuffle:', error);
        return false;
      }
    },
  },
});

import { markRaw, toRaw } from 'vue';
import { BoardReadiness } from '../../game/phaser/BoardReadiness';
import { BoardAnimator } from '../../game/phaser/BoardAnimator';
import { BoardInput } from '../../game/phaser/BoardInput';
import { afterPaint, performanceMark } from '../../game/PresentationWork';
import { useSettingsStore } from '../settingsStore';

// The Phaser board joins and leaves the logical puzzle session. A recreated
// renderer (context loss, remount) resumes the same session and never replays it.
const readiness = new WeakMap();
export function boardReadiness(store) {
  const owner = toRaw(store.$state);
  if (!readiness.has(owner)) readiness.set(owner, new BoardReadiness());
  return readiness.get(owner);
}

export function requestIntro(store) {
  const session = store.sessionVersion;
  if (store.introTaskSession === session) return;
  store.introTaskSession = session;
  const ready = boardReadiness(store);
  const finalize = () => {
    if (
      session !== store.sessionVersion ||
      !store.sessionActive ||
      store.introFinalized === session
    )
      return;
    store.introFinalized = session;
    store.rendererRecovering = false;
    store.animationInProgress = false;
    store.renderer?.animator?.updateTiles?.(store.tiles);
    performanceMark('board-input-ready');
    store.scheduleHint();
    store.processQueuedInput();
    store.ensurePlayableBoard();
  };
  // The finite headless diagnostic runner has no canvas or renderer lifecycle.
  if (typeof window === 'undefined' && !store.renderer) {
    finalize();
    return;
  }
  if (typeof window === 'undefined' && store.renderer)
    ready.publish(session, store.renderer.animator);
  store.introTask = (async () => {
    let binding;
    while (session === store.sessionVersion && store.sessionActive) {
      binding = await ready.wait(session);
      if (!binding || session !== store.sessionVersion) return;
      if (ready.current(binding, session)) break;
    }
    if (!ready.current(binding, session) || session !== store.sessionVersion) return;
    try {
      await binding.animator.playIntroCascade?.();
    } catch (error) {
      if (session === store.sessionVersion) console.warn('Intro cascade animation failed:', error);
    }
    while (session === store.sessionVersion && store.sessionActive) {
      binding = await ready.wait(session);
      if (!binding) return;
      if (ready.current(binding, session)) {
        finalize();
        return;
      }
    }
  })();
}

export function detachRenderer(store) {
  boardReadiness(store).invalidate();
  store.renderer?.input?.destroy();
  store.renderer?.animator?.destroy();
  store.renderer = null;
}

export function attachRenderer(store, renderer) {
  boardReadiness(store).invalidate();
  store.renderer?.animator?.destroy();
  store.renderer?.input?.destroy();
  const animator = new BoardAnimator({
    scene: renderer.scene,
    boardContainer: renderer.boardContainer,
    backgroundLayer: renderer.backgroundLayer,
    tileLayer: renderer.tileLayer,
    gemLayer: renderer.gemLayer,
    fxLayer: renderer.fxLayer,
    textures: renderer.textures,
    particles: renderer.particles,
    audio: store.audioManager,
    settings: useSettingsStore(),
    onImpact: (effect) => store.showArcadeImpact(effect),
    onBanner: (banner) => store.showArcadeBanner(banner),
    onActivity: renderer.onActivity,
  });
  const input = new BoardInput({
    scene: renderer.scene,
    boardContainer: renderer.boardContainer,
    gameStore: store,
  });
  store.renderer = markRaw({ ...renderer, animator, input });
  store.clearBonusPreview(true);
  if (store.board.length > 0) store.refreshBoardVisuals(true);
  const session = store.sessionVersion;
  const generation = boardReadiness(store).generation;
  const present = () => {
    if (
      !store.sessionActive ||
      session !== store.sessionVersion ||
      generation !== boardReadiness(store).generation
    )
      return;
    performanceMark('first-visible-jewels');
    boardReadiness(store).publish(session, animator);
    if (store.introFinalized === session && store.rendererRecovering) {
      store.rendererRecovering = false;
      store.animationInProgress = false;
      store.scheduleHint();
      store.processQueuedInput();
    }
  };
  if (typeof requestAnimationFrame === 'function') afterPaint(present);
  else present();
}

export function refreshBoardVisuals(store, forceRedraw = false) {
  if (!store.renderer || !store.currentBoardLayout) return;
  const { boardContainer, scene, animator } = store.renderer;
  animator.levelId = store.currentLevelId;
  const scale = scene?.scale;
  const viewWidth =
    scale?.gameSize?.width ??
    scale?.width ??
    scale?.parentSize?.width ??
    scene?.sys?.game?.canvas?.width;
  const viewHeight =
    scale?.gameSize?.height ??
    scale?.height ??
    scale?.parentSize?.height ??
    scene?.sys?.game?.canvas?.height;
  const cols = store.boardCols;
  const rows = store.boardRows;
  if (!viewWidth || !viewHeight || !cols || !rows) return;
  const cellSize = Math.min(viewWidth / cols, viewHeight / rows);
  store.boardSize = cols;
  store.cellSize = cellSize;
  boardContainer.setPosition((viewWidth - cellSize * cols) / 2, (viewHeight - cellSize * rows) / 2);
  if (!animator) return;
  const layout = { boardCols: cols, boardRows: rows, cellSize };
  animator.setLayout(layout);
  store.renderer.input?.setLayout(layout);
  animator.updateTiles(store.tiles);
  if ((forceRedraw && !store.animationInProgress) || animator.indexToGemId.length === 0)
    animator.reset(store.board, layout);
  else if (!store.animationInProgress) animator.syncToBoard(store.board);
}

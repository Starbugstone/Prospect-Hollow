<template>
  <div
    ref="canvasRoot"
    class="board-canvas"
    tabindex="0"
    role="application"
    :aria-label="
      t(
        'Crystal match board. Swipe or tap neighboring gems. Keyboard: arrows to navigate, Enter to select, Shift and arrow to swap, Escape to cancel.',
      )
    "
    @keydown="gameStore.renderer?.input?.handleKey($event)"
    @pointercancel="gameStore.renderer?.input?.reset()"
    :style="{ aspectRatio: `${gameStore.boardCols} / ${gameStore.boardRows}` }"
  ></div>
</template>
<script setup>
import { t } from '../i18n';
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import Phaser from 'phaser';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
import { BoardScene } from '../game/phaser/BoardScene';
import { demote } from '../game/phaser/boardRetention';
import { releaseContextOnDestroy } from '../game/phaser/RendererLifecycle';

const canvasRoot = ref(null);
const gameStore = useGameStore();
const settings = useSettingsStore();
// Phaser owns its mutable object graph. Never put it in a deep reactive ref.
let game;
let disposed = false;
let observer;
let resizeFrame;
let teardownInProgress = false;
const contextLost = (event) => {
  if (teardownInProgress) return;
  event.preventDefault();
  demote('board-context-lost');
  gameStore.rendererRecovering = true;
  gameStore.animationInProgress = true;
  gameStore.detachRenderer();
};
const contextRestored = () => {
  if (!disposed && gameStore.sessionActive) {
    game.scene.stop('BoardScene');
    game.scene.start('BoardScene');
  }
};
watch(
  () => [gameStore.sessionActive, gameStore.sessionVersion],
  ([active]) => {
    if (!game) return;
    gameStore.detachRenderer();
    game.scene.stop('BoardScene');
    if (active) {
      game.loop.wake();
      const scene = game.scene.getScene('BoardScene');
      scene.levelId = gameStore.currentLevelId;
      game.scene.start('BoardScene');
      resize();
    } else {
      game.loop.sleep();
      gameStore.audioManager?.stopAmbientLoop?.();
    }
  },
  { flush: 'post' },
);
const resize = () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (!game || !canvasRoot.value) return;
    const width = Math.floor(canvasRoot.value.clientWidth);
    const height = Math.floor(canvasRoot.value.clientHeight);
    if (!width || !height) return;
    if (game.scale.width !== width || game.scale.height !== height) {
      game.scale.resize(width, height);
      // Defer resizing moving sprites until the current move settles.
      if (!gameStore.animationInProgress) gameStore.refreshBoardVisuals();
    }
  });
};
watch(
  () => gameStore.animationInProgress,
  (busy) => {
    if (!busy) {
      resize();
      gameStore.refreshBoardVisuals();
    }
  },
);
watch(
  () => [settings.reducedMotion, settings.highContrastMode],
  () => {
    gameStore.renderer?.particles?.setReducedMotion(settings.reducedMotion);
    gameStore.renderer?.animator?.drawCells();
    gameStore.renderer?.animator?.syncBonusMotion();
  },
);
// The opaque results/chest screen covers the board. Stop its animation and WebGL
// work so the roulette has the frame budget, then resume for the next puzzle.
watch(
  () => gameStore.levelCleared,
  (cleared) => {
    if (cleared) game?.loop.sleep();
    else game?.loop.wake();
  },
);
onMounted(() => {
  const scene = new BoardScene();
  scene.levelId = gameStore.currentLevelId;
  scene.onReady = (payload) => {
    if (disposed || !gameStore.sessionActive) {
      payload.particles.destroy();
      return;
    }
    gameStore.attachRenderer({ ...payload, game });
    payload.particles.setReducedMotion(settings.reducedMotion);
    payload.scene.events.once('shutdown', () => payload.particles.destroy());
    resize();
    if (gameStore.levelCleared) queueMicrotask(() => game?.loop.sleep());
  };
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: canvasRoot.value,
    transparent: true,
    width: canvasRoot.value.clientWidth,
    height: canvasRoot.value.clientHeight,
    scene,
    banner: false,
    antialias: true,
    pixelArt: false,
    render: { roundPixels: false, powerPreference: 'high-performance' },
    input: { activePointers: 1, touch: true },
  });
  releaseContextOnDestroy(game);
  game.canvas.addEventListener('webglcontextlost', contextLost);
  game.canvas.addEventListener('webglcontextrestored', contextRestored);
  observer = new ResizeObserver(resize);
  observer.observe(canvasRoot.value);
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  cancelAnimationFrame(resizeFrame);
  teardownInProgress = true;
  game?.canvas.removeEventListener('webglcontextlost', contextLost);
  game?.canvas.removeEventListener('webglcontextrestored', contextRestored);
  gameStore.detachRenderer();
  game?.destroy(true);
  // Phaser processes pending destruction on a frame, including from a sleeping victory screen.
  if (game && !game.loop.running) game.loop.wake();
  game = null;
});
</script>

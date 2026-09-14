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
import { releaseContextOnDestroy } from '../game/phaser/RendererLifecycle';

const canvasRoot = ref(null);
const gameStore = useGameStore();
const settings = useSettingsStore();
// Phaser owns its mutable object graph. Never put it in a deep reactive ref.
let game;
let disposed = false;
let observer;
let resizeFrame;
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
  scene.onReady = (payload) => {
    if (disposed || !gameStore.sessionActive) {
      payload.particles.destroy();
      return;
    }
    gameStore.attachRenderer({ ...payload, game });
    payload.particles.setReducedMotion(settings.reducedMotion);
    gameStore.animationInProgress = true;
    const session = gameStore.sessionVersion;
    payload.scene.events.once('shutdown', () => payload.particles.destroy());
    gameStore.renderer.animator.playIntroCascade().finally(() => {
      if (session !== gameStore.sessionVersion) return;
      gameStore.animationInProgress = false;
      gameStore.processQueuedInput();
    });
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
  observer = new ResizeObserver(resize);
  observer.observe(canvasRoot.value);
});
onBeforeUnmount(() => {
  disposed = true;
  observer?.disconnect();
  cancelAnimationFrame(resizeFrame);
  gameStore.renderer?.input?.destroy();
  gameStore.renderer?.animator?.destroy();
  gameStore.renderer = null;
  game?.destroy(true);
  // Phaser processes pending destruction on a frame, including from a sleeping victory screen.
  if (game && !game.loop.running) game.loop.wake();
  game = null;
});
</script>

<template>
  <div id="board-canvas-parking" hidden></div>
  <Teleport defer :to="game.sessionActive ? '#board-canvas-target' : '#board-canvas-parking'">
    <BoardCanvas v-if="game.sessionActive || retained" :key="epoch" />
  </Teleport>
</template>
<script setup>
import { defineAsyncComponent, ref, watch, onBeforeUnmount } from 'vue';
import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { loadBoard } from '../game/phaser/loadBoard';
import { retentionMode } from '../game/phaser/boardRetention';
const BoardCanvas = defineAsyncComponent(loadBoard);
const game = useGameStore();
const retained = ref(false),
  epoch = ref(0);
const stop = useCampaignStore().$onAction(({ name, after }) => {
  if (['resetProgress', 'importSave'].includes(name))
    after(() => {
      retained.value = false;
      epoch.value++;
    });
});
onBeforeUnmount(stop);
watch(
  () => game.sessionActive,
  (active) => {
    retained.value = retentionMode() === 'retain' && (active || retained.value);
  },
  { immediate: true },
);
</script>

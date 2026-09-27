<template>
  <Teleport v-if="game.sessionActive" defer to="#board-canvas-target">
    <BoardCanvas :key="epoch" />
  </Teleport>
</template>
<script setup>
import { defineAsyncComponent, ref, onBeforeUnmount } from 'vue';
import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { loadBoard } from '../game/phaser/loadBoard';
const BoardCanvas = defineAsyncComponent(loadBoard);
const game = useGameStore();
const epoch = ref(0);
const stop = useCampaignStore().$onAction(({ name, after }) => {
  if (['resetProgress', 'importSave'].includes(name))
    after(() => {
      epoch.value++;
    });
});
onBeforeUnmount(stop);
</script>

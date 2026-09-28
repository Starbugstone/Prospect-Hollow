<template>
  <Teleport v-if="game.sessionActive" defer to="#board-canvas-target">
    <BoardCanvas :key="epoch" />
  </Teleport>
</template>
<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { useCampaignStore } from '../stores/campaignStore';
import { useGameStore } from '../stores/gameStore';
import { loadBoard } from '../game/phaser/loadBoard';
import { asyncGameView } from '../services/asyncGameView';
const BoardCanvas = asyncGameView(loadBoard, 'Loading your mine…');
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

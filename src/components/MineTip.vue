<template><GuidanceTip :tip="tip" /></template>
<script setup>
import { computed, watch } from 'vue';
import GuidanceTip from './GuidanceTip.vue';
import { mineTip } from '../data/guidance';
import { useGameStore } from '../stores/gameStore';
import { useCampaignStore } from '../stores/campaignStore';
const game = useGameStore();
const campaign = useCampaignStore();
const tip = computed(() => mineTip(game, campaign));
watch(
  () => game.moves,
  (moves) => {
    if (game.currentLevelId === 1 && moves > 0 && !campaign.seenObstacles.includes('ice')) {
      campaign.markTipSeen('ice');
      campaign.markObstaclesSeen(['ice']);
    }
  },
);
</script>

<template>
  <div v-if="tip" class="guidance-tip" role="status">
    <p>{{ t(tip.text) }}</p>
    <button
      :aria-label="t('Dismiss tip')"
      :title="t('Dismiss tip')"
      @click="campaign.markTipSeen(tip.id)"
    >
      <GameIcon name="close" />
    </button>
  </div>
</template>
<script setup>
import { t } from '../i18n';
import { useCampaignStore } from '../stores/campaignStore';
import GameIcon from './GameIcon.vue';
defineProps({ tip: Object });
const campaign = useCampaignStore();
</script>

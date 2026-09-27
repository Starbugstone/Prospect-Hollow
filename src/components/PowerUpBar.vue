<template>
  <section
    v-if="visiblePowers.length || canWatchShuffle"
    class="powerup-section"
    :aria-label="t('Power-ups')"
  >
    <div class="powerup-bar">
      <button
        v-for="item in visiblePowers"
        :key="item.id"
        :data-power-id="item.id"
        class="powerup-button"
        :class="{ active: activeId === item.id }"
        :disabled="
          !inventory.availableQuantity(item.id) ||
          !game.sessionActive ||
          game.levelCleared ||
          game.inputPaused ||
          (game.animationInProgress && ['shuffle', 'clear-row'].includes(item.id))
        "
        :aria-pressed="activeId === item.id"
        :aria-label="
          t('{value0}, {value1} remaining. {value2}', {
            value0: t(item.label),
            value1: inventory.availableQuantity(item.id),
            value2: t(descriptions[item.id]),
          })
        "
        :title="
          t('{value0}: {value1}', { value0: t(item.label), value1: t(descriptions[item.id]) })
        "
        @click="inventory.usePowerUp(item.id)"
      >
        <span class="powerup-art"
          ><img :src="`/art/powers/${item.id}.svg`" alt="" /><span class="powerup-qty">{{
            inventory.availableQuantity(item.id)
          }}</span></span
        ><span class="powerup-name">{{ t(item.label) }}</span>
      </button>
      <button
        v-if="canWatchShuffle"
        class="powerup-button"
        :disabled="adState.busy"
        @click="watchShuffle"
      >
        <span class="powerup-art"><img src="/art/powers/shuffle.svg" alt="" /></span>
        <span class="powerup-name">{{ t('Watch ad · Shuffle') }}</span>
      </button>
    </div>
    <p v-if="adNotice" role="status">{{ t(adNotice) }}</p>
  </section>
</template>
<script setup>
import { t } from '../i18n';
import { computed, ref } from 'vue';
import { useCampaignStore } from '../stores/campaignStore';
import { useAdvertising } from '../composables/useAdvertising';
import { canRewardShuffle, rewardManualShuffle } from '../services/adGameplay';
import { useGameStore } from '../stores/gameStore';
import { useInventoryStore } from '../stores/inventoryStore';
const inventory = useInventoryStore();
const game = useGameStore();
const campaign = useCampaignStore();
const { ads, adState } = useAdvertising();
const adNotice = ref('');
const canWatchShuffle = computed(() => {
  void adState.value;
  return (
    canRewardShuffle(game, campaign, inventory) && ads.isAvailable('rewarded', 'manual-shuffle')
  );
});
async function watchShuffle() {
  adNotice.value = '';
  if (!(await rewardManualShuffle({ game, campaign, inventory, ads })))
    adNotice.value = 'No ad reward this time. Your board is unchanged.';
}
const activeId = computed(() => game.activeBonusMode?.replaceAll('_', '-'));
const visiblePowers = computed(() =>
  inventory.quickAccessSlots.filter((item) => item.quantity > 0 || activeId.value === item.id),
);
const descriptions = {
  'clear-row': 'Clear a random row.',
  tnt: 'Shatter a 3 by 3 area around the chosen gem.',
  'color-wand': 'Clear every gem of the chosen color.',
  shuffle: 'Mix the board for new possibilities.',
  'tile-breaker': 'Clear a row and column through your chosen gem.',
};
</script>

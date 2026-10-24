<template>
  <section class="moonstone-workshop">
    <h3>{{ t('Moonstone workshop') }}</h3>
    <p>
      {{
        t(
          'Produces {count} moonstones every {runs} completed normal puzzles. Tap the workshop to collect stored moonstones.',
          { count: town.buildings.moonstoneWorkshop, runs: MOONSTONE_ECONOMY.runs },
        )
      }}
    </p>
    <p>
      {{
        t(
          'Continuous play: every {gems} gems advances production by one puzzle, up to {puzzles} puzzles per level for the lifetime of your town. Gems collected while storage is full do not count.',
          {
            gems: MOONSTONE_ECONOMY.continuousGemsPerPuzzle,
            puzzles: MOONSTONE_ECONOMY.continuousPuzzlesPerLevel,
          },
        )
      }}
    </p>
    <p>
      {{
        t('Stored {count} / {capacity}', {
          count: town.moonstoneProduction.stored,
          capacity: moonstoneCapacity(town),
        })
      }}
    </p>
    <p>
      {{
        town.moonstoneProduction.stored >= moonstoneCapacity(town)
          ? t('Storage full. Collect moonstones to resume production.')
          : t('Production: {count}/{total} puzzles', {
              count: town.moonstoneProduction.progress,
              total: MOONSTONE_ECONOMY.runs,
            })
      }}
    </p>
    <button
      v-if="town.moonstoneProduction.stored"
      class="town-primary"
      :disabled="cooldownSeconds > 0"
      @click="$emit('collect')"
    >
      {{ t('Collect {count} moonstones', { count: town.moonstoneProduction.stored }) }}
    </button>
    <p v-if="cooldownSeconds">
      {{
        t('Collect again in {seconds}s. Production and accumulation continue.', {
          seconds: cooldownSeconds,
        })
      }}
    </p>
    <h3>{{ t('Sell moonstones') }}</h3>
    <TownMoonstoneBalance :town="town" />
    <p>
      {{
        t('One moonstone sells for {coins} coins. Selling does not reduce lifetime earnings.', {
          coins: number(MOONSTONE_ECONOMY.saleCoins),
        })
      }}
    </p>
    <div class="moonstone-sell-choices">
      <button
        v-for="amount in [1, 10]"
        :key="amount"
        class="town-primary"
        :disabled="!sellMoonstoneBalance(town, amount)"
        @click="sell(amount)"
      >
        {{ t('Sell {count}', { count: amount }) }} ·
        {{ number(amount * MOONSTONE_ECONOMY.saleCoins) }} <TownIcon name="coin" />
      </button>
      <button
        class="town-primary"
        :disabled="!sellMoonstoneBalance(town, town.moonstones)"
        @click="confirmAmount = town.moonstones"
      >
        {{ t('Sell all') }}
      </button>
    </div>
    <div
      v-if="confirmAmount"
      class="moonstone-sell-confirm"
      role="group"
      :aria-label="t('Confirm sale')"
    >
      <p>
        {{
          t('Sell all {count} moonstones for {coins} coins?', {
            count: number(confirmAmount),
            coins: number(confirmAmount * MOONSTONE_ECONOMY.saleCoins),
          })
        }}
      </p>
      <button
        class="town-primary"
        :disabled="confirmAmount !== town.moonstones"
        @click="sell(confirmAmount)"
      >
        {{ t('Confirm sale') }}
      </button>
      <button class="town-secondary" @click="confirmAmount = 0">{{ t('Cancel') }}</button>
    </div>
    <p v-if="message" role="status">{{ message }}</p>
  </section>
</template>
<script setup>
import { ref } from 'vue';
import { number, t } from '../../i18n';
import { MOONSTONE_ECONOMY, moonstoneCapacity, sellMoonstoneBalance } from '../../data/moonstones';
import TownMoonstoneBalance from './TownMoonstoneBalance.vue';
import TownIcon from './TownIcon.vue';
const props = defineProps({
  town: { type: Object, required: true },
  cooldownSeconds: { type: Number, default: 0 },
  sellMoonstones: { type: Function, required: true },
});
defineEmits(['collect']);
const confirmAmount = ref(0),
  message = ref('');
function sell(amount) {
  const success = props.sellMoonstones(amount);
  confirmAmount.value = 0;
  message.value = success
    ? t('Sold {count} moonstones for {coins} coins.', {
        count: number(amount),
        coins: number(amount * MOONSTONE_ECONOMY.saleCoins),
      })
    : t('Your town changed. Check your moonstones and try again.');
}
</script>
<style scoped>
.moonstone-workshop {
  margin-top: 16px;
  padding: 14px;
  border: 1px solid #b5bfd0;
  border-radius: 12px;
  background: #edf0f8;
}
.moonstone-sell-choices {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.moonstone-sell-choices button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.moonstone-sell-choices svg {
  width: 20px;
  height: 20px;
}
.moonstone-sell-confirm {
  margin-top: 12px;
}
</style>

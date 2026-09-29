<template>
  <div class="coin-reward" :class="{ counting, 'still-coins': settings.reducedMotion }">
    <div class="coin-burst" aria-hidden="true">
      <span
        v-for="i in 14"
        :key="i"
        :style="{
          '--x': `${Math.cos((i / 14) * Math.PI * 2) * (80 + (i % 3) * 24)}px`,
          '--y': `${Math.sin((i / 14) * Math.PI * 2) * 72 - 20}px`,
          '--delay': `${(i % 5) * 65}ms`,
        }"
        >✦</span
      >
    </div>
    <span class="coin-emblem" aria-hidden="true">✦</span>
    <div
      class="coin-total"
      role="status"
      :aria-label="t('{coins} town coins earned', { coins: number(coins) })"
    >
      <strong aria-hidden="true">+{{ number(displayedCoins) }}</strong>
      <span aria-hidden="true">{{ t('TOWN COINS') }}</span>
    </div>
    <details class="coin-details">
      <summary>{{ t('See your coin rewards') }}</summary>
      <div class="coin-breakdown">
        <div>
          <span>{{ t('Gems collected') }}</span
          ><b>{{ number(jewels) }} × 1</b>
        </div>
        <div>
          <span>{{ t('Bonuses left on the board') }}</span
          ><b>{{ bonusGems }} × {{ BONUS_GEM_COINS }}</b>
        </div>
        <template v-for="group in rewardGroups" :key="group.id">
          <template v-if="group.rewards.length">
            <h3 :class="group.headingClass">{{ t(group.heading) }}</h3>
            <div
              v-for="reward in group.rewards"
              :key="`${group.id}-${reward.tier}`"
              :class="group.rowClass"
            >
              <span
                >{{ group.label(reward.tier) }}
                <small>{{
                  t('{count} × {coins} coins', {
                    count: number(reward.count),
                    coins: number(reward.coinsEach),
                  })
                }}</small>
              </span>
              <b>+{{ number(reward.coins) }}</b>
            </div>
          </template>
        </template>
        <div v-if="depthPercent" class="coin-depth-bonus">
          <span>{{ t('Depth bonus · +{percent}%', { percent: depthPercent }) }}</span>
          <b>+{{ number(depthCoins) }}</b>
        </div>
        <div v-if="chestCoins" class="coin-chest-bonus">
          <span>{{ t('Bonus chest coins') }}</span
          ><b>+{{ number(chestCoins) }}</b>
        </div>
      </div>
    </details>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t, number } from '../i18n';
import { depthBonusPercent, miningDepthBonus } from '../data/economy';
import { BONUS_GEM_COINS, miningPayout } from '../game/town/TownRules';
import {
  COMBO_COIN_STEP,
  MULTI_MATCH_COIN_STEP,
  matchRewardBreakdown,
} from '../game/engine/MatchRewards';
import { useSettingsStore } from '../stores/settingsStore';
import { useGameStore } from '../stores/gameStore';
const props = defineProps({
  levelId: { type: Number, default: 1 },
  coins: { type: Number, default: 0 },
  chestCoins: { type: Number, default: 0 },
  jewels: { type: Number, default: 0 },
  bonusGems: { type: Number, default: 0 },
  comboCounts: { type: Object, default: () => ({}) },
  multiMatchCounts: { type: Object, default: () => ({}) },
});
const depthPercent = computed(() => depthBonusPercent(props.levelId));
const depthCoins = computed(() =>
  miningDepthBonus(
    miningPayout(props.jewels, props.bonusGems, props.comboCounts, props.multiMatchCounts),
    props.levelId,
  ),
);
// Cascade tiers and simultaneous lines share one breakdown layout.
const rewardGroups = computed(() => [
  {
    id: 'combo',
    heading: 'COMBO BONUSES',
    rewards: matchRewardBreakdown(props.comboCounts, COMBO_COIN_STEP),
    label: (tier) => t('Combo ×{tier}', { tier: number(tier) }),
  },
  {
    id: 'multi',
    heading: 'SIMULTANEOUS MATCH BONUSES',
    headingClass: 'multi-match-heading',
    rowClass: 'multi-match-reward',
    rewards: matchRewardBreakdown(props.multiMatchCounts, MULTI_MATCH_COIN_STEP),
    label: (tier) => t('{count} lines at once', { count: number(tier) }),
  },
]);
const settings = useSettingsStore(),
  game = useGameStore();
const displayedCoins = ref(settings.reducedMotion ? props.coins : 0),
  counting = ref(false);
let frame,
  startedAt,
  lastCue = -1;
const finish = () => {
  cancelAnimationFrame(frame);
  displayedCoins.value = props.coins;
  counting.value = false;
};
onMounted(() => {
  if (settings.reducedMotion || !props.coins) return finish();
  counting.value = true;
  const tick = (now) => {
    startedAt ??= now;
    const progress = Math.min(1, (now - startedAt) / 1250);
    displayedCoins.value = Math.round(props.coins * (1 - (1 - progress) ** 3));
    const cue = Math.floor(progress * 7);
    if (cue > lastCue) {
      lastCue = cue;
      game.audioManager?.playArcadeCue?.('coin', cue);
    }
    if (progress < 1) frame = requestAnimationFrame(tick);
    else finish();
  };
  frame = requestAnimationFrame(tick);
});
watch(
  () => settings.reducedMotion,
  (value) => {
    if (value) finish();
  },
);
watch(() => props.coins, finish);
onBeforeUnmount(() => cancelAnimationFrame(frame));
</script>
<style scoped>
.coin-reward {
  position: relative;
  isolation: isolate;
  margin: 22px 0 18px;
  padding: 18px 20px 14px;
  border: 1px solid #f8c64a88;
  border-radius: 16px;
  background: radial-gradient(ellipse at 50% 0, #ffc84b33, transparent 70%), #372040;
  box-shadow:
    inset 0 0 24px #ffc84b0c,
    0 4px 28px #0002;
}
.coin-emblem {
  display: inline-grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border: 3px double #ffec9c;
  border-radius: 50%;
  background: #d38b16;
  box-shadow: 0 3px 0 #8c5311;
  color: #fff2b2;
  font-size: 26px;
}
.coin-total strong {
  display: block;
  margin: 8px 0 2px;
  font:
    900 clamp(30px, 9vw, 46px) / 1.1 'Outfit',
    sans-serif;
  font-variant-numeric: tabular-nums;
  color: #ffe996;
  text-shadow:
    0 3px 0 #926022,
    0 0 22px #ffc83a55;
}
.coin-total > span {
  color: #eac77f;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 2px;
}
.coin-breakdown {
  display: grid;
  gap: 6px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid #f8c64a30;
  font-size: 11px;
  color: #e0cedf;
}
.coin-details summary {
  padding-top: 10px;
  font-size: 11px;
  color: #eac77f;
  cursor: pointer;
}
.coin-breakdown > div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  text-align: left;
}
.coin-breakdown b {
  color: #ffdf97;
  white-space: nowrap;
}
.coin-breakdown h3 {
  margin: 6px 0 0;
  padding-top: 10px;
  border-top: 1px solid #f8c64a30;
  color: #ffe19a;
  font-size: 10px;
  letter-spacing: 1px;
  text-align: left;
}
.coin-depth-bonus,
.coin-chest-bonus {
  margin-top: 6px;
  padding-top: 10px;
  border-top: 1px solid #f8c64a30;
  color: #ffe19a;
}
.coin-breakdown small {
  display: block;
  margin-top: 2px;
  color: #cbb7ce;
  font-size: 10px;
}
.coin-breakdown .multi-match-heading,
.multi-match-reward b {
  color: #8bf7ff;
}
.coin-burst {
  position: absolute;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  overflow: hidden;
  border-radius: inherit;
}
.coin-burst > span {
  position: absolute;
  left: calc(50% - 10px);
  top: 44px;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border: 1px solid #ffe8a5;
  border-radius: 50%;
  background: #d99520;
  color: #fff2b2;
  font-size: 14px;
  opacity: 0;
  animation: coin-flight 1100ms var(--delay) cubic-bezier(0.1, 0.7, 0.3, 1) both;
}
.counting .coin-emblem {
  animation: coin-flip 420ms ease-in-out 3;
}
.counting .coin-total strong {
  animation: coin-pulse 300ms ease-in-out 4;
}
@keyframes coin-flight {
  0% {
    transform: translate(0, 0) scale(0.4) rotateY(0);
    opacity: 0;
  }
  18% {
    opacity: 1;
  }
  70% {
    opacity: 0.85;
  }
  100% {
    transform: translate(var(--x), var(--y)) scale(0.8) rotateY(540deg);
    opacity: 0;
  }
}
@keyframes coin-flip {
  50% {
    transform: rotateY(180deg) translateY(-3px);
  }
}
@keyframes coin-pulse {
  50% {
    transform: scale(1.035);
  }
}
.still-coins .coin-burst {
  display: none;
}
.still-coins .coin-emblem,
.still-coins .coin-total strong {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .coin-burst {
    display: none;
  }
  .coin-emblem,
  .coin-total strong {
    animation: none !important;
  }
}
</style>

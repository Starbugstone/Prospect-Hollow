<template>
  <section class="hud-panel" :aria-label="t('Level progress')">
    <div class="score-card">
      <span class="eyebrow"> {{ t('YOUR BRILLIANCE') }} </span>
      <div class="score-value" :key="game.score">
        {{ number(game.score) }}<span> {{ t('pts') }} </span>
      </div>
      <div
        v-if="game.playMode !== 'continuous'"
        class="score-stars"
        :aria-label="t('Chest score progress')"
      >
        <span>✧</span>
        <div class="score-track">
          <i :style="{ width: `${Math.min(100, (game.score / target) * 100)}%` }"></i>
        </div>
        <span>✦</span><small>{{ number(target) }}</small>
      </div>
      <div
        v-if="game.playMode !== 'continuous'"
        class="chest-progress"
        :class="{ qualified: tier }"
      >
        <span>{{ t('A chest when you finish') }}</span>
        <small>{{
          t(tier ? '1 bonus on completion' : 'Take your time. Your reward is waiting.')
        }}</small>
      </div>
    </div>
    <div class="stats-row">
      <div>
        <span class="eyebrow"> {{ t('PLAY TIME') }} </span
        ><strong class="run-time">{{ formatTime(game.elapsedMs) }}</strong
        ><small v-if="game.playMode !== 'continuous'" class="speed-target">{{
          t(
            speedTier
              ? t('≤ {value0} · 1 bonus', { value0: formatTime(game.speedTargetMs) })
              : 'No move limit',
          )
        }}</small>
      </div>
      <div>
        <span class="eyebrow"> {{ t('BEST CASCADE') }} </span
        ><strong class="cascade-value">×{{ game.maxCascade }}</strong>
      </div>
    </div>
    <div class="objective">
      <div class="objective-title">
        <span><GameIcon name="spark" /> {{ t(game.layerLabel) }}</span
        ><strong
          >{{ game.totalLayers - game.remainingLayers
          }}<small> / {{ game.totalLayers }}</small></strong
        >
      </div>
      <div
        class="objective-track"
        role="progressbar"
        :aria-label="t('{value0} layers cleared', { value0: t(game.layerLabel) })"
        :aria-valuenow="game.totalLayers - game.remainingLayers"
        :aria-valuemax="game.totalLayers"
        :aria-valuemin="0"
      >
        <i :style="{ width: `${progress}%` }"></i>
      </div>
      <div v-if="game.totalRelics" class="objective-title relic-objective">
        <span><img src="/art/relic.svg" alt="" /> {{ t('Relics collected') }} </span>
        <strong
          >{{ game.totalRelics - game.remainingRelics
          }}<small> / {{ game.totalRelics }}</small></strong
        >
      </div>
      <div
        v-for="order in game.oreOrders"
        :key="order.color"
        class="objective-title relic-objective"
      >
        <span
          ><img :src="`/art/${order.color}.svg`" alt="" />
          {{ t('Collect {color} ore', { color: t(order.color) }) }}</span
        >
        <strong
          >{{ order.progress }}<small> / {{ order.target }}</small></strong
        >
      </div>
      <p>
        {{
          t(
            game.playMode === 'continuous'
              ? 'The objectives are just a starting point. Keep matching for as long as you like.'
              : game.oreOrders.length
                ? 'Clear the obstacles and fill the ore orders to finish. Take your time; there is no move limit.'
                : 'Clear the obstacles to finish. A reward awaits at your own pace.',
          )
        }}
      </p>
    </div>
  </section>
</template>
<script setup>
import { t, number } from '../i18n';
import { computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import GameIcon from './GameIcon.vue';
import { getChestTier, getSpeedChestTier, formatTime } from '../data/campaign';
const game = useGameStore();
const target = computed(() => game.objectives.find((o) => o.type === 'score')?.target ?? 1);
const tier = computed(() => getChestTier(game.score, target.value));
const speedTier = computed(() =>
  getSpeedChestTier(Math.max(1, game.elapsedMs), game.speedTargetMs),
);
const progress = computed(() =>
  game.totalLayers ? ((game.totalLayers - game.remainingLayers) / game.totalLayers) * 100 : 0,
);
</script>
<style scoped>
.relic-objective {
  margin-top: 14px;
}
.relic-objective img {
  width: 22px;
  height: 22px;
}
</style>

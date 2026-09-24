<template>
  <section class="hud-panel" :aria-label="t('Level progress')">
    <dl class="mine-stats">
      <div>
        <dt>{{ t('Score') }}</dt>
        <dd>{{ number(game.score) }}</dd>
      </div>
      <div>
        <dt>{{ t('Time') }}</dt>
        <dd>{{ formatTime(game.elapsedMs) }}</dd>
      </div>
    </dl>
    <template v-if="game.playMode !== 'continuous'">
      <p>{{ t('A chest when you finish') }}</p>
      <p :class="{ qualified: game.score >= target }">
        {{ t('Score {score} for a bonus chest', { score: number(target) }) }}
        <span v-if="game.score >= target">✓</span>
      </p>
      <p>
        {{ t('Finish within {time} for a bonus chest', { time: formatTime(game.speedTargetMs) }) }}
      </p>
      <p v-if="game.elapsedMs > game.speedTargetMs">
        {{ t('Speed bonus missed. You can still finish and earn your other chests.') }}
      </p>
    </template>
    <p v-else>{{ t('Keep matching after the objectives. No chests or construction steps.') }}</p>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { formatTime } from '../data/campaign';
const game = useGameStore();
const target = computed(() => game.objectives.find((o) => o.type === 'score')?.target ?? 1);
</script>

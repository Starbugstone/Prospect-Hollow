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
      <p>{{ t('Finish for one chest. Meet both the score and time targets for two.') }}</p>
      <p :class="{ qualified: game.score >= target }">
        {{ t('Score target: {score}', { score: number(target) }) }}
        <span v-if="game.score >= target">✓</span>
      </p>
      <p>
        {{ t('Time target: {time}', { time: formatTime(game.speedTargetMs) }) }}
      </p>
      <p v-if="game.elapsedMs > game.speedTargetMs">
        {{ t('Time target missed. You can still finish for one chest.') }}
      </p>
      <StarRatingGuide :target="game.starScoreTarget" />
    </template>
    <p v-else>{{ t('Keep matching after the objectives. No chests or construction steps.') }}</p>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { formatTime } from '../data/campaign';
import StarRatingGuide from './StarRatingGuide.vue';
const game = useGameStore();
const target = computed(() => game.objectives.find((o) => o.type === 'score')?.target ?? 1);
</script>

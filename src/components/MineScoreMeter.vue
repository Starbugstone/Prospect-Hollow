<template>
  <div class="mine-score-meter" :class="{ continuous }">
    <span
      v-if="!continuous"
      class="meter-stars"
      role="img"
      :aria-label="t('{count} stars earned', { count: stars })"
      :title="starHint"
    >
      <GameIcon
        v-for="i in 3"
        :key="i"
        name="star"
        class="meter-star"
        :class="{ earned: i <= stars, popped: i === popped }"
      />
    </span>
    <span class="meter-score" :title="starHint">
      <strong :key="stars" :class="{ bumped: popped }">{{ number(game.score) }}</strong>
      <span v-if="!continuous" class="meter-bar" aria-hidden="true">
        <i :style="{ width: `${fill * 100}%` }"></i>
        <b :style="{ left: `${(goals.score / goals.bonusScore) * 100}%` }"></b>
      </span>
    </span>
    <template v-if="!continuous">
      <span
        class="meter-chest"
        :class="chests[0]?.tier.id"
        role="img"
        :aria-label="chestLabel"
        :title="chestLabel"
      >
        <GameIcon name="chest" /><b v-if="chests.length > 1">×{{ chests.length }}</b>
      </span>
      <span
        v-if="speedLeft > 0"
        class="meter-speed"
        :class="{ closing: speedLeft < 15000 }"
        :title="
          t('Finish within {time} for a bonus chest', { time: formatTime(game.speedTargetMs) })
        "
      >
        <GameIcon name="clock" />{{ formatTime(speedLeft) }}
      </span>
    </template>
  </div>
</template>
<script setup>
import { computed, ref, watch } from 'vue';
import { t, number } from '../i18n';
import { useGameStore } from '../stores/gameStore';
import { formatTime, getStars, runChests } from '../data/campaign';
import { starGoals } from '../data/starRating';
import GameIcon from './GameIcon.vue';

// Live score, stars and chests so players can see bonuses as they earn them.
// Missing the speed chest only hides its countdown; the puzzle never ends on time.
const game = useGameStore();
const continuous = computed(() => game.playMode === 'continuous');
const goals = computed(() => starGoals(game.starScoreTarget));
const stars = computed(() => getStars(game.score, game.starScoreTarget, game.maxCascade));
const fill = computed(() => Math.min(1, game.score / Math.max(1, goals.value.bonusScore)));
const chestTarget = computed(
  () => game.objectives.find((objective) => objective.type === 'score')?.target ?? 0,
);
const chests = computed(() =>
  runChests(game.score, chestTarget.value, Math.max(1, game.elapsedMs), game.speedTargetMs),
);
const speedLeft = computed(() =>
  game.speedTargetMs > 0 ? Math.max(0, game.speedTargetMs - game.elapsedMs) : 0,
);
const starHint = computed(() =>
  stars.value >= 3
    ? t('3 stars earned')
    : t('Next star at {score} points', {
        score: number(stars.value < 2 ? goals.value.score : goals.value.bonusScore),
      }),
);
const chestLabel = computed(
  () =>
    chests.value.map((chest) => t(chest.tier.label)).join(' · ') +
    (chestTarget.value
      ? ` — ${t('Score {score} for a bonus chest', { score: number(chestTarget.value) })}`
      : ''),
);
const popped = ref(0);
let popTimer;
watch(stars, (now, before) => {
  if (now <= before) return;
  popped.value = now;
  clearTimeout(popTimer);
  popTimer = setTimeout(() => (popped.value = 0), 900);
});
</script>
<style scoped>
.mine-score-meter {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin-right: auto;
  color: #fff0ce;
  font:
    800 13px/1 'Trebuchet MS',
    sans-serif;
}
.meter-stars {
  display: flex;
  gap: 1px;
}
.meter-star {
  width: 18px;
  height: 18px;
  color: #8f7fa3;
}
.meter-star.earned {
  color: #ffd66e;
  fill: #ffd66e;
  filter: drop-shadow(0 0 4px #ffcf5a88);
}
.meter-star.popped {
  animation: star-pop 0.9s cubic-bezier(0.2, 1.6, 0.4, 1);
}
.meter-score {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.meter-score strong {
  font-variant-numeric: tabular-nums;
}
.meter-score strong.bumped {
  animation: score-bump 0.6s ease-out;
}
.meter-bar {
  position: relative;
  width: clamp(56px, 16vw, 120px);
  height: 5px;
  border-radius: 3px;
  background: #ffffff26;
}
.meter-bar i {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: linear-gradient(90deg, #c9a24a, #ffd66e);
  transition: width 0.3s ease-out;
}
.meter-bar b {
  position: absolute;
  top: -2px;
  width: 2px;
  height: 9px;
  border-radius: 1px;
  background: #fff0ce;
}
.meter-chest,
.meter-speed {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}
.meter-chest svg,
.meter-speed svg {
  width: 20px;
  height: 20px;
}
.meter-chest {
  color: #9fd4ea;
}
.meter-chest.radiant {
  color: #ffd66e;
}
.meter-chest.celestial {
  color: #d9a8ff;
}
.meter-chest b {
  font-size: 11px;
}
.meter-speed {
  color: #cfe8c6;
  font-variant-numeric: tabular-nums;
}
.meter-speed.closing {
  color: #ffc58a;
}
@keyframes star-pop {
  0% {
    transform: scale(0.4) rotate(-40deg);
  }
  45% {
    transform: scale(1.6) rotate(12deg);
    filter: drop-shadow(0 0 10px #ffe39a);
  }
  100% {
    transform: scale(1);
  }
}
@keyframes score-bump {
  40% {
    color: #ffe39a;
    transform: scale(1.18);
  }
}
@media (max-width: 420px) {
  .mine-score-meter {
    gap: 7px;
  }
  .meter-star {
    width: 15px;
    height: 15px;
  }
  .meter-bar {
    width: 48px;
  }
}
</style>

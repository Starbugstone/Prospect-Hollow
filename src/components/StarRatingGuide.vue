<template>
  <section class="star-rating-guide" :aria-label="t('How to earn stars')">
    <strong>{{ t('How to earn stars') }}</strong>
    <ul>
      <li>{{ t('1 star: Finish the puzzle.') }}</li>
      <li>{{ t('2 stars: Reach {score} points, or a ×{cascade} chain reaction.', values) }}</li>
      <li>
        {{
          t(
            '3 stars: Reach {bonusScore} points (150%), or {score} points with a ×{cascade} chain reaction.',
            values,
          )
        }}
      </li>
    </ul>
    <p>
      {{
        t(
          'A chain reaction is consecutive matches from falling gems after one move. Time and move count do not affect stars.',
        )
      }}
    </p>
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../i18n';
import { starGoals } from '../data/starRating';
const props = defineProps({ target: { type: Number, required: true } });
const values = computed(() => {
  const goals = starGoals(props.target);
  return {
    score: number(goals.score),
    bonusScore: number(goals.bonusScore),
    cascade: goals.cascade,
  };
});
</script>
<style scoped>
.star-rating-guide {
  grid-column: 1 / -1;
  margin-top: 16px;
  text-align: left;
  font-size: 0.875rem;
  line-height: 1.5;
}
.star-rating-guide ul {
  padding-left: 20px;
  margin: 8px 0;
}
.star-rating-guide li + li {
  margin-top: 6px;
}
.star-rating-guide p {
  opacity: 0.85;
}
</style>

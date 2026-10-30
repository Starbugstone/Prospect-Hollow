<template>
  <button
    class="town-project-goal town-commission-goal"
    :class="{ 'is-calling': calling, 'is-inline': inline }"
    :aria-label="label"
    :data-commission-state="status.state"
    @click="$emit('open')"
  >
    <img :src="status.state === 'ready' ? HAMMER : LETTER" alt="" />
    <span>
      <small>{{ heading }}</small>
      <em v-if="status.state === 'request'">{{ t(status.area.label) }}</em>
      <progress v-else :value="status.done" :max="status.total"></progress>
    </span>
    <b v-if="status.state !== 'request'">{{ status.done }}/{{ status.total }}</b>
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { LANDMARK_BY_ID } from '../../data/townLandmarks';
import { t } from '../../i18n';

const LETTER = '/art/rewards/commission-letter.svg',
  HAMMER = '/art/rewards/builder-hammer.svg';
// One entry of commissionStatus(). `inline` sits in the Build sheet rather than on the map.
const props = defineProps({
  status: { type: Object, required: true },
  inline: Boolean,
});
defineEmits(['open']);
const design = computed(() => t(LANDMARK_BY_ID[props.status.choice]?.label ?? ''));
const calling = computed(() => ['request', 'ready'].includes(props.status.state));
const heading = computed(() =>
  props.status.state === 'request'
    ? t('New commission')
    : props.status.state === 'ready'
      ? t('Commission ready · {design}', { design: design.value })
      : t('Commission · {design}', { design: design.value }),
);
const label = computed(() => {
  const { state, area, done, total } = props.status;
  if (state === 'request')
    return t('New commission: {site}. Read the request.', { site: t(area.label) });
  if (state === 'ready')
    return t('Commission {design} is ready to unveil.', { design: design.value });
  return t(
    state === 'work'
      ? 'Commission {design}: {done} of {total} puzzles built.'
      : 'Commission {design}: stage {done} of {total}.',
    { design: design.value, done, total },
  );
});
</script>
<style scoped>
/* The same light pill as the town project beside it, one row lower when both show. */
.town-commission-goal {
  max-width: min(290px, calc(100% - 24px));
  cursor: pointer;
}
.town-project-goal + .town-commission-goal {
  top: calc(max(12px, env(safe-area-inset-top)) + 152px);
}
.town-commission-goal.is-inline {
  position: static;
  width: 100%;
  max-width: none;
  margin-top: 6px;
  box-shadow: none;
}
.town-commission-goal em {
  overflow: hidden;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.is-calling {
  border-color: #d3a63f;
  animation: commission-call 2.4s ease-in-out 3;
}
@keyframes commission-call {
  50% {
    box-shadow: 0 0 0 5px #e8c56b55;
  }
}
@media (prefers-reduced-motion: reduce) {
  .is-calling {
    animation: none;
  }
}
</style>

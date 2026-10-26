<template>
  <dialog
    ref="dialog"
    class="town-cinematic town-presentation"
    :aria-label="t(definition.title)"
    @cancel.prevent="finish"
  >
    <div class="presentation-shade" aria-hidden="true"></div>
    <div class="presentation-caption" aria-live="polite">
      <p class="presentation-kicker">{{ t(definition.title) }}</p>
      <h2>{{ t(chapter.text, names(chapter.params)) }}</h2>
      <button v-if="finished" ref="continueButton" @click="finish">{{ t('Continue') }} →</button>
    </div>
    <button v-if="!finished" ref="skipButton" class="presentation-skip" @click="finish">
      {{ t('Skip cinematic') }}
    </button>
  </dialog>
</template>
<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { t } from '../../i18n';
import { useCinematic } from '../../composables/useCinematic';
const props = defineProps({
  definition: Object,
  reducedMotion: Boolean,
  paused: Boolean,
  ready: Boolean,
});
const emit = defineEmits(['frame', 'complete']);
const skipButton = ref(null),
  continueButton = ref(null);
// Definitions are authored in seconds; the shared clock counts milliseconds.
const { dialog, elapsed, finished, start, complete } = useCinematic({
  duration: () => props.definition.duration * 1000,
  running: () => props.ready && !props.paused,
  maxStep: 250,
  onOpen() {
    if (props.reducedMotion) still();
    else skipButton.value?.focus();
    start();
  },
  onTick: (advanced) => advanced && emit('frame', seconds.value),
  onFinish: () => nextTick(() => continueButton.value?.focus()),
});
const seconds = computed(() => elapsed.value / 1000);
// Caption parameters are catalog names (a monument, its site), shown translated.
const names = (params = {}) =>
  Object.fromEntries(Object.entries(params).map(([key, value]) => [key, t(value)]));
const chapter = computed(() =>
  props.definition.chapters.filter((c) => c.at <= seconds.value).at(-1),
);
function finish() {
  emit('frame', props.definition.duration);
  emit('complete');
}
function still() {
  complete();
  emit('frame', seconds.value);
  nextTick(() => continueButton.value?.focus());
}
watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced) still();
  },
);
watch(
  () => props.ready,
  (ready) => {
    if (ready) emit('frame', seconds.value);
  },
);
</script>
<style scoped>
.town-presentation {
  color: #fff2d4;
}
.presentation-shade {
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-block: 5vh solid #18242a;
  background: linear-gradient(#18242a55, transparent 24%, transparent 63%, #18242aed);
}
.presentation-caption {
  position: absolute;
  bottom: 8vh;
  left: 8%;
  right: 8%;
  text-shadow: 0 2px 5px #18242a;
}
.presentation-kicker {
  text-transform: uppercase;
  letter-spacing: 0.16em;
  font-size: 0.75rem;
}
h2 {
  font:
    500 clamp(1.1rem, 2.6vw, 2rem)/1.3 Georgia,
    serif;
  margin: 0.6rem 0 1rem;
}
button {
  border: 1px solid #eed9a790;
  background: #263738ee;
  color: #fff2d4;
  border-radius: 24px;
  padding: 0.75rem 1.25rem;
  cursor: pointer;
}
button:focus-visible {
  outline: 3px solid #eed9a7;
  outline-offset: 4px;
}
.presentation-skip {
  position: absolute;
  right: 5%;
  top: 7vh;
}
@media (max-width: 600px) {
  .presentation-caption {
    left: 5%;
    right: 5%;
  }
  .presentation-kicker {
    font-size: 0.65rem;
  }
}
</style>

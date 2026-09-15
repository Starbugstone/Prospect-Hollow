<template>
  <dialog
    ref="dialog"
    class="town-presentation"
    :aria-label="t(definition.title)"
    @cancel.prevent="finish"
  >
    <div class="presentation-shade" aria-hidden="true"></div>
    <div class="presentation-caption" aria-live="polite">
      <p class="presentation-kicker">{{ t(definition.title) }}</p>
      <h2>{{ t(chapter.text) }}</h2>
      <button v-if="finished" ref="continueButton" @click="finish">{{ t('Continue') }} →</button>
    </div>
    <button v-if="!finished" ref="skipButton" class="presentation-skip" @click="finish">
      {{ t('Skip cinematic') }}
    </button>
  </dialog>
</template>
<script setup>
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { t } from '../../i18n';
const props = defineProps({
  definition: Object,
  reducedMotion: Boolean,
  paused: Boolean,
  ready: Boolean,
});
const emit = defineEmits(['frame', 'complete']);
const dialog = ref(null),
  skipButton = ref(null),
  continueButton = ref(null),
  elapsed = ref(0);
const finished = computed(() => elapsed.value >= props.definition.duration);
const chapter = computed(() =>
  props.definition.chapters.filter((c) => c.at <= elapsed.value).at(-1),
);
let frame, previous, previousFocus;
function finish() {
  emit('frame', props.definition.duration);
  emit('complete');
}
function still() {
  elapsed.value = props.definition.duration;
  emit('frame', elapsed.value);
  nextTick(() => continueButton.value?.focus());
}
function tick(now) {
  if (
    previous !== undefined &&
    !document.hidden &&
    !props.paused &&
    props.ready &&
    !finished.value
  ) {
    elapsed.value = Math.min(
      props.definition.duration,
      elapsed.value + Math.min(0.25, (now - previous) / 1000),
    );
    emit('frame', elapsed.value);
    if (finished.value) nextTick(() => continueButton.value?.focus());
  }
  previous = now;
  frame = requestAnimationFrame(tick);
}
const visibility = () => {
  previous = undefined;
};
watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced) still();
  },
);
watch(
  () => props.ready,
  (ready) => {
    if (ready) emit('frame', elapsed.value);
  },
);
onMounted(() => {
  previousFocus = document.activeElement;
  dialog.value.showModal();
  document.addEventListener('visibilitychange', visibility);
  if (props.reducedMotion) still();
  else skipButton.value?.focus();
  frame = requestAnimationFrame(tick);
});
onBeforeUnmount(() => {
  cancelAnimationFrame(frame);
  document.removeEventListener('visibilitychange', visibility);
  dialog.value?.close();
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>
<style scoped>
.town-presentation {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  max-width: none;
  max-height: none;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: #fff2d4;
  text-align: center;
  overflow: hidden;
}
.town-presentation::backdrop {
  background: transparent;
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

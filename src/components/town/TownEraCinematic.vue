<template>
  <dialog
    ref="dialog"
    class="era-cinematic"
    :class="{ 'era-still': reducedMotion, 'era-revealed': revealed, 'era-working': chapter === 1 }"
    :aria-label="t('A new era for Prospect Hollow')"
    @cancel.prevent="skip"
  >
    <div class="era-vignette" aria-hidden="true"></div>
    <div class="era-letterbox era-letterbox-top" aria-hidden="true"></div>
    <div class="era-letterbox era-letterbox-bottom" aria-hidden="true"></div>
    <div class="era-dawn" :style="{ opacity: dawn }" aria-hidden="true"></div>
    <div class="era-caption" :key="chapter" aria-live="polite">
      <p class="era-eyebrow">
        {{
          t(
            chapter === 0
              ? 'THE TOWN YOU BUILT'
              : chapter === 1
                ? 'BUILDING THE NEXT CHAPTER'
                : 'THE NEXT CHAPTER',
          )
        }}
      </p>
      <template v-if="chapter === 0">
        <h1>Prospect Hollow</h1>
        <p>{{ t('From the first well to a town full of life.') }}</p>
      </template>
      <template v-else>
        <span class="era-date">{{ era.yearLabel }}</span>
        <h1>{{ t(era.label) }}</h1>
        <p>
          {{
            t(
              chapter === 1
                ? 'Our workers are upgrading the mine for a new era.'
                : (era.finale ?? 'New shores. New neighbors. A future built together.'),
            )
          }}
        </p>
      </template>
      <button v-if="finished" ref="explore" class="era-explore" @click="$emit('complete')">
        {{ t('Explore the new era') }} <span aria-hidden="true">→</span>
      </button>
    </div>
    <button v-if="!finished" ref="skipButton" class="era-skip" @click="skip">
      {{ t('Skip cinematic') }}
    </button>
  </dialog>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n';
import { ERA_BY_ID } from '../../data/eras';
import { ERA_CONSTRUCTION } from '../../data/mineEvolution';
const props = defineProps({
  eraId: String,
  reducedMotion: Boolean,
  ready: Boolean,
  paused: Boolean,
});
const emit = defineEmits(['reveal', 'frame', 'complete', 'sound', 'silence']);
const dialog = ref(null),
  skipButton = ref(null),
  explore = ref(null);
const elapsed = ref(0),
  revealed = ref(false);
const era = computed(() => ERA_BY_ID[props.eraId]);
const duration = ERA_CONSTRUCTION.duration * 1000;
const finished = computed(() => elapsed.value >= duration);
const chapter = computed(() => (elapsed.value < 3000 ? 0 : elapsed.value < 18000 ? 1 : 2));
const dawn = computed(() =>
  props.reducedMotion ? 0 : Math.max(0, 1 - Math.abs(elapsed.value - duration + 4000) / 550) * 0.25,
);
let frame, previous, previousFocus;
const visibilityChanged = () => {
  previous = undefined;
  if (document.hidden) emit('silence');
};
function reveal() {
  if (revealed.value) return;
  revealed.value = true;
  emit('reveal');
  if (!props.reducedMotion) emit('sound', 'era-reveal');
}
function skip() {
  reveal();
  emit('complete');
}
async function still() {
  elapsed.value = duration;
  reveal();
  await nextTick();
  emit('frame', 1);
  explore.value?.focus();
}
function tick(now) {
  if (previous && props.ready && !props.paused && !document.hidden)
    elapsed.value = Math.min(duration, elapsed.value + now - previous);
  previous = now;
  if (elapsed.value >= ERA_CONSTRUCTION.reveal * 1000) reveal();
  if (props.ready && !props.paused) emit('frame', elapsed.value / duration);
  if (!finished.value) frame = requestAnimationFrame(tick);
  else nextTick(() => explore.value?.focus());
}
watch(
  () => props.ready,
  (value) => {
    if (value && props.reducedMotion) still();
  },
);
watch(
  () => props.reducedMotion,
  (value) => {
    if (value) {
      emit('silence');
      cancelAnimationFrame(frame);
      still();
    }
  },
);
onMounted(() => {
  previousFocus = document.activeElement;
  document.addEventListener('visibilitychange', visibilityChanged);
  dialog.value.showModal();
  if (props.reducedMotion) still();
  else {
    skipButton.value?.focus();
    emit('sound', 'era-departure');
    frame = requestAnimationFrame(tick);
  }
});
onBeforeUnmount(() => {
  emit('silence');
  cancelAnimationFrame(frame);
  document.removeEventListener('visibilitychange', visibilityChanged);
  dialog.value?.close();
  if (previousFocus?.isConnected) previousFocus.focus();
});
</script>
<style scoped>
.era-cinematic {
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
  color: #fff5d9;
  overflow: hidden;
  text-align: center;
}
.era-cinematic::backdrop {
  background: transparent;
}
.era-vignette {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 50% 40%, transparent 20%, #172d3555 65%, #14252edb 100%),
    linear-gradient(transparent 45%, #15242cc9);
  pointer-events: none;
}
.era-letterbox {
  position: absolute;
  left: 0;
  right: 0;
  height: 8vh;
  background: #111d25;
  animation: era-bars 1.3s ease-out both;
}
.era-letterbox-top {
  top: 0;
}
.era-letterbox-bottom {
  bottom: 0;
}
.era-dawn {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 60% 30%, #fffef2, #ffe2a5);
  pointer-events: none;
}
.era-caption {
  position: absolute;
  inset: auto 24px 13vh;
  animation: era-title 1.5s ease-out both;
  text-shadow: 0 2px 14px #15242c;
}
.era-working .era-caption {
  bottom: 10vh;
}
.era-working .era-caption h1 {
  font-size: clamp(28px, 3vw, 44px);
  margin: 4px 0 8px;
}
.era-eyebrow {
  font: 600 11px/1.6 sans-serif;
  letter-spacing: 0.35em;
  color: #f7d48b;
  margin: 0 0 10px;
}
.era-caption h1 {
  font:
    500 clamp(32px, 5vw, 76px)/1.08 Georgia,
    serif;
  margin: 8px 0 16px;
}
.era-caption p:not(.era-eyebrow) {
  font:
    400 clamp(14px, 1.6vw, 20px)/1.6 Georgia,
    serif;
  margin: 0 auto;
  max-width: 600px;
}
.era-date {
  font:
    italic 28px/1.2 Georgia,
    serif;
  color: #f7d48b;
}
.era-explore {
  margin-top: 24px;
  padding: 13px 24px;
  border: 1px solid #f3d58a;
  border-radius: 6px;
  color: #253d39;
  background: #fff0c9;
  box-shadow: 0 4px 22px #15242c55;
}
.era-explore span {
  margin-left: 12px;
}
.era-skip {
  position: absolute;
  right: max(24px, env(safe-area-inset-right));
  top: max(24px, env(safe-area-inset-top));
  border: 1px solid #fff5d94d;
  border-radius: 5px;
  padding: 10px 14px;
  background: #14252e99;
  color: #fff5d9;
  font-size: 12px;
}
.era-still .era-letterbox,
.era-still .era-caption {
  animation: none;
}
@keyframes era-bars {
  from {
    height: 0;
  }
}
@keyframes era-title {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
@media (max-width: 600px) {
  .era-caption {
    bottom: 14vh;
    inset-inline: 20px;
  }
  .era-caption h1 {
    font-size: 36px;
  }
  .era-eyebrow {
    font-size: 10px;
    letter-spacing: 0.22em;
  }
}
</style>

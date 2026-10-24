<template>
  <div class="town-coach" :style="{ '--coach-bottom': `${bottom}px` }">
    <span
      v-if="ring"
      class="town-coach-ring"
      :style="{
        left: `${ring.x}px`,
        top: `${ring.y}px`,
        width: `${ring.width}px`,
        height: `${ring.height}px`,
      }"
      aria-hidden="true"
      ><i></i
    ></span>
    <section v-if="!sheetOpen" class="town-coach-bubble" role="status" aria-live="polite">
      <img src="/art/rewards/era-compass.svg" alt="" />
      <p>
        <small>{{ t('Ada · the caretaker') }}</small
        >{{ t(step.text) }}
      </p>
      <span class="town-coach-actions">
        <button
          v-if="step.target.plot && !ring"
          class="town-coach-locate"
          @click="$emit('locate', step.target.plot)"
        >
          {{ t('Show me') }}
        </button>
        <button class="town-coach-skip" @click="$emit('skip')">{{ t('Skip tutorial') }}</button>
      </span>
    </section>
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n';

// The tutorial's pointer: a ring over the one thing to tap next, and Ada's line above
// the tab bar. Plot labels follow the camera, so the ring follows its target each frame.
const props = defineProps({
  step: { type: Object, required: true },
  // The building card that is open, if any; its purchase button becomes the target.
  card: { type: String, default: '' },
  sheetOpen: Boolean,
  bottom: { type: Number, default: 0 },
});
defineEmits(['locate', 'skip']);
const selector = computed(() => {
  const { plot, tab } = props.step.target;
  if (tab) return `.town-tab-${tab}`;
  if (props.card === plot) return '.town-detail-offer .town-purchase:not(:disabled)';
  return props.sheetOpen ? null : `[data-town-plot="${plot}"]`;
});
const ring = ref(null);
let frame = 0;
function follow() {
  const element = selector.value && document.querySelector(selector.value);
  const box = element?.getBoundingClientRect();
  const next =
    box?.width && box.height
      ? {
          x: Math.round(box.left - 6),
          y: Math.round(box.top - 6),
          width: Math.round(box.width + 12),
          height: Math.round(box.height + 12),
        }
      : null;
  if (JSON.stringify(next) !== JSON.stringify(ring.value)) ring.value = next;
  frame = requestAnimationFrame(follow);
}
onMounted(follow);
onBeforeUnmount(() => cancelAnimationFrame(frame));
watch(selector, () => {
  ring.value = null;
});
</script>
<style scoped>
/* Above the full-screen village (90) and its sheets (95), so a card's button can be ringed. */
.town-coach {
  position: fixed;
  inset: 0;
  z-index: 96;
  pointer-events: none;
}
.town-coach-ring {
  position: fixed;
  border: 3px solid #f2c45a;
  border-radius: 14px;
  box-shadow:
    0 0 0 3px #40523dcc,
    0 0 18px #f2c45a;
  animation: town-coach-pulse 1.4s ease-in-out infinite;
}
/* An arrow above the ring points at the target. */
.town-coach-ring i {
  position: absolute;
  left: 50%;
  top: -22px;
  width: 0;
  height: 0;
  margin-left: -9px;
  border: 9px solid transparent;
  border-top: 12px solid #f2c45a;
  filter: drop-shadow(0 2px 0 #40523d);
  animation: town-coach-point 1.4s ease-in-out infinite;
}
.town-coach-bubble {
  position: fixed;
  left: max(10px, calc(50% - 230px));
  right: max(10px, calc(50% - 230px));
  bottom: calc(var(--coach-bottom) + 10px);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  align-items: start;
  padding: 10px 12px;
  border: 1px solid #b79950;
  border-radius: 12px;
  background: #fffbea;
  box-shadow: 0 6px 20px #2c48354d;
  color: #344a3a;
  pointer-events: auto;
}
.town-coach-bubble img {
  width: 34px;
  height: 34px;
  grid-row: span 2;
}
.town-coach-bubble p {
  margin: 0;
  font-size: 14px;
  line-height: 1.4;
}
.town-coach-bubble small {
  display: block;
  margin-bottom: 2px;
  font-size: 11px;
  font-weight: 700;
  color: #7a6a3d;
}
.town-coach-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 8px;
}
.town-coach-locate {
  min-height: 36px;
  padding: 6px 12px;
  border: 1px solid #36583f;
  border-radius: 8px;
  background: #456c50;
  color: #fffbe7;
  font-size: 13px;
  font-weight: 700;
}
.town-coach-skip {
  min-height: 32px;
  padding: 4px 6px;
  border: 0;
  background: none;
  color: #6c7a6b;
  font-size: 12px;
  text-decoration: underline;
}
@keyframes town-coach-pulse {
  50% {
    box-shadow:
      0 0 0 6px #40523d66,
      0 0 26px #f2c45a;
  }
}
@keyframes town-coach-point {
  50% {
    transform: translateY(-5px);
  }
}
.reduced-motion .town-coach-ring,
.reduced-motion .town-coach-ring i {
  animation: none;
}
@media (prefers-reduced-motion: reduce) {
  .town-coach-ring,
  .town-coach-ring i {
    animation: none;
  }
}
</style>

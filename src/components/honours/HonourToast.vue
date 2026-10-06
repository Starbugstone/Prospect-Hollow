<template>
  <!-- The live region stays mounted so each card is announced once, when it appears. -->
  <div
    class="honour-toast-region"
    :class="{ 'honour-toast-still': settings.reducedMotion }"
    :style="{ '--honour-toast-tab': `${tabOffset}px`, '--honour-toast-ms': `${NOTICE_MS}ms` }"
    role="status"
    aria-live="polite"
  >
    <HonourToastCard kind="player" :active="active" @shown="measure" />
    <HonourToastCard kind="town" :active="active" @shown="measure" />
  </div>
</template>
<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useSettingsStore } from '../../stores/settingsStore';
import { NOTICE_MS } from '../../composables/useHonourAnnouncements';
import HonourToastCard from './HonourToastCard.vue';

// The achievement popups: bottom right above the village tab bar, compact cards across
// narrow screens. Player distinctions and town honours each have their own card; when
// both are up, the player card sits above the town card.
defineProps({ active: Boolean });
const settings = useSettingsStore();

// Sit above the village tab bar, which already includes the bottom safe area.
const tabOffset = ref(0);
function measure() {
  const bar = document.querySelector('.town-tab-bar')?.getBoundingClientRect();
  tabOffset.value = bar?.height ? Math.max(0, Math.round(window.innerHeight - bar.top)) : 0;
}
onMounted(() => window.addEventListener('resize', measure));
onBeforeUnmount(() => window.removeEventListener('resize', measure));
</script>
<style>
.honour-toast-region {
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: fixed;
  right: max(20px, calc(env(safe-area-inset-right) + 12px));
  bottom: max(calc(var(--honour-toast-tab, 0px) + 16px), calc(env(safe-area-inset-bottom) + 16px));
  z-index: 120;
  width: 336px;
  max-width: calc(100vw - 24px);
  pointer-events: none;
}
.honour-toast {
  position: relative;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: 76px minmax(0, 1fr);
  gap: 12px;
  align-items: center;
  padding: 14px 16px 16px 12px;
  border: 1px solid #e9c8936b;
  border-radius: 12px;
  overflow: hidden;
  color: #fff6e5;
  font-family: 'Segoe UI', system-ui, sans-serif;
  background:
    radial-gradient(120% 140% at 0% 0%, #3b5443 0%, transparent 55%),
    linear-gradient(135deg, #2c3f33 0%, #223128 55%, #1b251e 100%);
  box-shadow:
    0 18px 44px #10181399,
    0 2px 0 #fff6e512 inset;
  pointer-events: auto;
}
.honour-toast-art {
  position: relative;
  display: grid;
  place-items: center;
  min-height: 68px;
}
.honour-toast-art::before {
  content: '';
  position: absolute;
  inset: -10px;
  background: radial-gradient(circle, #e9c89340 0%, transparent 65%);
  animation: honour-toast-glow 1.4s ease-out 1;
}
.honour-toast-summary .honour-toast-art {
  display: block;
  height: 64px;
}
.honour-toast-summary .honour-toast-art .honour-badge {
  position: absolute;
}
.honour-toast-summary .honour-toast-art .honour-badge:nth-child(1) {
  left: 0;
  top: 12px;
}
.honour-toast-summary .honour-toast-art .honour-badge:nth-child(2) {
  left: 15px;
  top: 0;
  z-index: 1;
}
.honour-toast-summary .honour-toast-art .honour-badge:nth-child(3) {
  left: 30px;
  top: 14px;
  z-index: 2;
}
.honour-toast-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding-right: 22px;
}
.honour-toast-kicker {
  color: #e9c893;
  font-size: 10px;
  font-weight: 700;
  line-height: 1.35;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}
.honour-toast-title {
  display: -webkit-box;
  margin: 3px 0 2px;
  overflow: hidden;
  color: #fff6e5;
  font:
    400 18px/1.22 Georgia,
    serif;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
/* Summaries name a few honours: a smaller title with room for a third line. */
.honour-toast-summary .honour-toast-title {
  font-size: 16px;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}
.honour-toast-line {
  color: #c4cfbd;
  font-size: 12px;
  line-height: 1.4;
}
.honour-toast-promotion {
  margin-top: 2px;
  color: #e9c893;
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
.honour-toast-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 4px -14px 0 0;
}
.honour-toast-difficulty {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border: 1px solid #e9c89366;
  border-radius: 99px;
  color: #e9c893;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
  white-space: nowrap;
}
.honour-toast-difficulty .honour-metal-icon {
  width: 8px;
  height: 8px;
}
.honour-toast-view {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 44px;
  margin: -6px -6px -8px auto;
  padding: 0 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: #f4dcaa;
  font: inherit;
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}
.honour-toast-close {
  position: absolute;
  top: 0;
  right: 0;
  display: grid;
  place-items: center;
  width: 44px;
  height: 44px;
  padding: 0;
  border: 0;
  border-radius: 0 12px 0 10px;
  background: none;
  color: #a9b6a4;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.honour-toast-view:hover,
.honour-toast-close:hover {
  color: #fff6e5;
}
.honour-toast-view:focus-visible,
.honour-toast-close:focus-visible {
  outline: 2px solid #e9c893;
  outline-offset: -2px;
}
.honour-toast-timer {
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: linear-gradient(90deg, #b99549, #e9c893);
  transform-origin: left;
  animation: honour-toast-timer var(--honour-toast-ms, 5s) linear forwards;
}
.honour-toast-paused .honour-toast-timer,
.honour-toast-paused .honour-toast-art::before {
  animation-play-state: paused;
}
.honour-toast-enter-active,
.honour-toast-leave-active {
  transition:
    opacity 0.28s ease,
    transform 0.28s ease;
}
.honour-toast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.honour-toast-leave-to {
  opacity: 0;
}
/* Reduced motion: a plain fade, no slide, glow or timer line. */
.honour-toast-still .honour-toast-enter-from {
  transform: none;
}
.honour-toast-still .honour-toast-art::before {
  animation: none;
}
.honour-toast-still .honour-toast-timer {
  display: none;
}
@keyframes honour-toast-timer {
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
}
@keyframes honour-toast-glow {
  0% {
    opacity: 0;
    transform: scale(0.7);
  }
  45% {
    opacity: 1;
    transform: scale(1.15);
  }
  100% {
    transform: scale(1);
  }
}
@media (max-width: 600px) {
  .honour-toast-region {
    left: max(10px, env(safe-area-inset-left));
    right: max(10px, env(safe-area-inset-right));
    bottom: max(
      calc(var(--honour-toast-tab, 0px) + 10px),
      calc(env(safe-area-inset-bottom) + 10px)
    );
    width: auto;
    max-width: none;
  }
  .honour-toast {
    grid-template-columns: 58px minmax(0, 1fr);
    padding: 10px 12px 12px 10px;
  }
  .honour-toast:not(.honour-toast-summary) .honour-toast-art .honour-badge {
    --honour-badge-size: 52px !important;
  }
  .honour-toast-summary .honour-toast-art {
    transform: scale(0.8);
    transform-origin: left center;
  }
  .honour-toast:not(.honour-toast-summary) .honour-toast-title {
    font-size: 17px;
  }
  .honour-toast-promotion {
    margin-top: 2px;
    color: #e9c893;
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
  }
  .honour-toast-foot {
    margin-top: 2px;
  }
}
/* The player distinction card is night violet, never the town's green, so a player
   reward always reads apart from a town reward. */
.honour-toast-player {
  border-color: #c9b2ff7a;
  background:
    radial-gradient(120% 140% at 0% 0%, #6a4aa6 0%, transparent 55%),
    linear-gradient(135deg, #3d2a6b 0%, #2c1f52 55%, #1f163b 100%);
  box-shadow:
    0 18px 44px #140c2a99,
    0 0 0 1px #b98cff33,
    0 2px 0 #fff6e512 inset;
}
.honour-toast-player .honour-toast-art::before {
  background: radial-gradient(circle, #b98cff59 0%, transparent 65%);
}
.honour-toast-player .honour-toast-kicker {
  color: #dccbff;
}
.honour-toast-player .honour-toast-line {
  color: #d9d0ee;
}
.high-contrast .honour-toast {
  border-color: #e9c893;
}
.high-contrast .honour-toast-line {
  color: #e4ebdf;
}
@media (forced-colors: active) {
  .honour-toast {
    border: 2px solid CanvasText;
  }
}
</style>

<template>
  <div class="honour-track" :class="{ 'honour-track-single': track.single }">
    <ol v-if="!track.single" class="honour-track-steps" :aria-label="t('Ranks')">
      <li
        v-for="step in track.steps"
        :key="step.id"
        :class="[`honour-track-${step.metal}`, { 'is-earned': step.earned }]"
      >
        <HonourMetalIcon :metal="step.metal" :open="!step.earned" />
        <span class="honour-track-metal">{{ step.label }}</span>
        <span class="town-sr-only"> · {{ t(step.earned ? 'Earned' : 'Not yet earned') }}</span>
      </li>
    </ol>
    <span class="honour-track-text" :class="track.single && `honour-track-${track.steps[0].metal}`">
      <HonourMetalIcon v-if="track.single" :metal="track.steps[0].metal" />{{ track.text }}
    </span>
  </div>
</template>
<script setup>
import { t } from '../../i18n';
import HonourMetalIcon from './HonourMetalIcon.vue';
// A family's ranks as a track, filled once earned and named by metal, with a summary
// such as "Silver · 2 of 3". Built by rankTrack in honourDisplay.js.
defineProps({ track: { type: Object, required: true } });
</script>
<style>
.honour-track {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 12px;
}
.honour-track-steps {
  display: flex;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.honour-track-steps li {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 2px;
  min-width: 46px;
  font-size: 9.5px;
  font-weight: 600;
  letter-spacing: 0.4px;
  color: #6b6f60;
}
/* A rule joins each rank to the one before it. */
.honour-track-steps li + li::before {
  content: '';
  position: absolute;
  top: 6px;
  right: calc(50% + 9px);
  width: calc(100% - 18px);
  border-top: 1.5px dotted #b8b4a0;
}
.honour-track-steps li.is-earned + li.is-earned::before {
  border-top-style: solid;
  border-color: #a98d4c;
}
.honour-track-steps .honour-metal-icon {
  width: 13px;
  height: 13px;
}
.honour-track-steps li.is-earned {
  color: #4f4520;
}
.honour-track-bronze {
  --honour-metal: #9a5f2c;
}
.honour-track-silver {
  --honour-metal: #5e7480;
}
.honour-track-gold {
  --honour-metal: #9a7420;
}
.honour-track-diamond {
  --honour-metal: #2f7890;
}
.honour-track-steps li .honour-metal-icon {
  color: var(--honour-metal, #6b6f60);
}
.honour-track-text {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  font-weight: 700;
  color: #5b4b1f;
  font-variant-numeric: tabular-nums;
}
.honour-track-single .honour-track-text .honour-metal-icon {
  width: 11px;
  height: 11px;
  color: var(--honour-metal, #6b6f60);
}
.honour-contrast .honour-track-steps li,
.honour-contrast .honour-track-text {
  color: #253f2f;
}
@media (forced-colors: active) {
  .honour-track-steps li .honour-metal-icon {
    color: CanvasText;
  }
}
</style>

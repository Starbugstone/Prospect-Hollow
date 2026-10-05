<template>
  <svg
    class="honour-metal-icon"
    :class="[`honour-metal-${metal}`, { 'is-open': open }]"
    viewBox="0 0 100 100"
    aria-hidden="true"
    focusable="false"
  >
    <circle v-if="!SHAPES[metal]" cx="50" cy="50" r="42" />
    <polygon v-else :points="SHAPES[metal]" />
  </svg>
</template>
<script setup>
import { outline } from './honourDisplay';
// A metal's outline repeats its badge frame: round bronze, hexagon silver, rosette gold
// and octagon diamond. `open` draws it unfilled, as for a rank not yet earned.
defineProps({ metal: { type: String, default: 'bronze' }, open: Boolean });
const SHAPES = {
  silver: outline(6, 46),
  gold: outline(16, 49, 26),
  diamond: outline(8, 46, 46, -67.5),
};
</script>
<style>
.honour-metal-icon {
  width: 9px;
  height: 9px;
  flex: none;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 8;
  stroke-linejoin: round;
}
.honour-metal-icon.is-open {
  fill: none;
}
</style>

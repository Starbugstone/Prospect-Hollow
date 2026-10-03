<template>
  <span class="honour-kicker" :class="`honour-kicker-${shape}`">
    <svg v-if="shape !== 'medal'" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <circle v-if="shape === 'easy'" cx="50" cy="50" r="42" />
      <polygon v-else :points="shape === 'hard' ? ROSETTE : HEXAGON" />
    </svg>
    {{ text }}
  </span>
</template>
<script setup>
// The difficulty label repeats the badge shape: round, hexagon or rosette.
defineProps({ shape: { type: String, default: 'medium' }, text: { type: String, default: '' } });
const point = (radius, angle) =>
  `${(50 + radius * Math.cos(angle)).toFixed(1)},${(50 + radius * Math.sin(angle)).toFixed(1)}`;
const HEXAGON = Array.from({ length: 6 }, (_, i) =>
  point(46, ((-90 + i * 60) * Math.PI) / 180),
).join(' ');
const ROSETTE = Array.from({ length: 16 }, (_, i) =>
  point(i % 2 ? 26 : 49, ((-90 + i * 22.5) * Math.PI) / 180),
).join(' ');
</script>
<style>
.honour-kicker {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.3px;
  line-height: 1.5;
  text-transform: uppercase;
  color: #6e5a26;
}
.honour-kicker svg {
  width: 9px;
  height: 9px;
  margin-right: 5px;
  vertical-align: -1px;
  fill: currentColor;
}
.honour-kicker-easy {
  color: #85532a;
}
.honour-kicker-medium {
  color: #4b6855;
}
.honour-kicker-hard {
  color: #7a5a14;
}
</style>

<template>
  <span class="honour-kicker" :class="`honour-kicker-${metal}`">
    <HonourMetalIcon :metal="metal" />
    {{ text }}
  </span>
</template>
<script setup>
import HonourMetalIcon from './HonourMetalIcon.vue';
// The difficulty label repeats the rank's metal shape: round, hexagon, rosette, octagon.
defineProps({ metal: { type: String, default: 'bronze' }, text: { type: String, default: '' } });
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
.honour-kicker .honour-metal-icon {
  margin-right: 5px;
  vertical-align: -1px;
}
.honour-kicker-bronze {
  color: #85532a;
}
.honour-kicker-silver {
  color: #4b5f68;
}
.honour-kicker-gold {
  color: #7a5a14;
}
.honour-kicker-diamond {
  color: #2f6577;
}
</style>

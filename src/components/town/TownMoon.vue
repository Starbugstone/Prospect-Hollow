<template>
  <svg class="town-moon" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
    <circle r="11" fill="#e9e5d8" stroke="#b9b29d" stroke-width="0.8" />
    <circle cx="-4" cy="-3.5" r="2.6" fill="#d8d2c0" />
    <circle cx="4.5" cy="3" r="1.9" fill="#d8d2c0" />
    <circle cx="-2" cy="5.5" r="1.3" fill="#d8d2c0" />
    <circle
      v-for="(light, n) in lights"
      :key="n"
      class="town-moon-light"
      :cx="light.x * 10"
      :cy="light.y * 10"
      r="0.95"
      :style="{ animationDelay: `${light.delay}s` }"
    />
  </svg>
</template>
<script setup>
// New Hollow seen from the valley: each gold light is one homestead on the Moon.
defineProps({ lights: { type: Array, default: () => [] } });
</script>

<template>
  <svg class="town-moon" viewBox="-12 -12 24 24" aria-hidden="true" focusable="false">
    <circle r="11" fill="#eeeadc" />
    <!-- A soft shaded side and a few gentle craters. -->
    <path d="M3 -10.6A11 11 0 0 1 3 10.6A14 14 0 0 0 3 -10.6Z" fill="#d6d0bf" opacity="0.7" />
    <circle cx="-4" cy="-3.5" r="2.6" fill="#ddd7c5" />
    <circle cx="4.5" cy="3" r="1.9" fill="#d3cdbb" />
    <circle cx="-2" cy="5.5" r="1.3" fill="#ddd7c5" />
    <circle cx="5" cy="-5" r="1" fill="#ddd7c5" />
    <circle r="11" fill="none" stroke="#c9c2ad" stroke-width="0.6" />
    <circle
      v-for="(light, n) in lights"
      :key="n"
      class="town-moon-light"
      :cx="light.x * 10"
      :cy="light.y * 10"
      :r="lightSize"
      :style="{ animationDelay: `${light.delay}s` }"
    />
  </svg>
</template>
<script setup>
// New Hollow seen from the valley: each gold light is one homestead on the Moon.
defineProps({
  lights: { type: Array, default: () => [] },
  // The small chip shows bold dots; the larger sky Moon uses finer ones.
  lightSize: { type: Number, default: 0.95 },
});
</script>

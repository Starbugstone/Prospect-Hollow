<template>
  <g :transform="`translate(${x} ${y})`">
    <ellipse
      v-if="cozyStyle === 'riverlight'"
      :rx="radius"
      :ry="radius * 0.3"
      :fill="palette.shell"
    />
    <g transform="scale(1 .45)">
      <path
        v-for="n in petals"
        :key="n"
        :transform="`rotate(${(n * 360) / petals})`"
        :d="`M0 0Q${-radius * 0.65} ${-radius * 0.52} 0 ${-radius}Q${radius * 0.65} ${-radius * 0.52} 0 0Z`"
        :fill="n % 3 ? palette.roof : cozyStyle === 'canopy' ? palette.green : palette.glass"
        :stroke="cozyStyle === 'riverlight' ? palette.shell : palette.deep"
        :stroke-width="cozyStyle === 'riverlight' ? 2 : 0.8"
      />
    </g>
    <ellipse cy="-4" :rx="radius * 0.22" :ry="radius * 0.09" :fill="palette.shell" />
  </g>
</template>
<script setup>
defineProps({
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  radius: { type: Number, default: 64 },
  petals: { type: Number, default: 6 },
  palette: Object,
  cozyStyle: String,
});
</script>

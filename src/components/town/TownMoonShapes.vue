<template>
  <template v-for="(shape, n) in shapes" :key="n">
    <rect
      v-if="shape.t === 'rect'"
      :x="shape.x"
      :y="shape.y"
      :width="shape.w"
      :height="shape.h"
      :rx="shape.rx"
      v-bind="paint(shape)"
    />
    <circle
      v-else-if="shape.t === 'circle'"
      :cx="shape.cx"
      :cy="shape.cy"
      :r="shape.r"
      :data-airlock="shape.hatch ? 'exposed' : undefined"
      v-bind="paint(shape)"
    />
    <ellipse
      v-else-if="shape.t === 'ellipse'"
      :cx="shape.cx"
      :cy="shape.cy"
      :rx="shape.rx"
      :ry="shape.ry"
      v-bind="paint(shape)"
    />
    <path v-else :d="shape.d" v-bind="paint(shape)" />
  </template>
</template>
<script setup>
import { MOON_PALETTE as p } from '../../data/futureArchitecture';

// Plain shapes in the Moon palette (moonRisingDrawings.js): rectangles, circles, ellipses
// and paths. A shape names its colours by palette key, so none falls back to black.
defineProps({ shapes: { type: Array, required: true } });
const tint = (key) => (key && key !== 'none' ? p[key] : 'none');
const paint = (shape) => ({
  fill: tint(shape.fill),
  'fill-opacity': shape.fo,
  stroke: shape.stroke ? tint(shape.stroke) : undefined,
  'stroke-width': shape.sw,
});
</script>

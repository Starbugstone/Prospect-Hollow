<template>
  <g
    v-if="gallery"
    :transform="`translate(${x} ${-baseY - gallery.floor})`"
    :data-tower-gallery="kind"
    :data-gallery-finish="gallery.finish"
    :data-gallery-style="styleId"
  >
    <path
      :d="`M${-gallery.radius} 0h${gallery.radius * 2}v${radius * 0.07}h${-gallery.radius * 2}Z`"
      :fill="palette[gallery.roles.edge]"
    />
    <rect
      :x="-gallery.windowRadius"
      :y="-gallery.windowHeight - radius * 0.025"
      :width="gallery.windowRadius * 2"
      :height="gallery.windowHeight"
      :fill="palette.glass"
    />
    <path
      :d="`M${-radius * 1.04} ${-gallery.height}h${radius * 2.08}`"
      :stroke="palette[gallery.roles.edge]"
      :stroke-width="radius * 0.06"
    />
    <g v-for="side in [-1, 1]" :key="side">
      <path
        :d="`M${side * radius * 0.94} ${radius * 0.2}l${side * radius * 0.15} ${-radius * 0.2}`"
        :stroke="palette[gallery.roles.edge]"
        :stroke-width="radius * 0.09"
      />
      <path
        :d="`M${side * radius * 0.92} ${-gallery.height}l${side * Math.cos(gallery.pitch) * gallery.bladeDepth} ${-Math.sin(gallery.pitch) * gallery.bladeDepth}l${-side * gallery.bladeWidth * 0.6} ${-radius * 0.1}l${-side * Math.cos(gallery.pitch) * gallery.bladeDepth} ${Math.sin(gallery.pitch) * gallery.bladeDepth}Z`"
        :fill="palette[gallery.roles.shade]"
        :stroke="palette[gallery.roles.edge]"
        :stroke-width="radius * 0.045"
      />
      <path
        :d="`M${side * radius * 0.92 - side * gallery.bladeWidth * 0.3} ${-gallery.height - gallery.foldRise}l${side * Math.cos(gallery.pitch) * gallery.bladeDepth} ${-Math.sin(gallery.pitch) * gallery.bladeDepth}`"
        :stroke="palette[gallery.roles.edge]"
        :stroke-width="radius * 0.025"
        fill="none"
      />
    </g>
  </g>
</template>

<script setup>
import { computed } from 'vue';
import { towerGallery } from '../../data/towerRefinements';
const props = defineProps({
  kind: String,
  styleId: String,
  palette: Object,
  stages: Object,
  x: { type: Number, default: 0 },
  baseY: { type: Number, default: 0 },
  radius: Number,
  height: Number,
});
const gallery = computed(() =>
  towerGallery(
    { kind: props.kind, style: props.styleId, ...props.stages, drawingScale: 29 },
    { r: props.radius, h: props.height },
  ),
);
</script>

<template>
  <g :data-lunar-choice="site.choice || 'open'">
    <svg
      v-if="site.choice"
      x="-8"
      y="-12"
      width="16"
      height="13"
      viewBox="0 0 160 130"
      overflow="visible"
    >
      <TownLandmarkPreview
        :choice="site.choice"
        :stage="site.stage"
        :scaffold="!!site.work"
        :crest="site.crest"
        map
      />
    </svg>
    <g v-else fill="#e5e8e7" stroke="#657481" stroke-width=".3">
      <ellipse rx="6.4" ry="3.5" fill="#c1c4c5" />
      <ellipse rx="1.8" ry="1" />
      <path d="M-4 1v-3m8 3v-3M-4-2h1M4-2h1" />
    </g>
  </g>
</template>
<script setup>
import TownLandmarkPreview from './TownLandmarkPreview.vue';
defineProps({ site: { type: Object, required: true } });
</script>

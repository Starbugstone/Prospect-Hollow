<template>
  <g data-moon-construction="true" fill="none" stroke="#7d9cac" stroke-width="5">
    <path d="M-100 0v-136h200V0M-100-90h200M-100-44h200M-100 0 100-90M100 0-100-90" />
    <path d="M84 0v-166H16v48" stroke="#efcf79" stroke-width="7" />
    <path d="M-70 0Q0-160 70 0M0 0v-85" stroke="#d9e5e5" stroke-width="4" />
    <path
      v-for="n in progress"
      :key="n"
      :d="`M-65 ${-n * 22}h130`"
      stroke="#d9e5e5"
      stroke-width="14"
    />
    <circle
      v-for="x in [-100, 100]"
      :key="x"
      :cx="x"
      cy="-140"
      r="6"
      fill="#efcf79"
      stroke="none"
    />
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { constructionVisual } from '../../game/town/TownRules';
const props = defineProps({ project: { type: Object, required: true } });
const progress = computed(() => constructionVisual(props.project));
</script>

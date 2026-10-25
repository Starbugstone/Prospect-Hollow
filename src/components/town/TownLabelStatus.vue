<template>
  <small v-if="status?.kind === 'work'" class="construction-count" :title="status.title">
    <GameIcon name="wall" />{{ status.text }}
  </small>
  <small v-else-if="status?.kind === 'need'" class="need-hint">{{ status.text }}</small>
  <span v-else-if="status?.kind === 'empty'" aria-hidden="true">+</span>
  <small v-else-if="status">{{ status.text }}</small>
</template>
<script setup>
import GameIcon from '../GameIcon.vue';

// The status line under a place's name on every settlement map's labels, the valley's
// and the Moon's, from the shared status contract (buildingStatus, monumentStatus): the
// same state reads and looks the same on every map. An empty plot shows a quiet '+'.
defineProps({ status: { type: Object, default: null } });
</script>

<template>
  <button type="button" class="town-map-label">
    <span v-if="collapsed" class="town-map-pin" aria-hidden="true"></span>
    <template v-else>
      <span v-if="quiet" class="quiet-plot-plus" aria-hidden="true">+</span>
      <span class="plot-name">{{ name }}</span>
      <TownLabelStatus :status="status" />
    </template>
  </button>
</template>
<script setup>
import TownLabelStatus from './TownLabelStatus.vue';

// Both maps render the same name and status, with the full wording in their
// accessible label. A map owns placement and chooses which distant labels collapse.
defineProps({
  name: { type: String, required: true },
  status: { type: Object, default: null },
  collapsed: Boolean,
  quiet: Boolean,
});
</script>
<style>
.town-map-label {
  min-width: 0;
}
.town-map-label .plot-name,
.town-map-label small {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.town-map-pin {
  width: 10px;
  height: 10px;
  border: 2px solid #fbf8ea;
  border-radius: 50%;
  background: #345166;
  box-shadow: 0 1px 4px #10162b;
}
</style>

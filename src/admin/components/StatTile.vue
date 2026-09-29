<template>
  <div class="stat-tile">
    <span class="stat-label">{{ label }}</span>
    <strong class="stat-value">{{ typeof value === 'number' ? compact(value) : value }}</strong>
    <span v-if="note" class="stat-note">{{ note }}</span>
  </div>
</template>
<script setup>
import { compact } from '../format';
defineProps({ label: String, value: [Number, String], note: String });
</script>

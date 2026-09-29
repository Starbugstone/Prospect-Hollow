<template>
  <span
    v-if="town.deletedAt"
    class="admin-badge deleted"
    :title="`Deleted ${dateTime(town.deletedAt)}`"
    >Deleted</span
  >
  <span v-else-if="town.isPublic" class="admin-badge shared">Shared</span>
  <span v-else class="admin-badge">Private</span>
</template>
<script setup>
import { dateTime } from '../format';
defineProps({ town: { type: Object, required: true } });
</script>

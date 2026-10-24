<template>
  <span
    v-if="town.syncBlockedAt"
    class="admin-badge blocked"
    :title="`The save protection rejected an upload ${dateTime(town.syncBlockedAt)}; nothing synced since`"
    ><span aria-hidden="true">⚠</span> Sync blocked</span
  >
</template>
<script setup>
import { dateTime } from '../format';
defineProps({ town: { type: Object, required: true } });
</script>

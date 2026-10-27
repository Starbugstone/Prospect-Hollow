<template>
  <span
    v-if="town.syncBlockedAt"
    class="admin-badge blocked"
    :title="`The save protection rejected an upload ${dateTime(town.syncBlockedAt)}; nothing synced since`"
    ><span aria-hidden="true">⚠</span> Sync blocked</span
  >
  <span
    v-if="town.syncReview"
    class="admin-badge review"
    title="Several recent uploads claimed more than the server's replay and were corrected. Worth a look; the town keeps playing normally."
    >Review sync</span
  >
</template>
<script setup>
import { dateTime } from '../format';
defineProps({ town: { type: Object, required: true } });
</script>

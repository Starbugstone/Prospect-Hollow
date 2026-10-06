<template>
  <section>
    <header class="admin-heading"><h1>Activity log</h1></header>
    <p class="admin-muted">
      Every admin sign-in and change. Deleted players appear by ID only. Entries older than the
      retention period are removed by the daily cleanup and whenever this page opens.
    </p>
    <div v-if="log" class="admin-filters">
      <label>
        Keep entries for
        <select :value="log.retentionDays" :disabled="saving" @change="setRetention">
          <option v-for="days in log.retentionChoices" :key="days" :value="days">
            {{ retentionLabel(days) }}
          </option>
        </select>
      </label>
      <ConfirmAction
        label="Purge old entries"
        :title="`Remove entries older than ${retentionLabel(log.retentionDays)}?`"
        message="The purge itself is recorded in the log."
        :run="() => purge(false)"
      />
      <ConfirmAction
        danger
        label="Purge everything"
        title="Remove every activity log entry?"
        message="Use this to clear test activity before going live. Only the record of this purge remains."
        confirm-text="PURGE"
        :run="() => purge(true)"
      />
    </div>
    <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <table v-if="log" class="admin-table">
      <thead>
        <tr>
          <th scope="col">When</th>
          <th scope="col">Admin</th>
          <th scope="col">Action</th>
          <th scope="col">Target</th>
          <th scope="col">Details</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(entry, index) in log.entries" :key="`${entry.at}-${index}`">
          <td :title="dateTime(entry.at)">{{ relativeTime(entry.at) }}</td>
          <td>{{ entry.admin }}</td>
          <td>{{ actionLabel(entry.action) }}</td>
          <td>
            <a v-if="link(entry)" :href="link(entry)">{{ entry.target }}</a>
            <template v-else>{{ entry.target ?? '' }}</template>
          </td>
          <td>{{ entry.detail ?? '' }}</td>
        </tr>
        <tr v-if="!log.entries.length">
          <td colspan="5" class="admin-empty">Nothing yet.</td>
        </tr>
      </tbody>
    </table>
    <Pager v-if="log" v-model:page="page" :next="log.hasNext" />
  </section>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { adminApi } from '../api';
import { actionLabel, dateTime, relativeTime } from '../format';
import Pager from '../components/Pager.vue';
import ConfirmAction from '../components/ConfirmAction.vue';
const log = ref(null),
  page = ref(1),
  error = ref(''),
  notice = ref(''),
  saving = ref(false);
const retentionLabel = (days) =>
  ({ 30: '1 month', 90: '3 months', 180: '6 months', 365: '1 year', 730: '2 years' })[days] ??
  `${days} days`;
async function setRetention(event) {
  saving.value = true;
  error.value = '';
  try {
    const result = await adminApi('PATCH', 'audit/settings', {
      body: { retentionDays: Number(event.target.value) },
    });
    notice.value = `Entries are now kept for ${retentionLabel(result.retentionDays)}.`;
    await load();
  } catch (e) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
async function purge(all) {
  const { purged } = await adminApi('POST', 'audit/purge', { body: { all } });
  notice.value = `${purged} ${purged === 1 ? 'entry' : 'entries'} removed.`;
  page.value = 1;
  await load();
}
// Towns and live players link to their pages; admin names and deleted players do not.
const link = (entry) =>
  entry.action.startsWith('town_')
    ? `#/towns/${entry.target}`
    : ['player_signed_out', 'distinction_granted', 'distinction_removed'].includes(entry.action)
      ? `#/players/${entry.target}`
      : '';
async function load() {
  error.value = '';
  try {
    log.value = await adminApi('GET', 'audit', { query: { page: page.value } });
  } catch (e) {
    error.value = e.message;
  }
}
watch(page, load);
onMounted(load);
</script>

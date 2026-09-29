<template>
  <section>
    <header class="admin-heading"><h1>Activity log</h1></header>
    <p class="admin-muted">Every admin sign-in and change. Deleted players appear by ID only.</p>
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
const log = ref(null),
  page = ref(1),
  error = ref('');
// Towns and live players link to their pages; admin names and deleted players do not.
const link = (entry) =>
  entry.action.startsWith('town_')
    ? `#/towns/${entry.target}`
    : entry.action === 'player_signed_out'
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

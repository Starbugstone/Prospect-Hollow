<template>
  <section>
    <header class="admin-heading">
      <h1>
        Towns <small v-if="result">{{ whole(result.total) }}</small>
      </h1>
    </header>
    <div class="admin-filters">
      <input
        v-model="query.q"
        type="search"
        placeholder="Search town name, owner email or ID"
        aria-label="Search towns"
      />
      <label>
        Show
        <select v-model="query.filter">
          <option value="live">All towns</option>
          <option value="public">Shared towns</option>
          <option value="deleted">Deleted (kept 30 days)</option>
        </select>
      </label>
    </div>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <table v-if="result" class="admin-table">
      <thead>
        <tr>
          <th scope="col">Name</th>
          <th scope="col">Owner</th>
          <th scope="col">Era</th>
          <th scope="col" class="number">Levels</th>
          <th scope="col" class="number">Coins</th>
          <th scope="col">Last save</th>
          <th scope="col">State</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="town in result.towns"
          :key="town.id"
          class="admin-row-link"
          @click="go(`towns/${town.id}`)"
        >
          <td>
            <a :href="`#/towns/${town.id}`" @click.stop>{{ town.name }}</a>
          </td>
          <td>
            <a :href="`#/players/${town.owner.id}`" @click.stop>{{
              shownEmail(town.owner.email)
            }}</a>
          </td>
          <td>{{ eraLabel(town.stats.era) }}</td>
          <td class="number">{{ town.stats.levels }}</td>
          <td class="number">{{ whole(town.stats.coins) }}</td>
          <td :title="dateTime(town.savedAt)">{{ relativeTime(town.savedAt) }}</td>
          <td><TownState :town="town" /></td>
        </tr>
        <tr v-if="!result.towns.length">
          <td colspan="7" class="admin-empty">No towns match.</td>
        </tr>
      </tbody>
    </table>
    <Pager
      v-if="result"
      v-model:page="query.page"
      :total="result.total"
      :page-size="result.pageSize"
    />
  </section>
</template>
<script setup>
import { onMounted, ref, watch } from 'vue';
import { adminApi } from '../api';
import { go, shownEmail, townQuery as query } from '../state';
import { dateTime, relativeTime, whole } from '../format';
import { eraLabel } from '../labels';
import Pager from '../components/Pager.vue';
import TownState from '../components/TownState.vue';
const result = ref(null),
  error = ref('');
let generation = 0,
  timer = 0;
async function load() {
  const current = ++generation;
  error.value = '';
  try {
    const data = await adminApi('GET', 'towns', {
      query: { q: query.q.trim(), filter: query.filter, page: query.page },
    });
    if (current === generation) result.value = data;
  } catch (e) {
    if (current === generation) error.value = e.message;
  }
}
watch(
  () => [query.q, query.filter],
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => (query.page === 1 ? load() : (query.page = 1)), 250);
  },
);
watch(() => query.page, load);
onMounted(load);
</script>

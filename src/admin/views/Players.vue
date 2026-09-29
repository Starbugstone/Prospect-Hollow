<template>
  <section>
    <header class="admin-heading">
      <h1>
        Players <small v-if="result">{{ whole(result.total) }}</small>
      </h1>
    </header>
    <div class="admin-filters">
      <input
        v-model="query.q"
        type="search"
        placeholder="Search email or player ID"
        aria-label="Search players"
      />
      <label>
        Sort
        <select v-model="query.sort">
          <option value="seen">Last seen</option>
          <option value="created">Newest</option>
          <option value="email">Email</option>
        </select>
      </label>
    </div>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <table v-if="result" class="admin-table">
      <thead>
        <tr>
          <th scope="col">Email</th>
          <th scope="col">Last seen</th>
          <th scope="col">Device</th>
          <th scope="col" class="number">Towns</th>
          <th scope="col">Best era</th>
          <th scope="col" class="number">Levels</th>
          <th scope="col" class="number">Sign-ins</th>
          <th scope="col">Joined</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="player in result.players"
          :key="player.id"
          class="admin-row-link"
          @click="go(`players/${player.id}`)"
        >
          <td>
            <a :href="`#/players/${player.id}`" @click.stop>{{ shownEmail(player.email) }}</a>
          </td>
          <td :title="dateTime(player.lastSeenAt)">
            <span v-if="isOnline(player.lastSeenAt)" class="admin-online">Online</span>
            <template v-else>{{ relativeTime(player.lastSeenAt) }}</template>
          </td>
          <td :title="player.agent ?? ''">{{ device(player) }}</td>
          <td class="number">{{ player.towns }}</td>
          <td>{{ eraLabel(player.bestEra) }}</td>
          <td class="number">{{ player.levels }}</td>
          <td class="number">{{ player.signIns }}</td>
          <td :title="dateTime(player.createdAt)">{{ date(player.createdAt) }}</td>
        </tr>
        <tr v-if="!result.players.length">
          <td colspan="8" class="admin-empty">No players match.</td>
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
import { go, playerQuery as query, shownEmail } from '../state';
import { date, dateTime, describeAgent, isOnline, relativeTime, whole } from '../format';
import { eraLabel } from '../labels';
import Pager from '../components/Pager.vue';
const result = ref(null),
  error = ref('');
const device = (player) =>
  player.platform === 'app' ? 'Mobile app' : player.agent ? describeAgent(player.agent) : '—';
let generation = 0,
  timer = 0;
async function load() {
  const current = ++generation;
  error.value = '';
  try {
    const data = await adminApi('GET', 'players', {
      query: { q: query.q.trim(), sort: query.sort, page: query.page },
    });
    if (current === generation) result.value = data;
  } catch (e) {
    if (current === generation) error.value = e.message;
  }
}
watch(
  () => [query.q, query.sort],
  () => {
    clearTimeout(timer);
    timer = setTimeout(() => (query.page === 1 ? load() : (query.page = 1)), 250);
  },
);
watch(() => query.page, load);
onMounted(load);
</script>

<template>
  <section>
    <header class="admin-heading">
      <h1>Overview</h1>
      <button type="button" class="admin-button quiet" :disabled="loading" @click="load">
        {{ loading ? 'Refreshing…' : 'Refresh' }}
      </button>
    </header>
    <p v-if="error" class="admin-error" role="alert">{{ error }}</p>
    <template v-if="stats">
      <div class="stat-row">
        <StatTile
          label="Players"
          :value="players.total"
          :note="`${players.new.week} new in 7 days`"
        />
        <StatTile label="Online now" :value="players.online" note="seen in the last 5 minutes" />
        <StatTile
          label="Active today"
          :value="players.active.day"
          :note="`${players.active.week} in 7 days · ${players.active.month} in 30`"
        />
        <StatTile label="Signed in" :value="players.signedIn" note="accounts with a live session" />
        <StatTile
          label="Towns"
          :value="stats.towns.total"
          :note="`${stats.towns.public} shared · ${stats.towns.deleted} awaiting purge`"
        />
        <StatTile label="Played on (30 days)" :value="platforms" note="web browser · mobile app" />
      </div>
      <div class="chart-grid">
        <BarChart
          title="Daily active players"
          subtitle="Last 30 days (UTC). Recorded from the admin release onward."
          :items="daily('active')"
          unit="players"
          unit-one="player"
          category-name="Day"
          :label-every="7"
        />
        <BarChart
          title="New accounts"
          subtitle="Last 30 days (UTC)"
          :items="daily('signups')"
          unit="accounts"
          unit-one="account"
          category-name="Day"
          :label-every="7"
        />
        <BarChart
          title="Towns by era"
          :items="eras"
          unit="towns"
          unit-one="town"
          category-name="Era"
          horizontal
        />
        <BarChart
          title="Campaign progress"
          subtitle="Towns by completed levels"
          :items="progress"
          unit="towns"
          unit-one="town"
          category-name="Completed levels"
          horizontal
        />
      </div>
    </template>
  </section>
</template>
<script setup>
import { computed, onMounted, ref } from 'vue';
import { adminApi } from '../api';
import { levelBucketSize, levelBuckets, whole } from '../format';
import { eraLabel, LEVEL_COUNT } from '../labels';
import StatTile from '../components/StatTile.vue';
import BarChart from '../components/BarChart.vue';
const stats = ref(null),
  loading = ref(false),
  error = ref('');
const players = computed(() => stats.value.players);
const platforms = computed(
  () => `${whole(players.value.platforms.web ?? 0)} · ${whole(players.value.platforms.app ?? 0)}`,
);
const dayLabel = (seconds) =>
  new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
const daily = (key) =>
  stats.value.daily.map((day) => ({ key: day.day, label: dayLabel(day.day), value: day[key] }));
const eras = computed(() =>
  stats.value.towns.eras.map((entry) => ({
    key: entry.era,
    label: eraLabel(entry.era),
    value: entry.towns,
  })),
);
const progress = computed(() =>
  levelBuckets(stats.value.towns.levels, LEVEL_COUNT, levelBucketSize(LEVEL_COUNT)).map(
    (bucket) => ({
      key: bucket.label,
      label: bucket.label,
      value: bucket.towns,
    }),
  ),
);
async function load() {
  loading.value = true;
  error.value = '';
  try {
    stats.value = await adminApi('GET', 'stats');
  } catch (e) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}
onMounted(load);
</script>

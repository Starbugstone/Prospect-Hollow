<template>
  <section class="visit-presence" :aria-label="t('Your visit')">
    <label v-if="profile && towns.length">
      <span>{{ t('Visiting as') }}</span>
      <select v-model="townId" :disabled="loading">
        <option v-for="town in towns" :key="town.townId" :value="town.townId">
          {{ town.name }}
        </option>
      </select>
    </label>
    <p v-if="loading" role="status">{{ t('Joining the visit…') }}</p>
    <p v-else-if="error" role="status">
      {{ t(error) }} <button @click="initialize">{{ t('Try again') }}</button>
    </p>
    <p v-else-if="ownTown">{{ t('You are viewing your own town.') }}</p>
    <p v-else>{{ t('You appear as {name} while visiting.', { name: visitorLabel(identity) }) }}</p>
    <small v-if="!ownTown && !loading && !error">{{
      t('Your visit is recorded in the mayor’s guestbook.')
    }}</small>
  </section>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { loadVisitorProfile, joinVillage, leaveVillage } from '../../services/visitorApi';
import { createVisitorPresence, visitorBrowserToken } from '../../services/visitorPresence';
import { townStorage, ACCOUNT_KEY } from '../../services/townStorage';
import { cloud } from '../../services/cloudProfile';
import { visitorLabel } from '../../data/liveVisitors';
import { t } from '../../i18n';

const props = defineProps({ villageId: { type: String, required: true } });
const profile = ref(null),
  towns = ref([]),
  townId = ref(null),
  loading = ref(true),
  error = ref('');
const ownTown = computed(() => towns.value.some((town) => town.publicId === props.villageId));
const identity = computed(() => ({
  name: profile.value?.displayName ?? '',
  townName: towns.value.find((town) => town.townId === townId.value)?.name,
}));
const browserToken = visitorBrowserToken();
let presence,
  generation = 0,
  startGeneration = 0,
  disposed = false;
async function start() {
  const current = ++startGeneration;
  await presence?.stop();
  if (current !== startGeneration) return;
  if (disposed || loading.value || ownTown.value) return;
  const id = props.villageId,
    sourceTown = townId.value;
  presence = createVisitorPresence({
    send: (visit) => joinVillage(id, { ...visit, browserToken, townId: sourceTown }),
    leave: (visit) => leaveVillage(id, visit),
    changed(active) {
      if (active) error.value = '';
    },
    failed(problem) {
      error.value = 'Live visit unavailable. You can still look around.';
      if (problem.status === 409) initialize();
    },
  });
  presence.start();
}
async function initialize() {
  const current = ++generation;
  presence?.stop();
  loading.value = true;
  error.value = '';
  try {
    const result = await loadVisitorProfile();
    if (disposed || generation !== current) return;
    profile.value = result.profile;
    towns.value = result.towns ?? [];
    const preferred = result.profile?.visitingTownId || townStorage.active()?.meta.id;
    townId.value =
      (towns.value.find((town) => town.townId === preferred) ?? towns.value[0])?.townId ?? null;
  } catch {
    if (disposed || generation !== current) return;
    error.value = 'Live visit unavailable. You can still look around.';
    return;
  } finally {
    if (!disposed && generation === current) loading.value = false;
  }
  start();
}
const resume = () => presence?.resume();
const leave = () => presence?.suspend();
watch(
  townId,
  () => {
    if (!loading.value) start();
  },
  { flush: 'sync' },
);
const accountChanged = (event) => {
  if (event.key === ACCOUNT_KEY || event.key === null) initialize();
};
watch(() => [props.villageId, cloud.account?.id, cloud.sessionExpired], initialize);
onMounted(() => {
  initialize();
  document.addEventListener('visibilitychange', resume);
  window.addEventListener('pagehide', leave);
  window.addEventListener('pageshow', resume);
  window.addEventListener('online', resume);
  window.addEventListener('storage', accountChanged);
});
onBeforeUnmount(() => {
  disposed = true;
  generation++;
  startGeneration++;
  presence?.stop();
  document.removeEventListener('visibilitychange', resume);
  window.removeEventListener('pagehide', leave);
  window.removeEventListener('pageshow', resume);
  window.removeEventListener('online', resume);
  window.removeEventListener('storage', accountChanged);
});
</script>
<style scoped>
.visit-presence {
  margin: 0.75rem 0;
  padding: 0.8rem 1rem;
  background: #f0e9f1;
  border: 1px solid #dacbdc;
  border-radius: 12px;
  color: #48364d;
}
.visit-presence label {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  font-weight: 600;
}
.visit-presence select {
  min-width: 0;
  max-width: 100%;
  padding: 0.45rem;
  font: inherit;
  border-radius: 7px;
  border: 1px solid #ab95af;
  background: #fffdf8;
  color: inherit;
}
.visit-presence p {
  margin: 0.35rem 0;
  overflow-wrap: anywhere;
}
.visit-presence small {
  display: block;
  line-height: 1.45;
}
.visit-presence button {
  font: inherit;
  color: inherit;
}
</style>

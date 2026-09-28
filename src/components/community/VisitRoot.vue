<template>
  <main class="visit-page">
    <header class="visit-heading">
      <h1>{{ t('Village visit') }}</h1>
      <a :href="HOME_PATH">{{ t('Play Prospect Hollow') }}</a>
    </header>
    <section class="visit-content">
      <p v-if="loading" role="status">{{ t('Loading villages…') }}</p>
      <VillageVisit v-else-if="village" :village="village" />
      <p v-else role="alert">{{ t(problem) }}</p>
    </section>
  </main>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { publicVillage } from '../../services/cloudProfile';
import { HOME_PATH, visitId } from '../../services/appRoute';
import { t } from '../../i18n';
import VillageVisit from './VillageVisit.vue';
// The share address only renders the public appearance, with or without an account.
// It never activates, syncs or claims a town, so a visitor cannot reach the owner's game.
const id = ref(visitId()),
  village = ref(null),
  loading = ref(false),
  error = ref('');
const problem = computed(() => (id.value ? error.value : 'This share link is incomplete.'));
let generation = 0;
async function load() {
  const current = ++generation;
  village.value = null;
  error.value = '';
  if (!id.value) return;
  loading.value = true;
  try {
    const result = await publicVillage(id.value);
    if (current === generation) village.value = result;
  } catch (e) {
    if (current === generation)
      error.value = e.status === 404 ? 'This town is no longer shared.' : e.message;
  } finally {
    if (current === generation) loading.value = false;
  }
}
const readLink = () => {
  id.value = visitId();
};
watch(id, load);
watch(
  () => village.value?.name,
  (name) => {
    document.title = name ? `${name} · Prospect Hollow` : 'Prospect Hollow';
  },
);
onMounted(() => {
  window.addEventListener('hashchange', readLink);
  load();
});
onBeforeUnmount(() => {
  generation++;
  window.removeEventListener('hashchange', readLink);
});
</script>
<style>
.visit-page {
  min-height: 100dvh;
  background: #fbf8ef;
  color: #294139;
  font-family: system-ui, sans-serif;
}
.visit-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: #183832;
  color: #fff7df;
}
.visit-heading h1 {
  margin: 0;
  font:
    1.65rem Georgia,
    serif;
}
.visit-heading a {
  display: inline-block;
  color: inherit;
  border: 1px solid currentColor;
  border-radius: 9px;
  padding: 0.55rem 0.85rem;
  text-decoration: none;
}
.visit-content {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}
.visit-content h2 {
  margin: 0.5rem 0 0.35rem;
  font:
    1.8rem Georgia,
    serif;
  overflow-wrap: anywhere;
}
@media (max-width: 600px) {
  .visit-heading,
  .visit-content {
    padding: 1rem;
  }
  .visit-heading h1 {
    font-size: 1.3rem;
  }
}
</style>

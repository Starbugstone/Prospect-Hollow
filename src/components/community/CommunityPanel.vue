<template>
  <dialog
    ref="dialog"
    class="community-dialog"
    :aria-label="t('Shared towns')"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <header class="community-heading">
      <h1>{{ t(village ? 'Village visit' : 'Shared towns') }}</h1>
      <button ref="closeButton" :aria-label="t('Close town visits')" @click="$emit('close')">
        ×
      </button>
    </header>
    <div class="community-content">
      <p v-if="error" role="alert">{{ error }}</p>
      <p v-if="loading" role="status">{{ t('Loading villages…') }}</p>
      <template v-if="village">
        <button
          @click="
            village = null;
            load(page);
          "
        >
          {{ t('Back to shared towns') }}
        </button>
        <VillageVisit :village="village" />
      </template>
      <template v-else>
        <p>{{ t('Explore the villages our players have chosen to share.') }}</p>
        <ul class="community-list">
          <li v-for="entry in entries" :key="entry.villageId">
            <strong>{{ entry.name }}</strong
            ><span>{{ t(ERA_BY_ID[entry.era]?.label ?? entry.era) }}</span
            ><button :disabled="loading" @click="visit(entry.villageId)">
              {{ t('Visit village') }}
            </button>
          </li>
        </ul>
        <p v-if="!entries.length && !loading">
          {{ t('No villages here yet. Be the first to share yours!') }}
        </p>
        <nav class="community-pages">
          <button :disabled="page === 1 || loading" @click="load(page - 1)">
            {{ t('Previous') }}</button
          ><span>{{ t('Page {page}', { page }) }}</span
          ><button :disabled="!hasNext || loading" @click="load(page + 1)">{{ t('Next') }}</button>
        </nav>
      </template>
    </div>
  </dialog>
</template>
<script setup>
import { ref, onBeforeUnmount } from 'vue';
import { publicVillage, request } from '../../services/cloudProfile';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
import VillageVisit from './VillageVisit.vue';
const emit = defineEmits(['close']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const entries = ref([]),
  page = ref(1),
  hasNext = ref(false),
  loading = ref(false),
  error = ref(''),
  village = ref(null);
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
async function load(next) {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await request(`villages?page=${next}`);
    if (current === generation) {
      entries.value = result.entries;
      page.value = result.page;
      hasNext.value = result.hasNext;
    }
  } catch (e) {
    if (current === generation) error.value = e.message;
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function visit(id) {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await publicVillage(id);
    if (current === generation) village.value = result;
  } catch (e) {
    if (current === generation) error.value = e.message;
  } finally {
    if (current === generation) loading.value = false;
  }
}
load(1);
</script>
<style>
.community-dialog {
  width: min(1100px, calc(100vw - 24px));
  max-height: 94dvh;
  padding: 0;
  border: 1px solid #ded5bd;
  border-radius: 20px;
  background: #fbf8ef;
  color: #294139;
  box-shadow: 0 24px 100px #10292380;
  overflow: auto;
  font-family: system-ui, sans-serif;
}
.community-dialog::backdrop {
  background: #102923bb;
}
.community-heading {
  position: sticky;
  top: 0;
  z-index: 4;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #183832;
  color: #fff7df;
}
.community-heading h1 {
  margin: 0;
  font:
    1.65rem Georgia,
    serif;
}
.community-dialog button {
  font: inherit;
  cursor: pointer;
  border: 1px solid #c4bea9;
  background: #fff6dc;
  color: #294139;
  border-radius: 9px;
  padding: 0.65rem 0.9rem;
}
.community-dialog button:disabled {
  opacity: 0.5;
  cursor: default;
}
.community-heading button {
  font-size: 1.4rem;
  line-height: 1;
}
.community-content {
  padding: 1.5rem;
}
.community-list {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
}
.community-list li {
  display: flex;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #e3dbc7;
}
.community-pages {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-top: 1rem;
}
@media (max-width: 600px) {
  .community-content {
    padding: 1rem;
  }
  .community-heading {
    padding: 1rem;
  }
  .community-list li {
    gap: 0.6rem;
    padding: 0.85rem 0.25rem;
    flex-wrap: wrap;
  }
  .community-list li > button {
    margin-left: 2.6rem;
  }
}
</style>

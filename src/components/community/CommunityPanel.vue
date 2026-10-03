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
      <template v-if="village">
        <button class="community-back" @click="back">
          <GameIcon name="back" />{{ t('Back to shared towns') }}
        </button>
        <VillageVisit :village="village" />
      </template>
      <template v-else>
        <p class="community-intro">
          {{
            t('Towns drawn at random from those players share. Recently played towns come first.')
          }}
        </p>
        <p v-if="loading && !draw" role="status">{{ t('Loading villages…') }}</p>
        <ul v-if="draw?.entries.length" class="community-towns" :aria-busy="loading">
          <li v-for="entry in draw.entries" :key="entry.villageId">
            <VillageCard
              :entry="entry"
              :visited="visited.has(entry.villageId)"
              :disabled="loading"
              @click="visit(entry.villageId)"
            />
          </li>
        </ul>
        <p v-else-if="draw && !loading">
          {{ t('No villages here yet. Be the first to share yours!') }}
        </p>
        <footer v-if="draw?.entries.length" class="community-draw">
          <p v-if="wholeDeck(draw)">{{ t('That is every shared town for now.') }}</p>
          <button
            v-else
            class="community-draw-button"
            :disabled="loading"
            @click="load(nextDraw(draw))"
          >
            <GameIcon name="shuffle" />{{ t(loading ? 'Loading villages…' : 'Show other towns') }}
          </button>
        </footer>
      </template>
    </div>
  </dialog>
</template>
<script setup>
import { ref, onBeforeUnmount, nextTick, shallowRef, reactive } from 'vue';
import { publicVillage } from '../../services/cloudProfile';
import { drawVillages, nextDraw, sameDraw, wholeDeck } from '../../services/villageDeck';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';
import VillageCard from './VillageCard.vue';
import VillageVisit from './VillageVisit.vue';
const emit = defineEmits(['close']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
// With many players a full list would always open on the same towns, so the panel shows one
// random draw of up to seven and a button that deals the next seven from the same deck.
const draw = shallowRef(null),
  loading = ref(false),
  error = ref(''),
  village = ref(null),
  visited = reactive(new Set());
let generation = 0;
onBeforeUnmount(() => {
  generation++;
});
async function load(query) {
  const current = ++generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await drawVillages(query);
    if (current !== generation) return;
    // Towns unshared since the last draw can leave a later page empty: start a new deck.
    if (!result.entries.length && result.page > 1) return load(nextDraw(null));
    draw.value = result;
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
    if (current !== generation) return;
    village.value = result;
    visited.add(id);
    dialog.value.scrollTop = 0;
  } catch (e) {
    if (current === generation) error.value = e.message;
  } finally {
    if (current === generation) loading.value = false;
  }
}
async function back() {
  village.value = null;
  error.value = '';
  await nextTick();
  dialog.value.scrollTop = 0;
  load(sameDraw(draw.value));
}
load(nextDraw(null));
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
.community-intro {
  margin: 0 0 1rem;
  color: #4d6259;
}
.community-back,
.community-draw-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.community-towns {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  margin: 0;
}
.community-towns[aria-busy='true'] {
  opacity: 0.55;
}
.community-dialog .village-card {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  height: 100%;
  padding: 0.75rem;
  border: 1px solid #e3dbc7;
  border-radius: 16px;
  background: #fffdf6;
  text-align: left;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.community-dialog .village-card:not(:disabled):hover,
.community-dialog .village-card:focus-visible {
  border-color: #315940;
  box-shadow: 0 0 0 1px #315940;
}
.village-card-art {
  display: grid;
  place-items: center;
  width: 3.5rem;
  height: 3.5rem;
  flex-shrink: 0;
  border-radius: 12px;
  color: #183832;
  background:
    radial-gradient(ellipse 70% 45% at 25% 100%, hsl(var(--slot-hue) 28% 58%) 98%, transparent),
    linear-gradient(170deg, hsl(calc(var(--slot-hue) + 10) 45% 90%), hsl(var(--slot-hue) 35% 76%));
}
.village-card-art svg {
  width: 1.7rem;
  height: 1.7rem;
}
.village-card-info {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
  flex: 1;
}
.village-card-info strong {
  font-size: 1.05rem;
  overflow-wrap: anywhere;
}
.village-card-info small {
  color: #5b6d65;
}
.village-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.2rem;
}
.village-card-tags > span {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.5rem 0.1rem 0.35rem;
  max-width: 100%;
  border-radius: 999px;
  background: #ece6d4;
  font-size: 0.78rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.village-card-tags svg {
  width: 0.95rem;
  height: 0.95rem;
}
.village-card-tags .is-live {
  background: #dcefe1;
  color: #1f5135;
}
.village-card-tags .is-saloon {
  background: #f8e3b5;
  color: #6b4511;
}
.village-card-tags .is-visited {
  background: transparent;
  color: #5b6d65;
}
.village-card-go {
  color: #315940;
}
.community-draw {
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: center;
  margin: 0 -1.5rem -1.5rem;
  padding: 1rem 1.5rem 1.25rem;
  background: linear-gradient(#fbf8ef00, #fbf8ef 35%);
}
.community-draw p {
  margin: 0;
  color: #5b6d65;
}
.community-dialog .community-draw-button {
  border-color: #183832;
  background: #183832;
  color: #fff7df;
  font-weight: 600;
  box-shadow: 0 6px 18px #18383233;
}
@media (max-width: 600px) {
  .community-content {
    padding: 1rem;
  }
  .community-heading {
    padding: 1rem;
  }
  .community-draw {
    margin: 0 -1rem -1rem;
    padding: 1rem;
  }
  .community-draw-button {
    width: 100%;
    justify-content: center;
  }
  /* The whole card is the button, so phones give its arrow's room to the town details. */
  .community-dialog .village-card {
    gap: 0.7rem;
    padding: 0.7rem;
  }
  .village-card-art {
    width: 2.75rem;
    height: 2.75rem;
  }
  .village-card-go {
    display: none;
  }
}
</style>

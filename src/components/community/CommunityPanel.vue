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
      <p v-if="error" class="community-error" role="alert">{{ t(error) }}</p>
      <template v-if="village">
        <div class="community-visit-bar">
          <button class="community-back" @click="back">
            <GameIcon name="back" />{{ t('Back to shared towns') }}
          </button>
          <button
            class="community-star"
            :aria-pressed="favouriteIds.has(visiting.villageId)"
            :disabled="pendingStars.has(visiting.villageId)"
            @click="star(visiting)"
          >
            <GameIcon name="star" />{{
              t(favouriteIds.has(visiting.villageId) ? 'In your favourites' : 'Add to favourites')
            }}
          </button>
        </div>
        <VillageVisit :village="village" />
      </template>
      <template v-else>
        <form class="community-search" role="search" @submit.prevent>
          <GameIcon name="search" />
          <input
            v-model="query"
            type="search"
            maxlength="24"
            enterkeyhint="search"
            :placeholder="t('Find a town by name')"
            :aria-label="t('Find a town by name')"
          />
          <button
            v-if="query"
            type="button"
            class="community-search-clear"
            :aria-label="t('Clear search')"
            @click="query = ''"
          >
            <GameIcon name="close" />
          </button>
        </form>
        <template v-if="searching">
          <p v-if="!searchable(query)" class="community-intro">
            {{ t('Type at least 2 letters.') }}
          </p>
          <p v-else-if="!results" role="status">{{ t('Searching…') }}</p>
          <p v-else-if="!results.entries.length" class="community-intro">
            {{ t('No shared town matches “{query}”.', { query: results.query }) }}
          </p>
        </template>
        <template v-else>
          <div class="community-tabs" role="group" :aria-label="t('Town lists')">
            <button :aria-pressed="tab === 'discover'" @click="choose('discover')">
              <GameIcon name="shuffle" />{{ t('Discover') }}
            </button>
            <button :aria-pressed="tab === 'favourites'" @click="choose('favourites')">
              <GameIcon name="star" />{{ t('Favourites')
              }}<span v-if="favourites" class="community-count">{{
                number(favouriteIds.size)
              }}</span>
            </button>
          </div>
          <p v-if="tab === 'discover'" class="community-intro">
            {{
              t(
                'Towns drawn at random from those players share. Towns played recently and towns you have not visited come first.',
              )
            }}
          </p>
          <p v-if="loading && !list" role="status">{{ t('Loading villages…') }}</p>
          <p v-else-if="list && !list.length" class="community-intro">
            {{
              t(
                tab === 'favourites'
                  ? 'No favourite towns yet. Tap the star on a town to keep it here.'
                  : 'No villages here yet. Be the first to share yours!',
              )
            }}
          </p>
        </template>
        <ul v-if="list?.length" class="community-towns" :aria-busy="loading">
          <li v-for="entry in list" :key="entry.villageId">
            <VillageCard
              :entry="entry"
              :visited="visited.has(entry.villageId)"
              :favourite="favouriteIds.has(entry.villageId)"
              :disabled="loading"
              :star-busy="pendingStars.has(entry.villageId)"
              @visit="visit(entry)"
              @favourite="star(entry)"
            />
          </li>
        </ul>
        <p v-if="searching && results?.more" class="community-intro community-more">
          {{ t('Showing the first 20 matches. Type more of the name to narrow the search.') }}
        </p>
        <footer
          v-if="!searching && tab === 'discover' && draw?.entries.length"
          class="community-draw"
        >
          <p v-if="wholeDeck(draw)">{{ t('That is every shared town for now.') }}</p>
          <button
            v-else
            class="community-draw-button"
            :disabled="loading"
            @click="deal(nextDraw(draw))"
          >
            <GameIcon name="shuffle" />{{ t(loading ? 'Loading villages…' : 'Show other towns') }}
          </button>
        </footer>
      </template>
    </div>
  </dialog>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, reactive, ref, shallowRef, watch } from 'vue';
import { publicVillage } from '../../services/cloudProfile';
import {
  drawVillages,
  favouriteVillages,
  nextDraw,
  sameDraw,
  searchable,
  searchTerm,
  searchVillages,
  setFavourite,
  wholeDeck,
} from '../../services/townDirectory';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { t, number } from '../../i18n';
import GameIcon from '../GameIcon.vue';
import VillageCard from './VillageCard.vue';
import VillageVisit from './VillageVisit.vue';
const emit = defineEmits(['close']);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
// With many players a full list would always open on the same towns, so Discover shows one
// random draw of up to seven and deals the next seven from the same deck. Search finds a
// town by name, and Favourites keeps the towns a player wants to come back to.
const tab = ref('discover'),
  query = ref(''),
  draw = shallowRef(null),
  results = shallowRef(null),
  favourites = shallowRef(null),
  favouriteIds = reactive(new Set()),
  pendingStars = reactive(new Set()),
  loading = ref(false),
  error = ref(''),
  village = ref(null),
  visiting = shallowRef(null),
  visited = reactive(new Set());
const searching = computed(() => searchTerm(query.value) !== '');
const list = computed(() =>
  searching.value
    ? results.value?.entries
    : tab.value === 'favourites'
      ? favourites.value
      : draw.value?.entries,
);
let generation = 0,
  closed = false,
  typing;
onBeforeUnmount(() => {
  closed = true;
  clearTimeout(typing);
});
// The panel shows one list at a time, so only the latest list request may update it.
async function show(load, apply) {
  const current = ++generation;
  const latest = () => !closed && current === generation;
  loading.value = true;
  error.value = '';
  try {
    const result = await load();
    if (latest()) await apply(result);
  } catch (e) {
    if (latest()) error.value = e.message;
  } finally {
    if (latest()) loading.value = false;
  }
}
// Cards carry the server's star; a star the player is changing keeps its local state.
function learnStars(entries) {
  for (const entry of entries)
    if (!pendingStars.has(entry.villageId)) {
      if (entry.favourite) favouriteIds.add(entry.villageId);
      else favouriteIds.delete(entry.villageId);
    }
}
// The Favourites list is the whole set, so stars missing from it are cleared.
function keepFavourites(result) {
  favourites.value = result.entries;
  for (const id of [...favouriteIds]) if (!pendingStars.has(id)) favouriteIds.delete(id);
  learnStars(result.entries);
}
const deal = (next) =>
  show(
    () => drawVillages(next),
    (result) => {
      // Towns unshared since the last draw can leave a later page empty: start a new deck.
      if (!result.entries.length && result.page > 1) return deal(nextDraw(null));
      learnStars(result.entries);
      draw.value = result;
    },
  );
const search = () =>
  show(
    () => searchVillages(query.value),
    (result) => {
      learnStars(result.entries);
      results.value = result;
    },
  );
const loadFavourites = () => show(favouriteVillages, keepFavourites);
function choose(next) {
  tab.value = next;
  if (next === 'favourites') loadFavourites();
  else if (!draw.value) deal(nextDraw(null));
}
watch(query, () => {
  clearTimeout(typing);
  results.value = null;
  if (searchable(query.value)) typing = setTimeout(search, 300);
  else {
    // Leaving the search abandons it and shows the chosen list again.
    generation++;
    loading.value = false;
    if (!searching.value) choose(tab.value);
  }
});
async function star(entry) {
  const id = entry.villageId,
    keep = !favouriteIds.has(id);
  if (pendingStars.has(id)) return;
  pendingStars.add(id);
  if (keep) favouriteIds.add(id);
  else favouriteIds.delete(id);
  error.value = '';
  try {
    await setFavourite(id, keep);
    // A new star joins the Favourites list at once; an old one stays there, unstarred,
    // until the list is opened again, so a mistaken tap is easy to undo.
    if (keep && favourites.value && !favourites.value.some((card) => card.villageId === id))
      favourites.value = [{ ...entry, favourite: true }, ...favourites.value];
  } catch (e) {
    if (keep) favouriteIds.delete(id);
    else favouriteIds.add(id);
    if (!closed) error.value = e.message;
  } finally {
    pendingStars.delete(id);
  }
}
const visit = (entry) =>
  show(
    () => publicVillage(entry.villageId),
    (result) => {
      village.value = result;
      visiting.value = entry;
      visited.add(entry.villageId);
      dialog.value.scrollTop = 0;
    },
  );
// Back shows the same list again with fresh saloon, visitor and favourite news.
async function back() {
  village.value = null;
  error.value = '';
  await nextTick();
  dialog.value.scrollTop = 0;
  if (searching.value) {
    if (searchable(query.value)) search();
  } else if (tab.value === 'favourites') loadFavourites();
  else deal(sameDraw(draw.value));
}
deal(nextDraw(null));
// Favourites load beside the first draw, so the tab shows its count and stars are right.
favouriteVillages()
  .then((result) => {
    if (!closed && !favourites.value) keepFavourites(result);
  })
  .catch(() => {});
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
/* A steady height keeps the dialog still while lists and searches change length. */
.community-dialog[open] {
  min-height: min(42rem, 94dvh);
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
.community-star,
.community-draw-button {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.community-error {
  padding: 0.6rem 0.85rem;
  border-radius: 10px;
  background: #f8e1d9;
  color: #7a2f1d;
}
.community-visit-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 0.5rem;
}
.community-dialog .community-star[aria-pressed='true'] {
  border-color: #d9b25e;
  background: #f8e3b5;
  color: #6b4511;
}
.community-star[aria-pressed='true'] svg,
.village-card-star[aria-pressed='true'] svg {
  fill: currentColor;
}
.community-search {
  position: relative;
  display: flex;
  align-items: center;
  margin: 0 0 0.85rem;
}
.community-search > svg {
  position: absolute;
  left: 0.8rem;
  color: #5b6d65;
  pointer-events: none;
}
.community-search input {
  width: 100%;
  padding: 0.75rem 2.9rem 0.75rem 2.7rem;
  border: 1px solid #c4bea9;
  border-radius: 12px;
  background: #fffdf6;
  color: inherit;
  font: inherit;
}
.community-search input:focus-visible {
  outline: 2px solid #315940;
  outline-offset: 1px;
}
.community-search input::-webkit-search-cancel-button {
  display: none;
}
.community-dialog .community-search-clear {
  position: absolute;
  right: 0.3rem;
  display: grid;
  padding: 0.4rem;
  border: 0;
  background: none;
}
.community-tabs {
  display: inline-flex;
  gap: 0.25rem;
  margin: 0 0 0.85rem;
  padding: 0.25rem;
  border-radius: 12px;
  background: #ece6d4;
}
.community-dialog .community-tabs button {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.9rem;
  border: 0;
  background: transparent;
  font-weight: 600;
}
.community-dialog .community-tabs button[aria-pressed='true'] {
  background: #fffdf6;
  box-shadow: 0 1px 3px #18383226;
}
.community-count {
  min-width: 1.4rem;
  padding: 0 0.4rem;
  border-radius: 999px;
  background: #183832;
  color: #fff7df;
  font-size: 0.75rem;
  line-height: 1.4rem;
  text-align: center;
}
.community-tabs svg {
  width: 1.1rem;
  height: 1.1rem;
}
.community-more {
  margin-top: 1rem;
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
.village-card {
  position: relative;
  height: 100%;
}
.community-dialog .village-card-open {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  width: 100%;
  height: 100%;
  padding: 0.75rem 3.4rem 0.75rem 0.75rem;
  border: 1px solid #e3dbc7;
  border-radius: 16px;
  background: #fffdf6;
  text-align: left;
  transition:
    border-color 0.15s,
    box-shadow 0.15s;
}
.community-dialog .village-card-open:not(:disabled):hover,
.community-dialog .village-card-open:focus-visible {
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
.community-dialog .village-card-star {
  position: absolute;
  top: 50%;
  right: 0.45rem;
  display: grid;
  place-items: center;
  width: 2.6rem;
  height: 2.6rem;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #8a7c5a;
  transform: translateY(-50%);
}
.community-dialog .village-card-star:not(:disabled):hover {
  background: #f3ecd8;
}
.community-dialog .village-card-star[aria-pressed='true'] {
  color: #c8901f;
}
.village-card-honours {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.3rem;
}
.village-card-honours > span {
  display: inline-flex;
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
  .community-dialog .village-card-open {
    gap: 0.7rem;
    padding: 0.7rem 3.1rem 0.7rem 0.7rem;
  }
  .village-card-art {
    width: 2.75rem;
    height: 2.75rem;
  }
  .community-tabs {
    display: flex;
  }
  .community-dialog .community-tabs button {
    flex: 1 1 0;
    min-width: 0;
    justify-content: center;
    padding: 0.5rem 0.45rem;
  }
  /* Two tabs share a phone's width; their labels need the icons' room. */
  .community-tabs svg {
    display: none;
  }
}
@media (max-width: 360px) {
  .community-dialog .community-tabs button {
    gap: 0.3rem;
    padding: 0.5rem 0.25rem;
    font-size: 0.9rem;
  }
  .community-count {
    min-width: 1.2rem;
    padding: 0 0.25rem;
    font-size: 0.7rem;
  }
}
</style>

<template>
  <dialog
    ref="dialog"
    class="honour-collection"
    :class="{ 'honour-contrast': settings.highContrastMode }"
    aria-labelledby="honour-collection-title"
    @cancel.prevent="$emit('close')"
    @click="dismissBackdrop"
  >
    <div class="honour-collection-heading">
      <div>
        <p class="honour-collection-kicker">
          {{ t('{town} · Town Honours', { town: townName }) }}
        </p>
        <h2 id="honour-collection-title">{{ t('Town Honours') }}</h2>
        <p>{{ t(INTROS[tab]) }}</p>
      </div>
      <button
        ref="closeButton"
        class="honour-collection-close"
        type="button"
        :aria-label="t('Close honours')"
        @click="$emit('close')"
      >
        ×
      </button>
    </div>
    <HonourCollectionList
      v-model:tab="tab"
      :tabs="tabs"
      :state="campaign"
      :showcase="showcase"
      :fresh="fresh"
      :new-ranks="newRanks"
      :show-new="settings.honourNotices !== 'off'"
      :links="links"
      :can-replay="campaign.canReplay"
      :can-travel="canTravel"
      @open="detail = $event"
      @manage="managing = true"
      @link="follow"
    />
  </dialog>
  <TownDialog
    v-if="detail"
    :key="detail"
    :title="t(detailName)"
    close-label="Close honour details"
    @close="detail = null"
  >
    <div :class="{ 'honour-contrast': settings.highContrastMode }">
      <HonourDetail :family-id="detail" :links="links" :can-travel="canTravel" @link="follow" />
    </div>
  </TownDialog>
  <TownDialog
    v-if="managing"
    :title="t('Manage showcase')"
    close-label="Close showcase"
    @close="managing = false"
  >
    <div :class="{ 'honour-contrast': settings.highContrastMode }">
      <HonourShowcaseEditor />
    </div>
  </TownDialog>
</template>
<script setup>
import { computed, inject, onMounted, ref, watch } from 'vue';
import { t } from '../../i18n';
import { useNativeDialog } from '../../composables/useNativeDialog';
import { useHonourNavigation } from '../../composables/useHonourNavigation';
import { useCampaignStore } from '../../stores/campaignStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { HONOURS, honourCollection, validShowcase } from '../../data/honours';
import TownDialog from '../town/TownDialog.vue';
import HonourCollectionList from './HonourCollectionList.vue';
import HonourDetail from './HonourDetail.vue';
import HonourShowcaseEditor from './HonourShowcaseEditor.vue';
import { unseenIds } from './honourDisplay';
// The player's Town Honours. Available offline from the More menu and town management.
// `links` is set inside the village, where museum and building destinations can open.
const props = defineProps({ familyId: { type: String, default: null }, links: Boolean });
const emit = defineEmits(['close', 'inspect']);
const INTROS = {
  mine: 'Mine honours count the puzzles you complete. Earned ranks stay with this town.',
  town: 'Town honours follow your eras, the forge, supplies and protected incidents.',
  friends: 'Friends honours count visits between shared towns.',
};
const campaign = useCampaignStore(),
  settings = useSettingsStore();
const cloudAccount = inject('cloudAccount', null);
const townName = computed(() => cloudAccount?.townName.value ?? 'Prospect Hollow');
// The shared-town directory opens only for a signed-in account.
const canTravel = computed(() => !!cloudAccount?.signedIn.value);
const { dialog, closeButton, dismissBackdrop } = useNativeDialog(() => emit('close'));
const { openMuseumFor } = useHonourNavigation();
const tabs = computed(() => honourCollection(campaign));
const showcase = computed(() => validShowcase(campaign.honours.showcase, campaign.honours));
// What was new on opening keeps its label while the collection stays open.
const opened = (flag) =>
  tabs.value.flatMap((entry) =>
    entry.families.filter((family) => family[flag]).map((family) => family.id),
  );
const fresh = opened('fresh'),
  newRanks = opened('newRank');
const tab = ref(
  HONOURS.familyById[props.familyId]?.tab ??
    tabs.value.find((entry) => entry.fresh && settings.honourNotices !== 'off')?.id ??
    'mine',
);
const detail = ref(null),
  managing = ref(false);
const detailName = computed(
  () =>
    tabs.value.flatMap((entry) => entry.families).find((family) => family.id === detail.value)
      ?.definition.name ?? '',
);
// A tab on screen counts as seen, and so do ranks added by an update; this never
// changes what is earned.
watch(
  tab,
  (id) => {
    const ids = unseenIds(tabs.value.find((entry) => entry.id === id));
    if (ids.length || newRanks.length) campaign.markHonoursSeen(ids);
  },
  { immediate: true },
);
// Opened from a popup or a link: show that honour over the collection, also when a
// later request names another honour while the collection is open.
function showRequested(familyId) {
  const family = HONOURS.familyById[familyId];
  if (!family) return;
  tab.value = family.tab;
  detail.value = familyId;
}
onMounted(() => showRequested(props.familyId));
watch(() => props.familyId, showRequested);
function follow(model) {
  if (model.link.museum) openMuseumFor(model.id);
  else if (model.link.directory) {
    emit('close');
    cloudAccount?.openCommunity();
  } else emit('inspect', model.link.building);
}
</script>
<style>
.honour-collection {
  position: fixed;
  inset: 0;
  margin: auto;
  width: min(1000px, calc(100% - 32px));
  max-height: calc(100dvh - 40px);
  padding: 30px;
  border: 1px solid #d5ccb4;
  border-radius: 18px;
  color: #3f5545;
  background: #faf7ed;
  box-shadow: 0 25px 100px #273d3560;
  font-family: 'Segoe UI', sans-serif;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.honour-collection::backdrop {
  background: #26372bd9;
  backdrop-filter: blur(6px);
}
html:has(.honour-collection[open]) {
  overflow: hidden;
}
.honour-collection-heading {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 16px;
}
.honour-collection-kicker {
  margin: 0;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 1.4px;
  text-transform: uppercase;
  color: #5f6352;
}
.honour-collection-heading h2 {
  margin: 8px 0;
  font:
    400 36px/1.1 Georgia,
    serif;
}
.honour-collection-heading p:not(.honour-collection-kicker) {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
  color: #4f5747;
}
.honour-collection-close {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border: 1px solid #d7d4c0;
  border-radius: 7px;
  background: #f3f4e8;
  color: #4d6856;
  font:
    26px Georgia,
    serif;
  cursor: pointer;
}
.honour-collection-close:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 3px;
}
.honour-collection.honour-contrast {
  border-color: #626b50;
  color: #253f2f;
}
.honour-contrast .honour-collection-heading p:not(.honour-collection-kicker),
.honour-contrast .honour-collection-kicker {
  color: #253f2f;
}
@media (max-width: 600px) {
  .honour-collection {
    width: calc(100% - 20px);
    max-height: calc(100dvh - 20px);
    padding: 22px 16px;
  }
  .honour-collection-heading h2 {
    font-size: 29px;
  }
}
</style>

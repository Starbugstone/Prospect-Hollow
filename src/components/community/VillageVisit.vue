<template>
  <div class="village-title">
    <h2>{{ current.name }}</h2>
    <HonourShowcaseSlots
      v-if="honours?.showcase.length"
      compact
      :ids="honours.showcase"
      :earned="honours.earned"
      :received="honours.received"
      :size="40"
    />
  </div>
  <p>{{ t('View only') }} · {{ t(ERA_BY_ID[current.era]?.label ?? current.era) }}</p>
  <p v-if="unshared" role="alert">{{ t('This town is no longer shared.') }}</p>
  <template v-else>
    <VisitPresence
      :key="current.villageId"
      :village-id="current.villageId"
      @presence="ownVisitId = $event"
      @town="homeTown = $event"
    />
    <p v-if="saloonMessage" class="village-saloon" role="status">{{ saloonMessage }}</p>
    <p v-if="helmetMessage" class="village-saloon" role="status">{{ helmetMessage }}</p>
    <div class="community-world town-map-frame" :class="{ 'town-fullscreen': fullscreen }">
      <button
        ref="fullscreenButton"
        class="town-fullscreen-button"
        :aria-label="t(fullscreen ? 'Exit full screen village' : 'Full screen village')"
        :title="t(fullscreen ? 'Exit full screen village' : 'Full screen village')"
        :aria-pressed="fullscreen"
        @click="fullscreen = !fullscreen"
      >
        <GameIcon name="expand" />
      </button>
      <!-- Full screen covers the page, so the town name and saloon news move onto the map. -->
      <p v-if="fullscreen" class="village-fullscreen-caption">
        <strong>{{ current.name }}</strong
        ><HonourShowcaseSlots
          v-if="honours?.showcase.length"
          compact
          :ids="honours.showcase"
          :earned="honours.earned"
          :received="honours.received"
          :size="28"
        /><template v-if="saloonMessage"> · {{ saloonMessage }}</template
        ><template v-if="helmetMessage"> · {{ helmetMessage }}</template>
      </p>
      <p v-if="findError" class="village-find-error" role="status">{{ t(findError) }}</p>
      <TownScene
        ref="townScene"
        :key="current.villageId"
        :town="town"
        :read-only="true"
        :live-visitors="liveVisitors"
        :live-visitor-town-id="current.villageId"
        :visitor-taps="collectable ? ['saloon'] : []"
        :reduced-motion="settings.reducedMotion"
        @visit="collectSaloon"
        @inspect="inspect"
        @helmet="findHelmet"
      />
      <TownResourceCollection
        v-if="helmetBurst"
        :key="helmetBurst.serial"
        resource="helmet-coins"
        :amount="helmetBurst.amount"
        :origin="helmetBurst.origin"
        :reduced-motion="settings.reducedMotion"
        @close="helmetBurst = null"
      />
    </div>
    <p class="village-hint">{{ t('Tap a building or the mine to see its details.') }}</p>
    <div class="village-guestbook-actions" :class="{ 'village-guestbook-fullscreen': fullscreen }">
      <button @click="inspected = 'guestbook'">{{ t("Mayor's guestbook") }}</button>
      <button v-if="honours" @click="inspected = 'honours'">{{ t('View town honours') }}</button>
      <button
        v-if="ownVisitId"
        :disabled="!liveVisitors.some((visitor) => visitor.id === ownVisitId)"
        @click="findVisitor(ownVisitId)"
      >
        {{ t('Find me') }}
      </button>
    </div>

    <TownDialog
      v-if="inspected"
      :class="{ 'village-level-dialog': showsLevels || inspected === 'honours' }"
      :title="current.name"
      close-label="Close building details"
      @close="inspected = ''"
    >
      <TownGuestbook
        v-if="inspected === 'guestbook'"
        :village-id="current.villageId"
        :snapshot="guestbookSnapshot"
        :error="visitorError"
        :era="town.era"
        can-find
        @find="findVisitor"
      />
      <HonourGallery
        v-else-if="inspected === 'honours'"
        :class="{ 'honour-contrast': settings.highContrastMode }"
        :honours="honours ?? { earned: {}, showcase: [], received: {} }"
        :town="current.name"
      />
      <TownMonumentSite v-else-if="AREA_BY_ID[inspected]" :id="inspected" :town="town" read-only />
      <section v-else-if="inspected === 'mine'" class="town-building-details">
        <div class="town-detail-title">
          <div>
            <p class="town-kicker">{{ t('Mine level') }}</p>
            <h2>{{ t('Mine') }}</h2>
          </div>
          <span v-if="mineLevel" class="town-level-badge">{{
            t('Level {level}', { level: mineLevel })
          }}</span>
        </div>
        <p v-if="mineLevel">
          {{
            t('The mayor of {town} plays level {level} next.', {
              town: current.name,
              level: mineLevel,
            })
          }}
        </p>
      </section>
      <section v-if="showsLevels" :aria-label="t('Unlocked levels and stars')">
        <p v-if="inspected === 'museum'" class="town-kicker">{{ t('The Frontier Museum') }}</p>
        <h2>{{ t('Unlocked levels and stars') }}</h2>
        <p>{{ t('View only') }}</p>
        <MuseumLevelGrid
          v-if="levels.available"
          :level-ids="levels.levelIds"
          :records="levels.records"
          read-only
        />
        <p v-else class="museum-empty">{{ t('Level awards are not available yet.') }}</p>
      </section>
      <TownBuildingDetails
        v-if="!['mine', 'guestbook', 'honours'].includes(inspected) && !AREA_BY_ID[inspected]"
        :key="inspected"
        :id="inspected"
        :town="town"
        read-only
        @select="inspect"
      />
    </TownDialog>
  </template>
</template>
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { useVillageVisitors } from '../../composables/useVillageVisitors';
import TownGuestbook from '../town/TownGuestbook.vue';
import VisitPresence from './VisitPresence.vue';
import { villageAppearance, villageHonours, villageLevels } from '../../services/publicVillage';
import { cloud, latestVillage, tapHelmet, tapSaloon } from '../../services/cloudProfile';
import { normalizeTown, spaceHelmetOut, spaceHelmetReward } from '../../game/town/TownRules';
import { townStorage } from '../../services/townStorage';
import { createVillagePoller } from '../../services/villagePolling';
import { useSettingsStore } from '../../stores/settingsStore';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
import TownScene from '../town/TownScene.vue';
import TownResourceCollection from '../town/TownResourceCollection.vue';
import GameIcon from '../GameIcon.vue';
import TownDialog from '../town/TownDialog.vue';
import TownBuildingDetails from '../town/TownBuildingDetails.vue';
import TownMonumentSite from '../town/TownMonumentSite.vue';
import { AREA_BY_ID, areaChoice } from '../../data/townLandmarks';
import MuseumLevelGrid from '../town/MuseumLevelGrid.vue';
import HonourGallery from '../honours/HonourGallery.vue';
import HonourShowcaseSlots from '../honours/HonourShowcaseSlots.vue';
import { BUILDING_BY_ID } from '../../data/town';
import '../../styles/town.css';
// One read-only renderer for shared towns, whether opened from the list or a share link.
// Mine and museum cards share the owner's public collection, without replay actions.
// A visitor may collect the saloon's takings for the owner and find the space helmet.
const props = defineProps({ village: { type: Object, required: true } });
const settings = useSettingsStore();
// The owner may still be playing: `current` follows their latest synced appearance.
const current = shallowRef(props.village),
  unshared = ref(false);
const town = computed(() => villageAppearance(current.value));
const ownVisitId = ref(null),
  townScene = ref(null),
  findError = ref('');
const { snapshot: visitorSnapshot, error: visitorError } = useVillageVisitors(() =>
  unshared.value ? null : props.village.villageId,
);
const liveVisitors = computed(() =>
  (visitorSnapshot.value?.present ?? []).map((visitor) => ({
    ...visitor,
    self: visitor.id === ownVisitId.value,
  })),
);
const guestbookSnapshot = computed(() =>
  visitorSnapshot.value ? { ...visitorSnapshot.value, present: liveVisitors.value } : null,
);
async function findVisitor(id) {
  inspected.value = '';
  findError.value = '';
  await nextTick();
  if (!townScene.value?.findVisitor(id))
    findError.value =
      'This visitor is no longer visible. Check the guestbook for the latest visit details.';
}
// Tolerate older public responses while client and server versions roll forward.
const mineLevel = computed(() => current.value.appearance?.mineLevel ?? 0);
const inspected = ref('');
const showsLevels = computed(() => ['mine', 'museum'].includes(inspected.value));
const levels = computed(() => villageLevels(current.value));
// The owner's public honours; null hides them (an owner or server from before honours).
const honours = computed(() => villageHonours(current.value));
function inspect(id) {
  if (id === 'mine' || Object.hasOwn(BUILDING_BY_ID, id)) inspected.value = id;
  // Visitors can admire a built monument; open sites have no label for them.
  else if (AREA_BY_ID[id] && areaChoice(town.value, AREA_BY_ID[id])) inspected.value = id;
}
const hasSaloon = computed(() => current.value.appearance?.buildings?.saloon > 0);
const readyAt = ref((props.village.saloonReadyAt ?? 0) * 1000),
  now = ref(Date.now()),
  // When this visitor's own collection lets the saloon reopen; the page may stay open.
  mine = ref(0),
  busy = ref(false),
  error = ref('');
const clock = setInterval(() => (now.value = Date.now()), 30_000);
const visual = (village) => JSON.stringify([village.name, village.era, village.appearance]);
const poller = createVillagePoller({
  load: () => latestVillage(props.village.villageId),
  apply(village) {
    // Unchanged towns keep the same model, so the scene does no work between advancements.
    if (visual(village) !== visual(current.value)) current.value = village;
    // Another visitor may have collected meanwhile; the saloon's rest only ever moves later.
    readyAt.value = Math.max(readyAt.value, (village.saloonReadyAt ?? 0) * 1000);
    townHelmetReadyAt.value = Math.max(
      townHelmetReadyAt.value,
      (village.helmetReadyAt ?? 0) * 1000,
    );
  },
  gone: () => (unshared.value = true),
});
// Full screen works like the game's village: the map fills the viewport without the
// Fullscreen API, the page stops scrolling, and Escape leaves unless a card is open.
const fullscreen = ref(false),
  fullscreenButton = ref(null);
let previousOverflow;
watch(fullscreen, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else {
    document.body.style.overflow = previousOverflow ?? '';
    fullscreenButton.value?.focus({ preventScroll: true });
  }
});
function leaveFullscreen(event) {
  if (event.key === 'Escape' && !inspected.value) fullscreen.value = false;
}
const resume = () => poller.resume();
onMounted(() => {
  document.addEventListener('visibilitychange', resume);
  document.addEventListener('keydown', leaveFullscreen);
  poller.start();
});
onBeforeUnmount(() => {
  clearInterval(clock);
  poller.stop();
  document.removeEventListener('visibilitychange', resume);
  document.removeEventListener('keydown', leaveFullscreen);
  if (fullscreen.value) document.body.style.overflow = previousOverflow ?? '';
});
// The server decides when the saloon is collectable again; this only mirrors it.
const collectable = computed(() => hasSaloon.value && !busy.value && readyAt.value <= now.value);
const collected = computed(() => mine.value > now.value);
const saloonMessage = computed(() => {
  if (!hasSaloon.value) return '';
  if (error.value) return t(error.value);
  if (collected.value)
    return t('You collected the saloon takings for the mayor of {town}. Thank you!', {
      town: current.value.name,
    });
  if (readyAt.value > now.value)
    return t('A visitor collected the saloon recently. Come back in {minutes} min.', {
      minutes: Math.ceil((readyAt.value - now.value) / 60_000),
    });
  return t('Tap the coins over the saloon to collect its takings for the mayor.');
});
// Finding the space helmet rewards the visitor's own town (the one they visit as) with half
// an hour of its saloon takings, once per 12 hours per player, and each town's helmet is
// found by one visitor per 12 hours; the server keeps both rests.
const homeTown = ref(null),
  helmetReadyAt = ref(0),
  townHelmetReadyAt = ref((props.village.helmetReadyAt ?? 0) * 1000),
  helmetBusy = ref(false),
  helmetNote = ref(null),
  helmetBurst = ref(null);
let burstSerial = 0;
// The coins a find brings the town visited as, counted from its copy in this browser; that
// town redeems it later from its own takings. Null when this browser holds no copy.
function helmetCoins(townId) {
  const saved = cloud.account && townStorage.get(townId, cloud.account.id)?.profile?.town;
  return saved ? spaceHelmetReward(normalizeTown(saved), 'visitor') : null;
}
const hasHelmet = computed(() => spaceHelmetOut(town.value));
const helmetMessage = computed(() => {
  if (!hasHelmet.value) return '';
  const note = helmetNote.value;
  if (note?.kind === 'found')
    return t('You found the astronaut! {town} receives half an hour of its saloon takings.', {
      town: note.town,
    });
  if (note?.kind === 'error') return t(note.message);
  if (note?.kind === 'own')
    return t('This is your own town: find its astronaut from your game for your reward.');
  if (townHelmetReadyAt.value > now.value)
    return t("A visitor found this town's astronaut recently. Come back in {hours} h.", {
      hours: Math.ceil((townHelmetReadyAt.value - now.value) / 3_600_000),
    });
  if (note?.kind === 'signed-out')
    return t('You found the astronaut! Sign in with a town of your own to earn its reward.');
  if (helmetReadyAt.value > now.value)
    return t('You found an astronaut recently. Your next reward is ready in {hours} h.', {
      hours: Math.ceil((helmetReadyAt.value - now.value) / 3_600_000),
    });
  return t(
    'Find the animal in a space helmet: your own town earns half an hour of saloon takings.',
  );
});
async function findHelmet(origin) {
  now.value = Date.now();
  if (helmetBusy.value) return;
  if (homeTown.value?.own) {
    helmetNote.value = { kind: 'own' };
    return;
  }
  // Another visitor found this town's helmet; a find of this visitor's own stays thanked.
  if (townHelmetReadyAt.value > now.value) {
    if (helmetNote.value?.kind !== 'found') helmetNote.value = null;
    return;
  }
  if (!cloud.account || !homeTown.value) {
    helmetNote.value = { kind: 'signed-out' };
    return;
  }
  helmetNote.value = null;
  if (helmetReadyAt.value > now.value) return;
  helmetBusy.value = true;
  try {
    const town = homeTown.value;
    const { readyAt } = await tapHelmet(props.village.villageId, town.townId);
    helmetReadyAt.value = townHelmetReadyAt.value = readyAt * 1000;
    helmetNote.value = { kind: 'found', town: town.name };
    helmetBurst.value = { amount: helmetCoins(town.townId), origin, serial: ++burstSerial };
  } catch (e) {
    if (e.data?.code === 'helmet_taken') townHelmetReadyAt.value = e.data.readyAt * 1000;
    else if (e.data?.readyAt) helmetReadyAt.value = e.data.readyAt * 1000;
    else helmetNote.value = { kind: 'error', message: e.message };
  } finally {
    helmetBusy.value = false;
  }
}
async function collectSaloon() {
  now.value = Date.now();
  if (!collectable.value) return;
  busy.value = true;
  error.value = '';
  try {
    readyAt.value = mine.value = (await tapSaloon(props.village.villageId)).readyAt * 1000;
  } catch (e) {
    if (e.data?.readyAt) readyAt.value = e.data.readyAt * 1000;
    else error.value = e.message;
  } finally {
    busy.value = false;
  }
}
</script>
<style>
.village-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
}
.village-fullscreen-caption .honour-slots-compact {
  margin-left: 8px;
}
.village-guestbook-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}
.village-guestbook-actions button {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid #bca8bf;
  border-radius: 10px;
  background: #faf5fa;
  color: #48364d;
  font: inherit;
  cursor: pointer;
}
.village-guestbook-fullscreen {
  position: fixed;
  z-index: 91;
  bottom: max(16px, env(safe-area-inset-bottom));
  left: 16px;
  right: 16px;
}
.town-dialog.village-level-dialog {
  width: min(920px, calc(100vw - 32px));
}
.village-level-dialog .museum-level {
  text-align: center;
}
@media (max-width: 550px) {
  .town-dialog.village-level-dialog {
    width: 100%;
  }
}
.village-saloon {
  margin: 0 0 0.6rem;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  background: #f4e7c2;
  color: #5b4520;
}
.village-fullscreen-caption {
  position: absolute;
  z-index: 6;
  /* Beside the full screen button. */
  top: max(12px, calc(env(safe-area-inset-top) + 12px));
  left: 72px;
  min-height: 44px;
  box-sizing: border-box;
  right: 16px;
  width: fit-content;
  max-width: calc(100% - 88px);
  margin: 0;
  padding: 0.55rem 0.8rem;
  border: 1px solid #9c997d;
  border-radius: 10px;
  background: #fff9e9ee;
  color: #405b4c;
}
.village-hint {
  margin: 0.6rem 0 0;
  font-size: 0.9rem;
  opacity: 0.8;
}
.community-world {
  height: min(62dvh, 600px);
  min-height: 330px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}
.village-find-error {
  position: absolute;
  z-index: 7;
  top: 70px;
  left: 16px;
  right: 16px;
  padding: 10px;
  background: #faf5fa;
  color: #48364d;
  border-radius: 10px;
}
/* A visit shows just the town: no building names, only the saloon coins when collectable. */
.community-world .town-scene-labels {
  display: none;
}
/* Fill the frame; the village's own aspect ratio would leave an empty strip. */
.community-world .town-scene {
  height: 100%;
  aspect-ratio: auto;
}
</style>

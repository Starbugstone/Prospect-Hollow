<template>
  <h2>{{ current.name }}</h2>
  <p>{{ t('View only') }} · {{ t(ERA_BY_ID[current.era]?.label ?? current.era) }}</p>
  <p v-if="unshared" role="alert">{{ t('This town is no longer shared.') }}</p>
  <template v-else>
    <p v-if="saloonMessage" class="village-saloon" role="status">{{ saloonMessage }}</p>
    <div class="community-world town-map-frame">
      <TownScene
        :key="current.villageId"
        :town="town"
        :read-only="true"
        :visitor-taps="collectable ? ['saloon'] : []"
        :reduced-motion="settings.reducedMotion"
        @visit="collectSaloon"
        @inspect="inspect"
      />
    </div>
    <p class="village-hint">{{ t('Tap a building or the mine to see its details.') }}</p>
    <TownDialog
      v-if="inspected"
      :title="current.name"
      close-label="Close building details"
      @close="inspected = ''"
    >
      <section v-if="inspected === 'mine'" class="town-building-details">
        <div class="town-detail-title">
          <div>
            <p class="town-kicker">{{ t('Mine level') }}</p>
            <h2>{{ t('Mine') }}</h2>
          </div>
          <span class="town-level-badge">{{ t('Level {level}', { level: mineLevel }) }}</span>
        </div>
        <p>
          {{
            t('The mayor of {town} plays level {level} next.', {
              town: current.name,
              level: mineLevel,
            })
          }}
        </p>
      </section>
      <TownBuildingDetails
        v-else
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
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue';
import { villageAppearance } from '../../services/publicVillage';
import { latestVillage, tapSaloon } from '../../services/cloudProfile';
import { createVillagePoller } from '../../services/villagePolling';
import { useSettingsStore } from '../../stores/settingsStore';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
import TownScene from '../town/TownScene.vue';
import TownDialog from '../town/TownDialog.vue';
import TownBuildingDetails from '../town/TownBuildingDetails.vue';
import { BUILDING_BY_ID } from '../../data/town';
import '../../styles/town.css';
// One read-only renderer for shared towns, whether opened from the list or a share link.
// A visitor can open any building's card, or the mine's level, but not build or upgrade.
// The only action is collecting the saloon's takings for the owner.
const props = defineProps({ village: { type: Object, required: true } });
const settings = useSettingsStore();
// The owner may still be playing: `current` follows their latest synced appearance.
const current = shallowRef(props.village),
  unshared = ref(false);
const town = computed(() => villageAppearance(current.value));
// Towns shared before the mine level was published have none until the owner saves again.
const mineLevel = computed(() => current.value.appearance?.mineLevel ?? 0);
const inspected = ref('');
function inspect(id) {
  if (id === 'mine' ? mineLevel.value > 0 : Object.hasOwn(BUILDING_BY_ID, id)) inspected.value = id;
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
  },
  gone: () => (unshared.value = true),
});
const resume = () => poller.resume();
onMounted(() => {
  document.addEventListener('visibilitychange', resume);
  poller.start();
});
onBeforeUnmount(() => {
  clearInterval(clock);
  poller.stop();
  document.removeEventListener('visibilitychange', resume);
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
.village-saloon {
  margin: 0 0 0.6rem;
  padding: 0.45rem 0.8rem;
  border-radius: 10px;
  background: #f4e7c2;
  color: #5b4520;
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

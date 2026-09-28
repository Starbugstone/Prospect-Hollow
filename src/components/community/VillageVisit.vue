<template>
  <h2>{{ village.name }}</h2>
  <p>{{ t('View only') }} · {{ t(ERA_BY_ID[village.era]?.label ?? village.era) }}</p>
  <p v-if="saloonMessage" class="village-saloon" role="status">{{ saloonMessage }}</p>
  <div class="community-world town-map-frame">
    <TownScene
      :key="village.villageId"
      :town="town"
      :read-only="true"
      :visitor-taps="collectable ? ['saloon'] : []"
      :reduced-motion="settings.reducedMotion"
      @visit="collectSaloon"
    />
  </div>
</template>
<script setup>
import { computed, onBeforeUnmount, ref } from 'vue';
import { villageAppearance } from '../../services/publicVillage';
import { tapSaloon } from '../../services/cloudProfile';
import { useSettingsStore } from '../../stores/settingsStore';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
import TownScene from '../town/TownScene.vue';
import '../../styles/town.css';
// One read-only renderer for shared towns, whether opened from the list or a share link.
// The only thing a visitor can do is collect the saloon's takings for the owner.
const props = defineProps({ village: { type: Object, required: true } });
const settings = useSettingsStore();
const town = computed(() => villageAppearance(props.village));
const hasSaloon = computed(() => props.village.appearance?.buildings?.saloon > 0);
const readyAt = ref((props.village.saloonReadyAt ?? 0) * 1000),
  now = ref(Date.now()),
  collected = ref(false),
  busy = ref(false),
  error = ref('');
const clock = setInterval(() => (now.value = Date.now()), 30_000);
onBeforeUnmount(() => clearInterval(clock));
// The server decides when the saloon is collectable again; this only mirrors it.
const collectable = computed(
  () => hasSaloon.value && !collected.value && !busy.value && readyAt.value <= now.value,
);
const saloonMessage = computed(() => {
  if (!hasSaloon.value) return '';
  if (error.value) return t(error.value);
  if (collected.value)
    return t('You collected the saloon takings for the mayor of {town}. Thank you!', {
      town: props.village.name,
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
    readyAt.value = (await tapSaloon(props.village.villageId)).readyAt * 1000;
    collected.value = true;
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

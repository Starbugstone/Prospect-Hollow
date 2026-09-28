<template>
  <h2>{{ village.name }}</h2>
  <p>{{ t('View only') }} · {{ t(ERA_BY_ID[village.era]?.label ?? village.era) }}</p>
  <div class="community-world town-map-frame">
    <TownScene
      :key="village.villageId"
      :town="town"
      :read-only="true"
      :reduced-motion="settings.reducedMotion"
    />
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { villageAppearance } from '../../services/publicVillage';
import { useSettingsStore } from '../../stores/settingsStore';
import { ERA_BY_ID } from '../../data/eras';
import { t } from '../../i18n';
import TownScene from '../town/TownScene.vue';
import '../../styles/town.css';
// One read-only renderer for shared towns, whether opened from the list or a share link.
const props = defineProps({ village: { type: Object, required: true } });
const settings = useSettingsStore();
const town = computed(() => villageAppearance(props.village));
</script>
<style>
.community-world {
  height: min(62dvh, 600px);
  min-height: 330px;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
}
/* Fill the frame; the village's own aspect ratio would leave an empty strip. */
.community-world .town-scene {
  height: 100%;
  aspect-ratio: auto;
}
.community-world .town-scene-labels button:disabled {
  opacity: 1;
  pointer-events: none;
}
.community-world .town-map-read-only .map-building,
.community-world .town-map-read-only .town-mine-entrance {
  cursor: default;
}
</style>

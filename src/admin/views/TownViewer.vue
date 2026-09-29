<template>
  <div class="admin-town-view">
    <TownScene :town="town" :read-only="true" :reduced-motion="reducedMotion" />
  </div>
</template>
<script setup>
import { computed } from 'vue';
import TownScene from '../../components/town/TownScene.vue';
import { villageAppearance } from '../../services/publicVillage';
import '../../styles/town.css';
// The share page's read-only renderer, fed the same appearance projection. No taps,
// no saloon and no guest visit: looking at a town from here never changes it.
const props = defineProps({ appearance: { type: Object, required: true } });
const town = computed(() => villageAppearance(props.appearance));
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
</script>

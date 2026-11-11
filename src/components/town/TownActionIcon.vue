<template>
  <button
    type="button"
    class="town-action-icon"
    :class="action.class"
    :style="{ '--action-scale': action.scale * size }"
    :aria-label="label"
  >
    <img :src="action.icon" alt="" />
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { TOWN_ACTIONS } from '../../data/townIndicators';

// The action icon over a place on every settlement map, the valley's and the Moon's:
// a finish, collection, bell or era marker from TOWN_ACTIONS. The map places it (its
// style), tags it with the place for the shared tap gesture and handles its click.
const props = defineProps({
  indicator: { type: String, required: true },
  label: { type: String, default: undefined },
  // A fraction of the icon's full size, for a map that draws its places smaller.
  size: { type: Number, default: 1 },
});
const action = computed(() => TOWN_ACTIONS[props.indicator]);
</script>

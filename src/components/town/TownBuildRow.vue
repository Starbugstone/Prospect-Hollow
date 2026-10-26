<template>
  <button @click="emit('select', place.id)">
    <span class="building-list-dot" :style="{ background: place.color }"></span>
    <span
      >{{ t(place.shortName) }}<small>{{ status }}</small></span
    >
    <span v-if="action === 'finish'" class="town-plot-price town-plot-ready">
      ✦ {{ t('Ready to finish') }}
    </span>
    <span v-else class="town-plot-price">
      <span class="town-sr-only">{{
        t(town.buildings[place.id] ? 'Upgrade: {coins} coins' : 'Build: {coins} coins', {
          coins: number(place.offer.cost),
        })
      }}</span>
      <TownIcon v-if="place.offer.cost" name="coin" />
      <span aria-hidden="true">{{ place.offer.cost ? number(place.offer.cost) : t('Free') }}</span>
      <span v-if="action === 'hammer'" class="town-plot-hammer">
        <img src="/art/rewards/builder-hammer.svg" alt="" />
        <span aria-hidden="true">1</span>
        <span class="town-sr-only">{{ t('1 builder hammer') }}</span>
      </span>
    </span>
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../../i18n';
import { buildingStatus } from '../../game/town/TownBuildingFeedback';
import { parcelAction } from '../../game/town/TownRules';
import TownIcon from './TownIcon.vue';

// One Build tab row, the same for every settlement's places (AGENTS.md, one build flow):
// its tap finishes, buys with coins or builds with a hammer, as the row shows. `place` is
// a parcel from availableParcels: a ready construction or an open offer.
const props = defineProps({
  place: { type: Object, required: true },
  town: { type: Object, required: true },
});
const emit = defineEmits(['select']);
// The Build tab's wording of the shared building status.
const status = computed(() => buildingStatus(props.town, props.place.id, { context: 'list' }).text);
// What the tap does, which the row shows: TownView's selectParcel reads the same rule.
const action = computed(() => parcelAction(props.town, props.place.id, props.place.offer));
</script>

<template>
  <div class="village-card">
    <button class="village-card-open" :disabled="disabled" @click="$emit('visit')">
      <TownCardArt :era="entry.era" :crest="entry.crest" aria-hidden="true" />
      <span class="village-card-info">
        <strong>{{ entry.name }}</strong>
        <small v-if="entry.era" class="town-card-era-mobile">{{ eraName(entry.era) }}</small>
        <small>{{ details }}</small>
        <HonourCardRow :honours="entry.honours" :size="26" />
        <span v-if="tags.length" class="village-card-tags">
          <span v-for="tag in tags" :key="tag.id" :class="`is-${tag.id}`"
            ><GameIcon :name="tag.icon" />{{ tag.label }}</span
          >
        </span>
      </span>
    </button>
    <button
      class="village-card-star"
      :aria-pressed="favourite"
      :aria-label="label"
      :title="label"
      :disabled="starBusy"
      @click="$emit('favourite')"
    >
      <GameIcon name="star" />
    </button>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { eraName } from '../account/accountContext';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';
import TownCardArt from '../TownCardArt.vue';
import HonourCardRow from '../honours/HonourCardRow.vue';

// One shared town in a list, in the same card shape as the player's own towns: its era,
// showcased honours, why it might be worth a visit now, and a favourite star.
const props = defineProps({
  entry: { type: Object, required: true },
  visited: Boolean,
  favourite: Boolean,
  disabled: Boolean,
  starBusy: Boolean,
});
defineEmits(['visit', 'favourite']);
const label = computed(() =>
  t(props.favourite ? 'Remove {town} from favourites' : 'Add {town} to favourites', {
    town: props.entry.name,
  }),
);
const details = computed(() => {
  const { buildings, mineLevel } = props.entry;
  return [
    buildings === 1 ? t('1 building') : t('{count} buildings', { count: buildings ?? 0 }),
    mineLevel && t('Mine level {level}', { level: mineLevel }),
  ]
    .filter(Boolean)
    .join(' · ');
});
const tags = computed(() => {
  const { visitors, saloonReady } = props.entry;
  return [
    visitors > 0 && {
      id: 'live',
      icon: 'user',
      label:
        visitors === 1
          ? t('1 visitor here now')
          : t('{count} visitors here now', { count: visitors }),
    },
    saloonReady && { id: 'saloon', icon: 'chest', label: t('Saloon takings ready') },
    (props.visited || props.entry.visited) && {
      id: 'visited',
      icon: 'check',
      label: t('Visited'),
    },
  ].filter(Boolean);
});
</script>

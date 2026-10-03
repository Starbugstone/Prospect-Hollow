<template>
  <div class="village-card" :style="{ '--slot-hue': eraHue(entry.era) ?? 90 }">
    <button class="village-card-open" :disabled="disabled" @click="$emit('visit')">
      <span class="village-card-art" aria-hidden="true"><GameIcon name="home" /></span>
      <span class="village-card-info">
        <strong>{{ entry.name }}</strong>
        <small>{{ details }}</small>
        <span v-if="honours" class="village-card-honours">
          <span
            v-for="definition in honours.showcase"
            :key="definition.id"
            :title="t(definition.name)"
          >
            <HonourBadge :definition="definition" :size="24" />
          </span>
          <small>{{
            honours.count === 1 ? t('1 honour') : t('{count} honours', { count: honours.count })
          }}</small>
        </span>
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
import { eraHue, eraName } from '../account/accountContext';
import { cardHonours } from '../../services/townDirectory';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';
import HonourBadge from '../honours/HonourBadge.vue';

// One shared town in a list: what it looks like, why it might be worth a visit now, and a
// star that keeps it among the player's favourites.
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
const honours = computed(() => cardHonours(props.entry.honours));
const details = computed(() => {
  const { era, buildings, mineLevel } = props.entry;
  return [
    eraName(era),
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

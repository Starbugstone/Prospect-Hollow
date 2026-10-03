<template>
  <button class="village-card" :style="{ '--slot-hue': eraHue(entry.era) ?? 90 }">
    <span class="village-card-art" aria-hidden="true"><GameIcon name="home" /></span>
    <span class="village-card-info">
      <strong>{{ entry.name }}</strong>
      <small>{{ details }}</small>
      <span v-if="tags.length" class="village-card-tags">
        <span v-for="tag in tags" :key="tag.id" :class="`is-${tag.id}`"
          ><GameIcon :name="tag.icon" />{{ tag.label }}</span
        >
      </span>
    </span>
    <GameIcon class="village-card-go" name="arrow" />
  </button>
</template>
<script setup>
import { computed } from 'vue';
import { eraHue, eraName } from '../account/accountContext';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';

// One shared town in a draw: what it looks like and why it might be worth a visit now.
const props = defineProps({
  entry: { type: Object, required: true },
  visited: Boolean,
});
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
    props.visited && { id: 'visited', icon: 'check', label: t('Visited') },
  ].filter(Boolean);
});
</script>

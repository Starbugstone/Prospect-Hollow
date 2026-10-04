<template>
  <span v-if="view" class="honour-card-row">
    <span
      v-if="view.showcase.length"
      class="honour-card-row-badges"
      role="img"
      :aria-label="
        t('Showcase: {names}', {
          names: view.showcase.map((definition) => t(definition.name)).join(', '),
        })
      "
    >
      <span v-for="definition in view.showcase" :key="definition.id" :title="t(definition.name)">
        <HonourBadge :definition="definition" :size="size" />
      </span>
    </span>
    <small>{{
      view.count === 1 ? t('1 honour') : t('{count} honours', { count: view.count })
    }}</small>
  </span>
</template>
<script setup>
import { computed } from 'vue';
import { cardHonours } from '../../services/townDirectory';
import { t } from '../../i18n';
import HonourBadge from './HonourBadge.vue';

// A town card's honours: the owner's showcased families (best earned rank) and the
// total, from the shared-town directory or the player's own town summary.
const props = defineProps({
  honours: { type: Object, default: null },
  size: { type: Number, default: 28 },
});
const view = computed(() => cardHonours(props.honours));
</script>
<style>
.honour-card-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem;
}
.honour-card-row-badges {
  display: inline-flex;
  gap: 0.2rem;
}
.honour-card-row-badges > span {
  display: inline-flex;
}
.honour-card-row small {
  color: #6b5a2e;
  font-weight: 600;
}
</style>

<template>
  <ul v-if="compact" class="honour-slots-compact" :aria-label="t('Showcased honours')">
    <li v-for="slot in filled" :key="slot.familyId" :title="slot.name">
      <HonourBadge :definition="slot.definition" :size="size" />
      <span class="town-sr-only">{{ slot.name }}</span>
    </li>
  </ul>
  <ol v-else class="honour-slots" :aria-label="t('Showcase')">
    <li
      v-for="(slot, index) in slots"
      :key="slot?.familyId ?? `empty-${index}`"
      :class="{ 'is-empty': !slot }"
    >
      <template v-if="slot">
        <HonourBadge :definition="slot.definition" :size="44" />
        <span class="honour-slot-name"
          >{{ t(slot.definition.name)
          }}<small :class="{ 'is-player': slot.player }">{{ slot.track.text }}</small></span
        >
      </template>
      <button v-else-if="addable" class="honour-slot-add" type="button" @click="$emit('add')">
        <span class="honour-slot-plus" aria-hidden="true">+</span>{{ t('Add an earned honour') }}
      </button>
      <span v-else class="honour-slot-empty">{{ t('Empty slot') }}</span>
    </li>
  </ol>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '../../i18n';
import HonourBadge from './HonourBadge.vue';
import { showcaseSlots } from './honourDisplay';
// The three showcase slots: full in the collection and town management, compact
// beside a shared town's name. Each slot shows its family's highest earned rank and
// metal, or the owner's player distinction (`received`, by ID).
const props = defineProps({
  ids: { type: Array, default: () => [] },
  earned: { type: Object, default: () => ({}) },
  received: { type: Object, default: () => ({}) },
  compact: Boolean,
  addable: Boolean,
  size: { type: Number, default: 34 },
});
defineEmits(['add']);
const slots = computed(() => showcaseSlots(props.ids, props.earned, props.received));
const filled = computed(() => slots.value.filter(Boolean));
</script>
<style>
.honour-slots {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.honour-slots > li {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  min-height: 64px;
  padding: 8px 12px 8px 8px;
  border: 1px solid #e0d4b2;
  border-radius: 10px;
  background: #fffdf6;
  color: #3f5545;
  font-size: 13px;
  line-height: 1.3;
}
.honour-slots > li.is-empty {
  border: 1.5px dashed #b9b090;
  background: transparent;
  color: #5f6352;
}
.honour-slots .honour-slot-add {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.honour-slots .honour-slot-add:focus-visible {
  outline: 3px solid #496d60;
  outline-offset: 4px;
}
.honour-slot-plus {
  display: grid;
  place-items: center;
  flex: 0 0 44px;
  width: 44px;
  height: 44px;
  border: 1.5px dashed #b9b090;
  border-radius: 50%;
  color: #6f6a4f;
  font-size: 22px;
}
.honour-slot-name {
  display: grid;
  gap: 1px;
  min-width: 0;
}
.honour-slot-name small {
  font-size: 11px;
  font-weight: 600;
  color: #6f5317;
}
.honour-slot-name small.is-player {
  color: #4d3384;
}
.honour-slot-empty {
  padding-left: 6px;
}
.honour-slots-compact {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  vertical-align: middle;
}
.honour-slots-compact li {
  display: inline-flex;
}
@media (max-width: 600px) {
  .honour-slots > li {
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    padding: 8px 4px;
    font-size: 11.5px;
    text-align: center;
  }
  .honour-slots .honour-slot-add {
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }
}
</style>

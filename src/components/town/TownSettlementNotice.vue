<template>
  <aside class="town-settlement-notice" role="status" aria-live="polite" @pointerdown.stop>
    <span v-if="!later">{{ t(labels.happening) }}</span>
    <span v-else>{{ t(labels.waiting) }}</span>
    <button type="button" @click="emit('watch')">{{ t('Watch') }}</button>
    <button v-if="!later" type="button" @click="later = true">{{ t('Later') }}</button>
  </aside>
</template>
<script setup>
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import { SETTLEMENTS, settlementById } from '../../data/settlements';
const props = defineProps({ destination: String });
// The destination settlement's words (settlements.js); an unknown one reads as the valley.
const labels = computed(() => (settlementById(props.destination) ?? SETTLEMENTS[0]).labels);
const emit = defineEmits(['watch']);
const later = ref(false);
</script>
<style scoped>
.town-settlement-notice {
  position: absolute;
  z-index: 18;
  bottom: 5rem;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: calc(100% - 2rem);
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.65rem 0.85rem;
  border: 1px solid #b7c9de80;
  border-radius: 1rem;
  background: #17283aee;
  color: #fff2d4;
  box-shadow: 0 3px 14px #0005;
  font-size: 0.85rem;
}
button {
  color: inherit;
  background: #ffffff12;
  border: 1px solid #b7c9de80;
  border-radius: 1rem;
  padding: 0.45rem 0.7rem;
  cursor: pointer;
}
button:focus-visible {
  outline: 3px solid #eed9a7;
  outline-offset: 3px;
}
@media (max-width: 600px) {
  .town-settlement-notice {
    flex-wrap: wrap;
    justify-content: center;
  }
}
</style>

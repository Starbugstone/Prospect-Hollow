<template>
  <span
    class="moonstone-balance"
    :aria-label="t('Moonstones: {count}', { count: number(town.moonstones ?? 0) })"
    :title="t('Moonstones')"
  >
    <img src="/art/moonstone.svg" width="22" height="22" alt="" />
    <strong>{{ number(town.moonstones ?? 0) }}</strong>
  </span>
</template>
<script setup>
import { number, t } from '../../i18n';
defineProps({ town: { type: Object, required: true } });
</script>
<style scoped>
.moonstone-balance {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}
.moonstone-balance img {
  width: var(--moonstone-size, 22px);
  height: var(--moonstone-size, 22px);
  object-fit: contain;
}
</style>

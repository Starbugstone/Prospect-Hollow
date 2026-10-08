<template>
  <aside v-show="notice" class="town-visitor-notice">
    <GameIcon :name="coinNotice ? 'chest' : 'eye'" aria-hidden="true" />
    <p role="status" aria-live="polite" aria-atomic="true">{{ message }}</p>
    <button
      v-if="notice?.kind === 'arrival'"
      class="visitor-find"
      @click="$emit('find', notice.visitor.id)"
    >
      {{ t('Find visitor') }}
    </button>
    <button :aria-label="t('Dismiss visitor notification')" @click="$emit('dismiss')">×</button>
  </aside>
</template>
<script setup>
import { computed } from 'vue';
import GameIcon from '../GameIcon.vue';
import { visitorLabel } from '../../data/liveVisitors';
import { t, number } from '../../i18n';
const props = defineProps({ notice: Object });
defineEmits(['dismiss', 'find']);
const coinNotice = computed(() =>
  ['collection', 'helmet', 'helmet-found', 'helmet-empty'].includes(props.notice?.kind),
);
const message = computed(() => {
  const notice = props.notice;
  if (!notice) return '';
  switch (notice.kind) {
    case 'collection':
      return t('A visitor collected {coins} coins from your saloon for you.', {
        coins: number(notice.coins),
      });
    case 'helmet':
      return t('You found an astronaut while visiting another town: {coins} coins.', {
        coins: number(notice.coins),
      });
    case 'helmet-found':
      return t(
        'You already found the astronaut. It moves to another animal after your next puzzle.',
      );
    case 'helmet-empty':
      return t('You found the astronaut! Its reward is an hour of your saloon takings.');
    case 'helmet-zoom':
      return t('Zoom in closer to the animals to find the astronaut.');
    case 'unavailable':
      return t(
        'This visitor is no longer visible. Check the guestbook for the latest visit details.',
      );
    default:
      return t(
        notice.kind === 'arrival' ? '{name} arrived in your town.' : '{name} left your town.',
        { name: visitorLabel(notice.visitor) },
      );
  }
});
</script>
<style scoped>
.town-visitor-notice {
  position: absolute;
  z-index: 8;
  top: max(112px, calc(env(safe-area-inset-top) + 112px));
  right: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
  width: min(360px, calc(100% - 24px));
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid #bca8bf;
  border-radius: 12px;
  background: #faf5fa;
  color: #48364d;
  box-shadow: 0 4px 18px #35283b24;
  font:
    14px/1.5 'Segoe UI',
    sans-serif;
}
.town-visitor-notice > svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: #82518b;
}
p {
  flex: 1;
  margin: 0;
  overflow-wrap: anywhere;
}
button {
  flex-shrink: 0;
  width: 44px;
  height: 44px;
  border: 0;
  border-radius: 50%;
  background: #eee4ef;
  color: inherit;
  font-size: 24px;
  cursor: pointer;
}
button:focus-visible {
  outline: 2px solid #82518b;
  outline-offset: 2px;
}
.visitor-find {
  width: auto;
  padding: 8px;
  border-radius: 8px;
  font: inherit;
  max-width: 90px;
}
</style>

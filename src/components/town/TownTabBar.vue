<template>
  <nav ref="bar" class="town-tab-bar" :aria-label="t('Village navigation')">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      :class="[`town-tab-${tab.id}`, { current: current === tab.id, nudge: tab.nudge }]"
      :aria-current="current === tab.id ? 'page' : undefined"
      @click="$emit('select', tab.id)"
    >
      <GameIcon :name="tab.icon" />
      <span>{{ tab.label }}</span>
      <i v-if="tab.badge" class="town-tab-badge" aria-hidden="true">{{ tab.badge }}</i>
    </button>
  </nav>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';

// One bar for every village destination. The mine is the main action of the game,
// so its tab stands out and names the level it opens.
const props = defineProps({
  current: { type: String, default: 'village' },
  // Purchases and finished constructions waiting in Build.
  buildCount: { type: Number, default: 0 },
  // Draws the eye to Build for a new player or a construction ready to finish.
  buildNudge: Boolean,
  mineLabel: { type: String, required: true },
});
const emit = defineEmits(['select', 'height']);
// Sheets end at the bar, so it stays visible and usable while they are open.
const bar = ref(null);
let observer;
onMounted(() => {
  observer = new ResizeObserver(() => emit('height', bar.value.offsetHeight));
  observer.observe(bar.value);
});
onBeforeUnmount(() => {
  observer?.disconnect();
  emit('height', 0);
});
const tabs = computed(() => [
  { id: 'village', icon: 'home', label: t('Village') },
  {
    id: 'build',
    icon: 'hammer',
    label: t('Build'),
    badge: props.buildCount > 9 ? '9+' : props.buildCount || '',
    nudge: props.buildNudge,
  },
  { id: 'mine', icon: 'pickaxe', label: props.mineLabel },
  { id: 'story', icon: 'book', label: t('Story') },
  { id: 'more', icon: 'menu', label: t('More') },
]);
</script>

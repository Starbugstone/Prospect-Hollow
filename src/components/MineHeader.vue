<template>
  <header ref="header" class="mine-header">
    <button
      class="icon-button mine-back"
      :aria-label="t('Back to village')"
      :title="t('Back to village')"
      @click="$emit('town')"
    >
      <GameIcon name="back" />
    </button>
    <h1 :title="`${t('Level {level}', { level: game.currentLevelId })} — ${t(levelName)}`">
      <span class="mine-level-number">{{ t('Level {level}', { level: game.currentLevelId }) }}</span
      ><span class="mine-level-name"> — {{ t(levelName) }}</span>
      <span class="mine-level-short" aria-hidden="true">#{{ game.currentLevelId }}</span>
    </h1>
    <MineGoals :initial-tiles="initialTiles" />
    <details
      ref="drawer"
      class="mine-menu"
      :open="open"
      @toggle.self="$emit('update:open', $event.target.open)"
      @keydown.esc.stop="close"
    >
      <summary
        ref="handle"
        :aria-label="t('Level status and controls')"
        :title="t('Level status and controls')"
      >
        <GameIcon name="settings" />
      </summary>
      <button
        class="mine-menu-scrim"
        :aria-label="t('Close level details')"
        @click="close"
      ></button>
      <div class="mine-menu-panel">
        <h2>{{ t('Paused') }}</h2>
        <MineGoals v-if="open" :initial-tiles="initialTiles" />
        <HudPanel />
        <div class="mine-menu-actions">
          <button @click="settings.toggleSettings(true)">{{ t('Settings') }}</button>
          <button @click="$emit('toggle-mute')">
            {{ t(muted ? 'Unmute audio' : 'Mute audio') }}
          </button>
          <button
            @click="
              close();
              $emit('guide');
            "
          >
            {{ t('Mining guide') }}
          </button>
          <button class="mine-play-button" @click="close">{{ t('Resume') }}</button>
        </div>
      </div>
    </details>
  </header>
</template>
<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { t } from '../i18n';
import GameIcon from './GameIcon.vue';
import HudPanel from './HudPanel.vue';
import MineGoals from './MineGoals.vue';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
defineProps({ open: Boolean, muted: Boolean, levelName: String });
const emit = defineEmits(['update:open', 'height', 'toggle-mute', 'town', 'guide']);
const game = useGameStore();
const settings = useSettingsStore();
const initialTiles = computed(
  () => game.availableLevels.find((level) => level.id === game.currentLevelId)?.config.tiles,
);
const drawer = ref(null),
  handle = ref(null);
const header = ref(null);
let sizeObserver;
onMounted(() => {
  // Longer chapter titles and multiple objectives can wrap onto another row.
  // Reserve their actual height so the board and owned powers still fit.
  const measure = () => emit('height', header.value.getBoundingClientRect().height);
  measure();
  sizeObserver = new ResizeObserver(measure);
  sizeObserver.observe(header.value);
});
function close() {
  drawer.value.open = false;
  emit('update:open', false);
  handle.value?.focus({ preventScroll: true });
}
onBeforeUnmount(() => {
  sizeObserver?.disconnect();
  emit('update:open', false);
});
</script>

<template>
  <header class="mine-header">
    <button
      class="icon-button mine-back"
      :aria-label="t('Back to village')"
      :title="t('Back to village')"
      @click="$emit('town')"
    >
      <GameIcon name="back" />
    </button>
    <h1>
      <span>{{ t('Level {level}', { level: game.currentLevelId }) }}</span
      ><span class="mine-level-name"> — {{ t(levelName) }}</span>
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
import { computed, onBeforeUnmount, ref } from 'vue';
import { t } from '../i18n';
import GameIcon from './GameIcon.vue';
import HudPanel from './HudPanel.vue';
import MineGoals from './MineGoals.vue';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
defineProps({ open: Boolean, muted: Boolean, levelName: String });
const emit = defineEmits(['update:open', 'toggle-mute', 'town', 'guide']);
const game = useGameStore();
const settings = useSettingsStore();
const initialTiles = computed(
  () => game.availableLevels.find((level) => level.id === game.currentLevelId)?.config.tiles,
);
const drawer = ref(null),
  handle = ref(null);
function close() {
  drawer.value.open = false;
  emit('update:open', false);
  handle.value?.focus({ preventScroll: true });
}
onBeforeUnmount(() => emit('update:open', false));
</script>

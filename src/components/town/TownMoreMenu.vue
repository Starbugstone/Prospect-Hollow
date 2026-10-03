<template>
  <nav class="town-more-menu" :aria-label="t('More')">
    <button @click="$emit('projects')">
      <GameIcon name="clipboard" /><span>{{ t('Town projects') }}</span>
    </button>
    <button v-if="canReplay" @click="$emit('museum')">
      <GameIcon name="star" /><span>{{ t('Museum') }}</span
      ><small>{{ t('Replay levels') }}</small>
    </button>
    <button @click="$emit('supplies')">
      <GameIcon name="chest" /><span>{{ t('Supplies') }}</span>
    </button>
    <button v-if="sharedTowns" @click="$emit('shared')">
      <GameIcon name="eye" /><span>{{ t('Shared towns') }}</span>
    </button>
    <button @click="$emit('tour')">
      <GameIcon name="info" /><span>{{ t('Help & village tour') }}</span>
    </button>
    <button @click="$emit('settings')">
      <GameIcon name="settings" /><span>{{ t('Settings') }}</span>
    </button>
    <button :aria-pressed="muted" @click="$emit('mute')">
      <GameIcon :name="muted ? 'muted' : 'sound'" /><span>{{
        t(muted ? 'Unmute audio' : 'Mute audio')
      }}</span>
    </button>
    <button @click="$emit('home')">
      <GameIcon name="external" /><span>{{ t('Prospect Hollow home') }}</span>
    </button>
  </nav>
</template>
<script setup>
import { t } from '../../i18n';
import GameIcon from '../GameIcon.vue';

// Everything that is not a daily destination, one tap from the More tab.
defineProps({ canReplay: Boolean, sharedTowns: Boolean, muted: Boolean });
defineEmits(['projects', 'museum', 'supplies', 'shared', 'tour', 'settings', 'mute', 'home']);
</script>

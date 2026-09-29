import { defineStore } from 'pinia';

// Device-only preferences: kept apart from the synced save and from progress resets.
// Storage restrictions keep each choice for this session only.
const readPreference = (key, parse, fallback) => {
  try {
    const saved = globalThis.localStorage?.getItem(key);
    return saved == null ? fallback : parse(saved);
  } catch {
    return fallback;
  }
};
const writePreference = (key, value) => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // The choice still applies until the page closes.
  }
};

const VILLAGE_LABELS_KEY = 'crystal-cascade-village-labels';
// null until the player first opens or hides village progress themselves.
const VILLAGE_PROGRESS_KEY = 'crystal-cascade-village-progress';
const AUDIO_LEVELS_KEY = 'crystal-cascade-audio-levels';
export const DEFAULT_AUDIO_LEVELS = Object.freeze({ music: 0.6, sfx: 0.8 });
const audioLevel = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const savedAudioLevels = () => {
  const saved = readPreference(AUDIO_LEVELS_KEY, JSON.parse, null);
  return {
    music: audioLevel(saved?.music, DEFAULT_AUDIO_LEVELS.music),
    sfx: audioLevel(saved?.sfx, DEFAULT_AUDIO_LEVELS.sfx),
  };
};

export const useSettingsStore = defineStore('settings', {
  state: () => {
    const audio = savedAudioLevels();
    return {
      isSettingsOpen: false,
      musicVolume: audio.music,
      sfxVolume: audio.sfx,
      // Follows the system "reduce motion" preference: it softens big one-off effects
      // (cinematics, bursts, count-ups, raids). The village itself always moves.
      reducedMotion:
        typeof window !== 'undefined' &&
        (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
      highContrastMode: false,
      showVillageLabels: readPreference(VILLAGE_LABELS_KEY, (saved) => saved !== 'false', true),
      villageProgressOpen: readPreference(VILLAGE_PROGRESS_KEY, (saved) => saved === 'true', null),
    };
  },
  actions: {
    setVillageLabels(visible) {
      this.showVillageLabels = visible !== false;
      writePreference(VILLAGE_LABELS_KEY, String(this.showVillageLabels));
    },
    setVillageProgress(open) {
      this.villageProgressOpen = open === true;
      writePreference(VILLAGE_PROGRESS_KEY, String(this.villageProgressOpen));
    },
    toggleSettings(explicit) {
      if (typeof explicit === 'boolean') {
        this.isSettingsOpen = explicit;
        return;
      }
      this.isSettingsOpen = !this.isSettingsOpen;
    },
    setMusicVolume(value) {
      this.musicVolume = audioLevel(Number(value), this.musicVolume);
      this.saveAudioLevels();
    },
    setSfxVolume(value) {
      this.sfxVolume = audioLevel(Number(value), this.sfxVolume);
      this.saveAudioLevels();
    },
    saveAudioLevels() {
      writePreference(
        AUDIO_LEVELS_KEY,
        JSON.stringify({ music: this.musicVolume, sfx: this.sfxVolume }),
      );
    },
    setHighContrast(value) {
      this.highContrastMode = value;
    },
  },
});

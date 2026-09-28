import { defineStore } from 'pinia';

// Keep this visual preference independent of progress resets.
const VILLAGE_LABELS_KEY = 'crystal-cascade-village-labels';
const savedVillageLabels = () => {
  try {
    return globalThis.localStorage?.getItem(VILLAGE_LABELS_KEY) !== 'false';
  } catch {
    return true;
  }
};

// null until the player first opens or hides village progress themselves.
const VILLAGE_PROGRESS_KEY = 'crystal-cascade-village-progress';
const savedVillageProgress = () => {
  try {
    const saved = globalThis.localStorage?.getItem(VILLAGE_PROGRESS_KEY);
    return saved === null || saved === undefined ? null : saved === 'true';
  } catch {
    return null;
  }
};

// Audio levels stay on this device only; they are not part of the synced save.
const AUDIO_LEVELS_KEY = 'crystal-cascade-audio-levels';
const DEFAULT_AUDIO_LEVELS = Object.freeze({ music: 0.6, sfx: 0.8 });
const audioLevel = (value, fallback) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : fallback;
const savedAudioLevels = () => {
  try {
    const saved = JSON.parse(globalThis.localStorage?.getItem(AUDIO_LEVELS_KEY) ?? 'null');
    return {
      music: audioLevel(saved?.music, DEFAULT_AUDIO_LEVELS.music),
      sfx: audioLevel(saved?.sfx, DEFAULT_AUDIO_LEVELS.sfx),
    };
  } catch {
    return { ...DEFAULT_AUDIO_LEVELS };
  }
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
      showVillageLabels: savedVillageLabels(),
      villageProgressOpen: savedVillageProgress(),
    };
  },
  actions: {
    setVillageLabels(visible) {
      this.showVillageLabels = visible !== false;
      try {
        globalThis.localStorage?.setItem(VILLAGE_LABELS_KEY, String(this.showVillageLabels));
      } catch {
        // Storage restrictions still allow the choice for this session.
      }
    },
    setVillageProgress(open) {
      this.villageProgressOpen = open === true;
      try {
        globalThis.localStorage?.setItem(VILLAGE_PROGRESS_KEY, String(this.villageProgressOpen));
      } catch {
        // Storage restrictions still allow the choice for this session.
      }
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
      try {
        globalThis.localStorage?.setItem(
          AUDIO_LEVELS_KEY,
          JSON.stringify({ music: this.musicVolume, sfx: this.sfxVolume }),
        );
      } catch {
        // Storage restrictions still allow the levels for this session.
      }
    },
    setHighContrast(value) {
      this.highContrastMode = value;
    },
  },
});

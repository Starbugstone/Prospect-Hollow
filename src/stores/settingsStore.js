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

export const useSettingsStore = defineStore('settings', {
  state: () => ({
    isSettingsOpen: false,
    musicVolume: 0.6,
    sfxVolume: 0.8,
    reducedMotion:
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
    highContrastMode: false,
    showVillageLabels: savedVillageLabels(),
    villageProgressOpen: savedVillageProgress(),
  }),
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
      this.musicVolume = Number(value);
    },
    setSfxVolume(value) {
      this.sfxVolume = Number(value);
    },
    setReducedMotion(value) {
      this.reducedMotion = value;
    },
    setHighContrast(value) {
      this.highContrastMode = value;
    },
  },
});

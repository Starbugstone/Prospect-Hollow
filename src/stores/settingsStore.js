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
const HONOUR_NOTICES_KEY = 'crystal-cascade-honour-notices';
const GUESTBOOK_COLLAPSED_KEY = 'crystal-cascade-guestbook-collapsed';
// Town Honours notices: Full (popup and sound), Quiet (New indicator only) or Off.
// Presentation only: honours still unlock and stay inspectable.
export const HONOUR_NOTICE_MODES = Object.freeze(['full', 'quiet', 'off']);
const AUDIO_LEVELS_KEY = 'crystal-cascade-audio-levels';
const DEFAULT_AUDIO_LEVELS = Object.freeze({ music: 0.6, sfx: 0.8 });
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
      unmutedLevels: null,
      showVillageLabels: readPreference(VILLAGE_LABELS_KEY, (saved) => saved !== 'false', true),
      honourNotices: readPreference(
        HONOUR_NOTICES_KEY,
        (saved) => (HONOUR_NOTICE_MODES.includes(saved) ? saved : 'full'),
        'full',
      ),
      // The guestbook stays open or folded as the player last left it.
      guestbookCollapsed: readPreference(
        GUESTBOOK_COLLAPSED_KEY,
        (saved) => saved === 'true',
        false,
      ),
    };
  },
  actions: {
    setVillageLabels(visible) {
      this.showVillageLabels = visible !== false;
      writePreference(VILLAGE_LABELS_KEY, String(this.showVillageLabels));
    },
    setGuestbookCollapsed(collapsed) {
      this.guestbookCollapsed = collapsed === true;
      writePreference(GUESTBOOK_COLLAPSED_KEY, String(this.guestbookCollapsed));
    },
    setHonourNotices(mode) {
      if (!HONOUR_NOTICE_MODES.includes(mode)) return;
      this.honourNotices = mode;
      writePreference(HONOUR_NOTICES_KEY, mode);
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
    // One tap silences music and effects; the next restores the levels from before.
    toggleMute() {
      if (this.musicVolume === 0 && this.sfxVolume === 0) {
        const [music, sfx] = this.unmutedLevels ?? [
          DEFAULT_AUDIO_LEVELS.music,
          DEFAULT_AUDIO_LEVELS.sfx,
        ];
        this.musicVolume = music;
        this.sfxVolume = sfx;
      } else {
        this.unmutedLevels = [this.musicVolume, this.sfxVolume];
        this.musicVolume = this.sfxVolume = 0;
      }
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

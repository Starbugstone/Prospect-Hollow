import { afterEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useSettingsStore } from '../src/stores/settingsStore';

afterEach(() => vi.unstubAllGlobals());
const freshSettings = () => {
  setActivePinia(createPinia());
  return useSettingsStore();
};
it('defaults village labels on and remembers either choice in a new session', () => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  const settings = freshSettings();
  expect(settings.showVillageLabels).toBe(true);
  settings.setVillageLabels(false);
  expect(freshSettings().showVillageLabels).toBe(false);
  freshSettings().setVillageLabels(true);
  expect(freshSettings().showVillageLabels).toBe(true);
});
it('keeps the toggle usable when preference storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
  });
  const settings = freshSettings();
  expect(settings.showVillageLabels).toBe(true);
  expect(() => settings.setVillageLabels(false)).not.toThrow();
  expect(settings.showVillageLabels).toBe(false);
});
it('remembers whether the player keeps village progress open or hidden', () => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  expect(freshSettings().villageProgressOpen).toBeNull();
  freshSettings().setVillageProgress(true);
  expect(freshSettings().villageProgressOpen).toBe(true);
  freshSettings().setVillageProgress(false);
  expect(freshSettings().villageProgressOpen).toBe(false);
});
it('remembers music and sound effect levels on this device in a new session', () => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  const settings = freshSettings();
  expect([settings.musicVolume, settings.sfxVolume]).toEqual([0.6, 0.8]);
  // Range inputs report strings.
  settings.setMusicVolume('0.25');
  settings.setSfxVolume('0');
  const reopened = freshSettings();
  expect([reopened.musicVolume, reopened.sfxVolume]).toEqual([0.25, 0]);
  // Only this device-local key is written; the synced profile is untouched.
  expect([...saved.keys()]).toEqual(['crystal-cascade-audio-levels']);
});
it('falls back to default audio levels when the saved levels are unusable', () => {
  const saved = new Map([['crystal-cascade-audio-levels', '{"music":"loud","sfx":7}']]);
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  const settings = freshSettings();
  expect([settings.musicVolume, settings.sfxVolume]).toEqual([0.6, 1]);
  saved.set('crystal-cascade-audio-levels', 'not json');
  const broken = freshSettings();
  expect([broken.musicVolume, broken.sfxVolume]).toEqual([0.6, 0.8]);
});
it('keeps the volume sliders usable when preference storage is unavailable', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('Storage unavailable');
    },
    setItem: () => {
      throw new Error('Storage unavailable');
    },
  });
  const settings = freshSettings();
  expect(settings.musicVolume).toBe(0.6);
  expect(() => settings.setMusicVolume('0.3')).not.toThrow();
  expect(settings.musicVolume).toBe(0.3);
});

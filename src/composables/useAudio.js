import { Howl, Howler } from 'howler';
import { onBeforeUnmount, watch } from 'vue';
import { useSettingsStore } from '../stores/settingsStore';

const clampVolume = (value) => Math.min(1, Math.max(0, value ?? 0));

const AMBIENT_SOURCES = ['/sound/mining/lanterns-below.ogg', '/sound/mining/lanterns-below.mp3'];
// Match the village's restrained music mix, leaving room for crystal effects.
const AMBIENT_VOLUME = 0.45;

const SFX_VOLUME = Object.freeze({
  MATCH: 0.55,
  COMBO: 0.75,
  BONUS_APPEAR: 0.7,
  CROSS_FIRE: 0.8,
  BOMB: 0.85,
  RAINBOW_LASER: 0.65,
});

const SFX_KEYS = Object.freeze({
  MATCH: 'match-basic',
  COMBO: 'match-combo',
  BONUS_APPEAR: 'bonus-appears',
  CROSS_FIRE: 'cross-activate',
  BOMB: 'bomb-activate',
  RAINBOW_LASER: 'rainbow-laser',
});

const SFX_DEFINITIONS = {
  [SFX_KEYS.MATCH]: {
    src: ['/sound/gem1.mp3'],
    baseVolume: SFX_VOLUME.MATCH,
  },
  [SFX_KEYS.COMBO]: {
    src: ['/sound/gem-combo.mp3'],
    baseVolume: SFX_VOLUME.COMBO,
  },
  [SFX_KEYS.BONUS_APPEAR]: {
    src: ['/sound/bonus-appears.mp3'],
    baseVolume: SFX_VOLUME.BONUS_APPEAR,
  },
  [SFX_KEYS.CROSS_FIRE]: {
    src: ['/sound/boom-fire.mp3'],
    baseVolume: SFX_VOLUME.CROSS_FIRE,
  },
  [SFX_KEYS.BOMB]: {
    src: ['/sound/explosion.mp3'],
    baseVolume: SFX_VOLUME.BOMB,
  },
  [SFX_KEYS.RAINBOW_LASER]: {
    src: ['/sound/laser.ogg'],
    baseVolume: SFX_VOLUME.RAINBOW_LASER,
  },
};

let ambientHowl;
let ambientSoundId = null;
const sfxHowls = new Map();

const ensureAmbientHowl = (settingsStore) => {
  if (!ambientHowl) {
    ambientHowl = new Howl({
      src: AMBIENT_SOURCES,
      loop: true,
      preload: true,
      volume: clampVolume(settingsStore.musicVolume) * AMBIENT_VOLUME,
    });
    ambientHowl.on('loaderror', (_id, error) => {
      console.error('Failed to load ambient loop audio', error);
    });
  }
  return ambientHowl;
};

const ensureSfxHowl = (key, settingsStore) => {
  const cached = sfxHowls.get(key);
  if (cached) {
    return cached;
  }

  const definition = SFX_DEFINITIONS[key];
  if (!definition) {
    console.warn(`Missing SFX definition for key "${key}"`);
    return null;
  }

  const howl = new Howl({
    src: definition.src,
    preload: true,
    volume: clampVolume(definition.baseVolume * settingsStore.sfxVolume),
  });

  howl.on('loaderror', (_id, error) => {
    console.error(`Failed to load SFX "${key}"`, error);
  });

  const entry = { howl, baseVolume: definition.baseVolume };
  sfxHowls.set(key, entry);
  return entry;
};

export const useAudio = () => {
  const settingsStore = useSettingsStore();

  const applyAmbientVolume = () => {
    if (!ambientHowl) {
      return;
    }
    const effective = clampVolume(settingsStore.musicVolume) * AMBIENT_VOLUME;
    if (ambientSoundId != null) {
      ambientHowl.volume(effective, ambientSoundId);
    } else {
      ambientHowl.volume(effective);
    }
  };

  const applySfxVolumes = () => {
    sfxHowls.forEach(({ howl, baseVolume }) => {
      howl.volume(clampVolume(baseVolume * settingsStore.sfxVolume));
    });
  };

  const playSfx = (key, { rate, seek } = {}) => {
    const entry = ensureSfxHowl(key, settingsStore);
    if (!entry) {
      return null;
    }

    const { howl, baseVolume } = entry;
    const effectiveVolume = clampVolume(baseVolume * settingsStore.sfxVolume);
    howl.volume(effectiveVolume);

    const soundId = howl.play();
    if (soundId != null) {
      howl.volume(effectiveVolume, soundId);
      if (typeof rate === 'number') {
        howl.rate(rate, soundId);
      }
      if (typeof seek === 'number') {
        howl.seek(seek, soundId);
      }
    }
    return soundId;
  };

  const playMatch = ({ comboCount = 1 } = {}) => {
    const key = comboCount >= 4 ? SFX_KEYS.COMBO : SFX_KEYS.MATCH;
    return playSfx(key, { rate: Math.min(1.35, 1 + (comboCount - 1) * 0.07) });
  };

  const playArcadeCue = (kind, index = 0) => {
    const ctx = Howler.ctx;
    if (!ctx || ctx.state !== 'running' || settingsStore.sfxVolume <= 0) return;
    const notes =
      kind === 'era-departure'
        ? [196, 246.94, 293.66, 392]
        : kind === 'era-reveal'
          ? [261.63, 329.63, 392, 523.25, 659.25, 783.99]
          : kind === 'town-bell'
            ? [523.25, 1046.5, 1569.75]
            : kind === 'coin'
              ? [784 + index * 88]
              : kind === 'chest-charge'
                ? [392, 493.88, 587.33]
                : kind === 'chest-open'
                  ? [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98]
                  : kind === 'fusion-charge'
                    ? [130.81, 196, 261.63, 392, 523.25, 784]
                    : kind === 'fusion-aftershock'
                      ? [98, 196, 392]
                      : kind === 'fusion-impact'
                        ? [65.41, 130.81, 261.63, 523.25]
                        : kind === 'charge'
                          ? [196, 294, 392, 588, 784]
                          : kind === 'jackpot'
                            ? [523, 659, 784, 1046, 1568]
                            : kind === 'reel-tick'
                              ? [420 + (index % 5) * 65]
                              : [660 + index * 110, 990 + index * 110];
    const voices = [];
    notes.forEach((frequency, i) => {
      const oscillator = ctx.createOscillator(),
        gain = ctx.createGain();
      const start = ctx.currentTime + i * (kind.startsWith('era-') ? 0.32 : 0.09);
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(frequency, start);
      if (kind === 'fusion-impact') {
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.4, start + 0.45);
      }
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(settingsStore.sfxVolume * 0.09, start + 0.012);
      const duration = kind.startsWith('era-')
        ? 2.4
        : kind === 'town-bell'
          ? 0.9
          : kind === 'reel-tick'
            ? 0.055
            : kind === 'fusion-impact'
              ? 0.5
              : 0.22;
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      oscillator.connect(gain);
      gain.connect(Howler.masterGain ?? ctx.destination);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
      voices.push({ oscillator, gain });
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    });
    return () => {
      for (const { oscillator, gain } of voices) {
        gain.disconnect();
        oscillator.stop();
      }
      voices.length = 0;
    };
  };

  const playBonusAppears = () => playSfx(SFX_KEYS.BONUS_APPEAR);
  const playCrossFire = () => playSfx(SFX_KEYS.CROSS_FIRE);
  const playBomb = () => playSfx(SFX_KEYS.BOMB);
  const playRainbowLaser = () => playSfx(SFX_KEYS.RAINBOW_LASER);

  const playAmbientLoop = () => {
    Object.keys(SFX_DEFINITIONS).forEach((key) => ensureSfxHowl(key, settingsStore));
    const loop = ensureAmbientHowl(settingsStore);
    const targetVolume = clampVolume(settingsStore.musicVolume) * AMBIENT_VOLUME;

    if (ambientSoundId != null && loop.playing(ambientSoundId)) {
      const currentVolume = loop.volume(ambientSoundId);
      if (Math.abs(currentVolume - targetVolume) > 0.001) {
        loop.fade(currentVolume, targetVolume, 200, ambientSoundId);
      }
      return ambientSoundId;
    }

    loop.volume(0);
    ambientSoundId = loop.play();
    if (targetVolume > 0) loop.fade(0, targetVolume, 1400, ambientSoundId);
    return ambientSoundId;
  };

  const stopAmbientLoop = ({ fadeMs = 450 } = {}) => {
    if (!ambientHowl || ambientSoundId == null) {
      return;
    }

    const loop = ambientHowl;
    const soundId = ambientSoundId;
    ambientSoundId = null;

    const startingVolume = loop.volume(soundId);
    // Howler never completes a zero-to-zero fade; stop muted music immediately.
    if (fadeMs > 0 && startingVolume > 0) {
      // Cancel an entrance fade before subscribing to the exit fade's completion.
      loop.volume(startingVolume, soundId);
      loop.once(
        'fade',
        () => {
          loop.stop(soundId);
        },
        soundId,
      );
      loop.fade(startingVolume, 0, fadeMs, soundId);
    } else {
      loop.stop(soundId);
    }
  };

  watch(
    () => settingsStore.musicVolume,
    () => applyAmbientVolume(),
    { immediate: true },
  );

  watch(
    () => settingsStore.sfxVolume,
    () => applySfxVolumes(),
    { immediate: true },
  );

  onBeforeUnmount(() => {
    stopAmbientLoop({ fadeMs: 0 });
  });

  return {
    playAmbientLoop,
    stopAmbientLoop,
    playSfx,
    playMatch,
    playBonusAppears,
    playArcadeCue,
    playCrossFire,
    playBomb,
    playRainbowLaser,
  };
};

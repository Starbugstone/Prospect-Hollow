import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { INCIDENT_AUDIO } from '../src/data/townEvents';
import {
  TownSoundscape,
  villageSounds,
  villageAmbienceGain,
  VILLAGE_AUDIO,
} from '../src/game/audio/TownSoundscape';

const instances = [];
afterEach(() => {
  instances.splice(0).forEach((audio) => audio.dispose());
  vi.useRealTimers();
});
const flush = async () => {
  for (let n = 0; n < 12; n++) await Promise.resolve();
};
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
function setup(options = {}) {
  vi.useFakeTimers();
  const parameter = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelScheduledValues: vi.fn(),
  });
  const sources = [];
  const ctx = {
    state: 'running',
    currentTime: 0,
    destination: {},
    close: vi.fn().mockResolvedValue(),
    resume: vi.fn(async () => {
      ctx.state = 'running';
    }),
    createGain: () => ({ gain: parameter(), connect: vi.fn(), disconnect: vi.fn() }),
    createMediaElementSource: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn() })),
    decodeAudioData: vi.fn(async () => ({ duration: 24 })),
    createBufferSource: () => {
      const source = { connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      sources.push(source);
      return source;
    },
  };
  const player = {
    paused: true,
    currentTime: 0,
    play: vi.fn(async () => {
      player.paused = false;
    }),
    pause: vi.fn(() => {
      player.paused = true;
    }),
    removeAttribute: vi.fn(),
    load: vi.fn(),
  };
  const fetchAudio = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }));
  const audio = new TownSoundscape({
    contextFactory: () => ctx,
    mediaFactory: () => player,
    fetchAudio,
    random: () => 0.25,
    ...options,
  });
  instances.push(audio);
  const update = (state = {}) => audio.update({ ...audio.state, ...state });
  update({ paused: false, musicVolume: 0.6, sfxVolume: 0.8, population: 4 });
  return { audio, ctx, player, sources, fetchAudio, update };
}

it('matches recordings to inhabitants, buildings, work, and raid', () => {
  expect(villageSounds({})).toEqual(['birds', 'mining']);
  expect(villageSounds({ population: 2, construction: true, stable: true })).toEqual([
    'birds',
    'mining',
    'chatter',
    'building',
    'horse',
    'hooves',
  ]);
  expect(villageSounds({ population: 20, construction: true, stable: true, raid: '1' })).toEqual([
    'hooves',
  ]);
});

it('adds river ambience and sparse era transport cues and cancels their stale loads on pause', async () => {
  const pending = deferred();
  const { audio, update } = setup({ fetchAudio: () => pending.promise });
  update({ river: true, railDepot: true, riverPort: true });
  await audio.unlock();
  expect(villageSounds(audio.state)).toEqual(
    expect.arrayContaining(['river', 'train', 'steamboat']),
  );
  audio.playLife('train');
  audio.playLife('steamboat');
  update({ paused: true });
  pending.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
  await flush();
  expect(audio.sources.size).toBe(0);
  expect(audio.pending.size).toBe(0);
  expect(audio.lifeTimer).toBeNull();
  update({ paused: false });
  await flush();
  expect(audio.sources.has('river')).toBe(true);
  expect(audio.sources.get('river').source.loop).toBe(true);
  expect(audio.level('river')).toBeLessThan(audio.level('birds'));
  expect(VILLAGE_AUDIO.train.loop).not.toBe(true);
  expect(VILLAGE_AUDIO.steamboat.loop).not.toBe(true);
});

describe('Recorded village soundscape', () => {
  it('silences both output buses immediately and cannot unlock while the mine is active', async () => {
    const { audio, ctx, update, player } = setup();
    await audio.unlock();
    await flush();
    expect(audio.sources.size).toBeGreaterThan(0);
    update({ paused: true });
    for (const bus of [audio.music, audio.sfx]) {
      expect(bus.gain.cancelScheduledValues).toHaveBeenLastCalledWith(ctx.currentTime);
      expect(bus.gain.setValueAtTime).toHaveBeenLastCalledWith(0, ctx.currentTime);
      expect(bus.disconnect).toHaveBeenCalled();
    }
    expect(audio.outputsConnected).toBe(false);
    expect(audio.sources.size).toBe(0);
    expect(player.paused).toBe(true);
    ctx.state = 'suspended';
    await audio.unlock();
    expect(ctx.resume).not.toHaveBeenCalled();
    expect(audio.running).toBe(false);
    update({ paused: false });
    await audio.unlock();
    await flush();
    expect(ctx.resume).toHaveBeenCalledOnce();
    expect(audio.sources.has('birds')).toBe(true);
  });

  it('plays recorded taps once for an instant build without interrupting the ambience', async () => {
    const { audio, update, fetchAudio } = setup();
    await audio.unlock();
    await flush();
    const birds = audio.sources.get('birds');
    update({ construction: false, buildCue: 1 });
    await flush();
    const first = audio.sources.get('building').source;
    expect(first.loop).toBe(false);
    expect(first.start).toHaveBeenCalledOnce();
    expect(audio.sources.get('birds')).toBe(birds);
    update({ cameraDistance: 13, population: 8 });
    await flush();
    expect(audio.sources.get('building').source).toBe(first);
    update({ buildCue: 2 });
    await flush();
    expect(first.stop).toHaveBeenCalledOnce();
    expect(audio.sources.get('building').source).not.toBe(first);
    expect(
      fetchAudio.mock.calls.filter(([url]) => url === VILLAGE_AUDIO.building.src),
    ).toHaveLength(1);
  });

  it.each([{ paused: true }, { sfxVolume: 0 }, { raid: '1-Riders on the ridge' }])(
    'suppresses instant-build audio while paused, muted, or raiding: %j',
    async (state) => {
      const { audio, update } = setup();
      await audio.unlock();
      await flush();
      const build = vi.spyOn(audio, 'playConstruction');
      update({ ...state, buildCue: 1 });
      await flush();
      expect(build).not.toHaveBeenCalled();
      update({ paused: false, sfxVolume: 0.8, raid: null });
      await flush();
      expect(audio.sources.has('building')).toBe(false);
    },
  );

  it('starts layered ambience after unlock and streams the full music without buffering it', async () => {
    const { audio, fetchAudio, player, ctx } = setup();
    expect(fetchAudio).not.toHaveBeenCalled();
    await audio.unlock();
    await flush();
    expect([...audio.sources.keys()]).toEqual(['birds', 'chatter']);
    expect([...audio.sources.values()].every(({ source }) => source.loop)).toBe(true);
    expect(player.src).toBe(VILLAGE_AUDIO.music.src);
    expect(player.loop).toBe(true);
    expect(player.play).toHaveBeenCalledOnce();
    expect(ctx.createMediaElementSource).toHaveBeenCalledOnce();
    expect(fetchAudio.mock.calls.map(([url]) => url)).toEqual([
      VILLAGE_AUDIO.birds.src,
      VILLAGE_AUDIO.chatter.src,
      VILLAGE_AUDIO.mining.src,
    ]);
    await audio.unlock();
    await flush();
    expect(fetchAudio).toHaveBeenCalledTimes(3);
    expect(audio.sources.size).toBe(2);
    expect(player.play).toHaveBeenCalledOnce();
  });

  it('plays sparse activity over the continuous beds without immediately repeating eligible cues', async () => {
    const { audio, update } = setup({ random: () => 0 });
    update({ construction: true });
    await audio.unlock();
    await flush();
    const life = vi.spyOn(audio, 'playLife');
    await vi.advanceTimersByTimeAsync(10999);
    expect(life).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(life).toHaveBeenLastCalledWith('mining');
    await vi.advanceTimersByTimeAsync(11000);
    expect(life).toHaveBeenLastCalledWith('building');
    expect(audio.sources.get('birds').source.loop).toBe(true);
    const building = audio.sources.get('building').source;
    update({ construction: false });
    expect(building.stop).toHaveBeenCalledOnce();
  });

  it('keeps music and effects mute independent and resumes music at its existing position', async () => {
    const { audio, update, player, sources } = setup();
    await audio.unlock();
    await flush();
    player.currentTime = 42;
    update({ sfxVolume: 0 });
    expect(sources.every((source) => source.stop.mock.calls.length === 1)).toBe(true);
    expect(player.paused).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    update({ sfxVolume: 0.8, musicVolume: 0 });
    await flush();
    expect(audio.sources.size).toBe(2);
    expect(player.paused).toBe(true);
    update({ musicVolume: 0.6 });
    await flush();
    expect(player.currentTime).toBe(42);
    expect(player.paused).toBe(false);
  });

  it('stops timers and voices for dialogs/hidden tabs and releases resources on exit', async () => {
    const { audio, update, player, ctx, fetchAudio } = setup();
    await audio.unlock();
    await flush();
    update({ paused: true });
    expect(audio.sources.size).toBe(0);
    expect(player.paused).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    update({ paused: false });
    await flush();
    expect(audio.sources.size).toBe(2);
    audio.dispose();
    audio.dispose();
    expect(ctx.close).toHaveBeenCalledOnce();
    expect(fetchAudio.mock.calls[0][1].signal.aborted).toBe(true);
    expect(player.removeAttribute).toHaveBeenCalledWith('src');
    expect(player.load).toHaveBeenCalledOnce();
    expect(audio.buffers.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['pause', 'mute', 'dispose', 'raid'])(
    'does not start stale decoded ambience after %s',
    async (change) => {
      const { audio, ctx, update, sources } = setup();
      const loading = deferred();
      ctx.decodeAudioData.mockReturnValue(loading.promise);
      await audio.unlock();
      await flush();
      if (change === 'pause') update({ paused: true });
      if (change === 'mute') update({ sfxVolume: 0 });
      if (change === 'dispose') audio.dispose();
      if (change === 'raid') update({ raid: '1-Riders on the ridge' });
      loading.resolve({ duration: 24 });
      await flush();
      expect(audio.sources.has('birds')).toBe(false);
      expect(audio.sources.has('chatter')).toBe(false);
      if (change !== 'raid') expect(sources).toHaveLength(0);
      else expect([...audio.sources.keys()]).toEqual(['hooves']);
    },
  );

  it('plays gunfire and vocals only on the matching raid cue, then restores village life', async () => {
    const { audio, update } = setup();
    await audio.unlock();
    await flush();
    update({ raid: '1-Riders on the ridge' });
    await flush();
    expect([...audio.sources.keys()]).toEqual(['hooves']);
    update({ raid: '1-Warning shots' });
    await flush();
    expect([...audio.sources.keys()]).toEqual([]);
    await audio.playRaidCue({ raidId: 2, kind: 'bandit-shot' });
    expect(audio.sources.size).toBe(0);
    await audio.playRaidCue({ raidId: 1, kind: 'bandit-shot', pan: -0.5 });
    expect([...audio.sources.keys()]).toEqual(['bandit-shot']);
    update({ raid: '1-The law holds the line' });
    await audio.playRaidCue({ raidId: 1, kind: 'yeehaw' });
    await audio.playRaidCue({ raidId: 1, kind: 'sheriff-shot' });
    expect([...audio.sources.keys()]).toEqual(['yeehaw', 'sheriff-shot']);
    update({ paused: true });
    await audio.playRaidCue({ raidId: 1, kind: 'bandit-shot' });
    expect(audio.sources.size).toBe(0);
    update({ paused: false });
    update({ raid: null });
    await flush();
    expect([...audio.sources.keys()]).toEqual(['birds', 'chatter']);
  });

  it('plays each era incident’s own cues, loops fire until it is out, and never plays hooves', async () => {
    const { audio, update, fetchAudio, sources } = setup();
    await audio.unlock();
    await flush();
    update({ raid: '3-Smoke at the workshop', raidKind: 'workshop-fire' });
    await flush();
    expect(villageSounds(audio.state)).toEqual([]);
    expect([...audio.sources.keys()]).toEqual([]);
    // Cues load with the scene, before their first beat.
    for (const kind of INCIDENT_AUDIO['workshop-fire'])
      expect(fetchAudio).toHaveBeenCalledWith(VILLAGE_AUDIO[kind].src, expect.anything());
    await audio.playRaidCue({ raidId: 3, kind: 'bandit-shot' });
    await audio.playRaidCue({ raidId: 3, kind: 'patrol-whistle' });
    expect(audio.sources.size).toBe(0);
    await audio.playRaidCue({ raidId: 3, kind: 'fire-crackle', pan: 0.3 });
    await audio.playRaidCue({ raidId: 3, kind: 'fire-bell' });
    expect([...audio.sources.keys()]).toEqual(['fire-crackle', 'fire-bell']);
    const crackle = sources.at(-2);
    expect(crackle.loop).toBe(true);
    await audio.playRaidCue({ raidId: 3, kind: 'fire-crackle', stop: true });
    expect(crackle.stop).toHaveBeenCalled();
    expect([...audio.sources.keys()]).toEqual(['fire-bell']);
    update({ raid: '3-The raid has passed', raidKind: 'workshop-fire' });
    expect(audio.sources.size).toBe(0);
    update({ raid: '4-Thieves break into the warehouse', raidKind: 'cargo-theft' });
    await audio.playRaidCue({ raidId: 4, kind: 'patrol-whistle' });
    expect([...audio.sources.keys()]).toEqual(['patrol-whistle']);
  });

  it('ships a credited recording for every incident cue', () => {
    const credits = readFileSync('public/sound/village/credits.html', 'utf8');
    for (const kind of Object.values(INCIDENT_AUDIO).flat()) {
      expect(existsSync(`public/sound/village/${kind}.mp3`), kind).toBe(true);
      expect(credits, kind).toContain(`${kind}.mp3`);
    }
  });

  it('isolates a failed sample, avoids retry storms, and recovers after the cooldown', async () => {
    const { audio, fetchAudio, update, player } = setup();
    fetchAudio.mockImplementation(async (url) => ({
      ok: url !== VILLAGE_AUDIO.birds.src,
      status: 404,
      arrayBuffer: async () => new ArrayBuffer(8),
    }));
    await audio.unlock();
    await flush();
    expect([...audio.sources.keys()]).toEqual(['chatter']);
    expect(player.paused).toBe(false);
    const count = fetchAudio.mock.calls.length;
    update();
    await flush();
    expect(fetchAudio).toHaveBeenCalledTimes(count);
    fetchAudio.mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) });
    await vi.advanceTimersByTimeAsync(30001);
    update();
    await flush();
    expect(audio.sources.has('birds')).toBe(true);
  });

  it('retries browser autoplay denial on a later gesture without duplicating ambience', async () => {
    const { audio, player, ctx } = setup();
    ctx.state = 'suspended';
    player.play.mockRejectedValueOnce(new Error('NotAllowedError'));
    await audio.unlock();
    await flush();
    expect(ctx.resume).toHaveBeenCalledOnce();
    expect(player.paused).toBe(true);
    await audio.unlock();
    await flush();
    expect(player.paused).toBe(false);
    expect(audio.sources.size).toBe(2);
  });

  it('pauses music even when its play promise resolves after muting or disposal', async () => {
    const { audio, player, update } = setup();
    const loading = deferred();
    player.play.mockImplementation(() =>
      loading.promise.then(() => {
        player.paused = false;
      }),
    );
    await audio.unlock();
    await flush();
    update({ musicVolume: 0 });
    audio.dispose();
    loading.resolve();
    await flush();
    expect(player.paused).toBe(true);
  });
});

it('smoothly increases ambience with zoom while keeping music level and voices stable', async () => {
  expect(villageAmbienceGain(110)).toBeCloseTo(0.3);
  expect(villageAmbienceGain(13)).toBeCloseTo(1);
  expect(villageAmbienceGain(1000)).toBeCloseTo(0.3);
  expect(villageAmbienceGain(5)).toBeCloseTo(1);
  expect(villageAmbienceGain(55)).toBeGreaterThan(villageAmbienceGain(85));
  const { audio, update, sources, player } = setup();
  await audio.unlock();
  await flush();
  const count = sources.length;
  update({ cameraDistance: 110 });
  const far = audio.sfx.gain.setTargetAtTime.mock.lastCall[0];
  expect(far).toBeCloseTo(0.8 * 0.3 * 0.9);
  const music = audio.music.gain.setTargetAtTime.mock.lastCall[0];
  update({ cameraDistance: 13 });
  expect(audio.sfx.gain.setTargetAtTime.mock.lastCall[0]).toBeGreaterThan(far * 3);
  expect(audio.music.gain.setTargetAtTime.mock.lastCall[0]).toBe(music);
  expect(sources).toHaveLength(count);
  expect(player.play).toHaveBeenCalledOnce();
});

describe('Monument unveiling fanfare', () => {
  const players = [];
  const media = () => {
    const player = {
      paused: true,
      ended: false,
      currentTime: 0,
      play: vi.fn(async () => {
        player.paused = false;
      }),
      pause: vi.fn(() => {
        player.paused = true;
      }),
      removeAttribute: vi.fn(),
      load: vi.fn(),
    };
    players.push(player);
    return player;
  };
  afterEach(() => players.splice(0));
  const lastLevel = (audio) => audio.music.gain.setTargetAtTime.mock.calls.at(-1)[0];

  it('replaces the village music with one fanfare per unveiling and resumes after a pause', async () => {
    const { audio, update } = setup({ mediaFactory: media });
    await audio.unlock();
    await flush();
    // Nothing is loaded for the fanfare until a monument is unveiled.
    expect(players).toHaveLength(1);
    update({ fanfare: 'monument-1' });
    const fanfare = players[1];
    expect(fanfare.src).toBe(VILLAGE_AUDIO.fanfare.src);
    expect(fanfare.loop).toBe(false);
    expect(fanfare.play).toHaveBeenCalledOnce();
    expect(lastLevel(audio)).toBe(0);
    fanfare.currentTime = 9;
    update({ paused: true });
    expect(fanfare.paused).toBe(true);
    update({ paused: false });
    expect(fanfare.currentTime).toBe(9);
    expect(fanfare.play).toHaveBeenCalledTimes(2);
    // A replay starts from the top.
    update({ fanfare: 'monument-2' });
    expect(fanfare.currentTime).toBe(0);
    update({ fanfare: null });
    expect(lastLevel(audio)).toBeCloseTo(0.6 * VILLAGE_AUDIO.music.volume);
    expect(fanfare.paused).toBe(false);
    vi.advanceTimersByTime(1500);
    expect(fanfare.paused).toBe(true);
    // A finished fanfare stays finished while the unveiling's last caption is read.
    update({ fanfare: 'monument-3' });
    fanfare.paused = true;
    fanfare.ended = true;
    update({ population: 5 });
    expect(fanfare.play).toHaveBeenCalledTimes(3);
    audio.dispose();
    expect(fanfare.removeAttribute).toHaveBeenCalledWith('src');
  });
  it('never loads the fanfare while music is muted', async () => {
    const { audio, update } = setup({ mediaFactory: media });
    update({ musicVolume: 0 });
    await audio.unlock();
    update({ fanfare: 'monument-1' });
    expect(players).toHaveLength(0);
  });
  it('ships a credited recording for the fanfare', () => {
    const credits = readFileSync('public/sound/village/credits.html', 'utf8');
    expect(existsSync('public/sound/village/monument-unveiling.mp3')).toBe(true);
    expect(credits).toContain('monument-unveiling.mp3');
  });
});

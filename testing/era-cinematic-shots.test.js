import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { ERAS } from '../src/data/eras';
import { ERA_CONSTRUCTION } from '../src/data/mineEvolution';
import { ERA_SHOT_TIMES, eraNewGround, eraShot } from '../src/game/town/TownEraShots';
import { cameraTerrainHeight, clearCinematicTerrain } from '../src/game/town/TownLandscape';

const eras = ERAS.filter((era) => era.enabled).map((era) => era.id);
const MINE = new Vector3(-2.8, 1.6, -17.8);
const samples = (to, aspect, step = 0.1) => {
  const shots = [];
  for (let time = 0; time <= ERA_CONSTRUCTION.duration + 1e-9; time += step)
    shots.push({ time, ...eraShot(time, { to, aspect }) });
  return shots;
};

describe('Era cinematic shots', () => {
  it.each(eras)('keeps the whole %s move above ground with its subject in view', (to) => {
    for (const aspect of [1.78, 0.46]) {
      for (const { time, eye, focus } of samples(to, aspect)) {
        const position = new Vector3(...eye),
          target = new Vector3(...focus);
        expect(position.y, `${to} ${time}`).toBeGreaterThan(
          cameraTerrainHeight(position.x, position.z) + 2,
        );
        // The authored path needs no rescue: the shared terrain guard leaves it alone.
        clearCinematicTerrain(position, target, cameraTerrainHeight);
        expect(position.y, `${to} ${aspect} ${time.toFixed(1)}`).toBeCloseTo(eye[1], 5);
        expect(target.y).toBeCloseTo(focus[1], 5);
      }
    }
  });

  it.each(eras)('moves smoothly through %s without a jump or a stall mid-flight', (to) => {
    const shots = samples(to, 1.78);
    for (let n = 1; n < shots.length; n++) {
      const moved = new Vector3(...shots[n].eye).distanceTo(new Vector3(...shots[n - 1].eye));
      expect(moved, `${to} ${shots[n].time.toFixed(1)}`).toBeLessThan(1.3);
      if (shots[n].time > 1 && shots[n].time < ERA_CONSTRUCTION.duration - 1)
        expect(moved, `${to} ${shots[n].time.toFixed(1)}`).toBeGreaterThan(0.01);
    }
  });

  it('opens on the town, works at the mine and closes wide on the new ground', () => {
    const open = eraShot(0, { to: 'aviation' }),
      works = eraShot((ERA_CONSTRUCTION.buildStart + ERA_CONSTRUCTION.buildEnd) / 2, {
        to: 'aviation',
      }),
      close = eraShot(ERA_CONSTRUCTION.duration, { to: 'aviation' });
    expect(new Vector3(...open.focus).distanceTo(MINE)).toBeGreaterThan(15);
    expect(new Vector3(...works.focus).distanceTo(MINE)).toBeLessThan(1);
    expect(new Vector3(...works.eye).distanceTo(MINE)).toBeLessThan(18);
    expect(close.eye[1]).toBeGreaterThan(25);
    // The airport opens west of town: the last shot leans that way.
    expect(eraNewGround('aviation')[0]).toBeLessThan(0);
    expect(close.focus[0]).toBeLessThan(0);
    // The works are filmed from the south, clear of the hillside behind the mine.
    for (const { time, eye } of samples('aviation', 1.78))
      if (time >= ERA_CONSTRUCTION.buildStart && time <= ERA_CONSTRUCTION.buildEnd)
        expect(eye[2]).toBeGreaterThan(MINE.z + 8);
  });

  it('looks at the heart of town when an era opens no valley ground', () => {
    expect(eraNewGround('no-such-era')).toBeNull();
    const close = eraShot(ERA_CONSTRUCTION.duration, { to: 'no-such-era' });
    expect(Math.hypot(close.focus[0], close.focus[2])).toBeLessThan(2);
    expect(eraShot(-5, { to: 'frontier' })).toEqual(eraShot(0, { to: 'frontier' }));
    expect(eraShot(99, { to: 'frontier' })).toEqual(
      eraShot(ERA_CONSTRUCTION.duration, { to: 'frontier' }),
    );
  });

  it('stands farther back on a portrait screen and keeps its keys in order', () => {
    const wide = eraShot(11, { to: 'tomorrow', aspect: 1.78 }),
      tall = eraShot(11, { to: 'tomorrow', aspect: 0.46 });
    expect(tall.focus).toEqual(wide.focus);
    expect(new Vector3(...tall.eye).distanceTo(new Vector3(...tall.focus))).toBeGreaterThan(
      new Vector3(...wide.eye).distanceTo(new Vector3(...wide.focus)),
    );
    expect([...ERA_SHOT_TIMES]).toEqual([...ERA_SHOT_TIMES].sort((a, b) => a - b));
    expect(ERA_SHOT_TIMES.at(-1)).toBe(ERA_CONSTRUCTION.duration);
  });
});

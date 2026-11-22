import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, Scene, Vector3 } from 'three';
import { MOON_ROADS, moonApproaches, moonParcels, moonSpokes } from '../src/data/moonSettlement';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { renderMoonBuilding } from '../src/game/town/buildings/moon';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { moonSaucerFlightPoint } from '../src/game/town/moon/MoonSaucer';
import { MOON_WALK_LANE } from '../src/game/town/moon/MoonSettlers';
import {
  OUTER_RING_ROVER,
  ROVER_CORRIDOR,
  moonRoverAngle,
  moonRoverStep,
  rememberWalkers,
} from '../src/game/town/moon/MoonRovers';
import {
  MOON_TRAM,
  MOON_TRAM_TIMETABLE,
  createMoonTram,
  moonTramCars,
  moonTramRails,
  moonTramStopAngle,
} from '../src/game/town/moon/MoonTram';

// The era promises "a little tram circles the new streets" and "a tram that is never late",
// and the Ring Tram stop's letter says it made its first lap of the outer ring.
const TAU = Math.PI * 2;
const OUTER = MOON_ROADS.rings.at(-1);
const turn = (a, b) => ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
const kits = [];
afterEach(() => kits.splice(0).forEach((d) => d.disposePrimitives()));
const kit = () => {
  const d = new TownPrimitives();
  kits.push(d);
  return d;
};
const tram = (levels = { ringTram: 1 }) => createMoonTram(kit(), new Group(), levels);

// Drives the vehicles at 60 fps from `from` for `seconds`, as MoonScene.move does, calling
// `each(time)` after every frame.
function drive(vehicles, seconds, { people = [], predict = null, from = 0, each = () => {} } = {}) {
  let last;
  for (let frame = 0; frame <= seconds * 60; frame++) {
    const time = from + frame / 60;
    const step = moonRoverStep(time, last);
    last = time;
    for (const vehicle of vehicles) {
      const a = moonRoverAngle(vehicle, time, step, people, vehicles, predict);
      vehicle.root.position.set(Math.cos(a) * vehicle.radius, 0, Math.sin(a) * vehicle.radius);
      vehicle.root.rotation.y = -a - (vehicle.dir > 0 ? 0 : Math.PI);
    }
    rememberWalkers(people);
    each(time);
  }
}
const angleOf = ({ root }) => Math.atan2(root.position.z, root.position.x);
// The first time the tram leaves its stop.
const departure = (() => {
  let t = 0;
  while (!MOON_TRAM_TIMETABLE.resting(t)) t += 0.01;
  while (MOON_TRAM_TIMETABLE.resting(t)) t += 0.01;
  return t;
})();

describe('the ring tram', () => {
  it('runs only once its stop is built, with a second car from level 2', () => {
    expect(moonTramCars({})).toBe(0);
    expect(moonTramCars(undefined)).toBe(0);
    expect(moonTramCars({ ringTram: 0, lanternRow: 3 })).toBe(0);
    expect(tram({})).toBeNull();
    expect(tram({ ringTram: 1 }).cars).toBe(1);
    expect(tram({ ringTram: 2 }).cars).toBe(2);
    expect(tram({ ringTram: 3 }).cars).toBe(2);
    expect(tram({ ringTram: 2 }).length).toBeGreaterThan(tram({ ringTram: 1 }).length);
    const one = tram();
    expect(one.radius).toBe(OUTER);
    let windows = 0;
    one.root.traverse((part) => (windows += part.name === 'Tram windows'));
    expect(windows).toBe(1);
    // Its underframe rides on the rails, not floating above them.
    const rails = moonTramRails();
    for (const levels of [{ ringTram: 1 }, { ringTram: 3 }]) {
      const { root } = tram(levels);
      root.updateMatrixWorld(true);
      expect(new Box3().setFromObject(root).min.y).toBeCloseTo(rails.position.y, 6);
    }
  });

  it('is put on the outer ring by the scene once the stop stands, with its rails', () => {
    const d = kit();
    const view = Object.assign(Object.create(MoonScene.prototype), {
      d,
      scene: new Scene(),
      life: new Group(),
      elapsed: 0,
      tramRails: moonTramRails(),
      construction: { update() {} },
      updateLotReveals() {},
      saucer: { step() {} },
      moveTransports() {},
    });
    const trams = () => view.walkers.filter((vehicle) => vehicle.tram);
    view.populate({ buildings: { lanternRow: 1 } });
    expect(trams()).toEqual([]);
    expect(view.tramRails.visible).toBe(false);
    view.populate({ buildings: { ringTram: 1 } });
    expect(trams()).toHaveLength(1);
    expect(view.tramRails.visible).toBe(true);
    // It moves with the scene clock, as the rovers do.
    const [running] = trams();
    view.move(10);
    const before = running.root.position.clone();
    view.move(10.5);
    expect(running.root.position.distanceTo(before)).toBeGreaterThan(0.5);
    expect(Math.hypot(running.root.position.x, running.root.position.z)).toBeCloseTo(OUTER, 6);
    view.d.clearGroup(view.scene);
    view.tramRails.geometry.dispose();
  });

  it('keeps a timetable that is a pure function of the clock: one lap, one rest', () => {
    const { lap, rest } = MOON_TRAM;
    // Two laps sampled finely: it only ever goes forward, a lap at a time.
    let previous = MOON_TRAM_TIMETABLE.travel(departure),
      restingFor = 0,
      rests = 0;
    const speeds = [];
    for (let t = departure + 0.05; t <= departure + 2 * lap; t += 0.05) {
      const now = MOON_TRAM_TIMETABLE.travel(t);
      expect(now).toBeGreaterThanOrEqual(previous - 1e-12);
      speeds.push((now - previous) / 0.05);
      if (MOON_TRAM_TIMETABLE.resting(t)) {
        if (!restingFor) rests++;
        // At rest it stands still, at its stop.
        else expect(now).toBeCloseTo(previous, 12);
        restingFor += 0.05;
      } else restingFor = 0;
      previous = now;
    }
    expect(rests).toBe(2);
    expect(
      MOON_TRAM_TIMETABLE.travel(1234.5) - MOON_TRAM_TIMETABLE.travel(1234.5 - lap),
    ).toBeCloseTo(TAU, 9);
    // Smooth: no jump in speed bigger than its gentle pull-away allows.
    for (let n = 1; n < speeds.length; n++)
      expect(Math.abs(speeds[n] - speeds[n - 1])).toBeLessThan(0.002);
    // Every rest is the same length, at the same place.
    const vehicle = tram();
    const restingAngles = [];
    for (let t = 0; t <= 3 * lap; t += 0.25)
      if (MOON_TRAM_TIMETABLE.resting(t)) restingAngles.push(moonRoverAngle(vehicle, t, 0));
    expect(restingAngles.length).toBeCloseTo((3 * rest) / 0.25, -1);
    for (const a of restingAngles) expect(turn(a, moonTramStopAngle())).toBeCloseTo(0, 9);
  });

  it('stops in front of the Ring Tram stop on each lap, clear of paths and spokes', () => {
    // The stop's platform faces the ring at the tram's rest.
    const stop = moonParcels().find(({ id }) => id === 'ringTram');
    expect(turn(Math.atan2(stop.z, stop.x), moonTramStopAngle())).toBeCloseTo(0, 9);
    // Nobody steps across the rails under a resting tram: no path meets the ring, and no spoke
    // leaves it, within the length of a two-car tram.
    const reach = tram({ ringTram: 3 }).length + 0.5;
    const crossings = [
      ...moonApproaches()
        .filter(({ ring }) => ring === OUTER)
        .map(({ points }) => points.at(-1)),
      ...moonSpokes().map(([, end]) => end),
    ];
    for (const [x, z] of crossings)
      expect(Math.abs(turn(Math.atan2(z, x), moonTramStopAngle())) * OUTER).toBeGreaterThan(reach);
    // Driven at 60 fps with nobody about, it rests there once a lap for its full rest.
    const vehicle = tram();
    let still = 0;
    let last = null;
    const rests = [];
    drive([vehicle], 2 * MOON_TRAM.lap, {
      from: departure + 1,
      each(time) {
        const here = vehicle.root.position.clone();
        if (last && here.distanceTo(last) < 1e-9) still += 1 / 60;
        else if (still) {
          rests.push({ time, still, angle: angleOf(vehicle) });
          still = 0;
        }
        last = here;
        // Never late: with nobody in the way it is exactly where the timetable puts it.
        expect(turn(angleOf(vehicle), moonRoverAngle(vehicle, time, 0))).toBeCloseTo(0, 6);
      },
    });
    expect(vehicle.held ?? 0).toBe(0);
    expect(rests).toHaveLength(2);
    for (const { still } of rests) expect(still).toBeCloseTo(MOON_TRAM.rest, 1);
  });

  it('gives way to a settler crossing ahead, then makes the time up at its stop', () => {
    const vehicle = tram();
    // Mid-lap, cruising: find where it will be in a few seconds and put a settler there.
    const start = departure + 20;
    expect(MOON_TRAM_TIMETABLE.resting(start)).toBe(false);
    const ahead = moonRoverAngle(vehicle, start + 2, 0);
    const settler = {
      root: {
        visible: true,
        position: new Vector3(Math.cos(ahead) * OUTER, 0, Math.sin(ahead) * OUTER),
      },
    };
    let closest = Infinity;
    drive([vehicle], 6, {
      people: [settler],
      from: start,
      each() {
        closest = Math.min(closest, vehicle.root.position.distanceTo(settler.root.position));
      },
    });
    // It stopped short of them, its nose clear of their body.
    expect(vehicle.pace).toBeLessThan(0.01);
    expect(closest).toBeGreaterThan(vehicle.length + 0.2);
    const late = vehicle.held;
    expect(late).toBeGreaterThan(0);
    // They step into the walking lane; the tram drives on, a few seconds late, and makes the
    // delay up at its stop, half its rest at most each lap, until it is on its timetable again.
    settler.root.position.setLength(OUTER + MOON_WALK_LANE);
    expect(MOON_WALK_LANE).toBeGreaterThan(ROVER_CORRIDOR);
    const lost = [late];
    let wasResting = false;
    drive([vehicle], 3 * MOON_TRAM.lap, {
      people: [settler],
      from: start + 6 + 1 / 60,
      each(time) {
        const resting = MOON_TRAM_TIMETABLE.resting(time - vehicle.held / vehicle.speed);
        if (wasResting && !resting) lost.push(vehicle.held);
        wasResting = resting;
      },
    });
    expect(lost.length).toBeGreaterThanOrEqual(2);
    for (let n = 1; n < lost.length; n++) {
      expect(lost[n]).toBeLessThan(lost[n - 1] + 1e-12);
      expect(lost[n - 1] - lost[n]).toBeLessThanOrEqual(
        (MOON_TRAM.rest / 2) * vehicle.speed + 1e-9,
      );
    }
    expect(lost.at(-1)).toBe(0);
    const time = start + 6 + 3 * MOON_TRAM.lap;
    expect(turn(moonRoverAngle(vehicle, time, 0), moonRoverAngle(tram(), time, 0))).toBeCloseTo(
      0,
      9,
    );
  });

  it('waits for a settler about to step onto the rails, using their planned day', () => {
    const vehicle = tram();
    const start = departure + 20;
    const ahead = moonRoverAngle(vehicle, start + 1.5, 0);
    // At the roadside now, in the middle of the road a second from now.
    const where = (radius) => ({
      x: Math.cos(ahead) * radius,
      z: Math.sin(ahead) * radius,
    });
    const settler = {
      root: { visible: true, position: new Vector3(where(OUTER + 1.4).x, 0, where(OUTER + 1.4).z) },
    };
    const predict = (person, time, out) =>
      Object.assign(out, { visible: true, ...where(time >= start + 1 ? OUTER : OUTER + 1.4) });
    moonRoverAngle(vehicle, start, 1 / 60, [settler], [vehicle], predict);
    expect(vehicle.pace).toBeLessThan(1);
    const blind = tram();
    moonRoverAngle(blind, start, 1 / 60, [settler], [blind], null);
    expect(blind.pace ?? 1).toBe(1);
  });

  it('keeps going past a walker on the lane, whose straight steps round the ring cut in', () => {
    const vehicle = tram();
    const start = departure + 20;
    const ahead = moonRoverAngle(vehicle, start + 1.5, 0);
    // The outer lane's walkers step in straight lines between points 0.12 rad apart round
    // the ring (ringArc), so midway they are 0.08 nearer the road's middle than the lane.
    const lane = OUTER + MOON_WALK_LANE;
    const chord = (t) => {
      const a = ahead - 0.06 + 0.12 * Math.min(1, Math.max(0, t));
      const [a0, a1] = [ahead - 0.06, ahead + 0.06];
      const along = (a - a0) / (a1 - a0);
      const x = Math.cos(a0) * lane + (Math.cos(a1) - Math.cos(a0)) * lane * along;
      const z = Math.sin(a0) * lane + (Math.sin(a1) - Math.sin(a0)) * lane * along;
      return { x, z };
    };
    const walker = { root: { visible: true, position: new Vector3(chord(0).x, 0, chord(0).z) } };
    const predict = (person, time, out) =>
      Object.assign(out, { visible: true, ...chord(0.5 + (time - start) / 4) });
    moonRoverAngle(vehicle, start, 1 / 60, [walker], [vehicle], predict);
    expect(vehicle.pace ?? 1).toBe(1);
  });

  it('shares the outer ring with the rovers without ever closing on them', () => {
    const d = kit();
    const rovers = [0, 1].map((n) => ({
      root: new Group(),
      radius: OUTER,
      speed: OUTER_RING_ROVER.speed,
      phase: OUTER_RING_ROVER.phase + n * Math.PI,
      dir: OUTER_RING_ROVER.dir,
    }));
    const vehicle = createMoonTram(d, new Group(), { ringTram: 3 });
    const all = [...rovers, vehicle];
    let closest = Infinity;
    drive(all, 2 * MOON_TRAM.lap, {
      each() {
        for (const rover of rovers)
          closest = Math.min(closest, rover.root.position.distanceTo(vehicle.root.position));
      },
    });
    expect(closest).toBeGreaterThan(20);
    for (const each of all) expect(each.held ?? 0).toBe(0);
    // And when a rover is held up in front of it, the tram queues behind, body clear of body.
    const blocked = { ...rovers[0], root: new Group(), held: 0, pace: 1 };
    const behind = createMoonTram(d, new Group(), { ringTram: 3 });
    // Put the rover a little ahead of the tram, stopped by someone in the road.
    const at = departure + 20;
    const tramAngle = moonRoverAngle(behind, at, 0);
    blocked.phase = tramAngle + OUTER_RING_ROVER.dir * (8 / OUTER) + OUTER_RING_ROVER.speed * at;
    const blocker = {
      root: {
        visible: true,
        position: new Vector3(
          Math.cos(tramAngle + OUTER_RING_ROVER.dir * (10 / OUTER)) * OUTER,
          0,
          Math.sin(tramAngle + OUTER_RING_ROVER.dir * (10 / OUTER)) * OUTER,
        ),
      },
    };
    drive([blocked, behind], 20, { people: [blocker], from: at });
    expect(blocked.pace).toBeCloseTo(0, 6);
    expect(behind.pace).toBeCloseTo(0, 6);
    expect(behind.root.position.distanceTo(blocked.root.position)).toBeGreaterThan(
      behind.length + 0.55,
    );
  });

  it('runs clear of every parcel on the map and under the saucer’s flight', () => {
    const half = (0.84 * MOON_TRAM.width) / 2;
    for (const parcel of moonParcels())
      expect(
        Math.abs(Math.hypot(parcel.x, parcel.z) - OUTER) - parcel.radius,
        parcel.id,
      ).toBeGreaterThan(half + 1);
    // Wherever the saucer crosses above the outer ring, it is high over the tram's roof.
    const point = new Vector3();
    for (let phase = 0; phase < 150; phase += 0.05) {
      moonSaucerFlightPoint(phase, true, point);
      if (Math.abs(Math.hypot(point.x, point.z) - OUTER) < 4) expect(point.y).toBeGreaterThan(5);
    }
    // And keeps inside the rover strip, clear of the walking lanes.
    expect(half).toBeLessThan(MOON_WALK_LANE - 0.2);
  });

  it('leaves no parked tram at the stop to double the running one', () => {
    for (const level of [1, 2, 3]) {
      const d = kit();
      const stop = renderMoonBuilding(d, new Group(), 'ringTram', level);
      let windows = 0,
        platforms = 0;
      stop.traverse((part) => {
        windows += part.name === 'Tram windows';
        platforms += part.name === 'Tram platform';
      });
      expect(windows, `level ${level}`).toBe(0);
      expect(platforms).toBe(1);
    }
  });
});

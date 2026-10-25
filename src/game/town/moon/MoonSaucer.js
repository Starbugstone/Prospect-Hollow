import { BufferGeometry, Float32BufferAttribute, Points, PointsMaterial, Vector3 } from 'three';
import { MOON_LOTS, moonPadRadius } from '../../../data/moonSettlement';
import { createSkySaucer } from '../SkySaucer';
import { lerp, smooth01 } from '../TownMath';

// The dedicated pad keeps the landing column clear of buildings, beacon masts,
// the public arrival and rover road. The visiting craft matches the valley shuttle.
export const MOON_SAUCER_PAD = Object.freeze({
  id: 'saucerPad',
  x: MOON_LOTS.saucerPad[0],
  z: MOON_LOTS.saucerPad[1],
  y: 0.26,
  scale: 1,
  radius: moonPadRadius('saucerPad'),
});
export const MOON_SAUCER_CYCLE = 150;
const APPROACH = Object.freeze({ start: 6, end: 18 });
const DEPARTURE = Object.freeze({ start: 80, end: 92 });
// Settled on the pad until lift-off: the stop where its guests step off.
const PARKED = Object.freeze({ start: 34, end: 70 });
const cyclePhase = (time) => ((time % MOON_SAUCER_CYCLE) + MOON_SAUCER_CYCLE) % MOON_SAUCER_CYCLE;
const ramp = (phase, from, length) => smooth01(Math.max(0, Math.min(1, (phase - from) / length)));

export const moonSaucerBuilt = (town) => (town?.buildings?.[MOON_SAUCER_PAD.id] ?? 0) >= 1;

/** The saucer's visitor arrival, like the valley transports': at rest once per cycle. */
export function moonSaucerArrival(time) {
  const phase = cyclePhase(time);
  return {
    arrived: phase >= PARKED.start && phase < PARKED.end,
    sinceArrival: phase - PARKED.start,
    visit: Math.floor(time / MOON_SAUCER_CYCLE),
  };
}

/** Flight and wake share this sky corridor. All sideways travel is high above
 * the lots; the final descent and initial lift are vertical over the pad. */
export function moonSaucerFlightPoint(phase, _toMoon, out) {
  const distance =
    phase < APPROACH.end
      ? 48 * (1 - Math.max(0, (phase - APPROACH.start) / 12)) ** 2
      : phase > DEPARTURE.start
        ? 0.36 * (Math.min(phase, DEPARTURE.end) - DEPARTURE.start) ** 2
        : 0;
  return out.set(
    MOON_SAUCER_PAD.x + distance * 0.6,
    8 + distance * 0.9,
    MOON_SAUCER_PAD.z - distance,
  );
}

const flightPoint = new Vector3();

// The saucer is a vehicle: it keeps its visits with reduced motion, as the valley's
// does; only its effects (the wake and the regolith dust) stop.
export function moonSaucerPose(time) {
  const phase = cyclePhase(time),
    pad = MOON_SAUCER_PAD;
  const pose = {
    x: pad.x,
    y: pad.y,
    z: pad.z,
    yaw: 0.45,
    pitch: 0,
    roll: 0,
    legs: 1,
    spin: 0,
    opacity: 1,
    visible: true,
    phase: 'parked',
  };
  if (phase < APPROACH.start || phase >= DEPARTURE.end)
    return { ...pose, visible: false, opacity: 0, phase: 'away' };
  if (phase < APPROACH.end || phase >= DEPARTURE.start) {
    const point = moonSaucerFlightPoint(phase, true, flightPoint);
    return {
      ...pose,
      x: point.x,
      y: point.y,
      z: point.z,
      legs: 0,
      spin: 1,
      yaw: phase < APPROACH.end ? 2.6 : -0.54,
      opacity: phase < APPROACH.end ? ramp(phase, 6, 2) : 1 - ramp(phase, 89, 3),
      phase: phase < APPROACH.end ? 'approach' : 'departure',
    };
  }
  if (phase < 22)
    return {
      ...pose,
      y: 8,
      yaw: lerp(2.6, pose.yaw, ramp(phase, 18, 4)),
      spin: 1,
      legs: ramp(phase, 18, 4),
      phase: 'hover',
    };
  if (phase < 30)
    return { ...pose, y: lerp(8, 0.85, ramp(phase, 22, 8)), spin: 0.7, phase: 'descent' };
  if (phase < PARKED.start)
    return {
      ...pose,
      y: lerp(0.85, pad.y, ramp(phase, 30, 4)),
      spin: 0.3 * (1 - ramp(phase, 30, 4)),
      phase: 'settle',
    };
  if (phase < PARKED.end) return pose;
  if (phase < 78)
    return {
      ...pose,
      y: lerp(pad.y, 8, ramp(phase, PARKED.end, 8)),
      legs: 1 - ramp(phase, 72, 5),
      spin: ramp(phase, PARKED.end, 4),
      phase: 'lift-off',
    };
  return {
    ...pose,
    y: 8,
    yaw: lerp(pose.yaw, -0.54, ramp(phase, 78, 2)),
    legs: 0,
    spin: 1,
    phase: 'hover',
  };
}

/** One reusable visitor, no saved state or additional animation loop. */
export class MoonSaucer {
  constructor(d, scene, camera) {
    this.d = d;
    this.scene = scene;
    this.d.camera = camera;
  }
  update(town, time, reduced) {
    const era = town?.buildingEras?.airport;
    if (!moonSaucerBuilt(town)) {
      this.clear();
      return;
    }
    if (this.craft && this.era !== era) this.clear();
    if (!this.craft) {
      this.era = era;
      this.craft = createSkySaucer(this.d, this.scene, {
        era,
        path: moonSaucerFlightPoint,
        scale: MOON_SAUCER_PAD.scale,
        departure: DEPARTURE,
        approach: APPROACH,
      });
      this.craft.root.name = 'Moon visiting saucer';
      this.effects = this.d.group(this.scene);
      this.effects.name = 'Moon landing lights and regolith';
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new Float32BufferAttribute(new Float32Array(18 * 3), 3));
      geometry.userData.owned = true;
      this.dust = new Points(
        geometry,
        new PointsMaterial({
          color: '#c5bfb0',
          size: 0.42,
          transparent: true,
          depthWrite: false,
        }),
      );
      this.dust.material.userData.transient = true;
      this.dust.frustumCulled = false;
      this.effects.add(this.dust);
    }
    this.step(time, reduced);
  }
  step(time, reduced = false) {
    if (!this.craft) return false;
    const phase = cyclePhase(time),
      pose = moonSaucerPose(time);
    this.spin =
      (this.spin ?? 0) + Math.min(0.1, Math.max(0, time - (this.lastTime ?? time))) * pose.spin * 5;
    this.lastTime = time;
    this.craft.apply(pose, {
      spin: this.spin,
      phase,
      toMoon: true,
      reduced,
    });
    const age = phase >= 70 ? phase - 70 : phase - 32;
    this.dust.visible = !reduced && age >= 0 && age < 3;
    if (this.dust.visible) {
      const positions = this.dust.geometry.attributes.position;
      for (let n = 0; n < positions.count; n++) {
        const angle = n * 2.39996,
          radius = 3.2 + age * (1.1 + (n % 3) * 0.15);
        positions.setXYZ(
          n,
          MOON_SAUCER_PAD.x + Math.cos(angle) * radius,
          0.3 + Math.sin((age / 3) * Math.PI) * (0.15 + (n % 4) * 0.08),
          MOON_SAUCER_PAD.z + Math.sin(angle) * radius,
        );
      }
      positions.needsUpdate = true;
      this.dust.material.opacity = Math.sin((age / 3) * Math.PI) * 0.55;
    }
  }
  clear() {
    this.craft?.dispose();
    this.d.clearGroup(this.effects);
    this.lastTime = null;
    this.spin = 0;
    this.craft = null;
    this.effects = null;
    this.dust = null;
  }
  dispose() {
    this.clear();
  }
}

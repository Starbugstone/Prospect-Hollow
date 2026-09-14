import { routePose } from './TownRoutes';
import * as THREE from 'three';
import { roadLevel, population } from './TownRules';
import { LANE_X, townTracks, atPlot, plotStreet } from './TownLayout';
import { pavedTown, motorTraffic, roadSurface } from './TownEvolution';
import { motorVehicle } from './TownVehicles';

// Actors share the town's geometry cache; only their joints move each frame.
export function mountedRider(
  d,
  parent,
  { color = '#886650', hat = '#a78758', bandit = false, sheriff = false, seed = 0 } = {},
) {
  const root = d.group(parent),
    horse = d.group(root);
  root.userData.animated = true;
  const coat = ['#a87950', '#796052', '#c2a27b', '#665849'][seed % 4];
  d.ball(horse, 0, 0.87, 0, [0.28, 0.33, 0.62], coat);
  d.ball(horse, 0, 0.94, 0.44, [0.23, 0.3, 0.25], coat);
  const legs = [];
  for (const x of [-0.18, 0.18])
    for (const z of [-0.4, 0.4]) {
      const leg = d.group(horse, x, 0.76, z),
        knee = d.group(leg, 0, -0.34, 0.015);
      d.rod(leg, [0, 0, 0], [0, -0.34, 0.015], 0.067, coat);
      d.rod(knee, [0, 0, 0], [0, -0.32, 0.025], 0.045, coat);
      d.box(knee, 0.115, 0.1, 0.18, 0, -0.34, 0.06, '#493f32', true);
      legs.push({ leg, knee });
    }
  const neck = d.group(horse, 0, 1.02, 0.4);
  d.ball(neck, 0, 0.18, 0.12, [0.17, 0.4, 0.23], coat);
  d.ball(neck, 0, 0.47, 0.25, [0.155, 0.17, 0.28], coat);
  d.ball(neck, 0, 0.42, 0.43, [0.14, 0.115, 0.12], '#b8a18a');
  for (const x of [-0.08, 0.08]) {
    d.ball(neck, x, 0.69, 0.19, [0.04, 0.12, 0.065], coat);
    d.ball(neck, x * 1.85, 0.52, 0.29, 0.023, '#2f302a');
  }
  for (let n = 0; n < 7; n++)
    d.ball(neck, 0, 0.51 - n * 0.08, -0.005 - n * 0.017, [0.06, 0.08, 0.09], '#4e4031');
  d.rod(neck, [-0.15, 0.43, 0.4], [0.15, 0.43, 0.4], 0.016, '#584734');
  for (const x of [-0.16, 0.16]) d.rod(horse, [x, 1.45, 0.7], [x, 1.32, -0.06], 0.012, '#65513a');
  d.box(horse, 0.52, 0.075, 0.5, 0, 1.14, -0.08, bandit ? '#905d49' : '#678b88', true);
  d.box(horse, 0.36, 0.13, 0.32, 0, 1.22, -0.08, '#654b32', true);
  const tail = d.group(horse, 0, 0.97, -0.59);
  d.rod(tail, [0, 0, 0], [0, -0.48, -0.19], 0.075, '#4e4031');
  const rider = d.person({
    parent: horse,
    manual: true,
    era: 'frontier',
    sheriff,
    color,
    skin: seed % 2 ? '#b88863' : '#d7af8a',
    hat,
    seed,
    route: [
      [0, 0],
      [0, 1],
    ],
  });
  rider.root.position.set(0, 0.77, -0.08);
  rider.legs.forEach((leg, n) => {
    leg.upper.rotation.z = n ? 0.6 : -0.6;
    leg.upper.rotation.x = -0.55;
    leg.lower.rotation.x = 1.0;
  });
  rider.arms.forEach((arm) => {
    arm.upper.rotation.x = -0.65;
    arm.lower.rotation.x = -0.65;
  });
  if (bandit) d.box(rider.head, 0.23, 0.075, 0.055, 0, -0.065, 0.1, '#914e40', true);
  else d.ball(rider.torso, -0.08, 0.22, 0.102, [0.04, 0.045, 0.012], '#e8c16a', 'rock');
  const gun = d.group(rider.arms[1].lower, 0, -0.2, 0.04);
  d.box(gun, 0.045, 0.05, 0.27, 0, 0.02, 0.1, '#484943');
  d.box(gun, 0.05, 0.105, 0.06, 0, -0.045, 0.015, '#765237');
  gun.visible = false;
  const flash = d.ball(gun, 0, 0.02, 0.28, [0.065, 0.065, 0.13], '#f5d590', 'rock');
  flash.visible = false;
  const loot = d.group(horse, 0.3, 1.05, -0.36);
  d.ball(loot, 0, -0.1, 0, [0.2, 0.27, 0.19], '#c6ad78');
  d.rod(loot, [0, 0.14, 0], [0, 0.19, 0], 0.06, '#776044');
  loot.visible = false;
  root.traverse((o) => {
    if (o.isMesh) o.castShadow = false;
  });
  d.contactShadow(root, 0.4, 0.9);
  let lastPoseTime;
  return {
    root,
    rider,
    loot,
    flash,
    gun,
    animate(time, moving = true, aiming = false, surrender = false) {
      const delta = lastPoseTime === undefined ? Infinity : time - lastPoseTime;
      const blend = delta < 0 || delta > 1 ? 1 : 1 - Math.exp(-14 * delta);
      const ease = (from, to) => from + (to - from) * blend;
      lastPoseTime = time;
      const stride = time * 9 + seed;
      horse.position.y = moving ? Math.sin(stride * 2) * 0.035 : Math.sin(time * 1.6) * 0.007;
      legs.forEach(({ leg, knee }, i) => {
        const swing = Math.sin(stride + (i === 0 || i === 3 ? 0 : Math.PI));
        leg.rotation.x = ease(leg.rotation.x, moving ? swing * 0.42 : 0);
        knee.rotation.x = ease(knee.rotation.x, moving ? Math.max(0, -swing) * 0.65 : 0);
      });
      neck.rotation.x = moving ? Math.sin(stride) * 0.065 : Math.sin(time * 0.8 + seed) * 0.08;
      tail.rotation.z = Math.sin(time * 2.5 + seed) * 0.2;
      rider.torso.rotation.x = moving ? -0.06 + Math.sin(stride) * 0.025 : 0;
      rider.arms.forEach((arm, i) => {
        arm.upper.rotation.x = ease(arm.upper.rotation.x, i === 1 && aiming ? -1.65 : -0.65);
        arm.lower.rotation.x = ease(
          arm.lower.rotation.x,
          surrender ? -0.2 : i === 1 && aiming ? -0.45 : -0.65,
        );
        arm.upper.rotation.z = ease(arm.upper.rotation.z, surrender ? (i ? -2.4 : 2.4) : 0);
      });
      gun.visible = aiming && !surrender;
    },
  };
}

export function addTownRoads(d, town, plots) {
  const level = roadLevel(town);
  const roads = d.group(d.world);
  const paved = pavedTown(town);
  roads.name = paved ? 'Paved village roads' : 'Village dirt tracks';
  // Slightly uneven edges keep the tracks narrow and worn, with prairie between lots.
  for (const [index, { from, to, width, crossing }] of townTracks(town).entries()) {
    // The bridge model supplies the elevated deck; a flat road would cut across the water.
    if (crossing) continue;
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    const steps = Math.max(2, Math.ceil(length * 2));
    const shape = new THREE.Shape();
    for (const side of [-1, 1])
      for (let n = 0; n <= steps; n++) {
        const i = side < 0 ? n : steps - n;
        const edge = side * width * (paved ? 0.7 : 0.5 + Math.sin(i * 1.7 + index) * 0.055);
        const along = (i / steps - 0.5) * length;
        if (side < 0 && n === 0) shape.moveTo(edge, along);
        else shape.lineTo(edge, along);
      }
    shape.closePath();
    const geometry = new THREE.ShapeGeometry(shape);
    geometry.rotateX(-Math.PI / 2);
    geometry.userData.owned = true;
    const track = new THREE.Mesh(geometry, d.material(roadSurface(town)));
    track.rotation.y = Math.atan2(to[0] - from[0], to[1] - from[1]);
    track.position.set((from[0] + to[0]) / 2, 0.028 + index * 0.0002, (from[1] + to[1]) / 2);
    track.receiveShadow = true;
    roads.add(track);
  }
  for (const [id, [x, z]] of Object.entries(plots)) {
    if (id === 'mine' || id === 'bridge' || !town.buildings[id]) continue;
    if (level >= 2 && id !== 'well' && id !== 'well2') {
      for (let i = 0; i < 16; i++)
        d.box(
          roads,
          0.17,
          0.07,
          0.75,
          x - 1.35 + i * 0.18,
          0.07,
          z + 1.65,
          paved ? '#c2bca5' : i % 3 ? '#ad9065' : '#b79d73',
        );
    }
  }
  if (level >= 3)
    for (const [x, z] of [
      [-4.35, -0.5],
      [4.35, 7.5],
      [-4.35, 15.5],
      [4.35, -8.5],
    ]) {
      d.rod(roads, [x, 0, z], [x, 2.3, z], 0.045, '#63726a');
      d.box(roads, 0.18, 0.26, 0.18, x, 2.35, z, '#e8c583', true);
      d.box(roads, 0.25, 0.06, 0.25, x, 2.52, z, '#61746d');
    }
  roads.userData.static = true;
  d.batch(roads);
  return roads;
}

export function addTownVisitors(d, town) {
  if (town.buildings.stable)
    for (let n = 0; n < town.buildings.stable; n++) {
      const mounted = motorTraffic(town)
        ? { root: motorVehicle(d, d.world), animate() {} }
        : mountedRider(d, d.world, {
            seed: n + 3,
            color: ['#7f9191', '#a77a66', '#879667'][n % 3],
          });
      mounted.root.name = motorTraffic(town) ? 'Touring car' : 'Visiting horse rider';
      mounted.root.userData.animated = true;
      const curve = new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(LANE_X, 0.07, 7.5),
          new THREE.Vector3(LANE_X, 0.07, -0.5),
          new THREE.Vector3(LANE_X, 0.07, -8.5),
          new THREE.Vector3(-LANE_X, 0.07, -8.5),
          new THREE.Vector3(-LANE_X, 0.07, -0.5),
          new THREE.Vector3(-LANE_X, 0.07, 23.5),
          new THREE.Vector3(LANE_X, 0.07, 23.5),
        ],
        true,
        'catmullrom',
        0.08,
      );
      d.motions.push((time) => {
        const progress = (time / 65 + n / town.buildings.stable) % 1,
          tangent = curve.getTangentAt(progress);
        mounted.root.position.copy(curve.getPointAt(progress));
        mounted.root.rotation.y = Math.atan2(tangent.x, tangent.z);
        mounted.animate(time + n);
      });
    }
  if (town.buildings.saloon)
    for (let n = 0; n < Math.min(4, 1 + Math.floor(population(town) / 6)); n++) {
      const actor = d.person({
        color: ['#aa795f', '#879c88', '#967f95', '#c1a274'][n],
        skin: n % 2 ? '#976f50' : '#d8ae83',
        hat: '#baa06d',
        route: [[-LANE_X, -0.5], [-LANE_X, 7.5], plotStreet('saloon'), atPlot('saloon', 0, 1.25)],
        seed: n * 7,
        visitor: true,
      });
      actor.duration += 3;
    }
}

export const RAID_DURATION = 24;
export const RAID_SPEED = 2;
export const raidPhase = (time, protectedTown) =>
  time < 8
    ? 'Riders on the ridge'
    : time < 12
      ? 'Warning shots'
      : time < 17
        ? protectedTown
          ? 'The law holds the line'
          : 'Bandits at the mine'
        : time < 22
          ? 'Hands up!'
          : 'Back to the open trail';

// All positions use the open forecourt, with a separate column for each capture team.
export class TownRaid {
  constructor(d, event, plots, onPhase, onComplete, onCue = () => {}) {
    Object.assign(this, { d, event, onPhase, onComplete, onCue });
    this.root = d.group(d.scene);
    this.root.name = 'Frontier raid';
    this.started = d.elapsed;
    this.mine = plots.mine;
    this.sheriff = plots.sheriff;
    this.columns = Math.min(
      5,
      event.gangSize,
      Math.max(Math.ceil(event.gangSize / 2), event.sheriffLevel),
    );
    this.cues = new Set();
    this.civilians = (d.world?.children ?? [])
      .filter((o) => o.userData.animated)
      .map((o) => [o, o.visible]);
    this.bandits = Array.from({ length: event.gangSize }, (_, n) => {
      const actor = mountedRider(d, this.root, {
        bandit: true,
        seed: n,
        color: n % 2 ? '#514c47' : '#82513f',
        hat: '#493e32',
      });
      const rope = d.rod(this.root, [0, 0, 0], [0, 1, 0], 0.018, '#e9ca84');
      rope.userData.animated = true;
      const loop = d.group(actor.rider.torso, 0, 0.12, 0);
      // A faceted rope loop around the surrendered rider's waist.
      for (let k = 0; k < 12; k++) {
        const a = (k * Math.PI) / 6,
          b = ((k + 1) * Math.PI) / 6;
        d.rod(
          loop,
          [Math.cos(a) * 0.24, 0, Math.sin(a) * 0.19],
          [Math.cos(b) * 0.24, 0, Math.sin(b) * 0.19],
          0.017,
          '#e9ca84',
        );
      }
      return Object.assign(actor, { rope, loop });
    });
    this.patrol = [];
    this.updateEvent(event);
    this.dust = Array.from({ length: event.gangSize * 3 }, () => {
      const dust = d.ball(this.root, 0, 0.2, 0, 0.2, '#cbb78d', 'rock');
      dust.userData.animated = true;
      return dust;
    });
    this.update(d.elapsed);
  }
  updateEvent(event) {
    this.event = event;
    while (this.patrol.length < Math.min(event.sheriffLevel, this.columns))
      this.patrol.push(
        mountedRider(this.d, this.root, {
          sheriff: true,
          seed: this.patrol.length + 1,
          color: '#315d83',
          hat: '#f0d390',
        }),
      );
  }
  slot(n) {
    return [
      ((this.columns - 1) / 2 - (n % this.columns)) * 1.7,
      this.mine[1] + 8 - Math.floor(n / this.columns) * 2.8,
    ];
  }
  line(n) {
    return [this.slot(n)[0], this.mine[1] + 10.2];
  }
  escort(n) {
    const line = this.line(n);
    return [
      line,
      [line[0], -8.5],
      [LANE_X, -8.5],
      [LANE_X, this.sheriff[1] + 2.1],
      [this.sheriff[0] + 0.8, this.sheriff[1] + 2.1],
    ];
  }
  pathLength(points) {
    return points
      .slice(1)
      .reduce((sum, p, i) => sum + Math.hypot(p[0] - points[i][0], p[1] - points[i][1]), 0);
  }
  travel(actor, points, distance) {
    const pose = routePose(points, distance);
    actor.root.position.set(pose.x, 0.07, pose.z);
    actor.root.rotation.y = pose.heading;
    return pose.moving;
  }
  cue(id, at, time, kind, actor) {
    if (time < at || this.cues.has(id)) return;
    this.cues.add(id);
    // Never replay missed gunfire after a suspended tab or a skipped timeline.
    if (time - at < 0.25)
      this.onCue({
        id,
        raidId: this.event.id,
        kind,
        pan: THREE.MathUtils.clamp(actor.root.position.x / 10, -0.7, 0.7),
      });
  }
  update(elapsed) {
    if (this.disposed) return true;
    const time = (elapsed - this.started) * RAID_SPEED,
      { event } = this;
    const phase = raidPhase(time, event.outcome === 'protected');
    if (phase !== this.phase) {
      this.phase = phase;
      this.onPhase(phase);
    }
    this.civilians.forEach(([actor]) => (actor.visible = false));
    const caughtCount =
      event.outcome === 'protected'
        ? Math.min(event.gangSize, this.patrol.length * 2)
        : Math.min(Math.floor(event.gangSize / 2), this.patrol.length);
    this.patrol.forEach((actor, n) => {
      const line = this.line(n),
        route = this.escort(n),
        depart = 22 + n * 3;
      const entry = [...route].reverse();
      const arrival = 8 + n * 0.8;
      let moving = false;
      actor.root.visible = time >= arrival;
      if (time < 17)
        moving = this.travel(
          actor,
          entry,
          Math.max(0, time - arrival) *
            Math.max(
              5.5,
              ...this.patrol.map(
                (_, index) => this.pathLength(this.escort(index)) / (16.5 - 8 - index * 0.8),
              ),
            ),
        );
      else if (time < depart) {
        this.travel(actor, [line, [line[0], line[1] - 1]], 0);
      } else {
        actor.root.visible = this.travel(actor, route, (time - depart) * 4);
        moving = actor.root.visible;
      }
      const aiming = time >= 14 && time < 17;
      actor.animate(time + n, moving, aiming);
      const shot = 14.3 + n * 0.45;
      actor.flash.visible = aiming && time >= shot && time < shot + 0.12;
      if (aiming) actor.root.rotation.y = Math.PI;
      this.cue(`sheriff-${n}`, shot, time, 'sheriff-shot', actor);
      if (n === 0) this.cue('law-call', 12.2, time, 'yeehaw', actor);
    });
    this.bandits.forEach((actor, n) => {
      const stop = this.slot(n),
        col = n % this.columns,
        row = Math.floor(n / this.columns);
      const entry = [[22 + n * 2.5, this.mine[1] + 3.5], [stop[0], this.mine[1] + 3.5], stop];
      const caught = n < caughtCount && col < this.patrol.length;
      const captureAt = 17 + row * 1.2 + col * 0.15;
      actor.captured = caught && time >= captureAt;
      actor.captor = caught ? col : null;
      actor.root.visible = true;
      let moving = false;
      if (time < 8) moving = this.travel(actor, entry, time * 6.8);
      else if (caught && time >= 22 + col * 3) {
        const route = [stop, ...this.escort(col)];
        moving = true;
        actor.root.visible = this.travel(actor, route, (time - 22 - col * 3) * 4);
      } else if (!caught && time >= 19 + (1 - row) * 1.1) {
        moving = true;
        actor.root.visible = this.travel(
          actor,
          [...entry].reverse(),
          (time - 19 - (1 - row) * 1.1) * 6.8,
        );
      } else this.travel(actor, [stop, [stop[0], stop[1] + 1]], 0);
      const aiming = time >= 8 && time < 14;
      actor.animate(time + n, moving, aiming, actor.captured && time < 22 + col * 3);
      actor.flash.visible = false;
      for (let shot = 0; shot < 3; shot++) {
        const at = 8.2 + shot * 1.15;
        if (n === shot % event.gangSize) {
          actor.flash.visible ||= time >= at && time < at + 0.12;
          this.cue(`bandit-${shot}`, at, time, 'bandit-shot', actor);
        }
      }
      actor.loot.visible = !caught && event.loss > 0 && time > 12;
      actor.loop.visible = actor.captured;
      actor.rope.visible =
        actor.root.visible && caught && time >= captureAt - 0.65 && this.patrol[col].root.visible;
      if (actor.rope.visible) {
        const hand = this.patrol[col].root.position.clone().add(new THREE.Vector3(0.2, 1.65, 0));
        const target = actor.root.position.clone().add(new THREE.Vector3(0, 1.6, 0));
        target.lerpVectors(
          hand,
          target,
          THREE.MathUtils.clamp((time - captureAt + 0.65) / 0.65, 0, 1),
        );
        const delta = target.clone().sub(hand);
        actor.rope.position.copy(hand).addScaledVector(delta, 0.5);
        actor.rope.scale.set(0.018, delta.length(), 0.018);
        actor.rope.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
      }
      for (let k = 0; k < 3; k++) {
        const dust = this.dust[n * 3 + k],
          drift = (time * 1.8 + k / 3) % 1;
        dust.visible = actor.root.visible && (moving || actor.flash.visible);
        dust.position
          .copy(actor.root.position)
          .add(
            new THREE.Vector3(
              Math.sin(n + k) * drift * 0.5,
              0.1 + drift * 0.3,
              -Math.cos(actor.root.rotation.y) * (0.5 + drift),
            ),
          );
        dust.scale.setScalar(0.12 + drift * 0.3);
      }
    });
    if (time >= RAID_DURATION * RAID_SPEED) {
      this.dispose();
      this.onComplete();
      return true;
    }
    return false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.civilians.forEach(([actor, visible]) => (actor.visible = visible));
    this.d.clearGroup(this.root);
  }
}

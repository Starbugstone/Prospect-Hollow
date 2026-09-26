import { localWalk, walkPath, walkPose } from './TownNavigation';
import { TownActors } from './TownActors';

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// Reusable, deterministic construction staging. It owns temporary workers and
// assembly transforms; the caller supplies the real building and work positions.
export class TownBuildSequence {
  constructor(d, root, building, { era, start, end, leave, stations, focus, navigation }) {
    Object.assign(this, { d, root, start, end, leave, focus });
    this.sections = building.children.map((part) => ({
      part,
      y: part.position.y,
      phase: part.userData.buildPhase ?? 0,
    }));
    this.phases = Math.max(1, ...this.sections.map(({ phase }) => phase)) + 1;
    this.crew = stations.map(([x, z], i) => {
      const arrival = [x + (i % 2 ? 0.4 : -0.4), z + 8 + i * 0.6];
      const worker = d.person({
        parent: root,
        manual: true,
        era,
        color: i % 2 ? '#648d89' : '#b99464',
        skin: i % 2 ? '#ad7d5b' : '#d5b08b',
        hat: '#e5bc77',
        seed: i,
        route: [arrival, [x, z]],
        linear: true,
      });
      // The grip origin is the palm centre. The handle crosses the closed
      // hand, perpendicular to the forearm, so the head swings ahead of it.
      const hammer = d.group(worker.arms[1].lower, 0, -0.19, 0);
      hammer.name = 'Construction hammer grip';
      hammer.rotation.x = 0.55;
      d.box(hammer, 0.045, 0.045, 0.38, 0, 0, 0.105, '#9b7954').name = 'Hammer handle';
      d.box(hammer, 0.24, 0.105, 0.1, 0, 0, 0.3, '#607b74').name = 'Hammer head';
      const load = d.box(worker.root, 0.65, 0.25, 0.35, 0, 0.85, 0.38, '#b9986b');
      // Start planning at the work site. If a large neighbouring building cuts
      // off the long approach, reverse its reachable prefix so the worker still
      // arrives at the mine, rather than hammering at the truncated street end.
      const outward = localWalk(navigation ? { navigation } : d, root, [[x, z], arrival]);
      const path = outward && walkPath(outward.points.slice().reverse());
      const endPoint = path?.points.at(-1);
      const station = endPoint ? [endPoint[0], endPoint[2]] : [x, z];
      return { worker, arrival, station, path, hammer, load, delay: i * 0.35 };
    });
    this.actors = new TownActors(d.scene);
    this.actors.rebuild([building, ...this.crew.map(({ worker }) => worker.root)]);
  }
  frame(time, still = false) {
    for (const { part, y, phase } of this.sections) {
      const step = (this.end - this.start) / this.phases;
      const t = still ? 1 : ease((time - this.start - phase * step) / (step * 0.9));
      part.visible = t > 0;
      part.position.y = y + (1 - t) * 0.7;
      part.scale.y = Math.max(0.001, t);
    }
    for (const { worker, arrival, station, path, hammer, load, delay } of this.crew) {
      const leaving = time >= this.leave + delay;
      const progress = leaving
        ? ease((time - this.leave - delay) / 3)
        : ease((time - 1 - delay) / (this.start - 1));
      const a = leaving ? station : arrival,
        b = leaving ? arrival : station;
      worker.root.position.set(
        a[0] + (b[0] - a[0]) * progress,
        0.08,
        a[1] + (b[1] - a[1]) * progress,
      );
      worker.root.rotation.y =
        time >= this.start + delay && !leaving
          ? this.focus
            ? Math.atan2(this.focus[0] - station[0], this.focus[1] - station[1])
            : Math.PI
          : leaving
            ? 0
            : Math.PI;
      if (path) {
        const pose = walkPose(
          path,
          leaving ? 1 - progress : progress,
          (worker.travelPose ??= { x: arrival[0], y: 0.08, z: arrival[1] }),
        );
        worker.root.position.set(pose.x, pose.y, pose.z);
        if (progress < 1) worker.root.rotation.y = pose.heading + (leaving ? Math.PI : 0);
      }
      worker.root.visible = !still && time > 1 + delay && (!leaving || progress < 1);
      const working = time >= this.start + delay && time < this.end;
      const walking = !working && progress < 1;
      const lift = (1 + Math.sin(time * 6 + delay)) / 2;
      worker.body.position.y = 0.54 + (walking ? Math.sin(time * 12 + delay) * 0.015 : 0);
      for (let n = 0; n < 2; n++) {
        const swing = Math.sin(time * 7 + delay + n * Math.PI);
        worker.legs[n].upper.rotation.x = walking ? swing * 0.4 : 0;
        worker.legs[n].lower.rotation.x = walking ? Math.max(0, -swing) * 0.5 : 0;
        worker.arms[n].upper.rotation.x =
          working && n === 1 ? -0.55 - lift * 0.55 : walking ? -swing * 0.25 : 0;
        worker.arms[n].lower.rotation.x = working && n === 1 ? -0.55 - lift * 0.4 : -0.16;
      }
      worker.torso.rotation.x = working ? 0.13 : 0;
      hammer.visible = working;
      load.visible = !leaving && time < this.start + delay;
    }
    this.actors.update();
  }
  dispose() {
    this.actors.dispose();
  }
}

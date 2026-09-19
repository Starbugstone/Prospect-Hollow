import { TownActors } from './TownActors';

const clamp = (value) => Math.max(0, Math.min(1, value));
const ease = (value) => {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
};

// Reusable, deterministic construction staging. It owns temporary workers and
// assembly transforms; the caller supplies the real building and work positions.
export class TownBuildSequence {
  constructor(d, root, building, { era, start, end, leave, stations, focus }) {
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
      const hammer = d.group(worker.arms[1].lower, 0, -0.19, 0.04);
      d.box(hammer, 0.055, 0.34, 0.055, 0, -0.1, 0, '#9b7954');
      d.box(hammer, 0.22, 0.1, 0.1, 0, -0.26, 0, '#607b74');
      const load = d.box(worker.root, 0.65, 0.25, 0.35, 0, 0.85, 0.38, '#b9986b');
      return { worker, arrival, station: [x, z], hammer, load, delay: i * 0.35 };
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
    for (const { worker, arrival, station, hammer, load, delay } of this.crew) {
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
      worker.root.visible = !still && time > 1 + delay && (!leaving || progress < 1);
      const working = time >= this.start + delay && time < this.end;
      const walking = !working && progress < 1;
      worker.body.position.y = 0.54 + (walking ? Math.sin(time * 12 + delay) * 0.015 : 0);
      for (let n = 0; n < 2; n++) {
        const swing = Math.sin(time * 7 + delay + n * Math.PI);
        worker.legs[n].upper.rotation.x = walking ? swing * 0.4 : 0;
        worker.legs[n].lower.rotation.x = walking ? Math.max(0, -swing) * 0.5 : 0;
        worker.arms[n].upper.rotation.x =
          working && n === 1
            ? -1.3 + Math.sin(time * 9 + delay) * 0.65
            : walking
              ? -swing * 0.25
              : 0;
        worker.arms[n].lower.rotation.x = working ? -0.55 : -0.16;
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

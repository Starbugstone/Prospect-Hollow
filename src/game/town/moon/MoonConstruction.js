import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_LOTS, moonLotPose } from '../../../data/moonSettlement';
import { constructionReady, constructionVisual } from '../TownRules';

const finishKey = (town, id) =>
  `${town.buildings?.[id] ?? 0}:${town.buildingEras?.[id]}:${town.buildingEraLevels?.[id]}`;

// The saved project and readiness rules are the valley's. Only the work-site kit
// differs: steel gantries, a service arm, prefabricated panels and warning lights.
export class MoonConstruction {
  constructor(view) {
    this.view = view;
    this.sites = new Map();
    this.effects = [];
    this.finishes = null;
  }
  sync(town) {
    const { d, scene, elapsed } = this.view;
    for (const id of Object.keys(MOON_LOTS)) {
      const project = town.projects?.[id];
      const level = town.buildings?.[id] ?? 0;
      const finish = finishKey(town, id);
      const key =
        project &&
        `${level}:${project.stage}:${constructionVisual(project)}:${constructionReady(project)}`;
      const previous = this.sites.get(id);
      if (previous && previous.key === key) continue;
      if (previous) {
        d.clearGroup(previous.root);
        this.sites.delete(id);
      }
      if (!project) {
        if (this.finishes && level > 0 && finish !== this.finishes[id] && !this.view.reducedMotion)
          this.celebrate(id, elapsed);
        continue;
      }
      const { x, z, rotation } = moonLotPose(id);
      const root = d.group(scene, x, 0, z);
      root.name = `Lunar construction site ${id}`;
      root.rotation.y = rotation;
      root.userData.ready = constructionReady(project);
      root.userData.progress = constructionVisual(project);
      const height = 4.4;
      for (const side of [-1, 1]) {
        const x = side * 3.5;
        for (const z of [-3, 3]) {
          d.box(root, 0.2, height, 0.2, x, height / 2, z, p.roof);
          d.box(root, 0.65, 0.16, 0.65, x, 0.1, z, p.deep);
          d.ball(root, x, height + 0.15, z, 0.15, p.light);
        }
        for (const y of [1.8, 3.8]) {
          d.box(root, 0.55, 0.14, 6.4, x, y, 0, p.shell);
          d.rod(root, [x, y - 1.6, -3], [x, y, 3], 0.07, p.roof);
          d.rod(root, [x, y - 1.6, 3], [x, y, -3], 0.07, p.roof);
        }
      }
      d.box(root, 7.4, 0.24, 0.3, 0, height, -3, p.shell);
      d.box(root, 7.4, 0.24, 0.3, 0, height, 3, p.shell);
      // Prefabricated habitat ribs grow as completed puzzles advance the project.
      if (!level) {
        for (const z of [-1.6, 0, 1.6])
          for (const side of [-1, 1]) d.rod(root, [side * 2.5, 0.2, z], [0, 2.8, z], 0.09, p.roof);
        for (let n = 0; n < constructionVisual(project); n++)
          d.box(root, 4.3, 0.8, 0.12, 0, 0.6 + n * 0.8, -1.65, p.shell);
      }
      // A compact robotic crane fits on the lot, clear of public approaches.
      d.box(root, 0.9, 0.3, 0.9, 3, 0.25, -2.2, p.deep);
      d.rod(root, [3, 0.4, -2.2], [3, 5.2, -2.2], 0.16, p.light);
      d.rod(root, [3, 5.2, -2.2], [0.5, 5.2, -2.2], 0.12, p.light);
      d.rod(root, [0.5, 5.2, -2.2], [0.5, 3.6, -2.2], 0.035, p.deep);
      d.box(root, 0.5, 0.3, 0.5, 0.5, 3.5, -2.2, p.glass);
      for (let n = 0; n < 3 - constructionVisual(project); n++)
        d.box(root, 1.3, 0.16, 1.8, -2, 0.2 + n * 0.2, 2, p.shell);
      d.batch(root);
      this.sites.set(id, { key, root });
    }
    this.finishes = Object.fromEntries(
      Object.keys(MOON_LOTS).map((id) => [id, finishKey(town, id)]),
    );
  }
  celebrate(id, time) {
    const { d, scene } = this.view;
    const { x, z } = moonLotPose(id);
    const root = d.group(scene, x, 0, z);
    root.name = `Lunar assembly completed ${id}`;
    const sparks = Array.from({ length: 12 }, (_, n) =>
      d.ball(root, 0, 0, 0, 0.2, n % 2 ? p.glass : p.light, 'rock'),
    );
    this.effects.push({ root, sparks, start: time });
    this.update(time);
  }
  update(time, still = false) {
    this.effects = this.effects.filter((effect) => {
      const t = Math.min(1, Math.max(0, (time - effect.start) / 1.8));
      if (t >= 1 || still) {
        this.view.d.clearGroup(effect.root);
        return false;
      }
      effect.sparks.forEach((spark, n) => {
        const a = (n / effect.sparks.length) * Math.PI * 2;
        const radius = 2 + t * 4;
        spark.position.set(
          Math.cos(a) * radius,
          0.2 + Math.sin(t * Math.PI) * 3,
          Math.sin(a) * radius,
        );
        spark.scale.setScalar(0.18 * (1 - t));
      });
      return true;
    });
  }
  dispose() {
    for (const { root } of [...this.sites.values(), ...this.effects]) this.view.d.clearGroup(root);
    this.sites.clear();
    this.effects = [];
  }
}

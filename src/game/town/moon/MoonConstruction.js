import { MOON_PALETTE as p } from '../../../data/futureArchitecture';
import { MOON_LOTS, moonLotPose } from '../../../data/moonSettlement';
import { constructionReady, constructionVisual } from '../TownRules';
import { TownConstruction } from '../TownConstruction';

// A lot's saved finish: its level and the era it was last finished in.
export const finishKey = (town, id) =>
  `${town.buildings?.[id] ?? 0}:${town.buildingEras?.[id]}:${town.buildingEraLevels?.[id]}`;

// The saved project and readiness rules are the valley's. Only the work-site kit
// differs: steel gantries, a service arm, prefabricated panels and warning lights.
// A newly started site rises with the valley's own construction reveal
// (TownConstruction: pieces settle top-down under a swinging hammer and dust).
export class MoonConstruction {
  constructor(view) {
    this.view = view;
    this.sites = new Map();
    this.reveals = new Map();
    this.synced = false;
  }
  sync(town) {
    const { d, scene, elapsed } = this.view;
    for (const id of Object.keys(MOON_LOTS)) {
      const project = town.projects?.[id];
      const level = town.buildings?.[id] ?? 0;
      const key =
        project &&
        `${level}:${project.stage}:${constructionVisual(project)}:${constructionReady(project)}`;
      const previous = this.sites.get(id);
      if (previous && previous.key === key) continue;
      if (previous) {
        this.reveals.get(id)?.finish();
        this.reveals.delete(id);
        d.clearGroup(previous.root);
        this.sites.delete(id);
      }
      // A finished lot is revealed by MoonScene with the valley's construction reveal.
      if (!project) continue;
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
      root.userData.plot = id;
      this.sites.set(id, { key, root });
      // A project the player just started (not one restored on load) is built in view;
      // its pieces merge into one batch once the reveal settles.
      if (!previous && this.synced && !this.view.reducedMotion) {
        const reveal = new TownConstruction(
          Object.assign(Object.create(d), { activeElapsed: elapsed, town }),
          root,
          null,
          new Map(),
        );
        reveal.presentFirstStrike();
        this.reveals.set(id, reveal);
      } else d.batch(root);
    }
    this.synced = true;
  }
  update(time, still = false) {
    for (const [id, reveal] of this.reveals)
      if (still || reveal.update(time)) {
        reveal.finish();
        this.view.d.batch(this.sites.get(id).root);
        this.reveals.delete(id);
      }
  }
  dispose() {
    this.reveals.clear();
    for (const { root } of this.sites.values()) this.view.d.clearGroup(root);
    this.sites.clear();
  }
}

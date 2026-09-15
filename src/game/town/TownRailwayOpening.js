import { TownActors } from './TownActors';
import { MeshBasicMaterial, Vector3 } from 'three';
import { addRailroad } from './TownEraActivity';
import { buildMineHillside } from './TownMineHillside';
import { groundHeight } from './TownLandscape';
import { PLOTS, RAIL_EDGE } from './TownLayout';

const clamp = (t) => Math.max(0, Math.min(1, t));
export class TownRailwayOpening {
  constructor(d) {
    this.d = d;
    this.root = d.group(d.scene);
    this.root.name = 'Railway opening construction';
    const temporary = Object.create(d);
    temporary.world = this.root;
    this.rails = addRailroad(temporary, d.town, { batch: false });
    this.solid = buildMineHillside(d, this.root, PLOTS.mine[1], RAIL_EDGE.from[1], groundHeight);
    this.tunnel = buildMineHillside(
      d,
      this.root,
      PLOTS.mine[1],
      RAIL_EDGE.from[1],
      groundHeight,
      true,
    );
    this.stones = [];
    this.tunnel.getObjectByName('Stone railway tunnel portals').traverse((part) => {
      if (part.isMesh)
        this.stones.push({ part, y: part.position.y, order: part.userData.buildHeight ?? 0 });
    });
    this.railParts = [];
    this.rails.traverse((part) => {
      if (part.isMesh) {
        part.updateWorldMatrix(true, false);
        const x = part.getWorldPosition(new Vector3()).x;
        this.railParts.push({ part, y: part.position.y, delay: clamp((x + 45) / 95) * 3 });
      }
    });
    this.dust = Array.from({ length: 24 }, (_, i) =>
      d.ball(this.root, 0, 0, 0, 1, i % 2 ? '#c7b691' : '#d5c39d', 'sphere'),
    );
    const dustMaterial = new MeshBasicMaterial({
      color: '#c9b78e',
      transparent: true,
      opacity: 0.48,
      depthWrite: false,
    });
    dustMaterial.userData.transient = true;
    this.dust.forEach((part) => {
      part.material = dustMaterial;
    });
    this.actors = new TownActors(d.scene);
    // Keep vertex-colored rock in the scenery pass; only construction pieces move.
    this.actors.rebuild([
      this.rails,
      this.tunnel.getObjectByName('Stone railway tunnel portals'),
      ...this.dust,
    ]);
    d.railwayOpening = this;
    this.frame(0);
  }
  frame(time) {
    const d = this.d;
    for (const id of ['railroad', 'mine-hillside']) {
      const group = d.staticScenery.entries.get(id)?.group;
      const batch = d.buildingRenderer.batches.get(group);
      if (batch) batch.visible = false;
    }
    this.solid.visible = time < 7;
    this.tunnel.visible = time >= 7;
    for (const { part, y, delay } of this.railParts) {
      const t = clamp((time - 2 - delay) / 0.65);
      part.visible = t > 0;
      part.position.y = y + (1 - t) ** 2 * 0.8;
    }
    for (const { part, y, order } of this.stones) {
      const t = clamp((time - 7 - order * 0.8) / 0.7);
      part.visible = t > 0;
      part.position.y = y + (1 - t) ** 2 * 1.4;
    }
    this.dust.forEach((part, i) => {
      const t = clamp((time - 6.3 - (i % 4) * 0.13) / 2);
      part.visible = t > 0 && t < 1;
      part.position.set(
        (i % 2 ? -1 : 1) * (6.3 + t * 1.5),
        0.4 + (i % 6) * 0.65 + t,
        -23 + Math.sin(i * 2.4) * (1.4 + t),
      );
      part.scale.setScalar(Math.sin(Math.PI * t) * 1.05);
    });
    const x =
      time < 12
        ? -36 + clamp((time - 10) / 2) * 20
        : time < 13
          ? -16
          : -16 + clamp((time - 13) / 3) * 34;
    this.journey = { x, visible: time >= 10, distance: x + 36, moving: time < 12 || time >= 13 };
    // Three continuous shots: station, line construction, masonry, first departure.
    const shots = [
      { at: 0, eye: [-27, 14, -3], focus: [-15, 1, -21] },
      { at: 2, eye: [-21, 19, -5], focus: [-12, 1, -23] },
      { at: 5.8, eye: [-20, 12, -10], focus: [-4, 2, -23] },
      { at: 7, eye: [-18, 8, -15], focus: [-5, 2, -23] },
      { at: 10, eye: [-29, 10, -7], focus: [-17, 1.5, -23] },
      { at: 13, eye: [-23, 12, -5], focus: [-10, 2, -23] },
      { at: 16, eye: [25, 13, -9], focus: [6, 2, -23] },
    ];
    let index = shots.findIndex((s) => s.at > time);
    if (index < 0) index = shots.length - 1;
    const a = shots[Math.max(0, index - 1)],
      b = shots[index];
    const t = clamp((time - a.at) / Math.max(0.001, b.at - a.at));
    const smooth = t * t * (3 - 2 * t);
    const focus = new Vector3().fromArray(a.focus).lerp(new Vector3().fromArray(b.focus), smooth);
    const eye = new Vector3().fromArray(a.eye).lerp(new Vector3().fromArray(b.eye), smooth);
    if (d.camera.aspect < 0.8) eye.sub(focus).multiplyScalar(1.45).add(focus);
    this.actors.update();
    return { eye, focus };
  }
  dispose() {
    const d = this.d;
    for (const id of ['railroad', 'mine-hillside']) {
      const group = d.staticScenery.entries.get(id)?.group;
      const batch = d.buildingRenderer.batches.get(group);
      if (batch) batch.visible = true;
    }
    const start = RAIL_EDGE.from[0] - 7;
    d.trainTimeOffset =
      (this.journey.x - start) / 4 + (this.journey.x >= -16 ? 9 : 0) - 25 - d.elapsed;
    d.railwayOpening = null;
    this.actors.dispose();
    d.clearGroup(this.root);
  }
}

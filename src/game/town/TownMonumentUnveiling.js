import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import { TownActors } from './TownActors';
import { animalModel } from './TownAnimalModels';
import { groundHeight } from './TownLandscape';
import { clamp01, smooth01 } from './TownMath';
import { addMonumentScaffold, addUnveilingDressing, monumentModel } from './TownMonumentWorks';
import { AREA_BY_ID, siteYaw } from '../../data/townLandmarks';
import { eraEvolution } from '../../data/eras';
import { TOWN_ANIMALS, townFauna } from '../../data/townAnimals';

const CONFETTI = ['#ffd878', '#6fe8dc', '#f49fc3', '#fff0bb', '#e8bf79'];

// The scaffolding comes down around the finished monument while the town (Willowkin
// included, once they live here) gathers and cheers. The monument itself is the real
// one in the town: the unveiling is committed first, so a closed or skipped scene
// never leaves it unbuilt. Everything here is temporary and deterministic in time.
export class TownMonumentUnveiling {
  constructor(d, definition) {
    this.d = d;
    this.definition = definition;
    const area = (this.area = AREA_BY_ID[definition.area]);
    const [x, z] = area.positions[0];
    this.yaw = siteYaw(area);
    this.origin = new Vector3(x, groundHeight(x, z), z);
    this.timing = definition.grand
      ? { cut: 2.6, down: 3, fall: 3.4, cheer: 6.2, confetti: 6.4 }
      : { cut: 0.9, down: 1.2, fall: 2, cheer: 3, confetti: 3.2 };
    this.root = d.group(d.scene);
    this.root.name = 'Monument unveiling';
    const site = d.group(this.root, x, this.origin.y, z);
    site.rotation.y = this.yaw;
    const { model, extent } = monumentModel(d, definition.choice, definition.level, area.timeless);
    d.clearGroup(model.parent);
    this.extent = extent;
    this.height = extent.max.y;
    const top = this.height + 0.8;
    const scaffold = addMonumentScaffold(d, site, extent, top, d.town?.era);
    const dressing = addUnveilingDressing(d, site, extent, top, area.radius);
    this.ribbon = dressing.halves;
    this.bow = dressing.bow;
    // Pieces come down from the top, so the monument appears crown first.
    this.pieces = [];
    for (const group of [scaffold, dressing.bunting])
      for (const part of [...group.children]) {
        const height = part.position.y;
        // Primitives keep their dimensions in `scale`; shrink relative to it.
        this.pieces.push({
          part,
          size: part.scale.clone(),
          y: part.position.y,
          drop: Math.min(height, 3.5),
          delay: (1 - clamp01(height / top)) * this.timing.fall,
        });
      }
    this.dust = Array.from({ length: 18 }, (_, i) =>
      d.ball(site, 0, 0, 0, 1, i % 2 ? '#d8c8a4' : '#cdb991', 'sphere'),
    );
    const dustMaterial = new MeshBasicMaterial({
      color: '#d4c39d',
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
    });
    dustMaterial.userData.transient = true;
    for (const puff of this.dust) puff.material = dustMaterial;
    this.crowd = this.gather(d, site, definition.grand ? 14 : 8);
    this.confetti = this.addConfetti(definition.grand ? 180 : 90);
    this.actors = new TownActors(d.scene);
    this.actors.rebuild([
      scaffold,
      dressing.bunting,
      dressing.ribbon,
      ...this.dust,
      ...this.crowd.map((c) => c.root),
    ]);
    this.frame(0);
  }
  // Townsfolk in a crescent before the entrance, with the town's Willowkin among them.
  gather(d, site, count) {
    const era = d.town?.era;
    const companion = townFauna(eraEvolution(era)).companions?.species;
    const crowd = [];
    const radius = this.area.radius + 1.4;
    for (let n = 0; n < count; n++) {
      const row = n % 2,
        a = ((n - (count - 1) / 2) / count) * 2.1;
      const x = Math.sin(a) * (radius + row * 1.1),
        z = Math.cos(a) * (radius + row * 1.1);
      const willowkin = companion && TOWN_ANIMALS[companion] && n % 4 === 1;
      let actor;
      if (willowkin) {
        actor = animalModel(d, companion);
        site.add(actor.root);
      } else
        actor = d.person({
          parent: site,
          manual: true,
          era,
          color: n % 2 ? '#648d89' : '#b99464',
          skin: n % 3 ? '#d5b08b' : '#ad7d5b',
          hat: '#e5bc77',
          seed: 1301 + n * 17,
          route: [
            [x, z],
            [x + 0.1, z],
          ],
          linear: true,
        });
      actor.root.position.set(x, 0.05, z);
      actor.root.rotation.y = Math.atan2(-x, -z);
      crowd.push({ ...actor, willowkin, phase: n * 1.7 });
    }
    return crowd;
  }
  addConfetti(count) {
    const positions = new Float32Array(count * 3),
      colors = new Float32Array(count * 3);
    const seeds = Array.from({ length: count }, (_, i) => {
      const a = i * 2.39996,
        r = 1.5 + ((i * 37) % 11) * 0.55;
      return { x: Math.cos(a) * r, z: Math.sin(a) * r, delay: (i % 23) * 0.09, spin: i * 0.7 };
    });
    const color = new Vector3();
    seeds.forEach((_, i) => {
      const hex = parseInt(CONFETTI[i % CONFETTI.length].slice(1), 16);
      color.set((hex >> 16) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
      colors.set([color.x, color.y, color.z], i * 3);
    });
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geometry.userData.owned = true;
    const material = new PointsMaterial({
      size: 0.32,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    material.userData.transient = true;
    const points = new Points(geometry, material);
    points.frustumCulled = false;
    points.position.copy(this.origin);
    this.root.add(points);
    return { points, geometry, seeds };
  }
  frame(time, still = false) {
    const { cut, down, cheer, confetti } = this.timing;
    const at = still ? Infinity : time;
    for (const { part, size, y, drop, delay } of this.pieces) {
      const t = clamp01((at - down - delay) / 0.75);
      part.visible = t < 1;
      part.position.y = y - t * t * drop;
      part.scale.copy(size).multiplyScalar(1 - smooth01(t) * 0.9);
    }
    // The ribbon is cut and both halves swing down to the posts.
    const snip = smooth01((at - cut) / 0.6);
    this.ribbon.forEach((half, n) => {
      half.rotation.z = (n ? 1 : -1) * snip * 1.45;
    });
    this.bow.visible = at < cut;
    this.dust.forEach((puff, i) => {
      const t = clamp01((at - down - 0.4 - (i % 6) * 0.25) / 2.2);
      puff.visible = t > 0 && t < 1;
      const a = (i / this.dust.length) * Math.PI * 2;
      const reach = this.extent.max.x + 0.8 + t * 1.6;
      puff.position.set(Math.cos(a) * reach, 0.3 + t * 0.9, Math.sin(a) * reach);
      puff.scale.setScalar(Math.sin(Math.PI * t) * 0.9);
    });
    for (const member of this.crowd) {
      const joy = still ? 1 : clamp01((time - cheer) / 0.6);
      const wave = Math.sin(time * 6 + member.phase);
      if (member.willowkin) {
        member.arms?.forEach((arm, n) => {
          arm.rotation.z = (n ? 1 : -1) * joy * (2.1 + wave * 0.3);
        });
        member.body.position.y = Math.max(0, wave) * 0.05 * joy;
        continue;
      }
      member.body.position.y = 0.54 + Math.max(0, wave) * 0.06 * joy;
      member.arms.forEach((arm, n) => {
        arm.upper.rotation.x = -joy * (2.5 + Math.sin(time * 6 + member.phase + n) * 0.35);
        arm.lower.rotation.x = -0.16 - joy * 0.2;
      });
    }
    const { points, geometry, seeds } = this.confetti;
    points.visible = !still && time > confetti;
    if (points.visible) {
      const position = geometry.attributes.position;
      seeds.forEach((seed, i) => {
        const t = Math.max(0, time - confetti - seed.delay);
        const y = this.height + 3.5 - ((t * 1.1) % (this.height + 3.5));
        position.setXYZ(
          i,
          seed.x + Math.sin(t * 2.2 + seed.spin) * 0.6,
          t > 0 ? y : this.height + 3.5,
          seed.z + Math.cos(t * 1.7 + seed.spin) * 0.6,
        );
      });
      position.needsUpdate = true;
    }
    this.actors.update();
    return this.shot(time);
  }
  // Grand: wide establishing shot, a push in as the scaffolding falls, an orbit
  // around the finished monument, then a heroic low angle. A reveal is one sweep.
  shot(time) {
    const h = this.height,
      r = this.area.radius;
    const shots = this.definition.grand
      ? [
          { at: 0, angle: 0.4, distance: r + 26, rise: h * 0.9 + 8, look: 0.45 },
          { at: 3, angle: 0.3, distance: r + 15, rise: h * 0.6 + 4, look: 0.5 },
          { at: 7, angle: -0.3, distance: r + 14, rise: h * 0.6 + 3.5, look: 0.55 },
          { at: 11.5, angle: -1.15, distance: r + 15, rise: h * 0.55 + 3.5, look: 0.55 },
          { at: 16, angle: -0.15, distance: r + 17, rise: h * 0.3 + 1.5, look: 0.6 },
        ]
      : [
          { at: 0, angle: 0.55, distance: r + 17, rise: h * 0.7 + 5, look: 0.5 },
          { at: 2.5, angle: 0.25, distance: r + 15, rise: h * 0.6 + 4, look: 0.5 },
          { at: 7, angle: -0.4, distance: r + 16, rise: h * 0.55 + 3.5, look: 0.55 },
        ];
    let index = shots.findIndex((s) => s.at > time);
    if (index < 0) index = shots.length - 1;
    const a = shots[Math.max(0, index - 1)],
      b = shots[index];
    const t = smooth01((time - a.at) / Math.max(0.001, b.at - a.at));
    const mix = (key) => a[key] + (b[key] - a[key]) * t;
    const angle = this.yaw + mix('angle'),
      distance = mix('distance');
    const focus = this.origin.clone().add(new Vector3(0, h * mix('look'), 0));
    const eye = this.origin
      .clone()
      .add(new Vector3(Math.sin(angle) * distance, mix('rise'), Math.cos(angle) * distance));
    if (this.d.camera.aspect < 0.8) eye.sub(focus).multiplyScalar(1.45).add(focus);
    return { eye, focus };
  }
  dispose() {
    this.actors.dispose();
    this.d.clearGroup(this.root);
  }
}

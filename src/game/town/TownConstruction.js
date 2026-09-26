import { Vector3 } from 'three';
const CONSTRUCTION_SECONDS = 1.8;
const partKey = (object) =>
  JSON.stringify([
    object.geometry.uuid,
    object.material.uuid,
    object.matrixWorld.elements.map((v) => Math.round(v * 10000) / 10000),
  ]);
export function constructionParts(group) {
  group.updateMatrixWorld(true);
  const parts = new Map();
  group.traverse((object) => {
    if (object.isMesh) {
      const key = partKey(object);
      parts.set(key, (parts.get(key) ?? 0) + 1);
    }
  });
  return parts;
}
const clamp = (value) => Math.min(1, Math.max(0, value));

// Temporary articulated pieces share the village's existing instanced actor renderer.
export class TownConstruction {
  constructor(view, group, rotor, previousParts) {
    this.group = group;
    this.rotor = rotor;
    this.start = view.activeElapsed ?? view.elapsed;
    this.lastTime = this.start;
    this.firstStrikePresented = false;
    this.startAt = null;
    this.elapsed = 0;
    this.pieces = [];
    group.updateMatrixWorld(true);
    const remaining = new Map(previousParts);
    const center = new Vector3();
    group.traverse((object) => {
      if (!object.isMesh) return;
      const key = partKey(object);
      if (remaining.get(key)) {
        remaining.set(key, remaining.get(key) - 1);
        return;
      }
      object.userData.addedAt = view.town?.buildings?.[group.userData.plot] ?? 1;
      center.add(group.worldToLocal(object.getWorldPosition(new Vector3())));
      this.pieces.push({ object, y: object.position.y, visible: object.visible });
    });
    if (this.pieces.length) center.divideScalar(this.pieces.length);
    const height = Math.max(1, ...this.pieces.map(({ y }) => y));
    for (const piece of this.pieces) piece.delay = clamp(piece.y / height) * 0.8;
    group.userData.static = false;
    group.userData.animated = true;
    if (rotor) rotor.visible = false;

    this.effects = view.group(group, center.x, 0, center.z);
    this.hammer = view.group(this.effects, 1.8, 1.3, 1.4);
    view.box(this.hammer, 0.12, 1.1, 0.12, 0, 0.5, 0, '#b88952');
    view.box(this.hammer, 0.6, 0.3, 0.3, 0, 1.02, 0, '#667a7b', true);
    this.dust = Array.from({ length: 8 }, (_, n) =>
      view.ball(this.effects, 0, 0, 0, 0.2, n % 2 ? '#dac49d' : '#c4ab82', 'rock'),
    );
    this.update(this.start);
  }
  presentFirstStrike() {
    this.firstStrikePresented = true;
  }
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    this.lastTime = null;
  }
  update(time) {
    if (this.paused) return false;
    if (!this.firstStrikePresented) {
      this.elapsed = 0.08;
      this.lastTime = time;
    } else if (this.startAt === null) {
      this.startAt = time;
      this.elapsed = 0;
      this.lastTime = time;
    } else {
      this.elapsed += this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
      this.lastTime = time;
    }
    const elapsed = this.elapsed;
    for (const { object, y, visible, delay } of this.pieces) {
      const progress = clamp((elapsed - delay) / 0.65);
      object.visible = visible && elapsed >= delay;
      object.position.y = y + (1 - progress) ** 3 * 1.3;
    }
    this.hammer.visible = elapsed < 1.25;
    this.hammer.rotation.z = -0.9 + Math.abs(Math.sin((elapsed / 0.22) * Math.PI)) * 1.6;
    const puff = clamp((elapsed - 0.08) / 1.5);
    this.dust.forEach((dust, n) => {
      const angle = (n / this.dust.length) * Math.PI * 2;
      const radius = 1.1 + puff * 1.5;
      dust.position.set(Math.cos(angle) * radius, 0.12 + puff * 0.45, Math.sin(angle) * radius);
      dust.scale.setScalar(Math.sin(puff * Math.PI) * 0.35);
    });
    return elapsed >= CONSTRUCTION_SECONDS;
  }
  finish() {
    for (const { object, y, visible } of this.pieces) {
      object.position.y = y;
      object.visible = visible;
    }
    if (this.rotor) this.rotor.visible = true;
    this.effects.removeFromParent();
    this.group.userData.animated = false;
    this.group.userData.static = true;
  }
}

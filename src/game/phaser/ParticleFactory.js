import Phaser from 'phaser';

export function createParticleFactory(scene, fxLayer) {
  const art = scene.make.graphics({ x: 0, y: 0 }, false);
  art.fillStyle(0xffffff);
  art.fillPoints(
    [
      { x: 16, y: 0 },
      { x: 20, y: 12 },
      { x: 32, y: 16 },
      { x: 20, y: 20 },
      { x: 16, y: 32 },
      { x: 12, y: 20 },
      { x: 0, y: 16 },
      { x: 12, y: 12 },
    ],
    true,
  );
  if (!scene.textures.exists('spark')) art.generateTexture('spark', 32, 32);
  art.clear();
  art.fillStyle(0xdffaff);
  art.fillTriangle(2, 2, 22, 7, 9, 30);
  art.fillStyle(0x88cde8);
  art.fillTriangle(2, 2, 9, 30, 10, 11);
  art.lineStyle(1, 0xffffff, 0.9);
  art.strokeTriangle(2, 2, 22, 7, 9, 30);
  if (!scene.textures.exists('ice-shard')) art.generateTexture('ice-shard', 24, 32);
  art.destroy();
  // Capped emitters recycle particles; bursts create no tweens or game objects.
  const emitter = scene.add.particles(0, 0, 'spark', {
    emitting: false,
    maxParticles: 400,
    lifespan: { min: 220, max: 650 },
    speed: { min: 65, max: 245 },
    angle: { min: 0, max: 360 },
    scale: { start: 0.4, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 180 },
    gravityY: 100,
    blendMode: Phaser.BlendModes.ADD,
  });
  const ice = scene.add.particles(0, 0, 'ice-shard', {
    emitting: false,
    maxParticles: 128,
    lifespan: { min: 230, max: 410 },
    speed: { min: 50, max: 155 },
    angle: { min: 190, max: 350 },
    scale: { start: 0.45, end: 0.05 },
    alpha: { start: 0.95, end: 0 },
    rotate: { start: 0, end: 200 },
    gravityY: 350,
  });
  fxLayer.add([emitter, ice]);
  let reducedMotion = false;
  return {
    setReducedMotion(value) {
      reducedMotion = value;
    },
    emitBurst(position, color = 0xffffff, count = 10) {
      if (reducedMotion) return;
      emitter.setParticleTint(color);
      emitter.explode(Math.min(72, count), position.x, position.y);
    },
    emitExplosion(position, { color = 0xffffff, count = 28 } = {}) {
      this.emitBurst(position, color, count);
    },
    emitIce(position, count = 8) {
      if (!reducedMotion) ice.explode(Math.min(12, count), position.x, position.y);
    },
    clear() {
      emitter.killAll();
      ice.killAll();
    },
    destroy() {
      emitter.destroy();
      ice.destroy();
    },
  };
}

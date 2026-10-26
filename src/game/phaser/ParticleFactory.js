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
  // A soft column of light for portal pads: bright down the middle, fading to the sides
  // and towards both ends.
  if (!scene.textures.exists('portal-beam')) {
    const beam = scene.textures.createCanvas('portal-beam', 32, 128);
    const context = beam.getContext();
    const across = context.createLinearGradient(0, 0, 32, 0);
    across.addColorStop(0, 'rgba(255,255,255,0)');
    across.addColorStop(0.5, 'rgba(255,255,255,1)');
    across.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = across;
    context.fillRect(0, 0, 32, 128);
    const along = context.createLinearGradient(0, 0, 0, 128);
    along.addColorStop(0, 'rgba(255,255,255,0)');
    along.addColorStop(0.3, 'rgba(255,255,255,1)');
    along.addColorStop(0.7, 'rgba(255,255,255,1)');
    along.addColorStop(1, 'rgba(255,255,255,0)');
    context.globalCompositeOperation = 'destination-in';
    context.fillStyle = along;
    context.fillRect(0, 0, 32, 128);
    beam.refresh();
  }
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
  // Portal sparkles twinkle where they appear and drift gently up or down the beam.
  const shimmer = scene.add.particles(0, 0, 'spark', {
    emitting: false,
    maxParticles: 160,
    lifespan: { min: 140, max: 300 },
    speedX: { min: -6, max: 6 },
    speedY: { min: -45, max: 45 },
    scale: { start: 0.32, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 180 },
    blendMode: Phaser.BlendModes.ADD,
  });
  // A floatstone lifting off puffs warm sparks out of its base, fanned around `puff.angle`
  // (degrees, straight behind it), so one sinking under upturned gravity blows upwards.
  const puff = { angle: 90 };
  const liftOff = scene.add.particles(0, 0, 'spark', {
    emitting: false,
    maxParticles: 40,
    lifespan: { min: 240, max: 460 },
    angle: { onEmit: () => puff.angle + (Math.random() * 2 - 1) * 80 },
    speed: { min: 90, max: 210 },
    scale: { start: 0.5, end: 0 },
    alpha: { start: 1, end: 0 },
    rotate: { min: 0, max: 180 },
    tint: [0xffeaa8, 0xffc04d, 0xff8f3a],
    blendMode: Phaser.BlendModes.ADD,
  });
  const emitters = [emitter, ice, shimmer, liftOff];
  fxLayer.add(emitters);
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
    // Sparkles scattered through a `width` × `height` beam, half white, half `color`.
    emitShimmer(position, { color = 0xffffff, width, height, count = 14 }) {
      if (reducedMotion) return;
      for (let n = 0; n < count; n++) {
        if (n % 2 === 0) shimmer.setParticleTint(n % 4 ? color : 0xffffff);
        shimmer.emitParticleAt(
          position.x + (Math.random() - 0.5) * width,
          position.y + (Math.random() - 0.5) * height,
          1,
        );
      }
    },
    emitLiftOff(position, angle, count = 8) {
      if (reducedMotion) return;
      puff.angle = angle;
      liftOff.emitParticleAt(position.x, position.y, Math.min(10, count));
    },
    // Asked on every frame (see BoardAnimator.isAnimating).
    alive() {
      return emitters.some((each) => each.getAliveParticleCount() > 0);
    },
    clear() {
      // Phaser's killAll keeps each particle where it died, and the next emission adds its
      // own position on top: return them to the emitter's origin first, as a natural death does.
      for (const each of emitters) {
        each.forEachAlive((particle) => particle.setPosition());
        each.killAll();
      }
    },
    destroy() {
      emitters.forEach((each) => each.destroy());
    },
  };
}

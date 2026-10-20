import { describe, expect, it, vi } from 'vitest';
import { createParticleFactory } from '../src/game/phaser/ParticleFactory';

vi.mock('phaser', () => ({ default: { BlendModes: { ADD: 1 } } }));

// Emitters that reuse particles as Phaser 3.86 does: a natural death returns a particle to
// the origin, killAll leaves it where it was, and firing adds the emit point to its position
// (Particle.fire).
function particleScene() {
  const emitters = [];
  const graphics = new Proxy({}, { get: () => () => graphics });
  const emitter = (config) => {
    const alive = [];
    const dead = [];
    const fire = (x, y) => {
      const particle = dead.pop() ?? { x: 0, y: 0 };
      particle.setPosition = (px = 0, py = 0) => Object.assign(particle, { x: px, y: py });
      particle.x += x;
      particle.y += y;
      particle.angle = config.angle?.onEmit?.();
      alive.push(particle);
    };
    const each = {
      config,
      alive,
      setParticleTint: vi.fn(),
      emitParticleAt(x, y, count = 1) {
        for (let n = 0; n < count; n++) fire(x, y);
      },
      explode(count, x, y) {
        each.emitParticleAt(x, y, count);
      },
      getAliveParticleCount: () => alive.length,
      forEachAlive: (callback) => alive.forEach((particle) => callback(particle, each)),
      killAll() {
        while (alive.length) dead.push(alive.pop());
      },
      destroy: vi.fn(),
    };
    emitters.push(each);
    return each;
  };
  const scene = {
    make: { graphics: () => graphics },
    textures: { exists: () => true },
    add: { particles: (x, y, key, config) => emitter(config) },
  };
  return { scene, emitters, fxLayer: { add: vi.fn() } };
}

describe('board particles', () => {
  it('start where they are emitted after the board is cleared mid-burst', () => {
    const { scene, emitters, fxLayer } = particleScene();
    const particles = createParticleFactory(scene, fxLayer);
    expect(fxLayer.add).toHaveBeenCalledWith(emitters);
    particles.emitBurst({ x: 50, y: 60 });
    particles.emitIce({ x: 50, y: 60 });
    particles.emitShimmer({ x: 50, y: 60 }, { width: 0, height: 0 });
    particles.emitLiftOff({ x: 50, y: 60 }, 90);
    expect(particles.alive()).toBe(true);
    particles.clear();
    expect(particles.alive()).toBe(false);
    particles.emitBurst({ x: 10, y: 20 });
    particles.emitIce({ x: 10, y: 20 });
    particles.emitShimmer({ x: 10, y: 20 }, { width: 0, height: 0 });
    particles.emitLiftOff({ x: 10, y: 20 }, 90);
    for (const { alive } of emitters) {
      expect(alive.length).toBeGreaterThan(0);
      for (const particle of alive) expect(particle).toMatchObject({ x: 10, y: 20 });
    }
  });

  it('puff a few sparks out behind a floatstone lifting off, unless motion is reduced', () => {
    const { scene, emitters, fxLayer } = particleScene();
    const particles = createParticleFactory(scene, fxLayer);
    const liftOff = emitters.at(-1);
    particles.emitLiftOff({ x: 100, y: 194 }, -90, 50);
    expect(liftOff.alive).toHaveLength(10);
    for (const { angle } of liftOff.alive) {
      expect(angle).toBeGreaterThanOrEqual(-170);
      expect(angle).toBeLessThanOrEqual(-10);
    }
    particles.clear();
    particles.setReducedMotion(true);
    particles.emitLiftOff({ x: 100, y: 194 }, 90);
    expect(particles.alive()).toBe(false);
  });
});

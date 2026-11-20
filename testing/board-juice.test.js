import { describe, expect, it, vi } from 'vitest';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import {
  BoardJuice,
  CLEAR_RIPPLE,
  burstCount,
  clearRipple,
  tierColor,
} from '../src/game/phaser/BoardJuice';

// The arcade feel of ordinary moves is decoration: bounded, skipped under reduced motion,
// and never part of what a move waits for beyond the match's short ripple.
const sprite = () => ({
  x: 10,
  y: 10,
  scaleX: 1,
  scaleY: 1,
  alpha: 1,
  active: true,
  __gemType: 'ruby',
  setAngle: vi.fn(),
});
function fixture({ reducedMotion = false } = {}) {
  const added = [];
  const made = [];
  const object = () => {
    const self = { destroy: vi.fn() };
    for (const method of ['setBlendMode', 'setOrigin', 'setScale', 'setStrokeStyle'])
      self[method] = () => self;
    made.push(self);
    return self;
  };
  const shake = vi.fn();
  const scene = {
    tweens: {
      tweens: [],
      add: (config) => {
        added.push(config);
        config.onStart?.();
        config.onComplete?.();
        return { remove() {} };
      },
    },
    add: { circle: object, image: object },
    make: { text: () => ({ width: 8, height: 8, canvas: {}, destroy() {} }) },
    textures: { exists: () => true },
    cameras: { main: { shake, shakeEffect: { isRunning: false } } },
  };
  const particles = { emitBurst: vi.fn(), alive: () => false, clear() {} };
  const animator = new BoardAnimator({
    scene,
    particles,
    settings: { reducedMotion },
    gemLayer: { bringToTop: vi.fn(), add() {} },
    fxLayer: { add() {} },
  });
  Object.assign(animator, { boardCols: 6, boardRows: 6, cellSize: 40 });
  return { animator, juice: animator.juice, added, made, particles, shake };
}

describe('Board juice', () => {
  it('ripples a match within a fixed, short time and leaves bonus sweeps alone', () => {
    expect(clearRipple(3)).toEqual([0, 12, 24]);
    expect(Math.max(...clearRipple(12))).toBe(CLEAR_RIPPLE);
    expect(CLEAR_RIPPLE).toBeLessThanOrEqual(50);
    expect(clearRipple(40).every((delay) => delay === 0)).toBe(true);
    expect(clearRipple(0)).toEqual([]);
    expect(clearRipple(-3)).toEqual([]);
  });

  it('escalates a cascade within bounds', () => {
    expect(burstCount(1)).toBe(9);
    expect(burstCount(3)).toBeGreaterThan(burstCount(2));
    expect(burstCount(99)).toBe(21);
    expect(burstCount(undefined)).toBe(9);
    expect(tierColor(1)).not.toBe(tierColor(4));
    expect(tierColor(99)).toBe(tierColor(5));
    for (const odd of [0, -2, NaN, undefined]) expect(tierColor(odd)).toBe(tierColor(1));
  });

  it('squashes a landing gem back to its own size and dusts only a long fall', () => {
    const { juice, added, particles } = fixture();
    juice.land(sprite(), 220, 1);
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ yoyo: true, duration: 70 });
    expect(added[0].scaleY).toBeLessThan(1);
    expect(added[0].scaleX).toBeGreaterThan(1);
    // It starts as the gem first touches down, not after the bounce has finished.
    expect(added[0].delay).toBeCloseTo(80);
    expect(particles.emitBurst).not.toHaveBeenCalled();
    juice.land(sprite(), 300, 4);
    expect(particles.emitBurst).toHaveBeenCalledOnce();
    // The squash is capped however far a gem falls.
    juice.land(sprite(), 600, 40);
    expect(added.at(-1).scaleY).toBeGreaterThanOrEqual(0.8);
    juice.land(sprite(), 100, 0);
    expect(added).toHaveLength(3);
  });

  it('keeps its tweens out of what a move waits for', () => {
    const { animator, juice } = fixture();
    const [a, b] = [sprite(), sprite()];
    juice.swap(a, b, 115);
    juice.refuse([a, b], 150);
    juice.land(a, 200, 2);
    expect(animator.pending.size).toBe(0);
  });

  it('shows what a match scored and rattles only a deep cascade', () => {
    const { juice, made, shake } = fixture();
    juice.score(300, [0, 1, 2], 1);
    expect(made).toHaveLength(1);
    juice.score(0, [0, 1, 2], 1);
    juice.score(300, [], 1);
    expect(made).toHaveLength(1);
    juice.rumble(2);
    expect(shake).not.toHaveBeenCalled();
    juice.rumble(3);
    juice.rumble(50);
    expect(shake).toHaveBeenCalledTimes(2);
    for (const [, intensity] of shake.mock.calls) expect(intensity).toBeLessThanOrEqual(0.006);
  });

  it('does nothing at all under reduced motion or without a scene', () => {
    const { juice, added, made, particles, shake } = fixture({ reducedMotion: true });
    const [a, b] = [sprite(), sprite()];
    juice.swap(a, b, 115);
    juice.refuse([a, b], 150);
    juice.land(a, 200, 5);
    juice.flash({ x: 1, y: 1 });
    juice.score(500, [0, 1, 2, 3], 3);
    juice.rumble(6);
    expect([added.length, made.length]).toEqual([0, 0]);
    expect(particles.emitBurst).not.toHaveBeenCalled();
    expect(shake).not.toHaveBeenCalled();
    const bare = new BoardJuice({ reducedMotion: false });
    expect(() => {
      bare.land(a, 100, 3);
      bare.score(100, [0], 1);
      bare.rumble(5);
    }).not.toThrow();
  });
});

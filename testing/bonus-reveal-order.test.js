import { describe, expect, it, vi } from 'vitest';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';

const flush = async () => {
  for (let i = 0; i < 12; i++) await Promise.resolve();
};
const makeAnimator = (reducedMotion = false) => {
  const tweens = [];
  const animator = new BoardAnimator({
    scene: {
      add: {},
      tweens: {
        add: (config) => {
          tweens.push(config);
          return { remove: vi.fn() };
        },
      },
    },
    settings: { reducedMotion },
    fxLayer: { add: vi.fn() },
    audio: { playBonusAppears: vi.fn() },
  });
  animator.boardCols = animator.boardRows = 6;
  animator.cellSize = 48;
  animator.clearGems = vi.fn().mockResolvedValue();
  animator.drawCells = vi.fn();
  animator.ring = vi.fn();
  animator.bonuses.icon = vi.fn(() => ({ scaleX: 1, scaleY: 1, destroy: vi.fn() }));
  animator.createGem = vi.fn((gem) => {
    const sprite = { __gemType: gem.type, destroy: vi.fn() };
    animator.gemSprites.set(gem.id, sprite);
    return sprite;
  });
  animator.fall = vi.fn().mockResolvedValue();
  const activation = vi.spyOn(animator.bonuses, 'play').mockResolvedValue();
  return { animator, tweens, activation };
};
const step = (overrides = {}) => ({
  index: 0,
  matches: [],
  cleared: [],
  bonuses: [],
  drops: [],
  spawns: [],
  ...overrides,
});
const earned = (type, index) => ({ index, gem: { id: `earned-${type}`, type } });

describe('earned bonus presentation before the next resolution phase', () => {
  it.each([false, true])(
    'finishes every reveal before a moved bonus activates (reduced motion: %s)',
    async (reducedMotion) => {
      const { animator, tweens, activation } = makeAnimator(reducedMotion);
      const alignment = step({ bonuses: [earned('bomb', 8), earned('rainbow', 20)] });
      const blast = step({ matches: [{ type: 'bonus-activation', indices: [8, 14] }] });
      const playback = animator.playSteps([alignment, blast]);
      await flush();

      expect(animator.indexToGemId[8]).toBe('earned-bomb');
      expect(animator.indexToGemId[20]).toBe('earned-rainbow');
      expect(animator.audio.playBonusAppears).toHaveBeenCalledTimes(2);
      expect(activation.mock.calls.map(([s]) => s)).toEqual([alignment]);
      expect(tweens).toHaveLength(2);
      if (reducedMotion) expect(animator.bonuses.icon).not.toHaveBeenCalled();

      tweens[0].onComplete();
      await flush();
      expect(activation.mock.calls.map(([s]) => s)).toEqual([alignment]);
      tweens[1].onComplete();
      await playback;
      expect(activation.mock.calls.map(([s]) => s)).toEqual([alignment, blast]);
      expect(animator.pending.size).toBe(0);
      expect(animator.effects.size).toBe(0);
    },
  );

  it('keeps an earned bonus visible before gravity moves it', async () => {
    const { animator, tweens } = makeAnimator();
    const bonus = earned('cross', 8);
    const playback = animator.playSteps([
      step({ bonuses: [bonus], drops: [{ from: 8, to: 14, gem: bonus.gem }] }),
    ]);
    await flush();
    expect(animator.fall).not.toHaveBeenCalled();
    tweens[0].onComplete();
    await playback;
    expect(animator.fall).toHaveBeenCalledOnce();
    expect(animator.indexToGemId[14]).toBe(bonus.gem.id);
  });

  it('settles a cancelled reveal without starting a late blast or refill', async () => {
    const { animator, activation } = makeAnimator();
    const alignment = step({
      bonuses: [earned('bomb', 8)],
      spawns: [{ index: 0, gem: { id: 'refill', type: 'ruby' } }],
    });
    const playback = animator.playSteps([
      alignment,
      step({ matches: [{ type: 'bonus-activation', indices: [8, 14] }] }),
    ]);
    await flush();
    animator.clear();
    await playback;
    expect(activation.mock.calls.map(([s]) => s)).toEqual([alignment]);
    expect(animator.createGem).toHaveBeenCalledOnce();
    expect(animator.fall).not.toHaveBeenCalled();
    expect(animator.pending.size).toBe(0);
    expect(animator.effects.size).toBe(0);
    expect(animator.gemSprites.size).toBe(0);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { describeBonusEffects, BonusEffects } from '../src/game/phaser/BonusEffects';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';

describe('bonus visual accuracy', () => {
  it('routes banners to the space above the board without drawing text over gems', () => {
    const onBanner = vi.fn();
    const text = vi.fn();
    const effects = new BonusEffects({ onBanner, scene: { add: { text } } });
    effects.callout('BOOM!', { x: 120, y: 180 }, 0xffbb64);
    expect(onBanner).toHaveBeenCalledWith({ label: 'BOOM!', color: '#ffbb64' });
    expect(text).not.toHaveBeenCalled();
  });
  it('animates activated chain bonuses only at cells that are actually cleared', () => {
    const step = {
      cleared: [1, 2, 3],
      matches: [{ type: 'bonus-activation', indices: [0, 1, 2, 3] }],
    };
    const types = ['cross', 'bomb', 'ruby', 'rainbow'];
    expect(describeBonusEffects(step, (index) => types[index])).toEqual([
      { type: 'bomb', index: 1, targets: [1, 2, 3] },
      { type: 'rainbow', index: 3, targets: [1, 2, 3] },
    ]);
  });

  it('animates the row power and every board bonus it chains', () => {
    const step = {
      cleared: [3, 4, 5],
      bonusEffect: { type: 'clear_row', originIndex: 3 },
      matches: [{ type: 'clear_row', indices: [3, 4, 5] }],
    };
    expect(describeBonusEffects(step, (index) => (index === 4 ? 'bomb' : 'ruby'))).toEqual([
      { type: 'clear_row', index: 3, targets: [3, 4, 5] },
      { type: 'bomb', index: 4, targets: [3, 4, 5] },
    ]);
    const cross = vi.fn();
    const effects = new BonusEffects({ position: () => ({ x: 30, y: 90 }) });
    effects.cross = cross;
    effects.impact(describeBonusEffects(step, () => 'bomb')[0]);
    expect(cross).toHaveBeenCalledWith({ x: 30, y: 90 }, true);
  });
});

it('cancels a special during its wind-up without a late impact or unresolved promise', async () => {
  const animator = new BoardAnimator({ scene: { tweens: { add: () => ({ remove: vi.fn() }) } } });
  const effects = animator.bonuses;
  effects.highlightTargets = vi.fn();
  effects.charge = vi.fn();
  effects.impact = vi.fn();
  const play = effects.play({ cleared: [0], bonusEffect: { type: 'tnt', originIndex: 0 } });
  expect(effects.charge).toHaveBeenCalledOnce();
  animator.clear();
  await play;
  expect(effects.impact).not.toHaveBeenCalled();
  expect(animator.pending.size).toBe(0);
});

it('keeps the bonus sound but skips decorative work and wind-up in reduced motion', async () => {
  const audio = { playBomb: vi.fn() };
  const animator = new BoardAnimator({ settings: { reducedMotion: true }, audio });
  const tween = vi.spyOn(animator, 'tween');
  await animator.bonuses.play({ cleared: [0], bonusEffect: { type: 'tnt', originIndex: 0 } });
  expect(audio.playBomb).toHaveBeenCalledOnce();
  expect(tween).not.toHaveBeenCalled();
  expect(animator.effects.size).toBe(0);
});

it.each([false, true])(
  'retires placement markers during activation (reduced motion: %s)',
  async (reducedMotion) => {
    let complete;
    const marker = { destroy: vi.fn() };
    const animator = new BoardAnimator({
      settings: { reducedMotion },
      scene: {
        tweens: {
          add: (config) => {
            complete = config.onComplete;
            return { remove: vi.fn() };
          },
        },
      },
      fxLayer: { add: vi.fn() },
    });
    animator.markers.set('preview', { objects: [marker] });
    animator.fadeBonusPreview();
    expect(animator.markers.has('preview')).toBe(false);
    if (!reducedMotion) {
      expect(marker.destroy).not.toHaveBeenCalled();
      expect(animator.effects.has(marker)).toBe(true);
      // Clearing a later preview must not interrupt the accepted target's fade.
      animator.clearBonusPreview();
      complete();
      await Promise.resolve();
    }
    expect(marker.destroy).toHaveBeenCalledOnce();
    expect(animator.effects.size).toBe(0);
  },
);

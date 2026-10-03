import { describe, expect, it, vi } from 'vitest';
import { createBoardLoop } from '../src/game/phaser/BoardLoop';
import { glyphImage } from '../src/game/phaser/TextGlyphs';
import { BoardAnimator, tileTexture } from '../src/game/phaser/BoardAnimator';

function fakeGame() {
  const listeners = new Set();
  const loop = {
    running: true,
    sleep: vi.fn(() => (loop.running = false)),
    wake: vi.fn(() => (loop.running = true)),
    resetDelta: vi.fn(),
  };
  return {
    loop,
    events: {
      on: (event, listener) => event === 'poststep' && listeners.add(listener),
      off: (event, listener) => listeners.delete(listener),
    },
    frame: () => listeners.forEach((listener) => listener()),
  };
}

describe('board game loop', () => {
  it('sleeps only after the board stays still, and wakes on new activity', () => {
    const game = fakeGame();
    let busy = true;
    const board = createBoardLoop(game, { busy: () => busy, idleFrames: 3 });
    for (let i = 0; i < 10; i++) game.frame();
    expect(game.loop.sleep).not.toHaveBeenCalled();
    busy = false;
    game.frame();
    game.frame();
    expect(game.loop.running).toBe(true);
    game.frame();
    expect(game.loop.running).toBe(false);
    board.wake();
    expect(game.loop.running).toBe(true);
    expect(game.loop.resetDelta).toHaveBeenCalledOnce();
  });

  it('keeps the results screen asleep until it closes, then stops listening when disposed', () => {
    const game = fakeGame();
    const board = createBoardLoop(game, { busy: () => true });
    board.hold(true);
    expect(game.loop.running).toBe(false);
    board.wake();
    expect(game.loop.running).toBe(false);
    board.hold(false);
    expect(game.loop.running).toBe(true);
    board.dispose();
    board.wake();
    game.loop.running = false;
    board.wake();
    expect(game.loop.running).toBe(false);
  });
});

describe('board drawing resources', () => {
  it('renders each badge label and style once into a shared texture', () => {
    const created = new Set();
    const make = vi.fn(() => ({ width: 18.2, height: 12, canvas: {}, destroy: vi.fn() }));
    const scene = {
      make: { text: make },
      textures: {
        exists: (key) => created.has(key),
        createCanvas: vi.fn((key) => {
          created.add(key);
          return { draw: vi.fn() };
        }),
      },
      add: { image: vi.fn((x, y, key) => ({ x, y, key })) },
    };
    const style = { fontSize: '12px', color: '#fff' };
    const a = glyphImage(scene, 1, 2, '3', style);
    const b = glyphImage(scene, 5, 6, '3', { color: '#fff', fontSize: '12px' });
    glyphImage(scene, 5, 6, '4', style);
    expect(a.key).toBe(b.key);
    expect(make).toHaveBeenCalledTimes(2);
    expect(scene.textures.createCanvas).toHaveBeenCalledWith(a.key, 19, 12);
  });

  it('reuses cleared gem sprites for refills', () => {
    const sprite = () => {
      const s = {
        setActive: vi.fn(() => s),
        setVisible: vi.fn(() => s),
        setPosition: vi.fn(() => s),
        setAlpha: vi.fn(() => s),
        setAngle: vi.fn(() => s),
        setTexture: vi.fn(() => s),
        setDisplaySize: vi.fn(() => s),
        anims: { stop: vi.fn() },
        destroy: vi.fn(),
      };
      return s;
    };
    const add = { sprite: vi.fn(sprite) };
    const animator = new BoardAnimator({
      scene: { add, tweens: { killTweensOf: vi.fn() }, textures: { exists: () => false } },
      gemLayer: { add: vi.fn() },
      textures: { ruby: { key: 'ruby' }, topaz: { key: 'topaz' } },
    });
    Object.assign(animator, { boardCols: 3, boardRows: 3, cellSize: 30 });
    const first = animator.createGem({ id: 'a', type: 'ruby' }, 0);
    animator.releaseGem('a');
    expect(first.setVisible).toHaveBeenLastCalledWith(false);
    const reused = animator.createGem({ id: 'b', type: 'topaz' }, 4);
    expect(reused).toBe(first);
    expect(add.sprite).toHaveBeenCalledOnce();
    expect(animator.gemSprites.get('b')).toBe(first);
    animator.clear();
    expect(first.destroy).toHaveBeenCalledOnce();
  });

  it('chooses one obstacle texture for live tiles and their breaking chips', () => {
    expect(tileTexture({ type: 'blocker', health: 2, maxHealth: 2 })).toBe('block-reinforced');
    expect(tileTexture({ type: 'blocker', health: 1 }, { damaged: true })).toBe('block-cracked');
    expect(tileTexture({ health: 1 }, { damaged: true, frozen: true })).toBe('ice-frost');
    expect(tileTexture({ health: 1 }, { damaged: true })).toBe('ice-cracked');
    expect(tileTexture({ rootKnot: true, type: 'blocker' })).toBe('tile-root-knot');
    expect(tileTexture({ fossilGroup: 0, bonusOnly: true })).toBe('tile-fossil-casing');
    expect(tileTexture({ fossilGroup: 0 })).toBe('tile-dust');
    expect(tileTexture({ bonusOnly: true, type: 'blocker' })).toBe('tile-blast-gate');
  });
});

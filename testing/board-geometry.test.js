import { describe, expect, it, vi } from 'vitest';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { boardEdges, fallRoute } from '../src/game/phaser/BoardGeometry';

const mask = ['.....', '.....', '_..._', '__.__'];
const tiles = mask
  .join('')
  .split('')
  .map((char) => ({ type: char === '_' ? 'void' : 'standard' }));

describe('visible and interactive shaped boards', () => {
  it('traces the actual funnel boundary, leaving the missing corners open', () => {
    const edges = boardEdges(tiles, 5, 4);
    expect(edges).toContainEqual([3, 4, 2, 4]);
    expect(edges).toContainEqual([2, 4, 2, 3]);
    expect(edges).toContainEqual([3, 3, 3, 4]);
    expect(edges.some(([x1, y1, x2, y2]) => y1 === 4 && y2 === 4 && (x1 < 2 || x2 > 3))).toBe(
      false,
    );
    // A closed outline has balanced incoming and outgoing vertices, even at steps.
    const balance = new Map();
    for (const [x1, y1, x2, y2] of edges) {
      const start = `${x1},${y1}`,
        end = `${x2},${y2}`;
      balance.set(start, (balance.get(start) ?? 0) + 1);
      balance.set(end, (balance.get(end) ?? 0) - 1);
    }
    expect([...balance.values()].every((value) => value === 0)).toBe(true);
  });

  it('rejects pointer and power targeting on missing cells and prevents swapping across gaps', () => {
    const gameStore = {
      sessionActive: true,
      tiles,
      board: [],
      activeBonusMode: 'bomb',
      resolveBonusClick: vi.fn(),
      resolveSwap: vi.fn(),
      notifyPlayerActivity: vi.fn(),
    };
    const input = new BoardInput({ gameStore, boardContainer: { x: 0, y: 0 } });
    input.setLayout({ boardCols: 5, boardRows: 4, cellSize: 40 });
    expect(input.getCellIndexFromPointer({ x: 20, y: 140 })).toBeNull();
    expect(input.getCellIndexFromPointer({ x: 100, y: 140 })).toBe(17);
    input.activateCell(15);
    expect(gameStore.resolveBonusClick).not.toHaveBeenCalled();
    input.focusIndex = 11;
    input.handleKey({ key: 'ArrowLeft', shiftKey: true, preventDefault() {} });
    expect(gameStore.resolveSwap).not.toHaveBeenCalled();
    expect(input.focusIndex).toBe(11);
  });

  it('routes a fall through every cell, queued above its entry', () => {
    expect(fallRoute([1, 6, 11, 17, 23], 5)).toEqual([
      { col: 1, row: 0 },
      { col: 1, row: 1 },
      { col: 1, row: 2 },
      { col: 2, row: 3 },
      { col: 3, row: 4 },
    ]);
    expect(fallRoute([2, 7], 5, 2)).toEqual([
      { col: 2, row: -2 },
      { col: 2, row: -1 },
      { col: 2, row: 0 },
      { col: 2, row: 1 },
    ]);
  });

  it.each([false, true])(
    'moves a gem around bends in one fall, never stopping at a bend (reduced motion: %s)',
    (reducedMotion) => {
      const animator = new BoardAnimator({ settings: { reducedMotion } });
      Object.assign(animator, { boardCols: 5, cellSize: 40 });
      const sprite = { setPosition: vi.fn((x, y) => Object.assign(sprite, { x, y })) };
      animator.tween = vi.fn().mockResolvedValue();
      animator.fallAlong(sprite, fallRoute([1, 6, 11, 17, 23], 5, 1));
      expect(animator.tween).toHaveBeenCalledOnce();
      expect(sprite).toMatchObject({ x: 60, y: -20 });
      const [, config] = animator.tween.mock.calls[0];
      if (reducedMotion) {
        expect(config).toMatchObject({ ...animator.position(23), duration: 90 });
        return;
      }
      // The same easing and pace as a straight fall of the same length.
      expect(config).toMatchObject({
        x: [60, 60, 60, 60, 100, 140],
        y: [-20, 20, 60, 100, 140, 180],
        interpolation: 'linear',
        ease: 'Bounce.easeOut',
        duration: animator.fallDuration(5),
      });
    },
  );

  it('queues shaped-board refills one cell apart instead of stacking them', async () => {
    const animator = new BoardAnimator({});
    Object.assign(animator, { boardCols: 5, boardRows: 4, cellSize: 40, scene: { add: {} } });
    animator.bonuses.play = vi.fn().mockResolvedValue();
    animator.drawCells = vi.fn();
    animator.createGem = vi.fn((gem) => {
      const sprite = { setPosition: vi.fn((x, y) => Object.assign(sprite, { x, y })) };
      animator.gemSprites.set(gem.id, sprite);
      return sprite;
    });
    const starts = [];
    animator.tween = vi.fn(async (sprite) => starts.push({ x: sprite.x, y: sprite.y }));
    const gem = (id) => ({ id, type: 'ruby' });
    // Three refills enter at cell 2; the deepest one leads the queue.
    await animator.playSteps([
      {
        matches: [],
        cleared: [],
        drops: [],
        spawns: [
          { index: 17, gem: gem('a'), path: [2, 7, 12, 17] },
          { index: 12, gem: gem('b'), path: [2, 7, 12] },
          { index: 7, gem: gem('c'), path: [2, 7] },
        ],
      },
    ]);
    expect(animator.tween).toHaveBeenCalledTimes(3);
    expect(starts).toEqual([
      { x: 100, y: -20 },
      { x: 100, y: -60 },
      { x: 100, y: -100 },
    ]);
  });
});

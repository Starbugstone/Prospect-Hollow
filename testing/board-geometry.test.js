import { describe, expect, it, vi } from 'vitest';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { boardEdges, fallWaypoints } from '../src/game/phaser/BoardGeometry';

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

  it('keeps directional bends visible during a pearl fall and respects cancellation', async () => {
    const path = [1, 6, 11, 17, 23];
    expect(fallWaypoints(path, 5)).toEqual([1, 11, 23]);
    const animator = new BoardAnimator({});
    Object.assign(animator, { boardCols: 5, cellSize: 40 });
    const sprite = animator.position(1);
    animator.tween = vi.fn(async (target, config) => Object.assign(target, config));
    await animator.fallAlong(sprite, path);
    expect(animator.tween.mock.calls.map(([, config]) => ({ x: config.x, y: config.y }))).toEqual([
      animator.position(11),
      animator.position(23),
    ]);
    animator.tween = vi.fn(async () => {
      animator.generation++;
    });
    await animator.fallAlong(sprite, path);
    expect(animator.tween).toHaveBeenCalledOnce();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { BoardInput } from '../src/game/phaser/BoardInput';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { boardEdges, fallDelays, fallMotion, fallRoute } from '../src/game/phaser/BoardGeometry';

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
      // The pace of a straight fall of the same length, through every cell in turn.
      expect(config).toMatchObject({ fallProgress: 1, duration: animator.fallDuration(5) });
      const path = [];
      for (let k = 0; k <= 1; k += 0.0005) {
        sprite.fallProgress = k;
        config.onUpdate();
        path.push({ x: sprite.x, y: sprite.y });
      }
      const passes = ([x, y]) => path.some((point) => Math.hypot(point.x - x, point.y - y) < 1);
      for (const cell of [
        [60, -20],
        [60, 20],
        [60, 60],
        [60, 100],
        [100, 140],
        [140, 180],
      ])
        expect(passes(cell)).toBe(true);
      sprite.fallProgress = 1;
      config.onUpdate();
      expect(sprite).toMatchObject({ x: 140, y: 180 });
    },
  );

  it('settles a long fall with the small bounce of a one-cell drop, never back round a bend', () => {
    const route = fallRoute([1, 6, 11, 17, 23], 5, 1);
    const at = fallMotion(route);
    for (let k = 1 / 2.75; k <= 1; k += 0.01) {
      const { col, row } = at(k);
      expect(col).toBe(3);
      expect(row).toBeGreaterThanOrEqual(3.75 - 1e-9);
      expect(row).toBeLessThanOrEqual(4);
    }
    // Falling up, it bounces downwards.
    const rising = fallMotion(fallRoute([23, 18, 13], 5, 0, true), { rise: true });
    expect(rising(0.5).row).toBeGreaterThan(2);
  });

  it('hides a gem crossing a portal and lands it out of the exit without a bounce', () => {
    // Out of the entrance at (0, 1) and into the exit at (3, 0).
    const route = [
      { col: 0, row: 0 },
      { col: 0, row: 1 },
      { col: 3, row: 0 },
    ];
    const at = fallMotion(route);
    expect(at.hides).toBe(true);
    const crossing = Math.sqrt(1.5 / 2 / 7.5625);
    expect(at(crossing).hidden).toBe(true);
    for (let k = 1 / 2.75; k <= 1; k += 0.05) expect(at(k)).toMatchObject({ col: 3, row: 0 });
    expect(fallMotion(fallRoute([1, 6], 5)).hides).toBe(false);
  });

  it('hides refills queued over board cells above a shallow hole until they leave them', async () => {
    // Column 1 enters at row 2, below a one-cell hole with a playable cell above it.
    const tiles = Array.from({ length: 15 }, (_, index) => ({
      type: index === 4 ? 'void' : 'standard',
    }));
    const animator = new BoardAnimator({});
    Object.assign(animator, {
      boardCols: 3,
      boardRows: 5,
      cellSize: 40,
      scene: { add: {} },
      tiles,
    });
    animator.bonuses.play = vi.fn().mockResolvedValue();
    animator.drawCells = vi.fn();
    animator.createGem = vi.fn((gem) => {
      const sprite = {
        setPosition: vi.fn((x, y) => Object.assign(sprite, { x, y })),
        setAlpha: vi.fn((alpha) => Object.assign(sprite, { alpha })),
      };
      animator.gemSprites.set(gem.id, sprite);
      return sprite;
    });
    const starts = {};
    animator.tween = vi.fn(async (sprite) => (starts[sprite.y] = sprite.alpha ?? 1));
    await animator.playSteps([
      {
        matches: [],
        cleared: [],
        drops: [],
        spawns: [
          { index: 10, gem: { id: 'a', type: 'ruby' }, path: [7, 10] },
          { index: 7, gem: { id: 'b', type: 'ruby' }, path: [7] },
        ],
      },
    ]);
    // The first waits in the hole and shows; the second waits over row 0 and does not.
    expect(starts).toEqual({ 60: 1, 20: 0 });
  });

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

// The closest two scheduled falls come while both are in view, sampled every millisecond.
const closest = (falls, delays) => {
  const end = Math.max(...falls.map((fall, i) => delays[i] + fall.duration));
  let best = Infinity;
  for (let t = 0; t <= end; t++) {
    const points = falls.map((fall, i) => ({
      ...fall.motion(Math.min(1, Math.max(0, t - delays[i]) / fall.duration)),
    }));
    for (let a = 0; a < points.length; a++)
      for (let b = a + 1; b < points.length; b++)
        if (!points[a].hidden && !points[b].hidden && !falls[a].passes && !falls[b].passes)
          best = Math.min(
            best,
            Math.hypot(points[a].col - points[b].col, points[a].row - points[b].row),
          );
  }
  return best;
};
const plan = (route, options = {}) => ({
  route,
  duration: 190 + Math.min(5, route.length - 1) * 12,
  motion: fallMotion(route, options),
  ...options,
});
const cells = (...pairs) => pairs.map(([col, row]) => ({ col, row }));

describe('falls that share a route', () => {
  it('start together when they never meet', () => {
    const falls = [plan(cells([0, 0], [0, 1], [0, 2])), plan(cells([3, 0], [3, 1]))];
    expect(fallDelays(falls)).toEqual([0, 0]);
  });

  it('let the gem landing deeper through a merge first', () => {
    // A diagonal lane joins a column: the column gem goes on below the merge cell,
    // the lane gem stops on it (as on level 373).
    const falls = [
      plan(cells([1, 4], [2, 5], [2, 6])),
      plan(cells([2, 4], [2, 5], [2, 6], [3, 7])),
    ];
    expect(closest(falls, [0, 0])).toBeLessThan(0.6);
    const delays = fallDelays(falls);
    expect(delays[1]).toBe(0);
    expect(delays[0]).toBeGreaterThan(0);
    expect(closest(falls, delays)).toBeGreaterThanOrEqual(0.6);
  });

  it('keep a gem from above out of a portal exit until the portal gem has left it', () => {
    // As on level 475: the portal gem drops on to (3, 5); the gem above stops at (3, 4).
    const falls = [
      plan(cells([3, 2], [3, 3], [3, 4])),
      plan(cells([0, 5], [3, 3], [3, 4], [3, 5])),
      plan(cells([3, 1], [3, 2], [3, 3])),
    ];
    expect(closest(falls, [0, 0, 0])).toBeLessThan(0.6);
    const delays = fallDelays(falls);
    expect(delays[1]).toBe(0);
    expect(closest(falls, delays)).toBeGreaterThanOrEqual(0.6);
  });

  it('let gems sink past a floatstone without waiting for it', () => {
    const falls = [
      plan(cells([2, 4], [2, 3], [2, 2]), { rise: true, passes: true }),
      plan(cells([2, 1], [2, 2], [2, 3], [2, 4])),
    ];
    expect(fallDelays(falls)).toEqual([0, 0]);
  });
});

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useGameStore } from '../src/stores/gameStore';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { preloadSpriteAssets } from '../src/game/phaser/SpriteLoader';
import { spriteRef } from '../src/game/phaser/spriteRefs';
import { sharedLoader } from '../src/game/phaser/loadBoard';
import frames from '../src/assets/board/frames.json';
let game;
beforeEach(() => {
  setActivePinia(createPinia());
  game = useGameStore();
});
afterEach(() => {
  game.cancelHint();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('shares prefetch work and allows a rejected module import to retry', async () => {
  const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ default: {} }),
    load = sharedLoader(importer);
  await expect(load()).rejects.toThrow('offline');
  await Promise.all([load(), load()]);
  expect(importer).toHaveBeenCalledTimes(2);
});
it('resolves every atlas frame and falls back independently per texture manager', () => {
  const atlas = {
    exists: (key) => !!frames[key],
    get: (key) => ({ has: (id) => !!frames[key]?.frames[id] }),
  };
  for (const [key, definition] of Object.entries(frames))
    for (const id of Object.keys(definition.frames)) {
      expect(spriteRef(id, atlas)).toEqual({ key, frame: id });
      expect(spriteRef(id, { exists: () => false }).key).toBe(
        /^(bomb|rainbow|cross)-/.test(id) ? 'bonus-atlas' : id,
      );
    }
});
it('loads just the active finish and recovers atlas errors with SVG assets', () => {
  const listeners = new Map(),
    atlas = vi.fn(),
    svg = vi.fn();
  const scene = {
    textures: { exists: () => false },
    load: { atlas, svg, on: (name, fn) => listeners.set(name, fn), once: vi.fn(), off: vi.fn() },
  };
  preloadSpriteAssets(scene, { levelId: 1 });
  expect(atlas.mock.calls.map(([key]) => key)).toEqual([
    'board-core',
    'board-bonus',
    'gems-classic',
  ]);
  listeners.get('loaderror')({ key: 'board-core' });
  expect(svg).toHaveBeenCalledWith('gem-ruby', '/art/ruby.svg', expect.any(Object));
  const count = svg.mock.calls.length;
  listeners.get('loaderror')({ key: 'board-bonus' });
  expect(svg).toHaveBeenCalledTimes(count);
});
function attach() {
  game.attachRenderer({ scene: {}, boardContainer: {} });
}
function session() {
  game.sessionActive = true;
  game.sessionVersion++;
  game.animationInProgress = true;
  vi.stubGlobal('window', {});
}
it('waits for a cold renderer and releases queued input once after the single intro', async () => {
  let complete;
  const intro = vi.spyOn(BoardAnimator.prototype, 'playIntroCascade').mockImplementation(
    () =>
      new Promise((r) => {
        complete = r;
      }),
  );
  const queued = vi.spyOn(game, 'processQueuedInput').mockImplementation(() => {});
  vi.spyOn(game, 'ensurePlayableBoard').mockResolvedValue(true);
  session();
  game.requestIntro();
  game.requestIntro();
  await Promise.resolve();
  expect(intro).not.toHaveBeenCalled();
  expect(game.animationInProgress).toBe(true);
  attach();
  await Promise.resolve();
  expect(intro).toHaveBeenCalledTimes(1);
  expect(queued).not.toHaveBeenCalled();
  complete();
  await game.introTask;
  expect(game.animationInProgress).toBe(false);
  expect(queued).toHaveBeenCalledTimes(1);
});
it('finalizes rejection once and recovers a lost renderer without replaying the intro', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const intro = vi
    .spyOn(BoardAnimator.prototype, 'playIntroCascade')
    .mockRejectedValue(new Error('lost'));
  vi.spyOn(game, 'processQueuedInput').mockImplementation(() => {});
  vi.spyOn(game, 'ensurePlayableBoard').mockResolvedValue(true);
  session();
  attach();
  game.requestIntro();
  await game.introTask;
  expect(game.animationInProgress).toBe(false);
  game.detachRenderer();
  game.rendererRecovering = true;
  game.animationInProgress = true;
  attach();
  expect(game.animationInProgress).toBe(false);
  expect(intro).toHaveBeenCalledTimes(1);
});
it('ignores stale intro finalization when a new puzzle starts', async () => {
  let done;
  vi.spyOn(BoardAnimator.prototype, 'playIntroCascade').mockImplementation(
    () =>
      new Promise((r) => {
        done = r;
      }),
  );
  const queued = vi.spyOn(game, 'processQueuedInput').mockImplementation(() => {});
  session();
  attach();
  game.requestIntro();
  await Promise.resolve();
  game.sessionVersion++;
  game.animationInProgress = true;
  done();
  await game.introTask;
  expect(game.animationInProgress).toBe(true);
  expect(queued).not.toHaveBeenCalled();
});

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
function tileRenderer(mode) {
  const core = frames['board-core'].frames;
  const glyphs = new Set();
  const textures = {
    exists: (key) => glyphs.has(key) || (mode === 'atlas' ? key === 'board-core' : !!core[key]),
    get: (key) => ({ has: (frame) => key === 'board-core' && !!core[frame] }),
    createCanvas: (key) => glyphs.add(key) && { draw() {} },
  };
  const object = () => ({
    scaleX: 1,
    scaleY: 1,
    add: vi.fn(),
    setDisplaySize() {
      return this;
    },
    setAlpha() {
      return this;
    },
    setOrigin() {
      return this;
    },
    setStrokeStyle() {
      return this;
    },
    destroy() {},
  });
  const image = vi.fn((x, y, key, frame) => {
    // Model Phaser's real lookup: old standalone keys are absent in atlas mode.
    if (!textures.exists(key) || (frame && !textures.get(key).has(frame)))
      throw new Error(`Missing texture: ${key}/${frame}`);
    return object();
  });
  const circle = vi.fn(object);
  const animator = new BoardAnimator({
    scene: {
      textures,
      add: { image, container: object, circle },
      make: { text: () => ({ width: 20, height: 16, canvas: {}, destroy() {} }) },
    },
    tileLayer: { add: vi.fn() },
  });
  animator.boardCols = animator.boardRows = 6;
  animator.cellSize = 48;
  return { animator, image, circle };
}
it.each([
  ['atlas', 'ice'],
  ['atlas', 'blocker'],
  ['svg', 'ice'],
  ['svg', 'blocker'],
])(
  'renders the %s %s breaking effect without a missing-texture placeholder',
  async (mode, type) => {
    const { animator, image } = tileRenderer(mode);
    animator.tiles = [{ type, health: 1 }];
    animator.clearGems = vi.fn().mockResolvedValue();
    animator.drawCells = vi.fn();
    animator.effect = vi.fn();
    await animator.playSteps([
      {
        cleared: [],
        drops: [],
        spawns: [],
        tileUpdates: [{ index: 0, health: 0 }],
      },
    ]);
    const id = type === 'blocker' ? 'block-cracked' : 'ice-cracked';
    expect(image).toHaveBeenCalledWith(
      24,
      24,
      mode === 'atlas' ? 'board-core' : id,
      mode === 'atlas' ? id : undefined,
    );
    expect(animator.effect).toHaveBeenCalledOnce();
  },
);
it.each(['atlas', 'svg'])('renders lantern and survey markers from %s textures', (mode) => {
  const { animator, image } = tileRenderer(mode);
  animator.tiles = [
    { signal: 'lantern', signalHealth: 1 },
    { signal: 'survey', signalHealth: 0, surveyOrder: 2 },
  ];
  animator.tiles.forEach((_, index) => animator.drawTileOverlay(index));
  expect(
    image.mock.calls.map((args) => args.slice(2)).filter(([key]) => !key.startsWith('glyph:')),
  ).toEqual(
    ['tile-lantern', 'tile-survey'].map((id) =>
      mode === 'atlas' ? ['board-core', id] : [id, undefined],
    ),
  );
});
it.each(['atlas', 'svg'])(
  'renders a charge core and redraws its pips only when the charge changes (%s)',
  (mode) => {
    const { animator, image, circle } = tileRenderer(mode);
    animator.tiles = [{ signal: 'core', signalHealth: 2 }];
    animator.drawTileOverlay(0);
    expect(image.mock.calls.map((args) => args.slice(2))).toEqual([
      mode === 'atlas' ? ['board-core', 'tile-core'] : ['tile-core', undefined],
    ]);
    expect(circle.mock.calls.map((args) => args[3])).toEqual([0xffd36e, 0x1d3f55, 0x1d3f55]);
    animator.drawTileOverlay(0);
    expect(circle).toHaveBeenCalledTimes(3);
    animator.tiles[0].signalHealth = 0;
    animator.drawTileOverlay(0);
    expect(circle.mock.calls.slice(3).map((args) => args[3])).toEqual([
      0xffd36e, 0xffd36e, 0xffd36e,
    ]);
  },
);
function attach() {
  game.attachRenderer({ scene: {}, boardContainer: {} });
}
function session() {
  game.sessionActive = true;
  game.sessionVersion++;
  game.animationInProgress = true;
  vi.stubGlobal('window', {});
}
it('starts mine audio synchronously and does not replay it on renderer recovery', () => {
  const audio = { playAmbientLoop: vi.fn() };
  game.setAudioManager(audio);
  vi.spyOn(game, 'refreshBoardVisuals').mockImplementation(() => {});
  vi.spyOn(game, 'requestIntro').mockImplementation(() => {});
  const frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback) => frames.push(callback));
  game.bootstrap();
  game.startLevel(1);
  expect(audio.playAmbientLoop).toHaveBeenCalledOnce();
  for (let recovery = 0; recovery < 2; recovery++) {
    attach();
    while (frames.length) frames.shift()();
    expect(audio.playAmbientLoop).toHaveBeenCalledOnce();
    game.detachRenderer();
  }
});
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

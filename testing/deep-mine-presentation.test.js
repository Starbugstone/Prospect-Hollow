import { readFile } from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MineGoals from '../src/components/MineGoals.vue';
import { DEEP_MINE_CHAPTERS } from '../src/data/deepMineLevels';
import {
  DEEP_MINE_SPRITES,
  mineRelicAppearance,
  mineSignalAppearance,
  mineThemeAppearance,
} from '../src/data/mineThemes';
import { OBSTACLES, obstaclesInLevel } from '../src/data/obstacles';
import { applyDeepMineSpec } from '../src/game/engine/DeepMineMechanics';
import { generateLevelConfigs } from '../src/game/engine/LevelGenerator';
import { BoardAnimator } from '../src/game/phaser/BoardAnimator';
import { preloadSpriteAssets } from '../src/game/phaser/SpriteLoader';
import { spriteRef } from '../src/game/phaser/spriteRefs';
import frames from '../src/assets/board/frames.json';
import { setLocale } from '../src/i18n';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

let pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
  setLocale('en');
});
afterEach(() => {
  useGameStore().cancelHint();
  vi.restoreAllMocks();
});

const textureManager = (mode) => ({
  exists: (key) => (mode === 'atlas' ? key === 'board-core' : !!frames['board-core'].frames[key]),
  get: (key) => ({ has: (frame) => key === 'board-core' && !!frames[key].frames[frame] }),
});

function renderer(mode = 'atlas', levelId = 373) {
  const textures = textureManager(mode);
  const objects = [];
  const node = (x = 0, y = 0, key, frame) => {
    const object = {
      x,
      y,
      key,
      frame,
      width: 160,
      height: 160,
      children: [],
      anims: { stop: vi.fn() },
      add(child) {
        this.children.push(child);
        return this;
      },
      setTexture(key, frame) {
        if (!textures.exists(key) || (frame && !textures.get(key).has(frame)))
          throw new Error(`Missing texture ${key}/${frame}`);
        Object.assign(this, { key, frame });
        return this;
      },
      setPosition(x, y) {
        Object.assign(this, { x, y });
        return this;
      },
      setDisplaySize(displayWidth, displayHeight) {
        Object.assign(this, { displayWidth, displayHeight });
        return this;
      },
      setCrop(x, y, width, height) {
        this.crop = { x, y, width, height };
        return this;
      },
      setAlpha(alpha) {
        this.alpha = alpha;
        return this;
      },
      setSize() {
        return this;
      },
      setFillStyle() {
        return this;
      },
      setStrokeStyle() {
        return this;
      },
      setOrigin() {
        return this;
      },
      destroy: vi.fn(),
    };
    objects.push(object);
    return object;
  };
  const image = vi.fn((x, y, key, frame) => node(x, y).setTexture(key, frame));
  const graphics = vi.fn(() => {
    const graphic = node();
    graphic.lines = [];
    graphic.lineStyle = () => graphic;
    graphic.beginPath = () => graphic;
    graphic.moveTo = (x, y) => {
      graphic.start = { x, y };
      return graphic;
    };
    graphic.lineTo = (x, y) => {
      graphic.end = { x, y };
      return graphic;
    };
    graphic.strokePath = () => {
      graphic.lines.push({ start: graphic.start, end: graphic.end });
      return graphic;
    };
    return graphic;
  });
  const animator = new BoardAnimator({
    scene: {
      textures,
      add: { image, graphics, rectangle: node, container: node, text: node, circle: node },
    },
    backgroundLayer: node(),
    tileLayer: node(),
    textures: { relic: spriteRef('gem-relic', textures) },
  });
  Object.assign(animator, { levelId, boardCols: 5, boardRows: 5, cellSize: 48 });
  return { animator, image, graphics, objects };
}

describe('theme and asset contracts', () => {
  it('uses coherent new mine skins while unknown and incomplete theme slots retain familiar rules', () => {
    for (const { theme } of DEEP_MINE_CHAPTERS) {
      expect(Object.keys(mineThemeAppearance(theme).style)).toHaveLength(6);
      expect(mineThemeAppearance(theme).decorations.length).toBeGreaterThan(0);
      expect(mineSignalAppearance(theme, 'lantern').id).toBe('mushroom');
      expect(mineSignalAppearance(theme, 'core').id).toBe('brazier');
      expect(mineSignalAppearance(theme, 'survey')).toBeUndefined();
    }
    expect(mineSignalAppearance('future-unregistered', 'lantern').texture).toBe('tile-lantern');
    expect(mineSignalAppearance('future-unregistered', 'core').texture).toBe('tile-core');
    expect(mineRelicAppearance('future-unregistered').texture).toBe('gem-relic');
    expect(mineThemeAppearance('future-unregistered')).toEqual(
      expect.objectContaining({ style: {}, decorations: [] }),
    );
    expect(mineRelicAppearance('glowshroom-grotto').texture).toBe('gem-relic');
    expect(mineRelicAppearance('underground-reservoir').texture).toBe('gem-pearl');
  });

  it('packages every new visual in the atlas and keeps its real SVG available for recovery', async () => {
    expect(new Set(DEEP_MINE_SPRITES.map(([id]) => id)).size).toBe(DEEP_MINE_SPRITES.length);
    for (const [id, file] of DEEP_MINE_SPRITES) {
      const frame = frames['board-core'].frames[id];
      expect(frame.sourceSize).toEqual({ w: 160, h: 160 });
      expect(frame.frame.x + frame.frame.w).toBeLessThanOrEqual(frames['board-core'].meta.size.w);
      expect(frame.frame.y + frame.frame.h).toBeLessThanOrEqual(frames['board-core'].meta.size.h);
      const source = await readFile(new URL(`../public/art/${file}`, import.meta.url), 'utf8');
      expect(source).toContain('<svg');
      expect(spriteRef(id, textureManager('atlas'))).toEqual({ key: 'board-core', frame: id });
      expect(spriteRef(id, textureManager('svg'))).toEqual({ key: id, frame: undefined });
    }
  });

  it('recovers all new sprites once when an atlas fails and removes its loader listener at completion', () => {
    const listeners = new Map();
    let complete;
    const scene = {
      textures: { exists: () => false },
      load: {
        atlas: vi.fn(),
        svg: vi.fn(),
        on: (event, listener) => listeners.set(event, listener),
        once: (event, listener) => {
          if (event === 'complete') complete = listener;
        },
        off: vi.fn(),
      },
    };
    preloadSpriteAssets(scene, { levelId: 391 });
    expect(scene.load.svg).not.toHaveBeenCalled();
    listeners.get('loaderror')({ key: 'board-core' });
    for (const [id, file] of DEEP_MINE_SPRITES)
      expect(scene.load.svg).toHaveBeenCalledWith(id, `/art/${file}`, { width: 160, height: 160 });
    const count = scene.load.svg.mock.calls.length;
    listeners.get('loaderror')({ key: 'board-bonus' });
    expect(scene.load.svg).toHaveBeenCalledTimes(count);
    complete();
    expect(scene.load.off).toHaveBeenCalledWith('loaderror', listeners.get('loaderror'));
  });

  it.each(['atlas', 'svg'])(
    'shows pearls through the same logical relic gem in %s mode',
    (mode) => {
      const { animator, objects } = renderer(mode, 391);
      const sprite = objects[0];
      animator.configureGem(sprite, 'relic');
      expect([sprite.key, sprite.frame]).toEqual(
        mode === 'atlas' ? ['board-core', 'gem-pearl'] : ['gem-pearl', undefined],
      );
      expect(sprite.__gemType).toBe('relic');
      animator.levelId = 1;
      animator.configureGem(sprite, 'relic');
      expect([sprite.key, sprite.frame]).toEqual(
        mode === 'atlas' ? ['board-core', 'gem-relic'] : ['gem-relic', undefined],
      );
    },
  );
});

describe('fossil and linked root presentation', () => {
  it.each(['atlas', 'svg'])(
    'draws thematic floor signals, vine bindings and pearl exits from %s textures',
    (mode) => {
      const { animator, image } = renderer(mode, 391);
      animator.tiles = [
        { signal: 'lantern', signalHealth: 1 },
        { signal: 'core', signalHealth: 3, coreCharges: 4 },
        { exit: true },
        { rootGroup: 'a', chainHealth: 1 },
      ];
      for (let index = 0; index < animator.tiles.length; index++) animator.drawTileOverlay(index);
      expect(image.mock.calls.map((args) => args.slice(2))).toEqual(
        ['tile-mushroom', 'tile-brazier', 'tile-pearl-exit', 'tile-vine'].map((id) =>
          mode === 'atlas' ? ['board-core', id] : [id, undefined],
        ),
      );
    },
  );

  it.each(['atlas', 'svg'])(
    'fits each fossil quarter inside its marked cell in %s mode',
    (mode) => {
      const { animator } = renderer(mode);
      const cells = [6, 7, 11, 12];
      animator.tiles = applyDeepMineSpec(
        Array.from({ length: 25 }, () => ({ type: 'standard', health: 0, maxHealth: 0 })),
        { fossils: [{ id: 'shell', cells, layers: 2 }] },
      );
      animator.drawCells();
      const sprites = cells.map((index) => animator.fossilSprites.get(index));
      for (const [part, index] of cells.entries()) {
        const sprite = sprites[part];
        const scale = sprite.displayWidth / sprite.width;
        const left = sprite.x - (sprite.width / 2) * scale + sprite.crop.x * scale;
        const top = sprite.y - (sprite.height / 2) * scale + sprite.crop.y * scale;
        expect(left).toBeCloseTo((index % 5) * 48);
        expect(top).toBeCloseTo(Math.floor(index / 5) * 48);
        expect(sprite.crop.width * scale).toBe(48);
        expect(sprite.crop.height * scale).toBe(48);
        expect(sprite.alpha).toBeLessThan(0.2);
      }
      expect(new Set(sprites.map((sprite) => `${sprite.x},${sprite.y}`)).size).toBe(1);
      animator.tiles[6].health = 0;
      animator.drawFossilFloor(6);
      expect(sprites[0].alpha).toBeGreaterThan(0.8);
      for (const index of cells) {
        animator.tiles[index].health = 0;
        animator.tiles[index].fossilCollected = true;
      }
      animator.drawCells();
      expect(cells.map((index) => animator.fossilSprites.get(index))).toEqual(sprites);
      expect(sprites.every((sprite) => sprite.alpha < 0.5)).toBe(true);
    },
  );

  it.each(['atlas', 'svg'])(
    'removes only cut root links and bindings without redrawing unchanged %s links',
    (mode) => {
      const { animator, graphics } = renderer(mode, 385);
      animator.tiles = applyDeepMineSpec(
        Array.from({ length: 25 }, () => ({ type: 'standard', health: 0, maxHealth: 0 })),
        { roots: [{ id: 'a', knot: 12, bindings: [7, 11, 13, 17] }] },
      );
      animator.drawCells();
      const links = animator.rootLinks;
      expect(links.lines).toHaveLength(4);
      for (const { start, end } of links.lines) {
        expect(Math.abs(start.x - end.x) + Math.abs(start.y - end.y)).toBe(48);
        expect(start.x === end.x || start.y === end.y).toBe(true);
      }
      animator.drawCells();
      expect(graphics).toHaveBeenCalledOnce();
      animator.tiles[7].chainHealth = 0;
      animator.drawCells();
      expect(links.destroy).toHaveBeenCalledOnce();
      expect(animator.rootLinks.lines).toHaveLength(3);
      expect(animator.tileOverlays.has(7)).toBe(false);
      const remaining = animator.rootLinks;
      animator.tiles[12].health = 0;
      for (const index of [11, 13, 17]) animator.tiles[index].chainHealth = 0;
      animator.drawCells();
      expect(remaining.destroy).toHaveBeenCalledOnce();
      expect(animator.rootLinks).toBeNull();
      expect([7, 11, 13, 17].some((index) => animator.tileOverlays.has(index))).toBe(false);
    },
  );

  it('does not infer root links from incomplete knots and unrelated ordinary chains', () => {
    const { animator, graphics } = renderer();
    animator.tiles = [
      { type: 'blocker', health: 1, rootKnot: true },
      { type: 'standard', health: 0, chainHealth: 1 },
    ];
    animator.drawRootLinks();
    expect(graphics).not.toHaveBeenCalled();
    expect(animator.rootLinks).toBeNull();
  });
});

describe('intuitive goal and guide labels', () => {
  it('teaches fossils and root knots without misidentifying them as ice, stone or ordinary chains', () => {
    const tiles = applyDeepMineSpec(
      Array.from({ length: 25 }, () => ({ type: 'standard', health: 0, maxHealth: 0 })),
      {
        fossils: [{ id: 'shell', cells: [6, 7, 11, 12], layers: 2 }],
        roots: [{ id: 'a', knot: 18, bindings: [13, 17, 19, 23], knotHealth: 2 }],
      },
    );
    expect(obstaclesInLevel(tiles).map((item) => item.id)).toEqual(['fossil', 'root-knot']);
    tiles[0].health = tiles[0].maxHealth = 1;
    tiles[1].type = 'blocker';
    tiles[1].health = tiles[1].maxHealth = 1;
    tiles[2].chainHealth = 1;
    expect(obstaclesInLevel(tiles).map((item) => item.id)).toEqual([
      'fossil',
      'root-knot',
      'ice',
      'stone',
      'chain',
    ]);
  });

  it('keeps skinned guide art and labels consistent with the actual signals and delivery goal', () => {
    const tiles = [
      { signal: 'lantern', signalHealth: 1 },
      { signal: 'core', signalHealth: 4 },
      { exit: true },
    ];
    const guide = obstaclesInLevel(tiles, 'underground-reservoir');
    expect(guide.map(({ id }) => id)).toEqual(['mushroom', 'brazier', 'pearl']);
    expect(guide.map(({ art }) => art)).toEqual([
      '/art/obstacles/mushroom.svg',
      '/art/obstacles/brazier.svg',
      '/art/obstacles/pearl.svg',
    ]);
    expect(obstaclesInLevel(tiles, 'older-unregistered').map(({ id }) => id)).toEqual([
      'lantern',
      'charge-core',
      'relic',
    ]);
  });

  it('remembers the first fossil and root introductions across later chapters', () => {
    const levels = generateLevelConfigs();
    const campaign = useCampaignStore();
    campaign.seenObstacles = OBSTACLES.filter(
      (item) => !['fossil', 'root-knot'].includes(item.id),
    ).map(({ id }) => id);
    const firstFossil = obstaclesInLevel(levels[372].tiles, levels[372].theme);
    expect(
      firstFossil.filter(({ id }) => !campaign.seenObstacles.includes(id)).map(({ id }) => id),
    ).toEqual(['fossil']);
    campaign.markObstaclesSeen(['fossil']);
    expect(
      obstaclesInLevel(levels[373].tiles, levels[373].theme).filter(
        ({ id }) => !campaign.seenObstacles.includes(id),
      ),
    ).toEqual([]);
    const firstRoots = obstaclesInLevel(levels[384].tiles, levels[384].theme);
    expect(
      firstRoots.filter(({ id }) => !campaign.seenObstacles.includes(id)).map(({ id }) => id),
    ).toEqual(['root-knot']);
    campaign.markObstaclesSeen(['root-knot']);
    expect(
      obstaclesInLevel(levels[386].tiles, levels[386].theme).filter(
        ({ id }) => !campaign.seenObstacles.includes(id),
      ),
    ).toEqual([]);
  });

  it('renders an empty goal list safely before initial level tiles arrive', async () => {
    const html = await renderToString(createSSRApp({ render: () => h(MineGoals) }).use(pinia));
    expect(html).toContain('Clear these to finish');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Root knots');
  });

  it('counts completed fossil groups and knots once while ordinary ice remains visible', async () => {
    const game = useGameStore();
    const initialTiles = applyDeepMineSpec(
      Array.from({ length: 25 }, () => ({ type: 'standard', health: 0, maxHealth: 0 })),
      {
        fossils: [
          { id: 'shell', cells: [0, 1, 5, 6] },
          { id: 'fern', cells: [3, 4, 8, 9] },
        ],
        roots: [{ id: 'a', knot: 17, bindings: [12, 16, 18, 22] }],
      },
    );
    initialTiles[24].health = initialTiles[24].maxHealth = 1;
    game.tiles = initialTiles.map((tile) => ({ ...tile }));
    for (const index of [0, 1, 5, 6]) game.tiles[index].health = 0;
    game.tiles[17].health = 0;
    game.tiles[17].type = 'standard';
    for (const index of [12, 16, 18, 22]) game.tiles[index].chainHealth = 0;
    const html = await renderToString(
      createSSRApp({ render: () => h(MineGoals, { initialTiles }) }).use(pinia),
    );
    expect(html).toContain('Fossils: 1 / 2');
    expect(html).toContain('Root knots: 1 / 1');
    expect(html).toContain('Ice: 0 / 1');
    expect(html).not.toContain('Stone:');
    expect(html).not.toContain('Chained gem:');
    expect(html).not.toContain('NaN');
  });

  it('uses the same mushroom, brazier and pearl pictures for counters and guide entries', async () => {
    const game = useGameStore();
    const initialTiles = [
      { signal: 'lantern', signalHealth: 1 },
      { signal: 'core', signalHealth: 4 },
      { exit: true },
    ];
    Object.assign(game, {
      availableLevels: [{ id: 391, config: { theme: 'underground-reservoir' } }],
      currentLevelId: 391,
      tiles: initialTiles,
      board: [{ type: 'relic' }],
      totalRelics: 1,
    });
    const html = await renderToString(
      createSSRApp({ render: () => h(MineGoals, { initialTiles }) }).use(pinia),
    );
    expect(html).toContain('Glowshrooms: 0 / 1');
    expect(html).toContain('Brazier charges: 0 / 4');
    expect(html).toContain('Pearls to deliver: 0 / 1');
    for (const { art } of obstaclesInLevel(initialTiles, 'underground-reservoir'))
      expect(html).toContain(art);
    expect(html).not.toContain('Lanterns:');
    expect(html).not.toContain('Core charges:');
    expect(html).not.toContain('Relics to deliver:');
  });
});

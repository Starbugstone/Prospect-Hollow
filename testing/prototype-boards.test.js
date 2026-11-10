import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SettingsDrawer from '../src/components/SettingsDrawer.vue';
import { LEVEL_COUNT } from '../src/data/campaign';
import { mineRelicAppearance, mineSignalAppearance } from '../src/data/mineThemes';
import { PROTOTYPE_BOARDS, prototypeConfig, prototypeName } from '../src/data/prototypeBoards';
import { gravityPath, isPortalPad } from '../src/game/engine/BoardTopology';
import { cargoReachesExit } from '../src/game/engine/GravityFrames';
import { HintEngine } from '../src/game/engine/HintEngine';
import fr from '../src/i18n/fr.json';
import { PlayClock } from '../src/game/engine/PlayClock';
import { layerCount } from '../src/game/engine/TileRules';
import { refreshBoardVisuals } from '../src/stores/game/rendererBinding';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import {
  flipped,
  iceLayers,
  isExtraction,
  strandedCargo,
  turnedBeams,
  unreachableStarglass,
} from './helpers/boardRules';
import { simulateCampaignLevel } from './helpers/campaignSimulation';

// Every board on trial (src/data/prototypeBoards.js) follows the layout rules of the shipped
// hollow mine, plays to the end with unlimited moves and leaves the save untouched. Turn
// budgets below are diagnostics, never gameplay move limits.
const hints = new HintEngine();
const boards = PROTOTYPE_BOARDS.map((board) => [board.key, board, prototypeConfig(board.key)]);
const cellsWhere = (level, test) =>
  level.tiles.flatMap((tile, index) => (test(tile, index) ? [index] : []));

describe.each(boards)('the board on trial %s', (key, board, level) => {
  let saves;
  beforeEach(() => {
    saves = new Map();
    vi.stubGlobal('localStorage', {
      getItem: (name) => saves.get(name) ?? null,
      setItem: (name, value) => saves.set(name, value),
      removeItem: (name) => saves.delete(name),
    });
    setActivePinia(createPinia());
  });
  afterEach(() => {
    useGameStore().cancelHint();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('takes a level number past the campaign and follows the shipped layout rules', () => {
    expect(board.id).toBeGreaterThan(LEVEL_COUNT);
    expect(PROTOTYPE_BOARDS.filter((other) => other.id === board.id)).toHaveLength(1);
    if (isExtraction(level))
      expect(level.tiles.reduce((sum, tile) => sum + iceLayers(tile), 0)).toBe(0);
    expect(strandedCargo(level)).toEqual([]);
    expect(unreachableStarglass(level)).toEqual([]);
    for (const order of level.oreOrders ?? [])
      expect(level.boardLayout.gemTypes).toContain(order.color);
  });

  it('finishes beyond 100 moves after its speed target and saves nothing', async () => {
    let random = board.id * 7919;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      random = (random * 16807) % 2147483647;
      return (random - 1) / 2147483646;
    });
    const campaign = useCampaignStore();
    const before = JSON.stringify([campaign.profile(), [...saves]]);
    const game = useGameStore();
    let now = 0;
    game.playClock = markRaw(new PlayClock(() => now));
    game.bootstrap();
    expect(game.startLevel(key, 'prototype')).toBe(true);
    expect(game.currentLevelId).toBe(board.id);
    expect(game.currentLevel.config.tip).toBe(board.level.tip);
    game.moves = 100;
    game.syncRunClock(true);
    now = game.speedTargetMs + 60000;
    for (let turn = 0; turn < 400 && !game.levelCleared; turn++) {
      const move = hints.findBestMove(game.board, game.tiles, game.boardCols, game.boardRows, {
        oreOrders: game.oreOrders,
      });
      if (!move) {
        expect(await game.ensurePlayableBoard()).toBe(true);
        continue;
      }
      expect(
        await game.resolveSwap(move.swap.aIndex, move.swap.bIndex, {
          activateInPlace: !!move.activateInPlace,
        }),
      ).toBe(true);
    }
    expect(game.levelCleared).toBe(true);
    expect(game.moves).toBeGreaterThan(100);
    expect(game.elapsedMs).toBeGreaterThan(game.speedTargetMs);
    expect(game.tiles.every((tile) => layerCount(tile) === 0)).toBe(true);
    expect(game.board.some((gem) => gem?.type === 'relic')).toBe(false);
    expect(game.levelRewards).toEqual([]);
    // Inventory powers are refused on a prototype board.
    expect(await game._activatePower('tnt', 0, true)).toBe(false);
    game.exitLevel();
    expect(campaign.records[board.id]).toBeUndefined();
    expect(JSON.stringify([campaign.profile(), [...saves]])).toBe(before);
  }, 60000);

  // The board's number lies past the campaign, so its chapter cannot be looked up from it.
  it("hands the renderer its own chapter's art", () => {
    const game = useGameStore();
    expect(game.startLevel(key, 'prototype')).toBe(true);
    const animator = {
      setLayout: vi.fn(),
      updateTiles: vi.fn(),
      reset: vi.fn(),
      indexToGemId: [],
    };
    game.renderer = markRaw({
      animator,
      boardContainer: { setPosition: vi.fn() },
      scene: { scale: { width: 700, height: 900 } },
    });
    refreshBoardVisuals(game);
    expect(animator.levelTheme).toBe(level.theme);
    expect(animator.reset).toHaveBeenCalled();
    // Every signal on the board has a picture in that theme.
    for (const tile of level.tiles)
      if (tile.signal) expect(mineSignalAppearance(level.theme, tile.signal)).toBeTruthy();
    game.renderer = null;
    game.exitLevel();
  });
});

// A phone has no console for prospectDebug, so preview builds list the boards in Settings.
describe('the boards on trial in Settings', () => {
  let pinia;
  beforeEach(() => {
    vi.stubGlobal('localStorage', { getItem: () => null, setItem() {}, removeItem() {} });
    vi.stubGlobal('location', { origin: 'https://game.test', hostname: 'game.test' });
    pinia = createPinia();
    setActivePinia(pinia);
  });
  afterEach(() => {
    useGameStore().cancelHint();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const settings = () => renderToString(createSSRApp(SettingsDrawer, { open: true }).use(pinia));

  it('lists every board by name in a preview build', async () => {
    const html = await settings();
    expect(html).toContain('Boards on trial');
    for (const board of PROTOTYPE_BOARDS) expect(html).toContain(prototypeName(board.key));
    for (const message of ['Boards on trial', ...PROTOTYPE_BOARDS.map((b) => prototypeName(b.key))])
      expect(Object.hasOwn(fr, message), message).toBe(true);
  });

  it('stays out of the public game', async () => {
    vi.stubEnv('DEV', false);
    const html = await settings();
    expect(html).not.toContain('Boards on trial');
    for (const board of PROTOTYPE_BOARDS) {
      expect(html).not.toContain(prototypeName(board.key));
      expect(useGameStore().startLevel(board.key, 'prototype')).toBe(false);
      expect(useGameStore().startLevel(board.id)).toBe(false);
    }
  });

  it('is not offered while a puzzle is running, which starting a board would cut short', async () => {
    const game = useGameStore();
    game.bootstrap();
    expect(game.startLevel(1)).toBe(true);
    expect(await settings()).not.toContain('Boards on trial');
    game.exitLevel();
    expect(await settings()).toContain('Boards on trial');
  });
});

describe('Echo gallery: Crossed paths', () => {
  const level = prototypeConfig('echo-gallery-crossing');
  const { boardCols: cols, boardRows: rows } = level;
  const column = (index) => index % cols;
  const glass = cellsWhere(level, (tile) => tile.lensOnly);
  const exitPad = level.tiles.findIndex((tile) => tile.portal === 'out');
  const basket = level.tiles.findIndex((tile) => tile.exit);

  it('bars the moon gems’ way with starglass that only the mirrors can break', () => {
    expect(mineRelicAppearance(level.theme).id).toBe('moon-gem');
    expect(glass.length).toBe(2);
    // Both panes stand in the exit column, between the exit pad and the basket.
    for (const pane of glass) {
      expect(column(pane)).toBe(column(exitPad));
      expect(pane).toBeGreaterThan(exitPad);
      expect(pane).toBeLessThan(basket);
    }
    expect(column(basket)).toBe(column(exitPad));
    // Every moon gem's way to the basket runs through both panes.
    const cargo = level.board.flatMap((gem, index) => (gem?.type === 'relic' ? [index] : []));
    expect(cargo.length).toBe(2);
    for (const index of cargo) {
      const path = gravityPath(level.tiles, index, cols, rows);
      expect(path.at(-1)).toBe(basket);
      for (const pane of glass) expect(path).toContain(pane);
    }
  });

  it('delivers no moon gem while a pane of starglass stands', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let delivered = 0;
      const result = simulateCampaignLevel(level, seed, {
        observe(resolution, { tiles }) {
          delivered += resolution.relicsCollected ?? 0;
          if (delivered)
            expect(
              glass.every((pane) => tiles[pane].health === 0),
              `seed ${seed}`,
            ).toBe(true);
        },
      });
      expect(result.remaining, `seed ${seed}`).toBe(false);
      expect(delivered).toBe(2);
    }
  });

  it('keeps every beam clear of the portal pads', () => {
    const beams = turnedBeams(level);
    expect(beams.length).toBeGreaterThan(0);
    const cells = new Set(beams.flatMap((beam) => [beam.lens, ...beam.cells]));
    // A turned beam only lists the cells it hits, so walk its line as well.
    for (const { lens, cells: hit } of beams) {
      const last = hit.at(-1);
      if (last == null) continue;
      const step = (last - lens) / hit.length;
      if (Number.isInteger(step))
        for (let cell = lens; cell !== last; cell += step) cells.add(cell);
    }
    expect([...cells].filter((cell) => isPortalPad(level.tiles[cell]))).toEqual([]);
    // One burst of the relay reaches both panes: its column ends on both mirrors.
    const relay = level.tiles.findIndex((tile) => tile.signal === 'spore');
    expect(level.tiles[relay].sporeAxis).toBe('column');
    const fromRelay = beams
      .filter(({ line }) => line.axis === 'column' && line.index === column(relay))
      .flatMap((beam) => beam.cells);
    for (const pane of glass) expect(fromRelay).toContain(pane);
  });
});

describe('Turning orchard: Up and down', () => {
  const level = prototypeConfig('turning-orchard-both-ways');
  const { board, tiles, boardCols: cols, boardRows: rows } = level;
  const floats = board.flatMap((gem, index) => (gem?.float ? [index] : []));

  it('gives each floatstone one way out, in opposite gravity', () => {
    expect(floats.length).toBe(2);
    expect(tiles.filter((tile) => tile.gravitySwitch === 'dial')).toHaveLength(1);
    // Freed of their knots, one leaves as the cavern stands and the other only once it turns.
    const free = tiles.map((tile) => ({ ...tile, rootGroup: undefined, rootKnot: undefined }));
    const ways = floats.map((index) => [
      cargoReachesExit(board, free, index, cols, rows),
      cargoReachesExit(board, flipped(free), index, cols, rows),
    ]);
    expect(ways.toSorted()).toEqual([
      [false, true],
      [true, false],
    ]);
  });

  it('moors both floatstones to a root knot beside them, clear of their ways out', () => {
    for (const index of floats) {
      expect(tiles[index].rootGroup, `floatstone ${index}`).toBeDefined();
      const knot = tiles.findIndex(
        (tile) => tile.rootKnot && tile.rootGroup === tiles[index].rootGroup,
      );
      expect(Math.abs(knot - index)).toBe(1);
      expect(Math.floor(knot / cols)).toBe(Math.floor(index / cols));
    }
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, markRaw } from 'vue';
import { renderToString } from 'vue/server-renderer';
import SettingsDrawer from '../src/components/SettingsDrawer.vue';
import { LEVEL_COUNT } from '../src/data/campaign';
import { mineRelicAppearance, mineSignalAppearance } from '../src/data/mineThemes';
import { OBSTACLES } from '../src/data/obstacles';
import { PROTOTYPE_BOARDS, prototypeConfig, prototypeName } from '../src/data/prototypeBoards';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { gravityPath, isGravitySwitch, isPortalPad } from '../src/game/engine/BoardTopology';
import { releaseCutRoots } from '../src/game/engine/DeepMineMechanics';
import { cargoPath, cargoReachesExit } from '../src/game/engine/GravityFrames';
import { HintEngine } from '../src/game/engine/HintEngine';
import fr from '../src/i18n/fr.json';
import { PlayClock } from '../src/game/engine/PlayClock';
import { layerCount, neighborsOf } from '../src/game/engine/TileRules';
import { refreshBoardVisuals } from '../src/stores/game/rendererBinding';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';
import {
  flipped,
  iceLayers,
  isExtraction,
  opened,
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
    // Every signal on the board has a picture in that theme, or the shared one of its
    // obstacle (survey markers look the same in every cavern).
    const shared = (signal) => OBSTACLES.find((item) => item.id === signal)?.texture;
    for (const tile of level.tiles)
      if (tile.signal)
        expect(
          mineSignalAppearance(level.theme, tile.signal)?.texture ?? shared(tile.signal),
          tile.signal,
        ).toBeTruthy();
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

// Every cell a turned beam crosses, including the cells it passes over without hitting.
const beamCells = (level) => {
  const cells = new Set();
  for (const { lens, cells: hit } of turnedBeams(level)) {
    cells.add(lens);
    for (const cell of hit) cells.add(cell);
    const last = hit.at(-1);
    if (last == null) continue;
    const step = (last - lens) / hit.length;
    if (Number.isInteger(step)) for (let cell = lens; cell !== last; cell += step) cells.add(cell);
  }
  return cells;
};

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

describe('Shifting survey: Shifting stars', () => {
  const level = prototypeConfig('shifting-survey-stars');
  const { tiles, boardCols: cols, boardRows: rows } = level;
  const markers = cellsWhere(level, (tile) => tile.signal === 'survey');

  it('numbers a trail of eight markers from the bottom left corner, a phase seal beside each', () => {
    expect(markers.map((index) => tiles[index].surveyOrder).toSorted()).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(markers.find((index) => tiles[index].surveyOrder === 1)).toBe((rows - 1) * cols);
    for (const marker of markers)
      expect(
        neighborsOf(marker, cols, rows).some((cell) => tiles[cell].phaseSeal),
        `marker ${tiles[marker].surveyOrder}`,
      ).toBe(true);
  });

  it('lights some markers with matches that a phase shift lines up', () => {
    let lit = 0;
    let shifted = 0;
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const result = simulateCampaignLevel(level, seed, {
        observe(resolution, { tiles: now }) {
          let afterShift = false;
          for (const step of resolution.steps) {
            if (step.phaseShifts) afterShift = true;
            for (const update of step.tileUpdates ?? [])
              if (update.signalHealth === 0 && now[update.index].signal === 'survey') {
                lit++;
                if (afterShift) shifted++;
              }
          }
        },
      });
      expect(result.remaining, `seed ${seed}`).toBe(false);
    }
    expect(lit).toBe(6 * markers.length);
    expect(shifted).toBeGreaterThan(0);
  });
});

describe('Ember sidings: Banked fires', () => {
  const level = prototypeConfig('ember-sidings-gates');
  const { board, tiles, boardCols: cols, boardRows: rows } = level;
  const gates = cellsWhere(level, (tile) => tile.bonusOnly && tile.type === 'blocker');
  const cores = cellsWhere(level, (tile) => tile.signal === 'core');
  const basket = tiles.findIndex((tile) => tile.exit);

  it('bars the moon gems’ column with two thick gates that each brazier’s bomb reaches', () => {
    expect(mineRelicAppearance(level.theme).id).toBe('moon-gem');
    expect(gates.map((gate) => tiles[gate].health)).toEqual([2, 2]);
    const cargo = board.flatMap((gem, index) => (gem?.type === 'relic' ? [index] : []));
    expect(cargo).toHaveLength(2);
    for (const index of cargo) {
      const path = gravityPath(tiles, index, cols, rows);
      expect(path.at(-1)).toBe(basket);
      for (const gate of gates) expect(path).toContain(gate);
    }
    expect(cores).toHaveLength(2);
    // A full brazier releases its bomb on its own cell.
    for (const core of cores) {
      expect(tiles[core].coreBonus).toBe('bomb');
      const blast = new BonusActivator().activateBomb(board, cols, rows, core);
      for (const gate of gates) expect(blast).toContain(gate);
      expect(blast.filter((cell) => isPortalPad(tiles[cell]))).toEqual([]);
    }
  });

  it('delivers no moon gem while a gate stands', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      let delivered = 0;
      const result = simulateCampaignLevel(level, seed, {
        observe(resolution, { tiles: now }) {
          delivered += resolution.relicsCollected ?? 0;
          if (delivered)
            expect(
              gates.every((gate) => now[gate].health === 0),
              `seed ${seed}`,
            ).toBe(true);
        },
      });
      expect(result.remaining, `seed ${seed}`).toBe(false);
      expect(delivered).toBe(2);
    }
  });
});

describe('Buried routes: Shaft or gallery', () => {
  const level = prototypeConfig('buried-routes-bed');
  const { tiles, boardCols: cols, boardRows: rows } = level;
  const fossils = Object.groupBy(
    cellsWhere(level, (tile) => tile.fossilGroup != null),
    (index) => tiles[index].fossilGroup,
  );

  it('seals both dust fossils away from every swap until a route opens', () => {
    expect(Object.values(fossils)).toHaveLength(2);
    for (const cells of Object.values(fossils)) {
      // Brushed by matches, not encased.
      for (const cell of cells) expect(tiles[cell].type).toBe('standard');
      // A 2 × 2 fossil holds no line of three, and nothing else touches it.
      for (const cell of cells)
        for (const neighbor of neighborsOf(cell, cols, rows))
          expect(
            cells.includes(neighbor) ||
              tiles[neighbor].type === 'void' ||
              tiles[neighbor].sealed === true,
            `cell ${neighbor}`,
          ).toBe(true);
    }
  });

  it('opens on to both fossils by either route, and counts neither wall', () => {
    const walls = cellsWhere(level, (tile) => tile.waist);
    expect(walls.every((cell) => tiles[cell].routeWall)).toBe(true);
    for (const route of ['a', 'b']) {
      const chamber = cellsWhere(level, (tile) => tile.sealed && tile.chamber === route);
      for (const [group, cells] of Object.entries(fossils))
        expect(
          chamber.some((cell) => neighborsOf(cell, cols, rows).some((n) => cells.includes(n))),
          `route ${route} to ${group}`,
        ).toBe(true);
    }
    // The shaft's wall is one thick block, the gallery's four thin walls.
    expect(walls.filter((cell) => tiles[cell].waist === 'a').map((c) => tiles[c].health)).toEqual([
      2,
    ]);
    expect(walls.filter((cell) => tiles[cell].waist === 'b').map((c) => tiles[c].health)).toEqual([
      1, 1, 1, 1,
    ]);
  });
});

describe('Frost relays: Relay chain', () => {
  const level = prototypeConfig('frost-relays-chain');
  const { tiles, boardCols: cols, boardRows: rows } = level;
  const frozen = cellsWhere(level, (tile) => tile.state === 'FROZEN');
  const relays = cellsWhere(level, (tile) => tile.signal === 'spore');

  it('carries ice and no lanterns, since every frozen gem sits on ice', () => {
    expect(isExtraction(level)).toBe(false);
    expect(frozen.length).toBe(20);
    for (const cell of frozen) expect(iceLayers(tiles[cell])).toBe(1);
  });

  it('wakes both row relays from the column relay, and the chain thaws every frozen gem', () => {
    const column = relays.find((cell) => tiles[cell].sporeAxis === 'column');
    const rowRelays = relays.filter((cell) => tiles[cell].sporeAxis === 'row');
    expect(rowRelays).toHaveLength(2);
    for (const relay of rowRelays) expect(relay % cols).toBe(column % cols);
    // A burst clears the gems of its line; each cleared cell thaws its frozen neighbours.
    const line = (relay) =>
      Array.from({ length: tiles[relay].sporeAxis === 'column' ? rows : cols }, (_, step) =>
        tiles[relay].sporeAxis === 'column'
          ? step * cols + (relay % cols)
          : Math.floor(relay / cols) * cols + step,
      );
    const cleared = new Set(relays.flatMap(line).filter((cell) => tiles[cell].state !== 'FROZEN'));
    for (const cell of frozen)
      expect(
        neighborsOf(cell, cols, rows).some((n) => cleared.has(n)),
        `frozen ${cell}`,
      ).toBe(true);
  });
});

describe('Tidal pearls: Ebb and flow', () => {
  const level = prototypeConfig('tidal-pearls-pairs');
  const { board, tiles, boardCols: cols, boardRows: rows } = level;
  const pearls = board.flatMap((gem, index) => (gem?.type === 'relic' ? [index] : []));

  it('parts each pair at the seam: the upper pearl rises, the lower one sinks', () => {
    expect(mineRelicAppearance(level.theme).id).toBe('pearl');
    expect(level.oreOrders).toHaveLength(1);
    expect(pearls).toHaveLength(4);
    for (const index of pearls) {
      const up = tiles[index].fall === 'up';
      const path = cargoPath(board, tiles, index, cols, rows);
      expect(Math.floor(path.at(-1) / cols), `pearl ${index}`).toBe(up ? 0 : rows - 1);
      expect(tiles[path.at(-1)].exit).toBe(true);
      // Its partner sits across the seam in the same column.
      const partner = up ? index + cols : index - cols;
      expect(pearls).toContain(partner);
      expect(tiles[partner].fall === 'up').toBe(!up);
    }
  });
});

describe('Rooted vault: Bound shut', () => {
  const level = prototypeConfig('rooted-vault-knots');
  const { tiles, boardCols: cols } = level;
  const walls = cellsWhere(level, (tile) => tile.waist);
  const wallRow = Math.floor(walls[0] / cols);
  const above = Array.from({ length: cols }, (_, col) => (wallRow - 1) * cols + col);

  it('binds every gem of the row above the cracked wall with roots', () => {
    expect(walls).toHaveLength(3);
    for (const cell of above)
      expect(tiles[cell].rootKnot || tiles[cell].chainHealth > 0, `cell ${cell}`).toBe(true);
    // The chamber behind the wall holds the chained gems.
    const chained = cellsWhere(level, (tile) => tile.sealed && tile.chainHealth > 0);
    expect(chained.length).toBe(3);
  });

  it('frees the whole row once its three knots are cut', () => {
    const cut = tiles.map((tile) => ({ ...tile }));
    const step = { tileUpdates: [] };
    for (const [index, tile] of cut.entries())
      if (tile.rootKnot) {
        tile.health = 0;
        step.tileUpdates.push({ index, health: 0 });
      }
    expect(step.tileUpdates).toHaveLength(3);
    releaseCutRoots(cut, step);
    for (const cell of above) expect(cut[cell].chainHealth ?? 0, `cell ${cell}`).toBe(0);
  });
});

describe('The far seam: Either way out', () => {
  const level = prototypeConfig('far-seam-either-way');
  const { board, tiles, boardCols: cols, boardRows: rows } = level;
  const float = board.findIndex((gem) => gem?.float);
  const dial = tiles.findIndex((tile) => tile.gravitySwitch === 'dial');
  const walls = cellsWhere(level, (tile) => tile.waist);

  it('gives the floatstone one way out in each gravity, through its own shaft', () => {
    expect(float).toBeGreaterThanOrEqual(0);
    expect(dial).toBeGreaterThanOrEqual(0);
    const open = opened(tiles).map((tile) =>
      tile.waist ? { ...tile, type: 'standard', health: 0 } : tile,
    );
    expect(cargoReachesExit(board, open, float, cols, rows)).toBe(true);
    expect(cargoReachesExit(board, flipped(open), float, cols, rows)).toBe(true);
    // With the shafts shut, neither way is open.
    expect(cargoReachesExit(board, tiles, float, cols, rows)).toBe(false);
    expect(cargoReachesExit(board, flipped(tiles), float, cols, rows)).toBe(false);
  });

  it('turns beams on to both walls and keeps them clear of the dial and the sealed shafts', () => {
    const beams = turnedBeams({ ...level, tiles });
    for (const wall of walls)
      expect(
        new Set(beams.filter((beam) => beam.cells.includes(wall)).map((beam) => beam.lens)).size,
        `wall ${wall}`,
      ).toBe(2);
    // Walk the beams on the board as it starts, with the shafts still sealed.
    const crossed = [...beamCells(level)];
    expect(crossed.filter((cell) => isGravitySwitch(tiles[cell]))).toEqual([]);
    expect(crossed.filter((cell) => tiles[cell].sealed)).toEqual([]);
    expect(crossed).not.toContain(float);
    // The floor brazier gives crosses on the row the bottom prisms end.
    const core = tiles.findIndex((tile) => tile.signal === 'core');
    expect(tiles[core].coreBonus).toBe('cross');
    const row = Math.floor(core / cols);
    expect(tiles[row * cols].lens).toBeTruthy();
    expect(tiles[row * cols + cols - 1].lens).toBeTruthy();
  });
});

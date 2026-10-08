import { createGem } from './GemFactory.js';
import { MatchEngine } from './MatchEngine.js';
import { LEVEL_COUNT, CHAPTERS, getLevelGemTypes } from '../../data/campaign.js';
import { EXPANSION_LEVELS } from '../../data/expansion.js';
import {
  EARLY_LEVEL_COUNT,
  getEarlyLevelSpec,
  stonePositions,
  iceRank,
} from '../../data/earlyLevels.js';
import { chapterIndexOf, chapterSlotOf } from '../../data/chapters.js';
import { layerCount } from './TileRules.js';
import { CORE_BONUSES, CORE_CHARGES } from './ChapterMechanics.js';
import { getLevelStarTarget } from '../../data/starRating.js';
import { applyDeepMineSpec } from './DeepMineMechanics.js';
import { isPlayableCell } from './BoardTopology.js';

const createSeededRng = (seed) => {
  let current = seed % 2147483647;
  if (current <= 0) current += 2147483646;
  return () => {
    current = (current * 16807) % 2147483647;
    return (current - 1) / 2147483646;
  };
};

class BoardLayout {
  constructor(name, shape, dimensions, gemTypes, blockedCells = [], initialTilePlacements = []) {
    this.name = name;
    this.shape = shape;
    this.dimensions = dimensions;
    this.blockedCells = blockedCells;
    this.initialTilePlacements = initialTilePlacements;
    this.gemTypes = gemTypes;
    this.gemTypeCount = gemTypes.length;
  }
}

const DEFAULT_MIN_STARTING_MOVES = 3;
// Each chapter's fifth puzzle is a lighter breather and its sixth the finale.
const levelPace = (id) =>
  ['explore', 'explore', 'explore', 'explore', 'rest', 'finale'][chapterSlotOf(id)];
const MAX_BOARD_GENERATION_ATTEMPTS = 60;
const matchEngine = new MatchEngine();

const isBlockedCell = (layout, x, y) =>
  layout.blockedCells.some((cell) => cell.x === x && cell.y === y);

const createBoard = (layout, rng) => {
  const board = Array.from({ length: layout.dimensions.cols * layout.dimensions.rows });
  for (let i = 0; i < board.length; i++) {
    const x = i % layout.dimensions.cols;
    const y = Math.floor(i / layout.dimensions.cols);
    if (isBlockedCell(layout, x, y)) {
      board[i] = null;
      continue;
    }
    const placement = layout.initialTilePlacements.find((cell) => cell.x === x && cell.y === y);
    if (placement) {
      board[i] = createGem(placement.type);
      if (placement.float) board[i].float = true;
      continue;
    }
    const forbidden = new Set();
    const cols = layout.dimensions.cols;
    if (x >= 2 && board[i - 1]?.type === board[i - 2]?.type) forbidden.add(board[i - 1]?.type);
    if (y >= 2 && board[i - cols]?.type === board[i - 2 * cols]?.type)
      forbidden.add(board[i - cols]?.type);
    const choices = layout.gemTypes.filter((type) => !forbidden.has(type));
    board[i] = createGem(choices[Math.floor(rng() * choices.length)]);
  }
  return board;
};

const hasMissingGems = (board, layout) => {
  for (let i = 0; i < board.length; i += 1) {
    if (board[i]) {
      continue;
    }
    const x = i % layout.dimensions.cols;
    const y = Math.floor(i / layout.dimensions.cols);
    if (!isBlockedCell(layout, x, y)) {
      return true;
    }
  }
  return false;
};

const countPotentialMoves = (board, cols, rows, minMoves = 1, tiles = []) => {
  if (!Array.isArray(board) || !cols || !rows) {
    return 0;
  }

  let moveCount = 0;

  for (let index = 0; index < board.length; index += 1) {
    const gem = board[index];
    if (!gem) {
      continue;
    }

    const col = index % cols;

    // Adjacent right swap
    const rightIndex = col < cols - 1 ? index + 1 : -1;
    if (rightIndex >= 0 && board[rightIndex]) {
      const evaluation = matchEngine.evaluateSwap(board, cols, rows, index, rightIndex, tiles);
      if (evaluation?.matches?.length) {
        moveCount += 1;
      }
    }

    // Adjacent down swap
    const belowIndex = index + cols;
    if (belowIndex < board.length && board[belowIndex]) {
      const evaluation = matchEngine.evaluateSwap(board, cols, rows, index, belowIndex, tiles);
      if (evaluation?.matches?.length) {
        moveCount += 1;
      }
    }

    if (moveCount >= minMoves) {
      break;
    }
  }

  return moveCount;
};

const createPlayableBoard = (layout, rng, { minMoves = 1, tiles = [] } = {}) => {
  let lastBoard = null;
  for (let attempt = 0; attempt < MAX_BOARD_GENERATION_ATTEMPTS; attempt += 1) {
    const board = createBoard(layout, rng);
    lastBoard = board;

    if (hasMissingGems(board, layout)) {
      continue;
    }

    const moves = countPotentialMoves(
      board,
      layout.dimensions.cols,
      layout.dimensions.rows,
      minMoves,
      tiles,
    );
    if (moves >= minMoves) {
      return board;
    }
  }

  console.warn('LevelGenerator: falling back to last board after exhausting attempts', {
    layout: layout.name,
    minMoves,
    attempts: MAX_BOARD_GENERATION_ATTEMPTS,
  });

  return lastBoard ?? createBoard(layout, rng);
};

// A seeded shuffle breaks ties inside each authored shape, then ice fills the
// ranked seam. Open exit rows cap the stack at two layers per cell.
function layIce(tiles, iceCells, rng, rank, cellCount, spec) {
  for (let i = iceCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [iceCells[i], iceCells[j]] = [iceCells[j], iceCells[i]];
  }
  iceCells.sort((a, b) => rank(a) - rank(b));
  const maxLayers = spec.maxIceLayers ?? (spec.openExitRows ? 2 : null);
  const layers = maxLayers ? Math.min(spec.ice, cellCount * maxLayers) : spec.ice;
  for (let layer = 0; layer < layers; layer++) {
    const tile = tiles[iceCells[layer % cellCount]];
    tile.health++;
    tile.maxHealth++;
  }
}
const clearObjective = (id, label, target) => ({
  id: `clear-${id}`,
  type: 'clear-layers',
  label,
  target,
  progress: 0,
});
const scoreObjective = (id, target) => ({
  id: `score-${id}`,
  type: 'score',
  label: 'Earn a chest',
  target,
  progress: 0,
});
// Field order is part of the saved and hashed level contract.
const assembleLevelConfig = ({
  id,
  chapter,
  tip,
  oreOrders,
  chestTarget,
  speedTargetMs,
  ...board
}) => ({
  id,
  chapter,
  chapterName: CHAPTERS[chapter].name,
  theme: CHAPTERS[chapter].theme,
  pace: levelPace(id),
  tip,
  ...(oreOrders ? { oreOrders } : {}),
  chestTarget,
  starScoreTarget: getLevelStarTarget(id, chestTarget),
  speedTargetMs,
  boardCols: board.cols,
  boardRows: board.rows,
  boardSize: board.cols,
  board: board.board,
  tiles: board.tiles,
  boardLayout: board.layout,
  objectives: board.objectives,
  summary: board.summary,
});

const createExpansionLevel = (id) => {
  const spec = EXPANSION_LEVELS[id - EARLY_LEVEL_COUNT - 1];
  const chapter = chapterIndexOf(id);
  const { cols, rows } = CHAPTERS[chapter];
  const rng = createSeededRng(id * 1337);
  const layout = new BoardLayout(`level_${id}`, 'RECTANGLE', { cols, rows }, getLevelGemTypes(id));
  const seals = { r: 'ruby', b: 'sapphire', g: 'emerald' };
  const tiles = [...spec.map.replaceAll('/', '')].map((symbol, index) => {
    const tile = { type: 'standard', health: 0, maxHealth: 0 };
    const cell = { x: index % cols, y: Math.floor(index / cols) };
    if (symbol === '_') {
      tile.type = 'void';
      layout.blockedCells.push(cell);
    } else if (symbol === '-' || symbol === '=') {
      // A sealed chamber cell: unplayable until its cracked wall breaks.
      Object.assign(tile, { sealed: true, chamber: symbol === '-' ? 'a' : 'b' });
      layout.blockedCells.push(cell);
    } else if (['#', 'X', 'B', 'D', '*', '+', 'W', 'Y', 'w'].includes(symbol)) {
      tile.type = 'blocker';
      tile.health = tile.maxHealth = ['X', 'D', '+', 'Y'].includes(symbol) ? 2 : 1;
      if (!['#', 'X'].includes(symbol)) tile.bonusOnly = true;
      // The cracked wall (W/Y) of chamber a, or (w) of chamber b.
      if (['W', 'Y', 'w'].includes(symbol)) tile.waist = symbol === 'w' ? 'b' : 'a';
      // Starglass only breaks under a beam turned by a lens.
      if (symbol === '*' || symbol === '+') tile.lensOnly = true;
      layout.blockedCells.push(cell);
    } else if (symbol === 'c') {
      tile.chainHealth = tile.maxChainHealth = 1;
    } else if (seals[symbol]) {
      tile.type = 'seal';
      tile.sealColor = seals[symbol];
      tile.health = tile.maxHealth = 1;
    } else if (symbol === 'R') {
      layout.initialTilePlacements.push({ ...cell, type: 'relic' });
    } else if (symbol === 'E') {
      tile.exit = true;
    } else if (symbol === 'q' || symbol === 'Q') {
      // A gravity switch: a moon lock flips gravity once, a moon dial on every blast.
      tile.gravitySwitch = symbol === 'q' ? 'lock' : 'dial';
    } else if (symbol === 'f') {
      // A frozen gem on ice: a neighbouring clear thaws it.
      tile.state = 'FROZEN';
      tile.health = tile.maxHealth = 1;
    } else if (symbol === 'z' || symbol === 'Z') {
      // Phase seal: changes its gem after every move; z takes one match, Z two.
      tile.phaseSeal = true;
      tile.health = tile.maxHealth = symbol === 'Z' ? 2 : 1;
    }
    return tile;
  });
  // Relics held by a chain from the start (the chain itself comes from the map).
  for (const index of spec.relics ?? [])
    layout.initialTilePlacements.push({
      x: index % cols,
      y: Math.floor(index / cols),
      type: 'relic',
    });
  // Sealed chambers: every cell in the listed rows (and columns) waits behind its wall.
  for (const {
    id = 'a',
    rows: [first, last],
    cols: [left, right] = [0, cols - 1],
  } of spec.chambers ?? [])
    for (let index = first * cols; index < (last + 1) * cols; index++) {
      const tile = tiles[index];
      if (index % cols < left || index % cols > right) continue;
      if (!tile || tile.type === 'void' || tile.waist === id) continue;
      Object.assign(tile, { sealed: true, chamber: id });
      layout.blockedCells.push({ x: index % cols, y: Math.floor(index / cols) });
    }
  // Portals hand gems falling out of the entrance to the paired exit cell.
  for (const [pair, { from, to }] of (spec.portals ?? []).entries()) {
    Object.assign(tiles[from], { portalTo: to, portalPair: pair });
    tiles[to].portalExit = pair;
  }
  // Lens mirrors are fixtures on edge voids; `out` is the way a turned beam leaves.
  for (const { index, out } of spec.lenses ?? []) if (tiles[index]) tiles[index].lens = out;
  // Floatstones are relics that rise; a chain or root vine may hold one in place.
  for (const index of spec.floats ?? []) {
    layout.initialTilePlacements.push({
      x: index % cols,
      y: Math.floor(index / cols),
      type: 'relic',
      float: true,
    });
    tiles[index].floatStart = true;
  }
  for (const [order, index] of (spec.signals ?? []).entries()) {
    tiles[index].signalHealth = 1;
    tiles[index].signal = spec.survey ? 'survey' : 'lantern';
    // A trail may number its markers out of reading order (`surveyOrder`).
    if (spec.survey) tiles[index].surveyOrder = spec.surveyOrder?.[order] ?? order + 1;
  }
  // Charge cores cycle through their authored rewards (cross, then bomb, by default).
  for (const [order, index] of (spec.cores ?? []).entries())
    Object.assign(tiles[index], {
      signal: 'core',
      signalHealth: spec.coreCharges ?? CORE_CHARGES,
      coreCharges: spec.coreCharges ?? CORE_CHARGES,
      coreBonus: (spec.coreBonuses ?? CORE_BONUSES)[
        order % (spec.coreBonuses ?? CORE_BONUSES).length
      ],
    });
  // Root knots are solid targets; their cardinal vines pin ordinary gems.
  // Reserve their cells before allocating ice so no authored layers are lost.
  for (const root of spec.roots ?? []) {
    if (!Number.isInteger(root.knot) || !tiles[root.knot]) continue;
    tiles[root.knot].type = 'blocker';
    layout.blockedCells.push({ x: root.knot % cols, y: Math.floor(root.knot / cols) });
  }
  const fossilCells = new Set((spec.fossils ?? []).flatMap((fossil) => fossil.cells ?? []));
  for (const fossil of spec.fossils ?? []) {
    if (!fossil.encased) continue;
    for (const index of fossil.cells ?? [])
      if (tiles[index] && isPlayableCell(tiles[index]))
        layout.blockedCells.push({ x: index % cols, y: Math.floor(index / cols) });
  }
  const sporeCells = new Set((spec.spores ?? []).map((spore) => spore.index));
  if (spec.orders?.length) tiles[0].oreOrderGuide = true;
  const iceCells = tiles.flatMap((tile, index) =>
    tile.type === 'standard' &&
    !tile.health &&
    !tile.phaseSeal &&
    !fossilCells.has(index) &&
    !sporeCells.has(index) &&
    (!spec.openExitRows || index < cols * (rows - spec.openExitRows)) &&
    ![0, cols - 1, cols * (rows - 1), cols * rows - 1].includes(index) &&
    !tile.exit &&
    !layout.initialTilePlacements.some((cell) => cell.y * cols + cell.x === index)
      ? [index]
      : [],
  );
  const motif =
    spec.motif ?? ['pocket', 'steps', 'twins', 'ribbon', 'pool', 'arch'][chapterSlotOf(id)];
  // Add depth to the seam before pushing targets into hard-to-reach corners.
  const iceCellCount = Math.min(iceCells.length, Math.ceil(spec.ice * 0.75));
  layIce(tiles, iceCells, rng, (cell) => iceRank(cell, cols, rows, motif), iceCellCount, spec);
  applyDeepMineSpec(tiles, spec);
  if (spec.gravity === 'funnel') {
    for (let row = 0; row < rows - 1; row++) {
      const nextCols = Array.from({ length: cols }, (_, col) => col).filter((col) =>
        isPlayableCell(tiles[(row + 1) * cols + col]),
      );
      if (!nextCols.length) continue;
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        if (!isPlayableCell(tiles[index])) continue;
        const destinationCol = Math.max(nextCols[0], Math.min(col, nextCols.at(-1)));
        if (Math.abs(destinationCol - col) <= 1 && nextCols.includes(destinationCol))
          tiles[index].flowTo = (row + 1) * cols + destinationCol;
      }
    }
  }
  // Low gravity: the whole cavern falls up, or the rows above the seam do.
  if (spec.gravity === 'up' || spec.gravity === 'split')
    for (const [index, tile] of tiles.entries())
      if (
        isPlayableCell(tile) &&
        (spec.gravity === 'up' || Math.floor(index / cols) < (spec.seam ?? Math.floor(rows / 2)))
      )
        tile.fall = 'up';
  const totalLayers = tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
  const relicCount = layout.initialTilePlacements.length;
  const floatCount = layout.initialTilePlacements.filter((cell) => cell.float).length;
  // Top-row exits receive rising cargo: floatstones, or relics in low gravity.
  if (floatCount || tiles.some((tile) => tile.fall === 'up'))
    for (const tile of tiles.slice(0, cols)) if (tile.exit) tile.hatch = true;
  // Sky hatches that only ever receive floatstones are not relic baskets.
  if (floatCount && floatCount === relicCount)
    for (const tile of tiles) if (tile.exit) tile.floatExit = true;
  const board = createPlayableBoard(layout, rng, { minMoves: DEFAULT_MIN_STARTING_MOVES, tiles });
  // Each phase seal shows the colour its gem will become after the first move.
  for (const [index, tile] of tiles.entries())
    if (tile.phaseSeal) {
      const choices = layout.gemTypes.filter((type) => type !== board[index]?.type);
      tile.phaseNext = choices[Math.floor(rng() * choices.length)];
    }
  // Reward targets follow each puzzle's workload, including the chapter breathers.
  const chestTarget =
    spec.chestTarget ?? Math.ceil((totalLayers * 380 + relicCount * 1500) / 500) * 500;
  const layerLabel = spec.goalLabel
    ? spec.goalLabel
    : spec.fossils?.length
      ? 'Tiles and buried fossils'
      : spec.roots?.length
        ? 'Tiles and linked roots'
        : spec.spores?.length
          ? 'Tiles and spore relays'
          : spec.cores?.length
            ? 'Tiles and charge cores'
            : spec.signals?.length
              ? 'Tiles and light markers'
              : tiles.some((tile) => tile.sealColor)
                ? 'Ice, stone & seals'
                : tiles.some((tile) => tile.chainHealth)
                  ? 'Ice, stone & chains'
                  : 'Ice & stone';
  return assembleLevelConfig({
    id,
    chapter,
    tip: spec.tip,
    oreOrders: (spec.orders ?? []).map(([color, target]) => ({ color, target, progress: 0 })),
    chestTarget,
    speedTargetMs: spec.speedTargetMs ?? (75 + totalLayers + relicCount * 20) * 1000,
    cols,
    rows,
    board,
    tiles,
    layout,
    objectives: [
      clearObjective(id, layerLabel, totalLayers),
      ...(relicCount
        ? [
            {
              id: `relics-${id}`,
              type: 'collect-relics',
              label:
                floatCount === relicCount
                  ? 'Raise floatstones'
                  : floatCount
                    ? 'Deliver relics and floatstones'
                    : 'Collect relics',
              target: relicCount,
              progress: 0,
            },
          ]
        : []),
      scoreObjective(id, chestTarget),
    ],
    summary: `Clear ${totalLayers} obstacle layers${relicCount ? ` and collect ${relicCount} relics` : ''}. Earn a chest at ${chestTarget.toLocaleString()} points.`,
  });
};

// Chapter boundaries own size and palette count; individual puzzles vary
// workload and geometry without adding more colors mid-chapter.
const createEarlyLevel = (id) => {
  const chapter = chapterIndexOf(id);
  const { cols, rows } = CHAPTERS[chapter];
  const spec = getEarlyLevelSpec(id);
  const rng = createSeededRng(spec.seed);
  const layout = new BoardLayout(`level_${id}`, 'RECTANGLE', { cols, rows }, getLevelGemTypes(id));
  const tiles = Array.from({ length: cols * rows }, () => ({
    type: 'standard',
    health: 0,
    maxHealth: 0,
  }));
  layout.blockedCells = stonePositions(cols, rows, spec.motif).slice(0, spec.stoneCount);
  layout.blockedCells.forEach(({ x, y }, i) => {
    const health = i < spec.reinforcedCount ? 2 : 1;
    tiles[y * cols + x] = { type: 'blocker', health, maxHealth: health };
  });
  const iceCells = tiles.flatMap((tile, i) =>
    tile.type === 'standard' && (!spec.openExitRows || i < cols * (rows - spec.openExitRows))
      ? [i]
      : [],
  );
  const iceCellCount = Math.min(iceCells.length, spec.ice - spec.doubleIce);
  layIce(tiles, iceCells, rng, (cell) => iceRank(cell, cols, rows, spec.motif), iceCellCount, spec);
  for (const cell of iceCells.slice(0, spec.frozenCount)) tiles[cell].state = 'FROZEN';
  const board = createPlayableBoard(layout, rng, { minMoves: chapter < 2 ? 6 : 4, tiles });
  const totalLayers = tiles.reduce((sum, tile) => sum + tile.health, 0);
  const chestTarget = Math.ceil((totalLayers * 220) / 500) * 500;
  return assembleLevelConfig({
    id,
    chapter,
    tip: spec.tip,
    chestTarget,
    speedTargetMs: (90 + totalLayers * 2) * 1000,
    cols,
    rows,
    board,
    tiles,
    layout,
    objectives: [
      clearObjective(id, 'Clear ice & stone', totalLayers),
      scoreObjective(id, chestTarget),
    ],
    summary: `Clear ${spec.ice} ice layers${layout.blockedCells.length ? ` and ${layout.blockedCells.length} stone blocks` : ''}. Earn a chest at ${chestTarget.toLocaleString()} points.`,
  });
};

// Every level is seeded on its own, so generating one alone matches its entry in the
// full list. Only gem ids differ, and they only need to be unique within a session.
const createLevel = (id) =>
  id > EARLY_LEVEL_COUNT ? createExpansionLevel(id) : createEarlyLevel(id);
const generated = new Map();

/** The configuration of one level, generated on first use; null for unknown ids. */
export function levelConfig(id) {
  if (!Number.isInteger(id) || id < 1 || id > LEVEL_COUNT) return null;
  if (!generated.has(id)) generated.set(id, createLevel(id));
  return generated.get(id);
}

/** Fresh configurations for levels 1..count, for tests and authoring scripts. */
export const generateLevelConfigs = (count = LEVEL_COUNT) =>
  Array.from({ length: Math.max(0, Math.min(count, LEVEL_COUNT)) }, (_, index) =>
    createLevel(index + 1),
  );

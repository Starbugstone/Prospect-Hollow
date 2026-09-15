import { createGem } from './GemFactory.js';
import { MatchEngine } from './MatchEngine.js';
import { LEVEL_COUNT, CHAPTERS, getLevelGemTypes } from '../../data/campaign.js';
import { EXPANSION_LEVELS } from '../../data/expansion.js';
import { getEarlyLevelSpec, stonePositions, iceRank } from '../../data/earlyLevels.js';
import { layerCount } from './TileRules.js';

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

const createExpansionLevel = (id) => {
  const spec = EXPANSION_LEVELS[id - 37];
  const chapter = Math.floor((id - 1) / 6);
  const { cols, rows } = CHAPTERS[chapter];
  const rng = createSeededRng(id * 1337);
  const layout = new BoardLayout(`level_${id}`, 'RECTANGLE', { cols, rows }, getLevelGemTypes(id));
  const seals = { r: 'ruby', b: 'sapphire', g: 'emerald' };
  const tiles = [...spec.map.replaceAll('/', '')].map((symbol, index) => {
    const tile = { type: 'standard', health: 0, maxHealth: 0 };
    const cell = { x: index % cols, y: Math.floor(index / cols) };
    if (symbol === '#' || symbol === 'X') {
      tile.type = 'blocker';
      tile.health = tile.maxHealth = symbol === 'X' ? 2 : 1;
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
    }
    return tile;
  });
  for (const [order, index] of (spec.signals ?? []).entries()) {
    tiles[index].signalHealth = 1;
    tiles[index].signal = spec.survey ? 'survey' : 'lantern';
    if (spec.survey) tiles[index].surveyOrder = order + 1;
  }
  if (spec.orders?.length) tiles[0].oreOrderGuide = true;
  const iceCells = tiles.flatMap((tile, index) =>
    tile.type === 'standard' &&
    (!spec.openExitRows || index < cols * (rows - spec.openExitRows)) &&
    ![0, cols - 1, cols * (rows - 1), cols * rows - 1].includes(index) &&
    !tile.exit &&
    !layout.initialTilePlacements.some((cell) => cell.y * cols + cell.x === index)
      ? [index]
      : [],
  );
  for (let i = iceCells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [iceCells[i], iceCells[j]] = [iceCells[j], iceCells[i]];
  }
  const motif = spec.motif ?? ['pocket', 'steps', 'twins', 'ribbon', 'pool', 'arch'][(id - 1) % 6];
  iceCells.sort((a, b) => iceRank(a, cols, rows, motif) - iceRank(b, cols, rows, motif));
  // Add depth to the seam before pushing targets into hard-to-reach corners.
  const iceCellCount = Math.min(iceCells.length, Math.ceil(spec.ice * 0.75));
  const iceLayers = spec.openExitRows ? Math.min(spec.ice, iceCellCount * 2) : spec.ice;
  for (let layer = 0; layer < iceLayers; layer++) {
    const tile = tiles[iceCells[layer % iceCellCount]];
    tile.health++;
    tile.maxHealth++;
  }
  const totalLayers = tiles.reduce((sum, tile) => sum + layerCount(tile), 0);
  const relicCount = layout.initialTilePlacements.length;
  const board = createPlayableBoard(layout, rng, { minMoves: DEFAULT_MIN_STARTING_MOVES, tiles });
  // Reward targets follow each puzzle's workload, including the chapter breathers.
  const chestTarget = Math.ceil((totalLayers * 380 + relicCount * 1500) / 500) * 500;
  const layerLabel = spec.signals?.length
    ? 'Tiles and light markers'
    : tiles.some((tile) => tile.sealColor)
      ? 'Ice, stone & seals'
      : tiles.some((tile) => tile.chainHealth)
        ? 'Ice, stone & chains'
        : 'Ice & stone';
  return {
    id,
    chapter,
    chapterName: CHAPTERS[chapter].name,
    theme: CHAPTERS[chapter].theme,
    pace: (id - 1) % 6 === 4 ? 'rest' : (id - 1) % 6 === 5 ? 'finale' : 'explore',
    tip: spec.tip,
    oreOrders: (spec.orders ?? []).map(([color, target]) => ({ color, target, progress: 0 })),
    chestTarget,
    speedTargetMs: (75 + totalLayers + relicCount * 20) * 1000,
    boardCols: cols,
    boardRows: rows,
    boardSize: cols,
    board,
    tiles,
    boardLayout: layout,
    objectives: [
      {
        id: `clear-${id}`,
        type: 'clear-layers',
        label: layerLabel,
        target: totalLayers,
        progress: 0,
      },
      ...(relicCount
        ? [
            {
              id: `relics-${id}`,
              type: 'collect-relics',
              label: 'Collect relics',
              target: relicCount,
              progress: 0,
            },
          ]
        : []),
      { id: `score-${id}`, type: 'score', label: 'Earn a chest', target: chestTarget, progress: 0 },
    ],
    summary: `Clear ${totalLayers} obstacle layers${relicCount ? ` and collect ${relicCount} relics` : ''}. Earn a chest at ${chestTarget.toLocaleString()} points.`,
  };
};

// Chapter boundaries own size and palette count; individual puzzles vary
// workload and geometry without adding more colors mid-chapter.
export const generateLevelConfigs = (count = LEVEL_COUNT) => {
  const levels = [];
  for (let index = 0; index < count; index++) {
    const id = index + 1;
    if (id > 36) {
      if (id > LEVEL_COUNT) break;
      levels.push(createExpansionLevel(id));
      continue;
    }
    const chapter = Math.floor(index / 6);
    const { cols, rows } = CHAPTERS[chapter];
    const spec = getEarlyLevelSpec(id);
    const rng = createSeededRng(spec.seed);
    const layout = new BoardLayout(
      `level_${id}`,
      'RECTANGLE',
      { cols, rows },
      getLevelGemTypes(id),
    );
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
    const iceCells = tiles.flatMap((tile, i) => (tile.type === 'standard' ? [i] : []));
    // Seed breaks ties within each authored shape, preserving deterministic replays.
    for (let i = iceCells.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [iceCells[i], iceCells[j]] = [iceCells[j], iceCells[i]];
    }
    iceCells.sort(
      (a, b) => iceRank(a, cols, rows, spec.motif) - iceRank(b, cols, rows, spec.motif),
    );
    const iceCellCount = Math.min(iceCells.length, spec.ice - spec.doubleIce);
    const iceLayers = spec.openExitRows ? Math.min(spec.ice, iceCellCount * 2) : spec.ice;
    for (let layer = 0; layer < iceLayers; layer++) {
      const tile = tiles[iceCells[layer % iceCellCount]];
      tile.health++;
      tile.maxHealth++;
    }
    for (const cell of iceCells.slice(0, spec.frozenCount)) tiles[cell].state = 'FROZEN';
    const board = createPlayableBoard(layout, rng, { minMoves: chapter < 2 ? 6 : 4, tiles });
    const totalLayers = tiles.reduce((sum, tile) => sum + tile.health, 0);
    const chestTarget = Math.ceil((totalLayers * 220) / 500) * 500;
    const tip = spec.tip;
    levels.push({
      id,
      chapter,
      chapterName: CHAPTERS[chapter].name,
      theme: CHAPTERS[chapter].theme,
      pace: (id - 1) % 6 === 4 ? 'rest' : (id - 1) % 6 === 5 ? 'finale' : 'explore',
      tip,
      chestTarget,
      speedTargetMs: (90 + totalLayers * 2) * 1000,
      boardCols: cols,
      boardRows: rows,
      boardSize: cols,
      board,
      tiles,
      boardLayout: layout,
      objectives: [
        {
          id: `clear-${id}`,
          type: 'clear-layers',
          label: 'Clear ice & stone',
          target: totalLayers,
          progress: 0,
        },
        {
          id: `score-${id}`,
          type: 'score',
          label: 'Earn a chest',
          target: chestTarget,
          progress: 0,
        },
      ],
      summary: `Clear ${spec.ice} ice layers${layout.blockedCells.length ? ` and ${layout.blockedCells.length} stone blocks` : ''}. Earn a chest at ${chestTarget.toLocaleString()} points.`,
    });
  }
  return levels;
};

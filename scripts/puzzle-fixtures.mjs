// Generate independently computed JavaScript engine oracles for the PHP port.
import fs from 'node:fs';
import { MatchEngine } from '../src/game/engine/MatchEngine.js';
import { advanceOreOrders } from '../src/game/engine/ChapterMechanics.js';
import { layerCount } from '../src/game/engine/TileRules.js';
import { TileManager } from '../src/game/engine/TileManager.js';
const engine = new MatchEngine();
const content = JSON.parse(
  fs.readFileSync(new URL('../backend/content/game.json', import.meta.url)),
);
const seedRandom = () => {
  let seed = 793;
  Math.random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};
const typeBoard = (board) => board.map((g) => g?.type ?? null);
const normalizeMatch = ({ type, indices, orientation }) => ({
  type,
  indices,
  ...(orientation ? { orientation } : {}),
});
const fixtures = [];
const fixture = (name, level, a, b, activate = false, resolve = false) => {
  const { boardCols: cols, boardRows: rows } = level;
  const board = structuredClone(level.board),
    tiles = structuredClone(level.tiles);
  seedRandom();
  const value = activate
    ? engine.evaluateActivation(board, cols, rows, a, tiles)
    : engine.evaluateSwap(board, cols, rows, a, b, tiles);
  const expected = {
    board: typeBoard(value.board),
    matches: value.matches.map(normalizeMatch),
    bonuses: value.bonusIndices.map((index, i) => ({ index, type: value.bonusesCreated[i] })),
  };
  let resolution = null;
  if (resolve && value.matches.length) {
    const result = new TileManager().getResolution({
      ...value,
      tiles,
      gemTypes: level.boardLayout.gemTypes,
    });
    const oreOrders = (level.oreOrders ?? []).map((order) => ({ ...order, progress: 0 }));
    advanceOreOrders(oreOrders, result.steps);
    resolution = {
      oreOrders,
      remainingLayers: tiles.reduce((sum, tile) => sum + layerCount(tile), 0),
      board: typeBoard(result.board),
      tiles,
      score: result.steps.reduce((sum, s) => sum + s.cleared.length * 100 * (s.index + 1), 0),
      jewels: result.steps.reduce((sum, s) => sum + (s.collectedJewels?.length ?? 0), 0),
      remainingRelics:
        level.board.filter((g) => g?.type === 'relic').length - (result.relicsCollected ?? 0),
      clears: result.steps.map((s) => s.cleared),
    };
  }
  fixtures.push({ name, level: structuredClone(level), a, b, activate, expected, resolution });
};
for (const level of content.levels) {
  let found = 0;
  for (let a = 0; a < level.board.length && found < 2; a++) {
    for (const b of [a + 1, a + level.boardCols]) {
      const v = engine.evaluateSwap(
        level.board,
        level.boardCols,
        level.boardRows,
        a,
        b,
        level.tiles,
      );
      if (v.matches.length) {
        fixture(`level-${level.id}-${a}-${b}`, level, a, b, false, found === 0);
        found++;
        break;
      }
    }
  }
}
const base = structuredClone(content.levels[0]);
for (const aType of ['bomb', 'cross', 'rainbow'])
  for (const bType of ['bomb', 'cross', 'rainbow', 'ruby']) {
    const level = structuredClone(base);
    level.board[14].type = aType;
    level.board[15].type = bType;
    // Only evaluate random rainbows here; resolution parity fixtures use normal match RNG.
    fixture(`${aType}+${bType}`, level, 14, 15, false, true);
  }
for (const t of ['bomb', 'cross', 'rainbow']) {
  const level = structuredClone(base);
  level.board[14].type = t;
  fixture(`activate-${t}`, level, 14, 14, true, true);
}
for (const obstacle of ['chain', 'double-chain', 'frozen', 'blocker', 'seal', 'relic', 'signals']) {
  const level = structuredClone(base);
  level.board[14].type = 'bomb';
  level.oreOrders = [
    { color: 'ruby', target: 100 },
    { color: 'sapphire', target: 100 },
  ];
  if (obstacle === 'signals') {
    for (const [index, order] of [
      [13, 1],
      [20, 2],
      [21, 0],
    ])
      Object.assign(level.tiles[index], { signalHealth: 1, surveyOrder: order });
  }
  if (obstacle === 'chain') level.tiles[20].chainHealth = 1;
  if (obstacle === 'double-chain') level.tiles[20].chainHealth = 2;
  if (obstacle === 'frozen') level.tiles[20].state = 'FROZEN';
  if (obstacle === 'blocker') {
    level.tiles[20] = { type: 'blocker', health: 2, maxHealth: 2 };
    level.board[20] = null;
  }
  if (obstacle === 'seal')
    level.tiles[20] = { type: 'seal', sealColor: 'ruby', health: 2, maxHealth: 2 };
  if (obstacle === 'relic') {
    level.board[26].type = 'relic';
    level.tiles[38].exit = true;
  }
  fixture(`obstacle-${obstacle}`, level, 14, 14, true, true);
  level.board[15].type = 'rainbow';
  fixture(`fusion-${obstacle}`, level, 14, 15, false, true);
}
fixture('non-adjacent', base, 0, 8);
fixture('same-index', base, 0, 0);
process.stdout.write(JSON.stringify(fixtures));

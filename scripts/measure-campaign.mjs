// Compare deterministic, hint-led playthroughs with another checkout:
// node scripts/measure-campaign.mjs [path-to-checkout]
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createServer } from 'vite';
const source = resolve(process.argv[2] ?? '.', 'src');
const seedCount = Number(process.argv[3] ?? 0);
const requestedCount = process.argv[4] ? Number(process.argv[4]) : undefined;
const selectedIds = process.argv[5]?.split(',').map(Number);
const seeds = seedCount ? Array.from({ length: seedCount }, (_, i) => i + 1) : [1, 19, 73];
const moduleAt = (file) => import(pathToFileURL(resolve(source, file)));
const { generateLevelConfigs } = await moduleAt('game/engine/LevelGenerator.js');
const { MatchEngine } = await moduleAt('game/engine/MatchEngine.js');
const { HintEngine } = await moduleAt('game/engine/HintEngine.js');
const { TileManager } = await moduleAt('game/engine/TileManager.js');
const { canSwapGem, layerCount } = await moduleAt('game/engine/TileRules.js');
const { GEM_TYPES } = await moduleAt('game/engine/GemFactory.js');
const { detectBonusFromMatches } = await moduleAt('game/engine/MatchPatterns.js');
// Older comparison checkouts predate ore orders. Keep those runs comparable.
const mechanics = await moduleAt('game/engine/ChapterMechanics.js').catch((error) => {
  if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
  return { advanceOreOrders() {}, remainingOre: () => 0 };
});
// Vite resolves the shared economy modules exactly as it does in the app.
const loader = await createServer({
  root: resolve(source, '..'),
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
const { cascadeTier, clearScore, simultaneousMatchCount } = await loader.ssrLoadModule(
  '/src/game/engine/MatchRewards.js',
);
const { getStars } = await loader.ssrLoadModule('/src/data/campaign.js');
const rules = await loader.ssrLoadModule('/src/game/town/TownRules.js');
const { createTown, BANDIT_EVENT } = await loader.ssrLoadModule('/src/data/town.js');
const { eraGate, advanceEra } = await loader.ssrLoadModule('/src/game/town/TownEras.js');
const allLevels = generateLevelConfigs(requestedCount);
const levelCount = allLevels.length;
const engine = new MatchEngine(),
  hints = new HintEngine(),
  manager = new TileManager();
const results = [];
const originalRandom = Math.random;
try {
  for (const level of allLevels.filter((level) => !selectedIds || selectedIds.includes(level.id))) {
    for (const seed of seeds) {
      let randomState = level.id * seed * 7919;
      Math.random = () => {
        randomState = (randomState * 16807) % 2147483647;
        return (randomState - 1) / 2147483646;
      };
      let board = level.board.map((gem) => (gem ? { ...gem } : null));
      const tiles = level.tiles.map((tile) => ({ ...tile }));
      const oreOrders = (level.oreOrders ?? []).map((order) => ({ ...order }));
      const cols = level.boardCols,
        rows = level.boardRows;
      const gemTypes =
        level.boardLayout.gemTypes ?? GEM_TYPES.slice(0, level.boardLayout.gemTypeCount);
      let turns = 0,
        shuffles = 0;
      let jewels = 0,
        score = 0,
        maxCombo = 1;
      const comboCounts = {},
        multiMatchCounts = {};
      const remaining = () =>
        tiles.some((tile) => layerCount(tile) > 0) ||
        board.some((gem) => gem?.type === 'relic') ||
        mechanics.remainingOre(oreOrders) > 0;
      while (remaining() && turns < 400 && shuffles < 30) {
        const move = hints.findBestMove(board, tiles, cols, rows, { oreOrders });
        let evaluation;
        if (move) {
          evaluation = engine.evaluateSwap(
            board,
            cols,
            rows,
            move.swap.aIndex,
            move.swap.bIndex,
            tiles,
          );
          turns++;
        } else {
          const indices = board.flatMap((gem, index) =>
            canSwapGem(gem, tiles[index]) ? [index] : [],
          );
          for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [board[indices[i]], board[indices[j]]] = [board[indices[j]], board[indices[i]]];
          }
          const matches = engine.findMatches(board, cols, rows, tiles);
          const bonuses = detectBonusFromMatches(matches);
          for (const bonus of bonuses)
            board[bonus.index] = { ...board[bonus.index], type: bonus.type };
          evaluation = {
            board,
            matches,
            bonusesCreated: bonuses.map((bonus) => bonus.type),
            bonusIndices: bonuses.map((bonus) => bonus.index),
          };
          shuffles++;
        }
        const resolution = manager.getResolution({ ...evaluation, tiles, cols, rows, gemTypes });
        board = resolution.board;
        mechanics.advanceOreOrders(oreOrders, resolution.steps);
        resolution.steps.forEach((step, index) => {
          // Keep comparisons with checkouts predating the shared score helper usable.
          score += clearScore
            ? clearScore(step, index)
            : (step.cleared?.length ?? 0) * 100 * cascadeTier(step, index);
          jewels += step.collectedJewels?.length ?? 0;
          if (!step.cleared?.length) return;
          const tier = cascadeTier(step, index),
            matches = simultaneousMatchCount(step);
          maxCombo = Math.max(maxCombo, tier);
          if (tier >= 2) comboCounts[tier] = (comboCounts[tier] ?? 0) + 1;
          if (matches >= 2) multiMatchCounts[matches] = (multiMatchCounts[matches] ?? 0) + 1;
        });
      }
      const bonuses = board.filter((g) => ['bomb', 'rainbow', 'cross'].includes(g?.type)).length;
      results.push({
        id: level.id,
        seed,
        turns,
        shuffles,
        complete: !remaining(),
        score,
        maxCombo,
        chestTarget: level.chestTarget,
        starScoreTarget: level.starScoreTarget ?? level.chestTarget,
        stars: getStars(score, level.starScoreTarget ?? level.chestTarget, maxCombo),
        remainingOre: mechanics.remainingOre(oreOrders),
        coins: rules.miningPayout(jewels, bonuses, comboCounts, multiMatchCounts, level.id),
      });
    }
  }
} finally {
  Math.random = originalRandom;
  await loader.close();
}
const chapters = Array.from({ length: Math.ceil(levelCount / 6) }, (_, chapter) => {
  const runs = results.filter((run) => Math.floor((run.id - 1) / 6) === chapter);
  const turns = runs.map((run) => run.turns).sort((a, b) => a - b);
  return {
    chapter: chapter + 1,
    median: turns[Math.floor(turns.length / 2)],
    p90: turns[Math.ceil(turns.length * 0.9) - 1],
    max: turns.at(-1),
    shuffles: runs.reduce((sum, run) => sum + run.shuffles, 0),
    medianCoins: runs.map((r) => r.coins).sort((a, b) => a - b)[Math.floor(runs.length / 2)],
  };
});
// Conservative economy: only normal mining payouts; no chests, hammers,
// passive income or bounties. Buy suggested projects concurrently on each visit.
const villages = selectedIds
  ? []
  : seeds.map((seed) => {
      let town = createTown(),
        eraMilestones = {},
        frontierAt = null,
        completeAt = null,
        longestSavingGap = 0,
        savingGap = 0,
        loss = 0;
      const visit = () => {
        town = rules.scheduleRaid(town, () => 0);
        town = rules.banditEncounter(town, () => 0) ?? town;
        for (const project of Object.values(town.projects).filter(rules.constructionReady))
          town = rules.reinforceRaid(rules.finishConstruction(town, project.id, project.stage));
        const raid = town.events[BANDIT_EVENT];
        if (raid && !raid.seen) {
          loss += raid.loss;
          town.events[BANDIT_EVENT] = { ...raid, seen: true };
        }
        if (eraGate(town).available) {
          eraMilestones[town.era] ??= town.completedRuns;
          frontierAt ??= town.completedRuns;
          town = advanceEra(town, town.era);
          town.transition.pending = false;
        }
        if (eraGate(town).townComplete) {
          eraMilestones[town.era] ??= town.completedRuns;
          if (!eraGate(town).next?.enabled) completeAt ??= town.completedRuns;
        }
        let bought = 0;
        for (let i = 0; i < 100; i++) {
          const goal = rules.nextGoal(town);
          if (!goal || goal.reason) break;
          town = rules.purchase(town, goal.id, goal.stage);
          bought++;
        }
        savingGap = bought || Object.keys(town.projects).length || completeAt ? 0 : savingGap + 1;
        longestSavingGap = Math.max(longestSavingGap, savingGap);
      };
      visit();
      for (const run of results.filter((r) => r.seed === seed)) {
        town.coins += run.coins;
        town.completedRuns++;
        town = rules.advanceConstruction(town);
        visit();
      }
      return {
        seed,
        era: town.era,
        eraMilestones,
        frontierAt,
        completeAt,
        longestSavingGap,
        raidLoss: loss,
        coins: town.coins,
      };
    });
console.log(JSON.stringify({ chapters, villages, results }, null, 2));
if (results.some((run) => !run.complete)) process.exitCode = 1;

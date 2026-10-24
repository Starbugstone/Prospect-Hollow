// Consume actual hint-led campaign payouts; compare the shipped single-batch
// workshop with stored production using identical construction and coin inputs.
// node scripts/measure-moonstones.mjs /path/to/measure-campaign.json
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const measured = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const loader = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const rules = await loader.ssrLoadModule('/src/game/town/TownRules.js');
  const moon = await loader.ssrLoadModule('/src/data/moonstones.js');
  const { advancePuzzleProduction } = await loader.ssrLoadModule('/src/data/puzzleProduction.js');
  const { createTown, BUILDINGS } = await loader.ssrLoadModule('/src/data/town.js');
  const { eraGate, advanceEra } = await loader.ssrLoadModule('/src/game/town/TownEras.js');
  const { PERSONAL_AREAS, landmarkPrice, LANDMARK_PROGRESSION } = await loader.ssrLoadModule(
    '/src/data/townLandmarks.js',
  );
  const sites = PERSONAL_AREAS.filter((area) => area.currency === 'moonstones');
  const prices = sites.map((area) =>
    LANDMARK_PROGRESSION.levels.map((_, index) => landmarkPrice(area, area.choices[0], index + 1)),
  );
  const totals = prices.map((levels) => {
    let total = 0;
    return levels.map((price) => (total += price));
  });
  const bothTotal = totals.reduce((sum, levels) => sum + levels.at(-1), 0);
  const targets = [
    ...new Set([
      30,
      60,
      90,
      ...prices.flat(),
      ...totals.flat(),
      ...LANDMARK_PROGRESSION.levels.map((_, i) => totals.reduce((sum, site) => sum + site[i], 0)),
    ]),
  ].sort((a, b) => a - b);
  const outputs = [];
  for (const seed of [...new Set(measured.results.map((r) => r.seed))]) {
    const runs = measured.results.filter((r) => r.seed === seed);
    const tail = runs
      .slice(-6)
      .map((r) => r.coins)
      .sort((a, b) => a - b);
    const replayPayout = tail[Math.floor(tail.length / 2)];
    function simulate(model, collectEvery) {
      let town = createTown(),
        twinAt = null,
        earnedAtTwin = 0,
        first100 = null;
      const workshop = [],
        milestones = [];
      function visit() {
        for (const project of Object.values(town.projects).filter(rules.constructionReady)) {
          town = rules.finishConstruction(town, project.id, project.stage);
          if (project.id === 'moonstoneWorkshop')
            workshop.push({
              at: town.completedRuns,
              level: town.buildings.moonstoneWorkshop,
              moonstones: town.moonstones,
            });
        }
        if (
          town.moonstoneProduction.stored &&
          twinAt !== null &&
          (town.completedRuns - twinAt) % collectEvery === 0
        ) {
          town = moon.earnMoonstones(town, town.moonstoneProduction.stored);
          town.moonstoneProduction = { ...town.moonstoneProduction, stored: 0 };
        }
        for (const price of targets) {
          if (town.moonstones >= price && !milestones.some((m) => m.price === price)) {
            milestones.push({
              price,
              at: town.completedRuns,
              puzzlesSinceTwin: town.completedRuns - twinAt,
            });
          }
        }
        const gate = eraGate(town);
        if (gate.available) {
          town = advanceEra(town, town.era);
          town.transition.pending = false;
          if (town.era === 'twin-hollows') {
            twinAt = town.completedRuns;
            earnedAtTwin = town.moonstonesEarned;
          }
        }
        for (let n = 0; n < 100; n++) {
          const goal = rules.nextGoal(town);
          if (!goal || goal.reason) break;
          town = rules.purchase(town, goal.id, goal.stage);
        }
      }
      visit();
      for (let n = 0; n < 10000; n++) {
        town.coins += runs[n]?.coins ?? replayPayout;
        town.completedRuns++;
        town = rules.advanceConstruction(town);
        if (model === 'before' && town.buildings.moonstoneWorkshop) {
          const batch = advancePuzzleProduction(
            {
              progress: town.moonstoneProduction.progress,
              charge: town.moonstoneProduction.stored,
            },
            moon.MOONSTONE_ECONOMY.runs,
            town.buildings.moonstoneWorkshop,
          );
          town.moonstoneProduction = { progress: batch.progress, stored: batch.charge };
        } else if (model === 'after') town = moon.advanceMoonstoneProduction(town);
        visit();
        if (twinAt !== null && town.completedRuns - twinAt === 100) {
          const collected = town.moonstonesEarned - earnedAtTwin;
          first100 = {
            collected,
            stored: town.moonstoneProduction.stored,
            totalProduced: collected + town.moonstoneProduction.stored,
            saleCoins: collected * moon.MOONSTONE_ECONOMY.saleCoins,
            allProducedSaleCoins:
              (collected + town.moonstoneProduction.stored) * moon.MOONSTONE_ECONOMY.saleCoins,
            allProducedSaleInLatePuzzles:
              ((collected + town.moonstoneProduction.stored) * moon.MOONSTONE_ECONOMY.saleCoins) /
              replayPayout,
            salePercentOf100PuzzleIncome:
              (100 * collected * moon.MOONSTONE_ECONOMY.saleCoins) / (100 * replayPayout),
          };
        }
        if (first100 && milestones.length === targets.length && eraGate(town).townComplete) break;
      }
      return {
        model,
        collectEvery,
        twinAt,
        workshop,
        first100,
        milestones,
        atEnd: town.completedRuns,
        balance: town.moonstones,
      };
    }
    const scenarios = ['before', 'after'].flatMap((model) =>
      [1, 10, 30].map((n) => simulate(model, n)),
    );
    // A completed 546-level campaign is the measured input, so every level is unlocked.
    // Maximum assumes level 3, unused allowances, and collection before the store fills.
    const maxLevel = BUILDINGS.find((building) => building.id === 'moonstoneWorkshop').upgrades
      .length;
    const gemsPerLevel =
      moon.MOONSTONE_ECONOMY.continuousGemsPerPuzzle *
      moon.MOONSTONE_ECONOMY.continuousPuzzlesPerLevel;
    const continuousTown = createTown();
    continuousTown.buildings.moonstoneWorkshop = maxLevel;
    let town = continuousTown;
    for (const run of runs) {
      if (!run) continue;
      town = moon.advanceContinuousMoonstones(town, 0, gemsPerLevel).town;
      town = moon.earnMoonstones(town, town.moonstoneProduction.stored);
      town.moonstoneProduction = { ...town.moonstoneProduction, stored: 0 };
    }
    const continuousTargets = totals[0].concat(bothTotal).map((price) => {
      const levels = Math.ceil(price / maxLevel);
      return { price, levels, gems: levels * gemsPerLevel, stones: levels * maxLevel };
    });
    outputs.push({
      seed,
      measuredLevels: runs.length,
      replayPayout,
      saleCoins: moon.MOONSTONE_ECONOMY.saleCoins,
      prices: prices[0],
      cumulativePrices: totals[0],
      bothTotal,
      scenarios,
      continuous: {
        beforeStones: 0,
        levels: runs.length,
        gems: runs.length * gemsPerLevel,
        puzzleCredits: runs.length * moon.MOONSTONE_ECONOMY.continuousPuzzlesPerLevel,
        maxStones: town.moonstones,
        saleCoins: town.moonstones * moon.MOONSTONE_ECONOMY.saleCoins,
        saleInLatePuzzles: (town.moonstones * moon.MOONSTONE_ECONOMY.saleCoins) / replayPayout,
        fromZeroBalance: continuousTargets,
      },
    });
  }
  console.log(JSON.stringify(outputs, null, 2));
} finally {
  await loader.close();
}

// Consume measured hint-led mining payouts; continue the same village through
// Twin Hollows using the measured final chapter median for post-campaign replays.
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
  const { createTown } = await loader.ssrLoadModule('/src/data/town.js');
  const { eraGate, advanceEra } = await loader.ssrLoadModule('/src/game/town/TownEras.js');
  const { PERSONAL_AREAS, LANDMARK_BY_ID, LANDMARK_PROGRESSION } = await loader.ssrLoadModule(
    '/src/data/townLandmarks.js',
  );
  const sites = PERSONAL_AREAS.filter((area) => area.currency === 'moonstones');
  const totals = sites.map((area) => {
    let total = 0;
    return LANDMARK_PROGRESSION.levels.map(
      (level) => (total += LANDMARK_BY_ID[area.choices[0]].price * level.multiplier),
    );
  });
  const targets = [
    ...new Set([
      30,
      60,
      90,
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
    let town = createTown(),
      twinAt = null;
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
      if (town.moonstoneProduction.charge) {
        town = moon.earnMoonstones(town, town.moonstoneProduction.charge);
        town.moonstoneProduction = { progress: 0, charge: 0 };
      }
      for (const price of targets)
        if (town.moonstones >= price && !milestones.some((m) => m.price === price))
          milestones.push({
            price,
            at: town.completedRuns,
            puzzlesSinceTwin: town.completedRuns - twinAt,
          });
      const gate = eraGate(town);
      if (gate.available) {
        town = advanceEra(town, town.era);
        town.transition.pending = false;
        if (town.era === 'twin-hollows') twinAt = town.completedRuns;
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
      town = moon.advanceMoonstoneProduction(rules.advanceConstruction(town));
      visit();
      if (milestones.length === targets.length && eraGate(town).townComplete) break;
    }
    outputs.push({
      seed,
      measuredLevels: runs.length,
      replayPayout,
      twinAt,
      workshop,
      milestones,
      atEnd: town.completedRuns,
      balance: town.moonstones,
      saleCoins: moon.MOONSTONE_ECONOMY.saleCoins,
    });
  }
  console.log(JSON.stringify(outputs, null, 2));
} finally {
  await loader.close();
}

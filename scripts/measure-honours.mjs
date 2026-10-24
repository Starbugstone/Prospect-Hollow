// Run in Node 24 Docker after measure-campaign.mjs, once normally and once with
// CONTINUOUS_VISIT_MOVES=20. Report fixed-rank balance without changing game rules.
// node scripts/measure-honours.mjs normal.json continuous.json
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const normal = JSON.parse(readFileSync(process.argv[2], 'utf8')).results;
const continuous = JSON.parse(readFileSync(process.argv[3], 'utf8')).results;
const loader = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const h = await loader.ssrLoadModule('/src/data/honours.js');
  const rules = await loader.ssrLoadModule('/src/game/town/TownRules.js');
  const moon = await loader.ssrLoadModule('/src/data/moonstones.js');
  const { createTown } = await loader.ssrLoadModule('/src/data/town.js');
  const { miningDepthBonus } = await loader.ssrLoadModule('/src/data/economy.js');
  const { CONTINUOUS_COIN_CAP } = await loader.ssrLoadModule('/src/data/rewards.js');
  const { eraGate, advanceEra } = await loader.ssrLoadModule('/src/game/town/TownEras.js');
  const { PERSONAL_AREAS, landmarkOffer, purchaseLandmark, advanceMonumentWorks } =
    await loader.ssrLoadModule('/src/data/townLandmarks.js');
  const selected = h.HONOURS.definitions.filter((r) => r.version === 2 || r.since === 5);
  const results = [];
  for (const seed of [...new Set(normal.map((r) => r.seed))]) {
    const runs = normal.filter((r) => r.seed === seed);
    const visits = new Map(continuous.filter((r) => r.seed === seed).map((r) => [r.id, r]));
    if (runs.some((r, i) => !r.complete || r.id !== i + 1))
      throw Error('Incomplete campaign measurements');
    for (const pattern of [0, 1, 3]) {
      let town = createTown(),
        honours = h.createHonours(),
        museumAt = null,
        twinAt = null;
      const reached = {},
        coinLevels = new Set(),
        moonstoneGems = new Map();
      const note = (n, phase) => {
        const state = { town, honours };
        for (const rank of selected)
          if (!reached[rank.id] && rank.qualifies(state))
            reached[rank.id] = { normalRuns: n, level: ((n - 1) % runs.length) + 1, phase };
      };
      const visitTown = () => {
        for (const p of Object.values(town.projects).filter(rules.constructionReady))
          town = rules.finishConstruction(town, p.id, p.stage);
        const production = town.moonstoneProduction;
        const stored = production.stored ?? production.charge;
        if (stored) {
          town = moon.earnMoonstones(town, stored);
          town.moonstoneProduction = Object.hasOwn(production, 'stored')
            ? { ...production, stored: 0 }
            : { progress: 0, charge: 0 };
        }
        if (town.buildings.museum) museumAt ??= town.completedRuns;
        if (eraGate(town).available) {
          town = advanceEra(town, town.era);
          town.transition.pending = false;
          if (town.era === 'twin-hollows') twinAt ??= town.completedRuns;
        }
        for (let i = 0; i < 100; i++) {
          const goal = rules.nextGoal(town);
          if (!goal || goal.reason) break;
          town = rules.purchase(town, goal.id, goal.stage);
        }
        // Buy each optional foundation after affordable progression purchases.
        // No monument upgrades: this family measures different sponsored sites.
        for (const area of PERSONAL_AREAS) {
          if (town.personalisation?.areas?.[area.id]?.[0]) continue;
          const offer = landmarkOffer(town, area, area.choices[0]);
          if (!offer) continue;
          town =
            purchaseLandmark(town, {
              id: area.id,
              slot: 0,
              value: offer.choice,
              expectedChoice: offer.expectedChoice,
              expectedLevel: offer.expectedLevel,
            }) ?? town;
        }
      };
      visitTown();
      // Four full campaign passes are a diagnostic horizon. Replays never fail
      // or stop the player after this many puzzles.
      for (let n = 1; n <= runs.length * 4; n++) {
        const run = runs[(n - 1) % runs.length];
        town.coins += run.coins;
        town.completedRuns++;
        town = moon.advanceMoonstoneProduction(
          advanceMonumentWorks(rules.advanceConstruction(town)),
        );
        honours = h.creditRun(honours, {
          gems: run.gems,
          fusions: run.fusionsByKey,
          mine: run.mine,
        });
        visitTown();
        note(n, 'normal');
        if (town.buildings.museum && pattern) {
          const c = visits.get(run.id);
          if (!c || c.turns !== c.visitMoves) throw Error('Incomplete continuous measurement');
          for (let v = 1; v <= pattern; v++) {
            honours = h.creditContinuous(
              honours,
              null,
              { gems: c.gems, fusions: c.fusionsByKey, mine: c.mine },
              run.id,
              c.score,
            );
            // The parallel workshop change adds a shared continuous feed. Use
            // that helper when present; never reproduce its production rules here.
            if (moon.advanceContinuousMoonstones) {
              const stock = moon.advanceContinuousMoonstones(
                town,
                moonstoneGems.get(run.id) ?? 0,
                c.jewels,
              );
              town = stock.town;
              moonstoneGems.set(run.id, stock.gems);
            }
            if (!coinLevels.has(run.id)) {
              const base = Math.floor(c.jewels / 10);
              town.coins += Math.min(CONTINUOUS_COIN_CAP, base + miningDepthBonus(base, run.id));
              coinLevels.add(run.id);
            }
            visitTown();
            note(n, `continuous-${v}`);
          }
        }
      }
      results.push({ seed, pattern, museumAt, twinAt, reached, horizon: runs.length * 4 });
    }
  }
  const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
  const table = selected.map((rank) => ({
    id: rank.id,
    family: rank.family,
    metal: rank.metal,
    goal: rank.goal,
    timings: [0, 1, 3].map((p) => {
      const times = results
        .filter((r) => r.pattern === p)
        .map((r) => r.reached[rank.id]?.normalRuns ?? null);
      return times.every((n) => n !== null)
        ? { median: median(times), min: Math.min(...times), max: Math.max(...times) }
        : { reachedSeeds: times.filter((n) => n !== null), horizon: 2184 };
    }),
  }));
  console.log(
    JSON.stringify(
      {
        moonstoneEconomyVersion: moon.MOONSTONE_VERSION,
        visitMoves: 20,
        visits: {
          gems: median(continuous.map((r) => r.jewels)),
          score: median(continuous.map((r) => r.score)),
          maxScore: Math.max(...continuous.map((r) => r.score)),
        },
        results,
        table,
      },
      null,
      2,
    ),
  );
} finally {
  await loader.close();
}

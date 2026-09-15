// Feed this the JSON from scripts/measure-campaign.mjs. Simulates construction,
// normal rewards, chapter gifts, saved progression and targeted chest strategies.
// node scripts/measure-town-progression.mjs measurements.json ordinary 1
// Strategies: ordinary, optimized-one-chest, optimized-two-chests, lower-payout.
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { createPinia, setActivePinia } from 'pinia';
const [input, strategy = 'ordinary', seedText = '1'] = process.argv.slice(2);
if (
  !input ||
  !['ordinary', 'optimized-one-chest', 'optimized-two-chests', 'lower-payout'].includes(strategy)
)
  throw Error('Supply a campaign measurement JSON file and a supported strategy.');
const seed = Number(seedText);
const runs = JSON.parse(readFileSync(input, 'utf8'))
  .results.filter((run) => run.seed === seed)
  .sort((a, b) => a.id - b.id);
if (!runs.length || runs.some((run, index) => run.id !== index + 1 || !run.complete))
  throw Error('Measurements must contain a complete contiguous campaign for the selected seed.');
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const { useCampaignStore } = await server.ssrLoadModule('/src/stores/campaignStore.js');
  const rules = await server.ssrLoadModule('/src/game/town/TownRules.js');
  const { eraGate } = await server.ssrLoadModule('/src/game/town/TownEras.js');
  const { BUILDINGS, BANDIT_EVENT } = await server.ssrLoadModule('/src/data/town.js');
  const { chestCoinReward } = await server.ssrLoadModule('/src/data/economy.js');
  const factor = strategy === 'lower-payout' ? 0.75 : 1;
  const optimized = strategy.startsWith('optimized');
  const saves = new Map();
  globalThis.localStorage = {
    getItem: (key) => saves.get(key) ?? null,
    setItem: (key, value) => saves.set(key, value),
  };
  setActivePinia(createPinia());
  Date.now = () => 1800000000000;
  const c = useCampaignStore();
  let state = seed * 7919;
  Math.random = () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
  const milestones = {},
    eras = {},
    turns = [];
  let completeAt = null;
  const bestHammer = () =>
    BUILDINGS.map((b) => ({ id: b.id, offer: rules.upgradeOffer(c.town, b.id) }))
      .filter((x) => x.offer && rules.buildWithHammer(c.town, x.id, x.offer.stage))
      .sort((a, b) => b.offer.cost - a.offer.cost)[0];
  const eraStats = () => (eras[c.town.era] ??= { purchases: 0, hammers: 0, coinsSpent: 0 });
  const visit = () => {
    const era = c.town.era,
      stat = eraStats();
    c.resolveBandits();
    for (const p of Object.values(c.town.projects).filter(rules.constructionReady))
      if (!c.finishConstruction(p.id, p.stage)) throw Error('Could not finish construction');
    const event = c.town.events[BANDIT_EVENT];
    if (event && !event.seen) c.markRaidSeen(event.id);
    if (eraGate(c.town).townComplete) {
      milestones[era] ??= c.town.completedRuns;
      if (!eraGate(c.town).next) {
        completeAt ??= c.town.completedRuns;
        return;
      }
      if (c.advanceEra(era)) {
        c.acknowledgeEra();
        return visit();
      }
    }
    // Technical simulation guard; never a player move allowance.
    for (let n = 0; n < 500; n++) {
      const hammer = optimized && c.builderHammers ? bestHammer() : null;
      const goal = hammer ? { id: hammer.id, ...hammer.offer } : rules.nextGoal(c.town);
      if (!goal) break;
      if (c.builderHammers && c.useBuilderHammer(goal.id, goal.stage)) {
        stat.hammers++;
        continue;
      }
      if (goal.reason) break;
      const before = c.town.coins;
      if (!c.upgradeBuilding(goal.id, goal.stage)) throw Error('Could not purchase construction');
      stat.coinsSpent += before - c.town.coins;
      stat.purchases++;
    }
  };
  visit();
  // Past the supplied campaign, explicitly replay its final level at observed payout.
  for (let index = 0; index < 480 && !completeAt; index++) {
    const run = runs[Math.min(index, runs.length - 1)];
    const payout = Math.floor(run.coins * factor);
    const runId = c.beginRun('normal', run.id);
    const two = strategy === 'optimized-two-chests';
    const chests = c.recordVictory({
      id: run.id,
      runId,
      score: two ? 6000 : 1,
      target: 6000,
      combo: 1,
      elapsedMs: two ? 1000 : 600000,
      speedTargetMs: 60000,
      chooseRewards: optimized,
    });
    if (optimized)
      for (const chest of chests) {
        const best = bestHammer();
        const choice =
          c.builderHammers < 5 && best?.offer.cost >= chestCoinReward(run.id)
            ? 'builder-hammer'
            : 'coins';
        c.claimChest(chest.id, choice);
        if (choice === 'builder-hammer') {
          if (!c.useBuilderHammer(best.id, best.offer.stage))
            throw Error('Could not use targeted hammer');
          eraStats().hammers++;
        }
      }
    // Mining payout was measured from legal board resolutions, separately from chests.
    c.town.coins += payout;
    const era = c.town.era;
    visit();
    turns.push({ run: index + 1, level: run.id, era, payout });
  }
  console.log(
    JSON.stringify(
      {
        strategy,
        seed,
        factor,
        uniqueLevels: runs.length,
        completeAt,
        replays: completeAt === null ? null : Math.max(0, completeAt - runs.length),
        milestones,
        coins: c.town.coins,
        eras,
        turns,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}

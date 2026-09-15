// Replay identical measured mining payouts against two content revisions.
// node scripts/compare-town-economy.mjs output/balance/mining.json /path/to/baseline
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer } from 'vite';
const { results } = JSON.parse(await readFile(process.argv[2], 'utf8'));
const seeds = [...new Set(results.map((r) => r.seed))];
const report = {};
for (const [name, root] of [
  ['before', process.argv[3]],
  ['after', '.'],
]) {
  const loader = await createServer({
    root: resolve(root),
    server: { middlewareMode: true },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, entries: [] },
  });
  try {
    const load = (f) => loader.ssrLoadModule('/src/' + f);
    const rules = await load('game/town/TownRules.js');
    const eras = await load('game/town/TownEras.js');
    const { createTown, BANDIT_EVENT } = await load('data/town.js');
    const rewards = await load('data/rewards.js');
    const { grantChapterGift } = await load('data/journey.js');
    const { POWERS } = await load('data/campaign.js');
    report[name] = [];
    for (const chestsPerRun of [1, 2])
      for (const seed of seeds) {
        const state = {
          town: createTown(),
          powers: POWERS.map((p) => ({ ...p, quantity: 0 })),
          builderHammers: 0,
          pendingChests: [],
        };
        let random = seed * 7919,
          pity = 0,
          completeAt = null,
          longestGap = 0,
          gap = 0;
        const rng = () => ((random = (random * 16807) % 2147483647) - 1) / 2147483646;
        const visit = () => {
          state.town = rules.scheduleRaid(state.town, () => 0);
          state.town = rules.banditEncounter(state.town, () => 0) ?? state.town;
          for (const p of Object.values(state.town.projects).filter(rules.constructionReady))
            state.town = rules.reinforceRaid(rules.finishConstruction(state.town, p.id, p.stage));
          if (state.town.events[BANDIT_EVENT]) state.town.events[BANDIT_EVENT].seen = true;
          if (eras.eraGate(state.town).available) {
            state.town = eras.advanceEra(state.town, state.town.era);
            state.town.transition.pending = false;
          }
          let bought = 0;
          for (let n = 0; n < 150; n++) {
            const goal = rules.nextGoal(state.town, state.builderHammers);
            if (!goal) break;
            if (state.builderHammers && !goal.reason) {
              const next = rules.buildWithHammer(state.town, goal.id, goal.stage);
              if (next) {
                state.town = next;
                state.builderHammers--;
                bought++;
                continue;
              }
            }
            if (goal.reason) break;
            const next = rules.purchase(state.town, goal.id, goal.stage);
            if (!next) break;
            state.town = next;
            bought++;
          }
          if (eras.eraGate(state.town).townComplete && !eras.eraGate(state.town).next?.enabled)
            completeAt ??= state.town.completedRuns;
          gap = bought || Object.keys(state.town.projects).length || completeAt ? 0 : gap + 1;
          longestGap = Math.max(longestGap, gap);
        };
        visit();
        for (const run of results.filter((r) => r.seed === seed)) {
          state.town.completedRuns++;
          state.town = rules.advanceConstruction(state.town);
          if (run.id % 6 === 0) grantChapterGift(state, run.id / 6);
          for (let i = 0; i < chestsPerRun; i++) {
            const drop =
              pity >= 9
                ? {
                    id: rewards.chestRewardFits(state, rewards.chestReward('builder-hammer'))
                      ? 'builder-hammer'
                      : 'coins',
                  }
                : rewards.rollChestReward(rng, state);
            pity = drop.id === 'builder-hammer' ? 0 : pity + 1;
            rewards.grantReward(state, rewards.chestReward(drop.id, run.id));
          }
          state.town.coins += run.coins;
          visit();
        }
        report[name].push({
          seed,
          chestsPerRun,
          completeAt,
          longestSavingGap: longestGap,
          coins: state.town.coins,
          unfinished: !eras.isEraComplete(state.town),
        });
      }
  } finally {
    await loader.close();
  }
}
console.log(JSON.stringify(report, null, 2));

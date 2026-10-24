// Docker-only integrated probe. Consume measure-campaign's actual board results;
// all production, prices, progression, honours and VIP tours use runtime helpers.
// node scripts/measure-economy-balance.mjs normal.json continuous.json
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
import { CurvePath, LineCurve3, Vector3, Group } from 'three';
const normal = JSON.parse(readFileSync(process.argv[2], 'utf8')).results;
const continuous = JSON.parse(readFileSync(process.argv[3], 'utf8')).results;
const loader = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const load = (path) => loader.ssrLoadModule(`/src/${path}.js`);
  const rules = await load('game/town/TownRules');
  const moon = await load('data/moonstones');
  const h = await load('data/honours');
  const marks = await load('data/townLandmarks');
  const { createTown } = await load('data/town');
  const { eraGate, advanceEra } = await load('game/town/TownEras');
  const { miningDepthBonus } = await load('data/economy');
  const { CONTINUOUS_COIN_CAP } = await load('data/rewards');
  const { vipSpend, VIP_SPEND_VERSION } = await load('data/vipVisits');
  const { vipVisitor } = await load('data/villagers');
  const { TownVipArrivals } = await load('game/town/TownVipArrivals');
  const { TownItineraries, updateItinerary } = await load('game/town/TownItineraries');
  const { TownNavigation, walkPath } = await load('game/town/TownNavigation');
  const { trainJourney, boatJourney } = await load('game/town/TownEraActivity');
  const { airplaneArrival } = await load('game/town/TownAviation');
  const { elevatorArrival } = await load('game/town/buildings/future');
  const journeys = {
    railDepot: trainJourney,
    riverPort: boatJourney,
    airport: airplaneArrival,
    spaceElevator: elevatorArrival,
  };
  const vipCache = new Map();
  // Same authored-tour harness as measure-vip-income, applied to the CURRENT
  // unfinished town, one uninterrupted hour at a time. No rate extrapolation.
  function vipHour(town, seed) {
    const key = JSON.stringify([
      seed,
      town.era,
      town.buildings,
      town.buildingEras,
      town.buildingEraLevels,
      Object.keys(town.projects),
    ]);
    if (vipCache.has(key)) return vipCache.get(key);
    let purchases = 0;
    const dt = 0.1;
    const d = {
      town,
      elapsed: 0,
      navigation: new TownNavigation(),
      world: new Group(),
      visitorTransports: new Map(),
      actors: [],
      lifeReady: true,
      drawVip: (s, visit) => vipVisitor(s, visit),
      setVillagerIdentity: (actor, identity) => {
        actor.root.userData.villager = identity;
      },
      onVipSpend: () => purchases++,
      person: ({ route, seed, visitor }) => {
        const curve = new CurvePath();
        const points = route.map(([x, z]) => new Vector3(x, 0.07, z));
        points.push(...points.slice(1, -1).reverse(), points[0]);
        for (let i = 1; i < points.length; i++) curve.add(new LineCurve3(points[i - 1], points[i]));
        return {
          root: new Group(),
          curve,
          duration: curve.getLength() / 0.55,
          seed,
          visitor,
          walkPath: walkPath(points.map((p) => p.toArray())),
          motion: { routeDistance: 0 },
        };
      },
      animatePerson: (actor) => {
        actor.motion ??= { routeDistance: 0 };
        updateItinerary(d, actor, d.elapsed);
        if (!actor.routeResting) actor.motion.routeDistance += 0.55 * dt;
      },
    };
    d.itineraries = new TownItineraries(d);
    d.vipArrivals = new TownVipArrivals(d, seed * 7919 + 7);
    d.vipArrivals.attach(town);
    for (const actor of d.vipArrivals.actors)
      for (const step of d.itineraries.prepare(actor)) void step;
    for (let tick = 0; tick < 3600 / dt; tick++) {
      d.elapsed = tick * dt;
      for (const [id, journey] of Object.entries(journeys))
        d.visitorTransports.set(id, { ...journey(d.elapsed), root: { visible: true } });
      d.vipArrivals.update();
    }
    vipCache.set(key, purchases);
    return purchases;
  }
  const rankIds = h.HONOURS.definitions.filter(
    (r) =>
      ['new-hollow', 'moonstone-reserve', 'landmark-patron', 'endless-seam'].includes(r.family) ||
      ['gem-ruby-gold', 'fusion-gold'].includes(r.id),
  );
  const sites = marks.PERSONAL_AREAS.filter((a) => a.currency === 'moonstones');
  const patterns = [
    { id: 'A', visits: 0, collect: 1 },
    { id: 'B', visits: 1, collect: 10 },
    { id: 'C', visits: 3, collect: 10, hours: true, sales: true },
    { id: 'C-no-vip', visits: 3, collect: 10, hours: true, sales: true, noVip: true },
    { id: 'C-no-sale', visits: 3, collect: 10, hours: true },
    { id: 'C-no-vip-or-sale', visits: 3, collect: 10, hours: true, noVip: true },
    { id: 'C-no-extras', visits: 3, collect: 10 },
    { id: 'A-no-coin-landmarks', visits: 0, collect: 1, noCoinLandmarks: true },
    { id: 'C-deferred', visits: 3, collect: 10, hours: true, sales: true, deferred: true },
  ];
  const results = [];
  for (const seed of [1, 2, 3]) {
    const runs = normal.filter((r) => r.seed === seed);
    const visits = new Map(continuous.filter((r) => r.seed === seed).map((r) => [r.id, r]));
    if (runs.length !== 546 || runs.some((r, i) => r.id !== i + 1 || !r.complete))
      throw Error('Expected 546 complete normal levels per seed');
    if (visits.size !== 546 || [...visits.values()].some((r) => r.turns !== 20))
      throw Error('Expected 546 complete 20-move samples per seed');
    for (const pattern of patterns) {
      let town = createTown(),
        honours = h.createHonours(),
        now = 1800000000000,
        sold = 0,
        stoneSource = 0,
        collectionAt = null;
      const reached = {},
        eras = {},
        workshop = [],
        purchases = [],
        snapshots = {},
        ledger = [];
      const coinHistory = new Map(),
        gemHistory = new Map(),
        visitHistory = new Map();
      let bothPaid = null,
        bothComplete = null,
        townComplete = null;
      const totals = { mining: 0, saloon: 0, vip: 0, sales: 0, continuous: 0 };
      const note = () => {
        for (const rank of rankIds)
          if (!reached[rank.id] && rank.qualifies({ town, honours }))
            reached[rank.id] = town.completedRuns;
        if (sites.every((a) => marks.areaStage(town, a) === 5)) bothPaid ??= town.completedRuns;
        if (sites.every((a) => marks.areaShownStage(town, a) === 5))
          bothComplete ??= town.completedRuns;
      };
      function collect() {
        const stock = town.moonstoneProduction.stored;
        if (stock) {
          town = moon.earnMoonstones(town, stock);
          town.moonstoneProduction = { ...town.moonstoneProduction, stored: 0 };
        }
        // Sell half of all lifetime collected/gift stones, rounded down once.
        const quantity = pattern.sales ? Math.floor(town.moonstonesEarned / 2) - sold : 0;
        if (quantity) {
          const next = moon.sellMoonstoneBalance(town, quantity);
          if (!next) throw Error('Sale reservation overspent');
          town = next;
          sold += quantity;
          totals.sales += quantity * moon.MOONSTONE_ECONOMY.saleCoins;
        }
      }
      function visitTown() {
        for (const p of Object.values(town.projects).filter(rules.constructionReady)) {
          town = rules.finishConstruction(town, p.id, p.stage);
          if (p.id === 'moonstoneWorkshop')
            workshop.push({ at: town.completedRuns, level: town.buildings[p.id] });
        }
        for (const a of marks.PERSONAL_AREAS) {
          const work = marks.monumentWork(town, a);
          if (work?.ready) town = marks.unveilLandmark(town, a.id, work.level);
        }
        if (town.completedRuns % pattern.collect === 0 && collectionAt !== town.completedRuns) {
          collect();
          collectionAt = town.completedRuns;
        }
        if (eraGate(town).available) {
          town = advanceEra(town, town.era);
          town.transition.pending = false;
          eras[town.era] = town.completedRuns;
        }
        if (town.era === 'twin-hollows' && eraGate(town).townComplete)
          townComplete ??= town.completedRuns;
        for (let n = 0; n < 100; n++) {
          const goal = rules.nextGoal(town);
          if (!goal || goal.reason) break;
          town = rules.purchase(town, goal.id, goal.stage);
        }
        // Sponsor each coin foundation, after progression purchases, as in the
        // honours probe. Moon sites alternate by level to keep the pair together.
        const ordered = [...marks.PERSONAL_AREAS].sort(
          (a, b) => marks.areaStage(town, a) - marks.areaStage(town, b),
        );
        for (const a of ordered) {
          if (a.currency === 'coins' && (pattern.noCoinLandmarks || marks.areaStage(town, a)))
            continue;
          const offer = marks.landmarkOffer(town, a, a.choices[0]);
          if (!offer) continue;
          const reservedSales = pattern.sales ? Math.floor(town.moonstonesEarned / 2) - sold : 0;
          if (a.currency === 'moonstones' && town.moonstones - reservedSales < offer.price)
            continue;
          const next = marks.purchaseLandmark(town, {
            id: a.id,
            slot: 0,
            value: offer.choice,
            expectedChoice: offer.expectedChoice,
            expectedLevel: offer.expectedLevel,
          });
          if (!next) continue;
          town = next;
          if (a.currency === 'moonstones')
            purchases.push({
              id: a.id,
              level: offer.level,
              price: offer.price,
              at: town.completedRuns,
            });
        }
        note();
      }
      function continuousVisits(id) {
        const c = visits.get(id);
        while ((visitHistory.get(id) ?? 0) < pattern.visits) {
          visitHistory.set(id, (visitHistory.get(id) ?? 0) + 1);
          honours = h.creditContinuous(
            honours,
            null,
            { gems: c.gems, fusions: c.fusionsByKey, mine: c.mine },
            id,
            c.score,
          );
          const stock = moon.advanceContinuousMoonstones(town, gemHistory.get(id) ?? 0, c.jewels);
          town = stock.town;
          gemHistory.set(id, stock.gems);
          const base = Math.floor(c.jewels / 10);
          const credit = Math.min(
            CONTINUOUS_COIN_CAP - (coinHistory.get(id) ?? 0),
            base + miningDepthBonus(base, id),
          );
          town.coins += credit;
          totals.continuous += credit;
          coinHistory.set(id, (coinHistory.get(id) ?? 0) + credit);
          visitTown();
        }
      }
      visitTown();
      // Fixed measurement horizon only; never a gameplay limit. After the first
      // 546 victories cycle the six measured final-chapter boards, without new unlocks.
      for (let n = 1; n <= 2184; n++) {
        const run = runs[n <= 546 ? n - 1 : 540 + ((n - 547) % 6)];
        const before = { ...totals };
        town.coins += run.coins;
        totals.mining += run.coins;
        town.completedRuns++;
        town = moon.advanceMoonstoneProduction(
          marks.advanceMonumentWorks(rules.advanceConstruction(town)),
        );
        honours = h.creditRun(honours, {
          gems: run.gems,
          fusions: run.fusionsByKey,
          mine: run.mine,
        });
        visitTown();
        if (pattern.visits && town.buildings.museum) {
          if (!pattern.deferred) {
            for (let id = 1; id <= Math.min(n, 546); id++)
              if ((visitHistory.get(id) ?? 0) < pattern.visits) continuousVisits(id);
          } else if (town.buildings.moonstoneWorkshop === 3) {
            // One old level's three visits per normal puzzle, rather than an
            // unbounded instant backlog dump. Each level is visited only once.
            const id = Array.from({ length: Math.min(n, 546) }, (_, i) => i + 1).find(
              (id) => !visitHistory.has(id),
            );
            if (id) continuousVisits(id);
          }
        }
        if (pattern.hours && n % 10 === 0) {
          town = rules.settleSaloonIncome(town, now).town;
          now += rules.HOUR_MS;
          town = rules.settleSaloonIncome(town, now).town;
          const income = town.income.stored;
          totals.saloon += income;
          town = { ...town, coins: town.coins + income, income: { ...town.income, stored: 0 } };
          if (!pattern.noVip) {
            const income = vipHour(town, seed) * vipSpend({ [Math.min(n, 546)]: { stars: 1 } });
            town.coins += income;
            totals.vip += income;
          }
          visitTown();
        }
        note();
        const delta = Object.fromEntries(
          Object.keys(totals).map((k) => [k, totals[k] - before[k]]),
        );
        ledger.push({ n, era: town.era, ...delta });
        if (n === 546 || n === townComplete || n === bothComplete)
          snapshots[n] = {
            stonesEarned: town.moonstonesEarned,
            sold,
            stored: town.moonstoneProduction.stored,
            totals: { ...totals },
            balance: town.coins,
          };
      }
      stoneSource = [...gemHistory.values()].reduce(
        (sum, gems) => sum + Math.floor(gems / moon.MOONSTONE_ECONOMY.continuousGemsPerPuzzle),
        0,
      );
      const windows = Object.fromEntries(
        [
          ['lateCampaign', ledger.filter((r) => r.n >= 403 && r.n <= 546)],
          ['twinHollows', ledger.filter((r) => r.n > eras['twin-hollows'] && r.n <= townComplete)],
        ].map(([name, rows]) => [
          name,
          {
            puzzles: rows.length,
            coinsPerPuzzle: Object.fromEntries(
              Object.keys(totals).map((k) => [
                k,
                rows.reduce((sum, r) => sum + r[k], 0) / rows.length,
              ]),
            ),
          },
        ]),
      );
      results.push({
        seed,
        pattern: pattern.id,
        eras,
        workshop,
        townComplete,
        bothPaid,
        bothComplete,
        purchases,
        reached,
        windows,
        snapshots,
        totals,
        stonesEarned: town.moonstonesEarned,
        sold,
        continuousPuzzleCredits: stoneSource,
        visits: [...visitHistory.values()].reduce((sum, n) => sum + n, 0),
        horizon: 2184,
      });
      process.stderr.write(
        `seed ${seed} ${pattern.id}: Twin ${eras['twin-hollows']}, town ${townComplete}, monuments ${bothComplete}\n`,
      );
    }
  }
  console.log(
    JSON.stringify(
      {
        boardSampleBase: '9d00d560',
        vipEconomyVersion: VIP_SPEND_VERSION,
        model:
          '546 levels; seeds 1–3; final chapter replays to 2184; zero hammers/chests/raid losses; coin foundations after progression; first-choice landmarks; paired moon upgrades; 20-move continuous samples repeated per visit; one fresh uninterrupted town hour/10 normals',
        results,
      },
      null,
      2,
    ),
  );
} finally {
  await loader.close();
}

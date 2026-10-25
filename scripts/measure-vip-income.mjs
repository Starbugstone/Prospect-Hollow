// Docker-only balance probe: authored transport schedules, VIP draws and tours.
// No crowd/geometry collisions, UI pauses or time in the mine: an active-town estimate.
// It measures the valley and New Hollow on the Moon, each for its own active hours
// (the valley rests while the Moon map is open).
import { createServer } from 'vite';
import { Group } from 'three';
import { loadValleyVipTour } from './vip-tour-harness.mjs';
const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true, entries: [] },
});
try {
  const load = (path) => server.ssrLoadModule(`/src/${path}.js`);
  const { createTown, BUILDINGS } = await load('data/town');
  const { vipVisitor } = await load('data/villagers');
  const { vipVisitCount, vipVisitBuildings, vipSpend, VIP_SPEND_VERSION } =
    await load('data/vipVisits');
  const { valleyVipTour, VILLAGER_WALK_SPEED } = await loadValleyVipTour(load);
  const { TownPrimitives } = await load('game/town/TownPrimitives');
  const { saloonIncomeRate } = await load('game/town/TownRules');
  const { arrivalSeed } = await load('data/visitorArrivals');
  const { MoonScene } = await load('game/town/moon/MoonScene');
  const { MoonVipArrivals, MOON_CLIMBER_CYCLE } = await load('game/town/moon/MoonVips');
  const { MOON_SAUCER_CYCLE } = await load('game/town/moon/MoonSaucer');
  const town = createTown();
  town.era = 'twin-hollows';
  for (const b of BUILDINGS) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = town.era;
    town.buildingEraLevels[b.id] = 3;
  }
  // The valley keeps its recorded 16 seeds; the Moon samples four times as many hours so
  // its smaller purchase count still compares closely with the valley's.
  const hours = 6,
    dt = 0.1;

  // Plays `hours` of one settlement's arrivals for each of `seeds`. `frame` publishes the
  // transports and runs the settlement's own VIP arrivals for one tick.
  function simulate(seeds, setup) {
    const totals = { hours: hours * seeds, purchases: 0, admitted: 0, potential: 0, schedules: {} };
    for (let seed = 0; seed < seeds; seed++) {
      const { arrivals, transports, frame } = setup(seed, totals);
      const seen = new Map();
      for (let tick = 0; tick < (hours * 3600) / dt; tick++) {
        const time = tick * dt;
        frame(time);
        for (const [id, state] of transports) {
          if (!state.arrived || seen.get(id) === state.visit) continue;
          seen.set(id, state.visit);
          totals.schedules[id] = (totals.schedules[id] ?? 0) + 1;
          if (vipVisitor(arrivalSeed(arrivals.seed, id), state.visit)) totals.potential++;
        }
      }
    }
    return totals;
  }
  const report = (totals) => ({
    activeHours: totals.hours,
    arrivalsPerHour: Object.fromEntries(
      Object.entries(totals.schedules).map(([id, n]) => [id, n / totals.hours]),
    ),
    vipDrawsPerHour: totals.potential / totals.hours,
    admittedVipsPerHour: totals.admitted / totals.hours,
    purchasesPerHour: totals.purchases / totals.hours,
  });

  // The valley: the production transport schedules, arrivals and street itineraries.
  const planStops = [0, 0, 0];
  const valley = simulate(16, (seed, totals) => {
    const tour = valleyVipTour({
      town,
      seed,
      dt,
      onAdmit: () => totals.admitted++,
      onPurchase: () => totals.purchases++,
    });
    for (const actor of tour.arrivals.actors)
      for (const plan of actor.itinerary?.plans ?? []) planStops[plan.stops.length]++;
    return tour;
  });

  // New Hollow: the Moon scene's own transports, VIP arrivals and suited tours, walked
  // at the settlers' pace along the Moon's public paths.
  const moonPlanStops = [0, 0, 0];
  const primitives = new TownPrimitives();
  const moon = simulate(64, (seed, totals) => {
    // The landing's climber, docked on its tower.
    const climber = new Group();
    new Group().add(climber);
    const scene = Object.assign(Object.create(MoonScene.prototype), {
      d: primitives,
      world: new Group(),
      town,
      elapsed: 0,
      visitorTransports: new Map(),
      climber,
      // At rest on its pad the saucer is in view; its arrivals follow its real cycle.
      saucer: { craft: { root: { visible: true } } },
      onVipSpend: () => totals.purchases++,
    });
    const dress = scene.setVillagerIdentity.bind(scene);
    scene.setVillagerIdentity = (actor, identity, outfitSeed) => {
      totals.admitted++;
      dress(actor, identity, outfitSeed);
    };
    scene.vipArrivals = new MoonVipArrivals(scene, seed * 7919 + 7);
    scene.vipArrivals.attach(town);
    for (const actor of scene.vipArrivals.actors)
      for (const plan of actor.itinerary.plans) moonPlanStops[plan.stops.length]++;
    return {
      arrivals: scene.vipArrivals,
      transports: scene.visitorTransports,
      frame(time) {
        scene.elapsed = time;
        scene.moveTransports(time);
        scene.vipArrivals.update();
      },
    };
  });

  const visitCounts = [0, 0, 0];
  for (let s = 0; s < 100000; s++) visitCounts[vipVisitCount(s)]++;
  const valleyPerHour = valley.purchases / valley.hours,
    moonPerHour = moon.purchases / moon.hours;
  const payouts = (purchases) =>
    [1, 30, 60, 91].map((chapter) => {
      const records = { [(chapter - 1) * 6 + 1]: { stars: 1 } };
      return {
        chapter,
        coinsPerPurchase: vipSpend(records),
        legacyPerHour: purchases * vipSpend(records, 0),
        beforePerHour: purchases * vipSpend(records, 1),
        afterPerHour: purchases * vipSpend(records),
      };
    });
  console.log(
    JSON.stringify(
      {
        model: `Active town hours (valley 96, Moon 384); real schedules, VIP admission and authored tours (valley ${VILLAGER_WALK_SPEED} units/s, Moon settler pace); excludes crowd/geometry collisions and interruptions`,
        vipEconomyVersion: VIP_SPEND_VERSION,
        visitCountDistribution: visitCounts.map((n) => n / 100000),
        saloonCoinsPerHour: saloonIncomeRate(town),
        valley: {
          eligibleBuildings: vipVisitBuildings(town, 'valley').length,
          ...report(valley),
          planStopDistribution: planStops,
          payouts: payouts(valleyPerHour),
        },
        moon: {
          eligibleBuildings: vipVisitBuildings(town, 'moon').length,
          climberCycleSeconds: MOON_CLIMBER_CYCLE,
          saucerCycleSeconds: MOON_SAUCER_CYCLE,
          ...report(moon),
          planStopDistribution: moonPlanStops,
          payouts: payouts(moonPerHour),
        },
        moonToValleyIncome: moonPerHour / valleyPerHour,
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}

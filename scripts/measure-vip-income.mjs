// Docker-only balance probe: authored transport schedules, VIP draws and tours.
// No crowd/geometry collisions, UI pauses or time in the mine: an active-town estimate.
// It measures the valley and New Hollow on the Moon, each for its own active hours
// (the valley rests while the Moon map is open).
import { createServer } from 'vite';
import { CurvePath, LineCurve3, Vector3, Group } from 'three';
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
  const { TownVipArrivals } = await load('game/town/TownVipArrivals');
  const { TownItineraries, updateItinerary } = await load('game/town/TownItineraries');
  const { TownNavigation, walkPath } = await load('game/town/TownNavigation');
  const { TownPrimitives } = await load('game/town/TownPrimitives');
  const { trainJourney, boatJourney } = await load('game/town/TownEraActivity');
  const { airplaneArrival } = await load('game/town/TownAviation');
  const { elevatorArrival } = await load('game/town/buildings/future');
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
  const journeys = {
    railDepot: trainJourney,
    riverPort: boatJourney,
    airport: airplaneArrival,
    spaceElevator: elevatorArrival,
  };
  const planStops = [0, 0, 0];
  const valley = simulate(16, (seed, totals) => {
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
        totals.admitted++;
      },
      onVipSpend: () => totals.purchases++,
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
    for (const actor of d.vipArrivals.actors) {
      for (const step of d.itineraries.prepare(actor)) void step;
      for (const plan of actor.itinerary?.plans ?? []) planStops[plan.stops.length]++;
    }
    return {
      arrivals: d.vipArrivals,
      transports: d.visitorTransports,
      frame(time) {
        d.elapsed = time;
        for (const [id, journey] of Object.entries(journeys))
          d.visitorTransports.set(id, { ...journey(time), root: { visible: true } });
        d.vipArrivals.update();
      },
    };
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
        model:
          'Active town hours (valley 96, Moon 384); real schedules, VIP admission and authored tours (valley 0.55 units/s, Moon settler pace); excludes crowd/geometry collisions and interruptions',
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

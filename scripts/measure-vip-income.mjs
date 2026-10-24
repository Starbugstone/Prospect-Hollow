// Docker-only balance probe: authored transport schedules, VIP draws and tours.
// No crowd/geometry collisions, UI pauses or time in the mine: an active-town estimate.
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
  const { vipVisitCount, vipVisitBuildings, vipSpend } = await load('data/vipVisits');
  const { TownVipArrivals } = await load('game/town/TownVipArrivals');
  const { TownItineraries, updateItinerary } = await load('game/town/TownItineraries');
  const { TownNavigation, walkPath } = await load('game/town/TownNavigation');
  const { trainJourney, boatJourney } = await load('game/town/TownEraActivity');
  const { airplaneArrival } = await load('game/town/TownAviation');
  const { elevatorArrival } = await load('game/town/buildings/future');
  const { saloonIncomeRate } = await load('game/town/TownRules');
  const { VISITOR_TRANSPORTS } = await load('data/visitorArrivals');
  const town = createTown();
  town.era = 'twin-hollows';
  for (const b of BUILDINGS) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = town.era;
    town.buildingEraLevels[b.id] = 3;
  }
  const journeys = {
    railDepot: trainJourney,
    riverPort: boatJourney,
    airport: airplaneArrival,
    spaceElevator: elevatorArrival,
  };
  const hours = 6,
    seeds = 16,
    dt = 0.1;
  let purchases = 0,
    admitted = 0,
    potential = 0;
  const schedules = {},
    stops = [0, 0, 0],
    planStops = [0, 0, 0];
  for (let seed = 0; seed < seeds; seed++) {
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
        admitted++;
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
    for (const actor of d.vipArrivals.actors) {
      for (const step of d.itineraries.prepare(actor)) void step;
      for (const plan of actor.itinerary?.plans ?? []) planStops[plan.stops.length]++;
    }
    const seen = new Map();
    for (let tick = 0; tick < (hours * 3600) / dt; tick++) {
      d.elapsed = tick * dt;
      for (const [id, journey] of Object.entries(journeys)) {
        const state = journey(d.elapsed);
        d.visitorTransports.set(id, { ...state, root: { visible: true } });
        if (state.arrived && seen.get(id) !== state.visit) {
          seen.set(id, state.visit);
          schedules[id] = (schedules[id] ?? 0) + 1;
          if (vipVisitor(d.vipArrivals.seed + VISITOR_TRANSPORTS.indexOf(id) * 101, state.visit))
            potential++;
        }
      }
      d.vipArrivals.update();
    }
  }
  for (let s = 0; s < 100000; s++) stops[vipVisitCount(s)]++;
  const perHour = purchases / (hours * seeds);
  console.log(
    JSON.stringify(
      {
        model:
          '96 active town hours; real schedules, VIP admission and authored tours at 0.55 units/s; excludes crowd/geometry collisions and interruptions',
        eligibleBuildings: vipVisitBuildings(town).length,
        arrivalsPerHour: Object.fromEntries(
          Object.entries(schedules).map(([id, n]) => [id, n / (hours * seeds)]),
        ),
        vipDrawsPerHour: potential / (hours * seeds),
        admittedVipsPerHour: admitted / (hours * seeds),
        visitCountDistribution: stops.map((n) => n / 100000),
        planStopDistribution: planStops,
        purchasesPerHour: perHour,
        saloonCoinsPerHour: saloonIncomeRate(town),
        payouts: [1, 30, 60, 91].map((chapter) => ({
          chapter,
          coinsPerPurchase: vipSpend({ [(chapter - 1) * 6 + 1]: { stars: 1 } }),
          beforePerHour: perHour * 5,
          afterPerHour: perHour * 5 * chapter,
        })),
      },
      null,
      2,
    ),
  );
} finally {
  await server.close();
}

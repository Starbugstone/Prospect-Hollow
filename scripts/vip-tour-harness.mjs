// The valley's VIP tour harness, shared by measure-vip-income.mjs and
// measure-economy-balance.mjs: the production transport schedules, VIP admission and
// authored street itineraries, walked at the villagers' pace. There are no crowd or
// geometry collisions and no UI pauses, so it estimates an active town.
import { CurvePath, LineCurve3, Vector3, Group } from 'three';

// `load(path)` imports `/src/<path>.js` through the caller's Vite SSR loader.
export async function loadValleyVipTour(load) {
  const { vipVisitor } = await load('data/villagers');
  const { TownVipArrivals } = await load('game/town/TownVipArrivals');
  const { TownItineraries, updateItinerary } = await load('game/town/TownItineraries');
  const { TownNavigation, walkPath } = await load('game/town/TownNavigation');
  const { VILLAGER_WALK_SPEED } = await load('game/town/TownGait');
  const { trainJourney, boatJourney } = await load('game/town/TownEraActivity');
  const { airplaneArrival } = await load('game/town/TownAviation');
  const { elevatorArrival } = await load('game/town/buildings/future');
  const journeys = {
    railDepot: trainJourney,
    riverPort: boatJourney,
    airport: airplaneArrival,
    spaceElevator: elevatorArrival,
  };

  // One run of `town`'s VIP arrivals for `seed`, ticking every `dt` seconds. Every VIP
  // is prepared before the first tick; `frame(time)` publishes the transports and runs
  // the arrivals once. `onAdmit` hears each admitted VIP and `onPurchase` each purchase.
  function valleyVipTour({ town, seed, dt, onAdmit = () => {}, onPurchase }) {
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
        onAdmit();
      },
      onVipSpend: () => onPurchase(),
      person: ({ route, seed, visitor }) => {
        const curve = new CurvePath();
        const points = route.map(([x, z]) => new Vector3(x, 0.07, z));
        points.push(...points.slice(1, -1).reverse(), points[0]);
        for (let i = 1; i < points.length; i++) curve.add(new LineCurve3(points[i - 1], points[i]));
        return {
          root: new Group(),
          curve,
          duration: curve.getLength() / VILLAGER_WALK_SPEED,
          seed,
          visitor,
          walkPath: walkPath(points.map((p) => p.toArray())),
          motion: { routeDistance: 0 },
        };
      },
      animatePerson: (actor) => {
        actor.motion ??= { routeDistance: 0 };
        updateItinerary(d, actor, d.elapsed);
        if (!actor.routeResting) actor.motion.routeDistance += VILLAGER_WALK_SPEED * dt;
      },
    };
    d.itineraries = new TownItineraries(d);
    d.vipArrivals = new TownVipArrivals(d, seed * 7919 + 7);
    d.vipArrivals.attach(town);
    for (const actor of d.vipArrivals.actors)
      for (const step of d.itineraries.prepare(actor)) void step;
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
  }
  return { valleyVipTour, VILLAGER_WALK_SPEED };
}

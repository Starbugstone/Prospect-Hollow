import { afterEach, expect, it, vi } from 'vitest';
import { Group, Scene, MeshBasicMaterial } from 'three';
import { createPinia, setActivePinia } from 'pinia';
import { createTown } from '../src/data/town';
import { ERAS, ERA_BY_ID } from '../src/data/eras';
import { vipVisitCount } from '../src/data/vipVisits';
import { TownItineraries, beginItinerary, updateItinerary } from '../src/game/town/TownItineraries';
import { TownNavigation, walkPath, townNavigation } from '../src/game/town/TownNavigation';
import { trafficRoutes, trafficTour } from '../src/game/town/TownTrafficRoutes';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { PLOTS } from '../src/game/town/TownLayout';
import { geometryFootprints, registerFootprints } from '../src/game/town/BuildingFootprints';
import { useCampaignStore } from '../src/stores/campaignStore';

const finish = (work) => {
  for (const _ of work) void _;
};
function fixture(era = 'motor-age') {
  const town = createTown();
  town.era = era;
  for (const id of [
    'home',
    'well',
    'farm',
    'stable',
    'saloon',
    'shop',
    'bank',
    'museum',
    'bridge',
    'hotel',
    'market',
    'library',
  ])
    town.buildings[id] = 1;
  const d = { town, elapsed: 0, navigation: new TownNavigation(), onVipSpend: vi.fn(), actors: [] };
  const root = new Group();
  root.userData.villager = { name: 'Guest' };
  root.position.set(-7, 0.07, 6.3);
  const actor = {
    root,
    visitor: true,
    transportVisitor: true,
    started: 0,
    seed: 2,
    duration: 50,
    source: 'saloon',
    walkPath: walkPath([
      [-7, 0.07, 6.3],
      [-7, 0.07, 7.5],
      [-7, 0.07, 6.3],
    ]),
  };
  d.vipArrivals = { actors: [actor] };
  d.itineraries = new TownItineraries(d);
  finish(d.itineraries.prepare(actor));
  return { d, actor };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
it('opens connected bridge routes only after completion and varies continuous vehicle trips', () => {
  const { d } = fixture();
  d.town.buildings.bridge = 0;
  let bank = new TownItineraries(d);
  expect(bank.leg([-7, 0.07, 7.5], [42, 0.07, 7.5])).toBeNull();
  d.town.buildings.bridge = 1;
  bank = d.itineraries = new TownItineraries(d);
  const crossing = bank.leg([-7, 0.07, 7.5], [42, 0.07, 7.5]);
  expect(crossing.points.some((p) => p[0] > 27 && p[0] < 35 && p[1] > 1)).toBe(true);
  const routes = trafficRoutes(d);
  expect(routes.length).toBeGreaterThan(2);
  expect(routes.some((r) => r.points.some((p) => p[0] > 38))).toBe(true);
  const car = new Group(),
    move = trafficTour(car, routes);
  move(0);
  let previous = car.position.clone();
  for (let frame = 1; frame < 60000; frame++) {
    move(frame / 30);
    expect(
      car.position.distanceTo(previous),
      JSON.stringify({ frame, previous, next: car.position }),
    ).toBeLessThan(0.16);
    previous.copy(car.position);
  }
});
it('visits two actual doorways, pays once after each indoor pause, returns without replanning', () => {
  const { d, actor } = fixture();
  expect(actor.itinerary.plans.length).toBeGreaterThan(1);
  actor.itinerary.plans = actor.itinerary.plans.filter((p) => p.stops.length === 2);
  expect(actor.itinerary.plans.length).toBeGreaterThan(0);
  actor.seed = Array.from({ length: 1000 }, (_, i) => i).find(
    (i) => vipVisitCount(i + 31337) === 2,
  );
  beginItinerary(d, actor);
  actor.root.position.fromArray(actor.walkPath.points[0]);
  const plans = d.navigation.plans;
  let previous = actor.root.position.clone(),
    hidden = false;
  for (let frame = 0; frame < 18000 && actor.started !== undefined; frame++) {
    d.elapsed = frame / 10;
    updateItinerary(d, actor, d.elapsed);
    updateTownLocomotion(d, 0.1);
    expect(actor.root.position.distanceTo(previous)).toBeLessThanOrEqual(0.056);
    if (actor.itinerary.phase === 'indoors') {
      hidden = true;
      const stop = actor.itinerary.stops[actor.itinerary.stop];
      expect(actor.motion.routeDistance).toBeCloseTo(stop.distance, 5);
      expect(actor.root.scale.x).toBe(0);
    }
    previous.copy(actor.root.position);
  }
  expect(hidden).toBe(true);
  expect(actor.started).toBeUndefined();
  expect(d.onVipSpend).toHaveBeenCalledTimes(2);
  expect(d.onVipSpend.mock.calls.map(([r]) => r.stop)).toEqual([0, 1]);
  expect(d.navigation.plans).toBe(plans);
  expect(
    actor.root.position.distanceTo(new Group().position.fromArray(actor.walkPath.points[0])),
  ).toBeLessThan(0.001);
});
it('does not pay ordinary guests, zero-stop VIPs, unfinished trips or a paused indoor guest', () => {
  const { d, actor } = fixture();
  actor.seed = Array.from({ length: 100 }, (_, i) => i).find((i) => vipVisitCount(i + 31337) === 0);
  beginItinerary(d, actor);
  expect(actor.itinerary.stops).toEqual([]);
  actor.root.userData.villager.name = null;
  beginItinerary(d, actor);
  expect(actor.itinerary.stops).toEqual([]);
  actor.root.userData.villager.name = 'Guest';
  actor.itinerary.stops = [{ building: 'saloon', distance: 1 }];
  actor.itinerary.phase = 'indoors';
  actor.itinerary.since = 0;
  d.paused = true;
  updateItinerary(d, actor, 100);
  expect(d.onVipSpend).not.toHaveBeenCalled();
});
it('keeps two-building visits very rare', () => {
  const counts = [0, 0, 0];
  for (let seed = 0; seed < 10000; seed++) counts[vipVisitCount(seed)]++;
  expect(counts[0]).toBeGreaterThan(4700);
  expect(counts[1]).toBeGreaterThan(4500);
  expect(counts[2]).toBeGreaterThan(100);
  expect(counts[2]).toBeLessThan(300);
});
it('persists automatic coins and receipts, rejects replay/invalid stops, rolls back failed saves', () => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => saved.get(k),
    setItem: (k, v) => saved.set(k, v),
  });
  setActivePinia(createPinia());
  let c = useCampaignStore();
  c.town.buildings.saloon = 1;
  const coins = c.town.coins;
  const receipt = { tour: 'unique-arrival', stop: 0, building: 'saloon' };
  expect(c.collectVipSpending(receipt)).toBe(5);
  expect(c.town.coins).toBe(coins + 5);
  expect(c.collectVipSpending(receipt)).toBe(0);
  expect(c.collectVipSpending({ ...receipt, stop: 2 })).toBe(0);
  expect(c.collectVipSpending({ ...receipt, stop: 1, building: 'hotel' })).toBe(0);
  setActivePinia(createPinia());
  c = useCampaignStore();
  expect(c.town.coins).toBe(coins + 5);
  expect(c.collectVipSpending(receipt)).toBe(0);
  vi.spyOn(c, 'save').mockReturnValue(false);
  expect(c.collectVipSpending({ ...receipt, stop: 1 })).toBe(0);
  expect(c.town.coins).toBe(coins + 5);
  expect(c.vipReceipts).toEqual(['unique-arrival:0']);
});
it.each([...ERAS.map((era) => era.id), 'unknown-era'])(
  'prepares complete, clear, varied routes around built structures in %s',
  (era) => {
    const { d, actor } = fixture(era);
    Object.setPrototypeOf(d, TownDiorama.prototype);
    Object.assign(d, {
      scene: new Scene(),
      world: new Group(),
      geometries: createTownGeometries(),
      materials: new Map(),
      contactShadowMaterial: new MeshBasicMaterial(),
      sign() {},
      plotCache: new Map(),
    });
    d.scene.add(d.world);
    try {
      for (const id of Object.keys(d.town.buildings).filter(
        (id) => d.town.buildings[id] && PLOTS[id] && id !== 'mine',
      )) {
        d.town.buildingEras[id] = era;
        d.town.buildingEraLevels[id] = 1;
        const group = d.group(d.world, PLOTS[id][0], 0.08, PLOTS[id][1]);
        group.userData.plot = id;
        d.buildPlot(id, group, d.town, { [id]: id });
        registerFootprints(group, geometryFootprints(group), { owner: `plot:${id}` });
        d.plotCache.set(id, { group });
      }
      d.navigation = townNavigation(d.world);
      actor.itinerary = undefined;
      actor.walkPath = walkPath([
        [-2.45, 0.07, 7.5],
        [-2.45, 0.07, -0.5],
        [-2.45, 0.07, 7.5],
      ]);
      d.itineraries = new TownItineraries(d);
      finish(d.itineraries.prepare(actor));
      expect(
        actor.itinerary?.plans.length ?? 0,
        JSON.stringify({
          clear: d.navigation.clear(actor.walkPath.points[0], 0.29),
          legs: [...d.itineraries.legs].filter(([, v]) => !v).map(([k]) => k),
        }),
      ).toBeGreaterThan(1);
      if (era !== 'frontier' && era !== 'unknown-era')
        expect(actor.itinerary.plans.some((plan) => plan.path.points.some((p) => p[0] > 38))).toBe(
          true,
        );
      for (const plan of actor.itinerary.plans) {
        expect(plan.path.points[0]).toEqual(plan.path.points.at(-1));
        plan.path.points.forEach((point, i) => {
          if (i) expect(d.navigation.segment(plan.path.points[i - 1], point, 0.29)).toBe(true);
        });
      }
    } finally {
      d.clearGroup(d.world);
      Object.values(d.geometries).forEach((g) => g.dispose());
      d.materials.forEach((m) => m.dispose());
      d.contactShadowMaterial.dispose();
    }
  },
);

it('uses the same connected tour contract for an added era', () => {
  const era = { ...ERAS.at(-1), id: 'test-tour-era' };
  ERAS.push(era);
  ERA_BY_ID[era.id] = era;
  try {
    const { d, actor } = fixture(era.id);
    expect(actor.itinerary.plans.length).toBeGreaterThan(1);
    expect(actor.itinerary.plans.some((p) => p.path.points.some((v) => v[0] > 38))).toBe(true);
    expect(trafficRoutes(d).length).toBeGreaterThan(1);
  } finally {
    ERAS.pop();
    delete ERA_BY_ID[era.id];
  }
});

import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import { eraEvolution } from '../src/data/eras';
import { moonApproaches } from '../src/data/moonSettlement';
import { villagerRandom, vipVisitor } from '../src/data/villagers';
import { VIP_MARKER, vipOutfit } from '../src/data/townWardrobes';
import { canVipSpend, vipSpend, vipVisitBuildings, vipVisitCount } from '../src/data/vipVisits';
import {
  MOON_VISITOR_TRANSPORTS,
  VISITOR_TRANSPORTS,
  arrivalSeed,
  hasVisitorTransport,
  visitorTransports,
} from '../src/data/visitorArrivals';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { hoverVillager, projectVillager } from '../src/game/town/TownLabelProjection';
import { MOON_CLIMBER, renderMoonBuilding } from '../src/game/town/buildings/moon';
import { MoonScene } from '../src/game/town/moon/MoonScene';
import { MOON_SAUCER_CYCLE, moonSaucerArrival } from '../src/game/town/moon/MoonSaucer';
import {
  moonHatch,
  moonSettlerBuildings,
  moonSuitFigure,
  strideMoonFigure,
} from '../src/game/town/moon/MoonSettlers';
import {
  MOON_CLIMBER_CYCLE,
  MoonVipArrivals,
  dressMoonVip,
  moonClimberArrival,
  moonClimberLift,
  moonVipFigure,
  moonVipTours,
} from '../src/game/town/moon/MoonVips';
import { useCampaignStore } from '../src/stores/campaignStore';

const MOON_SHOPS = ['newHollowCommons', 'moonstoneWorkshop', 'earthriseLookout'];
const STEP = 0.1;
const primitives = new TownPrimitives();
const flat = (point) => [point[0], point[2]];
const gap = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

// A finished Twin Hollows town: every valley and Moon building at its top level.
function fullTown(change = () => {}) {
  const town = createTown();
  town.era = 'twin-hollows';
  for (const building of BUILDINGS) {
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = town.era;
    town.buildingEraLevels[building.id] = 3;
  }
  change(town);
  return town;
}

// MoonScene needs WebGL; its VIP half runs on a bare prototype with the real transports,
// arrivals, tours and label projection.
function moonScene({ town = fullTown(), seed = 7, climber = true, saucer = true, ...rest } = {}) {
  const dock = new Group(),
    landing = new Group();
  dock.add(landing);
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    d: primitives,
    world: new Group(),
    town,
    elapsed: 0,
    visitorTransports: new Map(),
    climber: climber ? landing : null,
    saucer: { craft: saucer ? { root: new Group() } : null },
    camera: new PerspectiveCamera(48, 1, 0.1, 600),
    canvas: {
      clientWidth: 100,
      clientHeight: 100,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    },
    onVipSpend: vi.fn(),
    onVillagerLabel: vi.fn(),
    onSelect: vi.fn(),
    onEarth: vi.fn(),
    hitsEarth: () => false,
    pick: () => null,
    ...rest,
  });
  scene.vipArrivals = new MoonVipArrivals(scene, seed);
  scene.vipArrivals.attach(town);
  const frame = (time) => {
    scene.elapsed = time;
    scene.moveTransports(time);
    scene.vipArrivals.update();
  };
  return { scene, frame };
}
// The first arrival a fresh Moon view counts at each transport, and its visit number.
const FIRST_ARRIVAL = {
  ribbonLanding: { time: MOON_CLIMBER_CYCLE, visit: 1 },
  saucerPad: { time: 34, visit: 0 },
};
// The first tour, as the shared itinerary picks it: the plan and `vipVisitCount` stops.
function firstTour(town, source, seed) {
  const itinerarySeed = arrivalSeed(seed, source),
    tourSeed = itinerarySeed + 31337;
  const plans = moonVipTours(town, source, itinerarySeed);
  const plan = plans[Math.floor(villagerRandom(tourSeed) * plans.length)];
  return { plan, stops: plan.stops.slice(0, vipVisitCount(tourSeed)) };
}
function seedFor(source, accept = () => true) {
  const { visit } = FIRST_ARRIVAL[source];
  for (let seed = 0; seed < 20000; seed++)
    if (vipVisitor(arrivalSeed(seed, source), visit) && accept(seed)) return seed;
  throw new Error(`No VIP seed for ${source}`);
}
const touring = (scene) => scene.vipArrivals.actors.filter((actor) => actor.started !== undefined);
const hatches = (town) => moonApproaches(town.buildings).map((route) => flat(moonHatch(route)));
const nearestHatch = (town, root) =>
  Math.min(...hatches(town).map((hatch) => gap(hatch, [root.position.x, root.position.z])));

beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Moon VIP definitions', () => {
  it('registers the Moon transports beside the unchanged valley sources', () => {
    expect(VISITOR_TRANSPORTS).toEqual(['railDepot', 'riverPort', 'airport', 'spaceElevator']);
    expect(MOON_VISITOR_TRANSPORTS).toEqual(['ribbonLanding', 'saucerPad']);
    expect(visitorTransports('valley')).toEqual(VISITOR_TRANSPORTS);
    // A settlement without transports has none, rather than borrowing another's.
    expect(visitorTransports('mars')).toEqual([]);
    // Valley draws keep their seeds; Moon sources draw their own.
    VISITOR_TRANSPORTS.forEach((id, n) => expect(arrivalSeed(7, id)).toBe(7 + n * 101));
    const seeds = [...VISITOR_TRANSPORTS, ...MOON_VISITOR_TRANSPORTS].map((id) =>
      arrivalSeed(7, id),
    );
    expect(new Set(seeds).size).toBe(seeds.length);
    // Walking valley visitors still become VIPs whatever the Moon has built.
    const moonOnly = createTown();
    moonOnly.buildings.ribbonLanding = 1;
    moonOnly.buildings.saucerPad = 1;
    expect(hasVisitorTransport(moonOnly)).toBe(false);
  });

  it('lets VIPs spend in New Hollow’s commons, workshop and lookout, and the valley’s shops', () => {
    const town = fullTown();
    expect(vipVisitBuildings(town, 'valley')).toEqual([
      'saloon',
      'shop',
      'bank',
      'museum',
      'hotel',
      'market',
      'diner',
      'library',
      'concertHall',
      'supermarket',
      'doctor',
      'post',
      'cityHall',
    ]);
    expect(vipVisitBuildings(town, 'moon')).toEqual(MOON_SHOPS);
    expect(vipVisitBuildings(town)).toEqual([...vipVisitBuildings(town, 'valley'), ...MOON_SHOPS]);
    expect(vipVisitBuildings(town, 'mars')).toEqual([]);
    for (const id of MOON_SHOPS) expect(BUILDING_BY_ID[id].settlement).toBe('moon');
    for (const id of vipVisitBuildings(town, 'valley'))
      expect(BUILDING_BY_ID[id].settlement).toBeUndefined();
    // Unbuilt or under construction, a Moon shop takes no VIP.
    const pending = fullTown((t) => {
      t.buildings.moonstoneWorkshop = 0;
      t.projects.earthriseLookout = { id: 'earthriseLookout', stage: 1, wins: 0, required: 2 };
    });
    expect(vipVisitBuildings(pending, 'moon')).toEqual(['newHollowCommons']);
    // The server's catalog accepts the same buildings.
    const rules = JSON.parse(
      readFileSync(new URL('../backend/content/save-rules.json', import.meta.url), 'utf8'),
    );
    expect(rules.economy.vipBuildings).toEqual(vipVisitBuildings(town));
  });

  it('plans tours like the valley: a sightseeing lap, then shops first, hatch to hatch', () => {
    const town = fullTown();
    for (const source of MOON_VISITOR_TRANSPORTS) {
      const tours = moonVipTours(town, source, 11);
      expect(tours).toHaveLength(5);
      expect(tours[0].stops).toEqual([]);
      const hatch = flat(moonHatch(moonApproaches(town.buildings).find((r) => r.id === source)));
      for (const { path, stops } of tours) {
        expect(gap(flat(path.points[0]), hatch)).toBeLessThan(1e-9);
        expect(gap(flat(path.points.at(-1)), hatch)).toBeLessThan(1e-9);
        for (const stop of stops) {
          expect(MOON_SHOPS).toContain(stop.building);
          expect(stop.distance).toBeLessThan(path.total);
        }
      }
      // The places a VIP may spend come first, as in the valley.
      expect(tours[1].stops).toHaveLength(2);
    }
    // Fallbacks: a lone landing sends its VIP round the ring; no transport, no tours.
    const lone = fullTown((t) => {
      for (const id of Object.keys(t.buildings))
        if (BUILDING_BY_ID[id].settlement === 'moon') t.buildings[id] = 0;
      t.buildings.ribbonLanding = 1;
    });
    expect(moonSettlerBuildings(lone.buildings).map(({ id }) => id)).toEqual(['ribbonLanding']);
    const [lap] = moonVipTours(lone, 'ribbonLanding', 3);
    expect(moonVipTours(lone, 'ribbonLanding', 3)).toHaveLength(1);
    expect(lap.stops).toEqual([]);
    expect(lap.path.total).toBeGreaterThan(100);
    expect(moonVipTours(lone, 'saucerPad', 3)).toEqual([]);
    expect(moonScene({ town: lone }).scene.vipArrivals.actors.map((a) => a.source)).toEqual([
      'ribbonLanding',
    ]);
  });

  it('wears the settlers’ suit and stride with the valley VIP badge and outfit sash', () => {
    const parent = new Group();
    const vip = moonVipFigure(primitives, parent);
    const settler = moonSuitFigure(primitives, { parent });
    for (const distance of [0, 0.4, 1.7]) {
      strideMoonFigure(vip, distance);
      strideMoonFigure(settler, distance);
      for (const part of ['arms', 'legs'])
        vip[part].forEach((limb, n) => {
          expect(limb.upper.rotation.x).toBeCloseTo(settler[part][n].upper.rotation.x, 12);
          expect(limb.lower.rotation.x).toBeCloseTo(settler[part][n].lower.rotation.x, 12);
        });
      expect(vip.body.position.y).toBeCloseTo(settler.body.position.y, 12);
    }
    expect(vip.vip.visible).toBe(false);
    const badge = vip.root.getObjectByName('VIP gold badge');
    expect(`#${badge.material.color.getHexString()}`).toBe(VIP_MARKER.badge);
    const profile = eraEvolution('twin-hollows');
    dressMoonVip(primitives, vip, { name: 'Ada', gender: 'female', vip: true }, profile, 41);
    expect(vip.vip.visible).toBe(true);
    expect(`#${vip.sash.material.color.getHexString()}`).toBe(vipOutfit(profile, 41).accent);
    dressMoonVip(primitives, vip, { name: null, gender: 'male' }, profile);
    expect(vip.vip.visible).toBe(false);
  });

  it('brings climbers down the ribbon and publishes the saucer’s stay on its pad', () => {
    // The landing's climber stays out of the merged settlement so it can ride the ribbon.
    const lot = new Group();
    renderMoonBuilding(primitives, lot, 'ribbonLanding', 1);
    const climber = lot.getObjectByName(MOON_CLIMBER);
    expect(climber.userData.animated).toBe(true);
    expect(climber.children.length).toBeGreaterThan(0);
    expect(moonClimberLift(0)).toBe(0);
    expect(moonClimberLift(MOON_CLIMBER_CYCLE / 2)).toBeGreaterThan(100);
    expect(moonClimberArrival(MOON_CLIMBER_CYCLE + 1)).toMatchObject({ arrived: true, visit: 1 });
    expect(moonClimberArrival(MOON_CLIMBER_CYCLE / 2).arrived).toBe(false);
    expect(moonSaucerArrival(20).arrived).toBe(false);
    expect(moonSaucerArrival(40)).toMatchObject({ arrived: true, visit: 0 });
    expect(moonSaucerArrival(MOON_SAUCER_CYCLE + 69)).toMatchObject({ arrived: true, visit: 1 });
    expect(moonSaucerArrival(MOON_SAUCER_CYCLE + 71).arrived).toBe(false);
    const { scene } = moonScene();
    scene.moveTransports(MOON_CLIMBER_CYCLE / 2);
    expect(scene.climber.position.y).toBeGreaterThan(100);
    expect(scene.visitorTransports.get('ribbonLanding').root).toBe(scene.climber);
    scene.moveTransports(MOON_CLIMBER_CYCLE);
    expect(scene.climber.position.y).toBe(0);
    expect(scene.visitorTransports.get('ribbonLanding').arrived).toBe(true);
    // The climber is a vehicle: with reduced motion it rides on, as valley vehicles do,
    // and still brings its VIP. Only a landing settling under its reveal docks it.
    scene.reducedMotion = true;
    scene.moveTransports(MOON_CLIMBER_CYCLE / 2);
    expect(scene.climber.position.y).toBeGreaterThan(100);
    expect(scene.visitorTransports.get('ribbonLanding').root).toBe(scene.climber);
    scene.lotReveals = new Map([['ribbonLanding', {}]]);
    scene.moveTransports(MOON_CLIMBER_CYCLE / 2);
    expect(scene.climber.position.y).toBe(0);
    expect(scene.visitorTransports.has('ribbonLanding')).toBe(false);
  });
});

describe.each(MOON_VISITOR_TRANSPORTS)('a VIP arriving at the %s', (source) => {
  const other = { ribbonLanding: 'saucerPad', saucerPad: 'ribbonLanding' }[source];
  const town = fullTown();
  const seed = seedFor(source, (seed) => firstTour(town, source, seed).stops.length > 0);
  const setup = () =>
    moonScene({ town, seed, climber: source === 'ribbonLanding', saucer: source === 'saucerPad' });

  it('steps out of its hatch on arrival, shops through hatches and leaves by its transport', () => {
    const { scene, frame } = setup();
    const { time, visit } = FIRST_ARRIVAL[source];
    const actor = scene.vipArrivals.actors.find((a) => a.source === source);
    expect(scene.vipArrivals.actors.find((a) => a.source === other)?.started).toBeUndefined();
    let t = 0;
    for (; t < time - 0.5; t += STEP) frame(t);
    expect(touring(scene)).toEqual([]);
    for (; scene.vipArrivals.active === null && t < time + 1; t += STEP) frame(t);
    expect(scene.vipArrivals.active.actor).toBe(actor);
    expect(scene.visitorTransports.get(source)).toMatchObject({ arrived: true, visit });
    const identity = actor.root.userData.villager;
    expect(identity).toEqual(vipVisitor(arrivalSeed(seed, source), visit));
    expect(canVipSpend(identity)).toBe(true);
    expect(actor.vip.visible).toBe(true);
    expect(`#${actor.sash.material.color.getHexString()}`).toBe(
      vipOutfit(eraEvolution(town.era), seed + visit * 997).accent,
    );
    const expected = firstTour(town, source, seed);
    const hatch = flat(moonHatch(moonApproaches(town.buildings).find((r) => r.id === source)));
    const shops = new Set(expected.stops.map(({ building }) => building));
    const shopHatches = moonApproaches(town.buildings)
      .filter(({ id }) => shops.has(id))
      .map((route) => flat(moonHatch(route)));
    let visible = actor.root.visible,
      first = null,
      last = null,
      indoors = 0;
    for (; actor.started !== undefined && t < time + 600; t += STEP) {
      frame(t);
      const at = [actor.root.position.x, actor.root.position.z];
      if (actor.root.visible !== visible) {
        // Appearing and vanishing happen only in a doorway.
        expect(nearestHatch(town, actor.root), `${source} at ${t}`).toBeLessThan(0.05);
        visible = actor.root.visible;
      }
      if (actor.root.visible) {
        first ??= at;
        last = at;
      }
      if (actor.itinerary.phase === 'indoors') {
        // Hidden inside a shop, at its hatch.
        indoors++;
        expect(actor.root.visible).toBe(false);
        expect(Math.min(...shopHatches.map((h) => gap(h, at)))).toBeLessThan(0.05);
      }
    }
    expect(actor.started).toBeUndefined();
    expect(actor.root.visible).toBe(false);
    expect(indoors).toBeGreaterThan(0);
    expect(gap(first, hatch)).toBeLessThan(0.05);
    expect(gap(last, hatch)).toBeLessThan(0.05);
    // One purchase per stop the shared visit count allows, through the shared receipt.
    expect(scene.onVipSpend.mock.calls.map(([receipt]) => receipt)).toEqual(
      expected.stops.map(({ building }, stop) => ({
        tour: `${actor.root.uuid}:1`,
        stop,
        building,
        visitor: identity,
      })),
    );
  });

  it('names the VIP on tap or hover without moving the camera, and not indoors', () => {
    const { scene, frame } = setup();
    const actor = scene.vipArrivals.actors.find((a) => a.source === source);
    let t = 0;
    while ((actor.started === undefined || actor.itinerary.phase !== 'walking') && t < 600)
      frame((t += STEP));
    for (let n = 0; n < 20; n++) frame((t += STEP));
    const at = actor.root.position.clone();
    scene.camera.position.set(at.x + 4, at.y + 14, at.z + 14);
    scene.camera.lookAt(at);
    scene.camera.updateMatrixWorld();
    const camera = scene.camera.position.clone();
    const screen = at
      .clone()
      .add(new Vector3(0, 1, 0))
      .project(scene.camera);
    const tap = { clientX: (screen.x + 1) * 50, clientY: (1 - screen.y) * 50 };
    expect(scene.tap(tap)).toBeNull();
    expect(scene.onSelect).not.toHaveBeenCalled();
    expect(scene.namedVillager).toBe(actor);
    const label = scene.onVillagerLabel.mock.calls.at(-1)[0];
    expect(label).toMatchObject({ name: actor.root.userData.villager.name, live: false });
    expect(Math.abs(label.x - tap.clientX)).toBeLessThan(3);
    expect(scene.camera.position).toEqual(camera);
    // A tap on the same VIP again dismisses the name; hovering names them again.
    scene.tap(tap);
    expect(scene.onVillagerLabel).toHaveBeenLastCalledWith(null);
    vi.stubGlobal('requestAnimationFrame', (callback) => {
      callback();
      return 0;
    });
    // The pointer leaves, then hovers over the VIP.
    hoverVillager(scene, -Infinity, -Infinity);
    hoverVillager(scene, tap.clientX, tap.clientY);
    expect(scene.onVillagerLabel.mock.calls.at(-1)[0]).toMatchObject({
      name: actor.root.userData.villager.name,
    });
    // Inside a shop the VIP has no tag.
    while (actor.itinerary.phase !== 'indoors' && t < 900) frame((t += STEP));
    projectVillager(scene);
    expect(scene.onVillagerLabel).toHaveBeenLastCalledWith(null);
    expect(scene.camera.position).toEqual(camera);
  });
});

describe('the valley’s arrival rules on the Moon', () => {
  it('lets one arriving VIP tour at a time across both transports', () => {
    const town = fullTown();
    const { scene, frame } = moonScene({ town, seed: 3 });
    const sources = new Set(),
      seen = new Map();
    let refused = 0;
    for (let t = 0; t < 3 * 3600; t += STEP) {
      frame(t);
      const now = touring(scene);
      expect(now.length).toBeLessThanOrEqual(1);
      for (const actor of now) sources.add(actor.source);
      for (const [id, transport] of scene.visitorTransports) {
        if (!transport.arrived || seen.get(id) === transport.visit) continue;
        seen.set(id, transport.visit);
        // A VIP drawn while the other transport's VIP tours stays aboard.
        const drawn = vipVisitor(arrivalSeed(scene.vipArrivals.seed, id), transport.visit);
        if (drawn && now.some((actor) => actor.source !== id)) refused++;
      }
    }
    expect([...sources].sort()).toEqual(['ribbonLanding', 'saucerPad']);
    expect(refused).toBeGreaterThan(0);
    // Three simulated hours of frames: allow for a loaded machine.
  }, 30000);

  it('never counts an arrival already docked when the Moon opens, nor brings VIPs to a shared town', () => {
    const town = fullTown();
    // A climber is docked as the view opens, carrying a VIP: they stay aboard.
    const seed = seedFor('ribbonLanding', (seed) =>
      vipVisitor(arrivalSeed(seed, 'ribbonLanding'), 0),
    );
    const { scene, frame } = moonScene({ town, seed, saucer: false });
    for (let t = 0; t <= 3; t += STEP) frame(t);
    expect(touring(scene)).toEqual([]);
    frame(MOON_CLIMBER_CYCLE + 0.05);
    expect(touring(scene).map((actor) => actor.source)).toEqual(['ribbonLanding']);
    const shared = moonScene({ town, seed, vipsHidden: true });
    for (let t = 0; t < 1800; t += STEP) shared.frame(t);
    expect(shared.scene.onVipSpend).not.toHaveBeenCalled();
    expect(touring(shared.scene)).toEqual([]);
  });

  it('pays a Moon purchase through the valley’s campaign receipt, once', () => {
    const c = useCampaignStore();
    c.town = fullTown();
    c.records[541] = { score: 1000, stars: 1 };
    const amount = vipSpend(c.records);
    const coins = c.town.coins;
    const receipt = {
      tour: 'moon-tour',
      stop: 0,
      building: 'newHollowCommons',
      visitor: { name: 'Ada', vip: true },
    };
    expect(c.collectVipSpending(receipt)).toBe(amount);
    expect(c.town.coins).toBe(coins + amount);
    expect(c.integrity.actions.at(-1)).toMatchObject({
      kind: 'vip-spend',
      data: { key: 'moon-tour:0', buildingId: 'newHollowCommons', economyVersion: 2 },
    });
    expect(c.collectVipSpending(receipt)).toBe(0);
    // Not at a Moon building that is not a shop, unbuilt or under construction.
    expect(c.collectVipSpending({ ...receipt, tour: 'b', building: 'settlerDomes' })).toBe(0);
    c.town = { ...c.town, buildings: { ...c.town.buildings, moonstoneWorkshop: 0 } };
    expect(c.collectVipSpending({ ...receipt, tour: 'c', building: 'moonstoneWorkshop' })).toBe(0);
    // A real Moon tour's receipts pay through the same store.
    const source = 'saucerPad';
    const seed = seedFor(source, (seed) => firstTour(c.town, source, seed).stops.length > 0);
    const before = c.town.coins;
    const { scene, frame } = moonScene({
      town: c.town,
      seed,
      climber: false,
      onVipSpend: (spent) => c.collectVipSpending(spent),
    });
    const stops = firstTour(c.town, source, seed).stops.length;
    const actor = scene.vipArrivals.actors.find((a) => a.source === source);
    let t = 0;
    while (actor.started === undefined && t < 60) frame((t += STEP));
    while (actor.started !== undefined && t < 600) frame((t += STEP));
    expect(c.town.coins).toBe(before + stops * amount);
    expect(c.integrity.actions.filter(({ kind }) => kind === 'vip-spend')).toHaveLength(1 + stops);
    expect(scene.vipArrivals.actors.every((actor) => actor.started === undefined)).toBe(true);
  });

  it('sends Moon receipts and names to the valley’s spending flow and label', () => {
    const view = readFileSync(
      new URL('../src/components/town/TownMoonView.vue', import.meta.url),
      'utf8',
    );
    expect(view).toMatch(/onVipSpend: \(receipt\) => emit\('vip-spend', receipt\)/);
    expect(view).toMatch(/onVillagerLabel: \(label\) => emit\('villager-label', label\)/);
    expect(view).toMatch(/vipsHidden: props\.readOnly/);
    const scene = readFileSync(
      new URL('../src/components/town/TownScene.vue', import.meta.url),
      'utf8',
    );
    expect(scene).toMatch(/@vip-spend="emit\('vip-spend', \$event\)"/);
    expect(scene).toMatch(/@villager-label="showMoonVillagerLabel"/);
    expect(scene).toMatch(
      /showMoonVillagerLabel = \(label\) => moonOpen\.value && showVillagerLabel/,
    );
  });
});

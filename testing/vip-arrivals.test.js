import { TownNavigation, prepareActorWalk } from '../src/game/town/TownNavigation';
import { updateTownLocomotion } from '../src/game/town/TownLocomotion';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Group, Scene, MeshBasicMaterial, PerspectiveCamera, Vector3, Vector4 } from 'three';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownVipArrivals, VIP_INSET_SECONDS } from '../src/game/town/TownVipArrivals';
import { addEraActivity, trainJourney, boatJourney } from '../src/game/town/TownEraActivity';
import { addAviationActivity, airplaneArrival } from '../src/game/town/TownAviation';
import { renderEventInset } from '../src/game/town/TownEventCamera';
import { createTown } from '../src/data/town';
import { vipVisitor } from '../src/data/villagers';
import { VISITOR_TRANSPORTS } from '../src/data/visitorArrivals';
import { eventInsetRect, overlapsEventInset } from '../src/game/town/TownInset';
const fixtures = [];
it('keeps main-view labels clear of the arrival viewport and restores them when it closes', () => {
  const d = { canvas: { clientWidth: 1440, clientHeight: 648 }, eventInsetVisible: true };
  const rect = eventInsetRect(1440, 648);
  const top = 648 - rect.y - rect.height;
  expect(overlapsEventInset(d, rect.x + 20, top + 20, 160)).toBe(true);
  expect(overlapsEventInset(d, rect.x - 60, top - 30, 160)).toBe(true);
  expect(overlapsEventInset(d, 100, top + 20, 160)).toBe(false);
  d.eventInsetVisible = false;
  expect(overlapsEventInset(d, rect.x + 20, top + 20, 160)).toBe(false);
});
function fixture(source) {
  const d = Object.create(TownDiorama.prototype),
    town = createTown();
  town.era = 'aviation';
  Object.assign(town.buildings, {
    home: 3,
    farm: 3,
    well: 3,
    stable: 3,
    school: 3,
    post: 3,
    park: 3,
    [source]: 1,
  });
  const viewport = new Vector4(0, 0, 960, 600),
    scissor = viewport.clone();
  Object.assign(d, {
    town,
    elapsed: 0,
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    actors: [],
    motions: [],
    visitorTransports: new Map(),
    camera: new PerspectiveCamera(),
    controls: { enabled: true, target: new Vector3(2, 3, 4) },
    canvas: { clientWidth: 960, clientHeight: 600 },
    onEventInset: vi.fn(),
    renderer: {
      autoClear: false,
      getViewport: (out) => out.copy(viewport),
      getScissor: (out) => out.copy(scissor),
      getScissorTest: () => false,
      setViewport: vi.fn(),
      setScissor: vi.fn(),
      setScissorTest: vi.fn(),
      render: vi.fn(),
    },
  });
  d.scene.add(d.world);
  d.camera.position.set(30, 25, 40);
  addEraActivity(d, town);
  addAviationActivity(d, town);
  const journey = { railDepot: trainJourney, riverPort: boatJourney, airport: airplaneArrival }[
    source
  ];
  const arrival = Array.from({ length: 1000 }, (_, i) => i / 4).find(
    (t) => journey(t).arrived && journey(t).sinceArrival <= 0.25,
  );
  const visit = journey(arrival).visit;
  const seed = Array.from({ length: 100 }, (_, i) => i).find((seed) =>
    vipVisitor(seed + VISITOR_TRANSPORTS.indexOf(source) * 101, visit),
  );
  d.vipArrivals = new TownVipArrivals(d, seed);
  d.vipArrivals.attach(town);
  fixtures.push(d);
  const frame = (time) => {
    d.elapsed = time;
    d.motions.forEach((m) => m(time));
    d.vipArrivals.update();
  };
  return { d, frame, arrival };
}
afterEach(() => {
  for (const d of fixtures.splice(0)) {
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
    d.contactShadowMaterial.dispose();
  }
});
describe('passive VIP transport arrivals', () => {
  it.each(VISITOR_TRANSPORTS)(
    'starts at the real %s vehicle stop, wanders, and returns to its source',
    (source) => {
      const { d, frame, arrival } = fixture(source);
      frame(arrival - 0.5);
      expect(d.vipArrivals.active).toBeNull();
      frame(arrival);
      const { actor, vehicle } = d.vipArrivals.active;
      expect(actor.source).toBe(source);
      expect(vehicle.visible).toBe(true);
      expect(d.visitorTransports.get(source).arrived).toBe(true);
      expect(actor.root.userData.villager.name).toBeTruthy();
      const origin = actor.curve.getPointAt(0);
      frame(arrival + VIP_INSET_SECONDS + 0.1);
      expect(d.vipArrivals.active).toBeNull();
      expect(actor.root.visible).toBe(true);
      frame(arrival + actor.duration * 0.4);
      expect(actor.root.position.distanceTo(origin)).toBeGreaterThan(3);
      frame(arrival + actor.duration - 0.01);
      expect(actor.root.position.distanceTo(origin)).toBeLessThan(1.1);
      frame(arrival + actor.duration + 0.01);
      expect(actor.root.visible).toBe(false);
    },
  );
  it('renders the shared inset without changing the main camera, controls or renderer state', () => {
    const { d, frame, arrival } = fixture('riverPort');
    frame(arrival + 0.25);
    const position = d.camera.position.clone(),
      target = d.controls.target.clone();
    renderEventInset(d);
    expect(d.onEventInset).toHaveBeenLastCalledWith(
      expect.objectContaining({ passive: true, label: 'VIP visitor arriving' }),
    );
    const inset = d.onEventInset.mock.calls.at(-1)[0];
    expect(inset.nameTag.name).toBe(d.vipArrivals.active.actor.root.userData.villager.name);
    expect(inset.nameTag.x).toBeGreaterThanOrEqual(12);
    expect(inset.nameTag.x).toBeLessThanOrEqual(88);
    expect(inset.nameTag.y).toBeGreaterThanOrEqual(14);
    expect(inset.nameTag.y).toBeLessThanOrEqual(90);
    expect(d.renderer.render).toHaveBeenCalledWith(d.scene, d.vipArrivals.insetCamera);
    expect(d.controls.enabled).toBe(true);
    expect(d.controls.target).toEqual(target);
    expect(d.camera.position).toEqual(position);
    expect(d.eventCamera).toBeUndefined();
    expect(d.raid).toBeUndefined();
    expect(d.renderer.autoClear).toBe(false);
    expect(d.renderer.setScissorTest).toHaveBeenLastCalledWith(false);
    frame(arrival + VIP_INSET_SECONDS + 0.5);
    renderEventInset(d);
    expect(d.onEventInset).toHaveBeenLastCalledWith(null);
  });
  it('clears mine-entry visits and sometimes starts a fresh street visitor on return without replaying an arrival', () => {
    const { d, frame, arrival } = fixture('railDepot');
    frame(arrival);
    const old = d.vipArrivals.active.actor;
    d.vipArrivals.reset();
    expect(old.root.visible).toBe(false);
    expect(old.started).toBeUndefined();
    expect(d.vipArrivals.active).toBeNull();
    let present = 0;
    for (let n = 0; n < 200; n++) {
      d.vipArrivals.reset(true);
      expect(d.vipArrivals.active).toBeNull();
      present += d.vipArrivals.actors.filter((a) => a.root.visible).length;
      d.vipArrivals.update();
      expect(d.vipArrivals.active).toBeNull();
    }
    expect(present).toBeGreaterThan(25);
    expect(present).toBeLessThan(80);
  });
  it('requires a built visitor source and does not replay arrivals missed during an incident or late town load', () => {
    const { d, frame, arrival } = fixture('airport');
    d.raid = {};
    frame(arrival);
    expect(d.vipArrivals.active).toBeNull();
    d.raid = null;
    frame(arrival + 0.5);
    expect(d.vipArrivals.active).toBeNull();
    d.vipArrivals.seen.clear();
    frame(arrival + 5);
    expect(d.vipArrivals.active).toBeNull();
    d.town.buildings.airport = 0;
    d.vipArrivals.attach(d.town);
    expect(d.vipArrivals.actors).toHaveLength(0);
  });
});

it('routes airport guests around the completed lounge instead of through its added wing', () => {
  const { d } = fixture('airport');
  d.town.buildingEraLevels.airport = 3;
  d.vipArrivals.attach(d.town);
  const actor = d.vipArrivals.actors.find((actor) => actor.source === 'airport');
  for (let p = 0; p <= 1; p += 0.005) {
    const point = actor.curve.getPointAt(p);
    // Airport plot [-48,4]; stage-two lounge occupies local [1.5,7.5] × [2.35,4.85].
    const inside = point.x > -46.5 && point.x < -40.5 && point.z > 6.35 && point.z < 8.85;
    expect(inside, JSON.stringify(point)).toBe(false);
  }
});

it('finishes a delayed VIP trip at its source and starts the next arrival there', () => {
  const { d, frame, arrival } = fixture('railDepot');
  d.navigation = new TownNavigation([{ x: 1000, z: 1000, y: 0, height: 2, radius: 0.2 }]);
  for (const actor of d.vipArrivals.actors) prepareActorWalk(d, actor);
  frame(arrival);
  const actor = d.vipArrivals.active.actor;
  const origin = new Vector3(...actor.walkPath.points[0]);
  for (let i = 1; i <= 30; i++) {
    frame(arrival + i * 0.1);
    updateTownLocomotion(d, 0.1);
  }
  const before = actor.root.position.clone();
  d.reducedMotion = true;
  frame(arrival + actor.duration + 5);
  updateTownLocomotion(d, 0.1);
  expect(actor.root.visible).toBe(true);
  expect(actor.root.position.distanceTo(before)).toBeLessThan(1e-8);
  d.reducedMotion = false;
  let time = d.elapsed;
  for (let i = 0; i < 3000 && actor.started !== undefined; i++) {
    time += 0.1;
    // Advance this trip without admitting another scheduled passenger.
    d.elapsed = time;
    d.vipArrivals.update();
    updateTownLocomotion(d, 0.1);
  }
  expect(actor.started).toBeUndefined();
  expect(actor.root.position.distanceTo(origin)).toBeLessThan(0.1);
  // A fresh named arrival must not inherit the preceding visitor's movement clock.
  const transport = d.visitorTransports.get(actor.source);
  transport.visit = Array.from({ length: 100 }, (_, i) => i + transport.visit + 1).find((visit) =>
    vipVisitor(d.vipArrivals.seed, visit),
  );
  transport.arrived = true;
  transport.sinceArrival = 0;
  transport.root.visible = true;
  d.vipArrivals.update();
  expect(actor.started).toBe(d.elapsed);
  expect(actor.root.position.distanceTo(origin)).toBeLessThan(0.1);
  expect(actor.motion).toBeUndefined();
});

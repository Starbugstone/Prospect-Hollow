import { beginItinerary } from './TownItineraries';
import { prepareActorWalk } from './TownNavigation';
import { villagerIdentity } from '../../data/villagers';
import { guestVipIdentity } from '../../data/guestVip';
import { PerspectiveCamera, Vector3, Vector4 } from 'three';
import { VISITOR_TRANSPORTS, VISITOR_ARRIVAL_SITES } from '../../data/visitorArrivals';
import { visitorPopulation } from './TownRules';
import { LANE_X, PLOTS, plotStreet, routeBetween } from './TownLayout';
import { keepCameraAboveTerrain } from './TownLandscape';
import { eventInsetRect, drawCameraInset, hideEventInset } from './TownInset';

export const VIP_INSET_SECONDS = 6;
const GUEST = 'guest';
const GUEST_DESTINATIONS = ['saloon', 'hotel', 'museum', 'stable', 'square'];
export class TownVipArrivals {
  constructor(d, seed = Math.floor(Math.random() * 65536)) {
    this.d = d;
    this.seed = seed;
    this.seen = new Map();
    this.actors = [];
    this.active = null;
    this.insetCamera = new PerspectiveCamera(40, 1.5, 0.1, 400);
    this.insetCamera.layers.enable(2);
    this.viewport = new Vector4();
    this.scissor = new Vector4();
    this.focus = new Vector3();
  }
  attach(town) {
    this.actors = [];
    this.attachGuest(town);
    for (const id of visitorPopulation(town) > 0 ? VISITOR_TRANSPORTS : []) {
      if (!town.buildings[id]) continue;
      const retained = this.d.retainedVipActors?.get(id);
      if (retained) {
        this.d.retainedVipActors.delete(id);
        this.d.world.add(retained.root);
        prepareActorWalk(this.d, retained);
        this.actors.push(retained);
        continue;
      }
      const [x, z] = PLOTS[id];
      const site = VISITOR_ARRIVAL_SITES[id];
      const { destination, height } = site;
      const upgraded = (town.buildingEraLevels[id] || town.buildings[id]) >= 2;
      const approach = (upgraded && site.upgradedApproach) || site.approach;
      const streets = routeBetween(town, plotStreet(id), plotStreet(destination));
      const route = [...approach.map(([dx, dz]) => [x + dx, z + dz]), ...streets.slice(1)];
      const actor = this.d.person({
        manual: true,
        visitor: true,
        seed: 0,
        color: '#386f83',
        skin: '#d5ad88',
        hat: '#b9a778',
        route,
        linear: true,
      });
      actor.curve.curves[0].v1.y = height;
      actor.door = actor.curve.getPointAt(0);
      actor.transportVisitor = true;
      prepareActorWalk(this.d, actor);
      actor.source = id;
      actor.itinerarySeed = this.seed + VISITOR_TRANSPORTS.indexOf(id) * 101;
      actor.root.name = 'Arriving VIP visitor';
      actor.root.visible = false;
      this.actors.push(actor);
    }
    for (const actor of this.d.retainedVipActors?.values() ?? []) this.d.clearGroup(actor.root);
    this.d.retainedVipActors?.clear();
    if (this.active && !this.actors.includes(this.active.actor)) this.active = null;
  }
  // A guest already walking keeps touring through rebuilds, including the one caused by
  // marking them seen. Otherwise the save's unseen guest gets a fresh actor.
  attachGuest(town) {
    const retained = this.d.retainedVipActors?.get(GUEST);
    this.d.retainedVipActors?.delete(GUEST);
    if (retained?.started !== undefined) {
      this.d.world.add(retained.root);
      prepareActorWalk(this.d, retained);
      this.actors.push(retained);
      this.guest = { actor: retained, at: retained.guestAt, shown: true };
      return;
    }
    if (retained) this.d.clearGroup(retained.root);
    this.guest = null;
    this.syncGuest(town);
  }
  // The latest signed-in viewer of the owner's shared town, applied on reconnect, walks in
  // as a dedicated guest whatever the town's visitors or transport, without VIP spending.
  syncGuest(town, rebuild = false) {
    const visit = town?.guestVip;
    if (
      this.d.livePresenceEnabled ||
      this.d.vipsHidden ||
      !visit ||
      visit.seen ||
      this.guest?.at === visit.at
    )
      return;
    if (this.guest && !this.guest.shown) {
      this.actors.splice(this.actors.indexOf(this.guest.actor), 1);
      this.d.clearGroup(this.guest.actor.root);
    }
    const destination =
      GUEST_DESTINATIONS.find((id) => town.buildings[id] > 0 && !town.projects?.[id]) ?? 'square';
    const actor = this.d.person({
      manual: true,
      visitor: true,
      seed: 0,
      color: '#7b4f86',
      skin: '#c99b76',
      hat: '#d9c28a',
      route: [[-LANE_X, -0.5], [-LANE_X, 7.5], plotStreet(destination)],
      linear: true,
    });
    actor.door = actor.curve.getPointAt(0);
    actor.transportVisitor = true;
    actor.source = GUEST;
    actor.guestAt = visit.at;
    actor.itinerarySeed = this.seed + 977;
    actor.root.name = 'Guest VIP visitor';
    actor.root.visible = false;
    prepareActorWalk(this.d, actor);
    if (this.d.itineraries) for (const step of this.d.itineraries.prepare(actor)) void step;
    this.actors.push(actor);
    this.guest = { actor, at: visit.at, name: visit.name, shown: false };
    if (rebuild) this.d.rebuildActors?.();
  }
  reset(allowExisting = false) {
    this.active = null;
    this.seed = (this.seed + 104729) >>> 0;
    for (const actor of this.actors) {
      actor.started = undefined;
      actor.motion = undefined;
      actor.root.visible = false;
      actor.root.userData.villager.name = null;
    }
    for (const [id, transport] of this.d.visitorTransports ?? [])
      this.seen.set(id, transport.visit);
    for (const actor of this.d.actors ?? [])
      if (actor.visitor) {
        actor.seed += 101;
        actor.visit = undefined;
        actor.root.userData.villager.name = null;
      }
    this.d.namedVillager = null;
    this.d.onVillagerLabel?.(null);
    if (!this.d.raid && !this.d.eventCamera) hideEventInset(this.d);
    if (!allowExisting || !this.actors.length) return;
    // This visitor arrived off-screen while the player was mining. Start on
    // the outbound street leg; there is deliberately no arrival inset.
    const arrivals = this.actors.filter((actor) => actor.source !== GUEST);
    const guest = arrivals.length && this.d.drawVip(this.seed, 0);
    if (!guest) return;
    const actor = arrivals[this.seed % arrivals.length];
    this.d.setVillagerIdentity(actor, guest, this.seed);
    actor.started = this.d.elapsed - actor.duration * 0.3;
    if (actor.itinerary) {
      beginItinerary(this.d, actor);
      actor.started = this.d.elapsed;
    }
    actor.distance = 0;
    actor.lastPosition = null;
    actor.root.scale.setScalar(1);
    this.d.animatePerson(actor, actor.duration * 0.3);
    actor.root.visible = true;
  }
  blocked() {
    const d = this.d;
    return !!(
      d.raid ||
      d.eventCamera ||
      d.cinematic ||
      d.presentation ||
      d.paused ||
      d.motionEnabled === false
    );
  }
  update() {
    const d = this.d;
    if (d.lifeReady !== false) this.syncGuest(d.town, true);
    const guest = this.guest;
    if (guest && !guest.shown && guest.actor.started === undefined && !this.blocked()) {
      const { actor } = guest;
      d.setVillagerIdentity(
        actor,
        guestVipIdentity(guest, villagerIdentity(this.seed).gender),
        this.seed + 977,
      );
      actor.started = d.elapsed;
      actor.motion = undefined;
      actor.distance = 0;
      actor.lastPosition = null;
      actor.root.scale.setScalar(1);
      beginItinerary(d, actor);
      guest.shown = true;
      d.onGuestVip?.(guest.at);
    }
    for (const actor of this.actors) {
      const transport = d.visitorTransports?.get(actor.source);
      if (transport?.arrived && this.seen.get(actor.source) !== transport.visit) {
        this.seen.set(actor.source, transport.visit);
        // Never replay a missed arrival when returning from a modal/cinematic.
        // The 1s window also rejects loading a town halfway through a dwell.
        const guest = d.drawVip(
          this.seed + VISITOR_TRANSPORTS.indexOf(actor.source) * 101,
          transport.visit,
        );
        const anyVisitor = this.actors.some((a) => a.started !== undefined);
        if (
          guest &&
          !this.blocked() &&
          !anyVisitor &&
          transport.sinceArrival <= 1 &&
          transport.root.visible
        ) {
          d.setVillagerIdentity(actor, guest, this.seed + transport.visit * 997);
          actor.started = d.elapsed;
          actor.motion = undefined;
          actor.distance = 0;
          actor.lastPosition = null;
          beginItinerary(d, actor);
          this.active = { actor, vehicle: transport.root, started: d.elapsed };
        }
      }
      if (actor.started === undefined || d.paused) continue;
      const age = actor.motion?.animationTime ?? d.elapsed - actor.started;
      if ((!actor.itinerary && age >= actor.duration) || this.blocked()) {
        actor.root.visible = false;
        actor.started = undefined;
        if (this.active?.actor === actor) this.active = null;
        continue;
      }
      d.animatePerson(actor, actor.itinerary ? d.elapsed : age);
      if (actor.itinerary) continue;
      actor.root.scale.setScalar(
        Math.max(0, Math.min(1, age / 0.65, (actor.duration - age) / 0.65)),
      );
      actor.root.visible = actor.root.scale.x > 0;
    }
    if (this.active && d.elapsed - this.active.started >= VIP_INSET_SECONDS) this.active = null;
  }
  render() {
    if (!this.active || this.blocked()) return false;
    const d = this.d,
      { actor, vehicle, started } = this.active;
    const rect = eventInsetRect(d.canvas.clientWidth, d.canvas.clientHeight);
    if (!rect.width || !rect.height) return false;
    const camera = this.insetCamera;
    camera.aspect = rect.width / rect.height;
    camera.updateProjectionMatrix();
    this.focus.copy(actor.root.position).y += 0.8;
    // First establish the real vehicle at its stop, then follow the guest.
    const establish = Math.max(0, 1 - (d.elapsed - started) / 5);
    const vehiclePoint = vehicle.position.clone();
    this.focus.lerp(vehiclePoint, establish * 0.5);
    const distance = 12 + actor.root.position.distanceTo(vehiclePoint) * establish;
    const direction = VISITOR_ARRIVAL_SITES[actor.source].cameraDirection ?? [0.3, 0.65, 0.7];
    camera.position
      .copy(this.focus)
      .addScaledVector(new Vector3(...direction).normalize(), distance);
    keepCameraAboveTerrain(camera.position, this.focus);
    camera.lookAt(this.focus);
    camera.updateMatrixWorld();
    const namePoint = actor.root.position
      .clone()
      .add(new Vector3(0, 1.5, 0))
      .project(camera);
    const nameTag = {
      name: actor.root.userData.villager.name,
      x: Math.max(12, Math.min(88, (namePoint.x + 1) * 50)),
      y: Math.max(14, Math.min(90, (1 - namePoint.y) * 50)),
    };
    drawCameraInset(d, this, rect, 'VIP visitor arriving', true, { nameTag });
    return true;
  }
}

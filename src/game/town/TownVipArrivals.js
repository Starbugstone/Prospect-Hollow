import { prepareActorWalk } from './TownNavigation';
import { PerspectiveCamera, Vector3, Vector4 } from 'three';
import { vipVisitor } from '../../data/villagers';
import { VISITOR_TRANSPORTS, VISITOR_ARRIVAL_SITES } from '../../data/visitorArrivals';
import { visitorPopulation } from './TownRules';
import { PLOTS, plotStreet, routeBetween } from './TownLayout';
import { keepCameraAboveTerrain } from './TownLandscape';
import { eventInsetRect, drawCameraInset, hideEventInset } from './TownInset';

export const VIP_INSET_SECONDS = 6;
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
    if (visitorPopulation(town) <= 0) return;
    for (const id of VISITOR_TRANSPORTS) {
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
      actor.root.name = 'Arriving VIP visitor';
      actor.root.visible = false;
      this.actors.push(actor);
    }
    for (const actor of this.d.retainedVipActors?.values() ?? []) this.d.clearGroup(actor.root);
    this.d.retainedVipActors?.clear();
    if (this.active && !this.actors.includes(this.active.actor)) this.active = null;
  }
  reset(allowExisting = false) {
    this.active = null;
    this.seed = (this.seed + 104729) >>> 0;
    for (const actor of this.actors) {
      actor.started = undefined;
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
    const guest = vipVisitor(this.seed, 0);
    if (!guest) return;
    const actor = this.actors[this.seed % this.actors.length];
    this.d.setVillagerIdentity(actor, guest, this.seed);
    actor.started = this.d.elapsed - actor.duration * 0.3;
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
    for (const actor of this.actors) {
      const transport = d.visitorTransports?.get(actor.source);
      if (transport?.arrived && this.seen.get(actor.source) !== transport.visit) {
        this.seen.set(actor.source, transport.visit);
        // Never replay a missed arrival when returning from a modal/cinematic.
        // The 1s window also rejects loading a town halfway through a dwell.
        const guest = vipVisitor(
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
          actor.distance = 0;
          actor.lastPosition = null;
          this.active = { actor, vehicle: transport.root, started: d.elapsed };
        }
      }
      if (actor.started === undefined || d.paused) continue;
      const age = d.elapsed - actor.started;
      if (age >= actor.duration || this.blocked()) {
        actor.root.visible = false;
        actor.started = undefined;
        if (this.active?.actor === actor) this.active = null;
        continue;
      }
      d.animatePerson(actor, age);
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

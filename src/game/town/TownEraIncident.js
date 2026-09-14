import { routePose } from './TownRoutes';
import { motorVehicle } from './TownVehicles';
import { cityModel } from './buildings/city';
import { eventKind, incidentPhases, civicIncident } from '../../data/townEvents';
import { bridgeDeckHeight } from './TownRiver';
import { PLOTS, plotStreet, routeBetween } from './TownLayout';

export const INCIDENT_DURATION = 16;
export const INCIDENT_SPEED = 26 / INCIDENT_DURATION;
const ease = (value) => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};
// Uses the same paused village clock and saved receipt as Frontier encounters.
export class TownEraIncident {
  constructor(d, event, plots, onPhase, onComplete) {
    Object.assign(this, { d, event, onPhase, onComplete, started: d.elapsed });
    this.root = d.group(d.scene);
    this.root.name =
      eventKind(event) === 'storm-cleanup'
        ? 'City storm response'
        : eventKind(event) === 'workshop-fire'
          ? 'Workshop fire response'
          : 'Cargo theft response';
    this.target = event.targets.find((id) => PLOTS[id]) ?? 'blacksmith';
    const fire = eventKind(event) === 'workshop-fire',
      civic = civicIncident(eventKind(event));
    this.storm = eventKind(event) === 'storm-cleanup';
    this.responder = civic && d.town.buildings.fireStation ? 'fireStation' : 'sheriff';
    this.route = routeBetween(d.town, plotStreet(this.responder), plotStreet(this.target));
    if (this.route.length < 2) this.route = [plotStreet(this.target), plotStreet(this.target)];
    this.crew = Array.from({ length: 3 }, (_, seed) =>
      d.person({
        parent: this.root,
        manual: true,
        seed,
        color: civic ? '#677d80' : '#3d657c',
        skin: seed % 2 ? '#ad7d5b' : '#d5b08b',
        hat: civic ? '#c8ad67' : '#617b87',
        route: this.route,
      }),
    );
    if (fire || this.storm) {
      this.vehicle = { root: motorVehicle(d, this.root, true) };
      this.vehicle.root.name = this.storm ? 'City service vehicle' : 'Motor fire brigade';
      this.vehicle.root.userData.animated = true;
      d.box(this.vehicle.root, 0.5, 0.12, 0.7, 0, 1.45, 0, '#b76857');
      for (const x of [-0.18, 0.18])
        d.rod(this.vehicle.root, [x, 1.55, -0.6], [x, 1.55, 0.6], 0.035, '#dfd1ab');
    }
    this.props = d.group(this.root, PLOTS[this.target][0], 0, PLOTS[this.target][1] + 1.7);
    this.props.userData.animated = true;
    this.flames = fire
      ? Array.from({ length: 5 }, (_, n) =>
          d.ball(
            this.props,
            (n - 2) * 0.28,
            0.6,
            0,
            [0.22, 0.55, 0.22],
            n % 2 ? '#e5a05c' : '#f1ce7a',
            'rock',
          ),
        )
      : [];
    this.crates = !civic
      ? Array.from({ length: 3 }, (_, n) =>
          d.box(this.props, 0.45, 0.45, 0.45, (n - 1) * 0.6, 0.3, 0, '#b9986b'),
        )
      : [];
    this.thieves = !civic
      ? Array.from({ length: 2 }, (_, seed) => {
          const person = d.person({
            parent: this.root,
            manual: true,
            seed: seed + 4,
            color: '#77675d',
            skin: '#c09a77',
            hat: '#6b685e',
            route: this.route,
          });
          person.loot = d.box(person.root, 0.4, 0.35, 0.4, 0, 0.65, 0.3, '#b9986b');
          return person;
        })
      : [];
    if (this.storm) this.debris = cityModel(d, this.props, 'storm-debris');
    this.water = d.group(this.root);
    this.water.userData.animated = true;
    this.drops = fire
      ? Array.from({ length: 12 }, () => d.ball(this.water, 0, 0, 0, 0.075, '#a2d9dc'))
      : [];
    if (fire)
      for (const actor of this.crew)
        d.mesh(actor.arms[1].lower, 'cylinder', [0.14, 0.22, 0.14], [0, -0.25, 0], '#8baaa5');
    this.update(d.elapsed);
  }
  updateEvent(event) {
    this.event = event;
  }
  travel(actor, progress, offset = 0) {
    const lengths = this.route
      .slice(1)
      .map((p, i) => Math.hypot(p[0] - this.route[i][0], p[1] - this.route[i][1]));
    const distance =
      Math.max(0, Math.min(1, progress)) * lengths.reduce((sum, length) => sum + length, 0);
    const pose = routePose(this.route, distance);
    actor.root.position.set(pose.x, 0.07, pose.z);
    actor.root.rotation.y = pose.heading;
    actor.root.translateX(offset);
    if (
      actor.root.position.x >= 24 &&
      actor.root.position.x <= 38 &&
      Math.abs(actor.root.position.z - 7.5) < 0.7
    )
      actor.root.position.y = bridgeDeckHeight(actor.root.position.x) + 0.17;
  }
  update(elapsed) {
    if (this.disposed) return true;
    const time = (elapsed - this.started) * INCIDENT_SPEED,
      phase = incidentPhases(eventKind(this.event), time);
    if (phase !== this.phase) {
      this.phase = phase;
      this.onPhase(phase);
    }
    this.crew.forEach((actor, n) => {
      const progress = time < 14 ? (time - 4 - n * 0.5) / 9 : 1 - (time - 18 - n * 0.5) / 7;
      this.travel(actor, progress, (n - 1) * 0.35);
      actor.root.rotation.y += Math.PI * ease((time - 15) / 3);
      actor.root.visible = time >= 4 && progress > 0;
      const moving = progress > 0 && progress < 1;
      actor.legs.forEach((leg, i) => {
        leg.upper.rotation.x = moving
          ? Math.sin(time * 7 + i * Math.PI) *
            0.35 *
            Math.min(1, progress / 0.05, (1 - progress) / 0.05)
          : 0;
      });
      actor.arms.forEach((arm) => {
        arm.upper.rotation.x = !moving ? -ease(time - 13) * (1 - ease(time - 17)) : 0;
      });
    });
    if (this.vehicle) {
      const progress = time < 14 ? (time - 4) / 9 : 1 - (time - 18) / 7;
      this.travel(this.vehicle, progress);
      this.vehicle.root.rotation.y += Math.PI * ease((time - 15) / 3);
      this.vehicle.root.visible = time >= 4 && progress > 0;
      // Crew dismounts at the incident; passengers stay inside the vehicle en route.
      this.crew.forEach((actor) => {
        actor.root.visible = time >= 13 && time <= 18;
      });
    }
    this.flames.forEach((flame, n) => {
      const amount = time < 14 ? 1 : Math.max(0, 1 - (time - 14) / 4);
      flame.visible = amount > 0;
      flame.scale.y = (0.55 + Math.sin(time * 3 + n) * 0.08) * amount;
    });
    if (this.debris) this.debris.visible = time < 18;
    this.water.visible = time >= 13 && time < 18;
    this.drops.forEach((drop, n) => {
      const from = this.crew[1].root.position,
        to = this.props.position,
        amount = (time * 1.3 + n / 12) % 1;
      drop.position.set(
        from.x + (to.x - from.x) * amount,
        1 + Math.sin(amount * Math.PI) * 1.2,
        from.z + (to.z - from.z) * amount,
      );
    });
    this.thieves.forEach((actor, n) => {
      actor.loot.visible = this.event.loss > 0 || time < 14;
      actor.arms.forEach((arm, i) => {
        arm.upper.rotation.z = time >= 14 && this.event.loss === 0 ? (i ? -1.8 : 1.8) : 0;
      });
      this.travel(actor, time < 10 ? 1 : Math.max(0, 1 - (time - 10) / 9), (n ? -1 : 1) * 0.5);
      actor.root.rotation.y += Math.PI * ease(time - 9);
      actor.root.visible = time < 19;
      actor.legs.forEach((leg, i) => {
        leg.upper.rotation.x = time >= 10 ? Math.sin(time * 8 + i * Math.PI) * 0.4 : 0;
      });
    });
    if (time >= INCIDENT_DURATION * INCIDENT_SPEED) {
      this.dispose();
      this.onComplete();
      return true;
    }
    return false;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.d.clearGroup(this.root);
  }
}

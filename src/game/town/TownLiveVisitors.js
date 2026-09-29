import { ERA_BY_ID, FRONTIER_ERA } from '../../data/eras';
import { visitorLabel } from '../../data/liveVisitors';
import { villagerIdentity } from '../../data/villagers';
import { LANE_X, PLOTS, plotStreet, routeBetween } from './TownLayout';
import { prepareActorWalk } from './TownNavigation';

// Presence is transient scene state. It never enters town saves or VIP shopping
// itineraries, and it does not consume population/transport capacity.
const TRANSITION_SECONDS = 0.45;
const seedFor = (id) => {
  let seed = 0;
  for (const letter of String(id)) seed = (seed * 31 + letter.charCodeAt(0)) >>> 0;
  return seed % 65536;
};
const visitorEra = (entry, town) => {
  const era = entry.era || town.era;
  return Object.hasOwn(ERA_BY_ID, era) ? era : FRONTIER_ERA;
};

export class TownLiveVisitors {
  constructor(d) {
    this.d = d;
    this.entries = new Map();
    this.actors = [];
  }
  sync(entries = [], townKey = null) {
    const switched = this.townKey !== undefined && this.townKey !== townKey;
    this.townKey = townKey;
    if (switched) {
      // A town switch is not a departure animation in the new owner's scene.
      for (const actor of [...this.actors]) this.remove(actor);
      this.signature = null;
      this.d.rebuildActors?.();
    }
    this.entries = new Map(
      entries
        .filter((entry) => entry?.id !== undefined && entry?.id !== null)
        .map((entry) => [String(entry.id), entry]),
    );
    if (this.d.lifeReady !== false && this.d.town && this.signature !== this.appearanceSignature())
      this.attach();
  }
  appearanceSignature() {
    // Heartbeat timestamps and guestbook metadata do not change the scene.
    // Localized labels deliberately participate so a language change does.
    return JSON.stringify([
      !!this.d.liveVisitorsReducedMotion,
      this.d.motionEnabled === false,
      [...this.entries].map(([id, entry]) => [
        id,
        visitorLabel(entry),
        visitorEra(entry, this.d.town),
      ]),
    ]);
  }
  detach() {
    for (const actor of this.actors) actor.root.removeFromParent();
  }
  attach() {
    const d = this.d;
    const wanted = new Map([...this.entries]);
    for (const actor of [...this.actors]) {
      const entry = wanted.get(actor.liveId);
      if (entry && actor.appearance.era !== visitorEra(entry, d.town)) {
        this.remove(actor);
        continue;
      }
      d.world.add(actor.root);
      prepareActorWalk(d, actor);
      if (entry) {
        actor.leavingAt = undefined;
        this.identity(actor, entry);
        wanted.delete(actor.liveId);
      } else actor.leavingAt ??= d.elapsed;
    }
    for (const [id, entry] of wanted) {
      this.create(id, entry);
    }
    this.update();
    this.signature = this.appearanceSignature();
    d.rebuildActors?.();
    d.render?.();
  }
  identity(actor, entry) {
    this.d.setVillagerIdentity(actor, {
      ...villagerIdentity(actor.seed),
      name: visitorLabel(entry),
      guest: true,
      live: true,
    });
  }
  create(id, entry) {
    const d = this.d;
    const seed = seedFor(id);
    const destinations = Object.keys(d.town.buildings).filter(
      (key) => PLOTS[key] && d.town.buildings[key] > 0 && key !== 'mine',
    );
    const from = destinations[seed % destinations.length] || 'home';
    const to = destinations[(seed + 1) % destinations.length] || 'sheriff';
    let route = routeBetween(d.town, plotStreet(from), plotStreet(to));
    if (route.length < 2 || from === to)
      route = routeBetween(d.town, [-LANE_X, -0.5], [LANE_X, 7.5]);
    const actor = d.person({
      manual: true,
      visitor: true,
      liveVisitor: true,
      era: visitorEra(entry, d.town),
      seed,
      color: '#6e3f7d',
      skin: ['#d5ad88', '#9e7559', '#c99b76'][seed % 3],
      hat: '#d9b24c',
      route,
      linear: true,
    });
    actor.liveId = id;
    actor.arrivedAt = d.elapsed;
    actor.root.name = 'Live town visitor';
    this.identity(actor, entry);
    // Start somewhere along the safe street loop, never at a vehicle door.
    d.animatePerson(actor, d.elapsed);
    this.actors.push(actor);
  }
  update() {
    const d = this.d;
    const reduced = d.liveVisitorsReducedMotion || d.motionEnabled === false;
    const blocked = !!(d.raid || d.cinematic || d.presentation || d.eventCamera);
    let removed = false;
    for (const actor of [...this.actors]) {
      const leaving = actor.leavingAt !== undefined;
      const age = d.elapsed - (leaving ? actor.leavingAt : actor.arrivedAt);
      if (leaving && (reduced || age >= TRANSITION_SECONDS)) {
        this.remove(actor);
        removed = true;
        continue;
      }
      if (!reduced && !d.paused && !blocked) d.animatePerson(actor, d.elapsed);
      actor.root.visible = !blocked;
      actor.root.scale.setScalar(
        reduced
          ? 1
          : Math.max(
              0.001,
              Math.min(1, leaving ? 1 - age / TRANSITION_SECONDS : age / TRANSITION_SECONDS),
            ),
      );
    }
    if (removed) d.rebuildActors?.();
  }
  remove(actor) {
    this.actors.splice(this.actors.indexOf(actor), 1);
    if (this.d.namedVillager === actor) {
      this.d.namedVillager = null;
      this.d.onVillagerLabel?.(null);
    }
    this.d.clearGroup(actor.root);
  }
  dispose() {
    for (const actor of [...this.actors]) this.remove(actor);
    this.entries.clear();
  }
}

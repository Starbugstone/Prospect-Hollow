import { moonApproaches } from '../../../data/moonSettlement';
import { MOON_SETTLEMENT } from '../../../data/settlements';
import { vipVisitBuildings } from '../../../data/vipVisits';
import { villagerIdentity } from '../../../data/villagers';
import { MOON_VISITOR_TRANSPORTS, arrivalSeed } from '../../../data/visitorArrivals';
import { VIP_MARKER, vipOutfit } from '../../../data/townWardrobes';
import { CLIMB, climberArrival, climberRise } from '../TownClimbers';
import { TOUR_CHOICES, tourPairs, updateItinerary, visitOrder } from '../TownItineraries';
import { walkPath, walkPose } from '../TownNavigation';
import { visitorPopulation } from '../TownRules';
import { TownVipArrivals } from '../TownVipArrivals';
import {
  MOON_WALK_SPEED,
  moonHatch,
  moonSettlerBuildings,
  moonSettlerRoute,
  moonSuitFigure,
  strideMoonFigure,
} from './MoonSettlers';

// VIP visitors in New Hollow. They follow the valley's VIP rules through the valley's
// code: `TownVipArrivals` draws one VIP per transport arrival and lets one arriving VIP
// tour at a time; the shared itinerary walks their tour, takes them into shops for
// their `vipVisitCount` purchases and sends each receipt to `onVipSpend`. Only the
// figure (a Moon suit with the VIP marker) and the routes (the Moon's public paths,
// hatch to hatch) are the Moon's own.

// A climber rides the ribbon down to the landing and back. Every third valley climber
// trip reaches the Moon: New Hollow's tours are short, and this cadence keeps the Moon's
// VIP income per active hour below the valley's (docs/vip-economy.md).
export const MOON_CLIMBER_CYCLE = CLIMB.period * 3;
// How far up the ribbon a climber rides from its dock between trips.
const CLIMBER_TRAVEL = 120;
export const moonClimberArrival = (time) => climberArrival(time, MOON_CLIMBER_CYCLE);
export const moonClimberLift = (time) =>
  climberRise((((time / MOON_CLIMBER_CYCLE) % 1) + 1) % 1) * CLIMBER_TRAVEL;

/**
 * The tours a VIP may take from `source`, built like the valley's: first a sightseeing
 * walk (a lap of the ring road, as the valley's walk to a river overlook), then out of
 * the hatch to two places in the valley's visit order (where they may spend first) and
 * back. Each shop on the way is a stop the shared itinerary may enter.
 */
export function moonVipTours(town, source, seed) {
  const levels = town?.buildings ?? {};
  const from = moonApproaches(levels).find(({ id }) => id === source);
  if (!from) return [];
  const places = moonSettlerBuildings(levels).filter(({ id }) => id !== source);
  const byId = new Map(places.map((route) => [route.id, route]));
  const shops = new Set(vipVisitBuildings(town, MOON_SETTLEMENT));
  const ordered = visitOrder([...byId.keys()], seed, shops, true);
  const tours = [{ path: moonSettlerRoute(from, from).path, stops: [] }],
    seen = new Set();
  for (const ids of tourPairs(ordered)) {
    if (tours.length >= TOUR_CHOICES) break;
    if (seen.has(ids.join(':'))) continue;
    seen.add(ids.join(':'));
    const points = [],
      stops = [];
    let at = from,
      distance = 0;
    for (const to of [...ids.map((id) => byId.get(id)), from]) {
      const route = moonSettlerRoute(at, to);
      points.push(...route.points.slice(points.length ? 1 : 0));
      distance += route.length;
      if (shops.has(to.id)) stops.push({ building: to.id, distance });
      at = to;
    }
    tours.push({ path: walkPath(points), stops });
  }
  return tours;
}

/**
 * A suited VIP: the settlers' figure wearing the valley VIP's gold badge and a sash,
 * coloured from the shared VIP outfit when someone is drawn to wear it.
 */
export function moonVipFigure(d, parent) {
  const figure = moonSuitFigure(d, { parent });
  figure.root.name = 'New Hollow VIP visitor';
  const vip = d.group(figure.torso);
  vip.name = 'Honorary VIP visitor outfit';
  vip.visible = false;
  const sash = d.box(vip, 0.08, 0.55, 0.035, 0, 0.13, 0.135, VIP_MARKER.trim);
  sash.rotation.z = -0.58;
  sash.name = 'VIP visitor sash';
  const badge = d.box(vip, 0.1, 0.1, 0.035, -0.1, 0.27, 0.145, VIP_MARKER.badge);
  badge.rotation.z = Math.PI / 4;
  badge.name = 'VIP gold badge';
  return { ...figure, vip, sash };
}

/** Dress a Moon VIP figure for `identity`: the valley's VIP outfit picks the sash colour. */
export function dressMoonVip(d, actor, identity, profile, outfitSeed = 0) {
  actor.root.userData.villager = identity;
  actor.vip.visible = !!identity.name;
  if (!identity.name) {
    delete actor.root.userData.outfit;
    return;
  }
  const outfit = vipOutfit(profile, outfitSeed);
  actor.root.userData.outfit = outfit;
  actor.sash.material = d.material(outfit.accent);
}

function moonVipActor(scene, from, itinerarySeed) {
  const actor = moonVipFigure(scene.d, scene.world);
  actor.root.visible = false;
  actor.root.scale.setScalar(0);
  actor.root.userData.villager = villagerIdentity(0);
  return Object.assign(actor, {
    source: from.id,
    seed: 0,
    itinerarySeed,
    manual: true,
    visitor: true,
    transportVisitor: true,
    started: undefined,
    // Tours begin and end inside the transport's hatch.
    itinerary: {
      plans: [],
      anchor: moonHatch(from),
      door: true,
      inside: true,
      visit: 0,
      current: -1,
      since: null,
      phase: 'rest',
      stops: [],
    },
  });
}

const pose = {};
/**
 * One frame of a touring VIP: the shared itinerary decides when they walk, step through
 * a hatch or spend; they walk at the settlers' pace with the settlers' stride.
 */
export function animateMoonVip(d, actor, time) {
  const motion = (actor.motion ??= { routeDistance: 0, animationTime: 0 });
  const step = Math.max(0, Math.min(0.25, time - (motion.time ?? time)));
  motion.time = time;
  if (!actor.routeResting)
    motion.routeDistance = Math.min(
      actor.routeLimit ?? Infinity,
      motion.routeDistance + MOON_WALK_SPEED * step,
    );
  const path = actor.walkPath;
  if (path?.total) {
    walkPose(path, motion.routeDistance / path.total, pose);
    actor.root.position.set(pose.x, pose.y, pose.z);
    actor.root.rotation.y = pose.heading;
  }
  updateItinerary(d, actor, time);
  strideMoonFigure(actor, motion.routeDistance, !actor.routeResting);
}

/** New Hollow's VIP arrivals: the valley's arrival rules on the Moon's own transports. */
export class MoonVipArrivals extends TownVipArrivals {
  constructor(scene, seed) {
    super(scene, seed);
    this.sighted = new Set();
  }
  // One suited VIP per built transport. A VIP on tour keeps walking through rebuilds;
  // the next tour reads the town as it is then.
  attach(town) {
    const scene = this.d;
    const kept = new Map(this.actors.map((actor) => [actor.source, actor]));
    const routes = new Map(moonApproaches(town?.buildings ?? {}).map((route) => [route.id, route]));
    const sources =
      town && visitorPopulation(town) > 0
        ? MOON_VISITOR_TRANSPORTS.filter((id) => routes.has(id))
        : [];
    this.actors = sources.map((id) => {
      const actor = kept.get(id) ?? moonVipActor(scene, routes.get(id), arrivalSeed(this.seed, id));
      kept.delete(id);
      actor.itinerary.plans = moonVipTours(town, id, actor.itinerarySeed);
      return actor;
    });
    for (const actor of kept.values()) scene.d.clearGroup(actor.root);
    if (this.active && !this.actors.includes(this.active.actor)) this.active = null;
  }
  // The share-link guest walks into the valley only.
  syncGuest() {}
  update() {
    for (const actor of this.actors) if (actor.started === undefined) actor.itinerary.inside = true;
    // A transport already at its stop when first seen (the Moon opened during a dwell)
    // brings nobody then: only its next arrival counts.
    for (const [id, transport] of this.d.visitorTransports ?? []) {
      if (this.sighted.has(id)) continue;
      this.sighted.add(id);
      if (transport.arrived) this.seen.set(id, transport.visit);
    }
    super.update();
  }
  dispose() {
    for (const actor of this.actors) this.d.d.clearGroup(actor.root);
    this.actors = [];
    this.active = null;
  }
}

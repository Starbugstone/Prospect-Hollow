import { ERA_BY_ID, FRONTIER_ERA } from '../../data/eras';
import { PLOTS, plotStreet, routeGraph, routeOnGraph } from './TownLayout';
import { walkPath } from './TownNavigation';
import { bridgeDeckHeight } from './TownRiver';
import { villagerRandom, vipVisitor, villagerIdentity } from '../../data/villagers';
import { hasVisitorTransport } from '../../data/visitorArrivals';
import { vipVisitBuildings, vipVisitCount } from '../../data/vipVisits';

const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
export const streetHeight = (x, z) => {
  if (x < 23 || x > 39 || Math.abs(z - 7.5) >= 1.5) return 0.07;
  const blend = Math.min(1, x - 23, 39 - x, (1.5 - Math.abs(z - 7.5)) * 2);
  return 0.07 + (bridgeDeckHeight(x) + 0.1) * blend * blend * (3 - 2 * blend);
};

// One graph and memoized legs per town snapshot. Compilation is driven by the
// staged population generator, never by the animation loop or a coin update.
export class TownItineraries {
  constructor(d) {
    this.d = d;
    this.graph = routeGraph(ERA_BY_ID[d.town.era] ? d.town : { ...d.town, era: FRONTIER_ERA });
    this.nodes = [...this.graph.nodes.values()];
    this.destinations = Object.keys(PLOTS).filter(
      (id) =>
        d.town.buildings[id] > 0 &&
        !d.town.projects?.[id] &&
        this.graph.nodes.has(plotStreet(id).join(',')),
    );
    this.shops = new Set(vipVisitBuildings(d.town));
    this.legs = new Map();
    this.detours = new Map();
    this.bridgeLane =
      [0.7, 0.5, 0.3, 0].find((lane) => {
        for (const side of [1, -1]) {
          let previous;
          for (let i = 0; i <= 70; i++) {
            const x = 24 + i * 0.2,
              z = 7.5 + side * lane;
            const point = [x, streetHeight(x, z), z];
            if (previous && d.navigation && !d.navigation.segment(previous, point, 0.29))
              return false;
            previous = point;
          }
        }
        return true;
      }) ?? 0;
  }
  nearest(point) {
    return this.nodes.reduce(
      (best, p) =>
        !best ||
        Math.hypot(p[0] - point[0], p[1] - point[2]) <
          Math.hypot(best[0] - point[0], best[1] - point[2])
          ? p
          : best,
      null,
    );
  }
  endpoint(id, enter = false) {
    const street = plotStreet(id);
    if (enter) {
      const anchors = this.d.plotCache?.get(id)?.group.userData.navigationAnchors?.door ?? [];
      const door = anchors.find((p) => !this.d.navigation || this.d.navigation.clear(p, 0.29));
      if (door) return door;
      const [x, z] = PLOTS[id];
      for (const y of [0.07, 0.15, 0.25, 0.35]) {
        const point = [x, y, z + 2.3];
        if (!this.d.navigation || this.d.navigation.clear(point, 0.29)) return point;
      }
      return null;
    }
    const point = [street[0], streetHeight(street[0], street[1] + 1.05), street[1] + 1.05];
    return this.d.navigation?.safePoint(point, 0.29) ?? point;
  }

  leg(from, to) {
    const key = `${from.join(',')}:${to.join(',')}`;
    const direct = this.directLeg(from, to);
    if (direct) return direct;
    if (this.detours.has(key)) return this.detours.get(key);
    // A dense junction can leave opposite sidewalks connected through a nearby
    // frontage. Compose already-verified legs instead of searching while moving.
    const hubs = this.destinations
      .filter((id) => this.shops.has(id))
      .map((id) => this.endpoint(id, true))
      .filter(Boolean)
      .filter((p) => gap(p, from) > 1 && gap(p, to) > 1)
      .sort((a, b) => gap(from, a) + gap(a, to) - gap(from, b) - gap(b, to));
    for (const hub of hubs.slice(0, 6)) {
      const a = this.directLeg(from, hub);
      if (!a) continue;
      const b = this.directLeg(hub, to);
      if (!b) continue;
      const path = walkPath([...a.points, ...b.points.slice(1)]);
      this.d.navigation?.track?.(path, 0.29);
      this.detours.set(key, path);
      return path;
    }
    this.detours.set(key, null);
    return null;
  }
  directLeg(from, to) {
    const key = `${from.join(',')}:${to.join(',')}`;
    if (this.legs.has(key)) return this.legs.get(key);
    const start = this.nearest(from),
      end = this.nearest(to);
    const road = start && end && routeOnGraph(this.graph, start, end);
    if (!road?.length) return null;
    for (const side of [1, -1]) {
      const points = [from];
      for (let i = 0; i < road.length; i++) {
        const p = road[i],
          before = road[i - 1] ?? road[i + 1],
          after = road[i + 1] ?? before;
        const vertical = before?.[0] === p[0] || after?.[0] === p[0];
        const horizontal = before?.[1] === p[1] || after?.[1] === p[1];
        const bridge = p[0] >= 24 && p[0] <= 38 && p[1] === 7.5;
        const x = p[0] + (vertical && !bridge ? side * 1.05 : 0),
          z = p[1] + (horizontal ? side * (bridge ? this.bridgeLane : 1.05) : 0);
        const previous = points.at(-1);
        // Sample the bridge grade; straight endpoints would walk through its deck.
        const onBridge =
          Math.max(x, previous[0]) >= 23 &&
          Math.min(x, previous[0]) <= 39 &&
          Math.min(Math.abs(z - 7.5), Math.abs(previous[2] - 7.5)) < 1.5;
        const count = onBridge
          ? Math.max(1, Math.ceil(Math.hypot(x - previous[0], z - previous[2]) / 0.6))
          : 1;
        for (let n = 1; n <= count; n++) {
          const px = previous[0] + ((x - previous[0]) * n) / count;
          const pz = previous[2] + ((z - previous[2]) * n) / count;
          points.push([px, streetHeight(px, pz), pz]);
        }
      }
      if (points.length > 1) {
        points[1][1] = Math.max(points[1][1], from[1]);
        points.at(-1)[1] = Math.max(points.at(-1)[1], to[1]);
      }
      points.push(to);
      const path = this.d.navigation?.plan(points, 0.29) ?? walkPath(points);
      // Planning may return a prefix. Never call its endpoint a doorway.
      if (
        path.total > 0 &&
        gap(path.points[0], from) < 0.05 &&
        gap(path.points.at(-1), to) < 0.05
      ) {
        this.legs.set(key, path);
        const reverse = walkPath([...path.points].reverse());
        this.d.navigation?.track?.(reverse, 0.29);
        this.legs.set(`${to.join(',')}:${from.join(',')}`, reverse);
        return path;
      }
    }
    this.legs.set(key, null);
    return null;
  }
  *prepare(actor) {
    if (actor.work || (actor.manual && !actor.transportVisitor) || !actor.walkPath?.points.length)
      return;
    const anchor = actor.itinerary?.anchor ?? actor.walkPath.points[0];
    const plans = [];
    const seen = new Set();
    const options = this.destinations.filter((id) => id !== actor.source);
    // Spread destinations across districts, including the far bank when connected.
    const seed = actor.itinerarySeed ?? actor.seed;
    const ordered = [...options].sort(
      (a, b) =>
        villagerRandom(seed + options.indexOf(a) * 719) -
        villagerRandom(seed + options.indexOf(b) * 719),
    );
    if (actor.visitor)
      ordered.sort((a, b) => Number(this.shops.has(b)) - Number(this.shops.has(a)));
    const farBank = ordered
      .filter(
        (id) =>
          (anchor[0] < 24 ? PLOTS[id][0] > 38 : PLOTS[id][0] < 24) &&
          (!actor.visitor || this.shops.has(id)),
      )
      .sort(
        (a, b) =>
          Math.abs(PLOTS[a][0] - 31) +
          Math.abs(PLOTS[a][1] - 7.5) -
          Math.abs(PLOTS[b][0] - 31) -
          Math.abs(PLOTS[b][1] - 7.5),
      )[0];
    if (farBank) ordered.unshift(...ordered.splice(ordered.indexOf(farBank), 1));
    // Keep a cross-river sightseeing option even when the first far-bank
    // commercial doorway is temporarily unavailable.
    const overlooks = options.filter((id) =>
      anchor[0] < 24 ? PLOTS[id][0] > 38 : PLOTS[id][0] < 24,
    );
    for (const id of overlooks.slice(0, 3)) {
      const destination = this.endpoint(id);
      const leg = destination && this.leg(anchor, destination);
      if (leg?.total) {
        const path = walkPath([...leg.points, ...leg.points.slice(0, -1).reverse()]);
        this.d.navigation?.track?.(path, 0.29);
        plans.push({ path, stops: [] });
        yield;
        break;
      }
      yield;
    }
    for (let n = 0; n < Math.min(12, ordered.length) && plans.length < 5; n++) {
      const ids = [ordered[n], ordered[(n + 1) % ordered.length]].filter(
        (id, i, all) => all.indexOf(id) === i,
      );
      const points = [anchor],
        stops = [],
        visited = [];
      let total = 0;
      for (const id of ids) {
        const enter = id && this.shops.has(id);
        const to = id ? this.endpoint(id, enter) : anchor;
        const leg = to && this.leg(points.at(-1), to);
        if (!leg) continue;
        points.push(...leg.points.slice(1));
        total += leg.total;
        visited.push(id);
        if (enter) stops.push({ building: id, distance: total });
      }
      const signature = visited.join(':');
      if (total > 2 && !seen.has(signature)) {
        seen.add(signature);
        const path = walkPath([...points, ...points.slice(0, -1).reverse()]);
        this.d.navigation?.track?.(path, 0.29);
        plans.push({ path, stops });
      }
      yield;
    }
    if (!plans.length) return;
    if (actor.itinerary) {
      actor.itinerary.plans = plans;
      if (actor.itinerary.path !== actor.walkPath) {
        actor.itinerary.path = actor.walkPath;
        actor.itinerary.stops = [];
        actor.itinerary.phase = 'finishing';
        const distance = actor.motion?.routeDistance ?? 0;
        actor.routeLimit =
          Math.max(1, Math.ceil(distance / actor.walkPath.total)) * actor.walkPath.total;
        actor.root.scale.setScalar(1);
      }
      return;
    }
    actor.itinerary = {
      plans,
      anchor,
      visit: 0,
      current: -1,
      since: null,
      phase: 'walking',
      stops: [],
    };
    // Existing actors finish their current route before adopting a new journey.
    if (actor.motion) {
      actor.itinerary.path = actor.walkPath;
      actor.itinerary.phase = 'finishing';
      actor.routeLimit =
        Math.ceil(actor.motion.routeDistance / (actor.walkPath.total || 1)) * actor.walkPath.total;
    } else if (!actor.transportVisitor) beginItinerary(this.d, actor);
  }
}

export function beginItinerary(d, actor) {
  const r = actor.itinerary;
  if (!r?.plans.length) return false;
  const seed = (actor.itinerarySeed ?? actor.seed) + ++r.visit * 31337;
  let index = Math.floor(villagerRandom(seed) * r.plans.length);
  if (r.plans.length > 1 && index === r.current) index = (index + 1) % r.plans.length;
  r.current = index;
  const plan = r.plans[index];
  r.path = actor.walkPath = plan.path;
  r.phase = 'walking';
  r.since = d.elapsed;
  r.stop = 0;
  r.tour = `${actor.root.uuid}:${r.visit}`;
  if (actor.visitor && !actor.transportVisitor) {
    const guest = hasVisitorTransport(d.town) ? null : vipVisitor(actor.seed, r.visit);
    d.setVillagerIdentity(actor, guest ?? villagerIdentity(actor.seed), seed);
  }
  const count = actor.root.userData.villager?.name ? vipVisitCount(seed) : 0;
  r.stops = plan.stops.slice(0, count);
  actor.routeProgress = 0;
  actor.routeResting = false;
  actor.routeLimit = r.stops[0]?.distance ?? plan.path.total;
  actor.root.visible = true;
  actor.root.scale.setScalar(1);
  if (actor.motion) {
    actor.motion.path = plan.path;
    actor.motion.routeDistance = 0;
    actor.motion.animationTime = 0;
  }
  return true;
}

// Travel ends on accepted distance, not elapsed time: a yielding guest cannot
// disappear mid-street. Only the indoor pause uses the village clock.
export function updateItinerary(d, actor, time) {
  const r = actor.itinerary;
  if (!r || (actor.transportVisitor && actor.started === undefined)) return;
  if (d.paused || d.cinematic || d.presentation || d.motionEnabled === false) return;
  const distance = actor.motion?.routeDistance ?? 0;
  if ((r.phase === 'walking' || r.phase === 'finishing') && distance >= actor.routeLimit - 1e-5) {
    r.phase = r.stops[r.stop] && r.phase !== 'finishing' ? 'entering' : 'rest';
    r.since = time;
    r.pause = 2 + villagerRandom(actor.seed + r.visit * 701) * 6;
  }
  actor.routeResting = r.phase !== 'walking' && r.phase !== 'finishing';
  const age = time - r.since;
  if (r.phase === 'entering') {
    actor.root.scale.setScalar(Math.max(0, 1 - age / 0.35));
    if (age >= 0.35) {
      r.phase = 'indoors';
      r.since = time;
    }
  } else if (r.phase === 'indoors' && age >= 1.2) {
    // Advance before notifying Vue: reentrant rendering cannot pay twice.
    const stop = r.stops[r.stop];
    const receipt = { tour: r.tour, stop: r.stop++, building: stop.building };
    r.phase = 'leaving';
    r.since = time;
    if (actor.root.userData.villager?.name) d.onVipSpend?.(receipt);
  } else if (r.phase === 'leaving') {
    actor.root.scale.setScalar(Math.min(1, age / 0.35));
    if (age >= 0.35) {
      r.phase = 'walking';
      actor.routeResting = false;
      actor.routeLimit = r.stops[r.stop]?.distance ?? r.path.total;
    }
  } else if (r.phase === 'rest') {
    if (actor.visitor) actor.root.scale.setScalar(Math.max(0, 1 - age / 0.5));
    if (actor.transportVisitor && age >= 0.5) {
      actor.started = undefined;
      actor.root.visible = false;
      return;
    }
    if (!actor.transportVisitor && age >= r.pause) beginItinerary(d, actor);
  }
  actor.root.visible = actor.root.scale.x > 0;
  if (actor.vip) actor.vip.visible = !!actor.root.userData.villager?.name;
}

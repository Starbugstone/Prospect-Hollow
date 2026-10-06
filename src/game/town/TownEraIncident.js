import { walkPose, placeSafely, RouteWarmup, standingPose } from './TownNavigation';
import { Box3 } from 'three';
import { prepareRoute, routePose } from './TownRoutes';
import { responseVehicle, animateVehicle } from './TownVehicles';
import { cityModel } from './buildings/city';
import {
  eventKind,
  civicIncident,
  incidentScript,
  phaseAt,
  INCIDENT_BEATS,
  CARGO_CRATES,
} from '../../data/townEvents';
import { streetHeight } from './TownItineraries';
import { placeTraffic } from './TownTrafficRoutes';
import { BRIDGE, RIVER, riverDistance } from './TownRiver';
import { PLOTS, plotStreet, routeGraph, routeOnGraph } from './TownLayout';
import { clamp01, smooth01 } from './TownMath';
import { smokePuff } from './TownAtmosphere';

export const INCIDENT_DURATION = 18;
export const INCIDENT_SPEED = INCIDENT_BEATS / INCIDENT_DURATION;
// World units per story beat, below the pedestrian and vehicle speed limits.
const RUN = 1.6,
  WALK = 0.9,
  DRIVE = 2.6;
const NAMES = {
  'storm-cleanup': 'City storm response',
  'workshop-fire': 'Workshop fire response',
  'cargo-theft': 'Cargo theft response',
};

// Uses the same paused village clock and saved receipt as Frontier encounters.
// `incidentScript` decides who responds, who is caught and what is lost; this
// class only stages those facts, so captions and choreography always agree.
export class TownEraIncident {
  constructor(d, event, plots, onPhase, onComplete, onCue = () => {}) {
    Object.assign(this, { d, event, onPhase, onComplete, onCue, started: d.elapsed });
    this.cues = new Map();
    this.kind = eventKind(event);
    this.root = d.group(d.scene);
    this.root.name = NAMES[this.kind] ?? NAMES['cargo-theft'];
    this.target = event.targets?.find((id) => PLOTS[id]) ?? 'blacksmith';
    this.civic = civicIncident(this.kind);
    this.fire = this.kind === 'workshop-fire';
    this.storm = this.kind === 'storm-cleanup';
    this.script = incidentScript(event);
    this.graph = d.town ? routeGraph(d.town) : null;
    this.approaches = new Map();
    // Every detour is planned ahead of need within a small per-frame budget.
    this.warmup = new RouteWarmup(d.navigation);
    this.props = d.group(this.root, PLOTS[this.target][0], 0, PLOTS[this.target][1] + 1.7);
    this.props.userData.animated = true;
    if (this.fire) {
      const plot = d.plotCache?.get(this.target)?.group;
      const bounds = plot ? new Box3().setFromObject(plot) : null;
      this.props.position.y = bounds ? Math.max(1, bounds.max.y * 0.55) : 1.8;
      this.props.position.z = bounds ? bounds.max.z - 0.1 : PLOTS[this.target][1] + 1.3;
    }
    this.teams = {};
    this.thieves = [];
    this.crates = [];
    this.flames = [];
    this.smoke = [];
    this.scorch = [];
    this.branches = [];
    if (this.civic) this.buildCivic();
    else this.buildCargo();
    this.update(d.elapsed);
  }
  // Receipts can improve while the scene plays (bell, finished defenses). Recast
  // until the outcome is revealed; afterwards the staged facts are committed.
  updateEvent(event) {
    this.event = event;
    if (this.committed) return;
    this.script = incidentScript(event);
    if (this.civic) this.useTeam(this.script.brigade);
  }
  approach(origin) {
    if (!this.approaches.has(origin)) {
      let route = this.graph
        ? routeOnGraph(this.graph, plotStreet(origin), plotStreet(this.target))
        : [];
      if (route.length < 2) route = [plotStreet(this.target), plotStreet(this.target)];
      this.approaches.set(origin, prepareRoute(route));
    }
    return this.approaches.get(origin);
  }
  // Pose an actor `progress` of the way along `path`, around any obstacles.
  travel(actor, progress, offset = 0, path = this.path) {
    const distance = clamp01(progress) * path.total;
    const detour = this.d.navigation?.route(path, offset);
    // Detours must not make the fixed event timeline accelerate the crew.
    // Start further along a longer path and keep the same destination.
    const span = detour && Math.min(detour.total, path.total);
    const pose = detour
      ? walkPose(
          detour,
          (detour.total - span + clamp01(progress) * span) / (detour.total || 1),
          (actor.travelPose ??= standingPose(actor)),
        )
      : routePose(path, distance);
    actor.root.position.set(pose.x, 0.07, pose.z);
    actor.root.rotation.y = pose.heading;
    actor.distance = distance;
    if (!detour) actor.root.translateX(offset);
    if (
      Math.abs(actor.root.position.x - BRIDGE.centerX) < BRIDGE.halfLength &&
      Math.abs(actor.root.position.z - BRIDGE.z) < 0.7
    )
      actor.root.position.y = streetHeight(actor.root.position.x, actor.root.position.z);
    return progress > 0 && progress < 1;
  }
  // Vehicles keep to the road and pitch along its grade like traffic, so they
  // climb the bridge ramps in every era. `turn` adds to the road heading.
  drive(vehicle, progress, path, turn = 0) {
    vehicle.distance = clamp01(progress) * path.total;
    const pose = routePose(path, vehicle.distance);
    placeTraffic(vehicle.root, { x: pose.x, z: pose.z, heading: pose.heading + turn });
  }
  // Travel at `speed` from `start`; returns whether the actor is still moving.
  run(actor, path, time, start, speed, offset = 0) {
    return this.travel(actor, ((time - start) * speed) / (path.total || 1), offset, path);
  }
  // A stationary pose at a precomputed, obstacle-free spot.
  stand(actor, [x, z], facing) {
    actor.root.position.set(x, 0.07, z);
    actor.root.rotation.y = facing;
  }
  // Snap a staging point out of building footprints once, not every frame.
  safeSpot(actor, x, z) {
    actor.root.position.set(x, 0.07, z);
    placeSafely(this.d, actor.root);
    return [actor.root.position.x, actor.root.position.z];
  }
  facing(from, [x, z]) {
    return Math.atan2(x - from[0], z - from[1]);
  }
  stride(actor, moving, amount = 0.4) {
    actor.legs.forEach((leg, i) => {
      leg.upper.rotation.x = moving
        ? Math.sin(((actor.distance ?? 0) / 0.65) * Math.PI * 2 + i * Math.PI) * amount
        : 0;
    });
  }

  buildCargo() {
    const { d } = this;
    const site = this.props.position;
    this.street = plotStreet(this.target);
    // The whole road from the lock-up; officers run its final stretch.
    this.approachPath = this.approach('sheriff');
    this.path = tailRoute(
      this.approachPath,
      RUN * (this.script.arrive - 0.8 - this.script.dispatch),
    );
    this.crates = Array.from({ length: CARGO_CRATES }, (_, n) => {
      const crate = d.group(this.props, (n - (CARGO_CRATES - 1) / 2) * 0.55, 0, 0);
      d.box(crate, 0.45, 0.45, 0.45, 0, 0.3, 0, '#b9986b');
      // Bank-secured goods: iron straps and a padlock the thieves cannot break.
      crate.bands = d.group(crate);
      for (const x of [-0.13, 0.13]) d.box(crate.bands, 0.05, 0.47, 0.47, x, 0.3, 0, '#4d5559');
      d.box(crate.bands, 0.1, 0.12, 0.04, 0, 0.3, 0.245, '#d5b25b');
      return crate;
    });
    this.officers = Array.from({ length: 3 }, (_, seed) =>
      d.person({
        parent: this.root,
        manual: true,
        sheriff: true,
        seed: seed + 1,
        color: '#315d83',
        skin: seed % 2 ? '#ad7d5b' : '#d5b08b',
        hat: '#2c3f55',
        route: [
          [0, 0],
          [0, 1],
        ],
      }),
    );
    this.crew = [];
    this.officerRoutes = [];
    this.thieves = Array.from({ length: 4 }, (_, n) => {
      const person = d.person({
        parent: this.root,
        manual: true,
        seed: n + 4,
        color: ['#4f4a45', '#77675d', '#5b5048', '#6b5b52'][n],
        skin: n % 2 ? '#c09a77' : '#a57a5a',
        hat: '#3f3a34',
        route: [
          [0, 0],
          [0, 1],
        ],
      });
      d.box(person.head, 0.23, 0.075, 0.055, 0, -0.065, 0.1, '#3b3a3c', true);
      person.loot = d.box(person.root, 0.4, 0.35, 0.4, 0, 0.65, 0.3, '#b9986b');
      return person;
    });
    // Everyone stages from the plot's street frontage, between crates and road.
    this.thieves.forEach((actor, n) => {
      actor.slot = CARGO_CRATES - this.thieves.length + n;
      actor.spot = this.safeSpot(
        actor,
        site.x + (actor.slot - (CARGO_CRATES - 1) / 2) * 0.55,
        site.z + 0.62,
      );
    });
    // Officers hold the side they arrive from; anyone escaping flees the other way.
    const from = this.approachPath.points.at(-2) ?? this.street;
    this.away = Math.sign(this.street[0] - from[0]) || 1;
    this.officers.forEach((actor, n) => {
      actor.spot = this.safeSpot(
        actor,
        this.street[0] - this.away * (0.5 + n * 0.9),
        site.z + 1.45,
      );
    });
    this.escapeRoute = this.findEscape();
  }
  // Freight plots sit at the end of short spurs, so the only road out is the one
  // the patrol arrives on. Uncovered thieves slip out through the back lot on
  // the side away from the patrol and disappear behind the building.
  findEscape() {
    const [x, z] = PLOTS[this.target];
    for (const side of [this.away, -this.away]) {
      this.escapeSide = side;
      const route = [
        [x + side * 2.6, this.street[1] - 1.8],
        [x + side * 2.6, z - 3.4],
        [x + side * 1.2, z - 8],
      ];
      if (route.every((point) => riverDistance(...point) > RIVER.halfWidth + 1)) return route;
    }
    this.escapeSide = 0;
    return [this.street];
  }
  // Each thief keeps a lane of its own through the back lot, fixed by its crate
  // so the route can be prepared long before anyone runs.
  escapePath(actor) {
    // Lanes spread outward, away from the building wall rather than into it.
    const lane = this.escapeSide * (CARGO_CRATES - 1 - actor.slot) * 0.45;
    return (actor.escape ??= headRoute(
      prepareRoute([actor.spot, ...this.escapeRoute.map(([x, z]) => [x + lane, z])]),
      14,
    ));
  }

  officerRoute(n, time) {
    if (this.officerRoutes[n]) return this.officerRoutes[n];
    const { arrive, dispatch } = this.script;
    const begin = Math.max(time, dispatch),
      spot = this.officers[n].spot,
      lead = this.officerRoutes[0];
    const leg = Math.hypot(spot[0] - this.street[0], spot[1] - this.street[1]);
    let route;
    // The patrol runs in single file behind its leader, who arrives first.
    if (n && lead?.begin === begin) {
      route = { ...lead, path: standoffRoute(lead.tail, spot), delay: n * 0.7 };
    } else {
      // An officer called out late (a defense finished mid-scene) starts closer.
      const window = Math.max(0.5, arrive - (n ? 0 : 2) - begin);
      const tail = tailRoute(this.approachPath, Math.max(0.5, RUN * window - leg));
      const path = standoffRoute(tail, spot);
      route = { begin, tail, path, delay: 0, speed: Math.min(RUN, path.total / window) };
    }
    route.reach = route.begin + (route.path.total + route.delay) / route.speed;
    this.officerRoutes[n] = route;
    this.warmup.add(route.path, route.begin);
    if (!n) this.path = route.tail;
    return route;
  }
  // Prepare only the routes this cast will use: getaways for the thieves who can
  // run, and the escort for the patrol and its prisoners. Repeated when the roles
  // are committed; routes already planned return straight from the cache.
  prepareCargoRoutes() {
    const { script } = this;
    this.thieves.slice(script.caught, script.thieves).forEach((actor) => {
      this.warmup.add(this.escapePath(actor), script.scatter ?? script.arrive);
    });
    if (!script.responders) return;
    for (const actor of [
      ...this.officers.slice(0, script.responders),
      ...this.thieves.slice(0, script.caught),
    ])
      this.warmup.add(this.escortPath(actor).path, script.escort);
  }
  // Officers lead their prisoners home in one file along the reversed approach;
  // each walker joins it at the nearest point instead of doubling back.
  escortPath(actor) {
    if (actor.escort) return actor.escort;
    const lead = this.officerRoutes[0]?.tail ?? this.path;
    const road = prepareRoute([...lead.points].reverse());
    const join = nearestOnRoute(road, actor.spot);
    const path = prepareRoute([actor.spot, join.point, ...road.points.slice(join.index + 1)]);
    return (actor.escort = {
      path: headRoute(path, join.gap + (INCIDENT_BEATS - this.script.escort) * WALK + 4),
      gap: join.gap,
      along: join.along,
    });
  }
  updateCargo(time) {
    const { script } = this;
    for (let n = 0; n < script.responders; n++) this.officerRoute(n, time);
    if (!this.preparedCargo || (this.committed && this.preparedCargo !== 'committed')) {
      this.preparedCargo = this.committed ? 'committed' : 'cast';
      this.prepareCargoRoutes();
    }
    if (this.crew.length !== script.responders)
      this.crew = this.officers.slice(0, script.responders);
    const { arrive, scatter, escort, caught, locked } = script;
    const lookout = [this.props.position.x, this.props.position.z + 3];
    const queue = [];
    this.thieves.forEach((actor, n) => {
      const active = n < script.thieves;
      const captured = active && n < caught;
      actor.root.visible = active;
      actor.carrying = active && !captured && script.damage && actor.slot >= locked;
      actor.fled = false;
      actor.loot.visible = false;
      actor.torso.rotation.x = 0;
      actor.arms.forEach((arm) => {
        arm.upper.rotation.set(0, 0, 0);
        arm.lower.rotation.x = 0;
      });
      if (!active) return;
      const runner = n - caught,
        bolt = scatter + runner * 0.6;
      if (!captured && scatter !== null && time >= bolt) {
        // Running away with whatever the defenses left unprotected.
        const path = this.escapePath(actor);
        const moving = this.run(actor, path, time, bolt, script.responders ? RUN : WALK * 1.3);
        actor.fled = true;
        actor.root.visible = moving;
        actor.loot.visible = actor.carrying;
        if (actor.carrying) actor.arms.forEach((arm) => (arm.upper.rotation.x = -0.55));
        this.stride(actor, moving, script.responders ? 0.55 : 0.4);
        return;
      }
      if (captured && time >= escort) {
        queue.push(actor);
        return;
      }
      this.stride(actor, false);
      const confronted = captured && time >= arrive - 1;
      this.stand(actor, actor.spot, confronted ? this.facing(actor.spot, lookout) : Math.PI);
      if (confronted) {
        // Hands raised in surrender, facing the patrol.
        const up = smooth01((time - arrive + 1) / 0.8);
        actor.arms.forEach((arm, i) => {
          arm.upper.rotation.z = (i ? -2.4 : 2.4) * up;
          arm.lower.rotation.x = -0.2 * up;
        });
      } else {
        // Prying and loading: locked crates only earn a frustrated tug.
        const pry = Math.sin(time * 5 + n * 1.7);
        actor.torso.rotation.x = 0.22 + pry * 0.06;
        actor.arms.forEach((arm) => (arm.upper.rotation.x = -0.75 + pry * 0.25));
      }
    });
    // A stolen crate leaves the stack only when its thief runs off with it.
    this.crates.forEach((crate, n) => {
      crate.bands.visible = n < locked;
      const taker = this.thieves.find((actor) => actor.slot === n && actor.carrying && actor.fled);
      crate.visible = !taker;
    });
    this.officers.forEach((actor, n) => {
      const active = n < script.responders;
      actor.root.visible = false;
      actor.arms.forEach((arm) => arm.upper.rotation.set(0, 0, 0));
      if (!active) return;
      const route = this.officerRoute(n, time);
      if (time >= escort) {
        queue.push(actor);
        return;
      }
      const along = (time - route.begin) * route.speed - route.delay;
      actor.root.visible = along >= 0;
      // Nothing to pose (or plan) before an officer sets off.
      if (!actor.root.visible) return;
      if (time < route.reach) {
        const moving = this.travel(actor, along / (route.path.total || 1), 0, route.path);
        this.stride(actor, moving, 0.55);
        return;
      }
      this.stride(actor, false);
      const suspect = this.thieves.find((thief, k) => k < caught) ?? this.thieves[0];
      this.stand(actor, actor.spot, this.facing(actor.spot, suspect.spot));
      // The leading officer points at the cornered thieves.
      if (n === 0) actor.arms[1].upper.rotation.x = -1.45 * smooth01((time - route.reach) / 0.5);
    });
    // The front officer sets the pace; everyone else waits for their place in the
    // file, then steps onto the road and keeps a steady gap.
    const walkers = queue.map((actor) => ({ actor, ...this.escortPath(actor) }));
    walkers.sort(
      (a, b) =>
        this.thieves.includes(a.actor) - this.thieves.includes(b.actor) || b.along - a.along,
    );
    walkers.forEach(({ actor, path, gap, along }, q) => {
      const place = walkers[0].along + (time - escort) * WALK - q * 0.9;
      const moving = this.travel(
        actor,
        Math.max(0, gap + place - along) / (path.total || 1),
        0,
        path,
      );
      actor.root.visible = true;
      if (this.thieves.includes(actor))
        actor.arms.forEach((arm, i) => {
          arm.upper.rotation.x = -0.35;
          arm.upper.rotation.z = i ? -0.35 : 0.35;
          arm.lower.rotation.x = -1.1;
        });
      this.stride(actor, moving);
    });
  }

  buildCivic() {
    const { d } = this;
    if (this.fire) {
      this.flames = Array.from({ length: 7 }, (_, n) =>
        d.ball(
          this.props,
          (n - 3) * 0.24,
          0.6,
          (n % 2) * 0.06,
          [0.22, 0.55, 0.22],
          n % 2 ? '#e5a05c' : '#f1ce7a',
          'sphere',
        ),
      );
      this.smoke = Array.from({ length: 4 }, () =>
        smokePuff(d, this.props, 0, 1, 0, 0.4, '#69716e'),
      );
      // Soot left on the facade when the fire outpaced the town's protection.
      this.scorch = [
        [-0.45, 0.35, 0.7, 0.5],
        [0.4, 0.55, 0.55, 0.6],
        [0, 0.95, 0.9, 0.35],
      ].map(([x, y, w, h]) => {
        const patch = d.box(this.props, w, h, 0.03, x, y, 0.06, '#2e2926');
        patch.userData.size = [w, h];
        return patch;
      });
    }
    if (this.storm) {
      this.debris = cityModel(d, this.props, 'storm-debris');
      // The promenade pavement is raised; branches must sit above its surface.
      this.debris.position.y = 0.25;
      // Heavier storms (weaker crews) scatter more fallen limbs to clear.
      this.branches = [
        [-1.5, 0.6, 0.4],
        [1.4, -0.4, -0.5],
        [0.2, 0.9, 1.2],
      ].map(([x, z, turn]) => {
        const branch = d.group(this.props, x, 0.28, z);
        branch.rotation.y = turn;
        d.rod(branch, [-0.55, 0.05, 0], [0.55, 0.12, 0], 0.07, '#6d5236');
        d.ball(branch, 0.45, 0.2, 0, [0.28, 0.2, 0.24], '#5f7d49');
        d.ball(branch, -0.2, 0.18, 0.08, [0.22, 0.16, 0.2], '#6e8c52');
        return branch;
      });
    }
    this.water = d.group(this.root);
    this.water.userData.animated = true;
    this.drops = this.fire
      ? Array.from({ length: 12 }, () => d.ball(this.water, 0, 0, 0, 0.075, '#a2d9dc'))
      : [];
    this.useTeam(this.script.brigade);
  }
  // Built on demand so a fire station opened before dispatch changes the crew.
  useTeam(brigade) {
    const key = brigade ? 'brigade' : 'volunteers';
    const { d } = this;
    this.teams[key] ??= (() => {
      const people = Array.from({ length: 3 }, (_, seed) => {
        const actor = d.person({
          parent: this.root,
          manual: true,
          seed: seed + (brigade ? 0 : 8),
          color: brigade ? '#677d80' : ['#9a6b52', '#6f7f5d', '#8b6f8c'][seed],
          skin: seed % 2 ? '#ad7d5b' : '#d5b08b',
          hat: brigade ? '#c8ad67' : '#8a7a5c',
          route: [
            [0, 0],
            [0, 1],
          ],
        });
        if (this.fire)
          d.mesh(
            actor.arms[1].lower,
            'cylinder',
            brigade ? [0.14, 0.22, 0.14] : [0.16, 0.17, 0.16],
            [0, -0.25, 0],
            brigade ? '#8baaa5' : '#8a6a48',
          );
        return actor;
      });
      const team = { brigade, people, vehicle: null };
      if (brigade) {
        team.vehicle = { root: responseVehicle(d, this.root, this.storm) };
        team.vehicle.root.name = this.storm ? 'City service vehicle' : 'Motor fire brigade';
        team.vehicle.root.userData.animated = true;
      }
      return team;
    })();
    const team = this.teams[key];
    for (const other of Object.values(this.teams)) {
      if (other === team) continue;
      other.people.forEach((actor) => (actor.root.visible = false));
      if (other.vehicle) other.vehicle.root.visible = false;
    }
    this.team = team;
    this.crew = team.people;
    this.vehicle = team.vehicle;
    this.approachPath = this.approach(brigade ? 'fireStation' : 'well');
    const site = this.props.position;
    // A brigade stands in front of the site; neighbours form a line to the street.
    team.people.forEach((actor, n) => {
      actor.spot = brigade
        ? this.safeSpot(actor, site.x + (n - 1) * 0.9, site.z + 0.8)
        : this.safeSpot(actor, site.x + (n - 1) * 0.35, site.z + 0.8 + n * 0.75);
    });
    team.route = null;
    this.teamRoute();
  }
  teamRoute() {
    const { team, script } = this;
    if (team.route) return team.route;
    const window = script.arrive - script.dispatch;
    if (team.vehicle) {
      const path = tailRoute(this.approachPath, DRIVE * window);
      this.path = path;
      return (team.route = {
        path,
        cut: path !== this.approachPath,
        start: script.arrive - path.total / DRIVE,
        home: prepareRoute([...path.points].reverse()),
      });
    }
    const tail = tailRoute(this.approachPath, RUN * window - 2.5);
    this.path = tail;
    const walks = team.people.map((actor) => prepareRoute([...tail.points, actor.spot]));
    const homes = walks.map((path) => prepareRoute([...path.points].reverse()));
    walks.forEach((path) => this.warmup.add(path, script.dispatch));
    homes.forEach((path) => this.warmup.add(path, script.leave));
    return (team.route = {
      walks,
      homes,
      starts: walks.map((path, n) => script.arrive - n * 0.35 - path.total / RUN),
    });
  }
  updateCivic(time) {
    const { script, team } = this;
    const { arrive, resolved, leave } = script;
    const route = this.teamRoute();
    const site = this.props.position;
    const working = time >= arrive && time < resolved;
    if (team.vehicle) {
      const vehicle = team.vehicle;
      if (time < leave + 0.8)
        this.drive(
          vehicle,
          ((time - route.start) * DRIVE) / (route.path.total || 1),
          route.path,
          // Turn around at the scene once the crew is back on board.
          Math.PI * smooth01((time - leave) / 0.8),
        );
      else
        this.drive(vehicle, ((time - leave - 0.8) * DRIVE) / (route.home.total || 1), route.home);
      animateVehicle(vehicle.root, vehicle.distance);
      // A cut route begins in the approach shot instead of popping in mid-street.
      vehicle.root.visible = !route.cut || time >= route.start;
      const door = vehicle.root.position;
      team.people.forEach((actor, n) => {
        // The crew steps down, works at the site, then climbs aboard again.
        const out = smooth01((time - arrive) / 1.6) * (1 - smooth01((time - leave + 1.6) / 1.6));
        actor.root.visible = time >= arrive && time < leave;
        if (!actor.root.visible) return;
        actor.root.position.set(
          door.x + (actor.spot[0] - door.x) * out,
          0.07,
          door.z + (actor.spot[1] - door.z) * out,
        );
        actor.root.rotation.y =
          out > 0.98
            ? this.facing(actor.spot, [site.x, site.z])
            : this.facing([door.x, door.z], actor.spot);
        actor.distance = out * 6;
        this.stride(actor, out > 0.02 && out < 0.98);
        this.work(actor, n, time, working && out > 0.98);
      });
    } else
      team.people.forEach((actor, n) => {
        let moving = false;
        if (time < arrive) {
          actor.root.visible = time >= route.starts[n];
          if (actor.root.visible)
            moving = this.run(actor, route.walks[n], time, route.starts[n], RUN);
        } else if (time < leave + n * 0.35) {
          actor.root.visible = true;
          this.stand(actor, actor.spot, this.facing(actor.spot, [site.x, site.z]));
        } else {
          moving = this.run(actor, route.homes[n], time, leave + n * 0.35, WALK);
          actor.root.visible = moving;
        }
        this.stride(actor, moving);
        this.work(actor, n, time, working && !moving);
      });
    this.updateHazard(time);
  }
  work(actor, n, time, active) {
    actor.torso.rotation.x = 0;
    actor.arms.forEach((arm, i) => {
      arm.upper.rotation.x = 0;
      arm.lower.rotation.x = 0;
      if (!active) return;
      if (this.storm) arm.upper.rotation.x = -0.6 + Math.sin(time * 6 + n + i) * 0.4;
      else if (this.team.brigade) arm.upper.rotation.x = i ? -1.25 : -0.9;
      // A bucket line swings water forward hand to hand.
      else arm.upper.rotation.x = -0.5 - Math.max(0, Math.sin(time * 4 - n * 1.2)) * 0.9;
    });
    if (active && this.storm) actor.torso.rotation.x = 0.3;
  }
  updateHazard(time) {
    const { arrive, resolved, intensity, damage } = this.script;
    const site = this.props.position;
    const put = smooth01((time - arrive) / (resolved - arrive));
    // The fire keeps growing until help arrives; weaker protection means a bigger blaze.
    const blaze = (0.45 + 0.55 * smooth01(time / arrive)) * (0.6 + 0.8 * intensity) * (1 - put);
    const lit = 3 + Math.round(4 * intensity);
    this.flames.forEach((flame, n) => {
      flame.visible = blaze > 0.01 && n < lit;
      flame.scale.y = blaze * (0.55 + Math.sin(time * 3 + n) * 0.08);
      flame.scale.x = flame.scale.z = 0.18 + blaze * 0.08;
    });
    const linger = damage ? 0.35 * (1 - clamp01((time - resolved) / 8)) : 0;
    this.smoke.forEach((puff, n) => {
      const drift = (time * 0.25 + n / 4) % 1;
      puff.position.set(drift * 0.4, 0.9 + drift * (1.4 + blaze * 1.2), 0);
      puff.scale.setScalar(0.25 + drift * (0.35 + blaze * 0.3));
      puff.material.opacity = Math.sin(drift * Math.PI) * Math.max(0.4 * blaze, linger);
      puff.visible = puff.material.opacity > 0.005;
    });
    const char = damage ? smooth01((time - arrive * 0.5) / (arrive * 0.6)) : 0;
    this.scorch.forEach((patch) => {
      patch.visible = char > 0.02;
      const [w, h] = patch.userData.size,
        spread = 0.35 + 0.65 * char * (0.6 + 0.4 * intensity);
      patch.scale.set(w * spread, h * Math.max(0.01, char), 0.03);
    });
    // Storm debris is hauled away piece by piece while the crew works.
    const extra = Math.round(this.branches.length * Math.max(intensity, damage ? 0.34 : 0));
    this.branches.forEach((branch, n) => {
      branch.visible = n < extra && put < (n + 1) / (extra + 2);
    });
    if (this.debris) {
      this.debris.visible = put < 0.95;
      this.debris.scale.setScalar(1 - 0.6 * put);
    }
    this.water.visible = this.fire && time >= arrive + 1 && time < resolved;
    const source = this.crew[this.team.brigade ? 1 : 0].root.position,
      to = site;
    this.drops.forEach((drop, n) => {
      const amount = (time * 1.3 + n / this.drops.length) % 1;
      drop.visible = this.team.brigade || n % 2 === 0;
      drop.position.set(
        source.x + (to.x - source.x) * amount,
        1 + (to.y - 1) * amount + Math.sin(amount * Math.PI) * 1.2,
        source.z + (to.z - source.z) * amount,
      );
    });
  }

  update(elapsed) {
    if (this.disposed) return true;
    const time = (elapsed - this.started) * INCIDENT_SPEED;
    // Roles are fixed once they are about to be revealed on screen.
    if (!this.committed && time >= (this.civic ? this.script.dispatch + 1 : this.script.arrive - 3))
      this.committed = true;
    const phase = phaseAt(this.script, time);
    if (phase !== this.phase) {
      this.phase = phase;
      this.onPhase(phase);
    }
    if (this.civic) this.updateCivic(time);
    else this.updateCargo(time);
    this.playCues(time);
    this.warmup.step();
    if (time >= INCIDENT_BEATS) {
      this.dispose();
      this.onComplete();
      return true;
    }
    return false;
  }
  // Sound cues follow the same village clock as the choreography. Missed one-shots
  // are never replayed after a suspended tab or skip; loops always receive their stop.
  playCues(time) {
    const x = this.props.position.x - (this.d.controls?.target.x ?? this.props.position.x);
    const pan = Math.max(-0.6, Math.min(0.6, x / 12));
    for (const cue of this.script.cues) {
      const state = this.cues.get(cue.id);
      if (!state && time >= cue.at && (cue.until === null || time < cue.until)) {
        this.cues.set(cue.id, 'started');
        if (time - cue.at < 0.25 || cue.until !== null)
          this.onCue({ id: cue.id, raidId: this.event.id, kind: cue.kind, pan });
      } else if (state === 'started' && cue.until !== null && time >= cue.until) {
        this.cues.set(cue.id, 'stopped');
        this.onCue({ id: cue.id, raidId: this.event.id, kind: cue.kind, stop: true });
      }
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.d.clearGroup(this.root);
  }
}

function tailRoute(path, maximum) {
  if (path.total <= maximum) return path;
  const start = routePose(path, path.total - maximum);
  let covered = 0;
  const points = [[start.x, start.z]];
  for (let i = 0; i < path.lengths.length; i++) {
    covered += path.lengths[i];
    if (covered > path.total - maximum) points.push(path.points[i + 1]);
  }
  return prepareRoute(points);
}
function headRoute(path, maximum) {
  if (path.total <= maximum) return path;
  const points = [path.points[0]];
  let covered = 0;
  for (let i = 0; i < path.lengths.length; i++) {
    if (covered + path.lengths[i] >= maximum) {
      const end = routePose(path, maximum);
      points.push([end.x, end.z]);
      break;
    }
    covered += path.lengths[i];
    points.push(path.points[i + 1]);
  }
  return prepareRoute(points);
}
// Closest point of a prepared route: its segment, distance along it and the gap.
function nearestOnRoute(route, [x, z]) {
  let best = { gap: Infinity, index: 0, along: 0, point: route.points[0] };
  let covered = 0;
  for (let i = 0; i < route.lengths.length; i++) {
    const a = route.points[i],
      b = route.points[i + 1],
      length = route.lengths[i];
    const t = length
      ? clamp01(((x - a[0]) * (b[0] - a[0]) + (z - a[1]) * (b[1] - a[1])) / length ** 2)
      : 0;
    const point = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const gap = Math.hypot(x - point[0], z - point[1]);
    if (gap < best.gap - 1e-6) best = { gap, index: i, along: covered + t * length, point };
    covered += length;
  }
  return best;
}
// Leave the road where the standoff spot is reached, without overshooting it.
function standoffRoute(tail, spot) {
  const join = nearestOnRoute(tail, spot);
  return prepareRoute([...tail.points.slice(0, join.index + 1), join.point, spot]);
}

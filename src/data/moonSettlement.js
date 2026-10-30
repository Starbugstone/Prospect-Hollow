import { eraEvolution } from './eras';
import { areasForSettlement, siteYaw } from './townLandmarks';
import { commissionLetters, finishedCommissions } from './commissions';
import { MOON_SETTLEMENT } from './settlements';
// Read inside moonstoneKeepsakes only, after town.js (which needs moonstones.js) loads.
import { MOONSTONE_BUILDINGS } from './town';

// New Hollow, the homesteads on the Moon, grows with the supplies the town sends up
// the space elevator. It is presentation only: no coins, timers or failure.
export const MOON_SETTLEMENT_LIMIT = 24;
// Two homesteads per elevator level, then one for every four modernization levels
// completed in a supply era (an era whose `moonSettlement` capability is on).
export function moonSettlement(town) {
  const elevator = town?.buildings?.spaceElevator ?? 0;
  if (!elevator) return { homesteads: 0, lights: [] };
  const levels = Object.entries(town.buildingEras ?? {}).reduce(
    (sum, [id, era]) =>
      eraEvolution(era).moonSettlement && id !== 'spaceElevator'
        ? sum + (town.buildingEraLevels?.[id] ?? 0)
        : sum,
    0,
  );
  const homesteads = Math.min(MOON_SETTLEMENT_LIMIT, elevator * 2 + Math.floor(levels / 4));
  return { homesteads, lights: MOON_LIGHTS.slice(0, homesteads) };
}

// Settlement positions on a unit Moon disc (x, y in -1..1), spread by the golden
// angle so a growing settlement fills the face evenly. Stable for every save.
const MOON_LIGHTS = Array.from({ length: MOON_SETTLEMENT_LIMIT }, (_, n) => {
  const radius = 0.82 * Math.sqrt((n + 0.5) / MOON_SETTLEMENT_LIMIT),
    angle = n * 2.39996;
  return Object.freeze({
    x: Math.round(Math.cos(angle) * radius * 1000) / 1000,
    y: Math.round(Math.sin(angle) * radius * 1000) / 1000,
    // Lights twinkle out of step with each other.
    delay: (n * 0.37) % 2.4,
  });
});

// Lots on the Moon map, in the Moon scene's own coordinates. The ribbon lands in
// the middle of the crater; the camera looks across it toward the risen Earth.
// Inner lots surround the landing inside the ring road (radius MOON_RING_ROAD);
// outer homesteads and service pads stand beyond it.
export const MOON_LOTS = Object.freeze({
  ribbonLanding: Object.freeze([0, -8]),
  newHollowCommons: Object.freeze([0, 11]),
  settlerDomes: Object.freeze([-12, 2]),
  craterIceWell: Object.freeze([12, 2]),
  craterHomesteads: Object.freeze([-27, -12]),
  earthlightGreenhouse: Object.freeze([27, -12]),
  willowkinDome: Object.freeze([-15, 27]),
  moonstoneWorkshop: Object.freeze([15, 27]),
  earthriseLookout: Object.freeze([-30, 12]),
  roverBarn: Object.freeze([30, 12]),
  saucerPad: Object.freeze([15, -30]),
});
export const MOON_RING_ROAD = 20.5;
// Lots sit inside a crater bowl; footprints stay within this radius of a lot.
export const MOON_LOT_RADIUS = 5;
export const MOON_CRATER_RADIUS = 46;

// Public arrivals use the actual hatch, service forecourt or stair foot. The
// bends avoid authored benches, cargo and rovers on each pad. All geometry and
// the fallback map consume these same routes; no separate navigation is saved.
const MOON_ACCESS_WIDTH = 0.8;
const MOON_PAD_RADII = Object.freeze({
  ribbonLanding: 5.2,
  newHollowCommons: 4.8,
  settlerDomes: 4.6,
  craterIceWell: 4.4,
  craterHomesteads: 4.8,
  earthlightGreenhouse: 4.6,
  willowkinDome: 4.8,
  moonstoneWorkshop: 4.4,
  earthriseLookout: 4.4,
  roverBarn: 4.6,
  saucerPad: 6.4,
});
export const moonPadRadius = (kind) => MOON_PAD_RADII[kind] ?? MOON_LOT_RADIUS;
// Every Moon parcel stands on one octagonal pad: building lots (built or empty) and
// monument sites, including any added later. The drawn pad, the upgrade glow, tap
// targets, the selection outline and the path ramps all read this one shape.
export const MOON_PARCEL_SIDES = 8;
// An open monument site's pad, the size of the larger building lots.
export const MOON_SITE_PAD = 5.2;
// From a pad's centre to the middle of a side.
export const moonPadApothem = (radius) => radius * Math.cos(Math.PI / MOON_PARCEL_SIDES);
// The top of every raised pad (its rim and inset deck): where buildings, the saucer's
// feet, survey beacons and the walkers on a pad stand.
export const MOON_PAD_TOP = 0.26;
// Paths sit a hair above what they cross, so they never flicker against it.
export const MOON_PATH_LIFT = 0.01;
export const MOON_ROAD_LIFT = 0.04;
/**
 * A public path's surface at (x, z): on its pad's top near the hatch, ramping down past
 * `rampStart`..`rampEnd` (from the pad's centre) to the regolith at `ground`.
 */
export function moonApproachHeight({ pose, rampStart, rampEnd }, x, z, ground = 0) {
  const radius = Math.hypot(x - pose.x, z - pose.z);
  const t = Math.max(0, Math.min(1, (radius - rampStart) / (rampEnd - rampStart)));
  return (MOON_PAD_TOP + MOON_PATH_LIFT) * (1 - t) + (ground + MOON_ROAD_LIFT) * t;
}
/** Every parcel on the Moon with its pad: position, turn (a corner on local +z) and radius. */
export function moonParcels(lots = MOON_LOTS, sites = areasForSettlement(MOON_SETTLEMENT)) {
  return [
    ...Object.keys(lots).map((id) => ({
      id,
      kind: 'lot',
      ...moonLotPose(id, lots),
      radius: moonPadRadius(id),
      sides: MOON_PARCEL_SIDES,
    })),
    ...sites.map((area) => ({
      id: area.id,
      kind: 'site',
      x: area.positions[0][0],
      z: area.positions[0][1],
      rotation: siteYaw(area),
      radius: MOON_SITE_PAD,
      sides: MOON_PARCEL_SIDES,
    })),
  ];
}
const MOON_ARRIVALS = Object.freeze({
  saucerPad: [
    [0, 5.32],
    [0, 7.2],
  ],
  ribbonLanding: [
    [0, 1.34],
    [0, 6],
  ],
  settlerDomes: [
    [-1.5, 0.67],
    [-1.5, 5.81],
  ],
  craterIceWell: [
    [0, 1.8],
    [0, 6],
  ],
  earthlightGreenhouse: [
    [-2.83, -1.4],
    [-5.84, -1.4],
  ],
  willowkinDome: [
    [0, 1.92],
    [0, 6],
  ],
  newHollowCommons: [
    [0, 0.43],
    [0, 1.2],
    [-1.1, 1.4],
    [-1.1, 5.9],
  ],
  craterHomesteads: [
    [-1.6, -0.08],
    [-1.6, 1.4],
    [0, 1.4],
    [0, 6],
  ],
  moonstoneWorkshop: [
    [-0.6, 0.18],
    [-0.6, 5.97],
  ],
  roverBarn: [
    [-0.8, -0.08],
    [-0.8, 0.6],
    [0, 0.9],
    [0, 6],
  ],
  earthriseLookout: [
    [-0.7, 2.62],
    [-0.7, 5.96],
  ],
});

export function moonLotPose(id, lots = MOON_LOTS) {
  const [x, z] = lots[id] ?? [0, 0];
  const landingZ = lots.ribbonLanding?.[1] ?? -8;
  // Preserve established lot poses. Local +z is the authored front apron; the
  // outer Saucer Pad faces inward so pedestrians stay opposite its sky corridor.
  const rotation =
    id === 'ribbonLanding'
      ? 0
      : Math.atan2(-x, -(z - landingZ)) + (id === 'saucerPad' ? 0 : Math.PI);
  return { x, z, rotation };
}

const moonWorldPoint = ([x, z], pose) => [
  pose.x + x * Math.cos(pose.rotation) + z * Math.sin(pose.rotation),
  pose.z - x * Math.sin(pose.rotation) + z * Math.cos(pose.rotation),
];

export function moonEntrance(id, level = 3, lots = MOON_LOTS) {
  const local =
    id === 'willowkinDome' && level >= 2 ? [0, 2.48] : (MOON_ARRIVALS[id]?.[0] ?? [0, 1]);
  return moonWorldPoint(local, moonLotPose(id, lots));
}

export function moonSegmentDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1];
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}

// A short exterior arc can turn around a pad whose front faces away from the
// ring. Select the shortest clear arc+ring connection once, rather than drawing
// a radial spoke through a building or changing its established orientation.
export function moonApproach(id, level = 3, lots = MOON_LOTS, site = null) {
  const pose = site?.pose ?? moonLotPose(id, lots);
  const local = (
    site?.arrival ??
    MOON_ARRIVALS[id] ?? [
      [0, 1],
      [0, 6],
    ]
  ).map((point) => [...point]);
  if (id === 'willowkinDome' && level >= 2) local[0] = [0, 2.48];
  const padRadius = site?.padRadius ?? moonPadRadius(id),
    rampStart = moonPadApothem(padRadius - 0.25) - 0.05,
    rampEnd = padRadius + 0.35;
  // Turn close around the actual pad, rather than extending a uniform six-unit
  // hook beyond smaller pads. The strip's inside edge remains off the pad wall.
  const gateRadius = padRadius + 0.6;
  const last = local.at(-1),
    lastRadius = Math.hypot(...last);
  local[local.length - 1] = last.map((value) => (value * gateRadius) / lastRadius);
  const a = local.at(-2),
    b = local.at(-1);
  const crossing = (radius) => {
    let low = 0,
      high = 1;
    for (let n = 0; n < 24; n++) {
      const t = (low + high) / 2;
      if (Math.hypot(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t) < radius) low = t;
      else high = t;
    }
    return [a[0] + (b[0] - a[0]) * high, a[1] + (b[1] - a[1]) * high];
  };
  local.splice(local.length - 1, 0, crossing(rampStart), crossing(rampEnd));
  const apron = local.map((point) => moonWorldPoint(point, pose));
  const gate = apron.at(-1);
  const startAngle = Math.atan2(gate[1] - pose.z, gate[0] - pose.x);
  const radius = Math.hypot(gate[0] - pose.x, gate[1] - pose.z);
  const clear = (a, b, own = true) =>
    Object.entries(lots).every(
      ([other, [x, z]]) =>
        (!own && other === id) ||
        moonSegmentDistance(x, z, a, b) >=
          (other === id ? padRadius + 0.45 : Math.max(MOON_LOT_RADIUS, moonPadRadius(other)) + 0.8),
    );
  let best = null;
  for (const direction of [-1, 1]) {
    const arc = [gate];
    let length = 0;
    for (let n = 0; n <= 16; n++) {
      if (n) {
        const a = startAngle + (direction * n * Math.PI) / 16;
        const point = [pose.x + Math.cos(a) * radius, pose.z + Math.sin(a) * radius];
        if (!clear(arc.at(-1), point, false)) break;
        length += Math.hypot(point[0] - arc.at(-1)[0], point[1] - arc.at(-1)[1]);
        arc.push(point);
      }
      for (let j = 0; j < 96; j++) {
        const a = (j * Math.PI) / 48;
        const end = [Math.cos(a) * MOON_RING_ROAD, Math.sin(a) * MOON_RING_ROAD];
        const cost = length + Math.hypot(end[0] - arc.at(-1)[0], end[1] - arc.at(-1)[1]);
        if ((!best || cost < best.cost) && clear(arc.at(-1), end))
          best = { cost, points: [...arc, end] };
      }
    }
  }
  // Incomplete future layouts still get finite, visible access data. Shipped
  // layouts are regression checked to always find a clear exterior connection.
  const fallback = [Math.cos(startAngle) * MOON_RING_ROAD, Math.sin(startAngle) * MOON_RING_ROAD];
  return {
    id,
    width: MOON_ACCESS_WIDTH,
    entry: apron[0],
    gate,
    pose,
    padRadius,
    rampStart,
    rampEnd,
    clear: !!best,
    points: [...apron, ...(best?.points.slice(1) ?? [fallback])],
    apronSegments: apron.length - 1,
  };
}

let cachedMoonApproaches;
const defaultMoonApproaches = () =>
  (cachedMoonApproaches ??= Object.freeze(Object.keys(MOON_LOTS).map((id) => moonApproach(id))));
export function moonApproaches(levels = null, lots = MOON_LOTS) {
  if (!levels && lots === MOON_LOTS) return defaultMoonApproaches();
  if (lots === MOON_LOTS)
    return defaultMoonApproaches()
      .filter(({ id }) => levels[id] > 0)
      .map((route) => {
        if (route.id !== 'willowkinDome' || levels[route.id] >= 2) return route;
        const entry = moonWorldPoint(MOON_ARRIVALS.willowkinDome[0], route.pose);
        return { ...route, entry, points: [entry, ...route.points.slice(1)] };
      });
  return Object.keys(lots)
    .filter((id) => !levels || levels[id] > 0)
    .map((id) => moonApproach(id, levels?.[id] ?? 3, lots));
}

export function moonPathDistance(x, z, approaches = defaultMoonApproaches()) {
  let distance = Infinity;
  for (const { points } of approaches)
    for (let n = 1; n < points.length; n++)
      distance = Math.min(distance, moonSegmentDistance(x, z, points[n - 1], points[n]));
  return distance;
}

// A commission's door, on its raised pad. Every finished commission keeps its door here.
export const MOON_COMMISSION_DOOR = 3.1;
const commissionRoutes = new Map();
/** The public path to a commission site's door, from the same route search as a lot's. */
export function moonCommissionRoute(area) {
  if (!commissionRoutes.has(area.id)) {
    const [x, z] = area.positions[0];
    commissionRoutes.set(
      area.id,
      moonApproach(
        area.id,
        3,
        { ...MOON_LOTS, [area.id]: [x, z] },
        {
          pose: { x, z, rotation: siteYaw(area) },
          padRadius: MOON_SITE_PAD,
          arrival: [
            [0, MOON_COMMISSION_DOOR],
            [0, 6],
          ],
        },
      ),
    );
  }
  return commissionRoutes.get(area.id);
}
/**
 * Finished commissions the settlers use: the path to each, and how many of a resident's
 * three daily trips go there. Derived from the saved choice and stage, so nothing new is
 * saved. Scaffolding around the first stage keeps residents away until it is unveiled.
 */
export const moonCommissionVenues = (town) =>
  finishedCommissions(town, MOON_SETTLEMENT).map(({ site, area, outcome }) => ({
    id: site,
    route: moonCommissionRoute(area),
    visits: outcome.visits,
  }));

// Letters home from New Hollow, one for each finished Moon building. They are
// derived from building levels, so nothing new is saved.
const LETTERS = {
  ribbonLanding: 'The first climber landed softly. We waved at the valley the whole way down.',
  settlerDomes: 'Our dome is cozy and round. The children say Earth is the best nightlight.',
  craterIceWell: 'We melted our first bucket of crater ice. It tastes like the old town well.',
  earthlightGreenhouse: 'Your valley seeds have sprouted. The tomatoes grow sideways toward Earth.',
  willowkinDome:
    'A Willowkin sapling unfurled its first leaf on the Moon. The whole crater cheered.',
  newHollowCommons: 'We held our first town meeting. Everyone voted for more pie.',
  craterHomesteads: 'New porches on the crater rim, just like the frontier stories.',
  moonstoneWorkshop: 'We are polishing moonstones for every family back home.',
  saucerPad: 'The saucer settled in a puff of moon dust. We saved the pilots a slice of pie.',
  roverBarn: 'The rovers are ready for picnics. Bring a blanket when you visit.',
  earthriseLookout: 'From the lookout we can see the valley lights. Goodnight, Prospect Hollow.',
};
export const moonLetters = (town) => [
  ...Object.entries(LETTERS)
    .filter(([id]) => (town?.buildings?.[id] ?? 0) > 0)
    .map(([id, text]) => ({ id, text })),
  ...commissionLetters(town, MOON_SETTLEMENT),
];
// Historical keepsake entitlement: one per finished Moon building level.
// Retained for deterministic migration into the saved moonstone resource.
export const moonstoneKeepsakes = (town) =>
  MOONSTONE_BUILDINGS.reduce((sum, id) => sum + (town?.buildings?.[id] ?? 0), 0);

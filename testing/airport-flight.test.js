import { describe, expect, it } from 'vitest';
import { Box3, Color, Group, Vector3 } from 'three';
import airportLayout from '../src/data/airportLayout.json';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import {
  airplaneArrival,
  airplaneFlight,
  airplanePose,
  addAviationActivity,
  AIRPORT_FLIGHT_CYCLE,
  PLANE_DEPARTURES,
  SAUCER_PAD,
  SAUCER_ROUTES,
  saucerFlightPoint,
  saucerPose,
} from '../src/game/town/TownAviation';
import { TRAIL_SILVER, saucerTrailColors } from '../src/data/skyCraft';
import { roundedAircraft, SAUCER_HULL } from '../src/game/town/RoundedTransports';
import {
  AIRPORT,
  PLOTS,
  RAIL_EDGE,
  segmentDistance,
  townTracks,
} from '../src/game/town/TownLayout';
import { groundHeight } from '../src/game/town/TownLandscape';
import { finishEra, plotInEra } from '../src/game/town/TownEras';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import { airportAppearance } from '../src/data/airport';
import { hasRoundedTransport, ROUNDED_PALETTE } from '../src/data/roundedArchitecture';
import { COZY_PALETTES } from '../src/data/cozyArchitecture';
import { FUTURE_PALETTES } from '../src/data/futureArchitecture';
import { SKY_MOON_DIRECTION, SKY_SAUCERS, skyMoonShown, skySaucer } from '../src/data/skyCraft';

it.each(['aviation', 'broadcast', 'contemporary', 'tomorrow'])(
  '%s parks the entire passenger aircraft inside the hangar bay',
  (era) => {
    const d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      geometries: createTownGeometries(),
      materials: new Map(),
      world: new Group(),
      motions: [],
    });
    try {
      addAviationActivity(d, { buildings: { airport: 3 }, buildingEras: { airport: era } });
      const bounds = new Box3().setFromObject(d.world.children[0]);
      const bay = airportLayout.hangar;
      expect(bounds.min.x).toBeGreaterThan(AIRPORT.center[0] + bay.frontX + 0.15);
      expect(bounds.max.x).toBeLessThan(AIRPORT.center[0] + bay.backX - 0.15);
      expect(bounds.min.z).toBeGreaterThan(AIRPORT.center[1] + bay.centerZ - bay.roofRadius + 0.15);
      expect(bounds.max.z).toBeLessThan(AIRPORT.center[1] + bay.centerZ + bay.roofRadius - 0.15);
    } finally {
      d.clearGroup(d.world);
      Object.values(d.geometries).forEach((g) => g.dispose());
      d.materials.forEach((m) => m.dispose());
    }
  },
);

it('flies arrivals and departures in separate intervals with quiet time between them', () => {
  const phases = [];
  let previous;
  // Nine visits cover every livery with every departure profile.
  for (let t = 0; t < AIRPORT_FLIGHT_CYCLE * 9; t += 0.1) {
    const pose = airplanePose(t);
    if (pose.phase !== previous?.phase) phases.push(pose.phase);
    if (previous?.visible && pose.visible) {
      expect(
        Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z),
      ).toBeLessThan(1);
      const turn = Math.atan2(Math.sin(pose.yaw - previous.yaw), Math.cos(pose.yaw - previous.yaw));
      expect(Math.abs(turn)).toBeLessThan(0.13);
    }
    // The runway carries every landing and every takeoff until the plane is airborne.
    if (pose.phase === 'landing' || (pose.phase === 'takeoff' && pose.y < 4))
      expect(pose.x).toBe(AIRPORT.runwayX);
    previous = pose;
  }
  expect(phases.filter((p) => p === 'takeoff')).toHaveLength(9);
  expect(phases.filter((p) => p === 'landing')).toHaveLength(9);
  expect(phases.indexOf('away')).toBeGreaterThan(phases.indexOf('takeoff'));
  expect(phases.indexOf('landing')).toBeGreaterThan(phases.indexOf('away'));
  expect(airplanePose(90).visible).toBe(false);
  expect(airplanePose(150).y).toBeGreaterThan(airplanePose(151).y);
  expect(airplanePose(151).y).toBeCloseTo(0.2);
  expect(airplanePose(0)).toEqual(airplanePose(AIRPORT_FLIGHT_CYCLE));
  expect(airplanePose(0).propellers).toBe(false);
});

it('uses one aircraft and one animation callback for every phase, and none before construction', () => {
  const d = Object.create(TownDiorama.prototype);
  d.geometries = createTownGeometries();
  d.materials = new Map();
  d.world = new Group();
  d.motions = [];
  try {
    addAviationActivity(d, { buildings: { airport: 0 } });
    expect(d.world.children).toHaveLength(0);
    expect(d.motions).toHaveLength(0);
    addAviationActivity(d, { buildings: { airport: 3 } });
    expect(d.world.children).toHaveLength(1);
    expect(d.motions).toHaveLength(1);
    const plane = d.world.children[0];
    for (let t = 0; t <= AIRPORT_FLIGHT_CYCLE * 2; t += 0.5) {
      d.motions[0](t);
      expect(d.world.children).toEqual([plane]);
      expect(plane.userData.flightPhase).toBe(airplanePose(t).phase);
      expect(plane.visible).toBe(airplanePose(t).visible);
    }
  } finally {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
});

const SAMPLE = 0.02;
const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const turnBetween = (a, b) => Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const hangarStand = airplanePose(0);
const moonHeading = (() => {
  const [x, z] = SKY_MOON_DIRECTION;
  return [x / Math.hypot(x, z), z / Math.hypot(x, z)];
})();
const headingFromPad = (pose) => {
  const dx = pose.x - SAUCER_PAD.x,
    dz = pose.z - SAUCER_PAD.z;
  const length = Math.hypot(dx, dz);
  return [dx / length, dz / length];
};

function aviationDiorama(town) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    world: new Group(),
    motions: [],
    visitorTransports: new Map(),
    town,
  });
  return d;
}
function disposeDiorama(d) {
  d.clearGroup(d.world);
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
}
// Every building finished as it is in a real town of that era, so a Twin Hollows
// airport keeps the Moonward finish it was last modernized to.
function completeTown(era) {
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = finishEra(b.id, era);
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
}
const ROUNDED_ERAS = ERAS.filter((era) => hasRoundedTransport(era.id)).map((era) => era.id);
const meshes = (root) => {
  const found = [];
  root.traverse((o) => {
    if (o.isMesh) found.push(o);
  });
  return found;
};

describe('Sky saucer flight', () => {
  it.each([false, true])(
    'lifts vertically from a pad with no runway roll (to the Moon: %s)',
    (toMoon) => {
      let previous;
      const phases = [];
      for (let t = 0; t < AIRPORT_FLIGHT_CYCLE; t += SAMPLE) {
        const pose = saucerPose(t, { toMoon });
        if (pose.phase !== previous?.phase) phases.push(pose.phase);
        // No airliner pitch: only a small wobble and a slight lean into the streak.
        expect(Math.abs(pose.pitch)).toBeLessThan(0.16);
        expect(Math.abs(pose.roll)).toBeLessThan(0.06);
        // Below hover height it is over the hangar taxiway or straight above the pad,
        // never rolling along the runway.
        if (pose.visible && pose.y < 9.9) {
          expect(pose.z, `${t}`).toBeCloseTo(SAUCER_PAD.z, 6);
          expect(pose.x).toBeGreaterThanOrEqual(SAUCER_PAD.x - 1e-9);
          expect(pose.x).toBeLessThanOrEqual(hangarStand.x + 1e-9);
        }
        if (['lift', 'hover', 'descent'].includes(pose.phase)) {
          expect(pose.x).toBe(SAUCER_PAD.x);
          expect(pose.z).toBe(SAUCER_PAD.z);
        }
        // The legs fold away whenever it is clear of the hangar floor.
        if (pose.y > 1) expect(pose.legs).toBe(0);
        previous = pose;
      }
      expect(phases).toEqual([
        'parked',
        'lift-off',
        'taxi-out',
        'spin-up',
        'lift',
        'hover',
        'departure',
        'away',
        'approach',
        'descent',
        'settle',
        'taxi-in',
        'docking',
        'parked',
      ]);
      // The lift is vertical and ends in a pause before it speeds away.
      expect(saucerPose(38, { toMoon }).y).toBeLessThan(1);
      expect(saucerPose(45, { toMoon }).y).toBeGreaterThan(9.9);
      expect(saucerPose(48.9, { toMoon }).y).toBeCloseTo(saucerPose(45, { toMoon }).y, 1);
      expect(saucerPose(56.95, { toMoon }).opacity).toBeLessThan(0.01);
      // Landing mirrors it: high, then slowing down on its way to the pad.
      expect(saucerPose(136, { toMoon }).y).toBeGreaterThan(40);
      const speed = (t) => {
        const a = saucerPose(t, { toMoon }),
          b = saucerPose(t + 0.1, { toMoon });
        return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      };
      expect(speed(140)).toBeLessThan(speed(136));
      expect(speed(146.8)).toBeLessThan(0.1);
    },
  );

  it.each([false, true])(
    'moves continuously and docks on the arrival schedule (to the Moon: %s)',
    (toMoon) => {
      let previous;
      for (let t = 0; t <= AIRPORT_FLIGHT_CYCLE * 2; t += SAMPLE) {
        const pose = saucerPose(t, { toMoon });
        // Visitors step out only once the saucer is back at its stand.
        if (airplaneArrival(t).arrived)
          expect(pose).toMatchObject({ phase: 'parked', x: hangarStand.x, y: hangarStand.y });
        if (pose.phase === 'away') expect(pose.visible).toBe(false);
        if (previous?.visible && pose.visible) {
          expect(
            Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z),
            `${t}`,
          ).toBeLessThan(1);
          expect(turnBetween(previous.yaw, pose.yaw)).toBeLessThan(0.02);
          expect(Math.abs(pose.spin - previous.spin)).toBeLessThan(0.02);
          expect(Math.abs(pose.legs - previous.legs)).toBeLessThan(0.02);
        }
        // It fades in and out of sight instead of popping.
        if (previous && !previous.visible && pose.visible) expect(pose.opacity).toBeLessThan(0.01);
        if (previous?.visible && !pose.visible) expect(previous.opacity).toBeLessThan(0.01);
        previous = pose;
      }
      expect(saucerPose(0, { toMoon })).toEqual(saucerPose(AIRPORT_FLIGHT_CYCLE, { toMoon }));
      expect(saucerPose(175.99, { toMoon }).y).toBeCloseTo(hangarStand.y, 3);
      expect(saucerPose(0, { toMoon }).legs).toBe(1);
    },
  );

  it('keeps clear of the terrain, the railway, roads, paths and the station at low altitude', () => {
    const low = new Map();
    for (const toMoon of [false, true])
      for (let t = 0; t < AIRPORT_FLIGHT_CYCLE; t += 0.1) {
        const p = saucerPose(t, { toMoon });
        if (!p.visible) continue;
        expect(p.y - groundHeight(p.x, p.z)).toBeGreaterThan(0.1);
        if (Math.abs(p.z - RAIL_EDGE.from[1]) < 4) expect(p.y).toBeGreaterThan(4);
        if (p.y < 4) low.set(`${p.x.toFixed(2)},${p.z.toFixed(2)}`, p);
      }
    expect(low.size).toBeGreaterThan(20);
    // The hull is 2.5 wide: keep all of it off every road and path, and the station.
    for (const era of ROUNDED_ERAS) {
      const tracks = townTracks(completeTown(era));
      for (const [at, p] of low) {
        expect(p.z).toBeGreaterThan(RAIL_EDGE.from[1] + 4);
        expect(Math.hypot(p.x - PLOTS.railDepot[0], p.z - PLOTS.railDepot[1])).toBeGreaterThan(12);
        for (const edge of tracks)
          expect(
            segmentDistance(p.x, p.z, edge.from, edge.to) - edge.width / 2,
            `${era} ${at} ${edge.from}`,
          ).toBeGreaterThan(2.6);
      }
    }
  });

  it('passes well wide of the space elevator ribbon, the mine and the tall landmarks', () => {
    // The ribbon rises without end, so keep the distance at every altitude, out and back.
    // Pylons, masts and the headframe are checked the same way, to be safe.
    const tall = ['spaceElevator', 'mine', 'radioTower', 'moonpost', 'greatTelescope', 'skyline'];
    for (const id of tall) expect(PLOTS[id], id).toBeDefined();
    const nearest = Object.fromEntries(tall.map((id) => [id, Infinity]));
    for (const toMoon of [false, true])
      for (let t = 0; t < AIRPORT_FLIGHT_CYCLE; t += 0.05) {
        const p = saucerPose(t, { toMoon });
        if (!p.visible) continue;
        for (const id of tall)
          nearest[id] = Math.min(nearest[id], Math.hypot(p.x - PLOTS[id][0], p.z - PLOTS[id][1]));
      }
    // The elevator lot is 15 wide; its ribbon stands at the centre.
    expect(nearest.spaceElevator).toBeGreaterThan(30);
    for (const id of tall) expect(nearest[id], id).toBeGreaterThan(20);
  });

  it('heads for the Moon and returns from it, and only on the Moon route', () => {
    const away = (toMoon, t) => headingFromPad(saucerPose(t, { toMoon }));
    for (const t of [50, 53, 56]) {
      expect(dot(away(true, t), moonHeading)).toBeGreaterThan(0.999);
      expect(dot(away(false, t), moonHeading)).toBeLessThan(0.3);
      // The pose follows the same flight the sparkle wake is shed along.
      const pose = saucerPose(t, { toMoon: true }),
        point = saucerFlightPoint(t, true, new Vector3());
      expect(point.distanceTo(new Vector3(pose.x, pose.y, pose.z))).toBeLessThan(1e-9);
    }
    for (const t of [135.5, 140, 144])
      expect(dot(away(true, t), moonHeading)).toBeGreaterThan(0.999);
    // It climbs steeply off the hover...
    const climb = (a, b) => {
      const p = saucerPose(a, { toMoon: true }),
        q = saucerPose(b, { toMoon: true });
      return (q.y - p.y) / flatDistance(p, q);
    };
    expect(climb(49.2, 49.6)).toBeGreaterThan(1);
    // ...then follows the line of sight to the drawn Moon, a few degrees above eye level,
    // so its path converges on the Moon from any camera.
    expect(climb(56, 56.9)).toBeLessThan(Math.tan((8 * Math.PI) / 180));
    expect(SAUCER_ROUTES.moon.climb).toBeGreaterThan(Math.tan((3 * Math.PI) / 180));
    expect(SAUCER_ROUTES.moon.heading).toEqual(moonHeading);
    // Off the Moon route it comes straight down from overhead.
    expect(flatDistance(saucerPose(136, { toMoon: false }), SAUCER_PAD)).toBe(0);
  });

  it.each([
    ['moonward', true, true],
    ['twin-hollows', true, true],
    ['moonward', false, false],
    ['stargazer', true, false],
    ['tomorrow', false, false],
  ])('in a %s town with the sky Moon shown: %s, flies to the Moon: %s', (era, shown, toMoon) => {
    const town = completeTown(era);
    // The elevator draws the sky Moon; a Stargazer airport still is not a Moon shuttle.
    town.buildings.spaceElevator = shown ? 1 : 0;
    expect(skyMoonShown(town)).toBe(shown);
    const d = aviationDiorama(town);
    try {
      addAviationActivity(d, town);
      const saucer = d.world.children[0];
      expect(saucer.name).toBe('Sky saucer');
      d.motions[0](53);
      expect(saucer.userData.flightToMoon).toBe(toMoon);
      expect(saucer.userData.flightPhase).toBe('departure');
      const alongMoon = dot(headingFromPad(saucer.position), moonHeading);
      if (toMoon) expect(alongMoon).toBeGreaterThan(0.999);
      else expect(alongMoon).toBeLessThan(0.3);
      expect(saucer.getObjectByName('saucerTrail').visible).toBe(true);
      expect(saucer.getObjectByName('saucerLegs').visible).toBe(false);
      d.motions[0](AIRPORT_FLIGHT_CYCLE + 0.5);
      expect(saucer.getObjectByName('saucerTrail').visible).toBe(false);
      expect(saucer.getObjectByName('saucerLegs').visible).toBe(true);
    } finally {
      disposeDiorama(d);
    }
  });

  it('keeps a flight already in the air on its route when the Moon appears', () => {
    const town = completeTown('moonward');
    town.buildings.spaceElevator = 0;
    const d = aviationDiorama(town);
    try {
      addAviationActivity(d, town);
      const saucer = d.world.children[0];
      d.motions[0](40);
      town.buildings.spaceElevator = 1;
      d.motions[0](53);
      expect(saucer.userData.flightToMoon).toBe(false);
      d.motions[0](AIRPORT_FLIGHT_CYCLE + 1);
      expect(saucer.userData.flightToMoon).toBe(true);
    } finally {
      disposeDiorama(d);
    }
  });

  it('flies the Moonward saucer from a Twin Hollows airport', () => {
    expect(completeTown('twin-hollows').buildingEras.airport).toBe('moonward');
  });
});

describe('Sky saucer evolution', () => {
  // The trail's colours live in its vertices; count the saucer's own paint.
  const colours = (root) =>
    new Set(
      meshes(root)
        .filter((m) => m.name !== 'saucerTrail')
        .map((m) => m.material.color.getHexString()),
    );

  it('gives every rounded-transport era its own saucer from its palette', () => {
    const looks = new Set();
    for (const era of ROUNDED_ERAS) {
      expect(Object.hasOwn(SKY_SAUCERS, era), era).toBe(true);
      const saucer = skySaucer(era);
      looks.add(JSON.stringify(saucer));
      for (const colour of ['shell', 'rim', 'glass', 'deep', 'light', 'traitColor'])
        expect(saucer[colour], `${era} ${colour}`).toMatch(/^#[0-9a-f]{6}$/);
    }
    expect(looks.size).toBe(ROUNDED_ERAS.length);
    expect(skySaucer('tomorrow').shell).toBe(ROUNDED_PALETTE.shell);
    expect(skySaucer('canopy').shell).toBe(COZY_PALETTES.canopy.shell);
    expect(skySaucer('stargazer').shell).toBe(FUTURE_PALETTES.observatory.roof);
    expect(skySaucer('moonward').rim).toBe(FUTURE_PALETTES.homestead.light);
  });

  it('falls back to the Tomorrow saucer for an unknown era and skips an unknown trait', () => {
    expect(skySaucer('era-from-the-future')).toBe(SKY_SAUCERS.tomorrow);
    expect(skySaucer(undefined)).toBe(SKY_SAUCERS.tomorrow);
    const d = aviationDiorama(createTown());
    try {
      const base = roundedAircraft(d, d.world, skySaucer('tomorrow'));
      const unknown = roundedAircraft(d, d.world, { ...skySaucer('canopy'), trait: 'comet-tail' });
      const leafy = roundedAircraft(d, d.world, skySaucer('canopy'));
      expect(meshes(unknown)).toHaveLength(meshes(base).length);
      expect(meshes(leafy)).toHaveLength(meshes(base).length + 2);
    } finally {
      disposeDiorama(d);
    }
  });

  it.each(ROUNDED_ERAS)('keeps the %s saucer cheap and inside the hangar bay', (era) => {
    const town = completeTown(era);
    town.buildingEras.airport = era;
    const d = aviationDiorama(town);
    try {
      addAviationActivity(d, town);
      const saucer = d.world.children[0];
      expect(meshes(saucer).length).toBeLessThanOrEqual(15);
      expect(colours(saucer).size).toBeLessThanOrEqual(6);
      const bounds = new Box3().setFromObject(saucer);
      const bay = airportLayout.hangar;
      expect(bounds.min.x).toBeGreaterThan(AIRPORT.center[0] + bay.frontX + 0.15);
      expect(bounds.max.x).toBeLessThan(AIRPORT.center[0] + bay.backX - 0.15);
      expect(bounds.min.z).toBeGreaterThan(AIRPORT.center[1] + bay.centerZ - bay.roofRadius + 0.15);
      expect(bounds.max.z).toBeLessThan(AIRPORT.center[1] + bay.centerZ + bay.roofRadius - 0.15);
      // Hovering out of the hangar it stays below the walls' height.
      d.motions[0](25);
      expect(new Box3().setFromObject(saucer).max.y).toBeLessThan(2.85);
    } finally {
      disposeDiorama(d);
    }
  });
});

describe('Sky saucer sparkle wake', () => {
  // A diorama with a saucer from the given era; `setup` adjusts the town first.
  function wake(era = 'tomorrow', setup = () => {}) {
    const town = completeTown(era);
    setup(town);
    const d = aviationDiorama(town);
    addAviationActivity(d, town);
    const saucer = d.world.children[0];
    const trail = saucer.getObjectByName('saucerTrail');
    const geometry = trail.geometry;
    // The strongest alpha among the flash's stars (the last 16 vertices) or the twinkles.
    const alpha = (from = 0, to = Infinity) => {
      const color = geometry.getAttribute('color').array;
      let most = 0;
      for (let v = from; v < Math.min(to, color.length / 4); v++)
        most = Math.max(most, color[v * 4 + 3]);
      return most;
    };
    const FLASH = geometry.getAttribute('color').count - 16;
    // Vertices are in world space: the mesh cancels the saucer's own transform.
    const worldVertex = (index) => {
      saucer.updateMatrixWorld(true);
      return new Vector3()
        .fromBufferAttribute(geometry.getAttribute('position'), index)
        .applyMatrix4(trail.matrixWorld);
    };
    return { d, saucer, trail, geometry, alpha, FLASH, worldVertex };
  }
  const span = (from, to, step = 0.05) => {
    const times = [];
    for (let t = from; t < to; t += step) times.push(t);
    return times;
  };

  it('shows only while departing or arriving, in one fixed, preallocated mesh', () => {
    const { d, saucer, trail, geometry, alpha } = wake();
    try {
      // Depth-tested against the opaque hull, which hides stars behind it, but writing
      // no depth, so the stars never hide each other; drawn after the opaque saucer.
      expect(trail.material.depthTest).toBe(true);
      expect(trail.material.depthWrite).toBe(false);
      expect(trail.material.transparent).toBe(true);
      expect(trail.renderOrder).toBe(0);
      expect(meshes(saucer).filter((m) => m.name === 'saucerTrail')).toEqual([trail]);
      // Within the existing vehicle budget, and a handful of triangles.
      expect(meshes(saucer).length).toBeLessThanOrEqual(15);
      expect(geometry.index.count / 3).toBeLessThanOrEqual(80);
      const arrays = [
        geometry.getAttribute('position').array,
        geometry.getAttribute('color').array,
      ];
      let departing = 0,
        arriving = 0;
      for (let t = 0; t < AIRPORT_FLIGHT_CYCLE; t += 0.05) {
        d.motions[0](t);
        const phase = saucerPose(t).phase;
        const shown = trail.visible && saucer.visible;
        // The flash bursts just before the saucer moves off the hover.
        if (phase === 'departure' || phase === 'approach' || (t >= 48.5 && t < 49)) {
          if (phase === 'departure') departing = Math.max(departing, alpha());
          if (phase === 'approach') arriving = Math.max(arriving, alpha());
        } else expect(shown, `at ${t.toFixed(2)} (${phase})`).toBe(false);
      }
      // Plainly visible on the way out and, mirrored, on the way in.
      expect(departing).toBeGreaterThan(0.5);
      expect(arriving).toBeGreaterThan(0.5);
      // The same buffers are rewritten every frame; nothing is reallocated.
      expect(geometry.getAttribute('position').array).toBe(arrays[0]);
      expect(geometry.getAttribute('color').array).toBe(arrays[1]);
      expect([...arrays[0]].every(Number.isFinite)).toBe(true);
    } finally {
      disposeDiorama(d);
    }
  });

  it('bursts a flash with a brief bright centre, then sheds twinkles behind it', () => {
    const { d, saucer, alpha, FLASH, worldVertex } = wake();
    try {
      // The flash opens at the hover point just before the leap; its centre is solid.
      d.motions[0](48.95);
      expect(alpha(FLASH)).toBeGreaterThan(0.95);
      const hover = saucerFlightPoint(49, false, new Vector3());
      expect(worldVertex(FLASH + 8).distanceTo(hover)).toBeLessThan(4);
      // The centre fades first; the halo lingers a little longer, then both are gone.
      d.motions[0](49.5);
      expect(alpha(FLASH + 8)).toBeLessThan(alpha(FLASH, FLASH + 8));
      d.motions[0](49.9);
      expect(alpha(FLASH)).toBe(0);
      // Twinkles stay where they were shed while the saucer flies on.
      let twinkle = 0;
      for (const t of span(50, 52)) {
        d.motions[0](t);
        twinkle = Math.max(twinkle, alpha(0, FLASH));
      }
      expect(twinkle).toBeGreaterThan(0.4);
      // A fresh twinkle starts behind the hull, at hull height, not under it: shed 0.02 s
      // ago (twinkle 45, in slot 45 mod 16) it is well back along the line of travel.
      d.motions[0](52.02);
      const centre = new Vector3();
      for (let v = 13 * 8; v < 14 * 8; v++) centre.add(worldVertex(v));
      centre.multiplyScalar(1 / 8);
      const hull = saucer.position.clone();
      hull.y += SAUCER_HULL;
      const ahead = saucerFlightPoint(52.07, false, new Vector3()).sub(saucer.position).normalize();
      expect(centre.clone().sub(hull).dot(ahead)).toBeLessThan(-1.5);
      expect(Math.abs(centre.y - hull.y)).toBeLessThan(2);
      // Older twinkles stay where they were shed while the saucer flies on.
      d.motions[0](52.5);
      expect(worldVertex(13 * 8).distanceTo(centre)).toBeLessThan(3);
      expect(saucer.position.distanceTo(centre)).toBeGreaterThan(6);
    } finally {
      disposeDiorama(d);
    }
  });

  it('mirrors the wake on arrival: a flash where it drops in, twinkles following it', () => {
    const { d, alpha, FLASH, worldVertex } = wake('moonward');
    try {
      d.motions[0](135.2);
      expect(alpha(FLASH)).toBeGreaterThan(0.9);
      const dropIn = saucerFlightPoint(135, true, new Vector3());
      expect(worldVertex(FLASH + 8).distanceTo(dropIn)).toBeLessThan(4);
      let twinkle = 0;
      for (const t of span(136, 145)) {
        d.motions[0](t);
        twinkle = Math.max(twinkle, alpha(0, FLASH));
      }
      expect(twinkle).toBeGreaterThan(0.4);
    } finally {
      disposeDiorama(d);
    }
  });

  it('takes the era colours, and a blue-silver on the Moon route', () => {
    const has = (geometry, hex) => {
      const target = new Color(hex),
        color = geometry.getAttribute('color').array;
      for (let i = 0; i < color.length; i += 4)
        if (
          color[i + 3] > 0.05 &&
          Math.abs(color[i] - target.r) < 0.02 &&
          Math.abs(color[i + 1] - target.g) < 0.02 &&
          Math.abs(color[i + 2] - target.b) < 0.02
        )
          return true;
      return false;
    };
    const sky = wake('canopy');
    const moon = wake('moonward', (town) => (town.buildings.spaceElevator = 1));
    const plain = wake('moonward', (town) => (town.buildings.spaceElevator = 0));
    try {
      const { light, secondary } = saucerTrailColors(skySaucer('canopy'));
      expect(secondary).toBe(skySaucer('canopy').traitColor);
      // Moonward's trait colour is its light, so its rim carries the wake instead.
      expect(saucerTrailColors(skySaucer('moonward')).secondary).toBe(skySaucer('moonward').rim);
      const seen = new Set();
      for (const t of span(48.6, 52.5, 0.1)) {
        for (const view of [sky, moon, plain]) view.d.motions[0](t);
        for (const hex of [light, secondary]) if (has(sky.geometry, hex)) seen.add(hex);
        if (has(moon.geometry, TRAIL_SILVER)) seen.add('moon silver');
        if (has(plain.geometry, TRAIL_SILVER)) seen.add('silver without the Moon');
      }
      expect([...seen].sort()).toEqual(['moon silver', light, secondary].sort());
    } finally {
      for (const view of [sky, moon, plain]) disposeDiorama(view.d);
    }
  });

  it('leaves the wake off with reduced motion', () => {
    const { d, saucer, trail } = wake();
    try {
      d.reducedMotion = true;
      for (const t of [48.9, 49.5, 50, 52, 136, 140]) {
        d.motions[0](t);
        expect(saucer.visible).toBe(true);
        expect(trail.visible, `${t}`).toBe(false);
      }
    } finally {
      disposeDiorama(d);
    }
  });
});

describe('Plane variation', () => {
  it('varies liveries and departures by visit, deterministically and only while away', () => {
    const seen = new Set();
    let previous;
    for (let t = 0; t < AIRPORT_FLIGHT_CYCLE * 9; t += 0.5) {
      const flight = airplaneFlight(t);
      expect(airplaneFlight(t)).toEqual(flight);
      if (previous && flight.flight !== previous.flight) {
        // The plane changes while it is out of sight.
        expect(airplanePose(t).visible).toBe(false);
        expect(flight.livery).not.toBe(previous.livery);
        expect(flight.departure).not.toBe(previous.departure);
      }
      seen.add(`${flight.livery}:${PLANE_DEPARTURES.indexOf(flight.departure)}`);
      previous = flight;
    }
    // Nine visits fly every livery with every departure.
    expect(seen.size).toBe(9);
    // The first profile is the original departure.
    expect(PLANE_DEPARTURES[0]).toEqual({ liftoff: 22, climb: 0.38, turn: 0 });
  });

  it('flies every departure smoothly, leaving the runway line only once airborne', () => {
    for (const [index, departure] of PLANE_DEPARTURES.entries()) {
      const visit = [...Array(9).keys()].find(
        (v) => airplaneFlight((v + 0.3) * AIRPORT_FLIGHT_CYCLE).departure === departure,
      );
      const start = visit * AIRPORT_FLIGHT_CYCLE;
      let previous;
      let maxRoll = 0;
      for (let t = start + 48; t < start + 70; t += 0.05) {
        const pose = airplanePose(t);
        expect(pose.phase).toBe('takeoff');
        if (pose.y < 4) expect(pose.x).toBe(AIRPORT.runwayX);
        // Every track, turned or straight, keeps clear of the railway until it fades.
        if (pose.y < 4) expect(pose.z).toBeGreaterThan(RAIL_EDGE.from[1] + 4);
        if (Math.abs(pose.z - RAIL_EDGE.from[1]) < 4) expect(pose.y).toBeGreaterThan(4);
        // A turn heads away from the town.
        expect(pose.x).toBeLessThanOrEqual(AIRPORT.runwayX);
        expect(pose.y - groundHeight(pose.x, pose.z)).toBeGreaterThan(0.1);
        if (previous) {
          expect(
            Math.hypot(pose.x - previous.x, pose.y - previous.y, pose.z - previous.z),
          ).toBeLessThan(0.5);
          expect(turnBetween(previous.yaw, pose.yaw)).toBeLessThan(0.02);
          expect(Math.abs(pose.roll - previous.roll)).toBeLessThan(0.02);
        }
        maxRoll = Math.max(maxRoll, Math.abs(pose.roll));
        previous = pose;
      }
      expect(airplanePose(start + 65).y, `${index}`).toBeGreaterThan(10);
      if (departure.turn) {
        expect(maxRoll).toBeGreaterThan(0.25);
        expect(previous.x).toBeLessThan(AIRPORT.runwayX - 10);
        expect(previous.roll).toBeCloseTo(0, 2);
      } else expect(maxRoll).toBe(0);
    }
  });

  it.each(['aviation', 'broadcast', 'contemporary'])(
    'repaints the %s plane accent with each livery on later visits',
    (era) => {
      const town = completeTown(era);
      town.buildingEras.airport = era;
      const appearance = airportAppearance(era);
      expect(appearance.liveries[0]).toBe(appearance.liveryAccent);
      const d = aviationDiorama(town);
      try {
        addAviationActivity(d, town);
        const plane = d.world.children[0];
        const accents = () => {
          const found = new Set();
          plane.traverse((o) => {
            if (o.isMesh && /tail fin/i.test(o.name))
              found.add(`#${o.material.color.getHexString()}`);
          });
          return [...found];
        };
        const painted = [];
        for (let visit = 0; visit < 3; visit++) {
          const t = visit * AIRPORT_FLIGHT_CYCLE + 180;
          d.motions[0](t);
          painted.push(accents());
          expect(painted[visit]).toEqual([appearance.liveries[airplaneFlight(t).livery]]);
        }
        expect(new Set(painted.flat()).size).toBe(3);
      } finally {
        disposeDiorama(d);
      }
    },
  );
});

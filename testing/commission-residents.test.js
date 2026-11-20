import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import {
  COMMISSIONS,
  COMMISSION_CARRIES,
  COMMISSION_STAYS,
  MAX_COMMISSION_VILLAGERS,
  commissionFor,
  commissionUse,
  commissionVillagers,
} from '../src/data/commissions';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  advanceMonumentWorks,
  landmarkOffer,
  monumentWork,
  purchaseLandmark,
  unveilLandmark,
} from '../src/data/townLandmarks';
import { moonCommissionVenues } from '../src/data/moonSettlement';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { VALLEY_COMMISSION_GROUNDS } from '../src/game/town/TownCommissionLandmarks';
import {
  COMMISSION_DOOR_TIME,
  addCommissionResidents,
  animateCommissionResident,
  commissionGrounds,
  commissionResidentDay,
  valleyHomes,
} from '../src/game/town/TownCommissionResidents';
import { routinePose } from '../src/game/town/TownCommissionUse';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownItineraries } from '../src/game/town/TownItineraries';
import { TownNavigation } from '../src/game/town/TownNavigation';
import {
  PLOTS,
  routeGraph,
  segmentDistance,
  siteFootpath,
  townTracks,
} from '../src/game/town/TownLayout';
import { swingLimbs, VILLAGER_WALK_SPEED } from '../src/game/town/TownGait';
import { areaUnlocked } from '../src/data/townLandmarks';
import { openSite } from './helpers/siteOpening';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import {
  MOON_DOOR_TIME,
  MOON_WALK_SPEED,
  animateMoonSettler,
  createMoonSettlers,
  moonHatch,
  moonSettlerPlan,
  moonSettlerPose,
} from '../src/game/town/moon/MoonSettlers';

// A finished commission is visibly used: residents walk to it along the public paths and
// do what its outcome promises. Nothing new is saved, so an unfinished or unchosen
// commission draws nobody, and a future commission without routine data still works.
const valleySite = AREA_BY_ID['homecoming-commons'];
const moonSite = AREA_BY_ID['earthlight-conservatory'];
const valleyEntry = commissionFor(valleySite.id);
const VALLEY_SITES = COMMISSIONS.map(({ site }) => AREA_BY_ID[site]).filter(
  (site) => site.settlement === 'valley',
);
const moonEntry = commissionFor(moonSite.id);
const views = [];
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.scene);
    d.disposePrimitives();
  }
});

const buy = (town, area, choice) =>
  purchaseLandmark(town, {
    id: area.id,
    slot: 0,
    value: choice,
    ...landmarkOffer(town, area, choice),
  });
const finish = (town, area, level = 1) => {
  while (!monumentWork(town, area).ready) town = advanceMonumentWorks(town);
  return unveilLandmark(town, area.id, level);
};
// A Twin Hollows valley with every plot built, so the garden district's homes stand.
function valleyTown() {
  const town = createTown();
  town.era = 'twin-hollows';
  town.coins = 1e9;
  for (const id of Object.keys(PLOTS)) town.buildings[id] = 1;
  town.buildings.homecomingHall = 3;
  return town;
}
function moonTown() {
  const town = createTown();
  town.era = 'twin-hollows';
  town.coins = 1e9;
  Object.assign(town.buildings, {
    earthlightGreenhouse: 3,
    settlerDomes: 3,
    craterHomesteads: 3,
    willowkinDome: 3,
    newHollowCommons: 3,
  });
  return town;
}
// Village life without a renderer: the real itineraries over the real street graph.
function valley(town) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    town,
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    scene: new Scene(),
    world: new Group(),
    motions: [],
    actors: [],
    elapsed: 0,
    navigation: new TownNavigation(),
    sign() {},
  });
  d.scene.add(d.world);
  d.itineraries = new TownItineraries(d);
  for (const _ of addCommissionResidents(d, town)) void _;
  views.push(d);
  return d;
}
const gap = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
// The commons faces south, so its site coordinates only shift into the world.
const toWorld = (area, [x, lift, z]) => {
  const [sx, sz] = area.positions[0];
  return [sx + x, lift, sz + z];
};
const walks = (day) => day.segments.filter(({ route }) => route);

describe('the routine contract', () => {
  it.each(
    COMMISSIONS.flatMap(({ site, outcomes }) => Object.keys(outcomes).map((id) => [site, id])),
  )('%s / %s says what its residents do there', (site, id) => {
    const outcome = commissionFor(site).outcomes[id];
    expect(COMMISSION_STAYS).toContain(outcome.use.stay);
    expect(commissionUse(outcome)).toEqual({
      stay: outcome.use.stay,
      carry: outcome.use.carry ?? null,
      young: outcome.use.young ?? false,
    });
    if (outcome.use.carry) expect(COMMISSION_CARRIES).toContain(outcome.use.carry);
  });

  it.each(COMMISSIONS)('$site makes each outcome look different', ({ outcomes }) => {
    const looks = Object.values(outcomes).map((outcome) => JSON.stringify(commissionUse(outcome)));
    expect(new Set(looks).size).toBe(Object.keys(outcomes).length);
  });

  it('falls back to gathering at the front when a commission says nothing', () => {
    const plain = { stay: 'gather', carry: null, young: false };
    expect(commissionUse(undefined)).toEqual(plain);
    expect(commissionUse({ visits: {} })).toEqual(plain);
    expect(commissionUse({ use: { stay: 'dance', carry: 'anvil', young: 'yes' } })).toEqual(plain);
    expect(commissionVillagers({ visits: {} })).toBe(1);
    expect(commissionVillagers({ visits: { villager: 40 } })).toBe(MAX_COMMISSION_VILLAGERS);
    expect(commissionVillagers({ visits: { villager: 0 } })).toBe(0);
  });
});

// Every mesh the site draws at a stage, in site coordinates. Floors (the pedestal steps,
// the meadow's lawn) rise less than a step above the walker and are walked on.
function solids(choice, stage) {
  const d = new TownPrimitives();
  views.push(Object.assign(d, { scene: new Group() }));
  const root = buildLandmark(d, d.scene, choice, stage);
  root.updateMatrixWorld(true);
  const boxes = [];
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const box = new Box3().setFromObject(mesh);
    // Upright drums (the bandstand's floor, the meadow's lawn) are round, not square.
    const { radiusTop, radiusBottom } = mesh.geometry.parameters ?? {};
    if (mesh.geometry.type === 'CylinderGeometry' && !mesh.rotation.x && !mesh.rotation.z) {
      const centre = box.getCenter(new Vector3());
      box.round = {
        x: centre.x,
        z: centre.z,
        r: Math.max(radiusTop, radiusBottom) * mesh.getWorldScale(new Vector3()).x,
      };
    }
    boxes.push(box);
  });
  return boxes;
}
function* samples(points, step = 0.1) {
  for (let n = 1; n < points.length; n++) {
    const a = points[n - 1],
      b = points[n];
    const count = Math.max(1, Math.ceil(gap(a, b) / step));
    for (let s = 0; s <= count; s++) {
      const t = s / count;
      yield a.map((v, i) => v + (b[i] - v) * t);
    }
  }
}
function blocked(boxes, [x, y, z], radius, height) {
  return boxes.find(
    (box) =>
      box.max.y > y + 0.25 &&
      box.min.y < y + height &&
      box.min.x < x + radius &&
      box.max.x > x - radius &&
      box.min.z < z + radius &&
      box.max.z > z - radius &&
      (!box.round || Math.hypot(x - box.round.x, z - box.round.z) < box.round.r + radius),
  );
}
const trim = (points, length) => {
  // The last `length` of a walk into a door, where the walker passes through it.
  let left = 0;
  for (let n = points.length - 1; n > 0; n--) {
    left += gap(points[n], points[n - 1]);
    if (left >= length) return points.slice(0, n);
  }
  return points.slice(0, 1);
};

describe('the valley commission grounds', () => {
  const cases = VALLEY_SITES.flatMap((site) =>
    site.choices.flatMap((choice) => [1, 2, 3, 4, 5].map((stage) => [choice, stage, site])),
  );
  it.each(cases)(
    '%s at stage %i lets every visitor reach its place clear of the art',
    (choice, stage, site) => {
      const outcome = commissionFor(site.id).outcomes[choice];
      const use = commissionUse(outcome);
      const size = use.young ? 0.68 : 1;
      const boxes = solids(choice, stage);
      for (let n = 0; n < commissionVillagers(outcome); n++) {
        const court = commissionGrounds(LANDMARK_BY_ID[choice].form, use, n, site.radius);
        expect(court.stay).toBe(use.stay);
        const approach = court.stay === 'enter' ? trim(court.approach, 0.35) : court.approach;
        for (const walk of [approach, court.loop ?? []])
          for (const point of samples(walk)) {
            const hit = blocked(boxes, point, 0.2 * size, 1.7 * size);
            expect(
              hit,
              `${choice} ${stage} visitor ${n} at ${point.map((v) => v.toFixed(2))}`,
            ).toBe(undefined);
          }
      }
    },
  );

  it('takes story hall visitors to its door and up onto the court floor', () => {
    const use = commissionUse(valleyEntry.outcomes['story-hall']);
    const { approach } = commissionGrounds('story-hall', use, 0, valleySite.radius);
    const [dx, dz] = VALLEY_COMMISSION_GROUNDS['story-hall'].door;
    expect(gap(approach.at(-1), [dx, 0, dz])).toBeLessThan(1e-9);
    expect(approach.at(-1)[1]).toBeCloseTo(VALLEY_COMMISSION_GROUNDS.floor + 0.07);
    // Starts on the field before the site, below the pedestal's rim.
    expect(Math.hypot(approach[0][0], approach[0][2])).toBeGreaterThan(valleySite.radius);
    expect(approach[0][1]).toBeCloseTo(0.07);
    // The height never jumps more than a step between samples.
    for (let n = 1; n < approach.length; n++)
      expect(Math.abs(approach[n][1] - approach[n - 1][1])).toBeLessThanOrEqual(0.21);
  });

  it('places the bandstand audience apart, on its arc and facing the stage', () => {
    const use = commissionUse(valleyEntry.outcomes.bandstand);
    const places = Array.from(
      { length: commissionVillagers(valleyEntry.outcomes.bandstand) },
      (_, n) => commissionGrounds('bandstand', use, n, valleySite.radius),
    );
    for (const { approach, face } of places) {
      const end = approach.at(-1);
      expect(Math.hypot(end[0], end[2])).toBeCloseTo(VALLEY_COMMISSION_GROUNDS.bandstand.audience);
      expect(end[2]).toBeGreaterThan(0);
      expect(face.slice(0, 1).concat(face[2])).toEqual([0, 0]);
    }
    for (let a = 0; a < places.length; a++)
      for (let b = a + 1; b < places.length; b++)
        expect(gap(places[a].approach.at(-1), places[b].approach.at(-1))).toBeGreaterThan(1);
  });

  it('keeps the children inside the meadow once through its gate', () => {
    const use = commissionUse(valleyEntry.outcomes['wild-meadow']);
    const { lawn } = VALLEY_COMMISSION_GROUNDS['wild-meadow'];
    for (let n = 0; n < 3; n++) {
      const { loop } = commissionGrounds('wild-meadow', use, n, valleySite.radius);
      expect(loop[0]).toEqual(loop.at(-1));
      for (const point of loop) expect(Math.hypot(point[0], point[2])).toBeLessThan(lawn - 0.5);
    }
  });

  it.each(['seedling-grove', 'lantern-orchard'])(
    'keeps %s visitors on its lawn once through its gate',
    (form) => {
      const outcome = commissionFor('willowkin-glade').outcomes[form];
      const { lawn } = VALLEY_COMMISSION_GROUNDS[form];
      for (let n = 0; n < commissionVillagers(outcome); n++) {
        const { stay, loop } = commissionGrounds(form, commissionUse(outcome), n, 7);
        expect(stay).toBe('roam');
        expect(loop[0]).toEqual(loop.at(-1));
        for (const point of loop) expect(Math.hypot(point[0], point[2])).toBeLessThan(lawn - 0.5);
      }
    },
  );

  it('gathers the story tree’s audience on its arc, apart, facing the tree', () => {
    const outcome = commissionFor('willowkin-glade').outcomes['story-tree'];
    const use = commissionUse(outcome);
    expect(use).toMatchObject({ stay: 'gather', young: true });
    const places = Array.from({ length: commissionVillagers(outcome) }, (_, n) =>
      commissionGrounds('story-tree', use, n, 7),
    );
    for (const { approach, face } of places) {
      const end = approach.at(-1);
      expect(Math.hypot(end[0], end[2])).toBeCloseTo(
        VALLEY_COMMISSION_GROUNDS['story-tree'].audience,
      );
      expect(end[2]).toBeGreaterThan(0);
      expect([face[0], face[2]]).toEqual([0, 0]);
    }
    for (let a = 0; a < places.length; a++)
      for (let b = a + 1; b < places.length; b++)
        expect(gap(places[a].approach.at(-1), places[b].approach.at(-1))).toBeGreaterThan(1);
  });

  it('gathers a future form without grounds before the site, outside its court', () => {
    for (const use of [commissionUse(undefined), { stay: 'enter', carry: null, young: false }]) {
      const places = [0, 1, 2].map((n) =>
        commissionGrounds('future-form', use, n, valleySite.radius),
      );
      for (const { stay, approach, face } of places) {
        expect(stay).toBe('gather');
        expect(face).toBeTruthy();
        for (const point of approach)
          expect(Math.hypot(point[0], point[2])).toBeGreaterThan(valleySite.radius);
      }
      expect(new Set(places.map(({ approach }) => approach.at(-1).join())).size).toBe(3);
    }
  });
});

describe.each(VALLEY_SITES)('valley townsfolk at the finished $id', (site) => {
  const entry = commissionFor(site.id);
  // The valley town with the site open: its building finished or an earlier commission paid.
  const siteTown = () => openSite(valleyTown(), site);
  it.each([
    ['no choice yet', (town) => town],
    ['a design still being built', (town) => buy(town, site, site.choices[1])],
    [
      'a saved design this build does not know',
      (town) => {
        const built = finish(buy(town, site, site.choices[1]), site);
        built.personalisation.areas[site.id] = ['retired-design'];
        return built;
      },
    ],
  ])('draws nobody for %s', (_, change) => {
    const d = valley(change(siteTown()));
    expect(d.commissionResidents ?? []).toEqual([]);
    expect(d.world.children).toEqual([]);
  });

  it.each(site.choices)('%s sends its residents along the streets from real homes', (choice) => {
    const town = finish(buy(siteTown(), site, choice), site);
    const d = valley(town);
    const outcome = entry.outcomes[choice];
    expect(d.commissionResidents).toHaveLength(commissionVillagers(outcome));
    const roads = townTracks(town).filter(({ modes }) => modes.includes('pedestrian'));
    const homes = valleyHomes(town);
    for (const { day } of d.commissionResidents) {
      const there = walks(day)[0].route.points;
      // Out of a home's own door...
      const home = day.segments.at(-1).inside;
      expect(homes).toContain(home);
      expect(gap(there[0], d.itineraries.endpoint(home, true))).toBeLessThan(1e-6);
      // ...straight onto the streets, along them without cutting across a lot, then down
      // the site's footpath: every step from the home to the site's front is on a street
      // or on the middle of that path, and never out across the open field.
      const footpath = siteFootpath(town, site.id);
      expect(footpath).toBeTruthy();
      const streets = roads.filter((road) => !road.footpath);
      const onStreet = (p) =>
        streets.some(({ from, to }) => segmentDistance(p[0], p[2], from, to) <= 1.6);
      const onPath = (p) =>
        footpath.slice(1).some((to, n) => segmentDistance(p[0], p[2], footpath[n], to) <= 0.05);
      // The path's last corner but one is the court's front; its last stretch runs on to
      // the court's edge, under the court's own lane.
      const front = [footpath.at(-2)[0], 0, footpath.at(-2)[1]];
      const [sx0, sz0] = site.positions[0];
      expect(Math.hypot(footpath.at(-1)[0] - sx0, footpath.at(-1)[1] - sz0)).toBeLessThan(
        site.radius,
      );
      const arrives = there.findIndex((p) => gap(p, front) < 0.05);
      expect(arrives).toBeGreaterThan(0);
      const kinds = there.slice(0, arrives + 1).map((p) => (onPath(p) ? 'path' : onStreet(p)));
      const joins = kinds.indexOf(true),
        takesPath = kinds.indexOf('path');
      expect(joins).toBeLessThanOrEqual(2);
      expect(takesPath).toBeGreaterThan(joins);
      expect(kinds.slice(joins, takesPath).every((kind) => kind === true)).toBe(true);
      expect(kinds.slice(takesPath).every((kind) => kind === 'path')).toBe(true);
      // The path is walked from end to end, and no step along it is longer than a stride.
      expect(gap(there[takesPath], [footpath[0][0], 0, footpath[0][1]])).toBeLessThan(1.1);
      for (let n = takesPath + 1; n <= arrives; n++)
        expect(gap(there[n], there[n - 1])).toBeLessThanOrEqual(0.76);
      // The path starts on a wide street and ends where the court's own lane begins.
      const wide = streets.filter(({ width }) => width >= 0.85);
      expect(
        Math.min(...wide.map(({ from, to }) => segmentDistance(...footpath[0], from, to))),
      ).toBeLessThan(1e-6);
      const court = commissionGrounds(
        LANDMARK_BY_ID[choice].form,
        commissionUse(outcome),
        0,
        site.radius,
      );
      expect(gap(front, toWorld(site, court.approach[0]))).toBeLessThan(0.05);
      // ...and ends in the site's court.
      const [sx, sz] = site.positions[0];
      expect(Math.hypot(there.at(-1)[0] - sx, there.at(-1)[2] - sz)).toBeLessThan(site.radius);
    }
  });

  it('opens the footpath with its site, draws it as a narrow path and keeps errands off it', () => {
    const town = siteTown();
    const footpath = siteFootpath(town, site.id);
    const tracks = townTracks(town).filter((track) => track.footpath === site.id);
    expect(tracks).toHaveLength(footpath.length - 1);
    for (const track of tracks) {
      expect(track).toMatchObject({ width: 0.75, modes: ['pedestrian'], footpath: site.id });
      // Axis-aligned, like every valley path.
      expect(track.from[0] === track.to[0] || track.from[1] === track.to[1]).toBe(true);
    }
    // Clear of every lot and every other site it passes.
    for (const id of Object.keys(PLOTS)) {
      const [x, z] = PLOTS[id];
      for (const { from, to } of tracks)
        expect(segmentDistance(x, z, from, to), id).toBeGreaterThan(5.5);
    }
    for (const area of Object.values(AREA_BY_ID).filter(
      (area) => area.settlement === 'valley' && area.id !== site.id,
    ))
      for (const { from, to } of tracks)
        expect(segmentDistance(...area.positions[0], from, to), area.id).toBeGreaterThan(
          area.radius,
        );
    // Not part of the street graph: no vehicle or ordinary errand takes it.
    for (const mode of ['pedestrian', 'car'])
      for (const node of routeGraph(town, mode).nodes.values())
        expect(node[1], mode).toBeGreaterThan(-60);
    // It is laid with the plot of the building that opens the site, or with the era, so
    // whatever opens the site itself (that building's level, or a purchase elsewhere)
    // changes no street, and so swaps one plot instead of rebuilding the town.
    const building = site.opens.building;
    const early = building
      ? { ...town, buildings: { ...town.buildings, [building]: 1 } }
      : valleyTown();
    expect(areaUnlocked(early, site)).toBe(false);
    expect(JSON.stringify(townTracks(early))).toBe(JSON.stringify(townTracks(town)));
    // Before the site's era there is no path, and an unknown site has none.
    expect(siteFootpath({ ...town, era: 'moonward' }, site.id)).toBeNull();
    expect(townTracks({ ...town, era: 'moonward' }).some((track) => track.footpath)).toBe(false);
    expect(siteFootpath(town, 'no-such-site')).toBeNull();
    expect(siteFootpath(town, 'meadow')).toBeNull();
  });
});

describe('valley townsfolk at the finished commons', () => {
  const pose = (resident, segment, elapsed) =>
    routinePose(
      resident.day,
      segment.start + elapsed,
      VILLAGER_WALK_SPEED,
      COMMISSION_DOOR_TIME,
      {},
    );

  it('story hall visitors go in through its door, listen inside and bring a book home', () => {
    const town = finish(buy(valleyTown(), valleySite, 'story-hall'), valleySite);
    const d = valley(town);
    const [dx, dz] = VALLEY_COMMISSION_GROUNDS['story-hall'].door;
    const door = toWorld(valleySite, [dx, 0, dz]);
    for (const resident of d.commissionResidents) {
      const [there, inside, back] = resident.day.segments;
      expect(inside.inside).toBe(valleySite.id);
      const arriving = pose(resident, there, there.duration - 1e-6);
      expect(arriving.scale).toBeCloseTo(0, 3);
      expect(gap([arriving.x, 0, arriving.z], door)).toBeLessThan(1e-6);
      expect(pose(resident, inside, 1).visible).toBe(false);
      const leaving = pose(resident, back, COMMISSION_DOOR_TIME / 2);
      expect(leaving.scale).toBeCloseTo(0.5);
      expect(leaving.carry).toBe('book');
      expect(pose(resident, there, there.duration / 2).carry).toBe(null);
    }
  });

  it('the bandstand audience stands facing the stage, carrying nothing', () => {
    const town = finish(buy(valleyTown(), valleySite, 'bandstand'), valleySite);
    const d = valley(town);
    const [sx, sz] = valleySite.positions[0];
    for (const resident of d.commissionResidents) {
      const stand = resident.day.segments.find((segment) => segment.stand);
      expect(stand.duration).toBeGreaterThan(100);
      expect(resident.day.segments.some(({ inside }) => inside === valleySite.id)).toBe(false);
      const place = pose(resident, stand, 10);
      expect(place).toMatchObject({ visible: true, scale: 1, standing: true, walking: false });
      expect(Math.cos(place.heading - Math.atan2(sx - place.x, sz - place.z))).toBeCloseTo(1, 6);
      expect(walks(resident.day).every(({ carry }) => !carry)).toBe(true);
    }
  });

  it('meadow children play inside the fence and are drawn child-sized', () => {
    const town = finish(buy(valleyTown(), valleySite, 'wild-meadow'), valleySite);
    const d = valley(town);
    const [sx, sz] = valleySite.positions[0];
    const { lawn } = VALLEY_COMMISSION_GROUNDS['wild-meadow'];
    for (const resident of d.commissionResidents) {
      const laps = walks(resident.day).slice(1, -1);
      expect(laps.length).toBeGreaterThanOrEqual(3);
      for (const lap of laps)
        for (const [x, , z] of lap.route.points)
          expect(Math.hypot(x - sx, z - sz)).toBeLessThan(lawn);
      const time = laps[0].start + laps[0].duration / 2 - resident.offset;
      animateCommissionResident(d, resident, time);
      expect(resident.actor.root.visible).toBe(true);
      expect(resident.actor.root.scale.x).toBeCloseTo(0.68);
    }
  });

  it('walks with the valley skeleton and the shared stride', () => {
    const town = finish(buy(valleyTown(), valleySite, 'bandstand'), valleySite);
    const d = valley(town);
    const resident = d.commissionResidents[0];
    const there = walks(resident.day)[0];
    let strides = 0;
    for (let t = 2; t < 30; t += 0.7) {
      const p = animateCommissionResident(d, resident, there.start + t - resident.offset);
      const reference = [0, 1].map(() => ({ upper: { rotation: {} }, lower: { rotation: {} } }));
      const legs = [0, 1].map(() => ({ upper: { rotation: {} }, lower: { rotation: {} } }));
      swingLimbs(reference, legs, (p.distance / 0.58) * Math.PI * 2, true);
      expect(resident.actor.legs.map(({ upper }) => upper.rotation.x)).toEqual(
        legs.map(({ upper }) => expect.closeTo(upper.rotation.x, 9)),
      );
      if (Math.abs(legs[0].upper.rotation.x) > 0.1) strides++;
    }
    expect(strides).toBeGreaterThan(10);
  });
});

describe('valley townsfolk at the finished Willowkin Glade', () => {
  const glade = AREA_BY_ID['willowkin-glade'];
  const outcomes = commissionFor(glade.id).outcomes;
  const pose = (resident, segment, elapsed) =>
    routinePose(
      resident.day,
      segment.start + elapsed,
      VILLAGER_WALK_SPEED,
      COMMISSION_DOOR_TIME,
      {},
    );
  const village = (choice) =>
    valley(finish(buy(openSite(valleyTown(), glade), glade, choice), glade));
  const residents = (choice) => village(choice).commissionResidents;

  it.each([
    ['seedling-grove', 'sapling'],
    ['lantern-orchard', 'fruit'],
  ])('%s visitors wander its lawn and carry a %s home', (choice, carry) => {
    const [sx, sz] = glade.positions[0];
    const { lawn } = VALLEY_COMMISSION_GROUNDS[choice];
    const list = residents(choice);
    expect(list).toHaveLength(commissionVillagers(outcomes[choice]));
    for (const resident of list) {
      const laps = walks(resident.day).slice(1, -1);
      expect(laps.length).toBeGreaterThanOrEqual(3);
      for (const lap of laps)
        for (const [x, , z] of lap.route.points)
          expect(Math.hypot(x - sx, z - sz)).toBeLessThan(lawn);
      const home = walks(resident.day).at(-1);
      expect(pose(resident, home, 1).carry).toBe(carry);
      expect(pose(resident, walks(resident.day)[0], 1).carry).toBe(null);
    }
  });

  it('story tree children gather facing the tree and are drawn child-sized', () => {
    const [sx, sz] = glade.positions[0];
    const d = village('story-tree');
    const list = d.commissionResidents;
    expect(list).toHaveLength(commissionVillagers(outcomes['story-tree']));
    for (const resident of list) {
      const stand = resident.day.segments.find((segment) => segment.stand);
      const place = pose(resident, stand, 10);
      expect(place).toMatchObject({ visible: true, standing: true, walking: false });
      expect(Math.cos(place.heading - Math.atan2(sx - place.x, sz - place.z))).toBeCloseTo(1, 6);
      animateCommissionResident(d, resident, stand.start + 10 - resident.offset);
      expect(resident.actor.root.scale.x).toBeCloseTo(0.68);
    }
  });
});

describe('Moon settlers at the finished conservatory', () => {
  const kit = () => {
    const d = new TownPrimitives();
    views.push(Object.assign(d, { scene: new Group() }));
    return d;
  };

  it.each(moonSite.choices)('%s brings home what its outcome gives', (choice) => {
    const town = finish(buy(moonTown(), moonSite, choice), moonSite);
    const venues = moonCommissionVenues(town);
    const { use, visits } = moonEntry.outcomes[choice];
    const plan = moonSettlerPlan(town.buildings, 0, null, venues);
    const carrying = walks(plan).filter(({ carry }) => carry);
    expect(carrying).toHaveLength(visits.settler);
    for (const walk of carrying) {
      expect(walk.carry).toBe(use.carry);
      expect(walk.route.from).toBe(moonSite.id);
    }
    // Only figures that bring something home hold an item, shown on the way back only.
    const d = kit();
    const settlers = createMoonSettlers(d, d.scene, town.buildings, venues);
    const settler = settlers[0];
    const items = new Map(settler.items);
    expect([...items.keys()]).toEqual(use.carry ? [use.carry] : []);
    if (use.carry) expect(items.get(use.carry).name).toBe(`Carried ${use.carry}`);
    for (const segment of walks(settler.plan)) {
      animateMoonSettler(settler, segment.start + segment.duration / 2 - settler.plan.offset);
      if (use.carry) expect(items.get(use.carry).visible).toBe(!!segment.carry);
    }
    expect(settlers.filter(({ plan }) => !plan.segments).every(({ items }) => !items?.length)).toBe(
      true,
    );
  });

  it('shares settler trips between several finished commissions, each bringing its own item', () => {
    // A bakehouse asks for every trip of the day; the school's and crews' commissions still
    // get residents, and a resident who visits two carries each one's item home in turn.
    let town = moonTown();
    town.era = 'hollow-rising';
    Object.assign(town.buildings, { craterSchool: 3, expeditionGarage: 3 });
    for (const [id, choice] of [
      ['earthlight-conservatory', 'earthlight-bakehouse'],
      ['schoolyard-court', 'little-planetarium'],
      ['crew-yard', 'mapmakers-hall'],
    ])
      town = finish(buy(town, AREA_BY_ID[id], choice), AREA_BY_ID[id]);
    const venues = moonCommissionVenues(town);
    expect(venues.map(({ id }) => id).sort()).toEqual(
      ['crew-yard', 'earthlight-conservatory', 'schoolyard-court'].sort(),
    );
    const d = kit();
    const settlers = createMoonSettlers(d, d.scene, town.buildings, venues).filter(
      ({ plan }) => plan?.segments && !plan.child,
    );
    const carryOf = Object.fromEntries(venues.map(({ id, use }) => [id, use.carry]));
    const visited = new Set();
    let mixed = 0;
    for (const settler of settlers) {
      const carrying = walks(settler.plan).filter(({ carry }) => carry);
      for (const walk of carrying) {
        expect(walk.carry).toBe(carryOf[walk.route.from]);
        visited.add(walk.route.from);
      }
      const items = new Map(settler.items);
      if (items.size > 1) mixed++;
      for (const segment of walks(settler.plan)) {
        animateMoonSettler(settler, segment.start + segment.duration / 2 - settler.plan.offset);
        for (const [carry, item] of items) expect(item.visible).toBe(segment.carry === carry);
      }
    }
    expect([...visited].sort()).toEqual(Object.keys(carryOf).sort());
    expect(mixed).toBeGreaterThan(0);
  });

  it.each(AREA_BY_ID['schoolyard-court'].choices)(
    "the teachers' %s gets the children after school",
    (choice) => {
      let town = moonTown();
      town.era = 'hollow-rising';
      Object.assign(town.buildings, { craterSchool: 3, lanternRow: 1, earthviewTerraces: 1 });
      const site = AREA_BY_ID['schoolyard-court'];
      town = finish(buy(town, site, choice), site);
      const venues = moonCommissionVenues(town);
      const d = kit();
      const children = createMoonSettlers(d, d.scene, town.buildings, venues).filter(
        ({ plan }) => plan?.child,
      );
      expect(children.length).toBeGreaterThan(0);
      const { carry } = commissionFor(site.id).outcomes[choice].use;
      for (const child of children) {
        const there = walks(child.plan).filter(({ route }) => route.to === site.id);
        expect(there, child.root.name).toHaveLength(1);
        const home = walks(child.plan).find(({ route }) => route.from === site.id);
        expect(home.carry).toBe(carry);
        const [[kind, item]] = child.items;
        expect(kind).toBe(carry);
        animateMoonSettler(child, home.start + home.duration / 2 - child.plan.offset);
        expect(item.visible).toBe(true);
      }
    },
  );

  it('a future commission without routine data has settlers gather at its door', () => {
    const town = finish(buy(moonTown(), moonSite, moonSite.choices[0]), moonSite);
    const venues = moonCommissionVenues(town).map((venue) => ({
      ...venue,
      visits: { settler: 2 },
      use: commissionUse(undefined),
    }));
    const plan = moonSettlerPlan(town.buildings, 0, null, venues);
    expect(plan.segments.some(({ inside }) => inside === moonSite.id)).toBe(false);
    const stands = plan.segments.filter(({ stand }) => stand);
    expect(stands).toHaveLength(2);
    const door = moonHatch(venues[0].route);
    for (const stand of stands) {
      const p = moonSettlerPose(plan, stand.start + 1 - plan.offset, {});
      expect(p).toMatchObject({ visible: true, scale: 1, standing: true });
      expect(gap([p.x, 0, p.z], door)).toBeLessThan(1e-6);
      // Facing the door it did not go through.
      const arriving = routinePose(plan, stand.start - 0.01, MOON_WALK_SPEED, MOON_DOOR_TIME, {});
      expect(Math.cos(p.heading - arriving.heading)).toBeGreaterThan(0.9);
      expect(arriving.scale).toBe(1);
    }
  });

  it('leaves every day as it was without a commission', () => {
    const town = moonTown();
    const plan = moonSettlerPlan(town.buildings, 3, null, []);
    expect(walks(plan).every(({ carry }) => !carry)).toBe(true);
    expect(plan.segments.some(({ stand }) => stand)).toBe(false);
  });
});

describe('a resident day', () => {
  it('loops without a gap and passes each door only at its ends', () => {
    const use = commissionUse({ use: { stay: 'enter', carry: 'pie' } });
    const out = [
      [0, 0.07, 0],
      [0, 0.07, 10],
      [5, 0.07, 10],
    ];
    const day = commissionResidentDay({
      out,
      use,
      stay: 'enter',
      n: 0,
      homeId: 'home',
      siteId: 'x',
    });
    let time = 0;
    for (const segment of day.segments) {
      expect(segment.start).toBeCloseTo(time);
      time += segment.duration;
    }
    expect(day.duration).toBeCloseTo(time);
    const there = day.segments[0];
    for (let t = COMMISSION_DOOR_TIME; t < there.duration - COMMISSION_DOOR_TIME; t += 0.5)
      expect(routinePose(day, t, VILLAGER_WALK_SPEED, COMMISSION_DOOR_TIME, {}).scale).toBe(1);
  });
});

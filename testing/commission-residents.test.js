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
import { PLOTS, segmentDistance, townTracks } from '../src/game/town/TownLayout';
import { swingLimbs, VILLAGER_WALK_SPEED } from '../src/game/town/TownGait';
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
  const cases = valleySite.choices.flatMap((choice) =>
    [1, 2, 3, 4, 5].map((stage) => [choice, stage]),
  );
  it.each(cases)(
    '%s at stage %i lets every visitor reach its place clear of the art',
    (choice, stage) => {
      const outcome = valleyEntry.outcomes[choice];
      const use = commissionUse(outcome);
      const size = use.young ? 0.68 : 1;
      const boxes = solids(choice, stage);
      for (let n = 0; n < commissionVillagers(outcome); n++) {
        const court = commissionGrounds(LANDMARK_BY_ID[choice].form, use, n, valleySite.radius);
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

describe('valley townsfolk at the finished commons', () => {
  it.each([
    ['no choice yet', (town) => town],
    ['a design still being built', (town) => buy(town, valleySite, 'bandstand')],
    [
      'a saved design this build does not know',
      (town) => {
        const built = finish(buy(town, valleySite, 'bandstand'), valleySite);
        built.personalisation.areas[valleySite.id] = ['retired-design'];
        return built;
      },
    ],
  ])('draws nobody for %s', (_, change) => {
    const d = valley(change(valleyTown()));
    expect(d.commissionResidents ?? []).toEqual([]);
    expect(d.world.children).toEqual([]);
  });

  it.each(valleySite.choices)(
    '%s sends its residents along the streets from real homes',
    (choice) => {
      const town = finish(buy(valleyTown(), valleySite, choice), valleySite);
      const d = valley(town);
      const outcome = valleyEntry.outcomes[choice];
      expect(d.commissionResidents).toHaveLength(commissionVillagers(outcome));
      const roads = townTracks(town).filter(({ modes }) => modes.includes('pedestrian'));
      const homes = valleyHomes(town);
      for (const { day } of d.commissionResidents) {
        const there = walks(day)[0].route.points;
        // Out of a home's own door...
        const home = day.segments.at(-1).inside;
        expect(homes).toContain(home);
        expect(gap(there[0], d.itineraries.endpoint(home, true))).toBeLessThan(1e-6);
        // ...straight onto the streets, along them without cutting across a lot, then out
        // over the monument field from the edge of a wide street.
        const onStreet = there.map((p) =>
          roads.some(({ from, to }) => segmentDistance(p[0], p[2], from, to) <= 1.6),
        );
        const joins = onStreet.indexOf(true),
          leaves = onStreet.lastIndexOf(true);
        expect(joins).toBeLessThanOrEqual(2);
        expect(leaves).toBeGreaterThan(joins);
        expect(onStreet.slice(joins, leaves + 1).every(Boolean)).toBe(true);
        const wide = roads.filter(({ width }) => width >= 0.85);
        expect(
          Math.min(
            ...wide.map(({ from, to }) =>
              segmentDistance(there[leaves][0], there[leaves][2], from, to),
            ),
          ),
        ).toBeLessThan(1.2);
        // ...and ends in the site's court.
        const [sx, sz] = valleySite.positions[0];
        expect(Math.hypot(there.at(-1)[0] - sx, there.at(-1)[2] - sz)).toBeLessThan(
          valleySite.radius,
        );
      }
    },
  );

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
    expect(settler.item?.name).toBe(`Carried ${use.carry}`);
    for (const segment of walks(settler.plan)) {
      animateMoonSettler(settler, segment.start + segment.duration / 2 - settler.plan.offset);
      expect(settler.item.visible).toBe(!!segment.carry);
    }
    expect(settlers.filter(({ plan }) => !plan.segments).every(({ item }) => !item)).toBe(true);
  });

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

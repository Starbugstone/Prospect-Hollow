import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Box3, Group, Scene } from 'three';
import { createTown } from '../src/data/town';
import {
  COMMISSIONS,
  MAX_COMMISSION_VILLAGERS,
  commissionFor,
  commissionLetters,
  commissionStatus,
} from '../src/data/commissions';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  advanceMonumentWorks,
  areaChoice,
  areaShownStage,
  areaUnlocked,
  landmarkOffer,
  monumentWork,
  purchaseLandmark,
  unveilLandmark,
} from '../src/data/townLandmarks';
import {
  MOON_COMMISSION_DOOR,
  MOON_CRATER_RADIUS,
  MOON_LOTS,
  MOON_LOT_RADIUS,
  MOON_PAD_TOP,
  MOON_PARCEL_SIDES,
  MOON_RING_ROAD,
  MOON_SITE_PAD,
  moonApproaches,
  moonCommissionRoute,
  moonCommissionVenues,
  moonLetters,
  moonParcels,
  moonSegmentDistance,
} from '../src/data/moonSettlement';
import { moonHeight } from '../src/game/town/moon/MoonScene';
import { buildMoonMonuments, moonLabelAnchors } from '../src/game/town/moon/MoonMonuments';
import { moonHatch, moonSettlerPlan } from '../src/game/town/moon/MoonSettlers';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { monumentStatus } from '../src/game/town/TownBuildingFeedback';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import TownLandmarkPreview from '../src/components/town/TownLandmarkPreview.vue';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';
import TownCommissionGoal from '../src/components/town/TownCommissionGoal.vue';
import { buildingActionLabel, TOWN_ACTIONS } from '../src/data/townIndicators';
import { buildingIndicators } from '../src/game/town/TownRules';
import { monumentCast } from '../src/game/town/TownMonumentLife';
import { townFauna } from '../src/data/townAnimals';
import { ERAS, eraEvolution } from '../src/data/eras';
import { areasForSettlement } from '../src/data/townLandmarks';
import schema from '../backend/content/public-schema.json';
import { HONOURS, createHonours, evaluateHonours } from '../src/data/honours';
import { commissionUse } from '../src/data/commissions';
import { MOON_ROADS, moonSiteRing, moonSpokes } from '../src/data/moonSettlement';
import { siteYaw } from '../src/data/townLandmarks';
import { openSite } from './helpers/siteOpening';

const area = AREA_BY_ID['earthlight-conservatory'];
const commission = commissionFor(area.id);
const town = (greenhouse = 3) => {
  const base = createTown();
  return {
    ...base,
    era: 'twin-hollows',
    coins: 1e8,
    buildings: {
      ...base.buildings,
      earthlightGreenhouse: greenhouse,
      settlerDomes: 3,
      craterHomesteads: 3,
      willowkinDome: 3,
      newHollowCommons: 3,
    },
  };
};
const buy = (value, choice = area.choices[0]) => {
  const offer = landmarkOffer(value, area, choice);
  return offer && purchaseLandmark(value, { id: area.id, slot: 0, value: choice, ...offer });
};
const finish = (value, level) => {
  while (!monumentWork(value, area).ready) value = advanceMonumentWorks(value);
  return unveilLandmark(value, area.id, level);
};
const views = [];
const fixture = (value = town()) => {
  const d = new TownPrimitives();
  Object.assign(d, { town: value, world: new Group(), scene: new Scene(), sign: () => {} });
  views.push(d);
  return d;
};
afterEach(() => {
  for (const d of views.splice(0)) {
    d.clearGroup(d.scene);
    d.disposePrimitives();
  }
});
const render = (component, props) =>
  renderToString(createSSRApp({ render: () => h(component, props) }));

describe('the commission contract', () => {
  it.each(COMMISSIONS)('$site names a site and one outcome per design', (entry) => {
    const site = AREA_BY_ID[entry.site];
    expect(site.opens).toBeTruthy();
    expect(Object.keys(entry.outcomes).sort()).toEqual([...site.choices].sort());
    for (const { thanks, visits } of Object.values(entry.outcomes)) {
      expect(thanks).toBeTruthy();
      const { villager = 0, ...trips } = visits;
      const counts = Object.values(trips);
      expect(counts.reduce((sum, count) => sum + count, villager)).toBeGreaterThan(0);
      // Three daily trips on the Moon; a small party of townsfolk in the valley.
      expect(Math.max(...counts)).toBeLessThanOrEqual(3);
      expect(villager).toBeLessThanOrEqual(MAX_COMMISSION_VILLAGERS);
    }
    expect(entry.writer && entry.request).toBeTruthy();
  });

  it.each(COMMISSIONS)('$site gives each outcome its own residents', ({ outcomes }) => {
    const shapes = Object.values(outcomes).map(({ visits }) => JSON.stringify(visits));
    expect(new Set(shapes).size).toBe(Object.keys(outcomes).length);
  });

  it.each(COMMISSIONS)('$site counts toward a Commissioner rank', ({ site }) => {
    // A later commission cannot join a shipped list: it needs a new rank whose own
    // measure lists it, and the server must receive that rank too.
    const ranks = HONOURS.familyById.commissioner.ranks.filter((rank) =>
      rank.measure.areas.includes(site),
    );
    expect(ranks.length).toBeGreaterThan(0);
    for (const rank of ranks)
      expect(schema.honours.definitions[rank.id]?.measure).toEqual(rank.measure);
  });

  it('earns Commissioner when the first stage is paid, before it is built', () => {
    const honours = (value) =>
      evaluateHonours({ records: {}, powers: [], town: value, honours: createHonours() }).added;
    expect(honours(town())).not.toContain('commissioner-bronze');
    const paid = buy(town());
    expect(monumentWork(paid, area).ready).toBe(false);
    expect(honours(paid)).toContain('commissioner-bronze');
    expect(honours(paid)).not.toContain('commissioner-silver');
    expect(honours(paid)).not.toContain('landmark-patron-bronze');
  });

  it('returns no commission for an ordinary monument site', () => {
    expect(commissionFor('earthrise-plaza')).toBeNull();
    expect(commissionFor(undefined)).toBeNull();
  });
});

describe('opening', () => {
  it('waits for the finished greenhouse, then stays open', () => {
    expect(areaUnlocked(town(2), area)).toBe(false);
    expect(landmarkOffer(town(2), area, area.choices[0])).toBeNull();
    expect(moonLabelAnchors(town(2)).map(({ id }) => id)).not.toContain(area.id);
    expect(monumentStatus(town(2), area.id, { context: 'card' }).text).toContain('level 3');
    expect(areaUnlocked(town(3), area)).toBe(true);
    expect(moonLabelAnchors(town(3)).map(({ id }) => id)).toContain(area.id);
    expect(areaUnlocked({ ...town(3), era: 'moonward' }, area)).toBe(false);
    // An incomplete save has no buildings to read and simply stays closed.
    expect(areaUnlocked({ era: 'twin-hollows' }, area)).toBe(false);
  });

  it('exports the same opening, prices and currency to the server', () => {
    expect(schema.personalisation.areas.find(({ id }) => id === area.id)).toEqual(area);
    expect(area.opens).toEqual({ building: 'earthlightGreenhouse', level: 3 });
    for (const choice of area.choices)
      expect(schema.personalisation.landmarks.find(({ id }) => id === choice)).toEqual(
        LANDMARK_BY_ID[choice],
      );
  });
});

describe('building it', () => {
  it.each(area.choices)('%s costs five even stages and is a permanent choice', (choice) => {
    let value = town();
    const coins = value.coins;
    for (let level = 1; level <= 5; level++) {
      value = buy(value, choice);
      expect(value.coins).toBe(coins - level * 400000);
      expect(monumentWork(value, area)).toMatchObject({
        level,
        wins: 0,
        required: level === 1 ? 3 : 1,
      });
      value = finish(value, level);
      expect(areaChoice(value, area)).toBe(choice);
      for (const other of area.choices.filter((id) => id !== choice))
        expect(buy(value, other)).toBeNull();
    }
    expect(landmarkOffer(value, area, choice)).toBeNull();
    expect(coins - value.coins).toBe(2000000);
  });

  it('never touches the required town, so it cannot hold an era back', () => {
    const before = town();
    const after = finish(buy(before), 1);
    expect(after.buildings).toEqual(before.buildings);
    expect(after.projects).toEqual(before.projects);
    expect(after.era).toBe(before.era);
  });

  it('cannot be bought without the coins', () => {
    expect(buy({ ...town(), coins: 399999 })).toBeNull();
  });
});

describe('residents', () => {
  it('stay away until the first stage is unveiled', () => {
    expect(moonCommissionVenues(town())).toEqual([]);
    const working = buy(town());
    expect(moonCommissionVenues(working)).toEqual([]);
    const built = finish(working, 1);
    expect(areaShownStage(built, area)).toBe(1);
    expect(moonCommissionVenues(built).map(({ id }) => id)).toEqual([area.id]);
    // Scaffolding around a later stage keeps the door open: the stage below still stands.
    expect(moonCommissionVenues(buy(built)).map(({ id }) => id)).toEqual([area.id]);
  });

  it('ignores a saved choice this build does not know', () => {
    const value = finish(buy(town()), 1);
    value.personalisation.areas[area.id] = ['retired-design'];
    expect(moonCommissionVenues(value)).toEqual([]);
    expect(moonCommissionVenues(null)).toEqual([]);
  });

  it.each(area.choices)('%s decides who visits and how often', (choice) => {
    const value = finish(buy(town(), choice), 1);
    const venues = moonCommissionVenues(value);
    const { visits } = commission.outcomes[choice];
    const trips = (kind, n) =>
      moonSettlerPlan(
        value.buildings,
        n,
        kind === 'willowkin' ? 'willowkinDome' : null,
        venues,
        kind,
      ).segments.filter(({ inside }) => inside === area.id).length;
    for (const n of [0, 1, 2, 7]) expect(trips('settler', n)).toBe(visits.settler);
    expect(trips('willowkin', 100)).toBe(visits.willowkin);
  });

  it('leaves every settler day unchanged without a commission', () => {
    const value = town();
    expect(moonSettlerPlan(value.buildings, 3, null, [])).toEqual(
      moonSettlerPlan(value.buildings, 3),
    );
  });

  it('walk a public path to the door, on the pad, off every other lot', () => {
    const route = moonCommissionRoute(area);
    const [x, z] = area.positions[0];
    expect(route.clear).toBe(true);
    const door = moonHatch(route);
    expect(door[0]).toBeCloseTo(x);
    expect(door[2]).toBeCloseTo(z + MOON_COMMISSION_DOOR);
    expect(door[1]).toBeCloseTo(MOON_PAD_TOP, 1);
    const end = route.points.at(-1);
    expect(Math.hypot(end[0], end[1])).toBeCloseTo(MOON_RING_ROAD);
    for (const [id, [lx, lz]] of Object.entries(MOON_LOTS))
      for (let n = 1; n < route.points.length; n++)
        expect(
          moonSegmentDistance(lx, lz, route.points[n - 1], route.points[n]),
          id,
        ).toBeGreaterThan(MOON_LOT_RADIUS);
  });
});

const MOON_COMMISSION_AREAS = COMMISSIONS.map(({ site }) => AREA_BY_ID[site]).filter(
  (site) => site.settlement === 'moon',
);
const VALLEY_COMMISSION_AREAS = COMMISSIONS.map(({ site }) => AREA_BY_ID[site]).filter(
  (site) => site.settlement === 'valley',
);
// A town with the site's era and opening met, rich enough for every stage.
const openTown = (site) => ({ ...openSite(town(), site), era: site.era });
const buyAt = (value, site, choice = site.choices[0]) => {
  const offer = landmarkOffer(value, site, choice);
  return offer && purchaseLandmark(value, { id: site.id, slot: 0, value: choice, ...offer });
};
const finishAt = (value, site, level = 1) => {
  while (!monumentWork(value, site).ready) value = advanceMonumentWorks(value);
  return unveilLandmark(value, site.id, level);
};

describe.each(MOON_COMMISSION_AREAS)('the Moon site $id and its art', (area) => {
  it('reserves level ground clear of lots, rings, approaches and the saucer corridor', () => {
    const [x, z] = area.positions[0];
    expect(Math.hypot(x, z) + area.radius).toBeLessThan(MOON_CRATER_RADIUS);
    for (const ring of MOON_ROADS.rings)
      expect(Math.abs(Math.hypot(x, z) - ring)).toBeGreaterThan(area.radius + 1);
    for (const spoke of moonSpokes())
      expect(moonSegmentDistance(x, z, ...spoke)).toBeGreaterThan(area.radius + 1);
    for (const other of areasForSettlement('moon').filter((site) => site !== area))
      expect(
        Math.hypot(other.positions[0][0] - x, other.positions[0][1] - z),
        other.id,
      ).toBeGreaterThan(area.radius + other.radius + 2);
    for (const [id, [px, pz]] of Object.entries(MOON_LOTS))
      expect(Math.hypot(px - x, pz - z), id).toBeGreaterThan(area.radius + MOON_LOT_RADIUS + 1);
    for (const route of moonApproaches())
      for (let n = 1; n < route.points.length; n++)
        expect(
          moonSegmentDistance(x, z, route.points[n - 1], route.points[n]),
          route.id,
        ).toBeGreaterThan(area.radius + route.width / 2);
    for (let s = 0; s < 80; s++)
      expect(Math.hypot(x - 15 - 0.6 * s, z + 30 + s)).toBeGreaterThan(area.radius + 6.4);
    for (let dx = -7; dx <= 7; dx++)
      for (let dz = -7; dz <= 7; dz++)
        if (Math.hypot(dx, dz) <= 7) expect(moonHeight(x + dx, z + dz)).toBeCloseTo(0, 7);
  });

  it('walks a public path from its door to the nearest ring road inside it, off every lot', () => {
    const route = moonCommissionRoute(area);
    const [x, z] = area.positions[0];
    expect(route.clear).toBe(true);
    const door = moonHatch(route);
    const yaw = siteYaw(area);
    expect(door[0]).toBeCloseTo(x + Math.sin(yaw) * MOON_COMMISSION_DOOR);
    expect(door[2]).toBeCloseTo(z + Math.cos(yaw) * MOON_COMMISSION_DOOR);
    const end = route.points.at(-1);
    expect(Math.hypot(end[0], end[1])).toBeCloseTo(moonSiteRing(area.positions[0]));
    expect(route.ring).toBe(moonSiteRing(area.positions[0]));
    for (const [id, [lx, lz]] of Object.entries(MOON_LOTS))
      for (let n = 1; n < route.points.length; n++)
        expect(
          moonSegmentDistance(lx, lz, route.points[n - 1], route.points[n]),
          id,
        ).toBeGreaterThan(MOON_LOT_RADIUS);
  });

  it('opens with its building level in its era, and never before', () => {
    const { building, level } = area.opens;
    const at = (value) => ({
      ...town(),
      era: area.era,
      buildings: { ...town().buildings, [building]: value },
    });
    expect(areaUnlocked(at(level - 1), area)).toBe(false);
    expect(landmarkOffer(at(level - 1), area, area.choices[0])).toBeNull();
    expect(areaUnlocked(at(level), area)).toBe(true);
    const before = ERAS[ERAS.findIndex(({ id }) => id === area.era) - 1].id;
    expect(areaUnlocked({ ...at(level), era: before }, area)).toBe(false);
    expect(moonLetters(at(level - 1)).map(({ id }) => id)).not.toContain(`${area.id}-request`);
    expect(moonLetters(at(level)).map(({ id }) => id)).toContain(`${area.id}-request`);
    expect(schema.personalisation.areas.find(({ id }) => id === area.id)).toEqual(area);
  });

  it.each(area.choices)(
    '%s sends the residents its outcome promises, carrying its item',
    (choice) => {
      const value = finishAt(buyAt(openTown(area), area, choice), area);
      const venue = moonCommissionVenues(value).find(({ id }) => id === area.id);
      const outcome = commissionFor(area.id).outcomes[choice];
      const use = commissionUse(outcome);
      expect(venue).toMatchObject({ visits: outcome.visits, use });
      for (const [kind, home] of [
        ['settler', null],
        ['willowkin', 'willowkinDome'],
      ]) {
        const { segments } = moonSettlerPlan(value.buildings, 1, home, [venue], kind);
        const trips = outcome.visits[kind];
        if (use.stay === 'enter')
          expect(
            segments.filter(({ inside }) => inside === area.id),
            kind,
          ).toHaveLength(trips);
        else
          expect(segments.filter(({ stand }) => stand).length, kind).toBeGreaterThanOrEqual(trips);
        expect(
          segments.filter(({ carry }) => carry && carry === use.carry),
          kind,
        ).toHaveLength(use.carry ? trips : 0);
      }
    },
  );

  it('stands on the shared octagonal pad in every state, raised to its walkers', () => {
    const parcel = moonParcels().find(({ id }) => id === area.id);
    expect(parcel).toMatchObject({ kind: 'site', radius: MOON_SITE_PAD, sides: MOON_PARCEL_SIDES });
    const open = openTown(area);
    for (const value of [open, buyAt(open, area), finishAt(buyAt(open, area), area)]) {
      const d = fixture(value);
      const mesh = vi.spyOn(d, 'mesh');
      buildMoonMonuments(d, d.scene, value);
      // Each Moon site draws a rim and a deck; only this one is raised.
      const rims = mesh.mock.calls.filter(
        ([, shape, size]) => shape === 'moon-parcel' && size[0] === MOON_SITE_PAD,
      );
      expect(rims.some(([, , size]) => size[1] === MOON_PAD_TOP - 0.08)).toBe(true);
    }
  });

  it.each(area.choices)(
    '%s fits its pad, keeps a door clear and stays within budget at every stage',
    (choice) => {
      const d = fixture(),
        signatures = new Set();
      for (let stage = 1; stage <= 5; stage++) {
        const root = buildLandmark(d, new Group(), choice, stage);
        let triangles = 0;
        const materials = new Set();
        root.traverse((mesh) => {
          if (!mesh.isMesh) return;
          triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
          materials.add(mesh.material);
        });
        expect(triangles, `${choice} ${stage}`).toBeLessThan(6000);
        expect(materials.size, `${choice} ${stage}`).toBeLessThanOrEqual(8);
        signatures.add(triangles);
        const box = new Box3().setFromObject(root);
        expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(area.radius);
        expect(box.max.z).toBeLessThan(MOON_SITE_PAD);
      }
      expect(signatures.size, 'each stage adds something').toBe(5);
    },
  );

  it.each(area.choices)('%s has fallback art that changes with its stage', async (choice) => {
    const stages = await Promise.all(
      [1, 2, 3, 4, 5].map((stage) => render(TownLandmarkPreview, { choice, stage })),
    );
    expect(new Set(stages).size).toBe(5);
  });
});

describe('the letters', () => {
  const ids = (value) => moonLetters(value).map(({ id }) => id);

  it('asks once the site opens and thanks once the first stage stands', () => {
    expect(ids(town(2))).not.toContain(`${area.id}-request`);
    expect(ids(town(3))).toContain(`${area.id}-request`);
    expect(ids(buy(town()))).not.toContain(`${area.id}-thanks`);
    for (const choice of area.choices) {
      const letters = moonLetters(finish(buy(town(), choice), 1));
      expect(letters.find(({ id }) => id === `${area.id}-thanks`)).toMatchObject({
        from: commission.writer,
        text: commission.outcomes[choice].thanks,
      });
    }
  });

  it('shows the request on the open site card, and not once a design is chosen', async () => {
    expect(await render(TownMonumentSite, { id: area.id, town: town() })).toContain(
      'data-commission-request',
    );
    expect(await render(TownMonumentSite, { id: area.id, town: buy(town()) })).not.toContain(
      'data-commission-request',
    );
    expect(await render(TownMonumentSite, { id: 'earthrise-plaza', town: town() })).not.toContain(
      'data-commission-request',
    );
  });
});

describe('the valley commission', () => {
  const site = AREA_BY_ID['homecoming-commons'];
  const valley = (hall = 3) => {
    const base = createTown();
    return {
      ...base,
      era: 'twin-hollows',
      coins: 1e8,
      buildings: { ...base.buildings, homecomingHall: hall },
    };
  };
  it('stands in the valley and opens with the finished homecoming hall', () => {
    expect(areasForSettlement()).toContain(site);
    expect(areaUnlocked(valley(2), site)).toBe(false);
    expect(areaUnlocked(valley(3), site)).toBe(true);
    expect(commissionLetters(valley(2), 'valley')).toEqual([]);
    expect(commissionLetters(valley(3), 'valley').map(({ id }) => id)).toEqual([
      `${site.id}-request`,
    ]);
    // Valley letters never appear among New Hollow's.
    expect(moonLetters(valley(3)).map(({ id }) => id)).not.toContain(`${site.id}-request`);
  });
});

describe.each(VALLEY_COMMISSION_AREAS)('the valley site $id and its art', (site) => {
  const entry = commissionFor(site.id);
  it.each(site.choices)('%s draws the visitors its outcome promises', (choice) => {
    const open = openTown(site);
    const fauna = townFauna(eraEvolution(open.era));
    const before = monumentCast(open, fauna).filter(({ area }) => area === site).length;
    const value = finishAt(buyAt(open, site, choice), site);
    const cast = monumentCast(value, fauna).filter(({ area }) => area === site);
    const { resident, wild } = entry.outcomes[choice].visits;
    const expected = wild + (fauna.companions?.species ? resident : 0);
    expect(cast.length - before).toBeLessThanOrEqual(expected);
    expect(cast.length - before).toBeGreaterThan(0);
    expect(new Set(cast.map(({ seed }) => seed)).size).toBe(cast.length);
  });

  it.each(site.choices)('%s has fallback art that changes with its stage', async (choice) => {
    const stages = await Promise.all(
      [1, 2, 3, 4, 5].map((stage) => render(TownLandmarkPreview, { choice, stage })),
    );
    expect(new Set(stages).size).toBe(5);
  });

  it.each(site.choices)('%s stays within budget at every stage', (choice) => {
    const d = fixture(),
      signatures = new Set();
    for (let stage = 1; stage <= 5; stage++) {
      const root = buildLandmark(d, new Group(), choice, stage);
      let triangles = 0;
      root.traverse((mesh) => {
        if (mesh.isMesh)
          triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
      });
      signatures.add(triangles);
      const box = new Box3().setFromObject(root);
      expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(site.radius);
    }
    expect(signatures.size).toBe(5);
  });
});

describe('the third commission', () => {
  const glade = AREA_BY_ID['willowkin-glade'];
  const conservatory = area,
    commons = AREA_BY_ID['homecoming-commons'];
  // A Twin Hollows town where both earlier commissions are open and neither is chosen.
  const both = () => ({ ...town(), buildings: { ...town().buildings, homecomingHall: 3 } });
  const open = (value) => areaUnlocked(value, glade);

  it('waits for either of the first two commissions, read from the exported catalog', () => {
    expect(glade).toMatchObject({ era: 'twin-hollows', settlement: 'valley' });
    expect(glade.opens).toEqual({ sites: [conservatory.id, commons.id], level: 1 });
    expect(schema.personalisation.areas.find(({ id }) => id === glade.id)).toEqual(glade);
    expect(open(both())).toBe(false);
    expect(landmarkOffer(both(), glade, glade.choices[0])).toBeNull();
    expect(commissionLetters(both(), 'valley').map(({ id }) => id)).not.toContain(
      `${glade.id}-request`,
    );
    expect(monumentStatus(both(), glade.id, { context: 'card' }).text).toBe(
      'Opens after another commission',
    );
  });

  // Every order a player can take: Moon first, valley first, both, and each interleaved
  // with building, unveiling and further stages. The Glade opens with the first paid stage
  // anywhere and never closes again.
  const steps = {
    moon: (value) => buyAt(value, conservatory),
    valley: (value) => buyAt(value, commons),
    puzzle: (value) => advanceMonumentWorks(value),
    unveil: (value) => {
      for (const site of [conservatory, commons]) {
        const work = monumentWork(value, site);
        if (work?.ready) value = unveilLandmark(value, site.id, work.level);
      }
      return value;
    },
  };
  const orders = [[]];
  for (let length = 0; length < 4; length++)
    for (const order of orders.filter((entry) => entry.length === length))
      for (const step of Object.keys(steps)) orders.push([...order, step]);
  it.each(orders.filter((order) => order.length === 4).map((order) => [order.join(' → '), order]))(
    'opens and stays open: %s',
    (_, order) => {
      let value = both(),
        wasOpen = false;
      for (const step of order) {
        value = steps[step](value) ?? value;
        const bought = [conservatory, commons].some((site) => areaChoice(value, site));
        expect(open(value), step).toBe(bought);
        if (wasOpen) expect(open(value), `${step} closed it`).toBe(true);
        wasOpen = open(value);
        // It never gates either earlier commission.
        for (const site of [conservatory, commons]) expect(areaUnlocked(value, site)).toBe(true);
      }
    },
  );

  it('opens for a Moon-first player who has not reached the homecoming hall', () => {
    const moonFirst = buyAt(town(), conservatory);
    expect(areaUnlocked(moonFirst, commons)).toBe(false);
    expect(open(moonFirst)).toBe(true);
    expect(commissionLetters(moonFirst, 'valley').map(({ id }) => id)).toEqual([
      `${glade.id}-request`,
    ]);
    const valleyFirst = buyAt(
      { ...both(), buildings: { ...both().buildings, earthlightGreenhouse: 2 } },
      commons,
    );
    expect(areaUnlocked(valleyFirst, conservatory)).toBe(false);
    expect(open(valleyFirst)).toBe(true);
  });

  it('fails closed on a saved choice this build does not know, or an unknown opening', () => {
    const value = buyAt(both(), conservatory);
    value.personalisation.areas[conservatory.id] = ['retired-design'];
    expect(open(value)).toBe(false);
    expect(areaUnlocked(value, { ...glade, opens: { level: 1 } })).toBe(false);
    expect(areaUnlocked(value, { ...glade, opens: { sites: ['no-such-site'], level: 1 } })).toBe(
      false,
    );
    expect(
      areaUnlocked(buyAt(both(), commons), { ...glade, opens: { sites: [commons.id], level: 2 } }),
    ).toBe(false);
  });

  it.each(glade.choices)('%s builds on the shared 2M schedule as a permanent choice', (choice) => {
    let value = buyAt(both(), commons);
    const coins = value.coins;
    for (let level = 1; level <= 5; level++) {
      value = finishAt(buyAt(value, glade, choice), glade, level);
      expect(coins - value.coins).toBe(level * 400000);
      for (const other of glade.choices.filter((id) => id !== choice))
        expect(buyAt(value, glade, other)).toBeNull();
    }
    expect(landmarkOffer(value, glade, choice)).toBeNull();
  });
});

describe('seeing a commission', () => {
  const status = (value) => commissionStatus(value).find(({ site }) => site === area.id);

  it('is silent until a commission opens', () => {
    expect(commissionStatus(town(2))).toEqual([]);
    expect(commissionStatus(null)).toEqual([]);
    expect(buildingIndicators(town(2))[area.id]).toBeUndefined();
  });

  it('follows one commission from request to finished', () => {
    let value = town();
    expect(status(value)).toMatchObject({ site: area.id, state: 'request', choice: null });
    value = buy(value);
    expect(status(value)).toMatchObject({ state: 'work', done: 0, total: 3 });
    value = advanceMonumentWorks(value);
    expect(status(value)).toMatchObject({ state: 'work', done: 1, total: 3 });
    while (!monumentWork(value, area).ready) value = advanceMonumentWorks(value);
    expect(status(value)).toMatchObject({ state: 'ready', done: 3, total: 3 });
    value = unveilLandmark(value, area.id, 1);
    expect(status(value)).toMatchObject({ state: 'funding', done: 1, total: 5 });
    for (let level = 2; level <= 5; level++) value = finish(buy(value), level);
    expect(status(value)).toBeUndefined();
  });

  it('puts what needs the player first when several are open', () => {
    const value = {
      ...buy(town()),
      buildings: { ...buy(town()).buildings, homecomingHall: 3 },
    };
    // The paid conservatory also opened the Willowkin Glade.
    expect(commissionStatus(value).map(({ site, state }) => [site, state])).toEqual([
      ['homecoming-commons', 'request'],
      ['willowkin-glade', 'request'],
      [area.id, 'work'],
    ]);
  });

  it('hangs a letter over a site awaiting a choice, and then takes it down', () => {
    expect(buildingIndicators(town())[area.id]).toBe('commission');
    expect(TOWN_ACTIONS.commission.icon).toContain('commission-letter');
    expect(buildingActionLabel(town(), area.id, 'commission')).toContain(area.label);
    expect(buildingIndicators(buy(town()))[area.id]).toBeUndefined();
  });

  it('never stacks the letter on an unveiling hammer', () => {
    let value = buy(town());
    while (!monumentWork(value, area).ready) value = advanceMonumentWorks(value);
    expect(buildingIndicators(value)[area.id]).toBe('ready');
  });

  it.each([
    ['request', town(), 'New commission', 'is-calling'],
    ['work', buy(town()), 'Commission · Earthlight Orchard', 'town-project-goal'],
  ])('shows the %s state as a light pill', async (state, value, text, css) => {
    const html = await render(TownCommissionGoal, { status: status(value) });
    expect(html).toContain(`data-commission-state="${state}"`);
    expect(html).toContain(text);
    expect(html).toContain(css);
    expect(html).toContain('commission-letter.svg');
  });
});

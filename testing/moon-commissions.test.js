import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Box3, Group, Scene } from 'three';
import { createTown } from '../src/data/town';
import { MOON_COMMISSIONS, moonCommission } from '../src/data/moonCommissions';
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
import schema from '../backend/content/public-schema.json';

const area = AREA_BY_ID['earthlight-conservatory'];
const commission = moonCommission(area.id);
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
  it.each(MOON_COMMISSIONS)('$site names a Moon site and one outcome per design', (entry) => {
    const site = AREA_BY_ID[entry.site];
    expect(site.settlement).toBe('moon');
    expect(Object.keys(entry.outcomes).sort()).toEqual([...site.choices].sort());
    for (const { thanks, visits } of Object.values(entry.outcomes)) {
      expect(thanks).toBeTruthy();
      expect(visits.settler + visits.willowkin).toBeGreaterThan(0);
      expect(Math.max(visits.settler, visits.willowkin)).toBeLessThanOrEqual(3);
    }
    expect(entry.writer && entry.request).toBeTruthy();
  });

  it('gives each outcome its own residents', () => {
    const shapes = Object.values(commission.outcomes).map(({ visits }) => JSON.stringify(visits));
    expect(new Set(shapes).size).toBe(area.choices.length);
  });

  it('returns no commission for an ordinary monument site', () => {
    expect(moonCommission('earthrise-plaza')).toBeNull();
    expect(moonCommission(undefined)).toBeNull();
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

describe('the site and its art', () => {
  it('reserves level ground clear of lots, ring, approaches and the saucer corridor', () => {
    const [x, z] = area.positions[0];
    expect(Math.hypot(x, z) + area.radius).toBeLessThan(MOON_CRATER_RADIUS);
    expect(Math.abs(Math.hypot(x, z) - MOON_RING_ROAD)).toBeGreaterThan(area.radius + 1);
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

  it('stands on the shared octagonal pad in every state, raised to its walkers', () => {
    const parcel = moonParcels().find(({ id }) => id === area.id);
    expect(parcel).toMatchObject({ kind: 'site', radius: MOON_SITE_PAD, sides: MOON_PARCEL_SIDES });
    for (const value of [town(), buy(town()), finish(buy(town()), 1)]) {
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

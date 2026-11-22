import { commissionFor } from '../src/data/commissions';
import { expect, it } from 'vitest';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Vector3 } from 'three';
import { BUILDINGS, createTown } from '../src/data/town';
import { ERAS } from '../src/data/eras';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  areaUnlocked,
  areasForSettlement,
  landmarkOffer,
  purchaseLandmark,
} from '../src/data/townLandmarks';
import {
  MOON_CRATER_RADIUS,
  MOON_LOTS,
  MOON_ROADS,
  MOON_ROAD_WIDTH,
  MOON_SITE_PAD,
  moonApproaches,
  moonPadRadius,
  moonRoadDistance,
  moonSegmentDistance,
  moonSiteRoute,
  moonSiteRoutes,
} from '../src/data/moonSettlement';
import { NON_MONUMENT_HONOURS } from '../src/data/honours';
import { isEraComplete } from '../src/game/town/TownEras';
import { moonAccessGeometry, moonHeight } from '../src/game/town/moon/MoonScene';
import { moonLabelAnchors } from '../src/game/town/moon/MoonMonuments';
import { moonSaucerFlightPoint, MOON_SAUCER_CYCLE } from '../src/game/town/moon/MoonSaucer';
import { moonSettlerPlan, moonSettlerPose } from '../src/game/town/moon/MoonSettlers';
import TownLandmarkPreview from '../src/components/town/TownLandmarkPreview.vue';
import fr from '../src/i18n/fr.json';
import schema from '../backend/content/public-schema.json';

// Hollowborn Square, New Hollow Rising's moonstone site on outer-ring slot 4.
const area = AREA_BY_ID['hollowborn-square'];
const [x, z] = area.positions[0];
const town = (era = area.era) => {
  const value = { ...createTown(), era, moonstones: 1000, moonstonesEarned: 1000 };
  for (const building of BUILDINGS) value.buildings[building.id] = building.upgrades.length;
  return value;
};

it('stands on outer-ring slot 4 of New Hollow Rising and is paid for in moonstones', () => {
  expect(area).toMatchObject({
    era: 'hollow-rising',
    settlement: 'moon',
    currency: 'moonstones',
    facing: 'south',
    levelPrices: [20, 30, 40, 50, 60],
  });
  const slot = (4 * 22.5 + 11.25) * (Math.PI / 180);
  expect(x).toBeCloseTo(Math.cos(slot) * 55, 0);
  expect(z).toBeCloseTo(Math.sin(slot) * 55, 0);
  expect(areasForSettlement('moon')).toContain(area);
  // The server's catalog carries the same site, so it replays purchases there.
  expect(schema.personalisation.areas.find(({ id }) => id === area.id)).toMatchObject({
    era: area.era,
    settlement: 'moon',
    currency: 'moonstones',
    levelPrices: [20, 30, 40, 50, 60],
    choices: area.choices,
  });
});

it('keeps its whole court on level floor, clear of every lot, road, path and site', () => {
  expect(Math.hypot(x, z) + area.radius).toBeLessThan(MOON_CRATER_RADIUS);
  for (let dx = -area.radius; dx <= area.radius; dx++)
    for (let dz = -area.radius; dz <= area.radius; dz++)
      if (Math.hypot(dx, dz) <= area.radius) expect(moonHeight(x + dx, z + dz)).toBeCloseTo(0, 7);
  expect(moonRoadDistance(x, z)).toBeGreaterThan(area.radius + MOON_ROAD_WIDTH / 2);
  for (const [id, [px, pz]] of Object.entries(MOON_LOTS))
    expect(Math.hypot(px - x, pz - z), id).toBeGreaterThan(area.radius + moonPadRadius(id) + 1);
  for (const route of moonApproaches())
    for (let n = 1; n < route.points.length; n++)
      expect(
        moonSegmentDistance(x, z, route.points[n - 1], route.points[n]),
        route.id,
      ).toBeGreaterThan(area.radius + route.width / 2);
  for (const other of areasForSettlement('moon').filter((site) => site !== area))
    expect(
      Math.hypot(other.positions[0][0] - x, other.positions[0][1] - z),
      other.id,
    ).toBeGreaterThan(area.radius + other.radius + 1);
  // The outer ring's two commission slots (3 and 10) stay free for their sites.
  for (const [cx, cz] of [
    [10.7, 53.9],
    [-30.6, -45.7],
  ])
    expect(Math.hypot(cx - x, cz - z)).toBeGreaterThan(area.radius * 2 + 1);
});

it('stays out of the saucer’s flight line and every settler’s walk', () => {
  const point = new Vector3();
  for (let phase = 0; phase < MOON_SAUCER_CYCLE; phase += 0.5) {
    moonSaucerFlightPoint(phase, true, point);
    expect(Math.hypot(point.x - x, point.z - z)).toBeGreaterThan(area.radius + 6.4);
  }
  const levels = Object.fromEntries(Object.keys(MOON_LOTS).map((id) => [id, 3]));
  for (let n = 0; n < 24; n++) {
    const plan = moonSettlerPlan(levels, n);
    for (let time = 0; time < 600; time += 0.5) {
      const pose = moonSettlerPose(plan, time);
      // Indoors, a settler has no place on the map.
      if (!pose.visible) continue;
      expect(Math.hypot(pose.x - x, pose.z - z), `settler ${n} at ${time}`).toBeGreaterThan(
        area.radius,
      );
    }
  }
});

it('joins the outer ring by a public path of its own, clear of every other parcel', () => {
  const route = moonSiteRoute(area);
  expect(route.clear).toBe(true);
  // From the back of the square, the side facing the ring road.
  expect(route.entry[1]).toBeLessThan(z);
  expect(Math.hypot(route.entry[0] - x, route.entry[1] - z)).toBeLessThan(MOON_SITE_PAD);
  const end = route.points.at(-1);
  expect(Math.hypot(...end)).toBeCloseTo(MOON_ROADS.rings[1], 6);
  for (let n = 1; n < route.points.length; n++) {
    const [a, b] = [route.points[n - 1], route.points[n]];
    for (const [id, [px, pz]] of Object.entries(MOON_LOTS))
      expect(moonSegmentDistance(px, pz, a, b), id).toBeGreaterThan(moonPadRadius(id) + 0.8);
    for (const other of areasForSettlement('moon').filter((site) => site !== area))
      expect(
        moonSegmentDistance(other.positions[0][0], other.positions[0][1], a, b),
        other.id,
      ).toBeGreaterThan(other.radius);
    // No crater breaks the path.
    for (let t = 0; t <= 1; t += 0.05)
      expect(moonHeight(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)).toBeCloseTo(0, 7);
  }
  // Drawn with the same strip as every lot's path: on the pad top at its head, the
  // regolith where it meets the ring.
  const strip = moonAccessGeometry([route]).attributes.position;
  let low = Infinity,
    high = -Infinity;
  for (let n = 0; n < strip.count; n++) {
    low = Math.min(low, strip.getY(n));
    high = Math.max(high, strip.getY(n));
  }
  expect(low).toBeGreaterThanOrEqual(0);
  expect(high).toBeLessThan(0.3);
  // Commissions share the builder, with a path to their door; other sites have none yet.
  for (const other of areasForSettlement('moon').filter((site) => site !== area))
    if (commissionFor(other.id)) expect(moonSiteRoute(other).clear, other.id).toBe(true);
    else expect(moonSiteRoute(other), other.id).toBeNull();
  expect(moonSiteRoute(undefined)).toBeNull();
});

it('opens with New Hollow Rising: no label, path or offer before it', () => {
  const before = town('twin-hollows');
  expect(areaUnlocked(before, area)).toBe(false);
  expect(moonSiteRoutes(before).map(({ id }) => id)).not.toContain(area.id);
  expect(moonLabelAnchors(before).map(({ id }) => id)).not.toContain(area.id);
  expect(landmarkOffer(before, area, area.choices[0])).toBeNull();
  const open = town();
  expect(moonSiteRoutes(open)).toContain(moonSiteRoute(area));
  expect(moonLabelAnchors(open).map(({ id }) => id)).toContain(area.id);
  expect(landmarkOffer(open, area, area.choices[0])).toMatchObject({ level: 1, price: 20 });
  // Every later era keeps it open.
  for (const era of ERAS.slice(ERAS.findIndex(({ id }) => id === area.era)))
    expect(areaUnlocked(town(era.id), area), era.id).toBe(true);
});

it('never gates the era: a finished New Hollow Rising town stays complete with any square', () => {
  const value = town();
  for (const building of BUILDINGS) {
    value.buildingEras[building.id] = value.era;
    value.buildingEraLevels[building.id] = 3;
  }
  const complete = isEraComplete(value);
  const bought = purchaseLandmark(value, {
    kind: 'area',
    id: area.id,
    slot: 0,
    value: area.choices[1],
    ...landmarkOffer(value, area, area.choices[1]),
  });
  expect(bought.moonstones).toBe(980);
  expect(bought.coins).toBe(value.coins);
  expect(isEraComplete(bought)).toBe(complete);
});

it.each(area.choices)('%s draws a different SVG at each of its five levels', async (choice) => {
  const art = new Set();
  for (let stage = 1; stage <= 5; stage++)
    art.add(
      await renderToString(
        createSSRApp({ render: () => h(TownLandmarkPreview, { choice, stage }) }),
      ),
    );
  expect(art.size).toBe(5);
});

it('has French for the site, its designs and their descriptions, and an honours decision', () => {
  for (const text of [
    area.label,
    ...area.choices.flatMap((id) => [LANDMARK_BY_ID[id].label, LANDMARK_BY_ID[id].detail]),
  ])
    expect(fr[text], text).toBeTruthy();
  // Landmark Patron's site list shipped fixed, so the square adds no rank.
  expect(NON_MONUMENT_HONOURS[area.id]).toBeTruthy();
});

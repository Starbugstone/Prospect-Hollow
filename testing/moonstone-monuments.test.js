import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { Box3, Group, PerspectiveCamera, Vector3 } from 'three';
import { createTown, BUILDINGS } from '../src/data/town';
import { useCampaignStore } from '../src/stores/campaignStore';
import {
  AREA_BY_ID,
  LANDMARK_BY_ID,
  areasForSettlement,
  landmarkOffer,
  landmarkPrice,
  purchaseLandmark,
  LANDMARK_PROGRESSION,
  landmarkPayment,
  advanceMonumentWorks,
  unveilLandmark,
} from '../src/data/townLandmarks';
import { isEraComplete } from '../src/game/town/TownEras';
import {
  MOON_LOTS,
  MOON_CRATER_RADIUS,
  MOON_RING_ROAD,
  moonApproaches,
  moonSegmentDistance,
  moonPadRadius,
} from '../src/data/moonSettlement';
import { MoonScene, moonHeight } from '../src/game/town/moon/MoonScene';
import { TownPrimitives } from '../src/game/town/TownPrimitives';
import { buildLandmark } from '../src/game/town/TownLandmarks';
import { layoutMoonLabels } from '../src/game/town/moon/MoonLabelLayout';
import TownLandmarkPreview from '../src/components/town/TownLandmarkPreview.vue';
import TownMonumentSite from '../src/components/town/TownMonumentSite.vue';

const sites = [AREA_BY_ID['moonstone-garden'], AREA_BY_ID['moonrock-court']];
beforeEach(() => {
  const storage = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  });
  setActivePinia(createPinia());
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
const command = (town, area) => ({
  kind: 'area',
  id: area.id,
  slot: 0,
  value: area.choices[0],
  ...landmarkOffer(town, area, area.choices[0]),
});
it.each(sites)(
  '$id purchases and upgrades durably in one transaction, with no coin fallback',
  (area) => {
    const campaign = useCampaignStore();
    campaign.town = {
      ...createTown(),
      era: 'twin-hollows',
      coins: 1e8,
      moonstones: 19,
      moonstonesEarned: 1000,
    };
    const gate = isEraComplete(campaign.town);
    const before = JSON.stringify(campaign.profile());
    expect(campaign.personalise([command(campaign.town, area)])).toBe(false);
    expect(JSON.stringify(campaign.profile())).toBe(before);
    campaign.town.moonstones = 300;
    vi.spyOn(campaign, 'save').mockReturnValue(false);
    const failed = JSON.stringify(campaign.profile());
    expect(campaign.personalise([command(campaign.town, area)])).toBe(false);
    expect(JSON.stringify(campaign.profile())).toBe(failed);
    vi.restoreAllMocks();
    expect(campaign.personalise([command(campaign.town, area)])).toBe(true);
    expect(campaign.town).toMatchObject({ coins: 1e8, moonstones: 280, moonstonesEarned: 1000 });
    expect(campaign.integrity.actions.at(-1)).toMatchObject({
      kind: 'landmark-buy',
      data: { purchases: [{ currency: 'moonstones', price: 20, monumentVersion: 3 }] },
    });
    for (let n = 0; n < 3; n++) campaign.town = advanceMonumentWorks(campaign.town);
    campaign.town = unveilLandmark(campaign.town, area.id, 1);
    campaign.town.moonstones = 29;
    const insufficient = JSON.stringify(campaign.profile());
    expect(campaign.personalise([command(campaign.town, area)])).toBe(false);
    expect(JSON.stringify(campaign.profile())).toBe(insufficient);
    campaign.town.moonstones = 30;
    expect(campaign.personalise([command(campaign.town, area)])).toBe(true);
    expect(campaign.town).toMatchObject({ coins: 1e8, moonstones: 0, moonstonesEarned: 1000 });
    expect(isEraComplete(campaign.town)).toBe(gate);
    expect(landmarkPayment(campaign.town, area, 60)).toMatchObject({
      icon: 'moonstone',
      affordable: false,
      missing: 60,
    });
  },
);
it.each(sites)('$id prices all designs and levels through one schedule', (area) => {
  for (const choice of area.choices) {
    expect([1, 2, 3, 4, 5].map((level) => landmarkPrice(area, choice, level))).toEqual([
      20, 30, 40, 50, 60,
    ]);
    expect([1, 2, 3, 4, 5].map((level) => landmarkPrice(area, choice, level, 2))).toEqual([
      60, 240, 600, 1200, 2100,
    ]);
  }
});
it('keeps coin curves and fails closed on incomplete or unsupported schedules', () => {
  const area = AREA_BY_ID['earthrise-plaza'];
  for (const choice of area.choices)
    expect([1, 2, 3, 4, 5].map((level) => landmarkPrice(area, choice, level))).toEqual(
      [1, 4, 10, 20, 35].map((multiplier) => LANDMARK_BY_ID[choice].price * multiplier),
    );
  const town = { ...createTown(), era: 'twin-hollows', coins: 1e9 };
  for (const levelPrices of [
    null,
    [],
    [20],
    [20, 30, 40, 50, -1],
    [20, 30, 40, 50, 1.5],
    [20, 30, 40, 50, Number.MAX_SAFE_INTEGER + 1],
    Array(5),
    'unknown',
  ]) {
    const incomplete = { ...area, levelPrices };
    expect(landmarkPrice(incomplete, area.choices[0], 1)).toBeNull();
    expect(landmarkOffer(town, incomplete, area.choices[0])).toBeNull();
  }
  expect(landmarkPrice(area, area.choices[0], 1, 999)).toBeNull();
  expect(landmarkPrice(area, area.choices[0], 6)).toBeNull();
  expect(landmarkPrice({ ...area, levelPrices: [0, 30, 40, 50, 60] }, area.choices[0], 1)).toBe(0);
});
it.each(sites)('$id retains an old-price outbox receipt and purchases at the new terms', (area) => {
  const campaign = useCampaignStore();
  campaign.town = { ...createTown(), era: 'twin-hollows', moonstones: 300, moonstonesEarned: 300 };
  const old = {
    ...command(campaign.town, area),
    monumentVersion: 2,
    currency: 'moonstones',
    price: 60,
  };
  expect(campaign.personalise([old])).toBe(true);
  const receipt = JSON.parse(JSON.stringify(campaign.integrity.actions.at(-1)));
  expect(receipt.data.purchases[0]).toMatchObject({ monumentVersion: 2, price: 60 });
  campaign.$reset();
  expect(campaign.integrity.actions.at(-1)).toEqual(receipt);
  expect(campaign.town.moonstones).toBe(240);
  for (let n = 0; n < 3; n++) campaign.town = advanceMonumentWorks(campaign.town);
  campaign.town = unveilLandmark(campaign.town, area.id, 1);
  const current = command(campaign.town, area);
  expect(purchaseLandmark(campaign.town, { ...current, price: 240 })).toBeNull();
  expect(campaign.personalise([current])).toBe(true);
  expect(campaign.town.moonstones).toBe(210);
  expect(campaign.town.personalisation.areaLevels[area.id]).toBe(2);
  expect(campaign.integrity.actions[0]).toEqual(receipt);
  expect(campaign.integrity.actions.at(-1).data.purchases[0]).toMatchObject({
    monumentVersion: LANDMARK_PROGRESSION.version,
    price: 30,
  });
});
it('separates settlements and reserves the lunar court outside all routes and reservations', () => {
  const [valley, moon] = sites;
  expect(areasForSettlement()).toContain(valley);
  expect(areasForSettlement()).not.toContain(moon);
  expect(areasForSettlement('moon')).toContain(moon);
  expect(areasForSettlement('moon')).not.toContain(valley);
  for (const site of sites)
    for (const other of areasForSettlement(site.settlement).filter((a) => a !== site))
      expect(
        Math.hypot(
          site.positions[0][0] - other.positions[0][0],
          site.positions[0][1] - other.positions[0][1],
        ),
      ).toBeGreaterThan(site.radius + other.radius + 1);
  const [x, z] = moon.positions[0],
    r = moon.radius + 0.4;
  expect(Math.hypot(x, z) + r).toBeLessThan(MOON_CRATER_RADIUS);
  expect(Math.hypot(x, z) - MOON_RING_ROAD).toBeGreaterThan(r + 1);
  for (const [id, [px, pz]] of Object.entries(MOON_LOTS))
    expect(Math.hypot(x - px, z - pz), id).toBeGreaterThan(r + moonPadRadius(id) + 1);
  for (const route of moonApproaches())
    for (let n = 1; n < route.points.length; n++)
      expect(moonSegmentDistance(x, z, route.points[n - 1], route.points[n])).toBeGreaterThan(
        r + route.width / 2,
      );
  for (let s = 0; s < 80; s++)
    expect(Math.hypot(x - 15 - 0.6 * s, z + 30 + s)).toBeGreaterThan(r + 6.4);
  for (let dx = -7; dx <= 7; dx++)
    for (let dz = -7; dz <= 7; dz++)
      if (Math.hypot(dx, dz) <= 7) expect(moonHeight(x + dx, z + dz)).toBeCloseTo(0, 7);
});
it.each(sites.flatMap((a) => a.choices))(
  '%s has distinct fallback art and five models within the geometry budget',
  async (choice) => {
    const d = new TownPrimitives();
    try {
      const triangles = new Set();
      for (let tier = 1; tier <= 5; tier++) {
        const root = buildLandmark(d, new Group(), choice, tier);
        let count = 0;
        const mats = new Set();
        root.traverse((m) => {
          if (m.isMesh) {
            count += (m.geometry.index?.count ?? m.geometry.attributes.position.count) / 3;
            mats.add(m.material);
          }
        });
        expect(count).toBeLessThan(6000);
        expect(mats.size).toBeLessThanOrEqual(8);
        triangles.add(count);
        const box = new Box3().setFromObject(root);
        expect(Math.max(-box.min.x, box.max.x, -box.min.z, box.max.z)).toBeLessThan(7);
        d.clearGroup(root);
      }
      expect(triangles.size).toBe(5);
      const art = await renderToString(
        createSSRApp({ render: () => h(TownLandmarkPreview, { choice, stage: 5 }) }),
      );
      expect(art).toContain('<path');
      expect(LANDMARK_BY_ID[choice].form).toBe(choice);
    } finally {
      d.disposePrimitives();
    }
  },
);
it.each(sites)(
  '$id uses the moonstone icon and translated resource terms in its details',
  async (area) => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(TownMonumentSite, { id: area.id, town: { ...createTown(), era: 'twin-hollows' } }),
      }),
    );
    expect(html).toContain('<image');
    expect(html).toContain('only with moonstones');
  },
);
it.each([
  [1440, 900],
  [900, 360],
  [375, 740],
])('declutters all lunar labels at %sx%s', (width, height) => {
  const labels = layoutMoonLabels(
    Array.from({ length: 13 }, (_, n) => ({ id: n, x: 50, y: 50, visible: true })),
    width,
    height,
  );
  expect(labels.every((l) => l.visible)).toBe(true);
  for (const [i, a] of labels.entries())
    for (const b of labels.slice(i + 1))
      expect(
        (Math.abs(a.x - b.x) * width) / 100 >= a.width + 5 ||
          (Math.abs(a.y - b.y) * height) / 100 >= a.height + 5,
      ).toBe(true);
});

it('finishes Twin Hollows with both resource sites empty or under construction', () => {
  const town = { ...createTown(), era: 'twin-hollows' };
  for (const building of BUILDINGS) {
    town.buildings[building.id] = building.upgrades.length;
    town.buildingEras[building.id] = town.era;
    town.buildingEraLevels[building.id] = 3;
  }
  expect(isEraComplete(town)).toBe(true);
  for (const area of sites) {
    town.personalisation.areas[area.id] = [area.choices[0]];
    town.personalisation.areaLevels[area.id] = 1;
    town.personalisation.construction[area.id] = { level: 1, wins: 0 };
  }
  expect(isEraComplete(town)).toBe(true);
});

it('recalculates label spacing when the canvas scales without changing aspect ratio', () => {
  const onLabels = vi.fn();
  const scene = Object.assign(Object.create(MoonScene.prototype), {
    canvas: { clientWidth: 720, clientHeight: 450 },
    camera: new PerspectiveCamera(48, 1.6, 0.1, 600),
    controls: { target: new Vector3() },
    lots: [{ id: 'site', position: new Vector3(0, 0, -10) }],
    onLabels,
  });
  scene.projectLabels();
  expect(onLabels).toHaveBeenCalledOnce();
  scene.canvas.clientWidth = 1440;
  scene.canvas.clientHeight = 900;
  scene.projectLabels();
  expect(onLabels).toHaveBeenCalledTimes(2);
});

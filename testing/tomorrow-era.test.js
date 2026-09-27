import { afterEach, describe, expect, it } from 'vitest';
import { Group, MeshBasicMaterial, Scene } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { motorVehicle } from '../src/game/town/TownVehicles';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { CITY_ARCHITECTURES, defineEra } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { CITY_BUILDINGS, CITY_FAMILIES } from '../src/data/city';
import { ROUNDED_FORMS, isRoundedEra, roundedForm } from '../src/data/roundedArchitecture';
import { BUILDINGS, BUILDING_BY_ID, createTown } from '../src/data/town';
import { purchasePrice } from '../src/data/economy';
import { advanceEra, eraGate, plotInEra } from '../src/game/town/TownEras';
import { buildWithHammer, plotUnlocked, upgradeOffer } from '../src/game/town/TownRules';
import { buildingBenefit } from '../src/game/town/TownBenefits';
import { PLOTS, plotStreet, routeBetween } from '../src/game/town/TownLayout';
import TownBuilding from '../src/components/town/TownBuilding.vue';

const TOMORROW_BUILDINGS = ['skyPods', 'biodome', 'maglevStation'];
function diorama(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
  });
  d.sign = () => {};
  d.town = { ...createTown(), era };
  return d;
}
function complete(era) {
  const town = createTown();
  Object.assign(town, { era, coins: 1e7, tourSeen: true, completedRuns: 144, nextRaidRun: 999 });
  for (const b of BUILDINGS.filter((b) => plotInEra(town, b.id))) {
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = era;
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
}
// Draw calls after the plot batch equal materials; triangles are what the GPU draws.
function cost(root) {
  let triangles = 0;
  const materials = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    materials.add(o.material);
    const g = o.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { triangles, materials: materials.size };
}
function signature(root) {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (o.isMesh) parts.push([o.geometry.uuid, o.material.color.getHex(), o.matrixWorld.toArray()]);
  });
  return JSON.stringify(parts);
}
function plotCost(d, id) {
  const group = new Group();
  d.buildPlot(id, group, d.town, Object.fromEntries(BUILDINGS.map((b) => [b.id, b.shortName])));
  const result = cost(group);
  d.clearGroup(group);
  return result;
}

afterEach(() => {
  delete ERA_BY_ID['tomorrow-successor'];
});

describe('Tomorrow City era contract', () => {
  it('follows Connected City as a rounded city era with its own capabilities', () => {
    expect(ERAS.at(-1).id).toBe('tomorrow');
    expect(ERAS.at(-2).id).toBe('contemporary');
    const profile = eraEvolution('tomorrow');
    expect(profile).toMatchObject({
      style: 'city',
      architecture: 'rounded',
      fountain: 'orbital-rings',
      roadStyle: 'glow-lane',
      wardrobe: 'tomorrow',
    });
    expect(isRoundedEra('tomorrow')).toBe(true);
    for (const era of ERAS.slice(0, -1)) {
      expect(era.evolution.architecture, era.id).toBe('standard');
      expect(isRoundedEra(era.id), era.id).toBe(false);
    }
    expect(isRoundedEra('unknown-save-era')).toBe(false);
    // Modernization and new buildings cost more than the previous era; mining is unchanged.
    const before = eraEvolution('contemporary');
    profile.prices.forEach((price, i) => expect(price).toBeGreaterThan(before.prices[i]));
    profile.newBuildingPrices.forEach((price, i) =>
      expect(price).toBeGreaterThan(before.newBuildingPrices[i]),
    );
  });

  it('rejects unsupported or misplaced architectures when the catalog loads', () => {
    expect(CITY_ARCHITECTURES).toEqual(['standard', 'rounded']);
    const base = { ...ERA_BY_ID.contemporary, id: 'invalid-architecture' };
    expect(() =>
      defineEra({ ...base, evolution: { ...base.evolution, architecture: 'blobby' } }),
    ).toThrow('Unsupported architecture');
    expect(() =>
      defineEra({
        ...ERA_BY_ID['motor-age'],
        id: 'rounded-motor',
        evolution: { ...ERA_BY_ID['motor-age'].evolution, architecture: 'rounded' },
      }),
    ).toThrow('Only city eras');
    expect(
      defineEra({ ...base, evolution: { style: 'city', ...pick(base) } }).evolution,
    ).toMatchObject({ architecture: 'standard' });
  });

  it('opens after a complete Connected City and keeps every existing facade', () => {
    const town = complete('contemporary');
    expect(eraGate(town).available).toBe(true);
    const next = advanceEra(town, 'contemporary');
    expect(next).toMatchObject({ era: 'tomorrow', transition: { from: 'contemporary' } });
    expect(next.buildingEras).toEqual(town.buildingEras);
    expect(next.buildings).toEqual(town.buildings);
  });
});

function pick(era) {
  const { prices, cityAssets, newBuildingPrices } = era.evolution;
  return { prices, cityAssets, newBuildingPrices };
}

describe('Rounded architecture rendering', () => {
  it('gives every city family a rounded form, leaving shared shells to the standard renderer', () => {
    const families = new Set(Object.values(CITY_FAMILIES));
    for (const family of families)
      if (!['airport', 'square', 'bridge'].includes(family))
        expect(ROUNDED_FORMS[family], family).toBeTruthy();
    expect(roundedForm('airport')).toBeNull();
    expect(roundedForm('square')).toBeNull();
    expect(roundedForm('not-a-building')).toBeNull();
  });

  it('renders every city kind procedurally within the per-building budgets', () => {
    const d = diorama('tomorrow');
    for (const kind of Object.keys(CITY_FAMILIES)) {
      if (!roundedForm(kind)) continue;
      const root = new Group();
      expect(renderCityBuilding(d, root, kind, kind, 3, 'tomorrow', 3), kind).toBe(true);
      expect(root.getObjectByName(`tomorrow rounded ${kind} level 3`), kind).toBeTruthy();
      let blender = false;
      root.traverse((o) => {
        if (o.userData.substitute) blender = true;
      });
      expect(blender, kind).toBe(false);
      // Measure the building itself; shared docks and signs keep their own budgets.
      const { triangles, materials } = cost(
        root.getObjectByName(`tomorrow rounded ${kind} level 3`),
      );
      // Gardens wrap the shared leisure model; the whole-town comparison covers them.
      if (roundedForm(kind) === 'garden') continue;
      expect(triangles, kind).toBeLessThan(4000);
      expect(materials, kind).toBeLessThanOrEqual(8);
    }
  });

  it('changes visibly at each rounded level and never reuses the contemporary shell', async () => {
    await loadFamilies(ALL_MESH_FAMILIES);
    const d = diorama('tomorrow');
    for (const kind of ['home', 'bank', 'shop', 'garage', 'waterPlant', 'library', 'skyline']) {
      const seen = new Set();
      for (const level of [1, 2, 3]) {
        const root = new Group();
        renderCityBuilding(d, root, kind, kind, level, 'tomorrow', 3);
        seen.add(signature(root));
      }
      expect(seen.size, kind).toBe(3);
      const old = new Group();
      renderCityBuilding(d, old, kind, kind, 3, 'contemporary', 3);
      expect(seen.has(signature(old)), kind).toBe(false);
    }
  });

  it('draws a whole Tomorrow town with fewer triangles and no more materials than Connected City', async () => {
    await loadFamilies(ALL_MESH_FAMILIES);
    const totals = {};
    for (const era of ['contemporary', 'tomorrow']) {
      const d = diorama(era);
      d.town = complete(era);
      totals[era] = { triangles: 0, materials: 0 };
      for (const b of BUILDINGS) {
        if (b.id === 'mine' || !plotInEra(d.town, b.id) || b.introducedEra === 'tomorrow') continue;
        const { triangles, materials } = plotCost(d, b.id);
        totals[era].triangles += triangles;
        totals[era].materials = Math.max(totals[era].materials, materials);
      }
    }
    expect(totals.tomorrow.triangles).toBeLessThan(totals.contemporary.triangles);
    expect(totals.tomorrow.materials).toBeLessThanOrEqual(totals.contemporary.materials);
  });

  it('lets a future rounded era reuse the same forms without renderer changes', () => {
    ERA_BY_ID['tomorrow-successor'] = defineEra({
      ...ERA_BY_ID.tomorrow,
      id: 'tomorrow-successor',
      evolution: { ...ERA_BY_ID.tomorrow.evolution },
    });
    const d = diorama('tomorrow');
    for (const kind of ['home', 'crystalLab', 'skyPods']) {
      const a = new Group(),
        b = new Group();
      renderCityBuilding(d, a, kind, kind, 3, 'tomorrow', 3);
      renderCityBuilding(d, b, kind, kind, 3, 'tomorrow-successor', 3);
      expect(cost(b)).toEqual(cost(a));
    }
  });

  it('moves traffic in wheel-less hover pods with the usual clearance box', () => {
    const d = diorama('tomorrow');
    for (const bus of [false, true]) {
      const pod = motorVehicle(d, new Group(), bus, 'tomorrow');
      expect(pod.userData.wheels).toEqual([]);
      expect(pod.userData.vehicleBox).toEqual({ halfWidth: 0.36, halfLength: bus ? 1.2 : 0.85 });
      expect(cost(pod).triangles).toBeLessThan(400);
    }
  });
});

describe('Tomorrow City buildings', () => {
  it('opens three new plots only in Tomorrow City, on the widened east bank', () => {
    const contemporary = complete('contemporary'),
      tomorrow = complete('contemporary');
    tomorrow.era = 'tomorrow';
    for (const id of TOMORROW_BUILDINGS) {
      expect(BUILDING_BY_ID[id].introducedEra).toBe('tomorrow');
      expect(plotUnlocked(contemporary, id), id).toBe(false);
      expect(plotUnlocked(tomorrow, id), id).toBe(true);
      expect(PLOTS[id][0]).toBe(65);
      const route = routeBetween(tomorrow, plotStreet('square'), plotStreet(id));
      expect(route?.length, id).toBeGreaterThan(1);
    }
  });

  it('charges the era prices and previews real services', () => {
    let town = complete('contemporary');
    town.era = 'tomorrow';
    const prices = eraEvolution('tomorrow').newBuildingPrices;
    for (const id of TOMORROW_BUILDINGS) {
      const offer = upgradeOffer(town, id);
      const major = id === 'skyPods';
      const costs = BUILDING_BY_ID[id].upgrades.map((upgrade) => upgrade.cost);
      expect(offer.cost, id).toBe(costs[0]);
      // The shared catalog markup applies on top of the era's authored prices.
      costs.forEach((price, i) =>
        expect(price, id).toBe(purchasePrice(Math.ceil(prices[i] * (major ? 1.25 : 1)))),
      );
      expect(BUILDING_BY_ID[id].upgrades[0].runs, id).toBe(major ? 2 : 1);
    }
    expect(buildingBenefit(town, 'skyPods', 1).label).toBe('Resident capacity');
    expect(buildingBenefit(town, 'biodome', 1).label).toBe('Food capacity');
    expect(buildingBenefit(town, 'maglevStation', 1).label).toBe('Visitor capacity');
    for (const id of TOMORROW_BUILDINGS) {
      let offer;
      while ((offer = upgradeOffer(town, id))) town = buildWithHammer(town, id, offer.stage);
      expect(town.buildings[id], id).toBe(3);
    }
    expect(CITY_BUILDINGS.filter((b) => b.introducedEra === 'tomorrow')).toHaveLength(3);
  });

  it('draws the accessible map with the same rounded forms', async () => {
    for (const id of ['home', 'skyPods', 'biodome', 'maglevStation', 'skyline', 'powerHouse']) {
      const html = await renderToString(
        createSSRApp({
          render: () => h('svg', [h(TownBuilding, { id, era: 'tomorrow', eraLevel: 3, stage: 3 })]),
        }),
      );
      expect(html, id).toContain(`data-form="${roundedForm(BUILDING_BY_ID[id].kind)}"`);
      expect(html, id).not.toContain('NaN');
    }
    const airport = await renderToString(
      createSSRApp({
        render: () =>
          h('svg', [h(TownBuilding, { id: 'airport', era: 'tomorrow', eraLevel: 3, stage: 3 })]),
      }),
    );
    expect(airport).not.toContain('data-form');
  });
});

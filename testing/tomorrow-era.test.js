import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import { animateVehicle, motorVehicle, responseVehicle } from '../src/game/town/TownVehicles';
import { addAviationActivity } from '../src/game/town/TownAviation';
import { roundedAircraft } from '../src/game/town/RoundedTransports';
import { animalModel } from '../src/game/town/TownAnimalModels';
import { animalKey } from '../src/game/town/TownAnimals';
import { townWardrobe } from '../src/data/townWardrobes';
import { addEraActivity } from '../src/game/town/TownEraActivity';
import { ALL_MESH_FAMILIES, loadFamilies } from '../src/game/town/assets/MeshCatalog';
import { CITY_ARCHITECTURES, TRANSPORT_STYLES, defineEra } from '../src/data/eraDefinitions';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { CITY_BUILDINGS, CITY_FAMILIES } from '../src/data/city';
import {
  ROUNDED_FORMS,
  hasRoundedTransport,
  isRoundedEra,
  roundedForm,
} from '../src/data/roundedArchitecture';
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
    const tomorrowIndex = ERAS.findIndex(({ id }) => id === 'tomorrow');
    expect(ERAS[tomorrowIndex - 1].id).toBe('contemporary');
    expect(ERAS[tomorrowIndex + 1].id).toBe('canopy');
    const profile = eraEvolution('tomorrow');
    expect(profile).toMatchObject({
      style: 'city',
      architecture: 'rounded',
      transportStyle: 'rounded',
      fountain: 'orbital-rings',
      roadStyle: 'glow-lane',
      wardrobe: 'tomorrow',
    });
    expect(isRoundedEra('tomorrow')).toBe(true);
    for (const era of ERAS.slice(0, tomorrowIndex)) {
      expect(era.evolution.architecture, era.id).toBe('standard');
      expect(isRoundedEra(era.id), era.id).toBe(false);
      expect(hasRoundedTransport(era.id), era.id).toBe(false);
    }
    // Later eras may change their buildings, but never trade the saucer back for a jet.
    for (const era of ERAS.slice(tomorrowIndex))
      expect(hasRoundedTransport(era.id), era.id).toBe(true);
    expect(isRoundedEra('unknown-save-era')).toBe(false);
    expect(hasRoundedTransport('unknown-save-era')).toBe(false);
    // Modernization and new buildings cost more than the previous era; mining is unchanged.
    const before = eraEvolution('contemporary');
    profile.prices.forEach((price, i) => expect(price).toBeGreaterThan(before.prices[i]));
    profile.newBuildingPrices.forEach((price, i) =>
      expect(price).toBeGreaterThan(before.newBuildingPrices[i]),
    );
  });

  it('rejects unsupported or misplaced architectures when the catalog loads', () => {
    expect(CITY_ARCHITECTURES).toEqual(['standard', 'rounded', 'cozy']);
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
    ).toMatchObject({ architecture: 'standard', transportStyle: 'standard' });
  });

  it('rejects unsupported or misplaced transport styles when the catalog loads', () => {
    expect(TRANSPORT_STYLES).toEqual(['standard', 'rounded']);
    const base = { ...ERA_BY_ID.contemporary, id: 'invalid-transport' };
    expect(() =>
      defineEra({ ...base, evolution: { ...base.evolution, transportStyle: 'teleport' } }),
    ).toThrow('Unsupported transport style');
    expect(() =>
      defineEra({
        ...ERA_BY_ID['motor-age'],
        id: 'rounded-motor',
        evolution: { ...ERA_BY_ID['motor-age'].evolution, transportStyle: 'rounded' },
      }),
    ).toThrow('Only city eras');
    // Transport is independent of architecture in both directions.
    expect(
      defineEra({
        ...base,
        evolution: { ...base.evolution, architecture: 'rounded', transportStyle: 'standard' },
      }).evolution,
    ).toMatchObject({ architecture: 'rounded', transportStyle: 'standard' });
    expect(
      defineEra({ ...base, evolution: { ...base.evolution, transportStyle: 'rounded' } }).evolution,
    ).toMatchObject({ architecture: 'standard', transportStyle: 'rounded' });
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

  it('dresses Tomorrow villagers in visors and collar rings without new instanced shapes', () => {
    const d = diorama('tomorrow');
    Object.assign(d, { world: new Group(), actors: [], motions: [] });
    const shapes = (era) => {
      const actor = d.person({
        route: [
          [0, 0],
          [1, 0],
        ],
        color: '#6fb5b0',
        skin: '#d8ae83',
        hat: '#baa06d',
        seed: 4,
        manual: true,
        era,
      });
      const geometries = new Set();
      actor.root.traverse((o) => {
        if (o.isMesh) geometries.add(o.geometry.uuid);
      });
      return { actor, geometries };
    };
    const tomorrow = shapes('tomorrow'),
      contemporary = shapes('contemporary');
    expect(tomorrow.actor.root.getObjectByName('Glowing collar ring')).toBeTruthy();
    expect(contemporary.actor.root.getObjectByName('Glowing collar ring')).toBeFalsy();
    expect(tomorrow.actor.clothing.hat).toHaveLength(1);
    expect(contemporary.actor.clothing.hat).toHaveLength(0);
    // Actor instancing groups by geometry, so new parts must reuse existing shapes.
    for (const uuid of tomorrow.geometries) expect(contemporary.geometries.has(uuid)).toBe(true);
  });

  it('dresses the village dog as a Cosmo-style space dog in Tomorrow City only', () => {
    const d = diorama('tomorrow');
    Object.assign(d, { world: new Group() });
    const space = animalModel(d, 'dog', 4, townWardrobe(eraEvolution('tomorrow')).petCostume);
    const plain = animalModel(d, 'dog', 4, townWardrobe(eraEvolution('contemporary')).petCostume);
    expect(space.root.userData.costume).toBe('space-helmet');
    expect(space.root.getObjectByName('Space dog helmet')).toBeTruthy();
    expect(plain.root.getObjectByName('Space dog helmet')).toBeFalsy();
    // The bubble is see-through so the dog's face stays visible, and it encloses the head.
    const bubble = space.root.getObjectByName('Space dog helmet').children[0];
    expect(bubble.material.transparent).toBe(true);
    space.root.updateMatrixWorld(true);
    const head = new Box3().setFromObject(space.head.children[0]);
    expect(new Box3().setFromObject(bubble).containsBox(head)).toBe(true);
    // A costume change must not reuse the plain dog across an era rebuild.
    expect(animalKey({ species: 'dog', seed: 4, costume: 'space-helmet' })).not.toBe(
      animalKey({ species: 'dog', seed: 4 }),
    );
  });

  it.each(['tomorrow', 'canopy', 'riverlight'])(
    'floats %s hover cars and response pods on a gentle bob',
    (era) => {
      const d = diorama(era);
      for (const vehicle of [
        motorVehicle(d, new Group(), false, era),
        motorVehicle(d, new Group(), true, era),
        responseVehicle(d, new Group(), true, era),
      ]) {
        const body = vehicle.userData.hoverBody;
        expect(body).toBeTruthy();
        animateVehicle(vehicle, 1);
        expect(Math.abs(body.position.y)).toBeGreaterThan(0);
        expect(Math.abs(body.position.y)).toBeLessThanOrEqual(0.04);
      }
      const truck = responseVehicle(d, new Group(), true, 'contemporary');
      expect(truck.userData.wheels.length).toBeGreaterThan(0);
    },
  );

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

describe('Tomorrow City transport', () => {
  // Vehicles move every frame and are never batched: count meshes, not just triangles.
  function transports(era) {
    const d = diorama(era);
    Object.assign(d, { world: new Group(), motions: [], actors: [], visitorTransports: new Map() });
    const town = complete(era);
    d.town = town;
    addAviationActivity(d, town);
    addEraActivity(d, town);
    d.motions.forEach((motion) => motion(3));
    const find = (name) => d.world.getObjectByName(name);
    return { d, find };
  }
  it.each(['tomorrow', 'canopy', 'riverlight'])(
    'flies, sails and glides rounded vehicles once %s buildings are modernized',
    (era) => {
      const { find } = transports(era);
      // Moving vehicles are drawn per mesh; the train stays near the Blender railcars' 21 parts.
      for (const [name, budget] of [
        ['Sky saucer', 16],
        ['Hover river ferry', 16],
        ['Solar express train', 24],
      ]) {
        const vehicle = find(name);
        expect(vehicle, name).toBeTruthy();
        let meshes = 0;
        vehicle.traverse((o) => {
          if (o.isMesh) meshes++;
        });
        expect(meshes, name).toBeLessThanOrEqual(budget);
        expect(cost(vehicle).triangles, name).toBeLessThan(2500);
        expect(cost(vehicle).materials, name).toBeLessThanOrEqual(6);
      }
    },
  );
  it('lands the saucer on legs that reach the ground and spins its rim lights', () => {
    const d = diorama('tomorrow');
    const saucer = roundedAircraft(d, new Group());
    saucer.updateMatrixWorld(true);
    const bounds = new Box3().setFromObject(saucer);
    expect(bounds.min.y).toBeGreaterThanOrEqual(0);
    expect(bounds.min.y).toBeLessThan(0.05);
    // Every leg runs from inside the hull down to its foot pad: nothing floats.
    const hull = new Box3().setFromObject(saucer.children[0]);
    const legs = saucer.children.filter((o) => o.isMesh && o.scale.x === 0.06);
    expect(legs).toHaveLength(3);
    for (const leg of legs) {
      const box = new Box3().setFromObject(leg);
      expect(box.max.y).toBeGreaterThan(hull.min.y);
      expect(box.min.y).toBeLessThan(0.1);
    }
    const ring = saucer.getObjectByName('propellerLeft');
    const before = new Vector3(2.35, 0, 0).applyMatrix4(ring.matrixWorld);
    ring.rotation.z = Math.PI / 2;
    saucer.updateMatrixWorld(true);
    const after = new Vector3(2.35, 0, 0).applyMatrix4(ring.matrixWorld);
    expect(after.y).toBeCloseTo(before.y, 6);
    expect(after.distanceTo(before)).toBeGreaterThan(1);
  });
  it('runs the solar express on rolling axles that sit on the rails', () => {
    const { find } = transports('tomorrow');
    const train = find('Solar express train');
    const axles = [];
    train.traverse((o) => {
      if (o.isMesh && o.rotation.order === 'ZYX') axles.push(o);
    });
    expect(axles).toHaveLength(6);
    train.updateMatrixWorld(true);
    for (const axle of axles) {
      const box = new Box3().setFromObject(axle);
      // The axle spans both rails (gauge ±0.52).
      expect(box.max.z - box.min.z).toBeGreaterThanOrEqual(1.04);
      // The suspension pivot sits on the rail head, like the older trains' wheel bottoms.
      const rail = axle.parent.parent.getWorldPosition(new Vector3()).y;
      // Allow for the carriage pitching on the bridge approach.
      expect(Math.abs(box.min.y - rail)).toBeLessThan(0.06);
    }
  });
  it('keeps the Connected City vehicles until those buildings are modernized', () => {
    const { find } = transports('contemporary');
    expect(find('Passenger jet')).toBeTruthy();
    expect(find('Solar river ferry')).toBeTruthy();
    expect(find('Electric city train')).toBeTruthy();
    expect(find('Sky saucer')).toBeFalsy();
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

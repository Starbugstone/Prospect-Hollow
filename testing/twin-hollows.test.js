import { describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderMoonBuilding, MOON_FORMS } from '../src/game/town/buildings/moon';
import { elevatorArrival } from '../src/game/town/buildings/future';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import {
  BUILDINGS,
  BUILDING_BY_ID,
  EARTH_BUILDINGS,
  MOON_BUILDINGS,
  createTown,
} from '../src/data/town';
import { isMoonBuilding } from '../src/data/city';
import {
  MOON_CRATER_RADIUS,
  MOON_LOTS,
  MOON_LOT_RADIUS,
  MOON_RING_ROAD,
  moonLetters,
  moonSettlement,
  moonstoneKeepsakes,
} from '../src/data/moonSettlement';
import { VISITOR_TRANSPORTS } from '../src/data/visitorArrivals';
import {
  eraBuildingLevel,
  finishEra,
  isEraComplete,
  modernizesInEra,
  plotInEra,
} from '../src/game/town/TownEras';
import { upgradeOffer } from '../src/game/town/TownRules';
import { PLOTS, visiblePlots } from '../src/game/town/TownLayout';
import TownBuilding from '../src/components/town/TownBuilding.vue';
import TownMoonBuilding from '../src/components/town/TownMoonBuilding.vue';

function diorama() {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
  });
  return d;
}
function snapshot(root) {
  const parts = [];
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (mesh.isMesh) parts.push([mesh.material.color.getHex(), mesh.matrixWorld.toArray()]);
  });
  return JSON.stringify(parts);
}
function cost(root) {
  let triangles = 0;
  const materials = new Set();
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    triangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3;
    materials.add(mesh.material);
  });
  return { triangles, materials: materials.size };
}
// A Twin Hollows town with every earlier building finished in its last finish.
function twinTown() {
  const town = { ...createTown(), era: 'twin-hollows', coins: 1e9, completedRuns: 9999 };
  for (const b of BUILDINGS) {
    if (!plotInEra(town, b.id)) continue;
    town.buildings[b.id] = b.upgrades.length;
    town.buildingEras[b.id] = finishEra(b.id, 'twin-hollows');
    town.buildingEraLevels[b.id] = 3;
  }
  return town;
}

describe('Twin Hollows: the Moon is the new frontier', () => {
  it('follows Moonward and modernizes only a few homecoming landmarks', () => {
    expect(ERAS.at(-1).id).toBe('twin-hollows');
    expect(ERAS.at(-2).id).toBe('moonward');
    const list = eraEvolution('twin-hollows').modernizes;
    expect(list).toContain('spaceElevator');
    for (const id of list) expect(BUILDING_BY_ID[id], id).toBeTruthy();
    // Every other era still modernizes every building.
    for (const era of ERAS.slice(0, -1)) expect(eraEvolution(era.id).modernizes).toBeNull();
    expect(modernizesInEra('twin-hollows', 'home')).toBe(false);
    expect(modernizesInEra('twin-hollows', 'square')).toBe(true);
    expect(modernizesInEra('moonward', 'home')).toBe(true);
  });

  it('rejects an invalid modernizes list when the catalog loads', () => {
    const base = { ...ERA_BY_ID['twin-hollows'], id: 'bad-list' };
    for (const modernizes of ['square', [''], [3]])
      expect(() => defineEra({ ...base, evolution: { ...base.evolution, modernizes } })).toThrow(
        /modernizes/,
      );
  });

  it('keeps every other building in its Moonward finish and counts it as complete', () => {
    const town = twinTown();
    expect(town.buildingEras.home).toBe('moonward');
    expect(eraBuildingLevel(town, 'home')).toBe(3);
    expect(upgradeOffer(town, 'home')).toBeNull();
    expect(finishEra('home', 'twin-hollows')).toBe('moonward');
    expect(finishEra('square', 'twin-hollows')).toBe('twin-hollows');
    expect(finishEra('home', 'frontier')).toBe('frontier');
    // The homecoming landmarks still offer this era's modernization.
    town.buildingEras.square = 'moonward';
    town.buildingEraLevels.square = 3;
    expect(upgradeOffer(town, 'square')).toMatchObject({ targetEra: 'twin-hollows' });
    expect(isEraComplete(town)).toBe(false);
  });

  it('needs New Hollow finished as well as the valley before the era is complete', () => {
    const town = twinTown();
    expect(isEraComplete(town)).toBe(true);
    for (const b of MOON_BUILDINGS) {
      const copy = structuredClone(town);
      copy.buildings[b.id] = 2;
      expect(isEraComplete(copy), b.id).toBe(false);
    }
  });
});

describe('New Hollow buildings', () => {
  it('stand on the Moon map and never on a valley lot', () => {
    expect(MOON_BUILDINGS.length).toBe(Object.keys(MOON_LOTS).length);
    expect(EARTH_BUILDINGS.length + MOON_BUILDINGS.length).toBe(BUILDINGS.length);
    const town = twinTown();
    for (const b of MOON_BUILDINGS) {
      expect(isMoonBuilding(b.id)).toBe(true);
      expect(PLOTS[b.id], b.id).toBeUndefined();
      expect(MOON_LOTS[b.id], b.id).toBeTruthy();
      expect(b.introducedEra).toBe('twin-hollows');
      expect(b.unlock).toEqual([{ id: 'spaceElevator', level: 1 }]);
    }
    expect(visiblePlots(town).some(({ id }) => isMoonBuilding(id))).toBe(false);
    expect(PLOTS.homecomingHall).toBeTruthy();
    expect(isMoonBuilding('homecomingHall')).toBe(false);
  });

  it('keeps every lot inside the crater, off the ring road and apart from its neighbors', () => {
    const lots = Object.entries(MOON_LOTS);
    for (const [id, [x, z]] of lots) {
      const r = Math.hypot(x, z);
      expect(r + MOON_LOT_RADIUS, id).toBeLessThan(MOON_CRATER_RADIUS);
      expect(Math.abs(r - MOON_RING_ROAD), id).toBeGreaterThan(MOON_LOT_RADIUS - 0.4);
      for (const [other, [ox, oz]] of lots)
        if (other !== id)
          expect(Math.hypot(x - ox, z - oz), `${id} ${other}`).toBeGreaterThan(MOON_LOT_RADIUS * 2);
    }
  });

  it('draws every Moon building through three distinct stages within its budget and lot', () => {
    const d = diorama();
    expect([...MOON_FORMS].sort()).toEqual(Object.keys(MOON_LOTS).sort());
    for (const kind of MOON_FORMS) {
      const stages = new Set();
      for (const level of [0, 1, 2, 3]) {
        const root = renderMoonBuilding(d, new Group(), kind, level);
        stages.add(snapshot(root));
        const budget = cost(root);
        expect(budget.triangles, kind).toBeLessThan(6000);
        expect(budget.materials, kind).toBeLessThanOrEqual(8);
        root.traverse((part) => {
          if (part.isMesh)
            expect(part.matrixWorld.elements.every(Number.isFinite), kind).toBe(true);
        });
        // The ribbon rises out of the landing; everything else stays on its lot.
        const bounds = new Box3();
        root.traverse((part) => {
          if (part.isMesh && !['Moon ribbon'].includes(part.name) && part.castShadow !== false)
            bounds.expandByObject(part);
        });
        if (!bounds.isEmpty())
          for (const v of [bounds.min.x, bounds.max.x, bounds.min.z, bounds.max.z])
            expect(Math.abs(v), `${kind} ${level}`).toBeLessThanOrEqual(MOON_LOT_RADIUS + 0.6);
      }
      expect(stages.size, kind).toBe(4);
    }
  });

  it('sends letters and moonstone keepsakes home as New Hollow grows, saving nothing new', () => {
    const town = twinTown();
    for (const b of MOON_BUILDINGS) town.buildings[b.id] = 0;
    expect(moonLetters(town)).toEqual([]);
    expect(moonstoneKeepsakes(town)).toBe(0);
    town.buildings.settlerDomes = 2;
    town.buildings.willowkinDome = 1;
    expect(moonLetters(town).map(({ id }) => id)).toEqual(['settlerDomes', 'willowkinDome']);
    expect(moonstoneKeepsakes(town)).toBe(3);
    // The homestead lights keep growing with the supply era's Moon buildings.
    const before = moonSettlement({ ...town, buildings: { ...town.buildings, settlerDomes: 0 } });
    expect(moonSettlement(town).homesteads).toBeGreaterThanOrEqual(before.homesteads);
  });

  it('brings Moon guests down the elevator once per climber trip', () => {
    expect(VISITOR_TRANSPORTS.at(-1)).toBe('spaceElevator');
    expect(elevatorArrival(0)).toMatchObject({ arrived: true, visit: 0 });
    expect(elevatorArrival(20)).toMatchObject({ arrived: false, visit: 0 });
    expect(elevatorArrival(47)).toMatchObject({ arrived: true, visit: 1 });
  });

  it('draws accessible Moon illustrations at every stage', async () => {
    for (const kind of Object.keys(MOON_LOTS)) {
      const stages = new Set();
      for (const level of [0, 1, 2, 3]) {
        const html = await renderToString(
          createSSRApp({ render: () => h('svg', [h(TownMoonBuilding, { kind, level })]) }),
        );
        expect(html, kind).not.toContain('NaN');
        expect(html, kind).toContain(`data-moon-form="${kind}"`);
        stages.add(html);
      }
      expect(stages.size, kind).toBe(4);
      const card = await renderToString(
        createSSRApp({
          render: () => h('svg', [h(TownBuilding, { id: kind, era: 'twin-hollows', stage: 2 })]),
        }),
      );
      expect(card, kind).toContain(`data-moon-form="${kind}"`);
    }
  });
});

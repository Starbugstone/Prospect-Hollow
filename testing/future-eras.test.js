import { afterEach, describe, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Scene, Vector3 } from 'three';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { renderCityBuilding } from '../src/game/town/buildings/city';
import {
  ELEVATOR_CLIMBERS,
  moveClimbers,
  renderFutureBuilding,
} from '../src/game/town/buildings/future';
import { CITY_FAMILIES, CITY_BUILDINGS } from '../src/data/city';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { createTown, BUILDING_BY_ID } from '../src/data/town';
import {
  FUTURE_ARCHITECTURES,
  FUTURE_LANDMARKS,
  FUTURE_PALETTES,
  futureAppearance,
  futureForm,
  isFutureEra,
} from '../src/data/futureArchitecture';
import { MOON_SETTLEMENT_LIMIT, moonSettlement } from '../src/data/moonSettlement';
import { FUTURE_MINE_PORTALS } from '../src/data/futureArchitecture';
import { mineProfile } from '../src/data/mineEvolution';
import { FUTURE_MINE_CROWNS } from '../src/game/town/mine/MineFutureArchitecture';
import { addMineSite } from '../src/game/town/mine/addMineSite';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { COZY_LANDMARKS } from '../src/data/cozyArchitecture';
import { sailKit } from '../src/game/town/buildings/future/sail';
import { townTracks, plotStreet } from '../src/game/town/TownLayout';
import TownBuilding from '../src/components/town/TownBuilding.vue';

const FUTURE_ERAS = ['skysail', 'stargazer', 'moonward', 'twin-hollows'];

function diorama(era) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    scene: new Scene(),
    world: new Group(),
    geometries: createTownGeometries(),
    materials: new Map(),
    contactShadowMaterial: new MeshBasicMaterial(),
    town: { ...createTown(), era },
  });
  d.sign = () => {};
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
    const geometry = mesh.geometry;
    triangles += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    materials.add(mesh.material);
  });
  return { triangles, materials: materials.size };
}
function dispose(d) {
  Object.values(d.geometries).forEach((geometry) => geometry.dispose());
  d.materials.forEach((material) => material.dispose());
  d.contactShadowMaterial.dispose();
}
afterEach(() => delete ERA_BY_ID['future-successor']);

describe('Skysail, Stargazer and Moonward eras', () => {
  it('follow Riverlight in order, each with its own architecture and story', () => {
    const ids = ERAS.map(({ id }) => id);
    expect(ids.slice(ids.indexOf('riverlight'))).toEqual(['riverlight', ...FUTURE_ERAS]);
    expect(FUTURE_ERAS.map((era) => eraEvolution(era).architecture)).toEqual(FUTURE_ARCHITECTURES);
    for (const era of FUTURE_ERAS) {
      expect(isFutureEra(era)).toBe(true);
      expect(ERA_BY_ID[era].story).toContain('Willowkin');
      // The Willowkin keep walking the streets in every later era.
      expect(eraEvolution(era).wildlife).toBe('garden-town');
    }
    expect(isFutureEra('riverlight')).toBe(false);
    expect(isFutureEra('unknown-save-era')).toBe(false);
  });

  it('uses distinct bounded palettes and safely supports incomplete successors', () => {
    const keys = Object.keys(FUTURE_PALETTES.sail);
    for (const style of FUTURE_ARCHITECTURES) {
      expect(Object.keys(FUTURE_PALETTES[style])).toEqual(keys);
      expect(new Set(Object.values(FUTURE_PALETTES[style])).size).toBe(8);
    }
    expect(new Set(FUTURE_ARCHITECTURES.map((s) => FUTURE_PALETTES[s].roof)).size).toBe(
      FUTURE_ARCHITECTURES.length,
    );
    ERA_BY_ID['future-successor'] = {
      evolution: { ...eraEvolution('skysail'), architecture: 'missing' },
    };
    expect(futureAppearance('future-successor').style).toBe('sail');
    expect(futureForm('missing-building')).toBeNull();
    expect(futureForm('constructor')).toBeNull();
    expect(futureForm('airport')).toBeNull();
    expect(futureForm('bridge')).toBeNull();
  });

  it.each(FUTURE_ERAS)('renders every %s building through three distinct paid stages', (era) => {
    const d = diorama(era);
    for (const kind of Object.keys(CITY_FAMILIES)) {
      if (!futureForm(kind)) continue;
      const stages = new Set();
      for (const level of [1, 2, 3]) {
        const root = new Group();
        expect(renderCityBuilding(d, root, kind, kind, level, era, 3), kind).toBe(true);
        stages.add(snapshot(root));
        const style = futureAppearance(era).style;
        const art = root.getObjectByName(`${era} ${style} ${kind} level ${level}`);
        expect(art, kind).toBeTruthy();
        art.traverse((part) => {
          expect(part.isLight, kind).not.toBe(true);
          if (part.isMesh)
            expect(part.matrixWorld.elements.every(Number.isFinite), kind).toBe(true);
        });
        if (
          !['garden', 'square'].includes(futureForm(kind)) &&
          !['stable', 'garage', 'busDepot'].includes(kind)
        ) {
          const budget = cost(art);
          expect(budget.triangles, kind).toBeLessThan(FUTURE_LANDMARKS[kind] ? 6000 : 4000);
          expect(budget.materials, kind).toBeLessThanOrEqual(8);
        }
      }
      expect(stages.size, kind).toBe(3);
    }
    dispose(d);
  });

  it('gives each era a different silhouette for the same building', () => {
    const d = diorama('skysail');
    for (const kind of ['home', 'cityHall', 'shop', 'waterPlant', 'skyline', 'greatTelescope']) {
      const looks = new Set(
        FUTURE_ERAS.map((era) => {
          const root = new Group();
          renderCityBuilding(d, root, kind, kind, 3, era);
          return snapshot(root);
        }),
      );
      expect(looks.size, kind).toBe(FUTURE_ERAS.length);
    }
    dispose(d);
  });

  it('keeps every new landmark inside its reserved parcel and clear of its frontage', () => {
    for (const era of FUTURE_ERAS) {
      const d = diorama(era);
      for (const kind of Object.keys(FUTURE_LANDMARKS)) {
        const parcel = GARDEN_PARCELS[kind],
          root = new Group();
        renderFutureBuilding(d, root, kind, kind, 3, era);
        const bounds = new Box3().setFromObject(root, true);
        expect(bounds.min.x, kind).toBeGreaterThanOrEqual(-parcel.halfWidth);
        expect(bounds.max.x, kind).toBeLessThanOrEqual(parcel.halfWidth);
        expect(bounds.min.z, kind).toBeGreaterThanOrEqual(-parcel.halfDepth);
        expect(bounds.max.z, `${kind} pedestrian frontage`).toBeLessThan(parcel.entranceZ - 0.35);
      }
      dispose(d);
    }
  });

  it.each(FUTURE_ERAS)(
    'preserves mature eastern landmarks from the first %s modernization',
    (era) => {
      const d = diorama(era);
      for (const [kind, landmark] of Object.entries(COZY_LANDMARKS)) {
        expect(futureForm(kind), kind).toBe(landmark.form);
        const previous = new Group();
        renderCityBuilding(d, previous, kind, kind, 3, 'riverlight', 3);
        const matureSize = new Box3().setFromObject(previous, true).getSize(new Vector3());
        for (const level of [1, 2, 3]) {
          const root = new Group();
          renderCityBuilding(d, root, kind, kind, level, era, 3);
          const bounds = new Box3().setFromObject(root, true);
          const size = bounds.getSize(new Vector3());
          // Allow differently shaped eaves, but never reset a campus to a tiny
          // generic house. Check tier 1 against the previous fully upgraded model.
          for (const axis of ['x', 'z'])
            expect(size[axis], `${era} ${kind} L${level} ${axis}`).toBeGreaterThan(
              matureSize[axis] * 0.9,
            );
          const parcel = GARDEN_PARCELS[kind];
          expect(bounds.min.x, kind).toBeGreaterThanOrEqual(-parcel.halfWidth);
          expect(bounds.max.x, kind).toBeLessThanOrEqual(parcel.halfWidth);
          expect(bounds.min.z, kind).toBeGreaterThanOrEqual(-parcel.halfDepth);
          expect(bounds.max.z, kind).toBeLessThan(parcel.entranceZ - 0.35);
        }
      }
      dispose(d);
    },
  );

  it('grounds every sail support and attaches rooftop crowns to the cloth', () => {
    const d = diorama('skysail');
    const s = { ...futureAppearance('skysail'), kind: 'doctor' };
    for (const [w, dep, y] of [
      [1.3, 1.9, 2.3],
      [3.6, 2.4, 2.3],
      [6.2, 5.6, 2.8],
    ]) {
      const root = new Group();
      const top = sailKit.roof(d, root, s, { x: 1.2, z: -0.7, w, dep, y });
      root.updateMatrixWorld(true);
      const supports = root.children.filter((mesh) => mesh.geometry === d.geometries.cylinder);
      expect(supports).toHaveLength(4);
      for (const support of supports)
        expect(new Box3().setFromObject(support).min.y).toBeCloseTo(0);
      const cloth = root.children.find((mesh) => mesh.geometry === d.geometries['future-hypar']);
      const centerHeight = cloth.position.y + cloth.scale.y / 2;
      expect(top).toBeCloseTo(centerHeight);
    }
    dispose(d);
  });

  it('reaches the Skyward quarter over the railway and the elevator by its own road', () => {
    const town = { ...createTown(), era: 'moonward' };
    for (const building of CITY_BUILDINGS) town.buildings[building.id] = 3;
    const tracks = townTracks(town);
    const crosses = (x) =>
      tracks.some(
        ({ from, to }) =>
          from[0] === x &&
          to[0] === x &&
          Math.min(from[1], to[1]) < -23 &&
          Math.max(from[1], to[1]) > -23,
      );
    expect(crosses(72), 'garden lane crossing').toBe(true);
    expect(crosses(-28.2), 'elevator road crossing').toBe(true);
    for (const id of ['skyHarbour', 'starlightTerraces', 'missionHomesteads', 'spaceElevator']) {
      const street = plotStreet(id);
      expect(
        tracks.some(({ to, plot }) => plot === id && to[0] === street[0] && to[1] === street[1]),
        id,
      ).toBe(true);
    }
  });

  it('crowns the mine portal differently in every era, in place of the petal canopy', () => {
    expect(Object.keys(FUTURE_MINE_CROWNS)).toEqual([...FUTURE_MINE_PORTALS]);
    const portals = ['riverlight', ...FUTURE_ERAS].map((era) => mineProfile(era).portal);
    expect(new Set(portals).size).toBe(FUTURE_ERAS.length + 1);
    const d = diorama('skysail');
    for (const era of FUTURE_ERAS) {
      const root = addMineSite(d, new Group(), era);
      const entry = root.getObjectByName(`Mine portal ${mineProfile(era).portal}`);
      expect(entry, era).toBeTruthy();
      expect(entry.getObjectByName('Mine riverlight petal roof'), era).toBeUndefined();
    }
    dispose(d);
  });

  it('builds the space elevator ribbon without shadows and lets its climbers ride it', () => {
    const d = diorama('moonward');
    for (const level of [1, 2, 3]) {
      const root = new Group();
      renderFutureBuilding(d, root, 'spaceElevator', 'Space elevator', level, 'moonward');
      const ribbon = root.getObjectByName('Space elevator ribbon');
      expect(ribbon.castShadow).toBe(false);
      const climbers = root.getObjectByName(ELEVATOR_CLIMBERS);
      expect(climbers.children).toHaveLength(level);
      climbers.traverse((part) => part.isMesh && expect(part.castShadow).toBe(false));
      for (const time of [0, 5, 17, 33, 46, 120]) {
        moveClimbers(climbers, time);
        for (const climber of climbers.children) {
          expect(climber.position.y).toBeGreaterThanOrEqual(6.5);
          expect(climber.position.y).toBeLessThanOrEqual(64.1);
        }
      }
    }
    dispose(d);
  });

  it('extends through capability definitions without renderer changes', () => {
    ERA_BY_ID['future-successor'] = defineEra({
      ...ERA_BY_ID.stargazer,
      id: 'future-successor',
      evolution: { ...eraEvolution('stargazer') },
    });
    const d = diorama('stargazer');
    for (const kind of ['home', 'greatTelescope', 'skyPods', ...Object.keys(COZY_LANDMARKS)]) {
      const before = new Group(),
        after = new Group();
      renderCityBuilding(d, before, kind, kind, 3, 'stargazer');
      renderCityBuilding(d, after, kind, kind, 3, 'future-successor');
      expect(snapshot(after).length, kind).toBe(snapshot(before).length);
    }
    dispose(d);
  });

  it('draws accessible illustrations from the same styles and stages', async () => {
    for (const era of FUTURE_ERAS)
      for (const id of [
        'home',
        'saloon',
        'museum',
        'skyPods',
        'bridge',
        ...Object.keys(FUTURE_LANDMARKS),
      ]) {
        const stages = new Set();
        for (const level of [1, 2, 3]) {
          const html = await renderToString(
            createSSRApp({
              render: () => h('svg', [h(TownBuilding, { id, era, eraLevel: level, stage: 3 })]),
            }),
          );
          expect(html, id).not.toContain('NaN');
          expect(html, id).toContain(`data-future-style="${futureAppearance(era).style}"`);
          expect(html, id).toContain(`data-form="${futureForm(BUILDING_BY_ID[id].kind) ?? id}"`);
          stages.add(html);
        }
        if (id !== 'bridge') expect(stages.size, `${era} ${id}`).toBe(3);
      }
  });
});

describe('New Hollow on the Moon', () => {
  const town = (buildings, eras = {}, levels = {}) => ({
    buildings,
    buildingEras: eras,
    buildingEraLevels: levels,
  });

  it('stays dark until the space elevator is built', () => {
    expect(moonSettlement(town({}))).toEqual({ homesteads: 0, lights: [] });
    expect(moonSettlement(null).homesteads).toBe(0);
  });

  it('grows with the elevator and the supply era modernizations, up to its limit', () => {
    expect(moonSettlement(town({ spaceElevator: 1 })).homesteads).toBe(2);
    const supplied = town(
      { spaceElevator: 3, home: 3, farm: 3 },
      { spaceElevator: 'moonward', home: 'moonward', farm: 'moonward', shop: 'stargazer' },
      { spaceElevator: 3, home: 3, farm: 3, shop: 3 },
    );
    // Six homesteads for the elevator, one for six supply levels (shop is not a supply era).
    expect(moonSettlement(supplied).homesteads).toBe(7);
    const many = town(
      { spaceElevator: 3 },
      Object.fromEntries(Array.from({ length: 60 }, (_, n) => [`b${n}`, 'moonward'])),
      Object.fromEntries(Array.from({ length: 60 }, (_, n) => [`b${n}`, 3])),
    );
    expect(moonSettlement(many).homesteads).toBe(MOON_SETTLEMENT_LIMIT);
  });

  it('places every homestead light on the Moon face, in a stable order', () => {
    const { lights } = moonSettlement(
      town(
        { spaceElevator: 3 },
        Object.fromEntries(Array.from({ length: 80 }, (_, n) => [`b${n}`, 'moonward'])),
        Object.fromEntries(Array.from({ length: 80 }, (_, n) => [`b${n}`, 3])),
      ),
    );
    expect(lights).toHaveLength(MOON_SETTLEMENT_LIMIT);
    for (const { x, y } of lights) expect(Math.hypot(x, y)).toBeLessThan(0.85);
    expect(moonSettlement(town({ spaceElevator: 1 })).lights).toEqual(lights.slice(0, 2));
  });
});

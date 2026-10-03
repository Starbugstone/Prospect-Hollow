import { afterEach, expect, it } from 'vitest';
import { Group, Scene, Raycaster, Vector3 } from 'three';
import { createTown, BUILDINGS } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { resolveRoadStyle } from '../src/data/roadStyles';
import { roadAppearance } from '../src/game/town/TownEvolution';
import {
  townTracks,
  routeGraph,
  segmentDistance,
  PLOTS,
  gardenTracks,
  gardenConnections,
  plotStreet,
  routeBetween,
} from '../src/game/town/TownLayout';
import {
  roadDetails,
  roadDetailCorners,
  roadHalfWidth,
  bridgeApproachSurfaces,
} from '../src/game/town/RoadDetails';
import { addTownRoads } from '../src/game/town/TownActivity';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownStatics } from '../src/game/town/TownStatics';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { townNavigation } from '../src/game/town/TownNavigation';
import { animalSpace } from '../src/game/town/TownAnimalSpace';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { plotInEra } from '../src/game/town/TownEras';
import { renderEraLandmark } from '../src/game/town/buildings/BuildingRenderer';
import { applyRoadSetbacks } from '../src/game/town/BuildingSetbacks';
import { buildLandscape } from '../src/game/town/TownLandscape';

it.each(['canopy', 'riverlight'].flatMap((era) => [1, 3].map((tier) => [era, tier])))(
  'joins every %s garden forecourt to its rendered driveway at tier %i',
  (era, tier) => {
    const town = townFor(era),
      d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      world: new Group(),
      scene: new Scene(),
      geometries: createTownGeometries(),
      materials: new Map(),
    });
    const parcels = Object.entries(GARDEN_PARCELS).filter(([id]) => plotInEra(town, id));
    d.landscape = buildLandscape(d);
    for (const [id, [x, z]] of Object.entries(PLOTS).filter(
      ([id, [x]]) => x >= 58 && plotInEra(town, id),
    )) {
      const root = d.group(d.world, x, 0.08, z);
      const building = BUILDINGS.find((b) => b.id === id);
      renderEraLandmark(d, root, building.kind, building.name, tier, era, tier);
      applyRoadSetbacks(root, id, town);
      d.batch(root);
    }
    const roads = addTownRoads(d, town, PLOTS),
      statics = new TownStatics(d.scene);
    statics.rebuild([roads]);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    // Check the rendered paving all the way from inside the old road to
    // the new spine, so a connected graph cannot mask a visible grass gap.
    for (const {
      from: [x, z],
      to: [endX],
    } of gardenConnections(town))
      for (const side of [-0.35, 0, 0.35])
        for (let px = x - 0.25; px < endX; px += 0.1) {
          ray.ray.origin.set(px, 1, z + side);
          expect(
            ray.intersectObjects(statics.meshes).length,
            `street row ${z} at ${px}`,
          ).toBeGreaterThan(0);
        }
    for (const [id, parcel] of parcels) {
      const [x, z] = parcel.position;
      const points = [...parcel.approach, [0, parcel.entranceZ], [0, parcel.streetOffset]];
      // Trace the actual visible surface, including both sides of the joining
      // seam. A connected route graph alone misses gaps before the driveway.
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1],
          b = points[i];
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
        for (const side of [-0.35, 0, 0.35])
          for (let step = 0; step <= Math.ceil(length / 0.1); step++) {
            // Merged Float32 surfaces can round a shared endpoint by a few
            // micrometres. Sample just inside each side of that seam.
            const t = Math.max(0.0001, Math.min(0.9999, step / Math.ceil(length / 0.1)));
            ray.ray.origin.set(
              x + a[0] + (b[0] - a[0]) * t - ((b[1] - a[1]) / length) * side,
              1,
              z + a[1] + (b[1] - a[1]) * t + ((b[0] - a[0]) / length) * side,
            );
            expect(
              ray.intersectObjects(statics.meshes).length,
              `${id} segment ${i}, step ${step}`,
            ).toBeGreaterThan(0);
          }
      }
      const start = [x + points[0][0], z + points[0][1]];
      expect(routeBetween(town, start, plotStreet(id)).length, id).toBeGreaterThan(1);
      expect(routeBetween(town, start, plotStreet(id), 'car'), `${id} private path`).toEqual([]);
    }
    const space = animalSpace(d);
    for (const { from, to } of gardenTracks(town))
      expect(
        space.segment([from[0], 0.15, from[1]], [to[0], 0.15, to[1]], 0.55, 1.8),
        `${from} → ${to} stays clear of real buildings and landscaping`,
      ).toBe(true);
    statics.dispose();
    d.clearGroup(d.world);
    d.clearGroup(d.landscape);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  },
  20000,
);

function townFor(era) {
  const town = createTown();
  town.era = era;
  for (const b of BUILDINGS) town.buildings[b.id] = b.upgrades.length;
  return town;
}
afterEach(() => {
  delete ERA_BY_ID['road-successor'];
  delete ERA_BY_ID['incomplete-road-era'];
});

it('gives every era a distinct treatment and lets a future era inherit or override them', () => {
  expect(new Set(ERAS.map(({ id }) => roadAppearance(townFor(id)).id)).size).toBe(ERAS.length);
  ERA_BY_ID['road-successor'] = defineEra({
    ...ERA_BY_ID.contemporary,
    id: 'road-successor',
    evolution: { ...eraEvolution('contemporary'), roadColor: '#123456' },
  });
  const successor = townFor('road-successor');
  expect(roadAppearance(successor)).toMatchObject({ id: 'civic', color: '#123456' });
  const base = townFor('contemporary');
  expect(roadDetails(successor, townTracks(base))).toEqual(roadDetails(base));
  expect(bridgeApproachSurfaces(successor)[0]).toMatchObject({
    color: '#123456',
    points: bridgeApproachSurfaces(base)[0].points,
  });
  ERA_BY_ID['incomplete-road-era'] = { evolution: { roadStyle: 'not-a-surface' } };
  expect(roadAppearance(townFor('incomplete-road-era'))).toMatchObject({
    id: 'dirt',
    color: '#c3a477',
    paved: false,
  });
  expect(bridgeApproachSurfaces(townFor('incomplete-road-era'))[0].color).toBe('#c3a477');
  for (const id of ['missing', 'constructor', '__proto__', undefined])
    expect(resolveRoadStyle(id)).toBe(resolveRoadStyle('dirt'));
});

it('adds the bridge landing only when the crossing is open', () => {
  expect(bridgeApproachSurfaces(townFor('frontier'))).toEqual([]);
  const town = townFor('contemporary');
  town.buildings.bridge = 0;
  expect(bridgeApproachSurfaces(town)).toEqual([]);
});

it.each(ERAS.map(({ id }) => id))(
  'keeps %s roads traversable and in one static draw batch',
  (era) => {
    const town = townFor(era),
      d = Object.create(TownDiorama.prototype);
    Object.assign(d, {
      world: new Group(),
      scene: new Scene(),
      geometries: createTownGeometries(),
      materials: new Map(),
    });
    const tracks = townTracks(town),
      graph = JSON.stringify(routeGraph(town));
    const roads = addTownRoads(d, town, {}),
      space = animalSpace(d),
      nav = townNavigation(roads);
    // Surface decoration must not add solid props or change any prepared route.
    expect(roads.userData.walkObstacles).toHaveLength(4);
    expect(JSON.stringify(routeGraph(town))).toBe(graph);
    for (const { from, to, crossing } of tracks) {
      if (crossing) continue;
      const a = [from[0], 0.08, from[1]],
        b = [to[0], 0.08, to[1]];
      expect(space.segment(a, b, 0.35, 1.8), `${from} → ${to}`).toBe(true);
      expect(nav.clear(a, 0.3)).toBe(true);
      expect(nav.clear(b, 0.3)).toBe(true);
    }
    const style = roadAppearance(town);
    const parts = roadDetails(town, tracks);
    expect(parts.length).toBeGreaterThan(100);
    for (const part of parts)
      for (const p of roadDetailCorners(part)) {
        expect(p.every(Number.isFinite)).toBe(true);
        expect(
          tracks.some(
            (track) =>
              !track.crossing &&
              segmentDistance(...p, track.from, track.to) <=
                roadHalfWidth(track, style.paved) + 1e-5,
          ),
        ).toBe(true);
      }
    const ray = new Raycaster(new Vector3(31, 1, 7.5), new Vector3(0, -1, 0));
    roads.updateMatrixWorld(true);
    expect(ray.intersectObject(roads, true)).toEqual([]);
    const statics = new TownStatics(d.scene);
    statics.rebuild([roads]);
    expect(statics.meshes).toHaveLength(1);
    expect(statics.meshes[0].geometry.index.count / 3).toBeLessThan(20000);
    expect(statics.meshes[0].material.map).toBeNull();
    statics.dispose();
    d.clearGroup(d.world);
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  },
);

it('breaks lane paint at junctions and keeps crossings on the approaches', () => {
  const tracks = [
    { from: [-10, 0], to: [10, 0], width: 1.05 },
    { from: [0, -10], to: [0, 10], width: 1.05 },
  ];
  const parts = roadDetails(townFor('aviation'), tracks);
  expect(parts.some(({ kind }) => kind === 'crossing')).toBe(true);
  for (const part of parts.filter(({ kind }) => ['center-line', 'edge', 'crossing'].includes(kind)))
    for (const [x, z] of roadDetailCorners(part))
      expect(Math.max(Math.abs(x), Math.abs(z))).toBeGreaterThan(0.735);
  expect(roadDetails(townFor('aviation'), [{ ...tracks[0], crossing: 'bridge' }])).toEqual([]);
});

it.each(['aviation', 'broadcast', 'contemporary'])(
  'paints %s zebra stripes along traffic, spaced across both road directions',
  (era) => {
    const tracks = [
      { from: [-10, 0], to: [10, 0], width: 1.05 },
      { from: [0, -10], to: [0, 10], width: 1.05 },
    ];
    const stripes = roadDetails(townFor(era), tracks).filter(({ kind }) => kind === 'crossing');
    expect(stripes).toHaveLength(16);
    for (const axis of [0, 1])
      for (const side of [-1, 1]) {
        const across = 1 - axis;
        const crossing = stripes.filter(({ from, to }) => (side * (from[axis] + to[axis])) / 2 > 1);
        expect(crossing).toHaveLength(4);
        const alongCenters = [],
          acrossCenters = [];
        for (const { from, to, width } of crossing) {
          expect(to[across]).toBeCloseTo(from[across]);
          expect(Math.abs(to[axis] - from[axis])).toBeGreaterThan(width * 3);
          alongCenters.push((from[axis] + to[axis]) / 2);
          acrossCenters.push((from[across] + to[across]) / 2);
        }
        expect(Math.max(...alongCenters) - Math.min(...alongCenters)).toBeCloseTo(0);
        acrossCenters.sort((a, b) => a - b);
        expect(acrossCenters[0]).toBeLessThan(-0.4);
        expect(acrossCenters[3]).toBeGreaterThan(0.4);
        for (let n = 1; n < acrossCenters.length; n++)
          expect(acrossCenters[n] - acrossCenters[n - 1]).toBeGreaterThan(crossing[n].width);
      }
  },
);

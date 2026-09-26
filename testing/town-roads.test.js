import { afterEach, expect, it } from 'vitest';
import { Group, Scene, Raycaster, Vector3 } from 'three';
import { createTown, BUILDINGS } from '../src/data/town';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { resolveRoadStyle } from '../src/data/roadStyles';
import { roadAppearance } from '../src/game/town/TownEvolution';
import { townTracks, routeGraph, segmentDistance } from '../src/game/town/TownLayout';
import { roadDetails, roadDetailCorners, roadHalfWidth } from '../src/game/town/RoadDetails';
import { addTownRoads } from '../src/game/town/TownActivity';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { TownStatics } from '../src/game/town/TownStatics';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { townNavigation } from '../src/game/town/TownNavigation';
import { animalSpace } from '../src/game/town/TownAnimalSpace';
import { createSSRApp, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import TownMap from '../src/components/town/TownMap.vue';

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

it('gives all eight eras distinct treatments and lets a future era inherit or override them', () => {
  expect(new Set(ERAS.map(({ id }) => roadAppearance(townFor(id)).id)).size).toBe(8);
  ERA_BY_ID['road-successor'] = defineEra({
    ...ERA_BY_ID.contemporary,
    id: 'road-successor',
    evolution: { ...eraEvolution('contemporary'), roadColor: '#123456' },
  });
  const successor = townFor('road-successor');
  expect(roadAppearance(successor)).toMatchObject({ id: 'civic', color: '#123456' });
  const base = townFor('contemporary');
  expect(roadDetails(successor, townTracks(base))).toEqual(roadDetails(base));
  ERA_BY_ID['incomplete-road-era'] = { evolution: { roadStyle: 'not-a-surface' } };
  expect(roadAppearance(townFor('incomplete-road-era'))).toMatchObject({
    id: 'dirt',
    color: '#c3a477',
    paved: false,
  });
  for (const id of ['missing', 'constructor', '__proto__', undefined])
    expect(resolveRoadStyle(id)).toBe(resolveRoadStyle('dirt'));
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

it('draws the same era treatments in the SVG fallback with bounded element counts', async () => {
  for (const { id } of ERAS) {
    const town = townFor(id);
    const html = await renderToString(
      createSSRApp({ render: () => h(TownMap, { town, paused: true }) }),
    );
    const colors = new Set(roadDetails(town).map(({ color }) => color));
    for (const color of colors) expect(html).toContain(`fill="${color}"`);
    expect(colors.size).toBeLessThanOrEqual(6);
  }
});

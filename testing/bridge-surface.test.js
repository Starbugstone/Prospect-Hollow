import { afterEach, expect, it } from 'vitest';
import { Box3, Group, MeshBasicMaterial, Raycaster, Scene, Vector3 } from 'three';
import { createTown } from '../src/data/town';
import { addTownRoads } from '../src/game/town/TownActivity';
import { PLOTS, townTracks, routeGraph, routeOnGraph } from '../src/game/town/TownLayout';
import { BRIDGE, riverCenterX, bridgeDeckHeight } from '../src/game/town/TownRiver';
import { streetHeight } from '../src/game/town/TownItineraries';
import { placeTraffic } from '../src/game/town/TownTrafficRoutes';
import { roadHalfWidth } from '../src/game/town/RoadDetails';
import { ERAS, ERA_BY_ID, eraEvolution } from '../src/data/eras';
import { defineEra } from '../src/data/eraDefinitions';
import { geometryFootprints, registerFootprints } from '../src/game/town/BuildingFootprints';
import { townNavigation } from '../src/game/town/TownNavigation';
import { renderBridge } from '../src/game/town/buildings/infrastructure';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { createTownGeometries } from '../src/game/town/TownGeometries';
import { TownStatics } from '../src/game/town/TownStatics';

const views = [];
afterEach(() => {
  delete ERA_BY_ID['future-road-bridge'];
  for (const d of views.splice(0)) {
    Object.values(d.geometries).forEach((g) => g.dispose());
    d.materials.forEach((m) => m.dispose());
  }
});
function bridgeView(era, tier = 3) {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, {
    geometries: createTownGeometries(),
    materials: new Map(),
    town: createTown(),
  });
  views.push(d);
  d.town.era = era;
  d.town.buildings.bridge = 3;
  d.town.buildingEras.bridge = era;
  d.town.buildingEraLevels.bridge = tier;
  const bridge = new Group();
  bridge.position.set(PLOTS.bridge[0], 0.08, PLOTS.bridge[1]);
  d.buildPlot('bridge', bridge, d.town, {});
  bridge.updateMatrixWorld(true);
  return { d, bridge };
}

it.each(['post-war', 'aviation', 'broadcast', 'contemporary'])(
  'grounds %s approach furniture and keeps it outside the driving lane',
  (era) => {
    const { bridge } = bridgeView(era, 1);
    const approaches = bridge.getObjectByName(`${era} bridge approaches 1`);
    const solids = geometryFootprints(approaches);
    expect(solids.length).toBeGreaterThan(4);
    // No low decorative box can straddle the ramp, even beyond the narrow
    // navigation strip. Lamps and canopy supports reach their plot's floor.
    for (const part of solids) {
      if (part.yMin < 0.7) {
        expect(Math.abs(part.cz) - part.halfD).toBeGreaterThan(1.15);
        expect(part.yMin).toBeLessThan(0.01);
      }
    }
  },
);

it.each(ERAS.map(({ id }) => id))(
  'keeps the %s bridge navigable with the appropriate surface',
  (era) => {
    const { d, bridge } = bridgeView(era);
    const road = bridge.getObjectByName('Bridge road deck');
    expect(!!road).toBe(['motor-age', 'aviation', 'broadcast', 'contemporary'].includes(era));
    registerFootprints(bridge, geometryFootprints(bridge), { owner: 'plot:bridge' });
    const nav = townNavigation(bridge);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    for (let x = -6.8; x <= 6.8; x += 0.1) {
      const wx = BRIDGE.centerX + x,
        y = bridgeDeckHeight(wx) + 0.08;
      for (const z of [-0.6, 0, 0.6]) {
        expect(nav.clear([wx, y, 7.5 + z], 0.29), `${era} ${x},${z}`).toBe(true);
        if (road) {
          ray.ray.origin.set(wx, 8, 7.5 + z);
          const hit = ray.intersectObject(road, false)[0];
          expect(hit).toBeDefined();
          expect(Math.abs(hit.point.y - y - 0.01)).toBeLessThan(0.012);
        }
      }
    }
    if (road) expect(road.geometry.index.count / 3).toBeLessThan(500);
    const statics = new TownStatics(new Scene());
    statics.rebuild([bridge]);
    expect(statics.meshes).toHaveLength(1);
    statics.dispose();
  },
);

it('lets future eras inherit a road bridge and unknown eras retain the timber fallback', () => {
  ERA_BY_ID['future-road-bridge'] = defineEra({
    ...ERA_BY_ID.contemporary,
    id: 'future-road-bridge',
    evolution: { ...eraEvolution('contemporary') },
  });
  expect(bridgeView('future-road-bridge').bridge.getObjectByName('Bridge road deck')).toBeDefined();
  expect(
    bridgeView('unknown-bridge-era').bridge.getObjectByName('Bridge road deck'),
  ).toBeUndefined();
});

it.each(ERAS.map(({ id }) => id))(
  'connects the %s bridge before the east-bank road and leaves through traffic at street level',
  (era) => {
    const { d, bridge } = bridgeView(era);
    // Frontier does not yet open the far bank, but uses the same bridge model.
    const town = { ...d.town, era: era === 'frontier' ? 'river-rail' : era };
    const tracks = townTracks(town);
    const bankRoad = tracks.find(
      ({ from, to }) =>
        from[0] === BRIDGE.eastJunction &&
        to[0] === BRIDGE.eastJunction &&
        from[1] < BRIDGE.z &&
        to[1] > BRIDGE.z,
    );
    const edge = BRIDGE.eastJunction - roadHalfWidth(bankRoad, true);
    const tip = BRIDGE.centerX + BRIDGE.halfLength;
    expect(tip).toBeLessThan(edge - 0.3);
    registerFootprints(bridge, geometryFootprints(bridge), { owner: 'plot:bridge' });
    const nav = townNavigation(bridge);
    // Both sidewalk directions must remain passable, including the bank-side
    // walkway where a railing or canopy could cut off the whole neighbourhood.
    for (const x of [BRIDGE.eastJunction - 1.05, BRIDGE.eastJunction + 1.05]) {
      expect(nav.segment([x, 0.07, 4], [x, 0.07, 11], 0.29), `${era} sidewalk ${x}`).toBe(true);
      for (let z = 4; z <= 11; z += 0.1) expect(streetHeight(x, z)).toBe(0.07);
    }
    const car = new Group();
    car.userData.vehicleBox = { halfLength: 1.2, halfWidth: 0.36 };
    for (const heading of [0, Math.PI])
      for (let z = 5; z <= 10; z += 0.1) {
        placeTraffic(car, { x: BRIDGE.eastJunction, z, heading });
        expect(car.position.y).toBe(0.07);
        expect(car.rotation.x).toBeCloseTo(0, 10);
      }
    for (const mode of ['pedestrian', 'horse', 'car']) {
      const route = routeOnGraph(routeGraph(town, mode), [19, BRIDGE.z], [38, 15.5]);
      expect(route.length).toBeGreaterThan(2);
      expect(route.some(([x]) => x === tip)).toBe(true);
    }
    // The short, flat connecting road is rendered, not merely a graph edge.
    d.world = new Group();
    addTownRoads(d, town, PLOTS);
    d.world.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
    for (let x = tip + 0.01; x <= BRIDGE.eastJunction; x += 0.1) {
      // Support the whole deck width; a thin service-path strip leaves the
      // ramp's corners ending abruptly in bare ground.
      for (const dz of [-BRIDGE.halfWidth + 0.02, 0, BRIDGE.halfWidth - 0.02]) {
        ray.ray.origin.set(x, 0.5, BRIDGE.z + dz);
        const hit = ray.intersectObject(d.world, true)[0];
        expect(hit, `${era} approach at ${x},${dz}`).toBeDefined();
        expect(hit.point.y).toBeLessThan(0.07);
      }
      expect(streetHeight(x, BRIDGE.z)).toBeCloseTo(0.07, 10);
    }
    d.world.traverse((object) => {
      if (object.geometry?.userData.owned) object.geometry.dispose();
    });
  },
);

it.each([1, 2, 3])('keeps level %s bridge pillars and caps below the ramp surface', (level) => {
  const d = Object.create(TownDiorama.prototype);
  Object.assign(d, { geometries: createTownGeometries(), materials: new Map() });
  const bridge = new Group();
  bridge.position.set(PLOTS.bridge[0], 0.08, PLOTS.bridge[1]);
  renderBridge(d, bridge, level);
  bridge.updateMatrixWorld(true);
  const deck = [],
    supports = [];
  bridge.traverse((part) => {
    const color = part.material?.color?.getHexString();
    if (color === 'a48e69') deck.push(part);
    if (['b7ae98', 'd9ccad', '8c9183'].includes(color)) supports.push(part);
  });
  expect(supports).toHaveLength(level >= 2 ? 8 : 4);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0));
  for (const support of supports) {
    const bounds = new Box3().setFromObject(support);
    for (const x of [
      bounds.min.x + 0.001,
      (bounds.min.x + bounds.max.x) / 2,
      bounds.max.x - 0.001,
    ]) {
      ray.ray.origin.set(x, 10, 7.5);
      const hit = ray.intersectObjects(deck, false)[0];
      expect(hit).toBeDefined();
      expect(bounds.max.y).toBeLessThan(hit.point.y - 0.02);
    }
  }
  Object.values(d.geometries).forEach((g) => g.dispose());
  d.materials.forEach((m) => m.dispose());
});

it('leaves the channel under the bridge free of ground-level roads and porch boards', () => {
  const town = createTown();
  town.era = 'river-rail';
  town.buildings.bridge = 2;
  town.buildings.square = 3;
  const material = new MeshBasicMaterial();
  const boards = [];
  const d = {
    world: new Group(),
    group(parent) {
      const group = new Group();
      parent.add(group);
      return group;
    },
    material: () => material,
    box: (parent, width, height, depth, x, y, z) => boards.push({ x, z }),
    rod() {},
    batch() {},
  };
  addTownRoads(d, town, PLOTS);
  d.world.updateMatrixWorld(true);
  const x = riverCenterX(7.5);
  const ray = new Raycaster(new Vector3(x, 1, 7.5), new Vector3(0, -1, 0));
  expect(ray.intersectObject(d.world, true)).toEqual([]);
  expect(boards.some((board) => Math.abs(board.x - x) < 3 && Math.abs(board.z - 7.5) < 3)).toBe(
    false,
  );
  d.world.traverse((object) => object.geometry?.dispose());
  material.dispose();
});

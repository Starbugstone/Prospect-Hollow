import { afterEach, expect, it } from 'vitest';
import { Group, Vector3 } from 'three';
import { ERAS } from '../src/data/eras';
import { FOOTPRINT_ANCHORS } from '../src/data/footprintOverrides';
import { GARDEN_PARCELS } from '../src/data/townGardenDistrict';
import { NPC_BODY_MARGIN, SIDEWALK_OFFSET } from '../src/data/townClearances';
import { BUILDINGS, createTown } from '../src/data/town';
import {
  geometryFootprints,
  registerFootprints,
  sweptClear,
} from '../src/game/town/BuildingFootprints';
import { TownDiorama } from '../src/game/town/TownDiorama';
import { eraIndex, finishEra } from '../src/game/town/TownEras';
import { PLOTS, townTracks } from '../src/game/town/TownLayout';
import { buildPlot } from '../src/game/town/TownPlots';
import { TownPrimitives } from '../src/game/town/TownPrimitives';

const views = [];
const labels = Object.fromEntries(BUILDINGS.map((building) => [building.id, building.name]));
const eras = ERAS.filter((era) => era.enabled);

function drawing(era) {
  // Keep the production sign method: the older clipping fixture deliberately
  // stubs it, which cannot detect a physical nameboard post across a path.
  const d = Object.assign(Object.create(TownDiorama.prototype), new TownPrimitives());
  d.town = createTown();
  d.town.era = era;
  for (const building of BUILDINGS) {
    if (eraIndex(building.introducedEra) > eraIndex(era)) continue;
    d.town.buildings[building.id] = building.upgrades.length;
    d.town.buildingEras[building.id] = finishEra(building.id, era);
    d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
  }
  views.push(d);
  return d;
}

afterEach(() => {
  for (const d of views.splice(0)) d.disposePrimitives();
});

function worldPoint(root, [x, z]) {
  return root.localToWorld(new Vector3(x, 0.07, z)).toArray();
}

function doorApproaches(root, building) {
  const parcel = GARDEN_PARCELS[building.id];
  if (parcel) {
    const points = [...parcel.approach, [0, parcel.entranceZ]];
    return points
      .slice(1)
      .map((point, index) => [worldPoint(root, points[index]), worldPoint(root, point)]);
  }
  const anchors = FOOTPRINT_ANCHORS[building.id] ?? FOOTPRINT_ANCHORS[building.kind];
  const doors = anchors?.door ?? [
    [0, 2.05],
    [0, 2.6],
  ];
  // Anchor alternatives are destinations, not permission to invent a diagonal
  // shortcut. Protect each authored destination and each straight entry segment.
  return [
    ...doors.map((door) => [worldPoint(root, door), worldPoint(root, door)]),
    ...doors
      .slice(1)
      .flatMap((door, index) =>
        door[0] === doors[index][0]
          ? [[worldPoint(root, doors[index]), worldPoint(root, door)]]
          : [],
      ),
  ];
}

it.each(eras.map(({ id }) => id))(
  'keeps actual %s directory nameboards and posts clear of roads, sidewalks and authored entrances',
  (era) => {
    const d = drawing(era);
    const roads = townTracks(d.town).filter(({ modes }) => modes.includes('pedestrian'));
    const failures = [];
    let boards = 0;
    let directoryParts = 0;
    const reachable = BUILDINGS.filter(
      (building) => PLOTS[building.id] && eraIndex(building.introducedEra) <= eraIndex(era),
    );
    for (const building of reachable) {
      // A full final-tier town covers every actual parcel in every era. Native
      // first/second tiers catch open lots whose final facade later hosts a sign.
      const stages =
        building.introducedEra === era
          ? [1, 2, building.upgrades.length]
          : [building.upgrades.length];
      for (const stage of new Set(stages)) {
        d.town.buildings[building.id] = stage;
        d.town.buildingEraLevels[building.id] =
          era === 'frontier' ? 0 : building.introducedEra === era ? stage : 3;
        const root = new Group();
        root.position.set(PLOTS[building.id][0], 0.08, PLOTS[building.id][1]);
        root.userData.plot = building.id;
        // buildPlot includes the production applyRoadSetbacks transform. All
        // comparisons below use resulting world coordinates, not raw mesh values.
        buildPlot(d, building.id, root, d.town, labels);
        root.updateMatrixWorld(true);
        const directory = [];
        root.traverse((object) => {
          if (object.name === 'Mounted building nameboard') boards++;
          if (object.isMesh && object.userData.signMount === 'directory') directory.push(object);
        });
        const approaches = doorApproaches(root, building);
        for (const part of directory) {
          directoryParts++;
          const physical = registerFootprints(part, geometryFootprints(part));
          expect(
            physical.length,
            `${era}/${building.id}/${stage}: physical ${part.name}`,
          ).toBeGreaterThan(0);
          for (const solid of physical.filter(
            (entry) => entry.y < 1.78 && entry.y + entry.height > 0.3,
          )) {
            const context = `${era}/${building.id}/stage${stage} ${part.name}`;
            for (const road of roads) {
              const reach =
                road.width < 0.85
                  ? road.width / 2 + NPC_BODY_MARGIN
                  : SIDEWALK_OFFSET + NPC_BODY_MARGIN + 0.04;
              if (
                !sweptClear(
                  solid,
                  [road.from[0], 0.07, road.from[1]],
                  [road.to[0], 0.07, road.to[1]],
                  reach,
                )
              )
                failures.push(
                  `${context}: ${road.width < 0.85 ? 'footpath' : 'road/sidewalk'} ${road.from} -> ${road.to}`,
                );
            }
            for (const [from, to] of approaches)
              if (!sweptClear(solid, from, to, NPC_BODY_MARGIN))
                failures.push(`${context}: authored door approach ${from} -> ${to}`);
          }
        }
        // Only one plot is retained at a time, even for the largest future town.
        d.clearGroup(root);
      }
      d.town.buildings[building.id] = building.upgrades.length;
      d.town.buildingEraLevels[building.id] = era === 'frontier' ? 0 : 3;
    }
    expect(boards).toBeGreaterThan(0);
    if (era === 'motor-age') expect(directoryParts).toBeGreaterThan(0);
    expect(
      failures.slice(0, 40).join('\n'),
      `${failures.length} physical sign clearance failures`,
    ).toBe('');
  },
  60000,
);

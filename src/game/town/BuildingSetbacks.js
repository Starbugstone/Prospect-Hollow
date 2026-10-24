import { Group } from 'three';
import { SIDEWALK_OFFSET, NPC_BODY_MARGIN } from '../../data/townClearances';
import { townTracks, PLOTS, RAIL_EDGE } from './TownLayout';
import { ERAS } from '../../data/eras';
import { GARDEN_PARCELS } from '../../data/townGardenDistrict';
import { BUILDINGS } from '../../data/town';
const potentialRoads = new Map();
function facadeRoads(era) {
  if (!potentialRoads.has(era))
    potentialRoads.set(
      era,
      townTracks({
        era,
        buildings: Object.fromEntries(BUILDINGS.map(({ id }) => [id, 3])),
        projects: {},
      }),
    );
  return potentialRoads.get(era);
}
import { FOOTPRINT_EXCEPTIONS } from '../../data/footprintOverrides';
import { geometryFootprints } from './BuildingFootprints';

export function plotSetbacks(id, town) {
  if (FOOTPRINT_EXCEPTIONS[id] || id === 'mine' || id === 'airport') return null;
  const [x, z] = PLOTS[id],
    parcel = GARDEN_PARCELS[id],
    bounds = parcel
      ? {
          minX: -parcel.halfWidth,
          maxX: parcel.halfWidth,
          minZ: -parcel.halfDepth,
          maxZ: parcel.halfDepth,
        }
      : { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
  for (const road of [...facadeRoads(ERAS.filter((era) => era.enabled).at(-1).id), RAIL_EDGE]) {
    if (road.width < 0.85) continue; // entrance paths intentionally terminate at doors
    // Reserve the railway even before it opens. Train overhang and ballast
    // extend beyond the rails, just as pedestrians extend beyond road centers.
    const clearance =
      (road === RAIL_EDGE ? road.width / 2 : SIDEWALK_OFFSET) + NPC_BODY_MARGIN + 0.05;
    const [ax, az] = road.from,
      [bx, bz] = road.to;
    if (
      ax === bx &&
      z >= Math.min(az, bz) - 1 &&
      z <= Math.max(az, bz) + 1 &&
      Math.abs(x - ax) < 5
    ) {
      if (ax < x) bounds.minX = Math.max(bounds.minX, ax + clearance - x);
      else if (ax > x) bounds.maxX = Math.min(bounds.maxX, ax - clearance - x);
    }
    if (
      az === bz &&
      x >= Math.min(ax, bx) - 1 &&
      x <= Math.max(ax, bx) + 1 &&
      Math.abs(z - az) < 5
    ) {
      if (az < z) bounds.minZ = Math.max(bounds.minZ, az + clearance - z);
      else if (az > z) bounds.maxZ = Math.min(bounds.maxZ, az - clearance - z);
    }
  }
  return bounds;
}
/** Numeric plot-local bounds; probes never retain temporary scene resources. */
export function roadSetbackEnvelope(root, id) {
  // Station canopies must clear the train too, above pedestrian head height.
  const solids = geometryFootprints(root).filter(
    (s) => id === 'railDepot' || GARDEN_PARCELS[id] || (s.yMin < 1.7 && s.yMax > 0.08),
  );
  if (!solids.length) return null;
  return [
    Math.min(...solids.map((s) => s.cx - s.halfW)),
    Math.max(...solids.map((s) => s.cx + s.halfW)),
    Math.min(...solids.map((s) => s.cz - s.halfD)),
    Math.max(...solids.map((s) => s.cz + s.halfD)),
  ];
}

export function applyRoadSetbacks(root, id, town, matureEnvelope = null) {
  const limits = plotSetbacks(id, town);
  if (!limits) return;
  const actual = roadSetbackEnvelope(root, id);
  if (!actual && !matureEnvelope) return;
  // Reserve all completed finishes, while still clearing temporary scaffolding
  // or construction pieces that extend beyond the finished building envelope.
  const envelope = Array.from({ length: 4 }, (_, index) =>
    index % 2
      ? Math.max(actual?.[index] ?? -Infinity, matureEnvelope?.[index] ?? -Infinity)
      : Math.min(actual?.[index] ?? Infinity, matureEnvelope?.[index] ?? Infinity),
  );
  const transform = roadSetbackTransform(id, town, envelope);
  let contents;
  for (const axis of ['x', 'z']) {
    const { scale, shift } = transform[axis];
    if (scale === 1 && !shift) continue;
    if (!contents) {
      // Apply the transform in plot space, above rotated meshes and animated parts.
      contents = new Group();
      contents.name = 'Road setback';
      contents.add(...root.children.slice());
      root.add(contents);
    }
    contents.position[axis] = shift;
    contents.scale[axis] = scale;
  }
}

// Sign visibility uses the same reserved scale before the plot is transformed.
export function roadSetbackTransform(id, town, envelope) {
  const limits = plotSetbacks(id, town);
  if (!limits || !envelope) return null;
  const transform = {};
  for (const [axis, offset] of [
    ['x', 0],
    ['z', 2],
  ]) {
    const suffix = axis.toUpperCase(),
      min = envelope[offset],
      max = envelope[offset + 1];
    const low = limits[`min${suffix}`],
      high = limits[`max${suffix}`];
    const scale = Math.min(1, (high - low) / (max - min || 1));
    const shift = Math.min(0, high - max * scale) + Math.max(0, low - min * scale);
    transform[axis] = { scale, shift };
  }
  return transform;
}

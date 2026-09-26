import { Group } from 'three';
import { SIDEWALK_OFFSET, NPC_BODY_MARGIN } from '../../data/townClearances';
import { townTracks, PLOTS } from './TownLayout';
import { ERAS } from '../../data/eras';
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
    bounds = { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity };
  const clearance = SIDEWALK_OFFSET + NPC_BODY_MARGIN + 0.05;
  for (const road of facadeRoads(ERAS.filter((era) => era.enabled).at(-1).id)) {
    if (road.width < 0.85) continue; // entrance paths intentionally terminate at doors
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
export function applyRoadSetbacks(root, id, town) {
  const limits = plotSetbacks(id, town);
  if (!limits) return;
  const solids = geometryFootprints(root).filter((s) => s.yMin < 1.7 && s.yMax > 0.08);
  if (!solids.length) return;
  let contents;
  for (const [axis, center, half] of [
    ['x', 'cx', 'halfW'],
    ['z', 'cz', 'halfD'],
  ]) {
    const suffix = axis.toUpperCase(),
      min = Math.min(...solids.map((s) => s[center] - s[half])),
      max = Math.max(...solids.map((s) => s[center] + s[half]));
    const low = limits[`min${suffix}`],
      high = limits[`max${suffix}`];
    const scale = Math.min(1, (high - low) / (max - min || 1));
    const shift = Math.min(0, high - max * scale) + Math.max(0, low - min * scale);
    if (scale === 1 && !shift) continue;
    if (!contents) {
      // Apply the transform in plot space, above rotated meshes and animated parts.
      // Scaling each child's local axes can expand its rotated facade into the road.
      contents = new Group();
      contents.name = 'Road setback';
      contents.add(...root.children.slice());
      root.add(contents);
    }
    contents.position[axis] = shift;
    contents.scale[axis] = scale;
  }
}

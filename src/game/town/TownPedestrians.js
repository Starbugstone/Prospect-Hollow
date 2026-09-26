import { PLOTS, segmentDistance, townTracks } from './TownLayout';
import { walkPath } from './TownNavigation';

// The ordinary car/bus lane includes its lateral offset. Reserve it during
// preparation, so a work break never relies on crowd yielding to dodge traffic.
const CARRIAGEWAY = 0.65;
export function pedestrianRoads(town) {
  return townTracks(town).filter((road) => road.width >= 0.85);
}
export function outsideCarriageway(point, roads, radius = 0.29) {
  return roads.every(
    ({ from, to }) => segmentDistance(point[0], point[2], from, to) >= CARRIAGEWAY + radius + 0.05,
  );
}

// Short activity walks belong to a building, not a road-center waypoint. Search
// its frontage/grounds once and keep a straight, verified leg parallel to the
// nearest road. Never project a blocked endpoint back into the carriageway.
export function buildingWalk(
  d,
  building,
  { station, radius = 0.29, length = 3, clearance, axis } = {},
) {
  const [x, z] = PLOTS[building];
  const y = station?.[1] ?? 0.07;
  station ??= [x, y, z + 2.3];
  const roads = pedestrianRoads(d.town);
  const clear = (a, b) => {
    if (Math.abs(b[0] - x) > 5.2 || Math.abs(b[2] - z) > 5.2) return false;
    const steps = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[2] - a[2]) / 0.3));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      if (
        !outsideCarriageway([a[0] + (b[0] - a[0]) * t, y, a[2] + (b[2] - a[2]) * t], roads, radius)
      )
        return false;
    }
    return (
      (!d.navigation || d.navigation.segment(a, b, radius)) &&
      (!clearance || clearance(a, b, radius))
    );
  };
  const candidates = [station];
  const anchors = d.plotCache?.get(building)?.group.userData.navigationAnchors;
  candidates.push(...(anchors?.service ?? []), ...(anchors?.door ?? []));
  for (let ring = 1; ring <= 6; ring++)
    for (let n = 0; n < 8; n++) {
      const angle = (n * Math.PI) / 4;
      candidates.push([
        station[0] + Math.cos(angle) * ring * 0.5,
        y,
        station[2] + Math.sin(angle) * ring * 0.5,
      ]);
    }
  // Large leisure models may leave no frontage wide enough for a leashed pair.
  // The side/rear promenade remains associated with the same building.
  for (const offset of [3.6, 4.6])
    candidates.push([x - offset, y, z - 1.5], [x + offset, y, z - 1.5], [x - 1.5, y, z - offset]);
  candidates.sort(
    (a, b) =>
      Math.hypot(a[0] - station[0], a[2] - station[2]) -
      Math.hypot(b[0] - station[0], b[2] - station[2]),
  );
  for (const at of candidates) {
    if (!clear(at, at)) continue;
    const nearest = roads.reduce(
      (best, road) =>
        !best ||
        segmentDistance(at[0], at[2], road.from, road.to) <
          segmentDistance(at[0], at[2], best.from, best.to)
          ? road
          : best,
      null,
    );
    const directions = axis
      ? [axis]
      : nearest?.from[0] === nearest?.to[0]
        ? [
            [0, 1],
            [1, 0],
          ]
        : [
            [1, 0],
            [0, 1],
          ];
    for (const [dx, dz] of directions)
      for (const sign of [1, -1]) {
        let end = at;
        for (let distance = 0.5; distance <= length; distance += 0.5) {
          const next = [at[0] + dx * sign * distance, y, at[2] + dz * sign * distance];
          if (!clear(end, next)) break;
          end = next;
        }
        if (Math.hypot(end[0] - at[0], end[2] - at[2]) < 1.5) continue;
        const path = walkPath([end, at]);
        path.building = building;
        path.frontage = { station, radius, length, clearance, axis };
        return d.navigation?.track ? d.navigation.track(path, radius) : path;
      }
  }
  return walkPath([]);
}

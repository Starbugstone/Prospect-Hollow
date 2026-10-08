import { PERSONAL_AREAS, areaUnlocked } from '../../data/townLandmarks';
import { MONUMENT_WILDLIFE, TOWN_ANIMALS } from '../../data/townAnimals';
import { groundHeight } from './TownLandscape';
import { walkPath } from './TownNavigation';
import { wetBank } from './TownRiver';

// One wild visitor per open site and two civic visitors keep this distant part
// of town alive without growing a crowd as more monument sites are introduced.
export function monumentCast(town, fauna) {
  const areas = PERSONAL_AREAS.filter((area) => areaUnlocked(town, area));
  const wildlife = [
    ...MONUMENT_WILDLIFE,
    'fox',
    'raccoon',
    ...fauna.garden.filter((species) => species !== 'otter'),
  ];
  const cast = areas.map((area) => {
    const index = PERSONAL_AREAS.indexOf(area);
    return {
      area,
      species: wildlife[index % wildlife.length],
      seed: 701 + index * 31,
      wild: true,
    };
  });
  const species = fauna.companions?.species;
  if (TOWN_ANIMALS[species]?.resident)
    for (const [n, area] of areas.slice(0, 2).entries())
      cast.push({ area, species, seed: 1001 + n * 31 });
  return cast;
}

// Follow the actual ground around the court, never through the monument. Search
// for a continuous open arc, returning along it if scenery blocks the full ring.
// Every segment is certified once; no pathfinding or mesh queries during motion.
export function* monumentRoute(nav, area, radius, height, seed) {
  const [x, z] = area.positions[0];
  for (const offset of [1.4, 2.2, 3]) {
    const points = Array.from({ length: 48 }, (_, n) => {
      const angle = ((n + seed) / 48) * Math.PI * 2;
      const px = x + Math.sin(angle) * (area.radius + offset);
      const pz = z + Math.cos(angle) * (area.radius + offset);
      return [px, groundHeight(px, pz) + 0.07, pz];
    });
    const edges = [];
    for (let n = 0; n < points.length; n++) {
      const a = points[n],
        b = points[(n + 1) % points.length];
      edges.push(
        a[1] >= 0.02 &&
          b[1] >= 0.02 &&
          !wetBank(a[0], a[2], radius) &&
          !wetBank(b[0], b[2], radius) &&
          nav.clear(a, radius, height) &&
          nav.clear(b, radius, height) &&
          nav.segment(a, b, radius, height),
      );
      yield;
    }
    if (edges.every(Boolean)) return walkPath([...points, points[0]]);
    const start = edges.indexOf(false) + 1;
    let current = [],
      best = [];
    for (let n = start; n < start + points.length; n++) {
      if (edges[n % points.length]) {
        if (!current.length) current.push(points[n % points.length]);
        current.push(points[(n + 1) % points.length]);
        if (current.length > best.length) best = [...current];
      } else current = [];
    }
    if (best.length >= 6) return walkPath([...best, ...best.slice(0, -1).reverse()]);
  }
  return walkPath([]);
}

// Keep a small, geographically spread set of landing grounds as the town grows.
// Existing feeding grounds come first; new districts fill the largest gaps.
export function spreadHabitats(habitats, limit = 18, separation = 10, selected = []) {
  const result = [...selected];
  const candidates = habitats.filter((h) => !result.includes(h));
  while (candidates.length && result.length < limit) {
    let best = 0,
      distance = -1;
    for (let n = 0; n < candidates.length; n++) {
      const p = candidates[n].point;
      const gap = result.length
        ? Math.min(...result.map((h) => Math.hypot(p[0] - h.point[0], p[2] - h.point[2])))
        : Infinity;
      if (gap > distance) {
        distance = gap;
        best = n;
      }
    }
    if (distance < separation) break;
    result.push(candidates.splice(best, 1)[0]);
  }
  return result;
}

export function birdPopulation(definition, habitats) {
  const districts = spreadHabitats(habitats, 12, 18).length;
  return Math.min(
    definition.maxCount ?? definition.count,
    definition.count + Math.floor(Math.max(0, districts - 2) / 2),
  );
}

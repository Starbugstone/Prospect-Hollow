import { neighborsOf } from './TileRules.js';

// Floor markers never anchor gems or obstruct gravity. Survey markers light in
// numbered order; ordinary lanterns can be lit in any order. Both accept blasts.
export function signalTargets(tiles, impacted, cols, rows) {
  const survey = tiles.reduce(
    (next, tile) =>
      tile.signalHealth && tile.surveyOrder ? Math.min(next, tile.surveyOrder) : next,
    Infinity,
  );
  const touched = new Set(impacted);
  for (const index of impacted)
    for (const neighbor of neighborsOf(index, cols, rows)) touched.add(neighbor);
  return [...touched].filter(
    (index) =>
      tiles[index]?.signalHealth > 0 &&
      (!tiles[index].surveyOrder || tiles[index].surveyOrder === survey),
  );
}

export function advanceOreOrders(orders, steps) {
  if (!orders?.length) return;
  for (const step of steps)
    for (const jewel of step.collectedJewels ?? []) {
      const order = orders.find((order) => order.color === jewel.type);
      if (order) order.progress = Math.min(order.target, order.progress + 1);
    }
}

export const remainingOre = (orders) =>
  (orders ?? []).reduce((sum, order) => sum + Math.max(0, order.target - order.progress), 0);

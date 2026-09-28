import { neighborsOf, isAnchored } from './TileRules.js';
import { GEM_TYPES } from './GemFactory.js';

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

// Charge cores are floor markers like lanterns: gems keep moving over them.
// Each move whose match or blast touches a core (on or beside it) adds one charge. A
// full core releases a free bonus on its own cell, or on the first ordinary
// neighbor when a relic, anchor or existing bonus occupies it. The release is
// only ever a help; missing a target never blocks completion.
// Levels may author a larger count (tile.coreCharges); three is the default.
export const CORE_CHARGES = 3;
export const CORE_BONUSES = ['cross', 'bomb'];
export const isChargeCore = (tile) => tile?.signal === 'core';

export function coreReleaseTarget(board, tiles, index, cols, rows, reserved = new Set()) {
  const usable = (cell) =>
    GEM_TYPES.includes(board[cell]?.type) && !isAnchored(tiles[cell]) && !reserved.has(cell);
  return [index, ...neighborsOf(index, cols, rows)].find(usable) ?? -1;
}

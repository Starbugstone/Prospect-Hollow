import { neighborsOf, isAnchored } from './TileRules.js';
import { GEM_TYPES } from './GemFactory.js';
import { isPlayableCell } from './BoardTopology.js';

// Floor markers never anchor gems or obstruct gravity. A lantern lights only when a
// match or blast clears its own cell. Survey markers light in numbered order, from a
// match or blast on or beside them; ordinary lanterns can be lit in any order.
export function signalTargets(tiles, impacted, cols, rows, ordinaryIndices = impacted) {
  const survey = tiles.reduce(
    (next, tile) =>
      tile.signalHealth && tile.surveyOrder ? Math.min(next, tile.surveyOrder) : next,
    Infinity,
  );
  const hit = new Set(impacted);
  const touched = new Set(impacted);
  for (const index of impacted)
    for (const neighbor of neighborsOf(index, cols, rows)) touched.add(neighbor);
  const sporeTouched = new Set(impacted);
  for (const index of ordinaryIndices)
    for (const neighbor of neighborsOf(index, cols, rows)) sporeTouched.add(neighbor);
  return [...touched].filter(
    (index) =>
      isPlayableCell(tiles[index]) &&
      tiles[index]?.signalHealth > 0 &&
      (tiles[index].signal !== 'lantern' || hit.has(index)) &&
      (tiles[index].signal !== 'spore' || sporeTouched.has(index)) &&
      (!tiles[index].surveyOrder || tiles[index].surveyOrder === survey),
  );
}

export function sporeTargets(tiles, index, axis, cols, rows) {
  return Array.from({ length: axis === 'column' ? rows : cols }, (_, offset) =>
    axis === 'column' ? offset * cols + (index % cols) : Math.floor(index / cols) * cols + offset,
  ).filter((cell) => isPlayableCell(tiles[cell]));
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

import { eraEvolution } from './eras';

export const SQUARE_POSITION = Object.freeze([0, -5]);
// Top of the square's raised paving, relative to its plot.
export const SQUARE_PAVING_HEIGHT = 0.16;

// Square-relative lamp corners. Street lamps that stand beside a corner refer to it
// by index, so the square and the town's lamps never light the same corner twice.
export const SQUARE_CORNERS = Object.freeze([
  [-2.35, -2.3],
  [2.35, -2.3],
  [-2.35, 2.3],
  [2.35, 2.3],
]);
// Modernized squares light the back corners first and complete the front at level two,
// keeping the fountain clear.
export const modernSquareLampCorners = (level) =>
  SQUARE_CORNERS.flatMap(([, z], i) => (level >= 2 || z < 0 ? [i] : []));
// A frontier square lights all four corners once finished.
export function squareLampCorners(town) {
  const era = town.buildingEras?.square;
  const stage = town.buildings?.square ?? 0;
  if (eraEvolution(era).style !== 'frontier')
    return modernSquareLampCorners(town.buildingEraLevels?.square || 1);
  return era === 'frontier' && stage >= 5 ? SQUARE_CORNERS.map((_, i) => i) : [];
}

import {
  MAIN_LANE_X,
  SIDEWALK_OFFSET,
  MAX_GROUND_BODY,
  POWER_HOUSE_POSITION,
  PLOT_STREET_OFFSET,
  RAIL_APPROACH_HALF_WIDTH,
} from './townClearances';
import generated from './generated/mineClearances.json';
// Shared placement keeps the landscape cut and mine plot aligned without renderer imports.
export const MINE_POSITION = Object.freeze([0, -20]);
export const MINE_ACCESS = Object.freeze({
  laneX: MAIN_LANE_X,
  sidewalk: SIDEWALK_OFFSET,
  maxBody: MAX_GROUND_BODY,
  gap: 0.25,
  powerHouse: POWER_HOUSE_POSITION,
  powerHouseHalfWidth: generated.powerHouseHalfWidth,
  railZ: MINE_POSITION[1] - 3,
  railApproachHalfWidth: RAIL_APPROACH_HALF_WIDTH,
});
export function mineYardEnvelope({
  maxBody = MINE_ACCESS.maxBody,
  powerHouseHalfWidth = MINE_ACCESS.powerHouseHalfWidth,
} = {}) {
  const a = MINE_ACCESS;
  return {
    minX: a.laneX + a.sidewalk + maxBody + a.gap,
    maxX: a.powerHouse[0] - powerHouseHalfWidth - a.gap,
    minZ: a.railZ + a.railApproachHalfWidth + a.gap,
    maxZ: a.powerHouse[1] + PLOT_STREET_OFFSET - a.sidewalk - maxBody - a.gap,
  };
}
export const MINE_SITE = Object.freeze({
  terrace: [-2.8, -24.8],
  fanHouse: [2, -25.6],
  upperTerrace: [-1.8, -27],
  sortingPlant: [3, -28.5],
  summit: [-1.5, -30],
  turbine: [3, -31],
  tipple: [6.45, -19.4],
  truckBay: [9.7, -19.4],
  ropeway: [
    [5.2, -26.4],
    [7.8, -19.4],
  ],
  stub: [
    [5.5, -19.4],
    [7.4, -19.4],
  ],
});

export const MINE_SHAFT = Object.freeze({
  rampStartZ: MINE_POSITION[1] + 3.3,
  portalZ: MINE_POSITION[1] - 0.35,
  endZ: MINE_POSITION[1] - 7,
  portalFloor: -2.5,
  undergroundGrade: 0.42,
  height: 1.85,
  halfWidth: 1.05,
  bankWidth: 2.15,
});

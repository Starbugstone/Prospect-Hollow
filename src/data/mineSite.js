// Shared placement keeps the landscape cut and mine plot aligned without renderer imports.
export const MINE_POSITION = Object.freeze([0, -20]);

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

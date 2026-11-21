// The chrome every settlement map draws over its top (town.css), in CSS pixels from the
// top of the map. Names and markers keep clear of it; a name that cannot is left out.

// Rows of pills from 12 px down, each 44 px tall with 8 px between rows, and 4 px kept
// clear below the last: the header alone (60), with the needs row or the Moon's second
// row (112), the Moon's header wrapped on a phone (164).
const FIRST_ROW = 12,
  ROW = 44,
  ROW_GAP = 8,
  CLEAR = 4;
/** The top a map's names keep below, with `rows` rows of header pills. */
export const mapHudTop = (rows) => FIRST_ROW + rows * (ROW + ROW_GAP) - ROW_GAP + CLEAR;

// The goal pills stack down the right from the third row, 12 px from the edge: the
// project's (.town-project-goal) at most 230 px wide, the commission's at most 290 px.
const GOAL_RIGHT = 12,
  PROJECT_WIDTH = 230,
  COMMISSION_WIDTH = 290;
// A phone's commission pill is one 44 px line at the foot of the map, 12 px from its left
// edge and 12 px above the tab bar, at most min(100% - 162px, 60% - 16px) of the foot,
// which is the frame less 24 px (TownCommissionGoal, .town-map-foot).
const FOOT_SIDE = 12;
/**
 * The valley's chrome: its header, the needs row when it shows, and the project and
 * commission pills down the right. A phone keeps the commission pill at the foot of the
 * map instead, above the tab bar (`tabs`, its height). `chrome` lists rectangles about their
 * centres, as layoutTownLabels takes them.
 */
export function mapHud(
  width,
  height,
  { needs = false, project = false, commission = false, tabs = 0 } = {},
) {
  const top = mapHudTop(needs ? 2 : 1);
  const footed = commission && width < 600;
  const goals = Number(project) + Number(commission && !footed);
  const chrome = [];
  if (goals) {
    const widest = commission && !footed ? COMMISSION_WIDTH : PROJECT_WIDTH;
    const goalWidth = Math.min(widest, width - GOAL_RIGHT * 2),
      bottom = Math.min(height, mapHudTop(2 + goals));
    chrome.push({
      id: 'hud-goals',
      x: width - GOAL_RIGHT - goalWidth / 2,
      y: bottom / 2,
      width: goalWidth,
      height: bottom,
    });
  }
  if (footed) {
    const foot = width - FOOT_SIDE * 2;
    const footWidth = Math.max(0, Math.min(foot - 162, foot * 0.6 - 16));
    const bottom = height - tabs - FOOT_SIDE;
    chrome.push({
      id: 'hud-commission-foot',
      x: FOOT_SIDE + footWidth / 2,
      y: bottom - (ROW + CLEAR) / 2,
      width: footWidth,
      height: ROW + CLEAR,
    });
  }
  return { top, chrome };
}

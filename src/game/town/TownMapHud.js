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

// The goal pills (.town-project-goal) stack down the right from the third row, 12 px from
// the edge; the widest, the commission's, is at most 290 px.
const GOAL_RIGHT = 12,
  GOAL_WIDTH = 290;
/**
 * The valley's chrome: its header, the needs row when it shows, and the project and
 * commission pills down the right. A phone keeps the commission pill at the foot of the
 * map instead (TownCommissionGoal). `chrome` lists rectangles about their centres, as
 * layoutTownLabels takes them.
 */
export function mapHud(width, height, { needs = false, project = false, commission = false } = {}) {
  const top = mapHudTop(needs ? 2 : 1);
  const goals = Number(project) + Number(commission && width >= 600);
  if (!goals) return { top, chrome: [] };
  const goalWidth = Math.min(GOAL_WIDTH, width - GOAL_RIGHT * 2),
    bottom = Math.min(height, mapHudTop(2 + goals));
  return {
    top,
    chrome: [
      {
        id: 'hud-goals',
        x: width - GOAL_RIGHT - goalWidth / 2,
        y: bottom / 2,
        width: goalWidth,
        height: bottom,
      },
    ],
  };
}

import { GEM_TYPES, randomGemType } from './GemFactory.js';
import { isAnchored } from './TileRules.js';

// A phase seal changes the gem resting on it once per move, after the move's cascade
// settles, to the colour its icon shows (`tile.phaseNext`). A new next colour is then
// drawn from the level's colours, never the one the gem has just become. A match on the
// seal wears it down like ice; once broken it stops changing gems and leaves the board.
const isPhaseSeal = (tile) => tile?.phaseSeal === true && tile.health > 0;
export const hasPhaseSeals = (tiles = []) => tiles.some(isPhaseSeal);

const nextPhase = (gemTypes, current) => {
  const choices = gemTypes.filter((type) => type !== current);
  return randomGemType(choices.length ? choices : gemTypes);
};

// Returns the presentation step, or null when no seal holds an ordinary gem.
export function shiftPhases(board, tiles, gemTypes, iteration) {
  const shifts = [];
  const tileUpdates = [];
  for (const [index, tile] of tiles.entries()) {
    const gem = board[index];
    if (!isPhaseSeal(tile) || !GEM_TYPES.includes(gem?.type) || isAnchored(tile)) continue;
    const next = tile.phaseNext && gemTypes.includes(tile.phaseNext) ? tile.phaseNext : gem.type;
    board[index] = { ...gem, type: next };
    tile.phaseNext = nextPhase(gemTypes, next);
    shifts.push({ index, from: gem.type, gem: board[index] });
    tileUpdates.push({ index, phaseNext: tile.phaseNext });
  }
  if (!shifts.length) return null;
  return {
    index: iteration,
    matches: [],
    cleared: [],
    drops: [],
    spawns: [],
    bonuses: [],
    tileUpdates,
    collectedJewels: [],
    phaseShifts: shifts,
  };
}

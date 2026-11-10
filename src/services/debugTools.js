import { townFrameStats, townTimings } from '../game/town/TownProfiler';
import { settledRunReport } from '../stores/game/runLog';
import { useGameStore } from '../stores/gameStore';
import { PROTOTYPE_BOARDS } from '../data/prototypeBoards';

// Read-only diagnostics for development, the preprod site and explicitly flagged local
// builds (VITE_DEBUG_TOOLS=true npm run build). The public game never installs them.
export const debugToolsAllowed = (
  env = import.meta.env,
  hostname = globalThis.location?.hostname ?? '',
) => !!env.DEV || env.VITE_DEBUG_TOOLS === 'true' || hostname.startsWith('preprod.');

// `window.prospectDebug`: profiling, navigation views, the running puzzle's log and boards on
// trial. None of these helpers reads or changes the save, so they never touch progress, coins
// or cloud saving.
export function createDebugTools() {
  return Object.freeze({
    async showNavigation(value = true) {
      return (await import('../game/town/NavigationDebug')).showNavigation(value);
    },
    // Construction and rebuild phase timings (ms) plus browser long tasks, for phones.
    townTimings(options) {
      return townTimings(options);
    },
    // The running puzzle as a replayable log: level, seed, moves and a fingerprint of the board.
    runLog() {
      return settledRunReport(useGameStore());
    },
    // Plays a board on trial (src/data/prototypeBoards.js) in the mine, e.g.
    // `prospectDebug.playPrototype('deep-lantern-routes')`. The run records nothing: no
    // reward, record, power or honour, and Exit mine leaves the save as it was. Settings
    // lists the same boards for phones.
    playPrototype(key = PROTOTYPE_BOARDS[0]?.key) {
      return useGameStore().startLevel(key, 'prototype');
    },
    // Per-frame render costs over a window, e.g. `await prospectDebug.townFrameStats(5)`
    // while orbiting the camera. Includes draw calls, triangles and quality settings.
    townFrameStats(seconds) {
      return townFrameStats(seconds);
    },
  });
}

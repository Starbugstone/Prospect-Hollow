import { townFrameStats, townTimings } from '../game/town/TownProfiler';

// Read-only diagnostics for development, the preprod site and explicitly flagged local
// builds (VITE_DEBUG_TOOLS=true npm run build). The public game never installs them.
export const debugToolsAllowed = (
  env = import.meta.env,
  hostname = globalThis.location?.hostname ?? '',
) => !!env.DEV || env.VITE_DEBUG_TOOLS === 'true' || hostname.startsWith('preprod.');

// `window.prospectDebug`: profiling and navigation views only. None of these helpers
// reads or changes the save, so they never touch progress, coins or cloud saving.
export function createDebugTools() {
  return Object.freeze({
    async showNavigation(value = true) {
      return (await import('../game/town/NavigationDebug')).showNavigation(value);
    },
    // Construction and rebuild phase timings (ms) plus browser long tasks, for phones.
    townTimings(options) {
      return townTimings(options);
    },
    // Per-frame render costs over a window, e.g. `await prospectDebug.townFrameStats(5)`
    // while orbiting the camera. Includes draw calls, triangles and quality settings.
    townFrameStats(seconds) {
      return townFrameStats(seconds);
    },
  });
}

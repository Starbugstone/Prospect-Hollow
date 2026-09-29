// A shared town stays live while a visitor watches it: re-read the owner's latest synced
// appearance on a slow cadence. The owner's game uploads within about ten seconds of a
// change, so a visitor sees an advancement shortly after the owner makes it. Nothing is
// requested while the page is hidden, failures back off, and a town that is no longer
// shared (404) stops polling for good.
export const VILLAGE_POLL_MS = 20_000;
const MAX_BACKOFF = 16;

export function createVillagePoller({
  load,
  apply,
  gone,
  interval = VILLAGE_POLL_MS,
  hidden = () => document.hidden,
  now = Date.now,
}) {
  let timer,
    failures = 0,
    running = false,
    stopped = false,
    last = now();
  function schedule(delay) {
    clearTimeout(timer);
    if (!stopped && !hidden()) timer = setTimeout(poll, Math.max(0, delay));
  }
  async function poll() {
    if (stopped || running || hidden()) return;
    running = true;
    try {
      const village = await load();
      if (stopped) return;
      failures = 0;
      apply(village);
    } catch (error) {
      if (stopped) return;
      if (error?.status === 404) {
        stopped = true;
        gone();
        return;
      }
      failures++;
    } finally {
      running = false;
      last = now();
      schedule(interval * Math.min(2 ** failures, MAX_BACKOFF));
    }
  }
  return {
    start: () => schedule(interval),
    // Returning to the page catches up at once when a refresh is due.
    resume: () => {
      if (!running) schedule(last + interval * Math.min(2 ** failures, MAX_BACKOFF) - now());
    },
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}

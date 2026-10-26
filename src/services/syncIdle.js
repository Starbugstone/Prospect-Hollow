// Boot and mine/village switches own their first rendering frames. A late server
// reply must respect a new transition as well as a request scheduled before it.
let notBefore = 0;
export function deferSync(milliseconds = 1500) {
  notBefore = Math.max(notBefore, Date.now() + milliseconds);
}
export async function waitForSyncIdle() {
  // Headless stores have no rendering critical path (and often fake timers).
  if (typeof window === 'undefined') return;
  for (;;) {
    const delay = notBefore - Date.now();
    if (delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
      continue;
    }
    await new Promise((resolve) => {
      if (globalThis.requestIdleCallback) requestIdleCallback(resolve, { timeout: 1000 });
      else setTimeout(resolve, 0);
    });
    if (Date.now() >= notBefore) return;
  }
}

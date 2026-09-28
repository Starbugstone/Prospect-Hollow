// Debounce bursts, cap the wait during continuous play, and back off failures.
// No periodic polling: clean or blocked towns have no scheduled network work.
export function createSyncScheduler({ pending, sync, now = Date.now, random = Math.random }) {
  let timer,
    firstChange = null,
    failures = 0,
    retryAt = 0,
    running = false,
    disposed = false;
  function schedule() {
    if (disposed || running) return;
    clearTimeout(timer);
    if (!pending()) {
      firstChange = null;
      failures = 0;
      retryAt = 0;
      return;
    }
    const time = now();
    if (firstChange === null) firstChange = time;
    const due = Math.max(retryAt, Math.min(time + 2000, firstChange + 10000));
    timer = setTimeout(flush, Math.max(0, due - time));
  }
  async function flush() {
    if (disposed || running || !pending()) return;
    running = true;
    try {
      const succeeded = await Promise.resolve()
        .then(() => sync({ pull: false }))
        .catch(() => false);
      if (succeeded) {
        failures = 0;
        retryAt = 0;
      } else {
        failures++;
        retryAt =
          now() + Math.min(300000, 5000 * 2 ** Math.min(failures - 1, 6)) * (1 + random() * 0.2);
      }
    } finally {
      running = false;
      firstChange = null;
      schedule();
    }
  }
  return {
    schedule,
    // Connectivity and visibility events respect an existing server backoff.
    resume: schedule,
    dispose() {
      disposed = true;
      clearTimeout(timer);
    },
  };
}

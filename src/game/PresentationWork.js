// Cosmetic work never owns a transaction. Invalidating a generation only cancels its visuals.
export function performanceMark(name) {
  if (import.meta.env.DEV) globalThis.performance?.mark(name);
}
export function afterPaint(callback) {
  let cancelled = false;
  const raf = globalThis.requestAnimationFrame ?? ((fn) => setTimeout(fn, 0));
  raf(() =>
    raf(() => {
      if (!cancelled) callback();
    }),
  );
  return () => {
    cancelled = true;
  };
}
export function scheduleWork(
  iterator,
  { budget = 4, isCurrent = () => true, complete = () => {} } = {},
) {
  let cancelled = false;
  const channel =
    !globalThis.requestIdleCallback && typeof window !== 'undefined' && globalThis.MessageChannel
      ? new MessageChannel()
      : null;
  const close = () => {
    channel?.port1.close();
    channel?.port2.close();
  };
  const schedule = globalThis.requestIdleCallback
    ? (run) => requestIdleCallback(run, { timeout: 100 })
    : channel
      ? (run) => {
          channel.port1.onmessage = run;
          channel.port2.postMessage(null);
        }
      : (run) => setTimeout(run, 0);
  const run = () => {
    if (cancelled || !isCurrent()) {
      close();
      iterator.return?.();
      return;
    }
    const start = performance.now();
    do {
      if (iterator.next().done) {
        close();
        complete();
        return;
      }
    } while (!cancelled && isCurrent() && performance.now() - start < budget);
    schedule(run);
  };
  schedule(run);
  return () => {
    cancelled = true;
    close();
    iterator.return?.();
  };
}

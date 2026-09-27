// A local presentation, with no SDK, requests, timers or automatic rewards.
export function createMockAdsProvider({ mode = 'interactive' } = {}) {
  let pending = null;
  let ready = false;

  function settle(status, requestId) {
    if (!pending || (requestId != null && requestId !== pending.requestId)) return false;
    if (!['rewarded', 'shown', 'dismissed', 'no-fill', 'error'].includes(status)) return false;
    if (status === 'rewarded' && pending.format !== 'rewarded') return false;
    const request = pending;
    pending = null;
    request.signal.removeEventListener('abort', request.abort);
    request.onPresentation(null);
    request.resolve({
      status: status === 'no-fill' ? 'not-available' : status,
      rewarded: status === 'rewarded',
      ...(status === 'no-fill' ? { reason: 'no-fill' } : {}),
    });
    return true;
  }

  return {
    name: 'mock',
    isReady: () => ready,
    initialize: async () => {
      ready = true;
      return true;
    },
    isAvailable: () => ready && !pending,
    show({ format, placement, requestId, signal, onPresentation }) {
      if (!ready || pending || signal.aborted) {
        return Promise.resolve({ status: 'not-available', rewarded: false });
      }
      return new Promise((resolve) => {
        pending = {
          format,
          requestId,
          resolve,
          signal,
          onPresentation,
          abort: () => settle('dismissed', requestId),
        };
        signal.addEventListener('abort', pending.abort, { once: true });
        onPresentation(Object.freeze({ requestId, format, placement }));
        // Noninteractive outcomes are only an explicit test configuration.
        if (mode !== 'interactive')
          settle(
            mode === 'success' ? (format === 'rewarded' ? 'rewarded' : 'shown') : mode,
            requestId,
          );
      });
    },
    settle,
    dispose() {
      ready = false;
      settle('dismissed');
    },
  };
}

import { isValidPlacement } from './placements.js';
import { createNoAdsProvider } from './NoAdsProvider.js';

const unavailable = (reason) => ({ status: 'not-available', rewarded: false, reason });

/** The service reports outcomes; rewards and progression belong to callers. */
export function createAdsService({
  provider = createNoAdsProvider(),
  privacy,
  enabled = false,
  initializationTimeoutMs = 10000,
  presentationTimeoutMs = 90000,
} = {}) {
  const listeners = new Set();
  let initialized = false;
  let destroyed = false;
  let unsubscribe = null;
  let initialization = null;
  let operation = null;
  let serial = 0;
  let epoch = 0;
  let state = Object.freeze({
    provider: provider.name,
    ready: false,
    busy: false,
    active: false,
    mockPresentation: null,
    reason: enabled ? 'consent-required' : 'disabled',
  });

  function update(patch) {
    state = Object.freeze({ ...state, ...patch });
    for (const listener of listeners) {
      // A presentation subscriber cannot break SDK cleanup or progression.
      try {
        listener(state);
      } catch {
        /* subscriber owns its errors */
      }
    }
  }

  function allowed() {
    if (!enabled || destroyed || provider.name === 'none') return false;
    const consent = privacy?.getState?.();
    return provider.name === 'mock'
      ? consent?.mockAdvertisingAllowed === true
      : consent?.advertisingAllowed === true && consent?.source === 'cookiebot';
  }

  function invalidate(reason) {
    epoch += 1;
    initialization?.controller.abort();
    initialization = null;
    operation?.cancel(reason);
    provider.dispose?.();
    update({ ready: false, busy: false, active: false, mockPresentation: null, reason });
  }

  function prepare() {
    if (!allowed()) return Promise.resolve(false);
    if (state.ready && provider.isReady?.() !== false) return Promise.resolve(true);
    if (initialization) return initialization.promise;
    const controller = new AbortController();
    const token = epoch;
    const pending = { controller, promise: null };
    initialization = pending;
    pending.promise = new Promise((resolve) => {
      let settled = false;
      const finish = (ready, reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', aborted);
        if (initialization === pending) initialization = null;
        const current = token === epoch && allowed();
        if (current) update({ ready: !!ready, reason: ready ? null : reason });
        if (!ready && current) {
          controller.abort();
          provider.dispose?.();
        }
        resolve(!!ready && current);
      };
      const aborted = () => finish(false, 'consent-required');
      const timer = setTimeout(
        () => finish(false, 'initialization-timeout'),
        initializationTimeoutMs,
      );
      controller.signal.addEventListener('abort', aborted, { once: true });
      Promise.resolve()
        .then(() => {
          if (controller.signal.aborted || !allowed()) return false;
          return provider.initialize({ signal: controller.signal, isAllowed: allowed });
        })
        .then(
          (ready) => finish(ready, 'unavailable'),
          () => finish(false, 'initialization-error'),
        );
    });
    return pending.promise;
  }

  function isAvailable(format, placement) {
    return (
      allowed() &&
      state.ready &&
      !state.busy &&
      isValidPlacement(format, placement) &&
      provider.isAvailable(format, placement)
    );
  }

  function show(format, placement) {
    if (!isValidPlacement(format, placement))
      return Promise.resolve(unavailable('invalid-placement'));
    if (state.busy) return Promise.resolve(unavailable('busy'));
    if (!allowed()) return Promise.resolve(unavailable('consent-required'));
    if (provider.supports?.(format) === false) return Promise.resolve(unavailable('unsupported'));
    const requestId = ++serial;
    const controller = new AbortController();
    const token = epoch;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        operation = null;
        const stillAllowed = token === epoch && allowed();
        let outcome = stillAllowed ? result : unavailable('consent-revoked');
        const statuses = ['shown', 'rewarded', 'dismissed', 'not-available', 'error'];
        if (!outcome || !statuses.includes(outcome.status))
          outcome = { status: 'error', reason: 'invalid-provider-result' };
        outcome = {
          ...outcome,
          rewarded:
            format === 'rewarded' && outcome.status === 'rewarded' && outcome.rewarded === true,
        };
        // Inconsistent results cannot accidentally become a successful reward.
        if (outcome.status === 'rewarded' && !outcome.rewarded) outcome.status = 'error';
        if (outcome.status === 'error') {
          controller.abort();
          provider.dispose?.();
        }
        update({
          busy: false,
          active: false,
          mockPresentation: null,
          ready: outcome.status !== 'error' && state.ready && provider.isReady?.() !== false,
        });
        // Completion observers can synchronously withdraw (and even restore)
        // consent. That invalidates this request before its caller sees a reward.
        if (token !== epoch || !allowed()) outcome = unavailable('consent-revoked');
        resolve(Object.freeze(outcome));
        if (outcome.status === 'error') {
          // Recover availability for the next voluntary offer, never retry the
          // failed advertisement. A failed initialization stops here (no loop).
          queueMicrotask(() => {
            if (allowed() && !operation) void prepare();
          });
        }
      };
      const timer = setTimeout(() => {
        finish({ status: 'error', rewarded: false, reason: 'presentation-timeout' });
        controller.abort();
        provider.dispose?.();
        update({ ready: false, reason: 'presentation-timeout' });
      }, presentationTimeoutMs);
      operation = {
        cancel(reason) {
          finish(unavailable(reason));
          controller.abort();
        },
      };
      update({ busy: true, active: true, reason: null });
      void prepare().then((ready) => {
        // A synchronous presentation subscriber may revoke consent or destroy
        // the service. Check again before touching a provider or its network.
        if (settled || controller.signal.aborted || token !== epoch || !allowed()) return;
        if (!ready || !provider.isAvailable(format, placement)) {
          finish(unavailable('unavailable'));
          return;
        }
        try {
          Promise.resolve(
            provider.show({
              format,
              placement,
              requestId,
              signal: controller.signal,
              onPresentation(presentation) {
                if (!settled && token === epoch) update({ mockPresentation: presentation });
              },
            }),
          ).then(finish, () => finish({ status: 'error', rewarded: false }));
        } catch {
          finish({ status: 'error', rewarded: false });
        }
      });
    });
  }

  return {
    async initialize() {
      if (destroyed) return false;
      if (!initialized) {
        initialized = true;
        unsubscribe = privacy?.subscribe?.(() => {
          if (!allowed()) invalidate(enabled ? 'consent-required' : 'disabled');
          else void prepare();
        });
        try {
          await privacy?.initialize?.();
        } catch {
          invalidate('privacy-unavailable');
          return false;
        }
      }
      return prepare();
    },
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    isAvailable,
    showInterstitial: (placement) => show('interstitial', placement),
    showRewarded: (placement) => show('rewarded', placement),
    settleMock: (status, requestId) =>
      provider.name === 'mock' && provider.settle(status, requestId),
    cancelActive(reason = 'cancelled') {
      if (operation || initialization) invalidate(reason);
    },
    destroy() {
      destroyed = true;
      unsubscribe?.();
      invalidate('destroyed');
      listeners.clear();
    },
  };
}

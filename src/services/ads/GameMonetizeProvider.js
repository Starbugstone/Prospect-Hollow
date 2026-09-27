export const GAMEMONETIZE_SDK_URL = 'https://api.gamemonetize.com/sdk.js';

export function isGameMonetizeConfigured(config) {
  return (
    config.approved === true &&
    config.privacyReviewed === true &&
    typeof config.gameId === 'string' &&
    /^[a-z\d]{20,64}$/i.test(config.gameId) &&
    !/placeholder|your.?game|replace|example/i.test(config.gameId)
  );
}

// The public SDK only documents showBanner(), SDK_READY, SDK_GAME_PAUSE and
// SDK_GAME_START. A resume event is NOT evidence of rewarded completion.
// https://github.com/MonetizeGame/GameMonetize.com-SDK/blob/master/README.md
export function createGameMonetizeProvider({
  config,
  documentRef = globalThis.document,
  requestTimeoutMs = 8000,
} = {}) {
  let frame = null;
  let ready = false;
  let initialization = null;
  let request = null;

  function finish(result) {
    if (!request) return;
    const pending = request;
    request = null;
    clearTimeout(pending.timer);
    pending.signal.removeEventListener('abort', pending.abort);
    if (frame) frame.style.visibility = 'hidden';
    pending.resolve({ ...result, rewarded: false });
  }

  function dispose() {
    ready = false;
    finish({ status: 'dismissed' });
    initialization?.(false);
    initialization = null;
    // Removing just a script cannot stop its timers or downstream trackers.
    // Destroy the SDK browsing context on timeout/withdrawal instead.
    frame?.remove();
    frame = null;
  }

  return {
    name: 'gamemonetize',
    isReady: () => ready,
    supports: (format) => format === 'interstitial',
    initialize({ signal, isAllowed }) {
      if (
        !isGameMonetizeConfigured(config || {}) ||
        !isAllowed() ||
        signal.aborted ||
        !documentRef?.body
      ) {
        return Promise.resolve(false);
      }
      if (ready) return Promise.resolve(true);
      return new Promise((resolve) => {
        const abort = () => dispose();
        initialization = (value) => {
          signal.removeEventListener('abort', abort);
          initialization = null;
          resolve(value);
        };
        signal.addEventListener('abort', abort, { once: true });
        try {
          frame = documentRef.createElement('iframe');
          frame.title = 'Advertisement';
          frame.setAttribute('data-ad-provider', 'gamemonetize');
          frame.setAttribute('allow', 'autoplay; fullscreen');
          // Isolated lifetime; exact ad-provider compatibility is a release audit gate.
          Object.assign(frame.style, {
            position: 'fixed',
            inset: '0',
            width: '100%',
            height: '100%',
            border: '0',
            zIndex: '100000',
            visibility: 'hidden',
          });
          documentRef.body.appendChild(frame);
          const sdkFrame = frame;
          const sdkWindow = frame.contentWindow;
          const sdkDocument = frame.contentDocument;
          if (typeof documentRef.defaultView?.__tcfapi === 'function') {
            sdkWindow.__tcfapi = (...args) => documentRef.defaultView.__tcfapi(...args);
          }
          sdkWindow.SDK_OPTIONS = {
            gameId: config.gameId,
            onEvent(event) {
              if (frame !== sdkFrame || signal.aborted || !isAllowed()) return;
              if (event?.name === 'SDK_READY') {
                ready = typeof sdkWindow.sdk?.showBanner === 'function';
                initialization?.(ready);
              } else if (event?.name === 'SDK_GAME_PAUSE' && request) {
                request.started = true;
                clearTimeout(request.timer);
              } else if (event?.name === 'SDK_GAME_START' && request) {
                finish(
                  request.started
                    ? { status: 'shown' }
                    : { status: 'not-available', reason: 'no-fill' },
                );
                // Public events have no request ID. Never reuse an SDK context
                // whose delayed events could settle a later chapter transition.
                dispose();
              }
            },
          };
          const script = sdkDocument.createElement('script');
          script.id = 'gamemonetize-sdk';
          script.async = true;
          script.src = GAMEMONETIZE_SDK_URL;
          script.onerror = () => {
            if (frame === sdkFrame) dispose();
          };
          // Check again immediately before the only network-capable operation.
          if (!isAllowed() || signal.aborted) return dispose();
          sdkDocument.head.appendChild(script);
        } catch {
          dispose();
        }
      });
    },
    isAvailable: (format) => ready && !request && format === 'interstitial',
    show({ format, signal }) {
      if (format !== 'interstitial' || !ready || request || signal.aborted) {
        return Promise.resolve({
          status: 'not-available',
          rewarded: false,
          reason: format === 'rewarded' ? 'rewarded-unsupported' : 'unavailable',
        });
      }
      return new Promise((resolve) => {
        request = {
          resolve,
          signal,
          started: false,
          abort: () => dispose(),
          timer: setTimeout(() => {
            finish({ status: 'not-available', reason: 'no-fill' });
            // Abandon this SDK session so late uncorrelated events cannot settle
            // another opportunity. The service can initialize a fresh session.
            dispose();
          }, requestTimeoutMs),
        };
        signal.addEventListener('abort', request.abort, { once: true });
        frame.style.visibility = 'visible';
        try {
          frame.contentWindow.sdk.showBanner();
        } catch {
          finish({ status: 'error' });
          dispose();
        }
      });
    },
    dispose,
  };
}

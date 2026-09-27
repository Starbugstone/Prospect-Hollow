import { createCookiebotAdapter, privacyConfiguration } from './cookiebotAdapter';

export const PRIVACY_STORAGE_KEY = 'prospect-hollow.privacy-preview.v1';
export const PRIVACY_POLICY_VERSION = 1;
export const PRIVACY_CHOICE_LIFETIME_MS = 180 * 24 * 60 * 60 * 1000;

export function createPrivacyService({
  configuration = privacyConfiguration(),
  windowRef = globalThis.window,
  documentRef = globalThis.document,
  storage,
  now = Date.now,
  adapterFactory = createCookiebotAdapter,
} = {}) {
  const listeners = new Set();
  let initialized = false;
  let adapter;
  let state = Object.freeze({
    source: configuration.provider,
    status: 'pending',
    advertisingAllowed: false,
    mockAdvertisingAllowed: false,
    mockEnabled: configuration.mockEnabled,
    consentKnown: false,
    preferencesOpen: false,
    dialogOpen: false,
    choice: null,
    revision: 0,
  });
  const storageRef = () => storage ?? windowRef?.localStorage;

  function update(patch) {
    const next = { ...state, ...patch };
    if (Object.keys(patch).every((key) => state[key] === next[key])) return;
    state = Object.freeze({ ...next, revision: state.revision + 1 });
    // A UI observer must not prevent the ad service from receiving a withdrawal.
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Privacy state listener failed', error);
      }
    }
  }

  function readChoice() {
    try {
      const stored = JSON.parse(storageRef()?.getItem(PRIVACY_STORAGE_KEY) ?? 'null');
      if (
        stored?.version === PRIVACY_POLICY_VERSION &&
        ['accepted', 'rejected'].includes(stored.choice) &&
        Number.isFinite(stored.savedAt) &&
        stored.savedAt <= now() &&
        now() - stored.savedAt < PRIVACY_CHOICE_LIFETIME_MS
      )
        return stored.choice;
    } catch {
      // Storage denial/corruption must never prevent normal play or grant consent.
    }
    return null;
  }

  function restoreChoice() {
    const choice = readChoice();
    update({
      choice,
      consentKnown: choice !== null,
      preferencesOpen: choice === null,
      dialogOpen: choice === null,
      advertisingAllowed: false,
      mockAdvertisingAllowed: configuration.mockEnabled && choice === 'accepted',
      status: 'ready',
    });
  }

  function onStorage(event) {
    if (event.key === PRIVACY_STORAGE_KEY || event.key === null) restoreChoice();
  }

  function initialize({ locale = 'en' } = {}) {
    if (initialized) return state;
    initialized = true;
    if (configuration.provider === 'cookiebot') {
      adapter = adapterFactory({
        config: configuration,
        windowRef,
        documentRef,
        locale,
        onChange: (patch) =>
          update({ ...patch, mockAdvertisingAllowed: false, preferencesOpen: false }),
      });
      try {
        adapter.start();
      } catch {
        update({ status: 'unavailable', advertisingAllowed: false });
      }
    } else {
      restoreChoice();
      windowRef?.addEventListener('storage', onStorage);
    }
    return state;
  }

  function setMockChoice(allowed) {
    if (configuration.provider !== 'placeholder' || typeof allowed !== 'boolean') return false;
    const choice = allowed ? 'accepted' : 'rejected';
    // Publish first so rejecting cannot be delayed by storage errors.
    update({
      choice,
      consentKnown: true,
      preferencesOpen: false,
      dialogOpen: false,
      advertisingAllowed: false,
      mockAdvertisingAllowed: configuration.mockEnabled && allowed,
      status: 'ready',
    });
    try {
      storageRef()?.setItem(
        PRIVACY_STORAGE_KEY,
        JSON.stringify({ version: PRIVACY_POLICY_VERSION, choice, savedAt: now() }),
      );
    } catch {
      // Keep the current session usable even when persistence is unavailable.
    }
    return true;
  }

  return {
    initialize,
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setMockChoice,
    openPreferences() {
      initialize();
      if (configuration.provider === 'cookiebot') {
        update({ advertisingAllowed: false });
        try {
          if (adapter?.openPreferences()) return;
        } catch {
          // Explain the unavailable controls without enabling any ads.
        }
        update({ status: 'unavailable', preferencesOpen: true, dialogOpen: true });
      } else update({ preferencesOpen: true, dialogOpen: true });
    },
    closePreferences() {
      update({ preferencesOpen: false, dialogOpen: false });
    },
    withdraw() {
      update({ advertisingAllowed: false, mockAdvertisingAllowed: false });
      if (configuration.provider === 'placeholder') setMockChoice(false);
      else adapter?.withdraw();
    },
    dispose() {
      update({ advertisingAllowed: false, mockAdvertisingAllowed: false });
      adapter?.dispose();
      windowRef?.removeEventListener('storage', onStorage);
      listeners.clear();
    },
  };
}

export const privacyService = createPrivacyService({
  configuration: privacyConfiguration(import.meta.env),
});
export const privacy = privacyService;

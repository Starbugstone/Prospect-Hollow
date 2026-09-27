import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createPrivacyService,
  PRIVACY_CHOICE_LIFETIME_MS,
  PRIVACY_STORAGE_KEY,
} from '../src/services/privacy/privacyService';
import {
  AD_PURPOSE_IDS,
  createCookiebotAdapter,
  hasAdvertisingConsent,
  isCookiebotConfigured,
  privacyConfiguration,
} from '../src/services/privacy/cookiebotAdapter';
import { PRIVACY_COPY } from '../src/components/privacy/privacyCopy';

const services = [];
afterEach(() => {
  services.splice(0).forEach((service) => service.dispose());
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function memoryStorage() {
  const entries = new Map();
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

function preview(options = {}) {
  const storage = options.storage ?? memoryStorage();
  const service = createPrivacyService({
    configuration: privacyConfiguration({ VITE_AD_PROVIDER: 'mock' }),
    storage,
    ...options,
  });
  services.push(service);
  return { service, storage };
}

function liveConfiguration(overrides = {}) {
  return privacyConfiguration({
    VITE_PRIVACY_PROVIDER: 'cookiebot',
    VITE_COOKIEBOT_DOMAIN_GROUP_ID: '12345678-abcd-1234-abcd-123456789abc',
    VITE_PRIVACY_CONFIGURATION_REVIEWED: 'true',
    VITE_PRIVACY_VENDOR_IDS: '755,42',
    ...overrides,
  });
}

function validTcData(overrides = {}) {
  return {
    cmpId: 134,
    cmpStatus: 'loaded',
    gdprApplies: true,
    eventStatus: 'useractioncomplete',
    tcString: 'CMP-provided-consent-string',
    listenerId: 7,
    purpose: { consents: Object.fromEntries(AD_PURPOSE_IDS.map((id) => [id, true])) },
    vendor: { consents: { 755: true, 42: true } },
    ...overrides,
  };
}
const explicitMarketing = { method: 'explicit', marketing: true };

function browserFixture() {
  const elements = new Map();
  const windowRef = new EventTarget();
  windowRef.setTimeout = (...args) => setTimeout(...args);
  windowRef.clearTimeout = (...args) => clearTimeout(...args);
  windowRef.Cookiebot = {
    consent: { ...explicitMarketing },
    hasResponse: true,
    renew: vi.fn(),
    withdraw: vi.fn(),
  };
  let tcListener;
  windowRef.__tcfapi = vi.fn((operation, version, callback) => {
    if (operation === 'addEventListener') tcListener = callback;
  });
  const documentRef = {
    getElementById: (id) => elements.get(id),
    createElement: () => ({
      attributes: {},
      setAttribute(name, value) {
        this.attributes[name] = value;
      },
    }),
    head: { appendChild: (element) => elements.set(element.id, element) },
  };
  return {
    windowRef,
    documentRef,
    elements,
    emitConsent: (data = validTcData(), success = true) => tcListener(data, success),
  };
}

describe('privacy preview cannot authorize live advertising', () => {
  it('starts denied, allows explicit mock choice only, and preserves it across reloads', () => {
    const { service, storage } = preview();
    expect(service.initialize()).toMatchObject({
      advertisingAllowed: false,
      mockAdvertisingAllowed: false,
      consentKnown: false,
      preferencesOpen: true,
      dialogOpen: true,
    });
    service.setMockChoice(true);
    expect(service.getState()).toMatchObject({
      source: 'placeholder',
      advertisingAllowed: false,
      mockAdvertisingAllowed: true,
      preferencesOpen: false,
      dialogOpen: false,
    });
    const reloaded = preview({ storage }).service;
    expect(reloaded.initialize()).toMatchObject({
      mockAdvertisingAllowed: true,
      consentKnown: true,
    });
    reloaded.openPreferences();
    expect(reloaded.getState().dialogOpen).toBe(true);
    reloaded.setMockChoice(false);
    expect(reloaded.getState()).toMatchObject({
      advertisingAllowed: false,
      mockAdvertisingAllowed: false,
      choice: 'rejected',
    });
    expect(preview({ storage }).service.initialize().choice).toBe('rejected');
  });

  it('does not enable even mock advertising unless that provider was explicitly configured', () => {
    const { service } = preview({ configuration: privacyConfiguration() });
    service.initialize();
    service.setMockChoice(true);
    expect(service.getState()).toMatchObject({
      advertisingAllowed: false,
      mockAdvertisingAllowed: false,
    });
  });

  it('closing the notice is not acceptance or a stored decision', () => {
    const { service, storage } = preview();
    service.initialize();
    service.closePreferences();
    expect(service.getState()).toMatchObject({
      consentKnown: false,
      mockAdvertisingAllowed: false,
    });
    expect(storage.getItem(PRIVACY_STORAGE_KEY)).toBeNull();
  });

  it('expires both acceptance and refusal after the same retention period', () => {
    for (const allowed of [true, false]) {
      let now = 1000;
      const { service, storage } = preview({ now: () => now });
      service.initialize();
      service.setMockChoice(allowed);
      now += PRIVACY_CHOICE_LIFETIME_MS;
      expect(preview({ storage, now: () => now }).service.initialize()).toMatchObject({
        consentKnown: false,
        preferencesOpen: true,
        mockAdvertisingAllowed: false,
      });
    }
  });

  it.each([
    'not JSON',
    JSON.stringify({ version: 0, choice: 'accepted', savedAt: 1 }),
    JSON.stringify({ version: 1, choice: 'accepted', savedAt: 999999 }),
    JSON.stringify({ version: 1, choice: true, savedAt: 1 }),
  ])('fails closed for corrupt, outdated or future choices: %s', (value) => {
    const storage = memoryStorage();
    storage.setItem(PRIVACY_STORAGE_KEY, value);
    expect(preview({ storage, now: () => 100 }).service.initialize().mockAdvertisingAllowed).toBe(
      false,
    );
  });

  it('remains playable and withdraws immediately when browser storage is denied', () => {
    const storage = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    const { service } = preview({ storage });
    service.initialize();
    service.setMockChoice(true);
    const revisions = [];
    service.subscribe((state) => revisions.push(state.revision));
    service.withdraw();
    expect(service.getState().mockAdvertisingAllowed).toBe(false);
    expect(revisions.length).toBeGreaterThan(0);
  });

  it('receives refusal and storage clearance from another tab', () => {
    const windowRef = new EventTarget();
    const { service, storage } = preview({ windowRef });
    service.initialize();
    service.setMockChoice(true);
    storage.setItem(
      PRIVACY_STORAGE_KEY,
      JSON.stringify({ version: 1, choice: 'rejected', savedAt: Date.now() }),
    );
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: PRIVACY_STORAGE_KEY });
    windowRef.dispatchEvent(event);
    expect(service.getState().mockAdvertisingAllowed).toBe(false);
    storage.removeItem(PRIVACY_STORAGE_KEY);
    windowRef.dispatchEvent(event);
    expect(service.getState().consentKnown).toBe(false);
  });

  it('notifies later observers even if an earlier observer throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { service } = preview();
    service.initialize();
    service.setMockChoice(true);
    service.subscribe(() => {
      throw new Error('broken UI');
    });
    const adsObserver = vi.fn();
    service.subscribe(adsObserver);
    service.withdraw();
    expect(adsObserver).toHaveBeenCalledWith(
      expect.objectContaining({ mockAdvertisingAllowed: false }),
    );
  });
});

describe('certified CMP gate', () => {
  it('requires audited account and vendor configuration', () => {
    expect(isCookiebotConfigured(liveConfiguration())).toBe(true);
    for (const overrides of [
      { VITE_PRIVACY_CONFIGURATION_REVIEWED: 'false' },
      { VITE_COOKIEBOT_DOMAIN_GROUP_ID: '' },
      { VITE_COOKIEBOT_DOMAIN_GROUP_ID: '00000000-0000-0000-0000-000000000000' },
      { VITE_PRIVACY_VENDOR_IDS: '42' },
      { VITE_PRIVACY_VENDOR_IDS: '755,bad' },
      { VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS: '123,bad' },
    ])
      expect(isCookiebotConfigured(liveConfiguration(overrides))).toBe(false);
  });

  it('requires explicit marketing, a ready Cookiebot TC string and all reviewed purposes/vendors', () => {
    const config = liveConfiguration();
    expect(hasAdvertisingConsent(validTcData(), explicitMarketing, config)).toBe(true);
    for (const overrides of [
      { cmpId: 1 },
      { cmpStatus: 'loading' },
      { eventStatus: 'cmpuishown' },
      { gdprApplies: false },
      { gdprApplies: undefined },
      { tcString: '' },
      { purpose: { consents: { 1: true } } },
      { vendor: { consents: { 755: true } } },
      { publisher: { restrictions: { 1: { 755: 0 } } } },
      { publisher: { restrictions: { 2: { 755: 2 } } } },
    ])
      expect(hasAdvertisingConsent(validTcData(overrides), explicitMarketing, config)).toBe(false);
    expect(
      hasAdvertisingConsent(validTcData(), { method: 'implied', marketing: true }, config),
    ).toBe(false);
    expect(
      hasAdvertisingConsent(validTcData(), { method: 'explicit', marketing: false }, config),
    ).toBe(false);
  });

  it('checks consent for each configured non-TCF Google partner', () => {
    const config = liveConfiguration({ VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS: '123,456' });
    expect(
      hasAdvertisingConsent(
        validTcData({ addtlConsent: '2~123.456~dv.123.456' }),
        explicitMarketing,
        config,
      ),
    ).toBe(true);
    for (const addtlConsent of ['', '1~123.456', '2~123~dv.123.456'])
      expect(hasAdvertisingConsent(validTcData({ addtlConsent }), explicitMarketing, config)).toBe(
        false,
      );
  });

  it('does not load a third-party script with missing credentials or review', () => {
    const browser = browserFixture();
    const onChange = vi.fn();
    const adapter = createCookiebotAdapter({
      ...browser,
      config: liveConfiguration({ VITE_PRIVACY_CONFIGURATION_REVIEWED: 'false' }),
      onChange,
    });
    adapter.start();
    expect(browser.elements.size).toBe(0);
    expect(onChange).toHaveBeenCalledWith({ advertisingAllowed: false, status: 'unavailable' });
    adapter.dispose();
  });

  it('loads only the configured CMP, then blocks while preferences change and after withdrawal', () => {
    vi.useFakeTimers();
    const browser = browserFixture();
    const { service } = preview({ ...browser, configuration: liveConfiguration() });
    service.initialize({ locale: 'fr' });
    service.initialize();
    expect([...browser.elements.keys()]).toEqual(['CookiebotConfiguration', 'Cookiebot']);
    const script = browser.elements.get('Cookiebot');
    expect(script.src).toBe('https://consent.cookiebot.com/uc.js');
    expect(script.attributes).toMatchObject({
      'data-culture': 'FR',
      'data-framework': 'TCF',
      'data-consentmode': 'disabled',
    });
    expect(service.getState().advertisingAllowed).toBe(false);
    script.onload();
    browser.emitConsent();
    expect(service.getState()).toMatchObject({
      source: 'cookiebot',
      advertisingAllowed: true,
      mockAdvertisingAllowed: false,
    });
    const previousRevision = service.getState().revision;
    service.openPreferences();
    expect(service.getState()).toMatchObject({ advertisingAllowed: false, dialogOpen: true });
    expect(service.getState().revision).toBeGreaterThan(previousRevision);
    expect(browser.windowRef.Cookiebot.renew).toHaveBeenCalledOnce();
    browser.emitConsent(validTcData({ eventStatus: 'tcloaded' }));
    expect(service.getState()).toMatchObject({ advertisingAllowed: false, dialogOpen: true });
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(true);
    browser.windowRef.Cookiebot.consent.marketing = false;
    browser.windowRef.dispatchEvent(new Event('CookiebotOnDecline'));
    expect(service.getState()).toMatchObject({ advertisingAllowed: false, dialogOpen: false });
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(false);
  });

  it('cannot promote preview acceptance into production CMP consent', () => {
    vi.useFakeTimers();
    const { service: mock, storage } = preview();
    mock.initialize();
    mock.setMockChoice(true);
    const browser = browserFixture();
    const { service } = preview({ ...browser, storage, configuration: liveConfiguration() });
    service.initialize();
    expect(service.setMockChoice(true)).toBe(false);
    expect(service.getState()).toMatchObject({
      advertisingAllowed: false,
      mockAdvertisingAllowed: false,
      consentKnown: false,
    });
  });

  it('requires a fresh choice after withdrawal even if an older CMP callback arrives late', () => {
    vi.useFakeTimers();
    const browser = browserFixture();
    const { service } = preview({ ...browser, configuration: liveConfiguration() });
    service.initialize();
    service.withdraw();
    browser.elements.get('Cookiebot').onload();
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(false);
    browser.emitConsent(validTcData({ eventStatus: 'tcloaded' }));
    expect(service.getState().advertisingAllowed).toBe(false);
    service.openPreferences();
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(true);
  });

  it('keeps timeout/error states blocked and ignores callbacks after disposal', () => {
    vi.useFakeTimers();
    const browser = browserFixture();
    const { service } = preview({ ...browser, configuration: liveConfiguration() });
    service.initialize();
    browser.elements.get('Cookiebot').onload();
    vi.advanceTimersByTime(15000);
    expect(service.getState()).toMatchObject({ status: 'unavailable', advertisingAllowed: false });
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(true);
    browser.elements.get('Cookiebot').onerror();
    expect(service.getState().advertisingAllowed).toBe(false);
    service.dispose();
    browser.emitConsent();
    expect(service.getState().advertisingAllowed).toBe(false);
  });
});

it('provides matching English and French controls and policy copy', () => {
  expect(Object.keys(PRIVACY_COPY.fr).sort()).toEqual(Object.keys(PRIVACY_COPY.en).sort());
  for (const value of Object.values(PRIVACY_COPY.fr))
    expect(value.trim().length).toBeGreaterThan(0);
});

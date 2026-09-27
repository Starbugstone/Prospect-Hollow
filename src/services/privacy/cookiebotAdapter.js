export const COOKIEBOT_CMP_ID = 134;
export const GOOGLE_VENDOR_ID = 755;
export const AD_PURPOSE_IDS = Object.freeze([1, 2, 3, 4, 7, 9, 10]);

const ids = (value) => {
  if (typeof value !== 'string' || !value.trim()) return [];
  const parts = value.split(',').map((part) => Number(part.trim()));
  return parts.every((id) => Number.isSafeInteger(id) && id > 0) ? [...new Set(parts)] : [];
};

export function privacyConfiguration(env = {}) {
  return {
    provider: env.VITE_PRIVACY_PROVIDER === 'cookiebot' ? 'cookiebot' : 'placeholder',
    domainGroupId: String(env.VITE_COOKIEBOT_DOMAIN_GROUP_ID ?? '').trim(),
    reviewed: env.VITE_PRIVACY_CONFIGURATION_REVIEWED === 'true',
    vendorIds: ids(env.VITE_PRIVACY_VENDOR_IDS),
    purposeIds: AD_PURPOSE_IDS,
    additionalVendorIds: ids(env.VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS),
    additionalVendorsValid:
      !String(env.VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS ?? '').trim() ||
      ids(env.VITE_PRIVACY_GOOGLE_AC_VENDOR_IDS).length > 0,
    mockEnabled: (env.VITE_AD_PROVIDER ?? env.VITE_ADS_PROVIDER) === 'mock',
  };
}

export function isCookiebotConfigured(config) {
  return (
    config.provider === 'cookiebot' &&
    config.reviewed === true &&
    config.additionalVendorsValid !== false &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(config.domainGroupId) &&
    config.domainGroupId !== '00000000-0000-0000-0000-000000000000' &&
    config.vendorIds.includes(GOOGLE_VENDOR_ID)
  );
}

// A deliberately conservative gate, not a general TCF legal-basis evaluator.
// We support explicit consent for the whole reviewed ad stack; partial consent
// does not enable an unverified non-personalized or limited-ads mode.
export function hasAdvertisingConsent(tcData, cookieConsent, config) {
  if (
    !isCookiebotConfigured(config) ||
    tcData?.cmpId !== COOKIEBOT_CMP_ID ||
    tcData.cmpStatus !== 'loaded' ||
    !['tcloaded', 'useractioncomplete'].includes(tcData.eventStatus) ||
    tcData.gdprApplies !== true ||
    typeof tcData.tcString !== 'string' ||
    !tcData.tcString.trim() ||
    cookieConsent?.method !== 'explicit' ||
    cookieConsent.marketing !== true
  )
    return false;

  if (!config.purposeIds.every((id) => tcData.purpose?.consents?.[id] === true)) return false;
  if (!config.vendorIds.every((id) => tcData.vendor?.consents?.[id] === true)) return false;
  // Restrictions may prohibit a vendor or require a basis this adapter does not support.
  if (
    config.purposeIds.some((purpose) =>
      config.vendorIds.some((vendor) => {
        const restriction = tcData.publisher?.restrictions?.[purpose]?.[vendor];
        return restriction !== undefined && restriction !== 1;
      }),
    )
  )
    return false;

  if (config.additionalVendorIds.length) {
    const [version, consented] = String(tcData.addtlConsent ?? '').split('~');
    if (version !== '2') return false;
    const allowed = new Set(String(consented).split('.').map(Number));
    if (!config.additionalVendorIds.every((id) => allowed.has(id))) return false;
  }
  return true;
}

export function createCookiebotAdapter({
  config,
  windowRef,
  documentRef,
  onChange,
  locale = 'en',
}) {
  let listenerId;
  let subscribed = false;
  let disposed = false;
  let lastData;
  let timeout;
  let waitingForChoice = false;
  let withdrawn = false;
  const events = new Map();
  const deny = (status = 'pending') => onChange({ advertisingAllowed: false, status });

  function listen() {
    if (disposed || subscribed || typeof windowRef.__tcfapi !== 'function') return;
    subscribed = true;
    try {
      windowRef.__tcfapi('addEventListener', 2, (data, success) => {
        if (disposed) return;
        if (data?.listenerId !== undefined) listenerId = data.listenerId;
        lastData = success ? data : undefined;
        if (success && ['tcloaded', 'useractioncomplete'].includes(data?.eventStatus)) {
          windowRef.clearTimeout(timeout);
          if (data.eventStatus === 'useractioncomplete' && waitingForChoice) {
            waitingForChoice = false;
            withdrawn = false;
          }
          onChange({
            advertisingAllowed:
              !waitingForChoice &&
              !withdrawn &&
              hasAdvertisingConsent(data, windowRef.Cookiebot?.consent, config),
            status: 'ready',
            consentKnown: windowRef.Cookiebot?.hasResponse === true,
            dialogOpen: waitingForChoice,
          });
        } else {
          if (success && data?.eventStatus === 'cmpuishown') waitingForChoice = true;
          onChange({
            advertisingAllowed: false,
            status: success && data?.eventStatus === 'cmpuishown' ? 'pending' : 'unavailable',
            dialogOpen: waitingForChoice,
          });
        }
      });
    } catch {
      subscribed = false;
      deny('unavailable');
    }
  }

  function start() {
    if (!isCookiebotConfigured(config) || !windowRef || !documentRef) {
      deny('unavailable');
      return;
    }
    // This adapter owns its script and exact account configuration. Do not trust
    // an unrelated CMP tag injected by an extension, template or older integration.
    if (documentRef.getElementById('Cookiebot')) {
      deny('unavailable');
      return;
    }
    events.set('CookiebotOnConsentReady', () => {
      listen();
      if (lastData)
        onChange({
          advertisingAllowed:
            !waitingForChoice &&
            !withdrawn &&
            hasAdvertisingConsent(lastData, windowRef.Cookiebot?.consent, config),
          status: 'ready',
          consentKnown: windowRef.Cookiebot?.hasResponse === true,
        });
    });
    events.set('CookiebotOnDecline', () => {
      lastData = undefined;
      withdrawn = true;
      waitingForChoice = false;
      onChange({
        advertisingAllowed: false,
        consentKnown: true,
        status: 'ready',
        dialogOpen: false,
      });
    });
    events.set('CookiebotOnDialogDisplay', () => {
      lastData = undefined;
      waitingForChoice = true;
      onChange({ advertisingAllowed: false, status: 'pending', dialogOpen: true });
      listen();
    });
    for (const [name, callback] of events) windowRef.addEventListener(name, callback);

    const restrictions = documentRef.createElement('script');
    restrictions.id = 'CookiebotConfiguration';
    restrictions.type = 'application/json';
    restrictions.setAttribute('data-cookieconsent', 'ignore');
    restrictions.textContent = JSON.stringify({
      Frameworks: {
        IABTCF2: {
          AllowedVendors: config.vendorIds,
          AllowedGoogleACVendors: config.additionalVendorIds,
          AllowedPurposes: config.purposeIds,
          AllowedSpecialFeatures: [],
        },
      },
    });
    documentRef.head.appendChild(restrictions);
    const script = documentRef.createElement('script');
    script.id = 'Cookiebot';
    script.src = 'https://consent.cookiebot.com/uc.js';
    script.async = true;
    script.setAttribute('data-cbid', config.domainGroupId);
    // Current vendor documentation uses TCF, without a version suffix.
    script.setAttribute('data-framework', 'TCF');
    script.setAttribute('data-culture', locale === 'fr' ? 'FR' : 'EN');
    script.setAttribute('data-blockingmode', 'none');
    script.setAttribute('data-consentmode', 'disabled');
    script.onload = () => {
      if (disposed) return;
      if (withdrawn) windowRef.Cookiebot?.withdraw?.();
      listen();
    };
    script.onerror = () => !disposed && deny('unavailable');
    timeout = windowRef.setTimeout(() => !disposed && deny('unavailable'), 15000);
    documentRef.head.appendChild(script);
  }

  return {
    start,
    openPreferences() {
      if (typeof windowRef?.Cookiebot?.renew !== 'function') return false;
      lastData = undefined;
      waitingForChoice = true;
      onChange({ advertisingAllowed: false, status: 'pending', dialogOpen: true });
      windowRef.Cookiebot.renew();
      return true;
    },
    withdraw() {
      lastData = undefined;
      withdrawn = true;
      waitingForChoice = false;
      onChange({
        advertisingAllowed: false,
        consentKnown: true,
        status: 'ready',
        dialogOpen: false,
      });
      windowRef?.Cookiebot?.withdraw?.();
    },
    dispose() {
      disposed = true;
      windowRef?.clearTimeout(timeout);
      for (const [name, callback] of events) windowRef.removeEventListener(name, callback);
      if (listenerId !== undefined)
        windowRef.__tcfapi?.('removeEventListener', 2, () => {}, listenerId);
    },
  };
}

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdsService } from '../src/services/ads/AdsService.js';
import { createMockAdsProvider } from '../src/services/ads/MockAdsProvider.js';
import { createConfiguredAds } from '../src/services/ads/index.js';

function consent(initial = {}) {
  let state = {
    source: 'placeholder',
    advertisingAllowed: false,
    mockAdvertisingAllowed: false,
    ...initial,
  };
  const listeners = new Set();
  return {
    getState: () => state,
    initialize: vi.fn(),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    set(patch) {
      state = { ...state, ...patch };
      for (const fn of listeners) fn(state);
    },
  };
}

const flush = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};
const services = [];
function setup(options = {}) {
  const privacy = options.privacy || consent({ mockAdvertisingAllowed: true });
  const provider = options.provider || createMockAdsProvider();
  const service = createAdsService({ enabled: true, ...options, privacy, provider });
  services.push(service);
  return { service, privacy, provider };
}

afterEach(() => {
  for (const service of services.splice(0)) service.destroy();
  vi.useRealTimers();
});

describe('provider-neutral advertising lifecycle', () => {
  it('never initializes without consent and starts when the local preview is accepted', async () => {
    const privacy = consent();
    const provider = createMockAdsProvider();
    vi.spyOn(provider, 'initialize');
    const { service } = setup({ privacy, provider });
    expect(await service.initialize()).toBe(false);
    expect(provider.initialize).not.toHaveBeenCalled();
    expect(await service.showRewarded('bonus-chest')).toMatchObject({
      rewarded: false,
      status: 'not-available',
    });
    privacy.set({ mockAdvertisingAllowed: true });
    await flush();
    expect(service.isAvailable('rewarded', 'bonus-chest')).toBe(true);
    expect(provider.initialize).toHaveBeenCalledOnce();
  });

  it('requires a visible explicit mock completion and rejects overlapping requests', async () => {
    const { service } = setup();
    await service.initialize();
    const results = [];
    const first = service.showRewarded('bonus-chest').then((result) => {
      results.push(result);
      return result;
    });
    expect(await service.showRewarded('bonus-chest')).toMatchObject({
      status: 'not-available',
      reason: 'busy',
    });
    await flush();
    expect(service.getState()).toMatchObject({
      active: true,
      busy: true,
      mockPresentation: { format: 'rewarded', placement: 'bonus-chest' },
    });
    expect(results).toEqual([]);
    const id = service.getState().mockPresentation.requestId;
    expect(service.settleMock('rewarded', id + 1)).toBe(false);
    expect(service.settleMock('rewarded', id)).toBe(true);
    expect(service.settleMock('rewarded', id)).toBe(false);
    expect(await first).toMatchObject({ status: 'rewarded', rewarded: true });
    expect(service.getState()).toMatchObject({
      active: false,
      busy: false,
      mockPresentation: null,
    });
    const next = service.showRewarded('manual-shuffle');
    await flush();
    expect(service.settleMock('rewarded', id)).toBe(false);
    service.settleMock('dismissed', service.getState().mockPresentation.requestId);
    expect(await next).toMatchObject({ status: 'dismissed', rewarded: false });
  });

  it.each([
    ['dismissed', 'dismissed'],
    ['no-fill', 'not-available'],
    ['error', 'error'],
  ])('restores presentation and grants nothing for mock %s', async (mode, status) => {
    const { service } = setup({ provider: createMockAdsProvider({ mode }) });
    await service.initialize();
    expect(await service.showRewarded('bonus-chest')).toMatchObject({ status, rewarded: false });
    expect(service.getState()).toMatchObject({
      active: false,
      busy: false,
      mockPresentation: null,
    });
  });

  it('only accepts the allowed format/placement pairs', async () => {
    const { service } = setup({ provider: createMockAdsProvider({ mode: 'success' }) });
    await service.initialize();
    for (const [format, placement] of [
      ['interstitial', 'bonus-chest'],
      ['rewarded', 'chapter-transition'],
      ['rewarded', 'dead-board'],
      ['banner', 'manual-shuffle'],
    ]) {
      expect(service.isAvailable(format, placement)).toBe(false);
    }
    expect(await service.showInterstitial('chapter-transition')).toMatchObject({
      status: 'shown',
      rewarded: false,
    });
    expect(await service.showRewarded('dead-board')).toMatchObject({
      status: 'not-available',
      reason: 'invalid-placement',
    });
  });

  it('cancels an open presentation immediately on withdrawal and permits a fresh session', async () => {
    const { service, privacy } = setup();
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    const id = service.getState().mockPresentation.requestId;
    privacy.set({ mockAdvertisingAllowed: false });
    expect(await showing).toMatchObject({ rewarded: false, reason: 'consent-revoked' });
    expect(service.settleMock('rewarded', id)).toBe(false);
    expect(service.getState()).toMatchObject({ busy: false, active: false, ready: false });
    privacy.set({ mockAdvertisingAllowed: true });
    await flush();
    expect(service.isAvailable('rewarded', 'bonus-chest')).toBe(true);
  });

  it('cannot grant a late provider reward after consent was withdrawn and restored', async () => {
    let complete;
    const provider = {
      name: 'mock',
      initialize: async () => true,
      isAvailable: () => true,
      dispose: vi.fn(),
      show: () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    };
    const { service, privacy } = setup({ provider });
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    privacy.set({ mockAdvertisingAllowed: false });
    privacy.set({ mockAdvertisingAllowed: true });
    await flush();
    complete({ status: 'rewarded', rewarded: true });
    expect(await showing).toMatchObject({ status: 'not-available', rewarded: false });
  });

  it('does not enter a provider when a busy-state observer withdraws consent synchronously', async () => {
    const { service, privacy, provider } = setup();
    vi.spyOn(provider, 'show');
    await service.initialize();
    service.subscribe((state) => {
      if (state.busy) privacy.set({ mockAdvertisingAllowed: false });
    });
    expect(await service.showRewarded('bonus-chest')).toMatchObject({
      rewarded: false,
      reason: 'consent-revoked',
    });
    expect(provider.show).not.toHaveBeenCalled();
  });

  it('cannot reward when presentation itself synchronously triggers withdrawal', async () => {
    const { service, privacy } = setup();
    await service.initialize();
    service.subscribe((state) => {
      if (state.mockPresentation) privacy.set({ mockAdvertisingAllowed: false });
    });
    expect(await service.showRewarded('bonus-chest')).toMatchObject({
      rewarded: false,
      reason: 'consent-revoked',
    });
    expect(service.getState().active).toBe(false);
  });

  it('cannot reward if a completion observer withdraws and immediately restores consent', async () => {
    const { service, privacy } = setup();
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    let changed = false;
    service.subscribe((state) => {
      if (!state.busy && !changed) {
        changed = true;
        privacy.set({ mockAdvertisingAllowed: false });
        privacy.set({ mockAdvertisingAllowed: true });
      }
    });
    service.settleMock('rewarded', service.getState().mockPresentation.requestId);
    expect(await showing).toMatchObject({
      status: 'not-available',
      rewarded: false,
      reason: 'consent-revoked',
    });
    await flush();
    expect(service.isAvailable('rewarded', 'bonus-chest')).toBe(true);
  });

  it('expires stalled SDK initialization and ignores a later ready callback', async () => {
    vi.useFakeTimers();
    let ready;
    const provider = {
      name: 'mock',
      initialize: () =>
        new Promise((resolve) => {
          ready = resolve;
        }),
      isAvailable: () => true,
      dispose: vi.fn(),
    };
    const { service } = setup({ provider, initializationTimeoutMs: 100 });
    const initializing = service.initialize();
    await vi.advanceTimersByTimeAsync(100);
    expect(await initializing).toBe(false);
    expect(provider.dispose).toHaveBeenCalled();
    ready(true);
    await flush();
    expect(service.getState()).toMatchObject({ ready: false, reason: 'initialization-timeout' });
  });

  it('expires an unresponsive presentation, cleans up and ignores late completion', async () => {
    vi.useFakeTimers();
    const { service } = setup({ presentationTimeoutMs: 100 });
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    const id = service.getState().mockPresentation.requestId;
    await vi.advanceTimersByTimeAsync(100);
    expect(await showing).toMatchObject({
      status: 'error',
      rewarded: false,
      reason: 'presentation-timeout',
    });
    expect(service.getState()).toMatchObject({ busy: false, active: false, ready: true });
    expect(service.settleMock('rewarded', id)).toBe(false);
  });

  it.each([false, true])(
    'cleans up provider failures, including thrown promises: %s',
    async (asyncFailure) => {
      const provider = {
        name: 'mock',
        initialize: async () => true,
        isAvailable: () => true,
        dispose: vi.fn(),
        show: () => {
          if (asyncFailure) return Promise.reject(new Error('SDK failed'));
          throw new Error('SDK failed');
        },
      };
      const { service } = setup({ provider });
      await service.initialize();
      expect(await service.showInterstitial('chapter-transition')).toMatchObject({
        status: 'error',
        rewarded: false,
      });
      expect(provider.dispose).toHaveBeenCalledOnce();
      expect(service.getState()).toMatchObject({ active: false, busy: false, ready: false });
    },
  );

  it('rejects malformed reward outcomes and survives broken subscribers', async () => {
    const provider = {
      name: 'mock',
      initialize: async () => true,
      isAvailable: () => true,
      dispose: vi.fn(),
      show: async () => ({ status: 'rewarded', rewarded: false }),
    };
    const { service } = setup({ provider });
    await service.initialize();
    service.subscribe((state) => {
      if (state.busy) throw new Error('UI failed');
    });
    expect(await service.showRewarded('bonus-chest')).toMatchObject({
      status: 'error',
      rewarded: false,
    });
    expect(service.getState().active).toBe(false);
  });

  it('keeps unknown, incomplete, disabled and native live configurations as no-op providers', async () => {
    const privacy = consent({
      advertisingAllowed: true,
      mockAdvertisingAllowed: true,
      source: 'cookiebot',
    });
    for (const options of [
      { env: {} },
      { env: { VITE_ADS_ENABLED: 'false', VITE_AD_PROVIDER: 'mock' } },
      { env: { VITE_ADS_ENABLED: 'true', VITE_AD_PROVIDER: 'unknown' } },
      { env: { VITE_ADS_ENABLED: 'true', VITE_AD_PROVIDER: 'gamemonetize' } },
      {
        native: true,
        env: {
          VITE_ADS_ENABLED: 'true',
          VITE_AD_PROVIDER: 'gamemonetize',
          VITE_GAMEMONETIZE_GAME_ID: '1234567890abcdefghijklmnopqrstuv',
          VITE_GAMEMONETIZE_APPROVED: 'true',
          VITE_GAMEMONETIZE_PRIVACY_REVIEWED: 'true',
        },
      },
    ]) {
      const service = createConfiguredAds({ privacy, native: false, ...options });
      services.push(service);
      expect(await service.initialize()).toBe(false);
      expect(service.getState().provider).toBe('none');
      expect(await service.showInterstitial('chapter-transition')).toMatchObject({
        rewarded: false,
        status: 'not-available',
      });
    }
  });

  it('does not treat a local preference as real CMP consent', async () => {
    const provider = {
      name: 'gamemonetize',
      initialize: vi.fn(async () => true),
      isAvailable: () => true,
      dispose: vi.fn(),
    };
    const { service, privacy } = setup({
      provider,
      privacy: consent({ advertisingAllowed: true }),
    });
    expect(await service.initialize()).toBe(false);
    expect(provider.initialize).not.toHaveBeenCalled();
    privacy.set({ source: 'cookiebot' });
    await flush();
    expect(provider.initialize).toHaveBeenCalledOnce();
  });

  it('restores optional mock availability after a transient error without replaying the ad', async () => {
    const { service, provider } = setup();
    vi.spyOn(provider, 'show');
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    service.settleMock('error', service.getState().mockPresentation.requestId);
    expect(await showing).toMatchObject({ status: 'error', rewarded: false });
    await flush();
    expect(provider.show).toHaveBeenCalledOnce();
    expect(service.isAvailable('rewarded', 'bonus-chest')).toBe(true);
  });

  it('cancels presentation on view unmount without destroying the reusable service', async () => {
    const { service } = setup();
    await service.initialize();
    const showing = service.showRewarded('bonus-chest');
    await flush();
    service.cancelActive('view-unmounted');
    expect(await showing).toMatchObject({ status: 'not-available', rewarded: false });
    expect(service.getState()).toMatchObject({ busy: false, active: false, ready: false });
    expect(await service.initialize()).toBe(true);
    expect(service.isAvailable('rewarded', 'bonus-chest')).toBe(true);
  });
});

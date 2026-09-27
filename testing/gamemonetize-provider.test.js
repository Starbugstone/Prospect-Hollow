import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createGameMonetizeProvider,
  GAMEMONETIZE_SDK_URL,
} from '../src/services/ads/GameMonetizeProvider.js';
import { createAdsService } from '../src/services/ads/AdsService.js';

const config = {
  approved: true,
  privacyReviewed: true,
  gameId: '1234567890abcdefghijklmnopqrstuv',
};
function browser() {
  const frames = [];
  const scripts = [];
  const documentRef = {
    defaultView: { __tcfapi: vi.fn() },
    body: { appendChild: vi.fn() },
    createElement(tag) {
      expect(tag).toBe('iframe');
      const frame = {
        style: {},
        setAttribute: vi.fn(),
        remove: vi.fn(),
        contentWindow: { sdk: { showBanner: vi.fn() } },
        contentDocument: {
          createElement: () => ({}),
          head: { appendChild: (script) => scripts.push(script) },
        },
      };
      frames.push(frame);
      return frame;
    },
  };
  return { frames, scripts, documentRef };
}
const providers = [];
function setup(overrides = {}) {
  const fake = browser();
  const provider = createGameMonetizeProvider({
    config,
    documentRef: fake.documentRef,
    ...overrides,
  });
  providers.push(provider);
  return { ...fake, provider };
}
function initialize(provider) {
  return provider.initialize({ signal: new AbortController().signal, isAllowed: () => true });
}
const event = (frame, name) => frame.contentWindow.SDK_OPTIONS.onEvent({ name });
const flush = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

afterEach(() => {
  for (const provider of providers.splice(0)) provider.dispose();
  vi.useRealTimers();
});

describe('GameMonetize adapter without live requests', () => {
  it.each([
    { ...config, approved: false },
    { ...config, privacyReviewed: false },
    { ...config, gameId: '' },
    { ...config, gameId: 'yourgameidplaceholder123456' },
  ])('creates no iframe or script for incomplete approval %j', async (incomplete) => {
    const { provider, frames, scripts } = setup({ config: incomplete });
    expect(await initialize(provider)).toBe(false);
    expect(frames).toHaveLength(0);
    expect(scripts).toHaveLength(0);
  });

  it('cannot load the SDK without current consent even with complete config', async () => {
    const { provider, scripts } = setup();
    expect(
      await provider.initialize({ signal: new AbortController().signal, isAllowed: () => false }),
    ).toBe(false);
    expect(scripts).toHaveLength(0);
  });

  it('loads only the official URL after consent and bridges the actual CMP API', async () => {
    const { provider, frames, scripts, documentRef } = setup();
    const initialized = initialize(provider);
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(GAMEMONETIZE_SDK_URL);
    frames[0].contentWindow.__tcfapi('getTCData', 2, 'callback');
    expect(documentRef.defaultView.__tcfapi).toHaveBeenCalledWith('getTCData', 2, 'callback');
    event(frames[0], 'SDK_READY');
    expect(await initialized).toBe(true);
    expect(provider.isAvailable('interstitial')).toBe(true);
    expect(provider.isAvailable('rewarded')).toBe(false);
    expect(
      await provider.show({ format: 'rewarded', signal: new AbortController().signal }),
    ).toMatchObject({ status: 'not-available', rewarded: false, reason: 'rewarded-unsupported' });
    expect(frames[0].contentWindow.sdk.showBanner).not.toHaveBeenCalled();
  });

  it('treats generic resume as interstitial completion only and destroys that SDK context', async () => {
    const { provider, frames } = setup();
    const initialized = initialize(provider);
    event(frames[0], 'SDK_READY');
    await initialized;
    const showing = provider.show({ format: 'interstitial', signal: new AbortController().signal });
    event(frames[0], 'SDK_GAME_PAUSE');
    event(frames[0], 'SDK_GAME_START');
    expect(await showing).toEqual({ status: 'shown', rewarded: false });
    expect(frames[0].remove).toHaveBeenCalledOnce();
    expect(provider.isReady()).toBe(false);
  });

  it('ignores callbacks and script errors from a disposed SDK context', async () => {
    const { provider, frames, scripts } = setup();
    const first = initialize(provider);
    event(frames[0], 'SDK_READY');
    await first;
    const showing = provider.show({ format: 'interstitial', signal: new AbortController().signal });
    event(frames[0], 'SDK_GAME_START');
    expect(await showing).toMatchObject({ status: 'not-available', reason: 'no-fill' });
    const next = initialize(provider);
    event(frames[1], 'SDK_READY');
    await next;
    const nextShowing = provider.show({
      format: 'interstitial',
      signal: new AbortController().signal,
    });
    event(frames[1], 'SDK_GAME_PAUSE');
    event(frames[0], 'SDK_GAME_START');
    scripts[0].onerror();
    expect(frames[1].remove).not.toHaveBeenCalled();
    expect(provider.isAvailable('interstitial')).toBe(false);
    event(frames[1], 'SDK_GAME_START');
    expect(await nextShowing).toEqual({ status: 'shown', rewarded: false });
  });

  it('disposes a no-fill SDK before late advertising can open', async () => {
    vi.useFakeTimers();
    const { provider, frames } = setup({ requestTimeoutMs: 100 });
    const initialized = initialize(provider);
    event(frames[0], 'SDK_READY');
    await initialized;
    const showing = provider.show({ format: 'interstitial', signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(100);
    expect(await showing).toMatchObject({
      status: 'not-available',
      rewarded: false,
      reason: 'no-fill',
    });
    event(frames[0], 'SDK_GAME_PAUSE');
    expect(frames[0].remove).toHaveBeenCalledOnce();
    expect(provider.isReady()).toBe(false);
  });

  it('cancels SDK loading immediately when its initialization signal is aborted', async () => {
    const { provider, frames } = setup();
    const controller = new AbortController();
    const initialized = provider.initialize({ signal: controller.signal, isAllowed: () => true });
    controller.abort();
    expect(await initialized).toBe(false);
    expect(frames[0].remove).toHaveBeenCalledOnce();
    event(frames[0], 'SDK_READY');
    expect(provider.isReady()).toBe(false);
  });

  it('lazily creates a fresh SDK for each chapter opportunity through the shared service', async () => {
    const { provider, frames } = setup();
    const privacy = { getState: () => ({ source: 'cookiebot', advertisingAllowed: true }) };
    const service = createAdsService({ enabled: true, privacy, provider });
    for (let i = 0; i < 2; i += 1) {
      const showing = service.showInterstitial('chapter-transition');
      await flush();
      expect(frames).toHaveLength(i + 1);
      event(frames[i], 'SDK_READY');
      await flush();
      event(frames[i], 'SDK_GAME_PAUSE');
      event(frames[i], 'SDK_GAME_START');
      expect(await showing).toEqual({ status: 'shown', rewarded: false });
      expect(service.getState()).toMatchObject({ ready: false, active: false, busy: false });
    }
    service.destroy();
  });
});

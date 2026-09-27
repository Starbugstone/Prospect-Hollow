import { Capacitor } from '@capacitor/core';
import { privacyService } from '../privacy/privacyService.js';
import { createAdsService } from './AdsService.js';
import { createMockAdsProvider } from './MockAdsProvider.js';
import { createNoAdsProvider } from './NoAdsProvider.js';
import { createGameMonetizeProvider, isGameMonetizeConfigured } from './GameMonetizeProvider.js';

export { createAdsService } from './AdsService.js';
export { AD_PLACEMENTS } from './placements.js';

export function createConfiguredAds({
  env = import.meta.env || {},
  privacy = privacyService,
  native = Capacitor.isNativePlatform(),
  documentRef = globalThis.document,
} = {}) {
  const enabled = env.VITE_ADS_ENABLED === 'true';
  const name = env.VITE_AD_PROVIDER || env.VITE_ADS_PROVIDER || 'none';
  const config = {
    gameId: env.VITE_GAMEMONETIZE_GAME_ID,
    approved: env.VITE_GAMEMONETIZE_APPROVED === 'true',
    privacyReviewed: env.VITE_GAMEMONETIZE_PRIVACY_REVIEWED === 'true',
  };
  let provider = createNoAdsProvider(native ? 'native-placeholder' : 'disabled');
  if (enabled && name === 'mock') provider = createMockAdsProvider();
  else if (enabled && !native && name === 'gamemonetize' && isGameMonetizeConfigured(config)) {
    provider = createGameMonetizeProvider({ config, documentRef });
  }
  return createAdsService({ provider, privacy, enabled });
}

// Importing has no side effects: neither consent nor advertising scripts load.
export const ads = createConfiguredAds();

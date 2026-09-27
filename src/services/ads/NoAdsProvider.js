export function createNoAdsProvider(reason = 'disabled') {
  return {
    name: 'none',
    initialize: async () => false,
    isAvailable: () => false,
    show: async () => ({ status: 'not-available', rewarded: false, reason }),
    dispose() {},
  };
}

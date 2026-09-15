import { useCampaignStore } from '../stores/campaignStore';
import { HAMMER_CAPACITY } from '../data/rewards';

// Console-only tools for this device-local game, also available in preview builds.
export function createTestingTools(pinia) {
  return Object.freeze({
    grant({ coins = 100000, hammers = HAMMER_CAPACITY } = {}) {
      if (![coins, hammers].every((value) => Number.isSafeInteger(value) && value >= 0))
        throw new TypeError('Coins and hammers must be non-negative safe integers.');
      const campaign = useCampaignStore(pinia);
      if (campaign.readOnly) throw new Error(campaign.saveWarning);
      const previousCoins = campaign.town.coins;
      const previousHammers = campaign.builderHammers;
      campaign.town.coins = Math.min(Number.MAX_SAFE_INTEGER, previousCoins + coins);
      campaign.builderHammers = Math.min(HAMMER_CAPACITY, previousHammers + hammers);
      if (!campaign.save()) {
        campaign.town.coins = previousCoins;
        campaign.builderHammers = previousHammers;
        throw new Error('Test resources could not be saved. Balances were restored.');
      }
      return { coins: campaign.town.coins, builderHammers: campaign.builderHammers };
    },
  });
}

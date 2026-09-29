import { describe, it, expect, beforeEach } from 'vitest';
import { useCampaignStore } from '../src/stores/campaignStore';
import { createPinia, setActivePinia } from 'pinia';

describe('Power rewards', () => {
  let campaign;
  const slot = (id) => campaign.powers.find((power) => power.id === id);

  beforeEach(() => {
    setActivePinia(createPinia());
    campaign = useCampaignStore();
    campaign.town.buildings.armory = 3;
  });

  it('adds a known power to its inventory slot', () => {
    const initial = slot('tnt').quantity;
    expect(
      campaign.awardReward({ id: 'tnt', label: 'TNT', kind: 'power', quantity: 1 }),
    ).toBeTruthy();
    expect(slot('tnt').quantity).toBe(initial + 1);
  });

  it('awards several at once', () => {
    const initial = slot('shuffle').quantity;
    campaign.awardReward({ id: 'shuffle', label: 'Shuffle', kind: 'power', quantity: 5 });
    expect(slot('shuffle').quantity).toBe(initial + 5);
  });

  it('ignores an unknown power', () => {
    expect(campaign.awardReward({ id: 'unknown-power', kind: 'power', quantity: 1 })).toBeNull();
  });
});

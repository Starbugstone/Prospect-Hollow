import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useNextStepAction } from '../src/composables/useNextStepAction';
import { LEVEL_COUNT } from '../src/data/campaign';
import { buildingStatus } from '../src/game/town/TownBuildingFeedback';

beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  });
  setActivePinia(createPinia());
});

it('offers the free first building, then the mine, as the next step', () => {
  const campaign = useCampaignStore();
  const emit = vi.fn();
  const { action, act } = useNextStepAction(
    () => campaign.town,
    () => 0,
    emit,
  );
  expect(action.value).toMatchObject({ kind: 'build', label: 'Build for free' });
  act();
  expect(emit).toHaveBeenCalledWith('build-free', expect.any(String));

  // Once the free first building is spent, an unaffordable goal points to the mine.
  const settled = useNextStepAction(
    () => ({ ...campaign.town, coins: 0, buildings: { ...campaign.town.buildings, well: 1 } }),
    () => 0,
    emit,
  );
  expect(settled.action.value).toMatchObject({
    kind: 'mine',
    params: { level: campaign.nextLevel },
  });
  settled.act();
  expect(emit).toHaveBeenLastCalledWith('mine');
});

it('points to replays once every level is done and the town still needs coins', () => {
  const campaign = useCampaignStore();
  for (let id = 1; id <= LEVEL_COUNT; id++) campaign.records[id] = { stars: 1, score: 1 };
  expect(campaign.newLevelsLeft).toBe(false);
  const { action } = useNextStepAction(
    () => ({ ...campaign.town, coins: 0, buildings: { ...campaign.town.buildings, well: 1 } }),
    () => 0,
    vi.fn(),
  );
  expect(action.value).toMatchObject({ kind: 'mine', label: 'Replay levels' });
  expect(action.value.params).toBeUndefined();
  // The mine's label on the map offers the same, rather than naming the last level again.
  expect(buildingStatus(campaign.town, 'mine', { nextLevel: null })).toEqual({
    kind: 'mine',
    text: 'Replay levels',
  });
  expect(buildingStatus(campaign.town, 'mine', { nextLevel: 12 }).text).toBe('Level 12');
});

import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useNextStepAction } from '../src/composables/useNextStepAction';

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

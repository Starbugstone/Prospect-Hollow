import { beforeEach, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createTown } from '../src/data/town';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useNextStepAction, villageProgressOpen } from '../src/composables/useNextStepAction';

beforeEach(() => {
  const saved = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key) => saved.get(key) ?? null,
    setItem: (key, value) => saved.set(key, value),
    removeItem: (key) => saved.delete(key),
  });
  setActivePinia(createPinia());
});

it('opens village progress for new players and hides it once they are settled', () => {
  const town = createTown();
  expect(villageProgressOpen(null, town)).toBe(true);
  town.tourSeen = true;
  expect(villageProgressOpen(null, town)).toBe(true);
  town.buildings.well = 1;
  expect(villageProgressOpen(null, town)).toBe(false);
  town.tourSeen = false;
  expect(villageProgressOpen(null, town)).toBe(true);
});

it('always follows the player choice once they open or hide progress', () => {
  const settled = { ...createTown(), tourSeen: true, buildings: { well: 1 } };
  expect(villageProgressOpen(true, settled)).toBe(true);
  expect(villageProgressOpen(false, createTown())).toBe(false);
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

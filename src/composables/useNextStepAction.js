import { computed, toValue } from 'vue';
import { eraGate } from '../game/town/TownEras';
import { nextGoal, constructionReady } from '../game/town/TownRules';
import { useCampaignStore } from '../stores/campaignStore';

// The village's single most useful next action, shown at the top of the Build tab.
// `goal` reads a goal computed elsewhere (the campaign store's), else this town's own.
export function useNextStepAction(town, hammers, emit, goal = () => nextGoal(toValue(town))) {
  const campaign = useCampaignStore();
  const nextStep = computed(() => toValue(goal));
  const gate = computed(() => eraGate(toValue(town)));
  const readyProjects = computed(() =>
    Object.values(toValue(town).projects).filter(constructionReady),
  );
  const ready = computed(() => readyProjects.value[0]);
  const canBuild = computed(
    () =>
      nextStep.value?.available &&
      (toValue(town).coins >= nextStep.value.cost || toValue(hammers) > 0),
  );
  const action = computed(() =>
    ready.value
      ? { kind: 'finish', icon: 'check', label: 'Finish' }
      : gate.value.available
        ? { kind: 'era', icon: 'arrow', label: 'Next era' }
        : canBuild.value
          ? {
              kind: 'build',
              icon: 'home',
              label: nextStep.value.cost === 0 ? 'Build for free' : 'Build',
            }
          : {
              kind: 'mine',
              icon: 'mine',
              label: 'Play level {level}',
              params: { level: campaign.nextLevel },
            },
  );
  function act() {
    if (ready.value) emit('select', ready.value.id);
    else if (gate.value.available) emit('advance-era');
    else if (canBuild.value)
      emit(nextStep.value.cost === 0 ? 'build-free' : 'inspect', nextStep.value.id);
    else emit('mine');
  }
  return { goal: nextStep, gate, readyProjects, ready, canBuild, action, act };
}

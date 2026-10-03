import { computed, toValue } from 'vue';
import { eraGate } from '../game/town/TownEras';
import { nextGoal, constructionReady } from '../game/town/TownRules';
import { useCampaignStore } from '../stores/campaignStore';

// The village's single most useful next action, shown at the top of the Build tab.
export function useNextStepAction(town, hammers, emit) {
  const campaign = useCampaignStore();
  const goal = computed(() => nextGoal(toValue(town)));
  const gate = computed(() => eraGate(toValue(town)));
  const readyProjects = computed(() =>
    Object.values(toValue(town).projects).filter(constructionReady),
  );
  const ready = computed(() => readyProjects.value[0]);
  const canBuild = computed(
    () => goal.value?.available && (toValue(town).coins >= goal.value.cost || toValue(hammers) > 0),
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
              label: goal.value.cost === 0 ? 'Build for free' : 'Build',
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
    else if (canBuild.value) emit(goal.value.cost === 0 ? 'build-free' : 'inspect', goal.value.id);
    else emit('mine');
  }
  return { goal, gate, readyProjects, ready, canBuild, action, act };
}

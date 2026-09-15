<template>
  <section class="village-next" :aria-label="t('Your next village step')">
    <div class="village-needs-strip">
      <button
        v-for="need in needs"
        :key="need.id"
        @click="$emit('inspect', need.id)"
        :class="{ shortage: need.shortage }"
        :aria-label="need.label"
      >
        <TownIcon :name="need.icon" /><span>{{ need.value }}</span
        ><b v-if="need.shortage" aria-hidden="true">↑</b>
      </button>
      <span
        class="village-era-progress"
        :aria-label="
          t('Era improvements: {count}/{total}', {
            count: eraProgress.done,
            total: eraProgress.total,
          })
        "
      >
        <img src="/art/rewards/era-compass.svg" alt="" /><progress
          :value="eraProgress.done"
          :max="eraProgress.total"
        /><small>{{ eraProgress.done }}/{{ eraProgress.total }}</small>
      </span>
    </div>
    <TownDefenseStatus v-if="population(town)" :town="town" @select="$emit('inspect', $event)" />
    <div class="village-next-action" :class="{ 'is-ready': ready || gate.available }">
      <button
        v-if="place"
        class="next-building-art"
        @click="$emit('inspect', place.id)"
        :aria-label="t('Choose {building}', { building: t(place.name) })"
      >
        <svg viewBox="-160 -200 320 245" aria-hidden="true">
          <TownBuilding
            :id="place.id"
            :stage="previewStage"
            :era="town.era"
            :era-level="previewEraLevel"
          />
        </svg>
        <img v-if="ready" class="next-ready-hammer" src="/art/rewards/builder-hammer.svg" alt="" />
      </button>
      <img v-else class="next-compass" src="/art/rewards/era-compass.svg" alt="" />
      <div class="next-step-copy" aria-live="polite">
        <small>{{
          t(
            ready
              ? 'Ready to finish'
              : gate.available
                ? 'A new era awaits'
                : goal
                  ? 'Next for your village'
                  : project
                    ? 'Build with every puzzle'
                    : 'Your village is complete',
          )
        }}</small>
        <strong>{{
          place
            ? t(place.shortName)
            : t(gate.next?.enabled ? gate.next.label : 'More adventures in the mine')
        }}</strong>
        <div v-if="ready" class="next-requirement">
          <TownIcon name="check" />{{ t('{count} ready', { count: readyProjects.length }) }}
        </div>
        <div v-else-if="goal" class="next-requirement">
          <TownIcon name="coin" />
          <template v-if="goal.cost"
            >{{ number(Math.min(town.coins, goal.cost)) }} / {{ number(goal.cost)
            }}<progress
              :value="Math.min(town.coins, goal.cost)"
              :max="goal.cost"
              :aria-label="t('Building materials')"
          /></template>
          <template v-else>{{ t('Free') }}</template>
        </div>
        <div v-else-if="project" class="next-requirement">
          <TownIcon name="mine" />{{ project.wins }} / {{ constructionRuns(project)
          }}<TownIcon name="arrow" /><img src="/art/rewards/builder-hammer.svg" alt="" />
        </div>
      </div>
      <div class="next-step-buttons">
        <button class="next-step-primary" @click="act">
          <TownIcon
            :name="ready ? 'check' : gate.available ? 'arrow' : canBuild ? 'home' : 'mine'"
          />{{
            t(ready ? 'Finish' : gate.available ? 'Next era' : canBuild ? 'Build' : 'Go mining')
          }}
        </button>
        <button
          v-if="ready || canBuild || gate.available"
          class="next-step-mine"
          @click="$emit('mine')"
        >
          <TownIcon name="mine" />{{ t('Mine') }}
        </button>
      </div>
    </div>
    <JourneyProgress />
  </section>
</template>
<script setup>
import { computed } from 'vue';
import { t, number } from '../../i18n';
import { BUILDINGS, BUILDING_BY_ID } from '../../data/town';
import { eraGate, plotInEra, eraBuildingLevel } from '../../game/town/TownEras';
import {
  nextGoal,
  constructionReady,
  constructionRuns,
  population,
  housingCapacity,
  visitorCapacity,
  waterCapacity,
  foodCapacity,
  happiness,
  upgradeOffer,
} from '../../game/town/TownRules';
import TownIcon from './TownIcon.vue';
import TownBuilding from './TownBuilding.vue';
import TownDefenseStatus from './TownDefenseStatus.vue';
import JourneyProgress from '../JourneyProgress.vue';
const props = defineProps({ town: Object, hammers: Number });
const emit = defineEmits(['select', 'inspect', 'mine', 'advance-era']);
const goal = computed(() => nextGoal(props.town));
const gate = computed(() => eraGate(props.town));
const readyProjects = computed(() => Object.values(props.town.projects).filter(constructionReady));
const ready = computed(() => readyProjects.value[0]);
const project = computed(() => Object.values(props.town.projects)[0]);
const place = computed(
  () => BUILDING_BY_ID[ready.value?.id ?? goal.value?.id ?? project.value?.id],
);
const preview = computed(() => ready.value ?? goal.value ?? project.value);
const previewStage = computed(() =>
  preview.value?.type === 'modernization'
    ? props.town.buildings[place.value.id]
    : preview.value?.stage + Number(preview.value === goal.value),
);
const previewEraLevel = computed(() => preview.value?.eraLevel ?? previewStage.value);
const canBuild = computed(
  () => goal.value?.available && (props.town.coins >= goal.value.cost || props.hammers > 0),
);
const eraProgress = computed(() =>
  BUILDINGS.filter((b) => plotInEra(props.town, b.id)).reduce(
    (progress, b) => {
      progress.total += props.town.era === 'frontier' ? b.upgrades.length : 3;
      progress.done += eraBuildingLevel(props.town, b.id);
      return progress;
    },
    { done: 0, total: 0 },
  ),
);
const needs = computed(() => {
  const town = props.town,
    demand = housingCapacity(town) + visitorCapacity(town);
  const serviceChoices = (kind) =>
    BUILDINGS.filter((b) => {
      const offer = upgradeOffer(town, b.id);
      return (
        (b.kind === kind ||
          b.effects?.[{ well: 'water', farm: 'food', home: 'housing' }[kind]] > 0) &&
        offer?.available &&
        (offer.type !== 'modernization' ||
          (b.id === 'well' && ['industrial', 'motor-age'].includes(town.era)) ||
          (b.id === 'farm' && town.era === 'motor-age'))
      );
    });
  const service = (kind) => {
    const choices = serviceChoices(kind);
    return (
      choices.sort((a, b) => upgradeOffer(town, a.id).cost - upgradeOffer(town, b.id).cost)[0]
        ?.id ?? kind
    );
  };
  return [
    {
      id: service('well'),
      icon: 'water',
      value: demand ? `${waterCapacity(town)}/${demand}` : waterCapacity(town),
      shortage: waterCapacity(town) < demand && serviceChoices('well').length > 0,
      label: t('Water: {capacity}/{demand}', { capacity: waterCapacity(town), demand }),
    },
    {
      id: service('farm'),
      icon: 'food',
      value: demand ? `${foodCapacity(town)}/${demand}` : foodCapacity(town),
      shortage: foodCapacity(town) < demand && serviceChoices('farm').length > 0,
      label: t('Food: {capacity}/{demand}', { capacity: foodCapacity(town), demand }),
    },
    {
      id: service('home'),
      icon: 'people',
      value: population(town),
      label: t('{count} people', { count: population(town) }),
    },
    {
      id: 'square',
      icon: 'happiness',
      value: `${happiness(town)}%`,
      label: t('Happiness: {value}%', { value: happiness(town) }),
    },
  ];
});
function act() {
  if (ready.value) emit('select', ready.value.id);
  else if (gate.value.available) emit('advance-era');
  else if (canBuild.value) emit('inspect', goal.value.id);
  else emit('mine');
}
</script>
<style scoped>
.village-next {
  flex: 0 0 auto;
  position: relative;
  z-index: 4;
  width: 100%;
  padding: 8px max(12px, calc((100% - 840px) / 2));
  background: #f4efdf;
  border-top: 1px solid #c6c3a6;
  color: #405448;
}
.village-needs-strip {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 9px;
  margin: -5px 0 3px;
}
.village-needs-strip button {
  display: flex;
  align-items: center;
  gap: 5px;
  min-height: 36px;
  padding: 2px 4px;
  border: 0;
  background: transparent;
  color: inherit;
  border-radius: 5px;
  font-size: 12px;
}
.village-needs-strip button.shortage {
  color: #8c601f;
  background: #f3dfb6;
}
.village-needs-strip svg {
  width: 19px;
  height: 19px;
}
.village-era-progress {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
}
.village-era-progress img {
  width: 25px;
  height: 25px;
}
progress {
  accent-color: #577856;
  height: 7px;
  width: 65px;
  border: 0;
  border-radius: 10px;
  overflow: hidden;
}
progress::-webkit-progress-bar {
  background: #d8d8c5;
}
progress::-webkit-progress-value {
  background: #577856;
}
.village-next-action {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 94px;
}
.next-building-art {
  flex-shrink: 0;
  position: relative;
  width: 100px;
  height: 85px;
  background: #e5e4cf;
  border: 0;
  border-radius: 12px;
  padding: 6px;
}
.next-building-art svg {
  width: 100%;
  height: 100%;
}
.next-ready-hammer {
  position: absolute;
  right: -3px;
  bottom: 0;
  width: 34px;
  height: 34px;
}
.next-compass {
  width: 64px;
  height: 64px;
}
.next-step-copy {
  flex: 1;
  min-width: 0;
}
.next-step-copy > small {
  display: block;
  font-size: 11px;
  margin-bottom: 3px;
}
.next-step-copy > strong {
  display: block;
  font-size: 19px;
  line-height: 1.15;
}
.next-requirement {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 6px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}
.next-requirement svg,
.next-requirement img {
  width: 18px;
  height: 18px;
}
.next-step-buttons {
  display: flex;
  gap: 8px;
}
.next-step-buttons button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 10px 14px;
  border-radius: 9px;
  font-size: 13px;
  font-weight: 700;
}
.next-step-buttons svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}
.next-step-primary {
  background: #456c50;
  border: 1px solid #36583f;
  color: #fffbe7;
  box-shadow: 0 3px #2c4835;
}
.is-ready .next-step-primary {
  background: #ecd18b;
  border-color: #b79950;
  color: #40523d;
  box-shadow: 0 3px #ac9049;
}
.next-step-mine {
  background: #e9e8d9;
  border: 1px solid #bec5af;
  color: #425840;
}
@media (max-width: 600px) {
  .village-next {
    padding: 5px 10px;
  }
  .village-needs-strip {
    gap: 2px;
    margin-top: 0;
  }
  .village-needs-strip button {
    font-size: 10px;
    min-height: 44px;
  }
  .village-era-progress progress {
    display: none;
  }
  .village-era-progress img {
    width: 21px;
    height: 21px;
  }
  .village-next-action {
    gap: 8px;
    min-height: 98px;
  }
  .next-building-art {
    width: 65px;
    height: 74px;
  }
  .next-step-copy > strong {
    font-size: 16px;
  }
  .next-step-copy > small {
    font-size: 10px;
  }
  .next-requirement {
    font-size: 10px;
  }
  .next-requirement progress {
    width: 45px;
  }
  .next-step-buttons {
    flex-direction: column;
    gap: 3px;
    max-width: 110px;
  }
  .next-step-buttons button {
    font-size: 11px;
    padding: 7px 9px;
  }
}
@media (max-height: 500px) and (min-width: 600px) {
  .village-next {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    column-gap: 18px;
  }
  .village-next-action {
    grid-column: 2;
    grid-row: 1 / 3;
    min-height: 90px;
  }
  .next-building-art {
    width: 65px;
    height: 68px;
  }
  .next-step-copy > strong {
    font-size: 15px;
  }
  .next-step-buttons {
    flex-direction: column;
    gap: 3px;
  }
  .next-step-buttons button {
    font-size: 11px;
    padding: 6px;
  }
}
</style>

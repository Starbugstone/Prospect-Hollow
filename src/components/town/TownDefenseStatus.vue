<template>
  <section
    class="village-defense"
    :class="{ approaching: forecast.soon && forecast.protection < 1 }"
    :aria-label="t('Village protection')"
  >
    <div class="defense-arrival">
      <TownIcon :name="forecast.protection === 1 ? 'shield' : fire ? 'fireStation' : 'rider'" />
      <span
        ><strong>{{
          t(
            fire
              ? forecast.kind === 'storm-cleanup'
                ? 'City response crew'
                : 'Fire brigade'
              : forecast.kind === 'cargo-theft'
                ? 'Freight watch'
                : forecast.active
                  ? 'Riders in town'
                  : forecast.soon
                    ? 'Riders nearby'
                    : 'Trail watch',
          )
        }}</strong>
        <small v-if="forecast.active">{{
          t('Coins at risk: {count}', { count: forecast.active.loss })
        }}</small>
        <small v-else-if="forecast.soon">{{
          t(forecast.runs === 1 ? 'After 1 puzzle' : 'After {count} puzzles', {
            count: forecast.runs,
          })
        }}</small>
        <small v-else>{{
          fire
            ? t(forecast.kind === 'storm-cleanup' ? 'Storm protection' : 'Workshop protection')
            : t('{count} riders', { count: forecast.riders })
        }}</small>
      </span>
    </div>
    <button
      v-for="id in fire ? ['fireStation'] : ['sheriff', 'bank']"
      :key="id"
      class="defense-service"
      @click="$emit('select', id)"
      :aria-label="
        t(
          fire
            ? '{building}: level {count} of {total}'
            : '{building}: {count} of {total} riders covered',
          {
            building: t(BUILDING_BY_ID[id].shortName),
            count: fire ? town.buildings[id] : Math.min(forecast.riders, town.buildings[id] * 2),
            total: fire ? 3 : forecast.riders,
          },
        )
      "
    >
      <TownIcon :name="id" />
      <span
        ><strong>{{ t(BUILDING_BY_ID[id].shortName) }}</strong>
        <span class="defense-slots" aria-hidden="true"
          ><i
            v-for="slot in fire ? 3 : forecast.riders / 2"
            :key="slot"
            :class="{ covered: town.buildings[id] >= slot }"
            >{{ town.buildings[id] >= slot ? '✓' : '·' }}</i
          ></span
        >
      </span>
    </button>
    <strong class="defense-total" :class="{ covered: forecast.protection === 1 }"
      >{{ Math.round(forecast.protection * 100) }}%<small>{{ t('Protected') }}</small></strong
    >
  </section>
</template>
<script setup>
import { civicIncident } from '../../data/townEvents';
import { computed } from 'vue';
import { t } from '../../i18n';
import { BUILDING_BY_ID } from '../../data/town';
import { raidForecast } from '../../game/town/TownRules';
import TownIcon from './TownIcon.vue';
const props = defineProps({ town: Object });
defineEmits(['select']);
const forecast = computed(() => raidForecast(props.town));
const fire = computed(() => civicIncident(forecast.value.kind));
</script>
<style scoped>
.village-defense {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 14px;
  border: 1px solid #c9cdb4;
  border-radius: 12px;
  background: #f7f5e9;
  color: #415447;
}
.village-defense.approaching {
  background: #fff0d0;
  border-color: #d3a85e;
}
.defense-arrival,
.defense-service {
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}
.village-defense svg {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}
.village-defense strong {
  display: block;
  font:
    700 12px/1.2 'Trebuchet MS',
    sans-serif;
}
.village-defense small {
  display: block;
  font:
    11px/1.3 'Trebuchet MS',
    sans-serif;
  margin-top: 3px;
}
.village-defense .defense-service {
  border: 0;
  border-radius: 7px;
  padding: 4px;
  min-height: 44px;
  background: transparent;
  color: inherit;
  text-align: left;
}
.defense-service:hover {
  background: #dfe8d6;
}
.defense-slots {
  display: flex;
  gap: 3px;
  margin-top: 4px;
}
.defense-slots i {
  display: grid;
  place-items: center;
  width: 13px;
  height: 12px;
  font: 900 10px sans-serif;
  border: 1px dashed #9a8b6e;
  border-radius: 3px;
  background: #e6dfd0;
}
.defense-slots i.covered {
  border: 1px solid #537454;
  background: #567b59;
  color: white;
}
.village-defense .defense-total {
  font-size: 21px;
  color: #916326;
  text-align: right;
}
.village-defense .defense-total.covered {
  color: #3e704d;
}
@media (max-width: 600px) {
  .village-defense {
    gap: 5px;
    padding: 6px 8px;
  }
  .village-defense svg {
    width: 22px;
    height: 22px;
  }
  .village-defense strong {
    font-size: 10px;
  }
  .village-defense small {
    font-size: 9px;
  }
  .defense-arrival,
  .defense-service {
    gap: 4px;
  }
  .defense-slots {
    gap: 2px;
  }
  .defense-slots i {
    width: 9px;
  }
  .village-defense .defense-total {
    font-size: 17px;
  }
}
@media (max-width: 360px) {
  .defense-service > svg {
    display: none;
  }
}
</style>

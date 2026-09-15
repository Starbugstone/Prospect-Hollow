<template>
  <section class="town-building-details" aria-labelledby="building-title">
    <div class="town-detail-title">
      <div>
        <p class="town-kicker">{{ t(building.purpose) }}</p>
        <h2 id="building-title">{{ t(building.name) }}</h2>
      </div>
      <span class="town-level-badge">{{
        t(town.era !== 'frontier' ? '{era} · Level {level} of {max}' : 'Level {level} / {max}', {
          era: t(ERA_BY_ID[town.era].label),
          level: eraBuildingLevel(town, id),
          max: town.era !== 'frontier' ? 3 : building.upgrades.length,
        })
      }}</span>
    </div>
    <div class="town-building-preview" :style="{ '--building-tint': building.color }">
      <svg viewBox="-160 -230 320 275" aria-hidden="true">
        <ellipse cy="9" rx="133" ry="26" fill="#a79d7040" />
        <TownSite
          v-if="project"
          :id="id"
          :stage="stage"
          :wins="constructionVisual(project)"
          :era="town.buildingEras[id]"
          :era-level="town.buildingEraLevels[id] || stage"
        />
        <TownBuilding
          v-else
          :id="id"
          :stage="offer && offer.type !== 'modernization' ? stage + 1 : stage"
          :era="offer?.targetEra ?? town.buildingEras[id]"
          :era-level="offer?.eraLevel ?? (offer ? stage + 1 : town.buildingEraLevels[id] || stage)"
        />
      </svg>
      <small>{{
        t(project ? 'Under construction' : offer ? 'WHEN THE WORK IS DONE' : building.stages[stage])
      }}</small>
    </div>
    <div v-if="offer || project" class="town-benefit-preview">
      <TownIcon :name="benefit.icon" /><span
        ><small>{{ t(benefit.label) }}</small
        ><strong
          >{{ benefit.before }}{{ benefit.suffix }} <TownIcon name="arrow" />
          <b>{{ benefit.after }}{{ benefit.suffix }}</b></strong
        ></span
      >
    </div>
    <div v-if="project" class="town-project-progress">
      <h3>
        {{ t(constructionReady(project) ? 'Ready to finish' : 'Your building is taking shape') }}
      </h3>
      <p>
        {{
          t('Construction: {wins} of {required} mining runs completed', {
            wins: Math.min(project.wins, constructionRuns(project)),
            required: constructionRuns(project),
          })
        }}
      </p>
      <button v-if="constructionReady(project)" class="town-primary" @click="$emit('finish')">
        <img src="/art/rewards/builder-hammer.svg" width="24" height="24" alt="" />
        {{ t('Finish construction') }}
      </button>
      <button v-else class="town-primary town-project-mine" @click="$emit('mine')">
        <TownIcon name="mine" />{{ t('Go mining') }} · {{ project.wins }}/{{
          constructionRuns(project)
        }}
        <TownIcon name="arrow" /><img
          src="/art/rewards/builder-hammer.svg"
          width="24"
          height="24"
          alt=""
        />
      </button>
      <progress
        :value="project.wins"
        :max="constructionRuns(project)"
        :aria-label="t('Construction progress')"
      />
      <details>
        <summary>{{ t('How construction works') }}</summary>
        <p>
          {{
            t(
              stage
                ? 'The building stays open during improvements. The new benefits arrive when the scaffolding comes down.'
                : 'Every completed puzzle adds the next part. Benefits arrive when the building is finished.',
            )
          }}
        </p>
        <p>
          {{
            t(
              'When construction is ready, tap its hammer icon in the town or use Finish construction on this card to open the building.',
            )
          }}
        </p>
      </details>
    </div>
    <div v-else-if="offer" class="town-detail-offer">
      <h3>
        {{
          t(offer.title, { building: t(building.name), name: t(offer.name), level: offer.eraLevel })
        }}
      </h3>
      <p>{{ t(offer.benefit) }}</p>
      <p v-if="offer.description">{{ t(offer.description) }}</p>
      <button
        class="town-primary town-purchase"
        :disabled="!!offer.reason"
        @click="$emit('build', offer.stage)"
      >
        <span
          ><TownIcon name="home" />{{
            t(
              offer.type === 'modernization'
                ? 'Start modernization'
                : stage
                  ? 'Start improvement'
                  : 'Start building',
            )
          }}</span
        >
        <span><TownIcon v-if="offer.cost" name="coin" />{{ t(offer.cost || 'Free') }}</span>
      </button>
      <p class="town-purchase-hint">
        <TownIcon :name="offer.runs === 0 ? 'check' : 'mine'" />
        {{
          t(
            offer.reason ||
              (offer.runs === 0
                ? 'Ready immediately'
                : offer.runs === 1
                  ? 'Ready after one completed puzzle'
                  : t('Ready after {count} normal puzzles', { count: offer.runs })),
          )
        }}
      </p>
      <template v-if="plotUnlocked(town, id) && offer.cost > 0">
        <button
          class="town-secondary builder-hammer-action"
          :disabled="!hammers || !offer.available"
          @click="$emit('hammer', offer.stage)"
        >
          <img src="/art/rewards/builder-hammer.svg" alt="" />
          {{ t('Build instantly for free · 1 builder hammer') }}
        </button>
        <small>{{ t('{count} builder hammers available', { count: hammers }) }}</small>
      </template>
      <button v-if="requirement" class="town-secondary" @click="$emit('select', requirement.id)">
        {{ t('Go to {building}', { building: t(BUILDING_BY_ID[requirement.id].shortName) }) }} →
      </button>
    </div>
    <p v-else class="town-restored-note">
      <TownIcon name="check" />{{ t(building.upgrades.at(-1).benefit) }}
    </p>
    <p
      v-if="
        id === 'well' &&
        town.buildingEras.well === 'industrial' &&
        town.buildingEraLevels.well === 3
      "
      class="town-service"
    >
      {{ t('Municipal waterworks complete: twenty additional water places for the town.') }}
    </p>
    <p v-if="stage && ['saloon', 'blacksmith'].includes(id)" class="town-service">
      {{
        cooldownSeconds
          ? t('Collect again in {seconds}s. Production and accumulation continue.', {
              seconds: cooldownSeconds,
            })
          : t(
              'After collecting, wait 30 seconds before collecting again. Tap again during this time to open the building card. Production and accumulation continue.',
            )
      }}
    </p>
    <section v-if="id === 'blacksmith' && stage" class="town-service">
      <h3>{{ t('Forge Charge: {count}/1', { count: town.forge.charge }) }}</h3>
      <p>
        {{
          t('Normal puzzles: {count}/{required}', {
            count: town.forge.progress,
            required: forgeProductionRuns(stage),
          })
        }}
      </p>
      <p>
        {{
          t(
            'The blacksmith holds one TNT. Tap the blacksmith or its TNT icon in the town to collect it and restart production. Opening this card does not collect it. Upgrades shorten the cycle and keep your progress. If your armory is full, it waits here.',
          )
        }}
      </p>
    </section>
    <section v-if="id === 'saloon' && stage" class="town-service">
      <h3>{{ t('Stored earnings: {coins} coins', { coins: town.income.stored }) }}</h3>
      <p>
        {{
          t(
            'Tap the saloon or its coin icon in the town to collect stored earnings. Opening this card does not collect them. Storage holds up to eight hours of income.',
          )
        }}
      </p>
      <h3>{{ t('Saloon · {rate} coins/hour', { rate: saloonIncomeRate(town) }) }}</h3>
      <p>
        {{
          t('{residents} residents + {visitors} visitors · Happiness bonus: {bonus}%', {
            residents: residentPopulation(town),
            visitors: visitorPopulation(town),
            bonus: saloonHappinessBonus(town),
          })
        }}
      </p>
      <small>{{ t('Up to 8 hours of income saved while away.') }}</small>
      <small v-if="lastIncome">{{
        t('Last earnings: +{coins} coins', { coins: lastIncome })
      }}</small>
    </section>
    <section v-if="id === 'stable' || id === 'museum'" class="town-service">
      <h3>{{ t('{count} visitors in town', { count: visitorPopulation(town) }) }}</h3>
      <p>
        {{
          t(
            'Stables and museum galleries attract visitors. Spare food and water let them stay, and they spend coins at the saloon.',
          )
        }}
      </p>
      <small>{{ t('Visitor capacity: {count}', { count: visitorCapacity(town) }) }}</small>
    </section>
    <section v-if="id === 'square'" class="town-service">
      <div class="town-era-service">
        <h3>{{ t('The next era begins here') }}</h3>
        <p>
          {{
            t(
              'Complete every building in this era, then tap the compass at the town center to begin the next chapter. No mine progress is required.',
            )
          }}
        </p>
        <p v-if="eraGate(town).pendingRaid">
          {{ t('Finish the current raid before beginning a new era.') }}
        </p>
        <button v-if="eraGate(town).available" class="town-primary" @click="$emit('advance-era')">
          <img src="/art/rewards/era-compass.svg" width="28" height="28" alt="" />
          {{ t('Advance to the next era') }}
        </button>
        <p v-else-if="eraGate(town).townComplete && !eraGate(town).next?.enabled">
          {{ t('This era is complete. More chapters of Prospect Hollow are still to come.') }}
        </p>
      </div>
      <h3>{{ t('Happiness: {value}%', { value: happiness(town) }) }}</h3>
      <p>
        {{
          t(
            'Food and water contribute up to 40 happiness points. Each square level adds 8 and each saloon level adds 2. The museum adds up to 10 and the school up to 5. Each happiness point boosts saloon income by 1.25%.',
          )
        }}
      </p>
      <p>
        {{
          t(
            'At level 4, the town square gains a warning bell. During a raid, tap the square, its bell icon, or the raid bell button to halve the remaining coin loss. The bell works once per raid and is only needed when coins are at risk.',
          )
        }}
      </p>
      <button v-if="canRingTownBell(town)" class="town-primary" @click="$emit('ring-bell')">
        <TownIcon name="bell" />{{ t('Ring town bell · halve the loss') }}
      </button>
    </section>
    <section v-if="id === 'sheriff' || id === 'bank'" class="town-service">
      <TownDefenseStatus :town="town" @select="$emit('select', $event)" />
      <p v-if="id === 'sheriff'">
        {{
          t(
            'Stop a raid completely with the sheriff and bank to earn 10 coins per captured bandit. The bounty is paid once when the raid ends. An empty wallet alone does not earn a bounty.',
          )
        }}
      </p>
      <h3>{{ t('Keep pace with the town') }}</h3>
      <p>
        {{
          t('Gang: {gang} riders · Savings protected: {protection}%', {
            gang: gangSize(town),
            protection: Math.round(raidProtection(town) * 100),
          })
        }}
      </p>
      <small>{{
        t(
          'The bank and sheriff each protect up to half the coins at risk. At level 5, both together stop all raid losses. Finish their construction during a raid to apply the new protection immediately. Your last 50 coins are always safe.',
        )
      }}</small>
    </section>
    <TownShop v-if="id === 'shop' && stage" />
    <section v-if="id === 'museum' && stage" class="town-service">
      <button class="town-primary" @click="$emit('museum')">
        {{ t('Visit the museum') }} <TownIcon name="arrow" />
      </button>
    </section>
    <details v-if="id === 'armory'" class="town-service" open>
      <summary>{{ t('Capacity: {count} of each puzzle bonus', { count: bonusLimit }) }}</summary>
      <ul class="armory-inventory">
        <li v-for="power in powers" :key="power.id">
          <img :src="`/art/powers/${power.id}.svg`" alt="" /><span>{{ t(power.label) }}</span
          ><strong>{{ power.quantity }}/{{ bonusLimit }}</strong>
        </li>
      </ul>
    </details>
    <button
      v-if="!project && offer?.reason && plotUnlocked(town, id)"
      class="town-secondary town-detail-mine"
      @click="$emit('mine')"
    >
      <TownIcon name="mine" />{{ t('Go mining') }} →
    </button>
  </section>
</template>
<script setup>
import { ERA_BY_ID } from '../../data/eras';
import { computed } from 'vue';
import { t } from '../../i18n';
import { BUILDING_BY_ID } from '../../data/town';
import { eraGate, eraBuildingLevel } from '../../game/town/TownEras';
import { forgeProductionRuns } from '../../data/eras';
import {
  upgradeOffer,
  constructionRuns,
  constructionReady,
  constructionVisual,
  plotUnlocked,
  plotRequirement,
  saloonIncomeRate,
  saloonHappinessBonus,
  residentPopulation,
  visitorPopulation,
  visitorCapacity,
  happiness,
  gangSize,
  raidProtection,
  canRingTownBell,
  collectionCooldownRemaining,
} from '../../game/town/TownRules';
import TownBuilding from './TownBuilding.vue';
import TownShop from './TownShop.vue';
import TownSite from './TownSite.vue';
import TownIcon from './TownIcon.vue';
import TownDefenseStatus from './TownDefenseStatus.vue';
import { buildingBenefit } from '../../game/town/TownBenefits';
const props = defineProps({
  id: String,
  town: Object,
  hammers: Number,
  bonusLimit: Number,
  powers: Array,
  lastIncome: Number,
  now: { type: Number, default: Date.now },
});
defineEmits(['build', 'hammer', 'finish', 'ring-bell', 'advance-era', 'select', 'museum', 'mine']);
const cooldownSeconds = computed(() =>
  Math.ceil(collectionCooldownRemaining(props.town, props.id, props.now) / 1000),
);
const building = computed(() => BUILDING_BY_ID[props.id]);
const requirement = computed(() => plotRequirement(props.town, props.id));
const stage = computed(() => props.town.buildings[props.id]);
const project = computed(() => props.town.projects[props.id]);
const offer = computed(() => upgradeOffer(props.town, props.id));
const benefit = computed(() =>
  buildingBenefit(
    props.town,
    props.id,
    project.value?.stage ?? stage.value + 1,
    (project.value ?? offer.value)?.type === 'modernization'
      ? (project.value ?? offer.value)
      : false,
  ),
);
</script>
<style scoped>
.town-benefit-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 12px;
  margin-bottom: 14px;
  background: #e9edd8;
  border: 1px solid #bdc7a2;
  border-radius: 12px;
  color: #445b43;
}
.town-benefit-preview > svg {
  width: 34px;
  height: 34px;
}
.town-benefit-preview small {
  display: block;
  margin-bottom: 4px;
  font-size: 12px;
}
.town-benefit-preview strong {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 22px;
}
.town-benefit-preview strong svg {
  width: 23px;
  height: 23px;
}
.town-benefit-preview b {
  color: #2f7248;
}
.town-project-mine,
.town-purchase-hint,
.town-purchase > span:first-child {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}
.town-project-mine svg,
.town-purchase-hint svg,
.town-purchase > span:first-child svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
.town-project-progress details {
  margin-top: 12px;
  font-size: 12px;
}
.town-project-progress summary {
  cursor: pointer;
  min-height: 44px;
  padding-block: 12px;
}
</style>

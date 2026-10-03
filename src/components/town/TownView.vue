<template>
  <main class="town-view" :style="{ '--town-tab-height': `${tabHeight}px` }">
    <section class="town-world" :aria-label="t('Your town')">
      <div
        ref="mapFrame"
        class="town-map-frame"
        :class="{
          'town-has-raid': activeRaid,
          'town-fullscreen': fullscreen,
          'town-labels-hidden': !settings.showVillageLabels,
          'town-in-cinematic': town.transition?.pending || openingPresentation,
        }"
      >
        <div v-if="!activeRaid" class="town-map-corner">
          <SaveStatusPill v-if="cloudAccount" />
        </div>
        <div v-if="!activeRaid" class="town-map-status" :aria-label="t('Town savings')">
          <TownIcon name="coin" /><strong>{{ number(town.coins) }}</strong>
          <template v-if="campaign.builderHammers > 0">
            <i aria-hidden="true"></i
            ><img
              src="/art/rewards/builder-hammer.svg"
              :alt="t('Builder hammers')"
              :title="
                t('Builder hammers: {count}/{cap}', {
                  count: campaign.builderHammers,
                  cap: HAMMER_CAPACITY,
                })
              "
            /><strong>{{ campaign.builderHammers }}</strong>
          </template>
        </div>
        <p
          v-if="(campaign.saveWarning || campaign.inventoryNotice) && !activeRaid"
          role="status"
          class="town-map-notice"
        >
          {{ t(campaign.saveWarning || campaign.inventoryNotice) }}
        </p>
        <div v-if="activeRaid" class="town-raid-banner" role="status" aria-live="polite">
          <span class="town-kicker"
            >{{ t(eventHeading(activeRaid))
            }}<template v-if="eventKind(activeRaid) === 'bandits'">
              · {{ t('{count} riders', { count: activeRaid.gangSize }) }}</template
            ></span
          >
          <strong>{{ t(raidPhase) }}</strong>
          <TownDefenseStatus class="raid-visual-status" :town="town" @select="inspectBuilding" />
          <p>
            {{
              t(
                raidPhase === 'The raid has passed'
                  ? banditStory.text
                  : eventKind(activeRaid) === 'bandits'
                    ? 'A little trouble on the trail. Your buildings and last 50 coins are safe.'
                    : 'Watch the town respond, or skip to the saved outcome.',
              )
            }}
          </p>
          <p v-if="activeRaid.bellRung" class="town-bell-feedback">
            {{ t('Bell rung · remaining loss: {coins} coins', { coins: activeRaid.loss }) }}
          </p>
          <div v-if="readyRaidDefenses.length || canRingTownBell(town)" class="town-raid-defenses">
            <button
              v-for="id in readyRaidDefenses"
              :key="id"
              class="town-secondary"
              @click="selectBuilding(id)"
            >
              {{ t('Finish {building}', { building: t(BUILDING_BY_ID[id].shortName) }) }}
            </button>
            <button v-if="canRingTownBell(town)" class="town-secondary" @click="ringBell">
              <TownIcon name="bell" />{{ t('Ring town bell · halve the loss') }}
            </button>
          </div>
          <div class="town-raid-actions">
            <div v-if="fullscreen" class="town-map-wallet" :aria-label="t('Town savings')">
              <TownIcon name="coin" /><strong>{{ number(town.coins) }}</strong>
            </div>
            <button class="town-secondary" @click="finishRaid">
              {{ t(raidPhase === 'The raid has passed' ? 'Continue' : 'Skip animation') }}
            </button>
          </div>
        </div>
        <TownVisitorNotice
          :notice="visitorNotice"
          @dismiss="dismissVisitorNotice"
          @find="findVisitor"
        />
        <TownScene
          ref="townScene"
          :active="active"
          :town="sceneTown"
          :live-visitors="liveVisitors"
          :live-visitor-town-id="visitorTownId"
          :cinematic="!!town.transition?.pending"
          @cinematic-ready="eraReady = true"
          @cinematic-unavailable="eraFallback = true"
          :presentation="openingPresentation"
          @presentation-ready="presentationReady = true"
          @presentation-unavailable="presentationFallback = true"
          :forge-collectible="forgeCollectible"
          :builder-hammers="campaign.builderHammers"
          :selected="selected"
          :reduced-motion="settings.reducedMotion"
          :paused="
            !active ||
            paused ||
            settings.isSettingsOpen ||
            mineEntryPending ||
            museumOpen ||
            !!dialogMode ||
            firstLightsOpen ||
            tourOpen
          "
          :next-level="campaign.nextLevel"
          :raid="activeRaid"
          :raid-defense-ids="readyRaidDefenses"
          :construction="construction"
          :need-chips="needs.demand && !activeRaid ? needChips : []"
          @select="selectBuilding"
          @inspect="inspectBuilding"
          @mine="goMining"
          @raid-phase="raidPhase = $event"
          @raid-cue="playRaidCue"
          @raid-complete="finishRaid"
          @camera-distance="cameraDistance = $event"
          @vip-spend="collectVipSpending"
          @guest-vip="campaign.markGuestSeen"
        />
        <TownResourceCollection
          v-if="collection"
          :key="collection.serial"
          :amount="collection.amount"
          :resource="collection.resource"
          :origin="collection.origin"
          :reduced-motion="settings.reducedMotion"
          @cue="game.audioManager?.playArcadeCue?.($event.name, $event.index)"
          @close="collection = null"
        />
        <TownResourceCollection
          v-for="reward in vipCollections"
          :key="`vip-${reward.serial}`"
          :amount="reward.amount"
          resource="vip-coins"
          :origin="reward.origin"
          :reduced-motion="settings.reducedMotion"
          @cue="game.audioManager?.playArcadeCue?.($event.name, $event.index)"
          @close="vipCollections = vipCollections.filter((item) => item.serial !== reward.serial)"
        />
        <TownRaidNotice
          v-if="raidNotice"
          :key="raidNotice.id"
          :coins="raidNotice.loss"
          :kind="eventKind(raidNotice)"
          :bounty="raidNotice.bounty ?? 0"
          :defended="raidNotice.outcome === 'protected'"
          :reduced-motion="settings.reducedMotion"
          @protect="
            inspectBuilding(
              civicIncident(eventKind(raidNotice))
                ? 'fireStation'
                : town.buildings.sheriff <= town.buildings.bank
                  ? 'sheriff'
                  : 'bank',
            );
            raidNotice = null;
          "
          @close="raidNotice = null"
        />
        <TownTabBar
          v-if="!activeRaid && !town.transition?.pending && !openingPresentation"
          :current="currentTab"
          :build-count="directoryPlots.length"
          :build-nudge="buildNudge"
          :mine-label="mineLabel"
          @select="openTab"
          @height="tabHeight = $event"
        />
        <span class="town-sr-only" role="status">{{ t(announcement) }}</span>
      </div>
    </section>
    <TownDialog
      v-if="active && dialogMode"
      :key="tabSheet ? 'sheet' : 'dialog'"
      :sheet="tabSheet"
      :title="
        t(
          dialogMode === 'projects'
            ? 'Town projects'
            : dialogMode === 'story'
              ? 'Village story'
              : dialogMode === 'build'
                ? t('Available plots · {built}/{total} built', {
                    built,
                    total: currentEraPlots.length,
                  })
                : dialogMode === 'more'
                  ? 'More'
                  : 'Your town',
        )
      "
      close-label="Close building details"
      @close="closeDialog"
    >
      <TownProjects v-if="dialogMode === 'projects'" :town="town" @inspect="inspectBuilding" />
      <template v-else-if="dialogMode === 'story'">
        <TownGuestbook
          :town-id="visitorTownId"
          :snapshot="visitorSnapshot"
          :error="visitorError"
          :era="town.era"
          can-find
          @find="findVisitor"
        />
        <section class="town-story-stats" :aria-label="t('Village overview')">
          <h2>{{ t('Village overview') }}</h2>
          <dl>
            <div v-for="stat in villageStats" :key="stat.id" :data-town-stat="stat.id">
              <dt>
                <img
                  v-if="stat.id === 'hammers'"
                  src="/art/rewards/builder-hammer.svg"
                  alt=""
                /><TownIcon v-else :name="stat.icon" />{{ stat.label }}
              </dt>
              <dd>
                <strong>{{ stat.value }}</strong
                ><small v-if="stat.detail">{{ stat.detail }}</small>
                <meter
                  v-if="stat.id === 'happiness'"
                  :value="needs.happiness"
                  min="0"
                  max="100"
                  :aria-label="t('Village happiness')"
                />
              </dd>
            </div>
          </dl>
        </section>
        <div class="town-journal-content">
          <p class="town-kicker">{{ t(moment.speaker) }}</p>
          <h2>{{ t(moment.title) }}</h2>
          <p>{{ t(moment.text) }}</p>
          <section v-if="residents" class="town-raid-report">
            <div>
              <h3>
                {{
                  t(
                    event
                      ? banditStory.title
                      : town.era === 'frontier'
                        ? 'Eyes on the dusty trail'
                        : eventHeading({ kind: eraEventKind(town.era) }),
                  )
                }}
              </h3>
              <p>
                {{
                  t(
                    event
                      ? banditStory.text
                      : civicIncident(eraEventKind(town.era))
                        ? 'Workshop fires can cost cleanup coins. Upgrade the fire station; no building can be destroyed.'
                        : town.era === 'river-rail'
                          ? 'Cargo thieves may visit the freight yard. The police and bank protect your savings.'
                          : 'As the town grows, larger gangs may ride in. Build the bank and sheriff to protect your savings.',
                  )
                }}
              </p>
              <small>{{
                t(
                  town.era === 'frontier'
                    ? 'Gang: {gang} riders · Savings protected: {protection}%'
                    : 'Savings protected: {protection}%',
                  {
                    gang: gangSize(town),
                    protection: Math.round(raidProtection(town) * 100),
                  },
                )
              }}</small>
              <p>
                {{
                  t(
                    'Events arrive unpredictably, {min}–{max} completed puzzles apart. Never while you are away. Your last 50 coins are always safe.',
                    { min: raidIntervalRange(town)[0], max: raidIntervalRange(town)[1] },
                  )
                }}
              </p>
            </div>
            <button
              v-if="event"
              class="town-secondary"
              :disabled="!!activeRaid"
              @click="replayRaid"
            >
              {{ t('Watch the last event again') }}
            </button>
            <button
              class="town-secondary"
              @click="
                inspectBuilding(civicIncident(eraEventKind(town.era)) ? 'fireStation' : 'sheriff')
              "
            >
              {{
                t(
                  civicIncident(eraEventKind(town.era))
                    ? 'Visit the fire station'
                    : 'Visit the sheriff',
                )
              }}
            </button>
          </section>
        </div>
      </template>
      <template v-else-if="dialogMode === 'build'">
        <p class="town-kicker">
          {{ t(ERA_BY_ID[town.era].label) }} · {{ t('Current era available') }}
        </p>
        <p v-if="!directoryPlots.length" role="status">
          {{
            t('No purchases available. Earn coins in the mine or finish your current construction.')
          }}
        </p>
        <section class="town-building-list" :aria-label="t('Available buildings')">
          <button v-for="place in directoryPlots" :key="place.id" @click="selectParcel(place.id)">
            <span class="building-list-dot" :style="{ background: place.color }"></span>
            <span
              >{{ t(place.shortName) }}<small>{{ plotStatus(place) }}</small></span
            >
            <span v-if="place.ready" class="town-plot-price town-plot-ready">
              ✦ {{ t('Ready to finish') }}
            </span>
            <span
              v-else
              class="town-plot-price"
              :aria-label="
                t(town.buildings[place.id] ? 'Upgrade: {coins} coins' : 'Build: {coins} coins', {
                  coins: place.offer.cost,
                })
              "
            >
              <TownIcon v-if="place.offer.cost" name="coin" />
              {{ place.offer.cost ? number(place.offer.cost) : t('Free') }}
              <span
                v-if="town.coins < place.offer.cost"
                class="town-plot-hammer"
                :aria-label="t('1 builder hammer')"
              >
                <img src="/art/rewards/builder-hammer.svg" alt="" /> 1
              </span>
            </span>
          </button>
        </section>
        <TownNextStep
          class="town-build-next"
          :town="town"
          :hammers="campaign.builderHammers"
          @select="selectBuilding"
          @inspect="inspectBuilding"
          @build-free="buildFree"
          @mine="goMining"
          @advance-era="beginEra"
        />
        <p v-if="town.era === 'industrial'" class="town-service">
          {{
            t(
              'First Lights: finish every new building and modernize every existing plot to complete this era. Build the power house to unlock electric modernization.',
            )
          }}
        </p>
        <p v-if="town.era === 'frontier'">
          {{ t('The east-bank district and railway station open in the River & Rail era.') }}
        </p>
        <p class="town-directory-hint">
          {{
            t(
              'Select a row to finish construction or buy with the coins or hammer shown. This list stays open. Collect resources by tapping buildings in the town.',
            )
          }}
        </p>
        <p class="town-directory-hint">
          {{
            t(
              'Finish upgrading each well, farm or house to level 2 to unlock the next plot of its type. Farm II must reach level 2 before Farm III, and the same rule applies to extra houses. Other buildings have one plot each.',
            )
          }}
        </p>
        <p class="town-service">
          {{
            t(
              isCityEra(town.era)
                ? 'Every city building has 3 levels. Existing services stay open during modernization.'
                : town.era === 'motor-age'
                  ? 'Every Motor Age building has 3 levels. Each construction takes at most 2 mining runs.'
                  : town.era === 'industrial'
                    ? 'Every Industrial building has 3 levels. Finish all upgrades to complete the era.'
                    : town.era === 'river-rail'
                      ? 'Every River & Rail building has 3 levels. Each construction takes at most 2 mining runs.'
                      : 'Supporting buildings finish at level 3 with their full benefits. The town square, sheriff, bank, saloon and blacksmith have 5 levels.',
            )
          }}
        </p>
        <details class="town-service">
          <summary>{{ t('All current-era plots') }}</summary>
          <section class="town-building-list" :aria-label="t('All current-era plots')">
            <button
              v-for="place in currentEraPlots"
              :key="place.id"
              @click="
                constructionReady(town.projects[place.id])
                  ? finishBuilding(place.id, true)
                  : inspectBuilding(place.id)
              "
            >
              <span>{{ t(place.shortName) }}</span>
              <small>{{
                t(
                  constructionReady(town.projects[place.id])
                    ? 'Ready to finish'
                    : town.projects[place.id]
                      ? 'Under construction'
                      : !upgradeOffer(town, place.id)
                        ? 'Current era complete'
                        : plotStatus(place),
                )
              }}</small>
            </button>
          </section>
        </details>
      </template>
      <TownMoreMenu
        v-else-if="dialogMode === 'more'"
        :can-replay="campaign.canReplay"
        :shared-towns="!!cloudAccount?.signedIn.value"
        :muted="muted"
        @projects="dialogMode = 'projects'"
        @museum="visitMuseum"
        @supplies="inspectBuilding('armory')"
        @shared="openSharedTowns"
        @tour="openTour"
        @settings="openSettings"
        @mute="settings.toggleMute()"
        @home="leaveForHome"
      />
      <TownBuildingDetails
        v-else
        :key="selected"
        :id="selected"
        :town="town"
        :hammers="campaign.builderHammers"
        :bonus-limit="campaign.bonusLimit"
        :powers="campaign.powers"
        :last-income="campaign.lastSaloonIncome"
        @build="startWork"
        @hammer="useHammer"
        @finish="finishBuilding(selected)"
        @ring-bell="ringBell"
        @advance-era="beginEra"
        @select="inspectBuilding"
        @museum="visitMuseum"
        @mine="goMining"
      />
    </TownDialog>
    <TownTour
      v-if="active && tourOpen"
      :level="campaign.nextLevel"
      :era="campaign.town.era"
      @close="finishTour"
      @build="
        finishTour();
        selectBuilding(goal?.id ?? 'well');
      "
    />
    <TownMuseum
      v-if="active && museumOpen && campaign.canReplay"
      @close="museumOpen = false"
      @replay="$emit('replay', $event)"
      @continuous="$emit('continuous', $event)"
    />
    <TownDialog
      v-if="firstLightsOpen"
      :title="t('First Lights in Prospect Hollow')"
      close-label="Continue building"
      @close="campaign.acknowledgeFirstLights()"
    >
      <div class="town-first-lights">
        <svg viewBox="0 0 320 145" aria-hidden="true">
          <rect width="320" height="145" rx="16" fill="#294c49" />
          <path d="M0 116H320" stroke="#9aa88b" stroke-width="3" />
          <g v-for="x in [60, 160, 260]" :key="x" :transform="`translate(${x} 0)`">
            <circle cy="49" r="30" fill="#f7d782" opacity=".15" />
            <path d="M0 116V57" stroke="#c9c7a3" stroke-width="5" />
            <circle cy="47" r="12" fill="#ffecae" />
          </g>
        </svg>
        <h2>{{ t('The lights are on.') }}</h2>
        <p>
          {{
            t(
              'From the fountain to the station, warm electric globes welcome the evening. Your power house is ready, and every landmark can now take its next step.',
            )
          }}
        </p>
        <p>
          {{ t('Electricity needs no fuel or upkeep. The town stays bright whenever you return.') }}
        </p>
        <button class="town-primary" @click="campaign.acknowledgeFirstLights()">
          {{ t('Continue building') }}
        </button>
      </div>
    </TownDialog>
    <TownPresentationCinematic
      v-if="active && openingPresentation && presentationReady"
      :key="openingPresentation.id"
      :definition="openingPresentation"
      :ready="presentationReady"
      :reduced-motion="settings.reducedMotion || presentationFallback"
      :paused="paused || settings.isSettingsOpen || mineEntryPending"
      @frame="townScene?.presentationFrame($event)"
      @complete="completePresentation"
    />
    <TownEraCinematic
      v-if="active && town.transition?.pending"
      :era-id="town.era"
      :ready="eraReady"
      :paused="paused || settings.isSettingsOpen || mineEntryPending"
      :reduced-motion="settings.reducedMotion || eraFallback"
      @reveal="eraRevealed = true"
      @frame="townScene?.cinematicFrame($event)"
      @complete="completeEraCinematic"
      @sound="playEraSound"
      @silence="stopEraSound"
    />
  </main>
</template>
<script setup>
import { performanceMark } from '../../game/PresentationWork';
import { isCityEra } from '../../data/city';
import TownProjects from './TownProjects.vue';
import TownGuestbook from './TownGuestbook.vue';
import TownVisitorNotice from './TownVisitorNotice.vue';
import { useTownVisitors } from '../../composables/useTownVisitors';
import TownPresentationCinematic from './TownPresentationCinematic.vue';
import { pendingPresentation } from '../../data/townPresentations';

import { motorTraffic, modernTransport } from '../../game/town/TownEvolution';
import { civicIncident } from '../../data/townEvents';
import { computed, inject, nextTick, onBeforeUnmount, onMounted, provide, ref, watch } from 'vue';
import { t, number } from '../../i18n';
import { BUILDINGS, BUILDING_BY_ID, BANDIT_EVENT, INITIAL_STORY } from '../../data/town';
import {
  eventKind,
  eraEventKind,
  eventHeading,
  incidentStory,
  CARETAKER,
  incidentPhase,
} from '../../data/townEvents';
import { ERA_BY_ID } from '../../data/eras';
import { eraGate, plotInEra, eraBuildingLevel } from '../../game/town/TownEras';
import {
  needsReport,
  nextGoal,
  upgradeOffer,
  availableParcels,
  constructionReady,
  saloonIncomeRate,
  saloonHappinessBonus,
  canRingTownBell,
  gangSize,
  raidProtection,
  raidIntervalRange,
} from '../../game/town/TownRules';
import { visitorShare } from '../../game/town/TownNeeds';
import { useGameStore } from '../../stores/gameStore';
import { useCampaignStore } from '../../stores/campaignStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { HAMMER_CAPACITY } from '../../data/rewards';
import { LEVEL_COUNT } from '../../data/campaign';
import TownMuseum from './TownMuseum.vue';
import TownTour from './TownTour.vue';
import SaveStatusPill from '../SaveStatusPill.vue';
import { useTownAudio } from '../../composables/useTownAudio';
import TownScene from './TownScene.vue';
import TownEraCinematic from './TownEraCinematic.vue';
import TownDialog from './TownDialog.vue';
import TownBuildingDetails from './TownBuildingDetails.vue';
import TownIcon from './TownIcon.vue';
import TownRaidNotice from './TownRaidNotice.vue';
import TownResourceCollection from './TownResourceCollection.vue';
import TownNextStep from './TownNextStep.vue';
import TownTabBar from './TownTabBar.vue';
import TownMoreMenu from './TownMoreMenu.vue';
import TownDefenseStatus from './TownDefenseStatus.vue';

const props = defineProps({
  mineEntryPending: Boolean,
  openMuseum: Boolean,
  active: { type: Boolean, default: true },
});
const emit = defineEmits(['mine', 'replay', 'continuous', 'museum-change', 'home']);
const campaign = useCampaignStore(),
  settings = useSettingsStore();
// Provided by CloudRoot; absent when the village renders without account support.
const cloudAccount = inject('cloudAccount', null);
const game = useGameStore();
const town = computed(() => campaign.town);
const {
  townId: visitorTownId,
  snapshot: visitorSnapshot,
  error: visitorError,
  present: liveVisitors,
  notice: visitorNotice,
  dismissNotice: dismissVisitorNotice,
  enqueue: enqueueVisitorNotice,
} = useTownVisitors(() => props.active, {
  collectSaloon: (at) => (campaign.readOnly ? null : campaign.collectSaloonForVisitor(at)),
});
async function findVisitor(id) {
  closeDialog();
  dismissVisitorNotice();
  await nextTick();
  if (!townScene.value?.findVisitor(id)) enqueueVisitorNotice([{ kind: 'unavailable' }]);
}
const tourOpen = ref(false),
  // The village always fills the screen while it is the active view.
  fullscreen = ref(false),
  mapFrame = ref(null);
let previousOverflow;
function finishTour() {
  tourOpen.value = false;
  campaign.finishTownTour();
}
watch(fullscreen, (open) => {
  if (open) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  } else document.body.style.overflow = previousOverflow ?? '';
});

// The tab bar: Village, Build (available plots), Mine, Story and More.
const currentTab = computed(
  () =>
    ({ build: 'build', story: 'story', more: 'more', projects: 'more' })[dialogMode.value] ??
    'village',
);
const mineLabel = computed(() =>
  campaign.completedCount < LEVEL_COUNT
    ? t('Mine · {level}', { level: campaign.nextLevel })
    : t('Museum'),
);
// New players and finished constructions are pointed to Build.
const buildNudge = computed(
  () =>
    !town.value.tourSeen ||
    !Object.values(town.value.buildings).some(Boolean) ||
    Object.values(town.value.projects).some(constructionReady),
);
const muted = computed(() => settings.musicVolume === 0 && settings.sfxVolume === 0);
// While the tab bar shows, every village panel opens as a sheet above it, so the
// tabs keep working; during raids and cinematics panels are modal.
const tabHeight = ref(0);
const tabSheet = computed(() => tabHeight.value > 0);
function openTab(tab) {
  if (tab === 'mine') goMining();
  else if (tab !== 'village') {
    museumOpen.value = false;
    dialogMode.value = tab;
    // Sheets share one panel; each tab starts at its top.
    nextTick(() => document.querySelector('.town-dialog')?.scrollTo({ top: 0 }));
  } else if (dialogMode.value || museumOpen.value) {
    // Village closes whatever is open; on the map it brings the camera home.
    closeDialog();
    museumOpen.value = false;
  } else townScene.value?.resetView();
}
function openTour() {
  closeDialog();
  tourOpen.value = true;
}
function openSettings() {
  closeDialog();
  settings.toggleSettings(true);
}
function openSharedTowns() {
  closeDialog();
  cloudAccount?.openCommunity();
}
function leaveForHome() {
  closeDialog();
  emit('home');
}

const needs = computed(() => needsReport(town.value));
// Happy visitors still stay away while the town has no spare water or food.
const supplyLimitsVisitors = computed(
  () =>
    needs.value.visitors <
    Math.floor(needs.value.visitorPlaces * visitorShare(needs.value.happiness)),
);
const residents = computed(() => needs.value.residents);
const visitors = computed(() => needs.value.visitors);
const people = computed(() => needs.value.population);
// Supplies against everyone the town can hold; a shortage names how many go without.
const supplyNote = (supply) =>
  supply < needs.value.demand
    ? t('{supply}/{demand} people · short by {missing}', {
        supply,
        demand: needs.value.demand,
        missing: needs.value.demand - supply,
      })
    : t('{supply}/{demand} people', { supply, demand: needs.value.demand });
const needChips = computed(() => {
  const n = needs.value;
  return [
    ['water', 'water', 'Water: {capacity}/{demand}', `${n.water}/${n.demand}`, n.water],
    ['food', 'food', 'Food: {capacity}/{demand}', `${n.food}/${n.demand}`, n.food],
    ['comfort', 'happiness', 'Happiness: {value}%', `${n.happiness}%`, n.happiness],
  ].map(([stat, icon, label, value, capacity]) => ({
    stat,
    icon,
    value,
    short: n.short[stat],
    fixable: !!n.fixes[stat],
    id: n.fixes[stat] ?? { water: 'well', food: 'farm', comfort: 'square' }[stat],
    label: t(label, { capacity, demand: n.demand, value: capacity }),
  }));
});
const incomeRate = computed(() => saloonIncomeRate(town.value));
const activeProjects = computed(() => Object.values(town.value.projects));
const goal = computed(() => nextGoal(town.value));
const gate = computed(() => eraGate(town.value));
const directoryPlots = computed(() => availableParcels(town.value, campaign.builderHammers));
const townScene = ref(null);
const eraRevealed = ref(false);
const eraReady = ref(false);
const eraFallback = ref(false);
const sceneTown = computed(() =>
  town.value.transition?.pending && !eraRevealed.value
    ? { ...town.value, era: town.value.transition.from }
    : town.value,
);
watch(
  () => town.value.transition?.id,
  () => {
    eraRevealed.value = false;
    eraReady.value = false;
  },
);
function beginEra() {
  if (activeRaid.value || !campaign.advanceEra(town.value.era)) return;
  closeDialog();
  fullscreen.value = true;
  eraRevealed.value = false;
}
let cancelEraSound = () => {};
function stopEraSound() {
  cancelEraSound();
  cancelEraSound = () => {};
}
function playEraSound(cue) {
  stopEraSound();
  cancelEraSound = game.audioManager?.playArcadeCue?.(cue) ?? (() => {});
}
function completeEraCinematic() {
  eraRevealed.value = true;
  if (campaign.acknowledgeEra())
    nextTick(() => mapFrame.value?.querySelector('canvas')?.focus({ preventScroll: true }));
}
// The one-second collection clock. Only its readers (cooldown checks in the scene and
// building card) re-render each second; this view sees derived values that rarely change.
const collectionNow = ref(Date.now());
provide('townClock', collectionNow);
const forgeCollectible = computed(() => campaign.canCollectForge(collectionNow.value));
let collectionClock;
const currentEraPlots = computed(() => BUILDINGS.filter(({ id }) => plotInEra(town.value, id)));
const built = computed(
  () => currentEraPlots.value.filter(({ id }) => town.value.buildings[id]).length,
);
const villageStats = computed(() => {
  const { water, food, happiness: happy } = needs.value;
  return [
    {
      id: 'era',
      icon: 'sun',
      label: t('Current era'),
      value: t(ERA_BY_ID[town.value.era].label),
      detail: t(ERA_BY_ID[town.value.era].yearLabel),
    },
    { id: 'mine', icon: 'mine', label: t('Mine level'), value: number(campaign.nextLevel) },
    {
      id: 'people',
      icon: 'people',
      label: t('Population'),
      value: number(people.value),
      detail: t('{residents} residents · {visitors} visitors', {
        residents: residents.value,
        visitors: visitors.value,
      }),
    },
    { id: 'coins', icon: 'coin', label: t('Town savings'), value: number(town.value.coins) },
    {
      id: 'water',
      icon: 'water',
      label: t('Water'),
      value: number(water),
      detail: supplyNote(water),
    },
    {
      id: 'food',
      icon: 'food',
      label: t('Food'),
      value: number(food),
      detail: supplyNote(food),
    },
    {
      id: 'happiness',
      icon: 'happiness',
      label: t('Happiness'),
      value: `${happy}%`,
      detail: t(
        supplyLimitsVisitors.value
          ? 'Saloon income +{bonus}% · {visitors} of {places} visitors come · not enough spare water or food'
          : 'Saloon income +{bonus}% · {visitors} of {places} visitors come',
        {
          bonus: number(saloonHappinessBonus(town.value)),
          visitors: visitors.value,
          places: needs.value.visitorPlaces,
        },
      ),
    },
    {
      id: 'saloon',
      icon: 'coin',
      label: t('Saloon'),
      value: t('{rate}/hour', { rate: incomeRate.value }),
      detail: t('Stored: {coins} coins', { coins: number(town.value.income.stored ?? 0) }),
    },
    {
      id: 'buildings',
      icon: 'home',
      label: t('Buildings'),
      value: `${built.value}/${BUILDINGS.length}`,
      detail: t('Active construction: {count}', { count: activeProjects.value.length }),
    },
    {
      id: 'hammers',
      label: t('Builder hammers'),
      value: `${campaign.builderHammers}/${HAMMER_CAPACITY}`,
    },
  ];
});
const selected = ref(goal.value?.id ?? 'home');
const museumOpen = ref(props.openMuseum && campaign.canReplay),
  dialogMode = ref('');
const firstLightsOpen = computed(
  () =>
    props.active &&
    town.value.era === 'industrial' &&
    town.value.buildings.powerHouse > 0 &&
    !town.value.firstLightsSeen &&
    !town.value.transition?.pending &&
    !dialogMode.value &&
    !museumOpen.value &&
    !tourOpen.value &&
    !settings.isSettingsOpen &&
    !props.mineEntryPending,
);
const paused = ref(false),
  construction = ref(null),
  announcement = ref(''),
  latestMoment = ref(null);
const raidNotice = ref(null);
const collection = ref(null);
const vipCollections = ref([]);
let collectionSerial = 0;
const activeRaid = ref(null),
  raidPhase = ref('Riders on the ridge');
const presentationReady = ref(false);
const presentationFallback = ref(false);
const openingPresentation = computed(() =>
  !activeRaid.value && !town.value.transition?.pending ? pendingPresentation(town.value) : null,
);
watch(
  openingPresentation,
  (definition) => {
    presentationReady.value = false;
    presentationFallback.value = false;
    if (definition) {
      closeDialog();
      museumOpen.value = false;
      fullscreen.value = true;
    }
  },
  { immediate: true },
);
function completePresentation() {
  if (openingPresentation.value) campaign.acknowledgePresentation(openingPresentation.value.id);
}
const cameraDistance = ref(55);
const { playRaidCue } = useTownAudio(() => ({
  active: props.active,
  cameraDistance: cameraDistance.value,
  population: people.value,
  construction: activeProjects.value.length > 0,
  buildCue: construction.value?.serial,
  stable: town.value.buildings.stable > 0 && !motorTraffic(town.value),
  river: true,
  railDepot: town.value.buildings.railDepot > 0 && !modernTransport(town.value, 'railDepot'),
  riverPort: town.value.buildings.riverPort > 0 && !modernTransport(town.value, 'riverPort'),
  // Every incident kind ducks the music and gets its own recorded cues.
  raid: activeRaid.value ? `${activeRaid.value.id}-${raidPhase.value}` : null,
  raidKind: activeRaid.value ? eventKind(activeRaid.value) : null,
  // Village panels pause the diorama, but its music and ambience keep playing.
  paused: !props.active || paused.value || !!town.value.transition?.pending,
}));
const event = computed(() => town.value.events[BANDIT_EVENT]);
const readyRaidDefenses = computed(() =>
  activeRaid.value && !event.value?.seen
    ? (civicIncident(eventKind(event.value)) ? ['fireStation'] : ['sheriff', 'bank']).filter((id) =>
        constructionReady(town.value.projects[id]),
      )
    : [],
);
watch(
  event,
  (receipt) => {
    if (receipt && activeRaid.value?.id === receipt.id && !receipt.seen)
      activeRaid.value = { ...receipt };
  },
  { flush: 'sync' },
);
// Every incident kind, bandits included, closes with its own saved story.
const banditStory = computed(() => {
  if (!event.value) return null;
  const story = incidentStory(event.value);
  return { ...story, text: t(story.text, story.params) };
});
const moment = computed(
  () =>
    latestMoment.value ??
    (built.value
      ? {
          speaker: CARETAKER,
          title: activeProjects.value.length
            ? 'A little more with every puzzle.'
            : 'It’s good to have neighbors again.',
          text: activeProjects.value.length
            ? 'Each completed puzzle prepares every building in progress. Tap a ready building to open it.'
            : 'Choose what to build next. Families need a working well, a farm, and a home before they move in.',
        }
      : INITIAL_STORY),
);
watch(museumOpen, (open) => {
  if (props.active) emit('museum-change', open);
});
watch(
  () => props.openMuseum,
  (open) => {
    if (!props.active) return;
    closeDialog();
    museumOpen.value = open && campaign.canReplay;
    if (open && !campaign.canReplay) {
      selectBuilding('museum');
      emit('museum-change', false);
    }
  },
);
function closeDialog() {
  dialogMode.value = '';
}
function collectVipSpending(receipt) {
  const amount = campaign.collectVipSpending(receipt);
  if (!amount) return;
  vipCollections.value.push({
    amount,
    serial: ++collectionSerial,
    origin: townScene.value?.collectionOrigin(receipt.building),
  });
}
function collectIncome() {
  collectionNow.value = Date.now();
  const coins = campaign.collectSaloonIncome(collectionNow.value);
  if (!coins) return false;
  showCollection('coins', coins, 'saloon');
  return true;
}
function showCollection(resource, amount, buildingId) {
  closeDialog();
  collection.value = {
    resource,
    amount,
    serial: ++collectionSerial,
    origin: townScene.value?.collectionOrigin(buildingId),
  };
}
async function selectBuilding(id) {
  if (!Object.hasOwn(BUILDING_BY_ID, id)) return;
  selected.value = id;
  if (constructionReady(town.value.projects[id])) {
    finishBuilding(id);
    return;
  }
  if (id === 'saloon' && collectIncome()) return;
  if (id === 'square' && gate.value.available && !activeRaid.value) {
    beginEra();
    return;
  }
  if (id === 'square' && canRingTownBell(town.value)) {
    ringBell();
    return;
  }
  collection.value = null;
  collectionNow.value = Date.now();
  if (id === 'blacksmith' && campaign.collectForgeTNT(collectionNow.value)) {
    showCollection('tnt', 1, 'blacksmith');
    return;
  }
  await inspectBuilding(id);
}
function ringBell() {
  if (!campaign.ringTownBell(event.value?.id)) return false;
  game.audioManager?.playArcadeCue?.('town-bell');
  announcement.value = t('Bell rung · remaining loss: {coins} coins', { coins: event.value.loss });
  return true;
}
function buildFree(id) {
  const offer = upgradeOffer(town.value, id);
  if (!offer?.available || offer.cost !== 0) return;
  selected.value = id;
  startWork(offer.stage);
}
function selectParcel(id) {
  if (constructionReady(town.value.projects[id])) finishBuilding(id, true);
  else {
    const offer = upgradeOffer(town.value, id);
    if (!offer?.available) return;
    selected.value = id;
    if (town.value.coins >= offer.cost) startWork(offer.stage, true);
    else useHammer(offer.stage, true);
  }
}
async function inspectBuilding(id) {
  if (!Object.hasOwn(BUILDING_BY_ID, id)) return;
  selected.value = id;
  dialogMode.value = 'building';
  await nextTick();
  const dialog = document.querySelector('.town-dialog');
  if (dialog) {
    dialog.scrollTop = 0;
    dialog.querySelector('.town-dialog-close')?.focus({ preventScroll: true });
  }
}
function visitMuseum() {
  closeDialog();
  if (campaign.canReplay) museumOpen.value = true;
}
function showConstructionSites() {
  museumOpen.value = false;
  closeDialog();
  fullscreen.value = true;
}
defineExpose({ showConstructionSites });
function goMining() {
  collection.value = null;
  closeDialog();
  if (campaign.completedCount < LEVEL_COUNT) emit('mine');
  else if (campaign.canReplay) museumOpen.value = true;
  else selectBuilding('museum');
}
function plotStatus(place) {
  if (place.ready) return t('Construction complete');
  return town.value.buildings[place.id]
    ? t('Level {level} / {max}', {
        level: eraBuildingLevel(town.value, place.id),
        max: town.value.era !== 'frontier' ? 3 : place.upgrades.length,
      })
    : t('Empty plot');
}
function startWork(stage, keepDirectory = false) {
  if (!campaign.upgradeBuilding(selected.value, stage)) return;
  showConstruction(keepDirectory);
  const complete = !town.value.projects[selected.value];
  const puzzles = town.value.projects[selected.value]?.required ?? 0;
  announcement.value = t(
    complete
      ? '{building} is ready!'
      : puzzles === 1
        ? 'Work started at {building}. Complete one puzzle, then tap the building to finish.'
        : 'Work started at {building}. Complete {count} puzzles, then tap the building to finish.',
    {
      building: t(BUILDING_BY_ID[selected.value].shortName),
      count: puzzles,
    },
  );
  latestMoment.value = {
    speaker: CARETAKER,
    title: complete ? 'Building complete!' : 'The first step is yours.',
    text: complete
      ? (BUILDING_BY_ID[selected.value].upgrades[stage]?.story ??
        'Visual modernization. Existing services stay unchanged.')
      : puzzles === 1
        ? 'The materials are ready. Complete one puzzle, then tap the scaffolding to open this building.'
        : t(
            'The materials are ready. Complete {count} puzzles, then tap the scaffolding to open this building.',
            { count: puzzles },
          ),
  };
}
function showConstruction(keepDirectory = false) {
  if (pendingPresentation(town.value)) keepDirectory = false;
  if (!keepDirectory) closeDialog();
  construction.value = { id: selected.value, serial: (construction.value?.serial ?? 0) + 1 };
  if (!keepDirectory) mapFrame.value?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
}
function finishBuilding(id, keepDirectory = false) {
  performanceMark('build-tap');
  const stage = town.value.projects[id]?.stage;
  if (!campaign.finishConstruction(id, stage)) return;
  performanceMark('build-accepted');
  selected.value = id;
  showConstruction(keepDirectory);
  celebrateBuilding();
}
function celebrateBuilding() {
  const upgrade = BUILDING_BY_ID[selected.value].upgrades[town.value.buildings[selected.value] - 1];
  latestMoment.value = {
    speaker: upgrade.speaker,
    title: 'Building complete!',
    text: upgrade.story,
  };
  announcement.value = t('{building} is ready!', {
    building: t(BUILDING_BY_ID[selected.value].shortName),
  });
}
function useHammer(stage, keepDirectory = false) {
  if (!campaign.useBuilderHammer(selected.value, stage)) return;
  showConstruction(keepDirectory);
  celebrateBuilding();
}

function finishRaid() {
  if (!activeRaid.value) return;
  const id = activeRaid.value.id;
  if (!event.value?.seen && !campaign.markRaidSeen(id)) return;
  const receipt = { ...event.value };
  if (receipt.outcome === 'protected' || receipt.loss > 0) raidNotice.value = receipt;
  if (receipt.bounty) game.audioManager?.playArcadeCue?.('jackpot');
  activeRaid.value = null;
  latestMoment.value = banditStory.value;
  announcement.value = banditStory.value.text;
}
function replayRaid() {
  closeDialog();
  raidNotice.value = null;
  if (!event.value || activeRaid.value) return;
  activeRaid.value = { ...event.value };
  raidPhase.value = incidentPhase(event.value, 0);
  mapFrame.value?.scrollIntoView({
    behavior: settings.reducedMotion ? 'instant' : 'smooth',
    block: 'start',
  });
}
function visibilityChanged() {
  paused.value = document.hidden;
  collectionNow.value = Date.now();
}
function enterVillage() {
  collectionNow.value = Date.now();
  fullscreen.value = true;
  tourOpen.value = false;
  museumOpen.value = props.openMuseum && campaign.canReplay;
  campaign.lastConstruction = [];
  campaign.accrueSaloonIncome();
  campaign.resolveBandits();
  if (event.value && !event.value.seen) {
    activeRaid.value = { ...event.value };
    raidPhase.value = incidentPhase(event.value, 0);
  }
  if (props.openMuseum && !campaign.canReplay) {
    selectBuilding('museum');
    emit('museum-change', false);
  }
}
watch(
  () => props.active,
  (active) => {
    if (active) enterVillage();
    else {
      closeDialog();
      museumOpen.value = false;
      fullscreen.value = false;
      activeRaid.value = null;
      raidNotice.value = null;
      collection.value = null;
    }
  },
  { flush: 'sync' },
);
onMounted(() => {
  collectionClock = setInterval(() => {
    if (props.active && !document.hidden) collectionNow.value = Date.now();
  }, 1000);
  visibilityChanged();
  document.addEventListener('visibilitychange', visibilityChanged);
  if (props.active) enterVillage();
});
onBeforeUnmount(() => {
  clearInterval(collectionClock);
  document.removeEventListener('visibilitychange', visibilityChanged);
  if (fullscreen.value) document.body.style.overflow = previousOverflow ?? '';
});
</script>

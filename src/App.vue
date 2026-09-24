<template>
  <div
    class="app-shell"
    :data-mine-theme="game.sessionActive ? currentConfig?.theme : undefined"
    :class="{
      'is-playing': game.sessionActive,
      'is-town': !game.sessionActive,
      'reduced-motion': settings.reducedMotion,
      'high-contrast': settings.highContrastMode,
    }"
  >
    <MineBackdrop
      v-if="game.sessionActive"
      :theme="currentConfig?.theme"
      :era="campaign.town.era"
    />
    <div
      v-if="
        game.arcadeImpact && game.sessionActive && !game.levelCleared && !settings.reducedMotion
      "
      :key="game.arcadeImpact.id"
      class="arcade-screen-impact"
      :class="{ 'is-fusion': game.arcadeImpact.type === 'bonus-fusion' }"
      :style="{ '--impact-color': game.arcadeImpact.color }"
      aria-hidden="true"
    >
      <i></i><i></i>
    </div>
    <div class="starlight" aria-hidden="true"></div>
    <header class="app-header">
      <button class="brand" :aria-label="t('Prospect Hollow home')" @click="showVillage">
        <img src="/art/amethyst.svg" alt="" />
        <span>PROSPECT <b>HOLLOW</b></span>
      </button>
      <nav class="world-nav" :aria-label="t('Choose your adventure')">
        <button
          :aria-current="
            !game.sessionActive && view === 'town' && !returnToMuseum ? 'page' : undefined
          "
          @click="showVillage"
        >
          {{ t('Village') }}
        </button>
        <button :aria-current="game.sessionActive ? 'page' : undefined" @click="goToMine">
          {{ t('Mine') }}
        </button>
        <button
          v-if="campaign.canReplay"
          :aria-current="
            !game.sessionActive && view === 'town' && returnToMuseum ? 'page' : undefined
          "
          @click="showMuseum"
        >
          {{ t('Museum') }}
        </button>
      </nav>
      <div class="header-actions">
        <button
          class="icon-button"
          :aria-label="t(muted ? 'Unmute audio' : 'Mute audio')"
          :title="t(muted ? 'Unmute audio' : 'Mute audio')"
          :aria-pressed="muted"
          @click="toggleMute"
        >
          <GameIcon :name="muted ? 'muted' : 'sound'" />
        </button>
        <button
          class="icon-button"
          :aria-label="t('Settings')"
          :title="t('Settings')"
          @click="settings.toggleSettings(true)"
        >
          <GameIcon name="settings" />
        </button>
      </div>
    </header>
    <MineHeader
      v-if="game.sessionActive"
      v-model:open="mobileDetailsOpen"
      :muted="muted"
      :level-name="levelName"
      @toggle-mute="toggleMute"
      @town="showTown"
      @guide="openGuide"
    />

    <LandingView v-if="!game.sessionActive && view === 'landing'" @enter="showTown" />
    <TownView
      ref="townView"
      v-if="townVisited"
      v-show="townActive"
      :active="townActive"
      :mine-entry-pending="!!pendingMineEntry"
      :key="townVisit"
      :open-museum="returnToMuseum"
      @museum-change="returnToMuseum = $event"
      @mine="startLevel(campaign.nextLevel)"
      @replay="startLevel"
      @continuous="startLevel($event, 'continuous')"
    />

    <TownDialog
      v-if="pendingMineEntry"
      :title="t('Buildings are ready to finish')"
      :close-label="'Cancel mine entry'"
      @close="pendingMineEntry = null"
    >
      <p>
        {{
          t(
            'Some buildings are ready but still need a final tap to finish construction. Enter the mine anyway?',
          )
        }}
      </p>
      <div class="mine-entry-actions">
        <button class="town-primary" @click="returnToConstruction">{{ t('Back to town') }}</button>
        <button class="town-secondary" @click="confirmMineEntry">{{ t('Continue anyway') }}</button>
      </div>
    </TownDialog>

    <main v-if="game.sessionActive" class="game-layout">
      <section
        class="play-area"
        :class="{ 'expanded-board': game.boardRows > 8 }"
        :style="{
          '--board-ratio': game.boardCols / game.boardRows,
          '--fusion-color': game.arcadeImpact?.color,
        }"
      >
        <div v-if="game.playMode === 'continuous'" class="continuous-banner">
          <div>
            <strong>∞ {{ t('Continuous play') }}</strong
            ><span class="continuous-description">{{
              t('Keep matching after the objectives. No chests or construction steps.')
            }}</span>
            <span class="continuous-coins" role="status">{{
              t('{earned}/{cap} coins saved for this level', {
                earned: campaign.continuousRecords[game.currentLevelId]?.coins ?? 0,
                cap: CONTINUOUS_COIN_CAP,
              })
            }}</span>
          </div>
          <button class="continuous-exit" :disabled="game.animationInProgress" @click="showVillage">
            <GameIcon name="home" /> {{ t('Exit mine') }}
          </button>
        </div>
        <div class="mine-feedback">
          <div v-show="!game.activeBonusMode && !game.arcadeBanner" class="mine-tip-slot">
            <MineTip />
          </div>
          <div v-if="game.activeBonusMode" class="board-caption" aria-live="polite">
            {{ t('Tap a tile to use') }} {{ t(powerName) }}
            <button class="text-button" @click="game.setBonusMode(null)">
              {{ t('Cancel') }}
            </button>
          </div>
          <template v-else-if="game.arcadeBanner">
            <ArcadeBanner :banner="game.arcadeBanner" />
            <strong
              v-if="game.arcadeBanner.kind === 'fusion'"
              class="fusion-reward"
              aria-live="polite"
            >
              {{ t(game.arcadeBanner.detail) }}
            </strong>
          </template>
        </div>
        <div class="board-topline">
          <div class="board-tools">
            <button
              class="icon-button"
              :aria-label="t('Show next move')"
              :title="t('Show next move')"
              :disabled="
                game.animationInProgress ||
                game.inputPaused ||
                game.levelCleared ||
                !!game.activeBonusMode
              "
              @click="game.computeHintMove()"
            >
              <GameIcon name="hint" />
            </button>
            <button
              class="icon-button"
              :aria-label="t('Mining guide')"
              :title="t('Mining guide')"
              :aria-expanded="guideOpen"
              @click="openGuide"
            >
              <GameIcon name="info" />
            </button>
          </div>
        </div>
        <div
          class="board-frame"
          :class="{
            'power-active': game.activeBonusMode,
            'fusion-impact': game.arcadeImpact?.type === 'bonus-fusion',
          }"
        >
          <div class="frame-corner corner-tl"></div>
          <div class="frame-corner corner-tr"></div>
          <div class="frame-corner corner-bl"></div>
          <div class="frame-corner corner-br"></div>
          <BoardCanvas />
          <transition name="notice"
            ><div v-if="game.reshuffleNotice" class="board-notice" role="status">
              {{ t(game.reshuffleNotice.message) }}
            </div></transition
          >
        </div>
        <PowerUpBar />
      </section>
    </main>
    <VictoryModal
      v-if="game.levelCleared"
      :level-id="game.currentLevelId"
      :rewards="game.levelRewards"
      :coins="game.coinReward"
      :jewels="game.collectedJewels"
      :bonus-gems="game.remainingBonusGems"
      :combo-counts="game.comboCounts"
      :multi-match-counts="game.multiMatchCounts"
      :construction="game.constructionReward"
      :elapsed-ms="game.elapsedMs"
      :speed-target-ms="game.speedTargetMs"
      :score="game.score"
      :moves="game.moves"
      :max-combo="game.maxCascade"
      :score-target="scoreTarget"
      :star-score-target="game.starScoreTarget"
      :can-replay="campaign.canReplay"
      :can-continue="campaign.completedCount < LEVEL_NAMES.length"
      @next="startLevel(campaign.nextLevel)"
      @claimed="game.levelRewards[$event.index].items = [$event.reward]"
      @menu="showTown"
      @town="showTown"
      @replay="startLevel(game.currentLevelId)"
    />
    <ObstacleGuide
      v-if="guideOpen && game.sessionActive"
      :obstacles="guideItems"
      :introduction="guideIntro"
      @close="closeGuide"
    />
    <SettingsDrawer
      :open="settings.isSettingsOpen"
      :allow-save-transfer="!game.sessionActive"
      @close="settings.toggleSettings(false)"
      @reset-progress="resetProgress"
      @import-progress="resumeImportedVillage"
    />
  </div>
</template>

<script setup>
import MineTip from './components/MineTip.vue';
import { t } from './i18n';
import {
  computed,
  nextTick,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';
const TownView = defineAsyncComponent(() => import('./components/town/TownView.vue'));
const BoardCanvas = defineAsyncComponent(() => import('./components/BoardCanvas.vue'));
import TownDialog from './components/town/TownDialog.vue';
import { constructionReady } from './game/town/TownRules';
import MineBackdrop from './components/MineBackdrop.vue';
import ArcadeBanner from './components/ArcadeBanner.vue';
import MineHeader from './components/MineHeader.vue';
import PowerUpBar from './components/PowerUpBar.vue';
import LandingView from './components/LandingView.vue';
import './styles/town.css';
import { CONTINUOUS_COIN_CAP } from './data/rewards';
import VictoryModal from './components/VictoryModal.vue';
import SettingsDrawer from './components/SettingsDrawer.vue';
import GameIcon from './components/GameIcon.vue';
import { useGameStore } from './stores/gameStore';
import { useCampaignStore } from './stores/campaignStore';
import { useSettingsStore } from './stores/settingsStore';
import { useAudio } from './composables/useAudio';
import { LEVEL_NAMES } from './data/levelNames';
import { obstaclesInLevel } from './data/obstacles';
import ObstacleGuide from './components/ObstacleGuide.vue';
import { TESTING_TOWN_CHANGED } from './services/testingTools';

const game = useGameStore();
const campaign = useCampaignStore();
const view = ref(campaign.hasVisitedVillage ? 'town' : 'landing');
const townView = ref(null);
const pendingMineEntry = ref(null);
const townVisit = ref(0);
const townVisited = ref(campaign.hasVisitedVillage);
const townActive = computed(() => !game.sessionActive && view.value === 'town');
const returnToMuseum = ref(false);
const showTown = () => {
  returnToMuseum.value = game.playMode === 'continuous';
  game.exitLevel();
  view.value = 'town';
  townVisited.value = true;
  campaign.visitVillage();
};
const showVillage = () => {
  if (game.sessionActive || view.value !== 'town') showTown();
  returnToMuseum.value = false;
};
const showMuseum = () => {
  if (game.sessionActive || view.value !== 'town') showTown();
  returnToMuseum.value = true;
};
const goToMine = () => {
  if (game.sessionActive) return;
  if (campaign.completedCount >= LEVEL_NAMES.length) {
    showMuseum();
  } else startLevel(campaign.nextLevel);
};
const resetProgress = () => {
  game.exitLevel();
  campaign.resetProgress();
  returnToMuseum.value = false;
  townVisit.value++;
  townVisited.value = true;
  view.value = 'town';
};
const settings = useSettingsStore();
const resumeImportedVillage = () => {
  game.exitLevel();
  returnToMuseum.value = false;
  townVisit.value++;
  townVisited.value = true;
  view.value = 'town';
};
const audio = useAudio();
const mobileDetailsOpen = ref(false);
const guideOpen = ref(false),
  guideIntro = ref(false),
  levelObstacles = ref([]),
  guideItems = ref([]);
const openGuide = () => {
  guideItems.value = levelObstacles.value;
  guideIntro.value = false;
  guideOpen.value = true;
};
const closeGuide = () => {
  if (guideIntro.value) campaign.markObstaclesSeen(guideItems.value.map((item) => item.id));
  guideOpen.value = false;
};
watch(
  () => [game.sessionVersion, game.sessionActive],
  () => {
    guideOpen.value = false;
    if (!game.sessionActive) return;
    levelObstacles.value = obstaclesInLevel(game.tiles);
    const unseen = levelObstacles.value.filter(
      (item) =>
        !campaign.seenObstacles.includes(item.id) &&
        !(game.currentLevelId === 1 && item.id === 'ice'),
    );
    if (unseen.length) {
      guideItems.value = unseen;
      guideIntro.value = true;
      guideOpen.value = true;
    }
  },
);
let clockInterval, incomeInterval;
const muted = computed(() => settings.musicVolume === 0 && settings.sfxVolume === 0);
let previousVolumes = [0.6, 0.8];
const toggleMute = () => {
  if (muted.value) {
    settings.setMusicVolume(previousVolumes[0]);
    settings.setSfxVolume(previousVolumes[1]);
  } else {
    previousVolumes = [settings.musicVolume, settings.sfxVolume];
    settings.setMusicVolume(0);
    settings.setSfxVolume(0);
  }
};
const currentConfig = computed(
  () => game.availableLevels.find((level) => level.id === game.currentLevelId)?.config,
);
const levelName = computed(() => LEVEL_NAMES[game.currentLevelId - 1]);
const powerName = computed(() => game.activeBonusMode?.replaceAll('_', ' '));
const scoreTarget = computed(() => game.objectives.find((o) => o.type === 'score')?.target ?? 0);
const startLevel = (id, mode = 'normal') => {
  if (!campaign.canPlay(id, mode)) return;
  if (!game.sessionActive && Object.values(campaign.town.projects).some(constructionReady)) {
    pendingMineEntry.value = { id, mode };
    return;
  }
  enterMine(id, mode);
};
const confirmMineEntry = () => {
  const entry = pendingMineEntry.value;
  pendingMineEntry.value = null;
  if (entry) enterMine(entry.id, entry.mode);
};
const returnToConstruction = () => {
  pendingMineEntry.value = null;
  showVillage();
  nextTick(() => townView.value?.showConstructionSites());
};
const enterMine = (id, mode) => {
  if (!campaign.canPlay(id, mode)) return;
  view.value = 'town';
  returnToMuseum.value = false;
  mobileDetailsOpen.value = false;
  game.startLevel(id, mode);
  campaign.markTipSeen('mine');
  window.scrollTo({ top: 0, behavior: 'instant' });
  audio.playAmbientLoop();
};
watch(
  () => [
    game.sessionActive,
    game.levelCleared,
    game.animationInProgress,
    game.inputPaused,
    !!game.renderer,
  ],
  () => game.syncRunClock(),
  { flush: 'sync' },
);
const updateInputPause = () => {
  game.inputPaused =
    document.hidden || settings.isSettingsOpen || mobileDetailsOpen.value || guideOpen.value;
  game.renderer?.input?.reset();
  if (game.inputPaused) game.cancelHint(true);
  else if (game.sessionActive && !game.levelCleared) {
    game.processQueuedInput();
    game.scheduleHint();
  }
};
const visibilityChanged = () => {
  updateInputPause();
  campaign.accrueSaloonIncome();
  if (document.hidden) audio.stopAmbientLoop({ fadeMs: 0 });
  else if (game.sessionActive) audio.playAmbientLoop();
};
onMounted(() => {
  game.bootstrap();
  campaign.accrueSaloonIncome();
  incomeInterval = setInterval(() => {
    if (!document.hidden) campaign.accrueSaloonIncome();
  }, 30000);
  clockInterval = setInterval(() => game.syncRunClock(), 100);
  game.setAudioManager(audio);
  document.addEventListener('visibilitychange', visibilityChanged);
  window.addEventListener(TESTING_TOWN_CHANGED, resumeImportedVillage);
});
watch(
  () => game.sessionActive,
  (active) => {
    if (!active) {
      audio.stopAmbientLoop({ fadeMs: 200 });
    }
  },
);
watch([() => settings.isSettingsOpen, mobileDetailsOpen, guideOpen], updateInputPause, {
  flush: 'sync',
});
onBeforeUnmount(() => {
  clearInterval(clockInterval);
  clearInterval(incomeInterval);
  campaign.accrueSaloonIncome();
  document.removeEventListener('visibilitychange', visibilityChanged);
  window.removeEventListener(TESTING_TOWN_CHANGED, resumeImportedVillage);
  game.exitLevel();
  game.setAudioManager(null);
});
</script>

<template>
  <details
    ref="drawer"
    class="mobile-game-header"
    :open="open"
    @toggle.self="$emit('update:open', $event.target.open)"
    @keydown.esc.stop="close"
  >
    <summary ref="handle" :aria-label="t('Level status and controls')">
      <span class="mobile-level"
        ><small> {{ t('LEVEL') }} </small
        ><b>{{ String(game.currentLevelId).padStart(2, '0') }}</b></span
      >
      <span class="mobile-score" :aria-label="t('{value0} points', { value0: game.score })"
        ><small> {{ t('SCORE') }} </small><b>{{ number(game.score) }}</b></span
      >
      <span
        v-if="game.playMode !== 'continuous'"
        class="mobile-reward"
        :aria-label="t('A chest when you finish')"
      >
        <small>{{ t('REWARD') }}</small
        ><b><TownIcon name="chest" /> ✓</b>
      </span>
      <span
        v-else
        class="mobile-time"
        :aria-label="t('Active time {value0}', { value0: formatTime(game.elapsedMs) })"
        ><small> {{ t('TIME') }} </small><b>{{ formatTime(game.elapsedMs) }}</b></span
      >
      <span
        class="mobile-cleared"
        :aria-label="
          t(
            game.oreOrders.length
              ? '{value0} of {value1} goals completed{value2}'
              : '{value0} of {value1} layers cleared{value2}',
            {
              value0: game.oreOrders.length
                ? game.goalProgress
                : game.totalLayers - game.remainingLayers,
              value1: game.oreOrders.length ? game.goalTotal : game.totalLayers,
              value2: t(
                game.totalRelics && !game.oreOrders.length
                  ? t(', {value0} of {value1} relics collected', {
                      value0: game.totalRelics - game.remainingRelics,
                      value1: game.totalRelics,
                    })
                  : '',
              ),
            },
          )
        "
        ><small>{{
          t(
            game.totalRelics || game.oreOrders.length
              ? 'GOALS'
              : game.currentLevelId >= 43
                ? 'LAYERS'
                : 'ICE & STONE',
          )
        }}</small
        ><b
          >{{ game.goalProgress }}<em> / {{ game.goalTotal }}</em></b
        ></span
      >
      <GameIcon name="chevron" class="mobile-drawer-chevron" />
      <i class="mobile-goal-track" aria-hidden="true"
        ><i
          :style="{
            width: `${game.goalTotal ? (game.goalProgress / game.goalTotal) * 100 : 0}%`,
          }"
        ></i
      ></i>
    </summary>
    <button
      class="mobile-drawer-scrim"
      :aria-label="t('Close level details')"
      @click="close"
    ></button>
    <div class="mobile-details-panel">
      <div class="mobile-panel-heading">
        <h1>{{ t(levelName) }}</h1>
        <span> {{ t('PAUSED') }} </span>
      </div>
      <div class="mobile-panel-actions">
        <button class="text-button" @click="$emit('town')">
          <GameIcon name="back" /> {{ t('Back to village') }}
        </button>
        <button
          class="icon-button"
          :aria-label="t(muted ? 'Unmute audio' : 'Mute audio')"
          :aria-pressed="muted"
          @click="$emit('toggle-mute')"
        >
          <GameIcon :name="muted ? 'muted' : 'sound'" />
        </button>
        <button
          class="icon-button"
          :aria-label="t('Settings')"
          @click="settings.toggleSettings(true)"
        >
          <GameIcon name="settings" />
        </button>
      </div>
      <HudPanel />
      <details class="mobile-help">
        <summary>{{ t('How to play') }}</summary>
        <p>
          {{
            t(
              'Swipe or tap neighboring gems to match 3. Match 4 for a bomb, 5 for a rainbow, or a T / L for cross fire. Clear every obstacle layer and collect any relics to finish. Stone stops falling gems: match beside it or hit it with a bonus. Gold bands mean two hits. Finish fast for a separate speed chest. The clock pauses during cascades and while viewing controls; you can still finish after the speed target.',
            )
          }}
        </p>
        <p v-if="game.currentLevelId >= 43">
          {{
            t(
              'Chained gems stay in place: include them in a match or hit them with a bonus. Other gems can fall past. Match ruby (R), sapphire (S), or emerald (E) gems on the corresponding seals; bonuses open any color. Golden relics cannot swap or be destroyed. Clear beneath them to drop them through the glowing bottom exits.',
            )
          }}
        </p>
      </details>
      <button class="mobile-resume" @click="close">
        {{ t('BACK TO THE GAME') }} <GameIcon name="chevron" />
      </button>
    </div>
  </details>
</template>
<script setup>
import { t, number } from '../i18n';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import GameIcon from './GameIcon.vue';
import HudPanel from './HudPanel.vue';
import TownIcon from './town/TownIcon.vue';
import { formatTime } from '../data/campaign';
import { useGameStore } from '../stores/gameStore';
import { useSettingsStore } from '../stores/settingsStore';
defineProps({ open: Boolean, muted: Boolean, levelName: String });
const emit = defineEmits(['update:open', 'toggle-mute', 'town']);
const game = useGameStore();
const settings = useSettingsStore();
const drawer = ref(null),
  handle = ref(null);
const close = () => {
  drawer.value.open = false;
  emit('update:open', false);
  handle.value?.focus({ preventScroll: true });
};
let mobileQuery;
const viewportChanged = () => {
  if (!mobileQuery.matches) {
    drawer.value.open = false;
    emit('update:open', false);
  }
};
onMounted(() => {
  mobileQuery = window.matchMedia(
    '(max-width: 640px), (max-height: 500px) and (max-width: 1000px)',
  );
  mobileQuery.addEventListener('change', viewportChanged);
});
onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', viewportChanged);
  emit('update:open', false);
});
</script>
<style scoped>
.mobile-game-header {
  display: none;
}
.mobile-reward b {
  display: flex;
  align-items: center;
  gap: 4px;
  color: #ffdf80;
}
.mobile-reward svg {
  width: 19px;
  height: 19px;
}
@media (max-width: 640px), (max-height: 500px) and (max-width: 1000px) {
  .mobile-game-header {
    display: block;
    position: relative;
    z-index: 45;
    padding-top: env(safe-area-inset-top, 0px);
    background: #171022;
  }
  .mobile-game-header > summary {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 44px;
    padding: 5px max(12px, env(safe-area-inset-right)) 6px max(12px, env(safe-area-inset-left));
    cursor: pointer;
    list-style: none;
    touch-action: manipulation;
    background: linear-gradient(100deg, #331c3d77, #10243266);
  }
  .mobile-game-header > summary::-webkit-details-marker {
    display: none;
  }
  .mobile-game-header > summary:focus-visible {
    outline: 2px solid var(--gold);
    outline-offset: -3px;
  }
  summary small {
    display: block;
    color: #b8a1c9;
    font-size: 7px;
    letter-spacing: 1px;
    white-space: nowrap;
  }
  summary b {
    display: block;
    margin-top: 2px;
    font:
      900 17px/1.1 'Arial Black',
      sans-serif;
    font-variant-numeric: tabular-nums;
    color: #fff0cf;
    white-space: nowrap;
  }
  summary em {
    color: #b8a1c9;
    font-size: 10px;
    font-style: normal;
  }
  .mobile-level b {
    color: #e7a8ff;
  }
  .mobile-time b {
    color: #88efff;
  }
  .mobile-time.expired b {
    color: #b8a1c9;
  }
  .mobile-drawer-chevron {
    width: 16px;
    height: 16px;
    color: var(--gold);
    transition: transform 200ms;
  }
  [open] > summary .mobile-drawer-chevron {
    transform: rotate(180deg);
  }
  .mobile-goal-track {
    position: absolute;
    inset: auto 0 0;
    height: 2px;
    background: #503354;
    overflow: hidden;
  }
  .mobile-goal-track i {
    display: block;
    height: 100%;
    background: linear-gradient(90deg, #dc8dff, #83f5ff);
  }
  .mobile-drawer-scrim {
    position: fixed;
    inset: 0;
    z-index: -1;
    border: 0;
    background: #08061177;
    cursor: default;
  }
  .mobile-drawer-scrim:active {
    transform: none;
  }
  .mobile-details-panel {
    position: absolute;
    top: 100%;
    inset-inline: 0;
    padding: 16px max(18px, env(safe-area-inset-right)) 12px max(18px, env(safe-area-inset-left));
    max-height: calc(100dvh - 44px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
    overflow-y: auto;
    overscroll-behavior: contain;
    background: linear-gradient(145deg, #2e193c, #161529);
    border-bottom: 1px solid #c586e7;
    border-radius: 0 0 16px 16px;
    box-shadow: 0 15px 40px #08051199;
    animation: mobile-panel-slide 220ms ease-out both;
  }
  .mobile-panel-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .mobile-panel-heading h1 {
    font:
      italic 900 25px/1.2 'Arial Black',
      sans-serif;
    color: #fff0cf;
    text-shadow: 2px 2px #7d3194;
  }
  .mobile-panel-heading > span {
    font-size: 8px;
    letter-spacing: 1.5px;
    color: #b8a1c9;
  }
  .mobile-panel-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 9px 0;
  }
  .mobile-panel-actions .text-button {
    margin-right: auto;
    min-height: 44px;
  }
  .mobile-panel-actions .icon-button {
    width: 44px;
    height: 44px;
  }
  .mobile-details-panel :deep(.hud-panel) {
    display: grid;
    grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
    margin-top: 12px;
    gap: 12px;
  }
  .mobile-details-panel :deep(.score-card) {
    padding: 0;
    border: 0;
    background: none;
  }
  .mobile-details-panel :deep(.stats-row) {
    padding: 0;
    border: 0;
  }
  .mobile-details-panel :deep(.score-stars),
  .mobile-details-panel :deep(.score-card > .eyebrow) {
    display: none;
  }
  .mobile-details-panel :deep(.objective) {
    grid-column: 1 / -1;
    margin-top: 4px;
  }
  .mobile-details-panel :deep(.score-value) {
    font-size: 34px;
  }
  .mobile-details-panel :deep(.chest-progress) {
    margin-top: 5px;
    font-size: 10px;
  }
  .mobile-details-panel :deep(.chest-progress small),
  .mobile-details-panel :deep(.speed-target) {
    font-size: 9px;
  }
  .mobile-details-panel :deep(.stats-row .eyebrow) {
    font-size: 8px;
  }
  .mobile-details-panel :deep(.objective-title) {
    font-size: 11px;
  }
  .mobile-help {
    margin-top: 16px;
    border-top: 1px solid #a674bf44;
  }
  .mobile-help summary {
    padding-block: 14px;
    font-size: 12px;
    cursor: pointer;
  }
  .mobile-help p {
    font-size: 12px;
    line-height: 1.8;
    color: #c4afd2;
    padding-bottom: 12px;
  }
  .mobile-resume {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    width: 100%;
    min-height: 44px;
    border: 1px solid #cc9ded66;
    border-radius: 8px;
    color: #ffe09c;
    background: #71468444;
    font-size: 10px;
    font-weight: 900;
    letter-spacing: 1px;
  }
  .mobile-resume svg {
    width: 16px;
    height: 16px;
    transform: rotate(180deg);
  }
}
@keyframes mobile-panel-slide {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>

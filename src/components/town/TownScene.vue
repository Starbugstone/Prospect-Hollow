<template>
  <TownMap
    v-if="fallback"
    ref="map"
    :town="town"
    :read-only="readOnly"
    :builder-hammers="builderHammers"
    :forge-collectible="forgeCollectible"
    :now="now"
    :selected="selected"
    :population="population"
    :reduced-motion="reducedMotion"
    :paused="paused"
    :next-level="nextLevel"
    :mine-stage="mineStage"
    :fullscreen="fullscreen"
    :construction="construction"
    @select="!readOnly && $emit('select', $event)"
    @mine="!readOnly && $emit('mine')"
  />
  <div
    v-else
    class="town-scene"
    :class="{ 'is-raiding': raid && !reducedMotion, 'is-read-only': readOnly }"
    :aria-label="t(readOnly ? 'Village visit · view only' : 'Interactive 3D town')"
    @pointerdown="rememberPointer"
    @pointermove="movePointer"
    @pointerleave="leavePointer"
    @pointerup="pick"
    @pointercancel="cancelPointer"
    @lostpointercapture="cancelPointer"
  >
    <canvas
      :key="canvasVersion"
      ref="canvas"
      tabindex="0"
      :aria-label="t('Town camera. Arrow keys rotate, plus and minus zoom, Home resets the view.')"
      @keydown="cameraKey"
    />
    <div
      v-if="eventInset && !reducedMotion"
      class="town-event-inset"
      :class="{ 'passive-arrival-inset': eventInset.passive }"
      role="img"
      :aria-label="t(eventInset.label)"
      :style="{
        left: `${eventInset.x}px`,
        bottom: `${eventInset.y}px`,
        width: `${eventInset.width}px`,
        height: `${eventInset.height}px`,
      }"
      @pointerdown.stop
      @pointerup.stop
    >
      <span>{{ t(eventInset.label) }}</span>
      <span
        v-if="eventInset.nameTag"
        class="vip-inset-name"
        :style="{ left: `${eventInset.nameTag.x}%`, top: `${eventInset.nameTag.y}%` }"
      >
        {{ eventInset.nameTag.name }}
      </span>
    </div>
    <span
      v-if="villagerLabel"
      class="villager-name"
      role="status"
      :style="{ left: `${villagerLabel.x}%`, top: `${villagerLabel.y}%` }"
      >{{ t('VIP visitor') }} · {{ villagerLabel.name }}</span
    >
    <div class="town-action-icons">
      <button
        v-for="anchor in actionAnchors"
        :key="anchor.id"
        class="town-action-icon"
        :class="{
          'town-era-icon': indicators[anchor.id] === 'era',
          'town-completion-icon': indicators[anchor.id] === 'ready',
          'raid-defense-ready': raidDefenseIds.includes(anchor.id),
          'raid-bell-ready': indicators[anchor.id] === 'bell',
        }"
        :data-town-plot="anchor.id"
        :style="{
          left: `${anchor.collection.x}%`,
          top: `${anchor.collection.y}%`,
          '--action-scale': townIndicatorScale(indicators[anchor.id]),
        }"
        :aria-label="
          indicators[anchor.id] === 'ready'
            ? t('Finish {building}', { building: t(BUILDING_BY_ID[anchor.id].shortName) })
            : anchor.id === 'saloon'
              ? t('Collect {coins} coins', { coins: town.income.stored })
              : indicators[anchor.id] === 'bell'
                ? t('Ring town bell · halve the loss')
                : indicators[anchor.id] === 'era'
                  ? t('Advance to the next era')
                  : t('Collect 1 TNT')
        "
        @click="chooseLabel(anchor.id, $event)"
      >
        <img
          :src="
            indicators[anchor.id] === 'ready'
              ? '/art/rewards/builder-hammer.svg'
              : anchor.id === 'saloon'
                ? '/art/rewards/coins.svg'
                : indicators[anchor.id] === 'bell'
                  ? '/art/rewards/town-bell.svg'
                  : indicators[anchor.id] === 'era'
                    ? '/art/rewards/era-compass.svg'
                    : '/art/powers/tnt.svg'
          "
          alt=""
        />
      </button>
    </div>
    <div
      class="town-scene-labels"
      role="group"
      :aria-label="t(readOnly ? 'Village buildings' : 'Choose a plot or enter the mine')"
    >
      <button
        v-for="anchor in anchors"
        :disabled="readOnly"
        :key="anchor.id"
        :data-town-plot="anchor.id"
        v-show="anchor.visible"
        :style="{ left: `${anchor.x}%`, top: `${anchor.y}%` }"
        :class="{
          'scene-mine-button': anchor.id === 'mine',
          'quiet-plot': quietPlot(anchor.id),
          'suggested-plot': anchor.id === suggestedId,
          selected: anchor.id === selected,
          'is-ready': constructionReady(town.projects[anchor.id]),
          'raid-defense-ready': raidDefenseIds.includes(anchor.id),
          'can-build': availableIds.includes(anchor.id),
          'has-income': indicators[anchor.id] === 'coins',
          'has-action-icon': ['ready', 'coins', 'tnt', 'bell', 'era'].includes(
            indicators[anchor.id],
          ),
        }"
        :aria-label="
          t(
            readOnly
              ? t(anchor.id === 'mine' ? 'Mine' : BUILDING_BY_ID[anchor.id].name)
              : anchor.id === 'mine'
                ? t('Enter the mine: play level {level}', { level: nextLevel })
                : t('Choose {building}', { building: t(BUILDING_BY_ID[anchor.id].name) }),
          )
        "
        :title="t(anchor.id === 'mine' ? 'Mine' : BUILDING_BY_ID[anchor.id].shortName)"
        :aria-pressed="anchor.id === 'mine' ? undefined : anchor.id === selected"
        @click="chooseLabel(anchor.id, $event)"
      >
        <span v-if="quietPlot(anchor.id)" class="quiet-plot-plus" aria-hidden="true">+</span>
        <span class="plot-name">{{
          t(anchor.id === 'mine' ? 'Mine' : BUILDING_BY_ID[anchor.id].shortName)
        }}</span>
        <template v-if="readOnly">
          <small v-if="town.buildings[anchor.id]">{{
            t('Lv. {level}', { level: eraBuildingLevel(town, anchor.id) })
          }}</small>
        </template>
        <template v-else>
          <small v-if="anchor.id === 'mine'">{{ t('Level {level}', { level: nextLevel }) }}</small>
          <small v-else-if="constructionReady(town.projects[anchor.id])">{{
            t('Tap to finish')
          }}</small>
          <small
            v-else-if="town.projects[anchor.id]"
            class="construction-count"
            :title="
              t('Construction: {wins} of {required} mining runs completed', {
                wins: Math.min(town.projects[anchor.id].wins, 2),
                required: constructionRuns(town.projects[anchor.id]),
              })
            "
          >
            <GameIcon name="wall" />{{ Math.min(town.projects[anchor.id].wins, 2) }}/{{
              constructionRuns(town.projects[anchor.id])
            }}
          </small>
          <small v-else-if="indicators[anchor.id] === 'coins'">{{
            t('Collect {coins} coins', { coins: town.income.stored })
          }}</small>
          <small v-else-if="anchor.id === 'blacksmith' && forgeCollectible">{{
            t('Collect 1 TNT')
          }}</small>
          <small v-else-if="availableIds.includes(anchor.id)">{{
            t(town.buildings[anchor.id] ? 'Upgrade' : 'Build')
          }}</small>
          <small v-else-if="town.buildings[anchor.id]">{{
            t('Lv. {level}', { level: eraBuildingLevel(town, anchor.id) })
          }}</small>
          <span v-else aria-hidden="true">+</span>
        </template>
      </button>
    </div>
    <details class="town-camera-bar" @pointerdown.stop @pointerup.stop @pointermove.stop>
      <summary :title="t('Camera controls')">
        <GameIcon name="expand" /><span>{{ t('View') }}</span>
      </summary>
      <div
        class="town-camera-controls"
        role="group"
        :aria-label="t('Camera controls')"
        @pointerdown.stop
        @pointerup.stop
        @pointermove.stop
      >
        <button
          v-for="action in cameraActions"
          :key="action.id"
          :aria-label="t(action.label)"
          :title="t(action.label)"
          @click="scene?.cameraAction(action.id)"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="action.path" />
          </svg>
        </button>
      </div>
    </details>
  </div>
</template>
<script setup>
import GameIcon from '../GameIcon.vue';
import { townIndicatorScale } from '../../data/townIndicators';
import { eraBuildingLevel } from '../../game/town/TownEras';
import { computed, nextTick, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { BUILDING_BY_ID, BUILDINGS } from '../../data/town';
import {
  constructionRuns,
  constructionVisual,
  constructionReady,
  availablePurchases,
  nextGoal,
  buildingIndicators,
} from '../../game/town/TownRules';
import { t, locale } from '../../i18n';
import TownMap from './TownMap.vue';
const props = defineProps({
  readOnly: Boolean,
  fullscreen: Boolean,
  cinematic: Boolean,
  presentation: Object,
  active: { type: Boolean, default: true },
  town: Object,
  builderHammers: { type: Number, default: 0 },
  forgeCollectible: Boolean,
  now: { type: Number, default: Date.now },
  selected: String,
  population: Number,
  reducedMotion: Boolean,
  paused: Boolean,
  nextLevel: Number,
  mineStage: { type: Number, default: 0 },
  raid: Object,
  raidDefenseIds: { type: Array, default: () => [] },
  construction: Object,
});
const emit = defineEmits([
  'select',
  'mine',
  'raid-phase',
  'raid-cue',
  'raid-complete',
  'camera-distance',
  'presentation-ready',
  'presentation-unavailable',
  'cinematic-ready',
  'cinematic-unavailable',
]);
const eventInset = ref(null);
const canvas = ref(null),
  canvasVersion = ref(0),
  map = ref(null),
  anchors = ref([]),
  fallback = ref(false);
const suggestedId = computed(() => nextGoal(props.town)?.id);
const quietPlot = (id) =>
  id !== 'mine' &&
  id !== suggestedId.value &&
  !props.town.buildings[id] &&
  !props.town.projects[id];
const indicators = computed(() =>
  props.readOnly ? {} : buildingIndicators(props.town, props.forgeCollectible, props.now),
);
const availableIds = computed(() =>
  props.readOnly ? [] : availablePurchases(props.town, props.builderHammers).map(({ id }) => id),
);
const upgradeIds = computed(() =>
  Object.keys(indicators.value).filter((id) => indicators.value[id] === 'upgrade'),
);
const actionAnchors = computed(() =>
  anchors.value.filter(
    (anchor) =>
      ['ready', 'coins', 'tnt', 'bell', 'era'].includes(indicators.value[anchor.id]) &&
      anchor.collection.visible,
  ),
);
function collectionOrigin(id) {
  if (fallback.value) {
    const element = map.value?.$el.querySelector(`[data-town-plot="${id}"]`);
    const frame = element?.closest('.town-map-frame').getBoundingClientRect();
    const bounds = element?.getBoundingClientRect();
    if (frame && bounds)
      return {
        x: Math.max(8, Math.min(92, ((bounds.x + bounds.width / 2 - frame.x) / frame.width) * 100)),
        y: Math.max(
          20,
          Math.min(90, ((bounds.y + bounds.height / 2 - frame.y) / frame.height) * 100),
        ),
      };
  }
  const anchor = anchors.value.find((anchor) => anchor.id === id);
  const origin = anchor?.collection?.visible ? anchor.collection : anchor;
  return {
    x: Math.max(8, Math.min(92, origin?.x ?? 50)),
    y: Math.max(20, Math.min(90, origin?.y ?? 50)),
  };
}
let presentationTime = 0;
let cinematicProgress = 0;
defineExpose({
  collectionOrigin,
  cinematicFrame: (progress) => {
    cinematicProgress = progress;
    scene?.eraFrame(progress, props.reducedMotion);
  },
  presentationFrame: (time) => {
    presentationTime = time;
    scene?.presentationFrame(time, props.reducedMotion);
  },
});
const cameraActions = [
  { id: 'out', label: 'Zoom out', path: 'M6 12h12' },
  { id: 'in', label: 'Zoom in', path: 'M6 12h12M12 6v12' },
  { id: 'left', label: 'Rotate left', path: 'm8 7-4 4 4 4M4 11h10a5 5 0 0 1 0 10' },
  { id: 'right', label: 'Rotate right', path: 'm16 7 4 4-4 4m4-4H10a5 5 0 0 0 0 10' },
  { id: 'reset', label: 'Reset view', path: 'M4 9a8 8 0 1 1 0 6M4 4v5h5M12 9v3l2 2' },
];
let lastVisual = '';
let lastConstruction;
let scene,
  disposed = false,
  dragged = false;
const pointers = new Map();
const villagerLabel = ref(null);
const choose = (id) => {
  if (!props.readOnly) id === 'mine' ? emit('mine') : emit('select', id);
};
const chooseLabel = (id, event) => {
  // Pointer taps are settled on pointerup; keep native keyboard/AT activation.
  if (event.detail === 0) choose(id);
};
const rememberPointer = (event) => {
  pointers.delete(event.pointerId);
  if (!pointers.size) dragged = false;
  pointers.set(event.pointerId, [
    event.clientX,
    event.clientY,
    event.target.closest('[data-town-plot]')?.dataset.townPlot,
  ]);
  if (pointers.size > 1 || event.button !== 0 || event.shiftKey || event.ctrlKey || event.metaKey)
    dragged = true;
};
const movePointer = (event) => {
  if (!pointers.size && event.pointerType === 'mouse')
    scene?.showVillager(event.clientX, event.clientY);
  const start = pointers.get(event.pointerId);
  if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) dragged = true;
};
const leavePointer = (event) => {
  if (!pointers.size && event.pointerType === 'mouse') scene?.showVillager(-Infinity, -Infinity);
};
const pick = (event) => {
  movePointer(event);
  const start = pointers.get(event.pointerId);
  const tap = start && !dragged;
  pointers.delete(event.pointerId);
  if (tap && !props.readOnly) {
    if (start[2]) choose(start[2]);
    else scene?.pick(event.clientX, event.clientY);
  }
};
const cancelPointer = (event) => {
  if (!pointers.has(event.pointerId)) return;
  dragged = true;
  pointers.delete(event.pointerId);
};
const cameraKey = (event) => {
  const action = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    '+': 'in',
    '=': 'in',
    '-': 'out',
    Home: 'reset',
  }[event.key];
  if (!action) return;
  event.preventDefault();
  scene?.cameraAction(action);
};
function update() {
  if (fallback.value) {
    emit('cinematic-unavailable');
    emit('cinematic-ready');
    emit('presentation-unavailable');
    emit('presentation-ready');
    return;
  }
  if (!scene || !props.active) return;
  const labels = Object.fromEntries(
    BUILDINGS.map((building) => [building.id, t(building.shortName)]),
  );
  const visual =
    props.mineStage +
    JSON.stringify(
      BUILDINGS.map(({ id }) => [
        id,
        props.town.buildings[id],
        constructionVisual(props.town.projects[id]),
        labels[id],
        props.town.buildingEras[id],
        props.town.buildingEraLevels?.[id],
      ]),
    ) +
    props.town.era;
  const newConstruction = props.construction?.serial !== lastConstruction;
  if (visual !== lastVisual || newConstruction) {
    scene.update(
      props.town,
      { ...labels, mine: t('Mine') },
      props.mineStage,
      newConstruction && !props.reducedMotion ? props.construction?.id : null,
    );
    lastVisual = visual;
    lastConstruction = props.construction?.serial;
  }
  scene.setPresentation(props.presentation);
  if (props.presentation) {
    scene.presentationFrame(presentationTime, props.reducedMotion);
    emit('presentation-ready');
  }
  scene.setCinematic(props.cinematic, props.town.transition);
  if (props.cinematic) {
    scene.eraFrame(cinematicProgress, props.reducedMotion);
    emit('cinematic-ready');
  }
  scene.setAvailable([...availableIds.value, ...(props.town.income.stored > 0 ? ['saloon'] : [])]);
  scene.setUpgradeable(props.cinematic ? [] : upgradeIds.value);
  scene.select(props.selected);
  scene.setMotion(!props.paused && !props.reducedMotion);
  scene.setPaused(props.paused);
}
let initializing = false;
let recovering = false;
let recoveryAttempts = 0;
let recoveryPose;
async function recoverGraphics(error, contextLost = false) {
  if (disposed || fallback.value || recovering) return;
  if (!contextLost || recoveryAttempts++ >= 2) {
    useFallback(error);
    return;
  }
  recovering = true;
  if (scene) {
    recoveryPose = {
      position: scene.camera.position.toArray(),
      target: scene.controls.target.toArray(),
      overview: scene.overview,
    };
    scene.dispose();
    scene = null;
  }
  lastVisual = '';
  lastConstruction = undefined;
  anchors.value = [];
  canvasVersion.value++;
  await nextTick();
  recovering = false;
  initialize();
}
function useFallback(error) {
  if (disposed || fallback.value) return;
  fallback.value = true;
  emit('cinematic-unavailable');
  emit('cinematic-ready');
  emit('presentation-unavailable');
  emit('presentation-ready');
  // Let an in-progress render finish unwinding before releasing its resources.
  nextTick(() => {
    scene?.dispose();
    scene = null;
  });
  if (props.raid) emit('raid-phase', 'The raid has passed');
  console.warn('3D town unavailable; using the accessible SVG scene.', error);
}
async function initialize() {
  if (scene || initializing || recovering || disposed || !props.active || fallback.value) return;
  initializing = true;
  try {
    const { TownDiorama } = await import('../../game/town/TownDiorama');
    if (disposed || !props.active) return;
    scene = new TownDiorama(
      canvas.value,
      choose,
      (positions) => {
        anchors.value = positions;
      },
      (distance) => emit('camera-distance', distance),
      recoverGraphics,
    );
    scene.onVillagerLabel = (label) => {
      villagerLabel.value = label;
    };
    scene.onEventInset = (view) => {
      eventInset.value = view;
    };
    update();
    scene.vipArrivals?.reset(true);
    if (recoveryPose) {
      scene.camera.position.fromArray(recoveryPose.position);
      scene.controls.target.fromArray(recoveryPose.target);
      scene.overview = recoveryPose.overview;
      scene.controls.update();
      scene.render();
      recoveryPose = null;
    }
    startRaid();
  } catch (error) {
    useFallback(error);
  } finally {
    initializing = false;
  }
}
onMounted(initialize);
watch(
  () => props.active,
  (active) => {
    if (!active) {
      scene?.vipArrivals?.reset();
      return;
    }
    if (!scene) initialize();
    else {
      update();
      scene.vipArrivals?.reset(true);
      // A context restored while hidden also needs a frame in reduced-motion mode.
      if (!scene.resize()) scene.render();
    }
  },
  { flush: 'post' },
);
function startRaid() {
  scene?.stopRaid();
  if (!props.raid || !props.active) return;
  if (props.reducedMotion || fallback.value) {
    emit('raid-phase', 'The raid has passed');
    return;
  }
  if (scene)
    scene.playRaid(
      props.raid,
      (phase) => emit('raid-phase', phase),
      () => emit('raid-complete'),
      (cue) => emit('raid-cue', cue),
    );
}
watch(
  () => [availableIds.value, props.town.income.stored > 0],
  () => {
    if (props.active)
      scene?.setAvailable([
        ...availableIds.value,
        ...(props.town.income.stored > 0 ? ['saloon'] : []),
      ]);
  },
);
watch(
  () => props.presentation?.id,
  () => {
    presentationTime = 0;
    update();
  },
);
watch(
  () => props.cinematic,
  (value) => {
    cinematicProgress = 0;
    scene?.setCinematic(value, props.town.transition);
    if (value && scene) emit('cinematic-ready');
    if (value && fallback.value) {
      emit('cinematic-unavailable');
      emit('cinematic-ready');
    }
    scene?.setUpgradeable(value ? [] : upgradeIds.value);
  },
);
watch(upgradeIds, (ids) => {
  if (props.active) scene?.setUpgradeable(props.cinematic ? [] : ids);
});
watch(
  () => props.raid,
  (raid, previous) => {
    if (raid && previous && raid.id === previous.id) scene?.updateRaid(raid);
    else startRaid();
  },
);
watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced) scene?.finishConstruction();
    if (reduced && props.raid) {
      scene?.stopRaid();
      emit('raid-phase', 'The raid has passed');
    }
  },
);
watch(
  () => [
    JSON.stringify(props.town.buildings),
    JSON.stringify(props.town.projects),
    JSON.stringify(props.town.buildingEras),
    JSON.stringify(props.town.buildingEraLevels),
    props.town.era,
    props.mineStage,
    props.construction?.serial,
    locale.value,
  ],
  update,
);
watch(
  () => props.selected,
  (id) => {
    if (!props.paused) scene?.select(id);
  },
);
watch(
  () => props.paused || props.reducedMotion,
  (paused) => scene?.setMotion(!paused),
);
watch(
  () => props.paused,
  (paused) => {
    scene?.setPaused(paused);
    if (!paused) scene?.select(props.selected);
  },
);
onBeforeUnmount(() => {
  disposed = true;
  scene?.dispose();
  scene = null;
});
</script>

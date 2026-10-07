<template>
  <div
    ref="sceneElement"
    class="town-scene"
    :class="{ 'is-raiding': raid && !reducedMotion, 'is-read-only': readOnly }"
    :aria-label="t(readOnly ? 'Village visit · view only' : 'Interactive 3D town')"
    @mousedown.middle.prevent
    @auxclick.middle.prevent
    @pointerdown="rememberPointer"
    @pointermove="movePointer"
    @pointerleave="leavePointer"
    @pointerup="pick"
    @pointercancel="cancelPointer"
    @lostpointercapture="cancelPointer"
  >
    <div v-if="unavailable" class="town-graphics-unavailable" role="alert">
      <p>{{ t('The village needs 3D graphics, which could not start on this device.') }}</p>
      <span>
        <button type="button" @click="retryGraphics">{{ t('Try again') }}</button>
        <button v-if="!readOnly" type="button" @click="$emit('mine')">
          {{ t('Enter the mine') }}
        </button>
      </span>
    </div>
    <GameViewStatus
      v-else-if="!graphicsReady"
      class="town-graphics-loading"
      label="Preparing your village…"
    />
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
      :role="eventInset.passive ? 'button' : 'img'"
      :tabindex="eventInset.passive ? 0 : undefined"
      :aria-label="eventInset.passive ? t('Show visitor nametag') : t(eventInset.label)"
      @click.stop="eventInset.passive && scene?.selectInsetVisitor()"
      @keydown.enter.prevent.stop="eventInset.passive && scene?.selectInsetVisitor()"
      @keydown.space.prevent.stop="eventInset.passive && scene?.selectInsetVisitor()"
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
      ref="villagerElement"
      class="villager-name"
      role="status"
      :style="{ left: `${villagerLabel.x}%`, top: `${villagerLabel.y}%` }"
      ><template v-if="!villagerLabel.live">{{ t('VIP visitor') }} · </template
      >{{ villagerLabel.name }}</span
    >
    <span
      v-if="plaqueLabel"
      class="villager-name"
      role="status"
      :style="{ left: `${plaqueLabel.x}%`, top: `${plaqueLabel.y}%` }"
      >{{ t(plaqueLabel.name) }}</span
    >
    <div class="town-action-icons">
      <button
        v-for="anchor in actionAnchors"
        :key="anchor.id"
        :ref="(element) => trackElement(actionElements, anchor.id, element)"
        class="town-action-icon"
        :class="[
          TOWN_ACTIONS[indicators[anchor.id]].class,
          { 'raid-defense-ready': raidDefenseIds.includes(anchor.id) },
        ]"
        :data-town-plot="anchor.id"
        :style="{
          translate: labelTranslate(anchor.collection),
          '--action-scale': TOWN_ACTIONS[indicators[anchor.id]].scale,
        }"
        :aria-label="actionLabel(anchor.id)"
        @focus="anchor.id === 'mine' && prefetchBoard()"
        @pointerenter="anchor.id === 'mine' && prefetchBoard()"
        @pointerdown="anchor.id === 'mine' && prefetchBoard()"
        @click="chooseLabel(anchor.id, $event)"
      >
        <img :src="TOWN_ACTIONS[indicators[anchor.id]].icon" alt="" />
      </button>
    </div>
    <div
      class="town-scene-labels"
      role="group"
      :aria-label="t(readOnly ? 'Village buildings' : 'Choose a plot or enter the mine')"
    >
      <button
        v-for="anchor in anchors"
        :key="anchor.id"
        :ref="(element) => trackElement(labelElements, anchor.id, element)"
        :data-town-plot="anchor.id"
        v-show="anchor.visible"
        :style="{ translate: labelTranslate(anchor) }"
        :class="{
          'scene-mine-button': anchor.id === 'mine',
          'quiet-plot': quietPlot(anchor.id),
          'suggested-plot': anchor.id === suggestedId,
          selected: anchor.id === selected,
          'is-ready': constructionReady(town.projects[anchor.id]),
          'raid-defense-ready': raidDefenseIds.includes(anchor.id),
          'can-build': availableIds.includes(anchor.id),
          'has-income': indicators[anchor.id] === 'coins',
          'has-action-icon': !!TOWN_ACTIONS[indicators[anchor.id]],
        }"
        :aria-label="plotLabel(anchor.id)"
        :title="placeName(anchor.id)"
        :aria-pressed="anchor.id === 'mine' ? undefined : anchor.id === selected"
        @focus="anchor.id === 'mine' && prefetchBoard()"
        @pointerenter="anchor.id === 'mine' && prefetchBoard()"
        @pointerdown="anchor.id === 'mine' && prefetchBoard()"
        @click="chooseLabel(anchor.id, $event)"
      >
        <span v-if="quietPlot(anchor.id)" class="quiet-plot-plus" aria-hidden="true">+</span>
        <span class="plot-name">{{ placeName(anchor.id) }}</span>
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
          <small v-else-if="needHints[anchor.id]" class="need-hint">{{
            t(NEED_HINTS[needHints[anchor.id]])
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
    <div
      v-if="needChips.length || moon.homesteads"
      class="town-map-needs"
      role="group"
      :aria-label="t('Basic town needs')"
      @pointerdown.stop
      @pointerup.stop
    >
      <button
        v-for="chip in needChips"
        :key="chip.stat"
        :class="{ short: chip.short }"
        :aria-label="chip.label"
        :title="chip.label"
        @click="emit('inspect', chip.id)"
      >
        <TownIcon :name="chip.icon" /><span>{{ chip.value }}</span>
      </button>
      <button
        v-if="moon.homesteads"
        class="moon"
        :aria-label="moonLabel"
        :title="moonLabel"
        @click="openMoon"
      >
        <TownMoon :lights="moon.lights" /><span>{{ moon.homesteads }}</span>
      </button>
    </div>
    <button
      v-if="skyMoon && !moonOpen"
      type="button"
      class="town-sky-moon"
      :style="{ left: `${skyMoon.x}%`, top: `${skyMoon.y}%` }"
      :aria-label="moonLabel"
      :title="moonLabel"
      @pointerdown.stop
      @pointerup.stop
      @click="openMoon"
    >
      <TownMoon :lights="moon.lights" :light-size="0.5" />
    </button>
    <TownMoonView
      v-if="moonOpen"
      ref="moonView"
      :town="town"
      :active="active"
      :paused="paused"
      :reduced-motion="reducedMotion"
      @inspect="emit('inspect', $event)"
      @close="closeMoon"
    />
  </div>
</template>
<script setup>
import { ERAS } from '../../data/eras';
import { loadFootprints } from '../../game/town/FootprintCatalog';
import { loadFamilies, requiredFamilies } from '../../game/town/assets/MeshCatalog';
import { performanceMark, afterPaint, scheduleWork } from '../../game/PresentationWork';
import { prefetchBoard } from '../../game/phaser/loadBoard';
import { prepareAudio } from '../../composables/useAudio';
import { useSettingsStore } from '../../stores/settingsStore';
import GameIcon from '../GameIcon.vue';
import TownIcon from './TownIcon.vue';
import TownMoon from './TownMoon.vue';
import TownMoonView from './TownMoonView.vue';
import { moonSettlement } from '../../data/moonSettlement';
import GameViewStatus from '../GameViewStatus.vue';
import { TOWN_ACTIONS } from '../../data/townIndicators';
import { eraBuildingLevel, plotInEra } from '../../game/town/TownEras';
import {
  computed,
  inject,
  nextTick,
  onMounted,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  labelBox,
  placeLabels,
  sameIndicators,
  trackElement,
  updateLabels,
} from '../../game/town/TownLabels';
import { BUILDING_BY_ID, EARTH_BUILDINGS, MOON_BUILDINGS } from '../../data/town';
import { dressSpaceHelmet } from '../../game/town/TownSpaceHelmet';
import {
  constructionRuns,
  constructionVisual,
  constructionReady,
  availablePurchases,
  openOffers,
  nextGoal,
  buildingIndicators,
} from '../../game/town/TownRules';
import { t, locale } from '../../i18n';
const props = defineProps({
  readOnly: Boolean,
  // Buildings a read-only visitor may still tap, for example to collect the saloon.
  visitorTaps: { type: Array, default: () => [] },
  liveVisitors: { type: Array, default: () => [] },
  liveVisitorTownId: String,
  cinematic: Boolean,
  presentation: Object,
  active: { type: Boolean, default: true },
  town: Object,
  builderHammers: { type: Number, default: 0 },
  forgeCollectible: Boolean,
  now: { type: Number, default: Date.now },
  selected: String,
  reducedMotion: Boolean,
  paused: Boolean,
  nextLevel: Number,
  raid: Object,
  raidDefenseIds: { type: Array, default: () => [] },
  construction: Object,
  // Water, food and happiness against the town's size, always visible on the map.
  needChips: { type: Array, default: () => [] },
});
// New Hollow's homesteads on the Moon, supplied by the space elevator.
const moon = computed(() => moonSettlement(props.town));
const moonReachable = computed(() =>
  MOON_BUILDINGS.some((building) => plotInEra(props.town, building.id)),
);
const moonLabel = computed(() =>
  t(
    moonReachable.value
      ? 'Visit New Hollow on the Moon: {count} homesteads'
      : 'New Hollow on the Moon: {count} homesteads',
    { count: moon.value.homesteads },
  ),
);
// The Moon map opens over the valley once the town can build there; before that
// the chip shows the space elevator. The valley rests while the Moon is open.
const moonOpen = ref(false);
function openMoon() {
  if (!moonReachable.value) return emit('inspect', 'spaceElevator');
  moonOpen.value = true;
}
function closeMoon() {
  moonOpen.value = false;
}
watch(moonOpen, () => scene?.setMotion(motionEnabled()));
watch(moonReachable, (reachable) => {
  if (!reachable) moonOpen.value = false;
});
// The Moon hangs in the valley sky to the north-west, above the mine and the
// elevator. It drifts across the sky as the camera turns and opens New Hollow.
const skyMoon = ref(null);
function placeSkyMoon() {
  if (!scene?.skyPoint || !moon.value.homesteads) return (skyMoon.value = null);
  const { x, y, facing, distance } = scene.skyPoint(-0.55, -1);
  // Sky shows at the top of the frame once the view is wide (the land fades into the
  // sky) or tilted until the horizon is in view; close up, the frame is all town.
  const skyInView = distance > 95 || y > 8;
  skyMoon.value =
    skyInView && facing > 0.3 && x > 6 && x < 94
      ? { x, y: Math.min(Math.max(y - 9, 13), 34) }
      : null;
}
watch(() => moon.value.homesteads, placeSkyMoon);
const motionEnabled = () => props.active && !document.hidden && !props.paused && !moonOpen.value;
// The building that would fix a shortage says so on its label.
const NEED_HINTS = { water: 'Water needed', food: 'Food needed', comfort: 'Comfort needed' };
const needHints = computed(() =>
  Object.fromEntries(
    props.needChips
      .filter((chip) => chip.short && chip.fixable)
      .map((chip) => [chip.id, chip.stat]),
  ),
);
const emit = defineEmits([
  'select',
  'visit',
  'inspect',
  'mine',
  'raid-phase',
  'raid-cue',
  'raid-complete',
  'camera-distance',
  'vip-spend',
  'guest-vip',
  // The space-helmet wearer was tapped, with its position on the map in percent.
  'helmet',
  'presentation-ready',
  'presentation-unavailable',
  'cinematic-ready',
  'cinematic-unavailable',
]);
const eventInset = ref(null);
// Camera frames move labels directly; Vue re-renders only when their layout changes.
const labelElements = new Map(),
  actionElements = new Map();
let anchorLayout = '';
const canvas = ref(null),
  canvasVersion = ref(0),
  anchors = shallowRef([]),
  unavailable = ref(false),
  graphicsReady = ref(false);
const suggestedId = computed(() => nextGoal(props.town)?.id);
const quietPlot = (id) =>
  id !== 'mine' &&
  id !== suggestedId.value &&
  !props.town.buildings[id] &&
  !props.town.projects[id];
// Purchases depend on the town only; the village's one-second clock (provided by
// TownView) just re-checks cooldowns. Unchanged indicators keep the same object, so
// the labels re-render only when an action actually appears or disappears.
const offers = computed(() => openOffers(props.town));
const townPurchases = computed(() => availablePurchases(props.town, 0, offers.value));
const townClock = inject('townClock', null);
const indicators = computed((previous) => {
  // A visitor sees only the coins of buildings they may collect for the owner.
  const next = props.readOnly
    ? Object.fromEntries(props.visitorTaps.map((id) => [id, 'coins']))
    : buildingIndicators(
        props.town,
        props.forgeCollectible,
        townClock?.value ?? props.now,
        townPurchases.value,
      );
  return previous && sameIndicators(previous, next) ? previous : next;
});
const availableIds = computed(() =>
  props.readOnly
    ? []
    : availablePurchases(props.town, props.builderHammers, offers.value).map(({ id }) => id),
);
const upgradeIds = computed(() =>
  Object.keys(indicators.value).filter((id) => indicators.value[id] === 'upgrade'),
);
const actionAnchors = computed(() =>
  anchors.value.filter(
    (anchor) => TOWN_ACTIONS[indicators.value[anchor.id]] && anchor.collection.visible,
  ),
);
const buildingName = (id) => t(BUILDING_BY_ID[id].shortName);
const ACTION_LABELS = {
  ready: (id) => t('Finish {building}', { building: buildingName(id) }),
  coins: () => t('Collect {coins} coins', { coins: props.town.income.stored }),
  tnt: () => t('Collect 1 TNT'),
  bell: () => t('Ring town bell · halve the loss'),
  era: () => t('Advance to the next era'),
};
const actionLabel = (id) =>
  props.readOnly
    ? t('Collect the saloon takings for the mayor')
    : ACTION_LABELS[indicators.value[id]](id);
const placeName = (id) => t(id === 'mine' ? 'Mine' : BUILDING_BY_ID[id].shortName);
const plotLabel = (id) => {
  if (props.readOnly) return t(id === 'mine' ? 'Mine' : BUILDING_BY_ID[id].name);
  return id === 'mine'
    ? t('Enter the mine: play level {level}', { level: props.nextLevel })
    : t('Choose {building}', { building: t(BUILDING_BY_ID[id].name) });
};
// Labels sit at the scene's top-left corner and move with `translate`, which the
// browser composites without laying out the page on every camera frame.
const box = labelBox();
const labelTranslate = (point) => box.translate(point);
function collectionOrigin(id) {
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
  // Moon buildings have no valley lot: focusing one opens the Moon map instead.
  focusPlace: (id) => {
    if (MOON_BUILDINGS.some((building) => building.id === id)) {
      moonOpen.value = true;
      return true;
    }
    return scene?.focusPlace(id);
  },
  openMoon,
  closeMoon,
  findVisitor: (id) => scene?.findVisitor(id) ?? false,
  // Camera buttons are gone: drag, pinch, wheel and keys move the view; Village resets it.
  resetView: () => scene?.cameraAction('reset'),
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
let lastVisual = '';
let lastConstruction;
let scene,
  disposed = false,
  dragged = false;
const pointers = new Map();
// A named villager moves every frame; Vue re-renders only when the name changes.
const villagerLabel = shallowRef(null),
  villagerElement = ref(null),
  plaqueLabel = shallowRef(null);
function showVillagerLabel(label) {
  const current = villagerLabel.value;
  if (!label || !current || label.name !== current.name || label.live !== current.live) {
    villagerLabel.value = label;
    return;
  }
  Object.assign(current, label);
  const element = villagerElement.value;
  if (element) {
    element.style.left = `${label.x}%`;
    element.style.top = `${label.y}%`;
  }
}
const choose = (id) => {
  if (!props.readOnly) id === 'mine' ? emit('mine') : emit('select', id);
  // A visitor may collect what visitorTaps allows; any other tap only looks at the building.
  else emit(props.visitorTaps.includes(id) ? 'visit' : 'inspect', id);
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
    scene?.hoverVillager(event.clientX, event.clientY);
  const start = pointers.get(event.pointerId);
  if (start && Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 6) dragged = true;
};
const leavePointer = (event) => {
  if (!pointers.size && event.pointerType === 'mouse') scene?.hoverVillager(-Infinity, -Infinity);
};
const pick = (event) => {
  movePointer(event);
  const start = pointers.get(event.pointerId);
  const tap = start && !dragged;
  pointers.delete(event.pointerId);
  if (tap) {
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
let updateGeneration = 0;
const settings = useSettingsStore();
async function update() {
  const generation = ++updateGeneration;
  if (unavailable.value) {
    emit('cinematic-unavailable');
    emit('cinematic-ready');
    emit('presentation-unavailable');
    emit('presentation-ready');
    return;
  }
  if (!scene || !props.active) return;
  const labels = Object.fromEntries(
    EARTH_BUILDINGS.map((building) => [building.id, t(building.shortName)]),
  );
  const visual =
    props.nextLevel +
    JSON.stringify(
      EARTH_BUILDINGS.map(({ id }) => [
        id,
        props.town.buildings[id],
        constructionVisual(props.town.projects[id]),
        labels[id],
        props.town.buildingEras[id],
        props.town.buildingEraLevels?.[id],
      ]),
    ) +
    props.town.era +
    JSON.stringify([
      props.town.personalisation,
      props.town.displayHonours,
      props.town.displayDistinctions,
    ]);
  const newConstruction = props.construction?.serial !== lastConstruction;
  if (visual !== lastVisual || newConstruction) {
    const constructionId = newConstruction ? props.construction?.id : null;
    if (constructionId) {
      scene.beginConstructionCue(constructionId);
      await new Promise((resolve) => afterPaint(resolve));
      if (disposed || generation !== updateGeneration || !props.active) return;
      performanceMark('first-build-frame');
    }
    if (
      !(await loadFamilies(requiredFamilies(props.town), {
        isCurrent: () => !disposed && generation === updateGeneration && props.active,
      }))
    )
      return;
    await loadFootprints(props.town);
    if (disposed || generation !== updateGeneration || !props.active) return;
    scene.changeTown(
      props.town,
      { ...labels, mine: t('Mine') },
      Math.max(0, (props.nextLevel ?? 1) - 1),
      constructionId,
      props.reducedMotion,
    );
    lastVisual = visual;
    lastConstruction = props.construction?.serial;
  }
  // A visitor watches the helmet move after the owner's puzzles; the owner's own
  // town only changes while they are in the mine.
  scene.animateCostumes = props.readOnly && !props.reducedMotion;
  dressSpaceHelmet(scene, props.town, { animate: scene.animateCostumes });
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
  scene.setMotion(motionEnabled());
  scene.setPaused(props.paused);
}
const warmAudio = () => prepareAudio(settings);
let initializing = false;
let recovering = false;
let recoveryAttempts = 0;
let recoveryPose;
async function recoverGraphics(error, contextLost = false) {
  if (disposed || unavailable.value || recovering) return;
  if (!contextLost || recoveryAttempts++ >= 2) {
    showUnavailable(error);
    return;
  }
  recovering = true;
  graphicsReady.value = false;
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
  anchorLayout = '';
  canvasVersion.value++;
  await nextTick();
  recovering = false;
  initialize();
}
// Without 3D the village cannot be shown: say so and let the player retry. Cinematics
// and raids still end, so nothing waits on a scene that is not there.
function showUnavailable(error) {
  if (disposed || unavailable.value) return;
  unavailable.value = true;
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
  console.warn('3D town unavailable.', error);
}
async function retryGraphics() {
  unavailable.value = false;
  recoveryAttempts = 0;
  graphicsReady.value = false;
  lastVisual = '';
  lastConstruction = undefined;
  anchors.value = [];
  anchorLayout = '';
  canvasVersion.value++;
  await nextTick();
  initialize();
}
async function initialize() {
  if (scene || initializing || recovering || disposed || !props.active || unavailable.value) return;
  initializing = true;
  try {
    const { TownDiorama } = await import('../../game/town/TownDiorama');
    performanceMark('town-module-ready');
    await loadFamilies(requiredFamilies(props.town));
    await loadFootprints(props.town);
    performanceMark('assets-ready');
    if (disposed || !props.active) return;
    scene = new TownDiorama(canvas.value, {
      onSelect: choose,
      onLabels: (positions) => {
        placeSkyMoon();
        const layout = updateLabels(anchors.value, positions, anchorLayout);
        if (layout === null) placeLabels(anchors.value, labelElements, actionElements, box);
        else {
          anchorLayout = layout;
          anchors.value = positions;
        }
      },
      onCameraDistance: (distance) => emit('camera-distance', distance),
      onUnavailable: recoverGraphics,
      onVipSpend: (receipt) => emit('vip-spend', receipt),
      onGuestVip: (at) => emit('guest-vip', at),
      onHelmet: (origin) => emit('helmet', origin),
      onVillagerLabel: showVillagerLabel,
      onPlaqueLabel: (label) => {
        plaqueLabel.value = label;
      },
      onEventInset: (view) => {
        eventInset.value = view;
      },
      // Once the village is on screen, warm up what the player is likely to open next.
      onFirstFrame: () =>
        scheduleWork(
          (function* () {
            yield;
            prefetchBoard();
            const next = ERAS[ERAS.findIndex((era) => era.id === props.town.era) + 1];
            if (next?.enabled) loadFamilies(requiredFamilies({ ...props.town, era: next.id }));
            if (navigator.userActivation?.hasBeenActive) prepareAudio(settings);
            else document.addEventListener('pointerdown', warmAudio, { once: true, passive: true });
          })(),
        ),
      // A shared town is only a view: VIP guests visit the owner's own game.
      vipsHidden: props.readOnly,
    });
    scene.setLiveVisitors(props.liveVisitors, props.reducedMotion, props.liveVisitorTownId);
    await update();
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
    graphicsReady.value = true;
  } catch (error) {
    showUnavailable(error);
  } finally {
    initializing = false;
  }
}
const visibilityChanged = () => {
  scene?.setMotion(motionEnabled());
};
watch(
  () => [props.liveVisitors, props.liveVisitorTownId, props.reducedMotion, locale.value],
  () => {
    scene?.setLiveVisitors(props.liveVisitors, props.reducedMotion, props.liveVisitorTownId);
  },
);
const sceneElement = ref(null);
onMounted(() => {
  box.observe(sceneElement.value);
  document.addEventListener('visibilitychange', visibilityChanged);
  initialize();
});
watch(
  () => props.active,
  (active) => {
    if (!active) {
      updateGeneration++;
      scene?.setMotion(false);
      scene?.vipArrivals?.reset();
      return;
    }
    if (!scene) initialize();
    else {
      update();
      scene.vipArrivals?.reset(true);
      if (!scene.resize()) scene.render();
    }
  },
  { flush: 'post' },
);
function startRaid() {
  scene?.stopRaid();
  if (!props.raid || !props.active) return;
  if (props.reducedMotion || unavailable.value) {
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
    if (value && unavailable.value) {
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
    props.town.completedRuns,
    props.nextLevel,
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
  () => props.paused,
  (paused) => {
    visibilityChanged();
    scene?.setPaused(paused);
    if (!paused) scene?.select(props.selected);
  },
);
onBeforeUnmount(() => {
  box.disconnect();
  disposed = true;
  updateGeneration++;
  document.removeEventListener('visibilitychange', visibilityChanged);
  document.removeEventListener('pointerdown', warmAudio);
  scene?.dispose();
  scene = null;
});
</script>
<style scoped>
.town-graphics-unavailable {
  position: absolute;
  inset: 0;
  z-index: 3;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.8rem;
  padding: 1.5rem;
  text-align: center;
  background: #eadab5;
  color: #4b3d24;
}
.town-graphics-unavailable span {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.6rem;
}
.town-graphics-unavailable button {
  font: inherit;
  padding: 0.55rem 1rem;
  border: 1px solid #b59a66;
  border-radius: 9px;
  background: #fff6dc;
  color: inherit;
  cursor: pointer;
}
.town-graphics-loading {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
</style>

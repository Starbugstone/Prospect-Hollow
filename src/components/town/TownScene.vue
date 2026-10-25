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
      ref="plaqueElement"
      class="villager-name"
      role="status"
      :style="{ left: `${plaqueLabel.x}%`, top: `${plaqueLabel.y}%` }"
      >{{ t(plaqueLabel.name) }}</span
    >
    <div class="town-action-icons">
      <TownActionIcon
        v-for="anchor in actionAnchors"
        :key="anchor.id"
        :ref="(icon) => trackElement(actionElements, anchor.id, icon?.$el)"
        :indicator="indicators[anchor.id]"
        :label="actionLabel(anchor.id)"
        :class="{ 'raid-defense-ready': raidDefenseIds.includes(anchor.id) }"
        :data-town-plot="anchor.id"
        :style="{ translate: labelTranslate(anchor.collection) }"
        @focus="anchor.id === 'mine' && prefetchBoard()"
        @pointerenter="anchor.id === 'mine' && prefetchBoard()"
        @pointerdown="anchor.id === 'mine' && prefetchBoard()"
        @click="chooseLabel(anchor.id, $event)"
      />
    </div>
    <div
      class="town-scene-labels"
      role="group"
      :aria-label="t(readOnly ? 'Village buildings' : 'Choose a plot or enter the mine')"
    >
      <button
        v-for="anchor in plotAnchors"
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
        <TownLabelStatus :status="labelStatus[anchor.id]" />
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
        @click="emit('locate', chip.id)"
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
      ref="skyMoonElement"
      type="button"
      class="town-sky-moon"
      :style="{ left: `${skyMoon.x}%`, top: `${skyMoon.y}%`, height: `${skyMoon.size}%` }"
      :aria-label="moonLabel"
      :title="moonLabel"
      @pointerdown.stop
      @pointerup.stop
      @click="openMoon"
    ></button>
    <TownMoonView
      v-if="moonOpen"
      ref="moonView"
      :town="town"
      :selected="selected"
      :presentation="moonPresentation"
      @presentation-ready="emit('presentation-ready')"
      @presentation-unavailable="emit('presentation-unavailable')"
      :active="active"
      :paused="paused"
      :reduced-motion="reducedMotion"
      :indicators="indicators"
      :available-ids="availableIds"
      :upgrade-ids="cinematic ? [] : upgradeIds"
      :read-only="readOnly"
      @select="choose($event)"
      @inspect="emit('inspect', $event)"
      @close="closeMoon"
      @vip-spend="emit('vip-spend', $event)"
      @villager-label="showMoonVillagerLabel"
    />
  </div>
</template>
<script setup>
import { eventSettlement } from '../../game/town/TownEventSettlement';
import { ERAS } from '../../data/eras';
import { loadFootprints } from '../../game/town/FootprintCatalog';
import { loadFamilies, requiredFamilies } from '../../game/town/assets/MeshCatalog';
import { performanceMark, afterPaint, scheduleWork } from '../../game/PresentationWork';
import { prefetchBoard } from '../../game/phaser/loadBoard';
import { prepareAudio } from '../../composables/useAudio';
import { useSettingsStore } from '../../stores/settingsStore';
import TownIcon from './TownIcon.vue';
import TownMoon from './TownMoon.vue';
import TownMoonView from './TownMoonView.vue';
import TownActionIcon from './TownActionIcon.vue';
import TownLabelStatus from './TownLabelStatus.vue';
import { moonSettlement } from '../../data/moonSettlement';
import GameViewStatus from '../GameViewStatus.vue';
import { TOWN_ACTIONS, buildingActionLabel } from '../../data/townIndicators';
import { buildingStatus } from '../../game/town/TownBuildingFeedback';
import { plotInEra } from '../../game/town/TownEras';
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
import { AREA_BY_ID } from '../../data/townLandmarks';
import { dressSpaceHelmet } from '../../game/town/TownSpaceHelmet';
import { createTapGesture, keyboardActivation } from '../../game/town/TownTapGesture';
import { cameraKeyAction } from '../../game/town/TownCameraKeys';
import { useGraphicsRecovery } from '../../composables/useGraphicsRecovery';
import {
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
  // The plot the village tutorial points at: framed on phones and always labelled.
  coachPlot: String,
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
const moonView = ref(null);
const moonPresentation = computed(() =>
  eventSettlement(props.presentation) === 'moon' ? props.presentation : null,
);
const valleyPresentation = computed(() =>
  eventSettlement(props.presentation) === 'valley' ? props.presentation : null,
);
function openMoon() {
  if (props.raid || props.cinematic || valleyPresentation.value) return;
  if (!moonReachable.value) return emit('locate', 'spaceElevator');
  moonOpen.value = true;
}
function closeMoon() {
  moonOpen.value = false;
}
watch(
  moonOpen,
  (open) => {
    emit('settlement-change', open ? 'moon' : 'valley');
    // The other map's named VIP is no longer on screen; the valley names its own again.
    showVillagerLabel(null);
    scene?.setMotion(motionEnabled());
    // The Moon's drags, wheel and pinches belong to the Moon's camera.
    scene?.setCovered(open);
    if (!open) scene?.projectVillager();
  },
  { flush: 'sync' },
);
watch(moonReachable, (reachable) => {
  if (!reachable) moonOpen.value = false;
});
// The Moon hangs in the valley sky to the north-west, above the mine and the
// elevator. It drifts across the sky as the camera turns and opens New Hollow.
const skyMoon = shallowRef(null),
  skyMoonElement = ref(null);
function placeSkyMoon() {
  // The Moon is drawn in the scene, fixed in the world; this button is its tap target
  // and follows it on screen, leaving with it when the camera turns or tilts away.
  const point = moon.value.homesteads ? scene?.skyMoonPoint?.() : null;
  followLabel(
    skyMoon,
    skyMoonElement,
    point?.visible ? { x: point.x, y: point.y, size: point.radius * 2 } : null,
  );
}
// New Hollow's homesteads light up the painted Moon; its button follows on screen.
watch(
  () => moon.value.homesteads,
  () => {
    scene?.showSkyMoon(moon.value.lights);
    placeSkyMoon();
  },
);
const motionEnabled = () => props.active && !document.hidden && !props.paused && !moonOpen.value;
// The building that would fix a shortage says so on its label.
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
  // A chip naming a place (a need's fix, the unbuilt space elevator): unlike a tap on
  // the map, it opens the card and takes the camera there.
  'locate',
  'mine',
  'settlement-change',
  'raid-phase',
  'raid-cue',
  'raid-complete',
  'camera-distance',
  'vip-spend',
  'guest-vip',
  // The space-helmet wearer was tapped, with its position on the map in percent.
  'helmet',
  // An animal was tapped from too far away to tell whether it wears the helmet.
  'helmet-zoom',
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
// The status line under each label's name, from the shared building status contract.
const labelStatus = computed(() =>
  Object.fromEntries(
    ['mine', ...EARTH_BUILDINGS.map(({ id }) => id)].map((id) => [
      id,
      buildingStatus(props.town, id, {
        readOnly: props.readOnly,
        nextLevel: props.nextLevel,
        indicator: indicators.value[id],
        available: availableIds.value.includes(id),
        need: needHints.value[id],
      }),
    ]),
  ),
);
const upgradeIds = computed(() =>
  Object.keys(indicators.value).filter((id) => indicators.value[id] === 'upgrade'),
);
// Monument sites carry an action icon but never a label.
const plotAnchors = computed(() => anchors.value.filter((anchor) => !anchor.site));
const actionAnchors = computed(() =>
  anchors.value.filter(
    (anchor) => TOWN_ACTIONS[indicators.value[anchor.id]] && anchor.collection.visible,
  ),
);
const buildingName = (id) => t(BUILDING_BY_ID[id].shortName);
const actionLabel = (id) =>
  props.readOnly
    ? t('Collect the saloon takings for the mayor')
    : buildingActionLabel(props.town, id, indicators.value[id]);
const placeName = (id) => (id === 'mine' ? t('Mine') : buildingName(id));
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
  if (moonOpen.value && MOON_BUILDINGS.some((building) => building.id === id))
    return moonView.value?.collectionOrigin(id) ?? { x: 50, y: 50 };
  // The place's collection point (its action icon) or its label anchor; the collection
  // keeps itself on screen (TownResourceCollection), as on the Moon.
  const anchor = anchors.value.find((anchor) => anchor.id === id);
  const origin = anchor?.collection?.visible ? anchor.collection : anchor;
  return { x: origin?.x ?? 50, y: origin?.y ?? 50 };
}
let presentationTime = 0;
let cinematicProgress = 0;
// The camera of the map on screen: the Moon's while it is open, else the valley's.
const camera = () => (moonOpen.value ? moonView.value : scene);
// Explicit navigation (a Build row, a notice): a Moon lot or site opens the Moon map and
// turns the Moon's camera to it; a valley place closes the Moon. Taps never come here.
async function focusPlace(id) {
  if (AREA_BY_ID[id]?.settlement === 'moon' || MOON_BUILDINGS.some((place) => place.id === id)) {
    moonOpen.value = true;
    await nextTick();
    return moonView.value?.focusPlace(id) ?? false;
  }
  closeMoon();
  return scene?.focusPlace(id);
}
// Camera buttons are gone: drag, pinch, wheel and keys move the view; Village resets it.
const resetView = () => camera()?.cameraAction('reset');
defineExpose({
  focusPlace,
  openMoon,
  closeMoon,
  findVisitor: (id) => scene?.findVisitor(id) ?? false,
  resetView,
  collectionOrigin,
  cinematicFrame: (progress) => {
    cinematicProgress = progress;
    scene?.eraFrame(progress, props.reducedMotion);
  },
  presentationFrame: (time) => {
    presentationTime = time;
    if (moonPresentation.value) moonView.value?.presentationFrame(time);
    else scene?.presentationFrame(time, props.reducedMotion);
  },
});
let lastVisual = '';
let lastConstruction;
let scene,
  disposed = false;
// The named villager, a tapped plaque's name and the sky Moon move on every camera
// frame. Vue re-renders only when one appears, disappears or changes its text; in
// between, the frame moves its element directly.
function followLabel(state, element, label = null, sameText = () => true) {
  const current = state.value;
  if (!label || !current || !sameText(label, current)) {
    state.value = label;
    return;
  }
  Object.assign(current, label);
  if (element.value) {
    element.value.style.left = `${label.x}%`;
    element.value.style.top = `${label.y}%`;
    if (label.size !== undefined) element.value.style.height = `${label.size}%`;
  }
}
const villagerLabel = shallowRef(null),
  villagerElement = ref(null),
  plaqueLabel = shallowRef(null),
  plaqueElement = ref(null);
const showVillagerLabel = (label) =>
  followLabel(
    villagerLabel,
    villagerElement,
    label,
    (next, current) => next.name === current.name && next.live === current.live,
  );
// One label names a VIP on whichever map is on screen.
const showValleyVillagerLabel = (label) => moonOpen.value || showVillagerLabel(label);
const showMoonVillagerLabel = (label) => moonOpen.value && showVillagerLabel(label);
const showPlaqueLabel = (label) =>
  followLabel(plaqueLabel, plaqueElement, label, (next, current) => next.name === current.name);
const choose = (id) => {
  if (!props.readOnly) id === 'mine' ? emit('mine') : emit('select', id);
  // A visitor may collect what visitorTaps allows; any other tap only looks at the building.
  else emit(props.visitorTaps.includes(id) ? 'visit' : 'inspect', id);
};
const chooseLabel = (id, event) => {
  // Pointer taps are settled on pointerup; keep native keyboard/AT activation.
  if (keyboardActivation(event)) choose(id);
};
// Taps on the map or its labels settle on pointerup through the shared tap gesture.
const tapGesture = createTapGesture({
  map: () => sceneElement.value,
  onTap: (event, plot) => (plot ? choose(plot) : scene?.pick(event.clientX, event.clientY)),
});
// The Moon map sits inside the valley's scene and settles its own input, which still
// bubbles on to the document (Escape, audio unlock). The valley ignores it.
const onMoon = (event) => !!event.target.closest?.('.town-moon-view');
const rememberPointer = (event) =>
  onMoon(event) ||
  tapGesture.down(event, event.target.closest('[data-town-plot]')?.dataset.townPlot);
const movePointer = (event) => {
  if (onMoon(event)) return;
  if (!tapGesture.pressed && event.pointerType === 'mouse')
    scene?.hoverVillager(event.clientX, event.clientY);
  tapGesture.move(event);
};
const leavePointer = (event) => {
  if (!tapGesture.pressed && event.pointerType === 'mouse')
    scene?.hoverVillager(-Infinity, -Infinity);
};
const pick = (event) => onMoon(event) || tapGesture.up(event);
const cancelPointer = (event) => onMoon(event) || tapGesture.cancel(event);
// Camera keys move the camera of the map on screen.
const cameraKey = (event) => {
  const action = cameraKeyAction(event);
  if (action) camera()?.cameraAction(action);
};
let updateGeneration = 0;
const settings = useSettingsStore();
async function update() {
  const generation = ++updateGeneration;
  if (unavailable.value) {
    emit('cinematic-unavailable');
    emit('cinematic-ready');
    if (!moonPresentation.value) {
      emit('presentation-unavailable');
      emit('presentation-ready');
    }
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
    // A build from the list swaps the building at once, without the hammer cue.
    const instant = newConstruction && !!props.construction?.instant;
    if (constructionId && !instant) {
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
      {
        reducedMotion: props.reducedMotion,
        instant,
        keepCamera: newConstruction && !!props.construction?.keepCamera,
      },
    );
    lastVisual = visual;
    lastConstruction = props.construction?.serial;
  }
  // A visitor watches the helmet move after the owner's puzzles; the owner's own
  // town only changes while they are in the mine.
  scene.animateCostumes = props.readOnly && !props.reducedMotion;
  dressSpaceHelmet(scene, props.town, { animate: scene.animateCostumes });
  scene.setPresentation(valleyPresentation.value);
  if (valleyPresentation.value) {
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
  scene.setCoachPlot(props.coachPlot);
  scene.setMotion(motionEnabled());
  scene.setPaused(props.paused);
}
const warmAudio = () => prepareAudio(settings);
let initializing = false;
// Forget everything drawn by a scene that is going away.
function resetSceneState() {
  graphicsReady.value = false;
  lastVisual = '';
  lastConstruction = undefined;
  anchors.value = [];
  anchorLayout = '';
}
// A lost context rebuilds the valley on a fresh canvas, as every map does.
const recovery = useGraphicsRecovery({
  scene: () => scene,
  release: () => {
    scene?.dispose();
    scene = null;
    resetSceneState();
  },
  restart: () => initialize(),
  fail: (error) => showUnavailable(error),
});
const { canvasVersion } = recovery;
const recoverGraphics = (error, contextLost = false) =>
  disposed || unavailable.value || recovery.recover(error, contextLost);
// Without 3D the village cannot be shown: say so and let the player retry. Cinematics
// and raids still end, so nothing waits on a scene that is not there.
function showUnavailable(error) {
  if (disposed || unavailable.value) return;
  unavailable.value = true;
  emit('cinematic-unavailable');
  emit('cinematic-ready');
  if (!moonPresentation.value) {
    emit('presentation-unavailable');
    emit('presentation-ready');
  }
  // Let an in-progress render finish unwinding before releasing its resources.
  nextTick(() => {
    scene?.dispose();
    scene = null;
  });
  if (props.raid) emit('raid-phase', 'The raid has passed');
  console.warn('3D town unavailable.', error);
}
function retryGraphics() {
  unavailable.value = false;
  resetSceneState();
  return recovery.retry();
}
async function initialize() {
  if (
    scene ||
    initializing ||
    recovery.recovering ||
    disposed ||
    !props.active ||
    unavailable.value
  )
    return;
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
      onHelmetZoom: () => emit('helmet-zoom'),
      onVillagerLabel: showValleyVillagerLabel,
      onPlaqueLabel: showPlaqueLabel,
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
    scene.setReducedMotion(props.reducedMotion);
    scene.setCovered(moonOpen.value);
    scene.setLiveVisitors(props.liveVisitors, props.liveVisitorTownId);
    scene.showSkyMoon(moon.value.lights);
    await update();
    scene.vipArrivals?.reset(true);
    recovery.restorePose(scene);
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
    // The app's reduced-motion setting, the one value both maps read (d.reducedMotion).
    scene?.setReducedMotion(props.reducedMotion);
    scene?.setLiveVisitors(props.liveVisitors, props.liveVisitorTownId);
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
    if (props.presentation?.settlement === 'moon') moonOpen.value = true;
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
  () => props.coachPlot,
  (id) => {
    if (props.active) scene?.setCoachPlot(id);
  },
);
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

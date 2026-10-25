<template>
  <!-- Input reaches the document (Escape, audio unlock); the valley ignores it while the
       Moon covers it (TownScene). -->
  <section
    ref="viewElement"
    class="town-moon-view"
    :class="{ 'is-fallback': unavailable, 'is-compact': compact }"
    role="region"
    :aria-label="t('New Hollow on the Moon')"
  >
    <!-- The camera gestures and taps share this surface with the lot labels and action
         buttons, as the valley's share its scene: a drag from a label orbits. -->
    <div class="town-moon-surface">
      <canvas
        v-if="!unavailable"
        ref="canvas"
        :key="canvasVersion"
        class="town-moon-canvas"
        tabindex="0"
        :aria-label="
          t('Town camera. Arrow keys rotate, plus and minus zoom, Home resets the view.')
        "
        @keydown="cameraKey"
      />
      <svg
        v-else
        class="town-moon-map"
        viewBox="-60 -50 120 100"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <rect x="-60" y="-50" width="120" height="100" fill="#10162b" />
        <circle cx="-38" cy="-38" r="7" fill="#4f8fc7" />
        <ellipse cy="6" rx="52" ry="40" fill="#b9b6ad" />
        <ellipse
          cy="6"
          :rx="MOON_RING_ROAD * 1.3"
          :ry="MOON_RING_ROAD * 1.05"
          fill="none"
          stroke="#cfccc3"
          stroke-width="1.6"
        />
        <polyline
          v-for="route in mapApproaches"
          :key="route.id"
          :points="route.points"
          fill="none"
          stroke="#cfccc3"
          :stroke-width="route.width * 1.2"
          stroke-linejoin="round"
          data-moon-approach="true"
        />
        <g
          v-for="lot in mapLots"
          :key="lot.id"
          :transform="`translate(${lot.x} ${lot.y}) scale(.07)`"
        >
          <TownMoonBuilding :kind="lot.id" :level="town.buildings[lot.id] ?? 0" />
          <TownMoonConstruction v-if="town.projects?.[lot.id]" :project="town.projects[lot.id]" />
        </g>
        <g
          v-for="site in mapMonuments"
          :key="site.id"
          :data-moon-monument="site.id"
          :transform="`translate(${site.x} ${site.y})`"
        >
          <TownMoonMonument :site="site" />
        </g>
      </svg>
      <div
        v-show="!props.presentation"
        class="town-moon-lots"
        role="group"
        :aria-label="t('Moon lots')"
      >
        <svg
          class="town-moon-leaders"
          :viewBox="`0 0 ${viewport.width} ${viewport.height}`"
          aria-hidden="true"
        >
          <template v-for="lot in shownLots" :key="lot.id">
            <g v-if="lot.leader">
              <line v-bind="lot.leader" />
              <circle :cx="lot.leader.x2" :cy="lot.leader.y2" r="2" />
            </g>
          </template>
        </svg>
        <button
          v-for="lot in shownLots"
          :key="lot.id"
          type="button"
          class="town-moon-lot"
          :data-moon-lot="lot.id"
          :aria-pressed="selected === lot.id"
          :class="[
            lotInfo[lot.id].look,
            {
              'is-pin': lot.collapsed,
              selected: selected === lot.id,
              'is-collectable': collecting(lot.id),
            },
          ]"
          :style="{
            left: `${lot.x}%`,
            top: `${lot.y}%`,
            width: `${lot.width ?? 104}px`,
            height: `${lot.height ?? 52}px`,
          }"
          :aria-label="lotInfo[lot.id].label"
          :title="lotInfo[lot.id].label"
          @focus="revealOnFocus($event, lot.id)"
          @click="activateLabel(lot.id, $event)"
        >
          <span v-if="lot.collapsed" class="moon-lot-pin" aria-hidden="true"></span>
          <img
            v-else-if="compact && TOWN_ACTIONS[indicators[lot.id]]"
            class="moon-inline-action"
            :src="TOWN_ACTIONS[indicators[lot.id]].icon"
            alt=""
          />
          <strong v-if="!lot.collapsed">{{ lotInfo[lot.id].name }}</strong>
          <TownLabelStatus v-if="!lot.collapsed" :status="lotInfo[lot.id].status" />
        </button>
      </div>
      <div class="town-action-icons" role="group" :aria-label="t('Village buildings')">
        <TownActionIcon
          v-for="lot in actionLots"
          :key="lot.id"
          class="town-moon-action"
          :indicator="indicators[lot.id]"
          :label="buildingActionLabel(town, lot.id, indicators[lot.id])"
          :data-moon-action="lot.id"
          :style="{
            left: `${lot.actionPoint?.x ?? lot.anchor?.x ?? lot.x}%`,
            top: `${lot.actionPoint?.y ?? lot.anchor?.y ?? lot.y}%`,
          }"
          @click="activateLabel(lot.id, $event)"
        />
      </div>
    </div>
    <header class="town-moon-header">
      <button type="button" class="town-moon-back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ t('Back to the valley') }}
      </button>
      <div class="town-moon-title">
        <TownMoon :lights="moon.lights" />
        <strong>{{ t('New Hollow') }}</strong>
        <span>{{ t('{count} homesteads', { count: moon.homesteads }) }}</span>
        <TownMoonstoneBalance :town="town" />
      </div>
    </header>
  </section>
</template>
<script setup>
import {
  computed,
  inject,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  watch,
} from 'vue';
import {
  MOON_LOTS,
  MOON_RING_ROAD,
  moonApproaches,
  moonSettlement,
} from '../../data/moonSettlement';
import { TOWN_ACTIONS, buildingActionLabel } from '../../data/townIndicators';
import {
  areaChoice,
  areaShownStage,
  areaUnlocked,
  areasForSettlement,
  monumentWork,
} from '../../data/townLandmarks';
import TownMoonMonument from './TownMoonMonument.vue';
import { MOON_SETTLEMENT } from '../../data/settlements';
import { layoutMoonLabels, moonMapLabel } from '../../game/town/moon/MoonLabelLayout';
import {
  compactMoonViewport,
  moonLabelDensity,
  moonLabelNeedsAttention,
} from '../../game/town/moon/MoonLabelDensity';
import {
  canCollectMoonstones as collectable,
  moonLotInfo,
  moonLotLabel,
  moonLotName,
  moonLotStatus,
} from '../../game/town/moon/MoonLotStatus';
import TownActionIcon from './TownActionIcon.vue';
import TownLabelStatus from './TownLabelStatus.vue';
import TownMoon from './TownMoon.vue';
import TownMoonstoneBalance from './TownMoonstoneBalance.vue';
import TownMoonBuilding from './TownMoonBuilding.vue';
import TownMoonConstruction from './TownMoonConstruction.vue';
import { cameraKeyAction } from '../../game/town/TownCameraKeys';
import { keyboardActivation } from '../../game/town/TownTapGesture';
import { useGraphicsRecovery } from '../../composables/useGraphicsRecovery';
import { t } from '../../i18n';

// New Hollow, the town's settlement on the Moon. Its own small 3D scene sits over
// the valley view; every lot opens the shared building details, so offers,
// construction and visits work exactly as on Earth.
const props = defineProps({
  town: { type: Object, required: true },
  selected: String,
  presentation: Object,
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
  indicators: { type: Object, default: () => ({}) },
  availableIds: { type: Array, default: () => [] },
  // The valley's upgrade glow rule (TownScene): lots whose indicator is 'upgrade'.
  upgradeIds: { type: Array, default: () => [] },
  readOnly: Boolean,
});
const emit = defineEmits([
  'select',
  'inspect',
  'close',
  'presentation-ready',
  'presentation-unavailable',
  // The valley's VIP flow: a purchase receipt, and the named VIP's tag for the shared label.
  'vip-spend',
  'villager-label',
]);
const canvas = ref(null);
const viewElement = ref(null);
const viewport = shallowRef({ width: 0, height: 0 });
let labelObserver;
const unavailable = ref(false);
// Replaced whole on camera frames that move a label, so it needs no deep reactivity.
const labels = shallowRef([]);
const cameraDistance = ref(Infinity);
const selectedLot = ref(props.selected ?? null);
watch(
  () => props.selected,
  (id) => (selectedLot.value = id ?? null),
);
const compact = computed(() => compactMoonViewport(viewport.value.width, viewport.value.height));
let scene = null,
  disposed = false;

const townClock = inject('townClock', null);
const canCollectMoonstones = computed(() =>
  collectable(props.town, townClock?.value ?? Date.now()),
);
const moon = computed(() => moonSettlement(props.town));
// The SVG map uses the same lot layout, flattened onto a crater ellipse.
const mapLots = computed(() =>
  Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({ id, x: x * 1.3, y: 6 + z * 1.05 })),
);
const monumentSites = computed(() =>
  areasForSettlement(MOON_SETTLEMENT).filter((area) => areaUnlocked(props.town, area)),
);
const mapMonuments = computed(() =>
  monumentSites.value.map((area) => ({
    id: area.id,
    x: area.positions[0][0] * 1.3,
    y: 6 + area.positions[0][1] * 1.05,
    choice: areaChoice(props.town, area),
    stage: areaShownStage(props.town, area) || monumentWork(props.town, area)?.level || 1,
    work: monumentWork(props.town, area),
  })),
);
const mapApproaches = computed(() =>
  moonApproaches(props.town.buildings ?? {}).map((route) => ({
    ...route,
    points: route.points.map(([x, z]) => `${x * 1.3},${6 + z * 1.05}`).join(' '),
  })),
);
const allLots = computed(() => [...mapLots.value, ...mapMonuments.value]);
// Each lot's name, shared status (TownLabelStatus) and look, recomputed when the town or
// its markers change rather than on every camera frame. The looks are the valley
// labels': can-build, is-ready and has-income for the same states.
const lotInfo = computed(() => {
  const options = {
    indicators: props.indicators,
    availableIds: props.availableIds,
    collectable: canCollectMoonstones.value,
    readOnly: props.readOnly,
  };
  return Object.fromEntries(
    allLots.value.map(({ id }) => {
      const status = moonLotInfo(props.town, id, options);
      return [
        id,
        {
          name: moonLotName(id),
          status,
          label: moonLotLabel(props.town, id, options),
          state: moonLotStatus(props.town, id),
          look: {
            'can-build': status?.kind === 'available',
            'is-ready': status?.kind === 'ready',
            'has-income': status?.kind === 'coins' || status?.kind === 'tnt',
          },
        },
      ];
    }),
  );
});
const collecting = (id) =>
  id === 'moonstoneWorkshop' && lotInfo.value[id]?.status?.kind === 'coins';
const needsAttention = (id) =>
  !props.readOnly &&
  moonLabelNeedsAttention({
    status: lotInfo.value[id]?.state,
    action: TOWN_ACTIONS[props.indicators[id]],
    collectable: collecting(id),
  });
const shownLots = computed(() => {
  const { width, height } = viewport.value;
  const projected = unavailable.value
    ? allLots.value.map((lot) => moonMapLabel(lot, viewport.value))
    : labels.value;
  return layoutMoonLabels(
    moonLabelDensity(
      projected.map((lot) => ({
        ...lot,
        attention: needsAttention(lot.id),
        action: !!TOWN_ACTIONS[props.indicators[lot.id]],
      })),
      width,
      height,
      { near: !unavailable.value && cameraDistance.value <= 48, selected: selectedLot.value },
    ).map((lot) => (collecting(lot.id) ? { ...lot, width: 128, height: 64 } : lot)),
    width,
    height,
  ).filter((lot) => lot.visible);
});
const actionLots = computed(() =>
  compact.value ? [] : shownLots.value.filter((lot) => TOWN_ACTIONS[props.indicators[lot.id]]),
);
const choose = (id) => {
  selectedLot.value = id;
  emit(props.readOnly ? 'inspect' : 'select', id);
};
// Pointer taps on labels and action buttons settle through the scene's shared tap
// gesture; their click opens a lot only from the keyboard, or on the SVG map. Opening
// the workshop collects its moonstones, as the valley's saloon pays out (TownView).
function activateLabel(id, event) {
  if (!scene || keyboardActivation(event)) choose(id);
}
function cameraKey(event) {
  const action = cameraKeyAction(event);
  if (action) scene?.cameraAction(action);
}
function revealOnFocus(event, id) {
  if (event.target.matches(':focus-visible')) selectedLot.value = id;
}
const updateGlow = () => {
  scene?.setUpgradeable(props.upgradeIds);
  scene?.setLabelActions(
    Object.keys(props.indicators).filter((id) => TOWN_ACTIONS[props.indicators[id]]),
  );
};

let presentationTime = 0;
function updatePresentation() {
  scene?.setPresentation(props.presentation);
  if (props.presentation) {
    scene?.presentationFrame(presentationTime, props.reducedMotion);
    if (unavailable.value) emit('presentation-unavailable');
    if (scene || unavailable.value) emit('presentation-ready');
  }
}
watch(
  () => props.presentation,
  () => {
    presentationTime = 0;
    updatePresentation();
  },
);
function updateMotion() {
  scene?.setMotion(props.active && !props.paused && !document.hidden);
}
// A lost graphics context rebuilds the Moon on a fresh canvas, as the valley does; when
// it cannot, the SVG map takes over.
let pendingFocus = null;
const recovery = useGraphicsRecovery({
  scene: () => scene,
  release: () => {
    scene?.dispose();
    scene = null;
  },
  restart: () => start(),
  fail: (error) => {
    console.warn('3D Moon unavailable.', error);
    unavailable.value = true;
    // Let a render in progress unwind before releasing its resources.
    nextTick(() => {
      scene?.dispose();
      scene = null;
    });
    if (props.presentation) {
      emit('presentation-unavailable');
      emit('presentation-ready');
    }
  },
});
const { canvasVersion } = recovery;
async function start() {
  try {
    const { MoonScene } = await import('../../game/town/moon/MoonScene');
    if (disposed || !canvas.value || scene) return;
    scene = new MoonScene(canvas.value, {
      reducedMotion: props.reducedMotion,
      onLabels: (next, distance) => {
        labels.value = next;
        cameraDistance.value = distance;
      },
      // Tapping Earth over the rim returns to the valley.
      onEarth: () => emit('close'),
      // A tapped lot or monument site opens like its label.
      onSelect: (id) => choose(id),
      onVipSpend: (receipt) => emit('vip-spend', receipt),
      onVillagerLabel: (label) => emit('villager-label', label),
      onUnavailable: (error, contextLost) => !disposed && recovery.recover(error, contextLost),
      // A shared town is only a view: VIP guests visit the owner's own game.
      vipsHidden: props.readOnly,
    });
    scene.update(props.town);
    scene.setSelected(selectedLot.value);
    recovery.restorePose(scene);
    if (pendingFocus) scene.focusPlace(pendingFocus);
    pendingFocus = null;
    updateGlow();
    updatePresentation();
    updateMotion();
  } catch (error) {
    if (!disposed) recovery.recover(error);
  }
}
// Only what the Moon draws rebuilds it, as in the valley (TownScene): coins, honours and
// the rest of the town stay out. The visiting saucer follows the airport's era.
const visual = computed(() =>
  JSON.stringify([
    props.town.buildings,
    props.town.projects,
    props.town.buildingEras,
    props.town.buildingEraLevels,
    props.town.era,
    props.town.personalisation,
  ]),
);
watch(visual, () => scene?.update(props.town));
watch(() => [props.indicators, props.upgradeIds], updateGlow);
watch(selectedLot, (id) => scene?.setSelected(id ?? null));
watch(() => [props.active, props.paused], updateMotion);
watch(
  () => props.reducedMotion,
  (value) => scene?.setReducedMotion(value),
);
onMounted(() => {
  labelObserver = new ResizeObserver(([entry]) => {
    viewport.value = { width: entry.contentRect.width, height: entry.contentRect.height };
  });
  labelObserver.observe(viewElement.value);
  document.addEventListener('visibilitychange', updateMotion);
  nextTick(start);
});
onBeforeUnmount(() => {
  disposed = true;
  labelObserver?.disconnect();
  document.removeEventListener('visibilitychange', updateMotion);
  scene?.dispose();
  scene = null;
});
// Explicit navigation (a Build row) to a lot, remembered until the scene has loaded.
function focusPlace(id) {
  if (scene) return scene.focusPlace(id);
  pendingFocus = id;
  return true;
}
defineExpose({
  // The valley's camera contract: keys, the Village tab's reset and navigation.
  cameraAction: (action) => scene?.cameraAction(action),
  resetView: () => scene?.cameraAction('reset'),
  focusPlace,
  presentationFrame: (time) => {
    presentationTime = time;
    scene?.presentationFrame(time, props.reducedMotion);
  },
  // A collection rises from the lot itself, as in the valley; TownResourceCollection
  // keeps it on screen.
  collectionOrigin: (id) => {
    const lot = labels.value.find((lot) => lot.id === id);
    return { x: lot?.x ?? 50, y: lot?.y ?? 50 };
  },
});
</script>
<style scoped>
.town-moon-surface {
  position: absolute;
  inset: 0;
}
.town-moon-canvas:focus-visible {
  outline: 3px solid #89e2f5;
  outline-offset: -3px;
}
.town-moon-leaders {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}
.town-moon-leaders line {
  stroke: #bba77c;
  stroke-width: 1.5;
  filter: drop-shadow(0 1px 1px #10162b88);
}
.town-moon-leaders circle {
  fill: #fbf8ea;
  stroke: #bba77c;
}
.town-moon-lot strong {
  align-self: end;
}
.town-moon-lot small {
  align-self: start;
  font-size: 10px;
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.town-moon-action {
  border-radius: 50%;
  background: radial-gradient(circle, #142f48db 35%, #61d6ec55 60%, transparent 72%);
}
.town-moon-action :deep(img) {
  filter: drop-shadow(0 0 5px #bcecff);
}
.town-moon-lot.selected {
  outline: 3px solid #f5df91;
  outline-offset: 2px;
}
.town-moon-lot.is-collectable small {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}
.town-moon-lot.is-pin {
  min-height: 0;
  padding: 0;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: transparent;
  box-shadow: none;
}
.moon-lot-pin {
  width: 10px;
  height: 10px;
  border: 2px solid #fbf8ea;
  border-radius: 50%;
  background: #345166;
  box-shadow: 0 1px 4px #10162b;
}
.town-moon-lot:active:not(:disabled) {
  transform: translate(-50%, -100%) scale(0.97);
}
.town-moon-lot:focus-visible {
  outline: 3px solid #89e2f5;
  outline-offset: 2px;
}
.is-compact .town-moon-lot:not(.is-pin) {
  min-height: 0;
  padding: 2px 5px;
  font-size: 10px;
}
.moon-inline-action {
  position: absolute;
  left: -8px;
  top: -8px;
  width: 24px;
  height: 24px;
  pointer-events: none;
}
</style>

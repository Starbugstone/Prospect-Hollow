<template>
  <!-- The valley's own controls sit on the parent scene: keep Moon input to the Moon. -->
  <section
    ref="viewElement"
    class="town-moon-view"
    :class="{ 'is-fallback': unavailable, 'is-compact': compact }"
    role="region"
    :aria-label="t('New Hollow on the Moon')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
  >
    <!-- Controls capture only the canvas. Releases must reach their document listener. -->
    <canvas v-if="!unavailable" ref="canvas" class="town-moon-canvas" aria-hidden="true" />
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
        :class="{
          'is-pin': lot.collapsed,
          'is-collectable': lot.id === 'moonstoneWorkshop' && canCollectMoonstones,
          built: !!(town.buildings[lot.id] || monumentChoice(lot.id)),
          open: AREA_BY_ID[lot.id] ? status(lot.id) === 'open' : availableIds.includes(lot.id),
          'is-ready': indicators[lot.id] === 'ready' || status(lot.id) === 'ready',
          'is-working': !!town.projects?.[lot.id] || status(lot.id) === 'work',
        }"
        :style="{
          left: `${lot.x}%`,
          top: `${lot.y}%`,
          width: `${lot.width ?? 104}px`,
          height: `${lot.height ?? 52}px`,
        }"
        :aria-label="lotLabel(lot.id)"
        :title="lotLabel(lot.id)"
        @focus="revealOnFocus($event, lot.id)"
        @click="
          !readOnly && canCollectMoonstones && lot.id === 'moonstoneWorkshop'
            ? emit('collect', lot.id)
            : choose(lot.id)
        "
      >
        <span v-if="lot.collapsed" class="moon-lot-pin" aria-hidden="true"></span>
        <img
          v-else-if="compact && TOWN_ACTIONS[indicators[lot.id]]"
          class="moon-inline-action"
          :src="TOWN_ACTIONS[indicators[lot.id]].icon"
          alt=""
        />
        <strong v-if="!lot.collapsed">{{
          t(AREA_BY_ID[lot.id]?.label ?? BUILDING_BY_ID[lot.id].shortName)
        }}</strong>
        <small v-if="!lot.collapsed">{{
          AREA_BY_ID[lot.id] || (lot.id === 'moonstoneWorkshop' && canCollectMoonstones)
            ? statusLabel(lot.id)
            : buildingStatusLabel(town, lot.id, indicators[lot.id], availableIds.includes(lot.id))
        }}</small>
        <span
          v-if="!lot.collapsed && indicators[lot.id] === 'upgrade'"
          class="moon-upgrade-hint"
          aria-hidden="true"
          >↑</span
        >
      </button>
    </div>
    <div class="town-moon-actions" role="group" :aria-label="t('Village buildings')">
      <button
        v-for="lot in actionLots"
        :key="lot.id"
        type="button"
        class="town-action-icon town-moon-action"
        :class="TOWN_ACTIONS[indicators[lot.id]].class"
        :data-moon-action="lot.id"
        :style="{
          left: `${lot.actionPoint?.x ?? lot.anchor?.x ?? lot.x}%`,
          top: `${lot.actionPoint?.y ?? lot.anchor?.y ?? lot.y}%`,
          '--action-scale': TOWN_ACTIONS[indicators[lot.id]].scale,
        }"
        :aria-label="buildingActionLabel(town, lot.id, indicators[lot.id])"
        @click="choose(lot.id)"
      >
        <img :src="TOWN_ACTIONS[indicators[lot.id]].icon" alt="" />
      </button>
    </div>
    <details v-show="!props.presentation" class="moon-lot-directory">
      <summary>{{ t('Moon lots') }}</summary>
      <ul>
        <li v-for="lot in allLots" :key="lot.id">
          <button type="button" @click="choose(lot.id)">{{ lotLabel(lot.id) }}</button>
        </li>
      </ul>
    </details>
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
    <details v-if="letters.length" class="town-moon-letters">
      <summary>{{ t('Letters from New Hollow') }} ({{ letters.length }})</summary>
      <ul>
        <li v-for="letter in letters" :key="letter.id">{{ t(letter.text) }}</li>
      </ul>
    </details>
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
import { BUILDING_BY_ID } from '../../data/town';
import {
  MOON_LOTS,
  MOON_RING_ROAD,
  moonApproaches,
  moonLetters,
  moonSettlement,
} from '../../data/moonSettlement';
import { buildingStatusLabel } from '../../game/town/TownBuildingFeedback';
import { TOWN_ACTIONS, buildingActionLabel } from '../../data/townIndicators';
import {
  AREA_BY_ID,
  areaChoice,
  areaShownStage,
  areaUnlocked,
  areasForSettlement,
  monumentWork,
} from '../../data/townLandmarks';
import TownMoonMonument from './TownMoonMonument.vue';
import { layoutMoonLabels, moonMapLabel } from '../../game/town/moon/MoonLabelLayout';
import {
  compactMoonViewport,
  moonLabelDensity,
  moonLabelNeedsAttention,
} from '../../game/town/moon/MoonLabelDensity';
import { plotUnlocked, collectionCooldownRemaining } from '../../game/town/TownRules';
import TownMoon from './TownMoon.vue';
import TownMoonstoneBalance from './TownMoonstoneBalance.vue';
import TownMoonBuilding from './TownMoonBuilding.vue';
import TownMoonConstruction from './TownMoonConstruction.vue';
import { t } from '../../i18n';

// New Hollow, the town's settlement on the Moon. Its own small 3D scene sits over
// the valley view; every lot opens the shared building details, so offers,
// construction and visits work exactly as on Earth.
const props = defineProps({
  town: { type: Object, required: true },
  presentation: Object,
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
  indicators: { type: Object, default: () => ({}) },
  availableIds: { type: Array, default: () => [] },
  readOnly: Boolean,
});
const emit = defineEmits([
  'select',
  'inspect',
  'close',
  'collect',
  'presentation-ready',
  'presentation-unavailable',
]);
const canvas = ref(null);
const viewElement = ref(null);
const viewport = shallowRef({ width: 0, height: 0 });
let labelObserver;
const unavailable = ref(false);
// Replaced whole on camera frames that move a label, so it needs no deep reactivity.
const labels = shallowRef([]);
const cameraDistance = ref(Infinity);
const selectedLot = ref(null);
const compact = computed(() => compactMoonViewport(viewport.value.width, viewport.value.height));
let scene = null,
  disposed = false;

const townClock = inject('townClock', null);
const canCollectMoonstones = computed(
  () =>
    !!props.town.moonstoneProduction?.stored &&
    !collectionCooldownRemaining(props.town, 'moonstoneWorkshop', townClock?.value ?? Date.now()),
);
const moon = computed(() => moonSettlement(props.town));
const letters = computed(() => moonLetters(props.town));
// The SVG map uses the same lot layout, flattened onto a crater ellipse.
const mapLots = computed(() =>
  Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({ id, x: x * 1.3, y: 6 + z * 1.05 })),
);
const monumentSites = computed(() =>
  areasForSettlement('moon').filter((area) => areaUnlocked(props.town, area)),
);
const monumentChoice = (id) => AREA_BY_ID[id] && areaChoice(props.town, AREA_BY_ID[id]);
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
const needsAttention = (id) =>
  moonLabelNeedsAttention({
    status: status(id),
    action: TOWN_ACTIONS[props.indicators[id]],
    collectable: id === 'moonstoneWorkshop' && canCollectMoonstones.value,
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
    ).map((lot) =>
      lot.id === 'moonstoneWorkshop' && canCollectMoonstones.value
        ? { ...lot, width: 128, height: 64 }
        : lot,
    ),
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
function revealOnFocus(event, id) {
  if (event.target.matches(':focus-visible')) selectedLot.value = id;
}
function lotLabel(id) {
  const name = t(AREA_BY_ID[id]?.label ?? BUILDING_BY_ID[id].shortName);
  const detail =
    AREA_BY_ID[id] || (id === 'moonstoneWorkshop' && canCollectMoonstones.value)
      ? statusLabel(id)
      : buildingStatusLabel(props.town, id, props.indicators[id], props.availableIds.includes(id));
  return `${name} · ${detail}`;
}
const updateAvailable = () => {
  scene?.setAvailable(
    Object.keys(props.indicators).filter((id) => props.indicators[id] === 'upgrade'),
  );
  scene?.setLabelActions(
    Object.keys(props.indicators).filter((id) => TOWN_ACTIONS[props.indicators[id]]),
  );
};
function status(id) {
  if (AREA_BY_ID[id])
    return monumentWork(props.town, AREA_BY_ID[id])?.ready
      ? 'ready'
      : monumentWork(props.town, AREA_BY_ID[id])
        ? 'work'
        : monumentChoice(id)
          ? 'monument'
          : 'open';
  if (props.town.projects?.[id]) return 'work';
  if (props.town.buildings?.[id]) return 'built';
  return plotUnlocked(props.town, id) ? 'open' : 'later';
}
function statusLabel(id) {
  if (id === 'moonstoneWorkshop' && canCollectMoonstones.value)
    return t('Collect {count} moonstones', { count: props.town.moonstoneProduction.stored });
  return {
    work: t('Under construction'),
    ready: t('Ready to unveil'),
    monument: t('Monument'),
    built: t('Lv. {level}', { level: props.town.buildings[id] }),
    open: t(AREA_BY_ID[id] ? 'Choose a design' : 'Build'),
    later: t('Coming soon'),
  }[status(id)];
}

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
async function start() {
  try {
    const { MoonScene } = await import('../../game/town/moon/MoonScene');
    if (disposed || !canvas.value) return;
    scene = new MoonScene(canvas.value, {
      reducedMotion: props.reducedMotion,
      onLabels: (next, distance) => {
        labels.value = next;
        cameraDistance.value = distance;
      },
      // Tapping Earth over the rim returns to the valley.
      onEarth: () => emit('close'),
    });
    scene.update(props.town);
    updateAvailable();
    updatePresentation();
    updateMotion();
  } catch (error) {
    console.error(error);
    unavailable.value = true;
    if (props.presentation) {
      emit('presentation-unavailable');
      emit('presentation-ready');
    }
  }
}
// Watch only visual lifecycle fields; honours and the rest of the town stay out.
watch(
  () => [
    props.town.buildings,
    props.town.projects,
    props.town.buildingEras,
    props.town.buildingEraLevels,
    // The visiting saucer follows the valley airport's finish.
    props.town.buildingEras?.airport,
    props.town.era,
    props.town.personalisation,
  ],
  () => scene?.update(props.town),
  { deep: true },
);
watch(() => props.indicators, updateAvailable);
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
defineExpose({
  resetView: () => scene?.resetView(),
  presentationFrame: (time) => {
    presentationTime = time;
    scene?.presentationFrame(time, props.reducedMotion);
  },
  collectionOrigin: (id) => {
    const lot = shownLots.value.find((lot) => lot.id === id);
    return { x: lot?.x ?? 50, y: lot?.y ?? 50 };
  },
});
</script>
<style scoped>
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
.town-moon-actions {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.town-moon-action {
  border-radius: 50%;
  background: radial-gradient(circle, #142f48db 35%, #61d6ec55 60%, transparent 72%);
}
.town-moon-action img {
  filter: drop-shadow(0 0 5px #bcecff);
}
.town-moon-lot.is-working {
  border-color: #83c5dc;
  background: #172d43ed;
  color: #edf9ff;
}
.town-moon-lot.is-collectable small {
  white-space: normal;
  overflow: visible;
  text-overflow: clip;
}
.town-moon-lot.is-working small {
  color: #b5e4ef;
}
.town-moon-lot.is-ready {
  border-color: #f5d885;
}
.moon-upgrade-hint {
  position: absolute;
  right: -10px;
  top: -12px;
  border-radius: 50%;
  background: #c0ffbc;
  color: #204e42;
  font-size: 20px;
  font-weight: 900;
  width: 24px;
}
</style>

<style scoped>
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
.moon-lot-directory {
  display: none;
  position: absolute;
  right: 12px;
  bottom: 124px;
  max-width: calc(100% - 24px);
  padding: 8px 12px;
  border: 1px solid #b9c2a4;
  border-radius: 10px;
  background: #fbf8eaf2;
  color: #3f5547;
  font-size: 13px;
}
.is-compact .moon-lot-directory,
:global(.town-labels-hidden .moon-lot-directory) {
  display: block;
}
:global(.town-in-cinematic .moon-lot-directory) {
  visibility: hidden;
}
.moon-lot-directory summary {
  cursor: pointer;
  font-weight: 700;
}
.moon-lot-directory ul {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  max-height: 35vh;
  overflow: auto;
}
.moon-lot-directory button {
  width: 100%;
  padding: 8px;
  text-align: left;
  cursor: pointer;
}
@media (min-width: 600px) and (max-height: 450px) {
  .moon-lot-directory {
    bottom: 8px;
    left: 12px;
    right: auto;
  }
}
</style>

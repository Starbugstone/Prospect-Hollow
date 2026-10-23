<template>
  <!-- The valley's own controls sit on the parent scene: keep Moon input to the Moon. -->
  <section
    class="town-moon-view"
    :class="{ 'is-fallback': unavailable }"
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
    </svg>
    <div class="town-moon-lots" role="group" :aria-label="t('Moon lots')">
      <button
        v-for="lot in shownLots"
        :key="lot.id"
        type="button"
        class="town-moon-lot"
        :class="{
          built: !!town.buildings[lot.id],
          open: availableIds.includes(lot.id),
          'is-ready': indicators[lot.id] === 'ready',
          'is-working': !!town.projects?.[lot.id],
        }"
        :style="{ left: `${lot.x}%`, top: `${lot.y}%` }"
        @click="choose(lot.id)"
      >
        <strong>{{ t(BUILDING_BY_ID[lot.id].shortName) }}</strong>
        <small>{{
          buildingStatusLabel(town, lot.id, indicators[lot.id], availableIds.includes(lot.id))
        }}</small>
        <span v-if="indicators[lot.id] === 'upgrade'" class="moon-upgrade-hint" aria-hidden="true"
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
          left: `${lot.x}%`,
          top: `${lot.y}%`,
          '--action-scale': TOWN_ACTIONS[indicators[lot.id]].scale,
        }"
        :aria-label="buildingActionLabel(town, lot.id, indicators[lot.id])"
        @click="choose(lot.id)"
      >
        <img :src="TOWN_ACTIONS[indicators[lot.id]].icon" alt="" />
      </button>
    </div>
    <header class="town-moon-header">
      <button type="button" class="town-moon-back" @click="emit('close')">
        <span aria-hidden="true">←</span> {{ t('Back to the valley') }}
      </button>
      <div class="town-moon-title">
        <TownMoon :lights="moon.lights" />
        <strong>{{ t('New Hollow') }}</strong>
        <span>{{ t('{count} homesteads', { count: moon.homesteads }) }}</span>
        <span v-if="moonstones">{{
          t('{count} moonstones sent home', { count: moonstones })
        }}</span>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { BUILDING_BY_ID } from '../../data/town';
import {
  MOON_LOTS,
  MOON_RING_ROAD,
  moonApproaches,
  moonLetters,
  moonSettlement,
  moonstoneKeepsakes,
} from '../../data/moonSettlement';
import { buildingStatusLabel } from '../../game/town/TownBuildingFeedback';
import { TOWN_ACTIONS, buildingActionLabel } from '../../data/townIndicators';
import TownMoon from './TownMoon.vue';
import TownMoonBuilding from './TownMoonBuilding.vue';
import TownMoonConstruction from './TownMoonConstruction.vue';
import { t } from '../../i18n';

// New Hollow, the town's settlement on the Moon. Its own small 3D scene sits over
// the valley view; every lot opens the shared building details, so offers,
// construction and visits work exactly as on Earth.
const props = defineProps({
  town: { type: Object, required: true },
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
  indicators: { type: Object, default: () => ({}) },
  availableIds: { type: Array, default: () => [] },
  readOnly: Boolean,
});
const emit = defineEmits(['select', 'inspect', 'close']);
const canvas = ref(null);
const unavailable = ref(false);
// Replaced whole on camera frames that move a label, so it needs no deep reactivity.
const labels = shallowRef([]);
let scene = null,
  disposed = false;

const moon = computed(() => moonSettlement(props.town));
const moonstones = computed(() => moonstoneKeepsakes(props.town));
const letters = computed(() => moonLetters(props.town));
// The SVG map uses the same lot layout, flattened onto a crater ellipse.
const mapLots = computed(() =>
  Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({ id, x: x * 1.3, y: 6 + z * 1.05 })),
);
const mapApproaches = computed(() =>
  moonApproaches(props.town.buildings ?? {}).map((route) => ({
    ...route,
    points: route.points.map(([x, z]) => `${x * 1.3},${6 + z * 1.05}`).join(' '),
  })),
);
const shownLots = computed(() =>
  unavailable.value
    ? mapLots.value.map(({ id, x, y }) => ({
        id,
        x: 50 + (x / 120) * 100,
        y: 50 + (y / 100) * 100 - 6,
      }))
    : labels.value.filter((lot) => lot.visible),
);
const actionLots = computed(() =>
  shownLots.value.filter((lot) => TOWN_ACTIONS[props.indicators[lot.id]]),
);
const choose = (id) => emit(props.readOnly ? 'inspect' : 'select', id);
const updateAvailable = () =>
  scene?.setAvailable(
    Object.keys(props.indicators).filter((id) => props.indicators[id] === 'upgrade'),
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
      onLabels: (next) => (labels.value = next),
      // Tapping Earth over the rim returns to the valley.
      onEarth: () => emit('close'),
    });
    scene.update(props.town);
    updateAvailable();
    updateMotion();
  } catch (error) {
    console.error(error);
    unavailable.value = true;
  }
}
// Watch only visual lifecycle fields; honours and the rest of the town stay out.
watch(
  () => [
    props.town.buildings,
    props.town.projects,
    props.town.buildingEras,
    props.town.buildingEraLevels,
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
  document.addEventListener('visibilitychange', updateMotion);
  nextTick(start);
});
onBeforeUnmount(() => {
  disposed = true;
  document.removeEventListener('visibilitychange', updateMotion);
  scene?.dispose();
  scene = null;
});
defineExpose({
  resetView: () => scene?.resetView(),
  collectionOrigin: (id) => {
    const lot = shownLots.value.find((lot) => lot.id === id);
    return { x: lot?.x ?? 50, y: lot?.y ?? 50 };
  },
});
</script>
<style scoped>
.town-moon-actions {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.town-moon-action {
  margin-top: -76px;
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

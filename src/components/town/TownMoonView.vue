<template>
  <section
    class="town-moon-view"
    :class="{ 'is-fallback': unavailable }"
    role="region"
    :aria-label="t('New Hollow on the Moon')"
  >
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
      <ellipse cy="6" rx="22" ry="17" fill="none" stroke="#cfccc3" stroke-width="1.6" />
      <g
        v-for="lot in mapLots"
        :key="lot.id"
        :transform="`translate(${lot.x} ${lot.y}) scale(.07)`"
      >
        <TownMoonBuilding :kind="lot.id" :level="town.buildings[lot.id] ?? 0" />
      </g>
    </svg>
    <div class="town-moon-lots" role="group" :aria-label="t('Moon lots')">
      <button
        v-for="lot in shownLots"
        :key="lot.id"
        type="button"
        class="town-moon-lot"
        :class="{ built: !!town.buildings[lot.id], open: status(lot.id) === 'open' }"
        :style="{ left: `${lot.x}%`, top: `${lot.y}%` }"
        @click="emit('inspect', lot.id)"
      >
        <strong>{{ t(BUILDING_BY_ID[lot.id].shortName) }}</strong>
        <small>{{ statusLabel(lot.id) }}</small>
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
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { BUILDING_BY_ID } from '../../data/town';
import {
  MOON_LOTS,
  moonLetters,
  moonSettlement,
  moonstoneKeepsakes,
} from '../../data/moonSettlement';
import { plotUnlocked } from '../../game/town/TownRules';
import TownMoon from './TownMoon.vue';
import TownMoonBuilding from './TownMoonBuilding.vue';
import { t } from '../../i18n';

// New Hollow, the town's settlement on the Moon. Its own small 3D scene sits over
// the valley view; every lot opens the shared building details, so offers,
// construction and visits work exactly as on Earth.
const props = defineProps({
  town: { type: Object, required: true },
  active: { type: Boolean, default: true },
  paused: { type: Boolean, default: false },
  reducedMotion: { type: Boolean, default: false },
});
const emit = defineEmits(['inspect', 'close']);
const canvas = ref(null);
const unavailable = ref(false);
const labels = ref([]);
let scene = null,
  disposed = false;

const moon = computed(() => moonSettlement(props.town));
const moonstones = computed(() => moonstoneKeepsakes(props.town));
const letters = computed(() => moonLetters(props.town));
// The SVG map uses the same lot layout, flattened onto a crater ellipse.
const mapLots = computed(() =>
  Object.entries(MOON_LOTS).map(([id, [x, z]]) => ({ id, x: x * 1.3, y: 6 + z * 1.05 })),
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
function status(id) {
  if (props.town.projects?.[id]) return 'work';
  if (props.town.buildings?.[id]) return 'built';
  return plotUnlocked(props.town, id) ? 'open' : 'later';
}
function statusLabel(id) {
  return {
    work: t('Under construction'),
    built: t('Lv. {level}', { level: props.town.buildings[id] }),
    open: t('Build'),
    later: t('Coming soon'),
  }[status(id)];
}

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
    });
    scene.update(props.town);
    updateMotion();
  } catch (error) {
    console.error(error);
    unavailable.value = true;
  }
}
watch(
  () => props.town,
  (town) => scene?.update(town),
  { deep: true },
);
watch(() => [props.active, props.paused], updateMotion);
watch(
  () => props.reducedMotion,
  (value) => {
    if (scene) scene.reducedMotion = value;
  },
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
defineExpose({ resetView: () => scene?.resetView() });
</script>

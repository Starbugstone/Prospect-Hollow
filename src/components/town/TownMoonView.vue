<template>
  <!-- Input reaches the document (Escape, audio unlock); the valley ignores it while the
       Moon covers it (TownScene). -->
  <section
    ref="viewElement"
    class="town-moon-view"
    :class="{ 'is-fallback': unavailable }"
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
        :viewBox="`${mapBox.x} ${mapBox.y} ${mapBox.width} ${mapBox.height}`"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <rect
          :x="mapBox.x"
          :y="mapBox.y"
          :width="mapBox.width"
          :height="mapBox.height"
          fill="#10162b"
        />
        <circle :cx="mapBox.x + 22" :cy="mapBox.y + 12" r="7" fill="#4f8fc7" />
        <ellipse cy="6" rx="52" ry="40" fill="#b9b6ad" />
        <!-- A district beyond the rim: its level ground, its roads and its landmark. -->
        <g
          v-for="district in mapDistrictShapes"
          :key="district.id"
          :data-moon-district="district.id"
        >
          <ellipse
            :cx="district.x"
            :cy="district.y"
            :rx="district.floor[0]"
            :ry="district.floor[1]"
            fill="#b9b6ad"
          />
          <ellipse
            :cx="district.x"
            :cy="district.y"
            :rx="district.ring[0]"
            :ry="district.ring[1]"
            fill="none"
            stroke="#cfccc3"
            stroke-width="1.6"
          />
          <line
            :x1="district.road[0][0]"
            :y1="district.road[0][1]"
            :x2="district.road[1][0]"
            :y2="district.road[1][1]"
            stroke="#cfccc3"
            stroke-width="1.6"
          />
          <g v-if="district.answered" data-moon-ribbon="lit">
            <line
              :x1="district.x"
              :y1="district.y"
              :x2="district.ribbon[0]"
              :y2="district.ribbon[1]"
              stroke="#fff3d2"
              stroke-width="0.5"
            />
            <circle
              v-for="(star, n) in district.stars"
              :key="n"
              :cx="star[0]"
              :cy="star[1]"
              :r="star[2]"
              fill="#fff3d2"
            />
          </g>
          <rect
            v-if="district.stone"
            :x="district.x - district.stone[0] / 2"
            :y="district.y - district.stone[1]"
            :width="district.stone[0]"
            :height="district.stone[1]"
            fill="#000000"
            data-moon-landmark="quietStone"
          />
        </g>
        <ellipse
          v-for="ring in MOON_ROADS.rings"
          :key="ring"
          cy="6"
          :rx="ring * 1.3"
          :ry="ring * 1.05"
          fill="none"
          stroke="#cfccc3"
          stroke-width="1.6"
        />
        <line
          v-for="([[ax, az], [bx, bz]], n) in moonSpokes()"
          :key="`spoke-${n}`"
          :x1="ax * 1.3"
          :y1="6 + az * 1.05"
          :x2="bx * 1.3"
          :y2="6 + bz * 1.05"
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
          <TownMoonBuilding
            :kind="lot.id"
            :level="town.buildings[lot.id] ?? 0"
            :finish="{
              era: town.buildingEras?.[lot.id],
              level: town.buildingEraLevels?.[lot.id] ?? 0,
            }"
          />
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
        <TownMapLabel
          v-for="lot in shownLots"
          :key="lot.id"
          :name="lotInfo[lot.id].name"
          :status="lotInfo[lot.id].status"
          :ref="(label) => trackElement(labelElements, lot.id, label?.$el)"
          class="town-moon-lot"
          :data-moon-lot="lot.id"
          :aria-pressed="selected === lot.id"
          :class="{
            selected: selected === lot.id,
            'has-action-icon': !!TOWN_ACTIONS[indicators[lot.id]],
          }"
          :style="{
            translate: box.translate(lot),
            maxWidth: `${lot.width}px`,
            '--label-offset': `${lot.offsetY ?? 0}px`,
          }"
          :aria-label="lotInfo[lot.id].label"
          :title="lotInfo[lot.id].label"
          @click="activateLabel(lot.id, $event)"
        />
      </div>
      <div class="town-action-icons" role="group" :aria-label="t('Village buildings')">
        <TownActionIcon
          v-for="lot in actionLots"
          :key="lot.id"
          :ref="(icon) => trackElement(actionElements, lot.id, icon?.$el)"
          :indicator="indicators[lot.id]"
          :label="buildingActionLabel(town, lot.id, indicators[lot.id])"
          :data-moon-action="lot.id"
          :style="{ translate: box.translate(lot.collection) }"
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
  MOON_ROADS,
  moonApproaches,
  moonDistrictsShown,
  moonLotsShown,
  moonSettlement,
  moonSpokes,
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
import {
  MOON_MAP_SCALE,
  layoutMoonLabels,
  moonMapBox,
  moonMapLabel,
  moonMapPoint,
} from '../../game/town/moon/MoonLabelLayout';
import { townLabelWidth } from '../../game/town/TownLabelLayout';
import {
  canCollectMoonstones as collectable,
  moonLotInfo,
  moonLotLabel,
  moonLotName,
  moonLotStatus,
} from '../../game/town/moon/MoonLotStatus';
import TownActionIcon from './TownActionIcon.vue';
import TownMapLabel from './TownMapLabel.vue';
import {
  TOWN_LABEL_DETAIL_DISTANCE,
  townActionAnchors,
  townLabelDetail,
  townLabelRank,
  labelBox,
  updateLabels,
  placeLabels,
  trackElement,
} from '../../game/town/TownLabels';
import TownMoon from './TownMoon.vue';
import TownMoonstoneBalance from './TownMoonstoneBalance.vue';
import TownMoonBuilding from './TownMoonBuilding.vue';
import TownMoonConstruction from './TownMoonConstruction.vue';
import { cameraKeyAction } from '../../game/town/TownCameraKeys';
import { keyboardActivation } from '../../game/town/TownTapGesture';
import { useGraphicsRecovery } from '../../composables/useGraphicsRecovery';
import { quietStoneLabel, signalAnswered, starMap } from '../../data/quietSignal';
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
  // Hidden finds, as on the valley map (TownScene).
  'find',
  'find-zoom',
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
const box = labelBox();
const labelElements = new Map(),
  actionElements = new Map();
const renderedLots = shallowRef([]);
let renderedLayout = '';
let scene = null,
  disposed = false;

const townClock = inject('townClock', null);
const canCollectMoonstones = computed(() =>
  collectable(props.town, townClock?.value ?? Date.now()),
);
const moon = computed(() => moonSettlement(props.town));
// The SVG map uses the same lot layout, flattened onto a crater ellipse.
// A later era's lots stay off the map until the town reaches it.
const mapLots = computed(() =>
  moonLotsShown(props.town).map((id) => {
    const [x, z] = MOON_LOTS[id];
    return { id, x: x * 1.3, y: 6 + z * 1.05 };
  }),
);
const mapDistricts = computed(() => moonDistrictsShown(props.town));
// The SVG map grows to hold an opened district, drawn with the crater's own flattening.
const mapBox = computed(() => moonMapBox(mapDistricts.value));
const mapDistrictShapes = computed(() =>
  mapDistricts.value.map(({ id, centre, floor, ring, road, stone }) => {
    const [x, y] = moonMapPoint(...centre),
      [sx, sy] = MOON_MAP_SCALE;
    // The ribbon and its stars run from the stone toward New Hollow, as in the 3D scene.
    const along = [Math.sin(stone?.turn ?? 0), Math.cos(stone?.turn ?? 0)];
    const place = (a, c) =>
      moonMapPoint(
        centre[0] + along[0] * a + along[1] * c,
        centre[1] + along[1] * a - along[0] * c,
      );
    return {
      id,
      x,
      y,
      floor: [floor * sx, floor * sy],
      ring: [ring * sx, ring * sy],
      road: road.map((point) => moonMapPoint(...point)),
      stone: stone ? [stone.size[0] * sx, stone.size[1]] : null,
      answered: !!stone && signalAnswered(props.town),
      ribbon: place(ring - 1, 0),
      stars: starMap(ring).stars.map(([a, c, size]) => [...place(a, c), 0.15 + size]),
    };
  }),
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
    crest: props.town.personalisation?.crest,
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
// A district's fixed landmark (the Quiet Stone): no lot, no status, only a quiet label.
const stone = computed(() => quietStoneLabel(props.town));
const mapLandmarks = computed(() =>
  mapDistricts.value
    .filter((district) => district.stone && stone.value)
    .map(({ centre, stone: slab }) => {
      const [x, y] = moonMapPoint(...centre);
      return { id: stone.value.id, x, y: y - slab.size[1] };
    }),
);
const allLots = computed(() => [...mapLots.value, ...mapMonuments.value, ...mapLandmarks.value]);
// Content changes with the town or its markers, not with camera frames.
// TownMapLabel owns all state styling on both maps.
const lotInfo = computed(() => {
  const options = {
    indicators: props.indicators,
    availableIds: props.availableIds,
    collectable: canCollectMoonstones.value,
    readOnly: props.readOnly,
  };
  return Object.fromEntries(
    allLots.value.map(({ id }) => {
      if (id === stone.value?.id) {
        const [name, text] = [t(stone.value.name), t(stone.value.line)];
        return [
          id,
          { name, status: { kind: 'note', text }, label: `${name} · ${text}`, landmark: true },
        ];
      }
      const status = moonLotInfo(props.town, id, options);
      return [
        id,
        {
          name: moonLotName(id, props.town),
          status,
          label: moonLotLabel(props.town, id, options),
          state: moonLotStatus(props.town, id),
        },
      ];
    }),
  );
});
const collecting = (id) =>
  id === 'moonstoneWorkshop' && lotInfo.value[id]?.status?.kind === 'coins';
const placedLots = computed(() => {
  const { width, height } = viewport.value;
  const projected = unavailable.value
    ? allLots.value.map((lot) => moonMapLabel(lot, viewport.value, mapBox.value))
    : labels.value;
  return layoutMoonLabels(
    projected.map((lot) => {
      const info = lotInfo.value[lot.id];
      const selected = lot.id === selectedLot.value;
      const attention =
        !props.readOnly &&
        (!!TOWN_ACTIONS[props.indicators[lot.id]] ||
          collecting(lot.id) ||
          ['open', 'work', 'ready'].includes(info.state));
      return {
        ...lot,
        width: townLabelWidth(info.name, info.status?.text),
        rank: townLabelRank({
          selected,
          ready: info.status?.kind === 'ready',
          available: attention,
        }),
        inView: lot.visible,
        // The stone stands unlabelled until it is tapped.
        visible:
          lot.visible &&
          (info.landmark
            ? selected
            : townLabelDetail({
                distant: !unavailable.value && cameraDistance.value > TOWN_LABEL_DETAIL_DISTANCE,
                selected,
                attention,
              })),
        action: !!TOWN_ACTIONS[props.indicators[lot.id]],
      };
    }),
    width,
    height,
  );
});
// The same composited movement as the valley: camera frames update DOM transforms,
// and Vue only redraws when visibility or label dimensions change.
watch(
  placedLots,
  (positions) => {
    const layout = updateLabels(renderedLots.value, positions, renderedLayout);
    if (layout === null) placeLabels(renderedLots.value, labelElements, actionElements, box);
    else {
      renderedLayout = layout;
      renderedLots.value = positions;
    }
  },
  { immediate: true, flush: 'sync' },
);
const shownLots = computed(() => renderedLots.value.filter((lot) => lot.visible));
const actionLots = computed(() => townActionAnchors(renderedLots.value, props.indicators));
const choose = (id) => {
  selectedLot.value = id;
  emit(props.readOnly ? 'inspect' : 'select', id);
};
// Pointer taps on labels and action buttons settle through the scene's shared tap
// gesture; their click opens a lot only from the keyboard, or on the SVG map. Opening
// the workshop collects its moonstones, as the valley's saloon pays out (TownView).
function activateLabel(id, event) {
  if (lotInfo.value[id]?.landmark) return;
  if (!scene || keyboardActivation(event)) choose(id);
}
function cameraKey(event) {
  const action = cameraKeyAction(event);
  if (action) scene?.cameraAction(action);
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
      // A tapped landmark shows its label; there is nothing to open.
      onLandmark: (id) => (selectedLot.value = selectedLot.value === id ? null : id),
      onVipSpend: (receipt) => emit('vip-spend', receipt),
      onFind: (tap) => emit('find', tap),
      onFindZoom: (find) => emit('find-zoom', find),
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
// A completed puzzle changes no lot, yet it may bring the wandering pair here or send
// them back to the valley.
watch(
  () => props.town.completedRuns,
  () => {
    scene?.placeWanderers(props.town);
    scene?.requestFrame();
  },
);
watch(() => [props.indicators, props.upgradeIds], updateGlow);
watch(selectedLot, (id) => scene?.setSelected(id ?? null));
watch(() => [props.active, props.paused], updateMotion);
watch(
  () => props.reducedMotion,
  (value) => scene?.setReducedMotion(value),
);
onMounted(() => {
  labelObserver = new ResizeObserver(([entry]) => {
    box.measure(viewElement.value);
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
</style>

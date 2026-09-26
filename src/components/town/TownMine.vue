<template>
  <g
    class="town-mine-entrance"
    :data-era="era"
    :data-profile="profile.key"
    :role="decorative ? undefined : 'button'"
    :tabindex="decorative ? undefined : 0"
    :aria-label="t('Enter the mine: play level {value0}', { value0: level })"
    @click="$emit('enter')"
    @keydown.enter.prevent="$emit('enter')"
    @keydown.space.prevent="$emit('enter')"
  >
    <rect
      class="mine-hit-area"
      x="-96"
      y="-54"
      width="192"
      height="172"
      rx="25"
      fill="transparent"
    />
    <g aria-hidden="true">
      <ellipse cy="68" rx="101" ry="20" fill="#625037" opacity=".22" />
      <path d="M-108 57-88-38-52-81-7-96 49-62 84-11 110 58 27 78Z" fill="#a59c7c" />
      <path d="m-108 57 56-138 16 74-15 64Zm101-153 33 80 58 5-35-51Z" fill="#c7b58c" />
      <g
        v-if="features.has('upper-terrace')"
        :fill="appearance.wall"
        :stroke="appearance.frame"
        stroke-width="3"
      >
        <path d="M-60-40V-66H20V-40Z" /><path d="M-67-40H28" stroke-width="7" />
        <path d="M-51-54H11" stroke="#7aa5ac" stroke-width="9" />
      </g>
      <g v-if="features.has('benches')" stroke="#bdb69e" stroke-width="8"
        ><path d="M-87-18H-33M-81-34H-28M-72-50H-23"
      /></g>
      <g v-if="features.has('ropeway')" :stroke="appearance.frame" stroke-width="3">
        <path d="M-3-85V-48M90-18V50M-3-80 90-15" />
        <path d="M21-63v12h12v-12M52-42v12h12v-12" :fill="appearance.roof" />
      </g>
      <g v-if="profile.summit === 'radio-mast'" stroke="#5e7779" stroke-width="3"
        ><path d="M0-94V-140M-12-117H12M-9-128H9" /><circle cy="-142" r="4" fill="#ecbb78"
      /></g>
      <g v-if="profile.summit === 'wind-turbine'" stroke="#dedecb" stroke-width="5"
        ><path d="M0-92V-132M0-132-19-145M0-132 21-143M0-132 0-108"
      /></g>
      <g v-for="vein in growth.veins" :key="vein.segmentIndex" :fill="vein.colour">
        <path
          :transform="`translate(${-55 + (vein.segmentIndex % 9) * 9 + vein.seamIndex * 2} ${-24 - vein.seamIndex * 8})`"
          d="M-3 0 0-3 4 0 1 3Z"
        />
      </g>
      <g :stroke="appearance.frame" stroke-width="5" fill="none" transform="translate(-113 10)">
        <path
          :d="`M-20 40V${-appearance.height * 11}H20V40M-20 32 20 ${-appearance.height * 11 + 8}`"
        />
        <circle :cy="-appearance.height * 11" r="10" :fill="appearance.roof" />
        <path v-if="profile.works !== 'windlass'" d="M-30 42V9H5v33Z" :fill="appearance.wall" />
      </g>
      <path d="M-38 60V-5H38V60Z" fill="#283330" />
      <path
        d="M-47 61V-13H47V61"
        fill="none"
        :stroke="profile.portal === 'timber' ? '#9f784d' : appearance.wall"
        stroke-width="13"
      />
      <path
        v-if="profile.portal !== 'timber'"
        d="M-55-16H55M-7-16H7"
        :stroke="appearance.roof"
        stroke-width="10"
      />
      <path
        v-if="
          ['stepped-cream', 'ribbon-control', 'glazed-tower', 'solar-industrial'].includes(
            profile.portal,
          )
        "
        d="M-65-25H65M-29-36H29"
        :stroke="appearance.roof"
        stroke-width="10"
      />
      <path
        v-if="features.has('solar-canopy')"
        d="M-69-35-38-51 53-34 31-20Z"
        fill="#456d7b"
        stroke="#a5bbb1"
        stroke-width="2"
      />
      <path d="M-13 29-28 86M13 31 33 90" stroke="#6b6655" stroke-width="4" />
      <path d="m-19 48 40 3m-43 11 47 3m-51 11 56 4" stroke="#9b7d50" stroke-width="5" />
      <g class="mine-cart" :data-cart="profile.cart"
        ><path
          d="m-16 36 33 2-4 23-26-3Z"
          :fill="profile.cart === 'hand-tub' ? '#a78158' : appearance.frame" /><path
          d="m-9 35 4-10 8 4 6-7 9 10Z"
          fill="#ad87ba" /><circle cx="-8" cy="61" r="5" fill="#394543" /><circle
          cx="10"
          cy="63"
          r="5"
          fill="#394543"
      /></g>
      <g
        v-if="features.has('tipple') || features.has('truck-bay')"
        :stroke="appearance.frame"
        stroke-width="4"
        :fill="appearance.wall"
        ><path d="M87 65V16h40v49M83 16h49v17H83Z" /><path
          v-if="features.has('truck-bay')"
          d="M77 55h46v13H77Z" /><circle
          v-if="features.has('truck-bay')"
          cx="84"
          cy="69"
          r="5"
          fill="#394543"
      /></g>
      <g
        v-if="features.has('fan-house') || features.has('crusher') || features.has('sorting-plant')"
        :fill="appearance.wall"
        :stroke="appearance.roof"
        stroke-width="3"
        ><path d="M66 22V-7h41v29Z" /><circle cx="86" cy="8" r="10" fill="#5f7980"
      /></g>
      <g v-for="n in growth.stockpile + 1" :key="`stock-${n}`"
        ><path
          :transform="`translate(${105 - n * 8} 65)`"
          d="M-8 0-6-12H6L8 0Z"
          :fill="appearance.frame"
      /></g>
      <path v-if="growth.plaque" d="M-67 57h16v10h-16Z" fill="#d8bd76" />
      <g v-if="!decorative" class="mine-label" transform="translate(0 103)"
        ><rect
          x="-93"
          y="-17"
          width="186"
          height="35"
          rx="17"
          fill="#e1f0c0"
          stroke="#e7d1a0"
          stroke-width="2"
        /><text
          y="6"
          text-anchor="middle"
          fill="#405b35"
          font-family="Georgia, serif"
          font-size="18"
          >{{ t('Mine · Level') }} {{ level }} →</text
        ></g
      >
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { mineAppearance, mineProfile } from '../../data/mineEvolution';
import { mineGrowth } from '../../data/mineGrowth';
import { t } from '../../i18n';
const props = defineProps({
  level: { type: Number, default: 1 },
  decorative: Boolean,
  stage: { type: Number, default: 0 },
  era: { type: String, default: 'frontier' },
});
const appearance = computed(() => mineAppearance(props.era));
const profile = computed(() => mineProfile(props.era));
const growth = computed(() => mineGrowth(props.stage));
const features = computed(
  () => new Set(profile.value.site.map((f) => (typeof f === 'string' ? f : f.feature))),
);
defineEmits(['enter']);
</script>

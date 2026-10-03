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
        v-for="building in hillsideBuildings"
        :key="building.feature"
        :data-feature="building.feature"
        :transform="`translate(${building.x} ${building.y})`"
        :fill="appearance.wall"
        :stroke="appearance.frame"
        stroke-width="2"
      >
        <path
          v-if="building.feature === 'sorting-dome'"
          d="M-24 9a24 24 0 0 1 48 0Z"
          fill="#a6d3d4"
          stroke="#8fb07a"
          stroke-width="4"
        />
        <template v-else-if="['garden-sorting', 'lantern-sorting'].includes(building.feature)">
          <path d="M-23 9V-16Q0-27 23-16V9Z" :fill="appearance.wall" />
          <path d="M-21-10H21V0H-21Z" :fill="appearance.palette.glass" stroke="none" />
          <path d="M-16-13V8M0-15V9M16-13V8" :stroke="appearance.palette.timber" />
          <path
            d="M-29-15Q-22-34 0-28Q22-34 29-15Q16-9 0-17Q-16-9-29-15Z"
            :fill="appearance.roof"
            :stroke="appearance.wall"
          />
          <path
            d="M-12-16Q-6-35 0-31Q6-35 12-16Q0-10-12-16Z"
            :fill="
              appearance.cozyStyle === 'riverlight' ? appearance.palette.glass : appearance.roof
            "
          />
          <path d="M-5 9V-4H5V9Z" :fill="appearance.palette.deep" />
          <path
            v-if="appearance.cozyStyle === 'riverlight'"
            d="M0-47 5-39 0-31-5-39Z"
            :fill="appearance.palette.light"
          />
        </template>
        <template v-else>
          <path d="M-19 9V-13H19V9Z" /><path
            d="M-23-13H23"
            :stroke="appearance.roof"
            stroke-width="5"
          />
          <path d="M-12-4H12" stroke="#7aa5ac" stroke-width="5" />
        </template>
      </g>
      <g v-if="features.has('benches')" stroke="#bdb69e" stroke-width="8"
        ><path d="M-87-18H-33M-81-34H-28M-72-50H-23"
      /></g>
      <g v-if="features.has('ropeway')" :stroke="appearance.frame" stroke-width="3">
        <path d="M-3-85V-48M90-18V50M-3-80 90-15" />
        <path d="M21-63v12h12v-12M52-42v12h12v-12" :fill="appearance.roof" />
      </g>
      <g v-if="features.has('radio-mast')" stroke="#5e7779" stroke-width="3"
        ><path d="M0-94V-140M-12-117H12M-9-128H9" /><circle cy="-142" r="4" fill="#ecbb78"
      /></g>
      <g v-if="features.has('wind-turbine')" stroke="#dedecb" stroke-width="5"
        ><path transform="translate(45 -5)" d="M0-92V-132M0-132-19-145M0-132 21-143M0-132 0-108"
      /></g>
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
      <g v-if="profile.portal === 'rounded-arch'">
        <path d="M-60-16a60 34 0 0 1 120 0Z" fill="#a6d3d4" stroke="#6d9f98" stroke-width="5" />
      </g>
      <g v-if="appearance.cozyStyle" :stroke="appearance.palette.timber" stroke-width="3">
        <path d="M-61-16Q-46-46 0-36Q46-46 61-16Q35-9 0-21Q-35-9-61-16Z" :fill="appearance.roof" />
        <path
          d="M-25-20Q-12-49 0-40Q12-49 25-20Q0-8-25-20Z"
          :fill="appearance.cozyStyle === 'riverlight' ? appearance.palette.glass : appearance.roof"
        />
        <path d="M-46-14V49M46-14V49" />
        <path
          v-if="appearance.cozyStyle === 'riverlight'"
          d="M0-66 7-55 0-42-7-55Z"
          :fill="appearance.palette.light"
        />
        <circle
          v-for="x in [-47, 47]"
          :key="x"
          :cx="x"
          cy="5"
          r="4"
          :fill="appearance.palette.light"
        />
      </g>
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
          v-for="(gem, index) in growth.gems"
          :key="index"
          :transform="`translate(${gem.x * 60} ${35 - (gem.y - 0.6) * 65 + gem.z * 14})`"
          d="M-6 0-2-6 5-4 7 1 0 4Z"
          :fill="gem.color" /><circle cx="-8" cy="61" r="5" fill="#394543" /><circle
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
  era: { type: String, default: 'frontier' },
});
const appearance = computed(() => mineAppearance(props.era));
const profile = computed(() => mineProfile(props.era));
const growth = computed(() => mineGrowth(Math.max(0, props.level - 1)));
const features = computed(
  () => new Set(profile.value.site.map((f) => (typeof f === 'string' ? f : f.feature))),
);
const hillsideBuildings = computed(() =>
  [
    { feature: 'crusher', x: -58, y: -25 },
    { feature: 'fan-house', x: 45, y: -29 },
    { feature: 'upper-terrace', x: -27, y: -63 },
    { feature: 'sorting-plant', x: 32, y: -80 },
    { feature: 'sorting-dome', x: 32, y: -80 },
    { feature: 'garden-sorting', x: 32, y: -80 },
    { feature: 'lantern-sorting', x: 32, y: -80 },
  ].filter(({ feature }) => features.value.has(feature)),
);
defineEmits(['enter']);
</script>

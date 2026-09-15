<template>
  <g stroke-linejoin="round" stroke-linecap="round">
    <template v-if="!newPlot">
      <TownCityBuilding
        v-if="['cityHall', 'apartments', 'supermarket', 'waterPlant'].includes(kind)"
        :kind="kind"
        era="post-war"
        :level="1"
      />
      <TownIndustrialBuilding v-else :kind="kind" :level="level" />
      <g v-if="['square', 'bridge', 'well', 'farm', 'fisherman', 'riverPort'].includes(kind)">
        <g v-for="x in [-100, 100]" :key="x" :transform="`translate(${x} -15)`">
          <path d="M-8 0h16v-22H-8Z" fill="#e1cfab" />
          <path :d="`M0-22v${-45 - level * 9}`" stroke="#648d89" stroke-width="5" />
          <circle :cy="-70 - level * 9" r="9" fill="#f6db98" stroke="#648d89" stroke-width="3" />
        </g>
        <g v-if="kind === 'well' && level >= 2" transform="translate(0 -144)">
          <path
            d="M-46 0v-33Q0-53 46-33V0Q0 20-46 0"
            fill="#8caaa3"
            stroke="#e1cfab"
            stroke-width="4"
          />
          <path d="M-51-33 0-58 51-33Q0-16-51-33" fill="#648d89" />
        </g>
        <g v-if="kind === 'farm' && level >= 2">
          <path d="M-120 0v-48l32-24 32 24V0Z" fill="#9cbbb5" stroke="#e1cfab" stroke-width="4" />
          <path d="M-88-70V0m-30-47h60" stroke="#e1cfab" stroke-width="3" />
        </g>
      </g>
      <g v-else>
        <path d="M-92-8v-119h15V-8M73-8v-119h15V-8M-94-128H90v20H-94Z" fill="#e1cfab" />
        <path d="M-97-108H96l15 19H-110Z" fill="#648d89" stroke="#e1cfab" stroke-width="3" />
        <path
          v-if="level >= 2"
          d="M-129 0v-114h40V0Z"
          fill="#e1cfab"
          stroke="#648d89"
          stroke-width="4"
        />
        <path
          v-if="level >= 3"
          d="M17-128v-17h9v-16h10v-15h20v15h10v16h9v17Z"
          fill="#e1cfab"
          stroke="#648d89"
          stroke-width="3"
        />
      </g>
    </template>
    <template v-else-if="kind === 'gardenCourt'">
      <g
        v-for="n in level"
        :key="n"
        :transform="`translate(${(n - (level + 1) / 2) * 80} ${n % 2 ? 0 : -15})`"
      >
        <path d="M-35 0v-83h70V0Z" fill="#c4a38b" stroke="#e1cfab" stroke-width="3" />
        <path d="M-41-84h82v-9h-82Z" fill="#648d89" />
        <path
          d="M-8 0v-41H8V0M-26-68h16v18h-16M10-68h16v18H10"
          fill="#9cbbb5"
          stroke="#648d89"
          stroke-width="3"
        />
        <path d="M-37 0h74v9h-74Z" fill="#e1cfab" />
        <circle cx="-30" cy="7" r="12" fill="#92aa78" />
      </g>
    </template>
    <template v-else>
      <ellipse cy="14" rx="120" ry="21" fill="#795a3c" opacity=".13" />
      <path
        d="M-87 0v-111H78V0Z"
        :fill="kind === 'diner' ? '#b88073' : '#e1cfab'"
        stroke="#b39f7b"
        stroke-width="3"
      />
      <path d="M-95-112H86v-11H-95Z" fill="#648d89" />
      <path
        v-if="kind === 'garage'"
        d="M-66 0v-80H8V0M-62-65H4m-66 17H4m-66 17H4m-66 17H4"
        fill="#526b65"
        stroke="#9cbbb5"
        stroke-width="4"
      />
      <g v-else>
        <path
          v-for="x in [-69, -33, 3, 39]"
          :key="x"
          :d="`M${x}-79h25v40h-25Z`"
          fill="#9cbbb5"
          stroke="#648d89"
          stroke-width="3"
        />
        <path d="M-94-88H88l15 20H-106Z" fill="#648d89" stroke="#e1cfab" stroke-width="3" />
        <path d="M-95-65V7M94-65V7" stroke="#e1cfab" stroke-width="5" />
      </g>
      <g
        v-if="kind !== 'diner'"
        :transform="kind === 'garage' ? 'translate(-19 3) scale(.72)' : 'translate(0 7)'"
      >
        <path
          d="M-61 0v-39q0-8 9-8h99q13 0 17 19V0Z"
          fill="#d8b976"
          stroke="#648d89"
          stroke-width="3"
        />
        <path
          d="M-49-38h22v18h-22M-18-38H4v18h-22M13-38h22v18H13M44-37h10l5 17H44Z"
          fill="#9cbbb5"
          stroke="#e1cfab"
          stroke-width="2"
        />
        <circle
          v-for="x in [-39, 42]"
          :key="x"
          :cx="x"
          cy="1"
          r="11"
          fill="#4c554f"
          stroke="#e1cfab"
          stroke-width="3"
        />
        <path d="M-60-10h10m101 0h11" stroke="#f6db98" stroke-width="5" />
      </g>
      <g v-else stroke="#e1cfab" stroke-width="5">
        <path d="M-67-10h34m-17 0v21M34-10h34m-17 0v21" />
        <path d="M-16-129v-26h30v26" fill="#e1cfab" />
        <path d="M14-151q24 0 5 17" fill="none" />
      </g>
      <g v-if="level >= 2">
        <path d="M-125 0v-124h34V0Z" fill="#e1cfab" stroke="#648d89" stroke-width="4" />
        <path d="M-118-102h19v26h-19Z" fill="#9cbbb5" />
      </g>
      <g v-if="level >= 3">
        <path
          d="M31-123v-16h8v-16h9v-15h20v15h9v16h8v16Z"
          fill="#e1cfab"
          stroke="#648d89"
          stroke-width="3"
        />
        <circle cx="58" cy="-145" r="10" fill="#f6db98" />
        <path d="M58-152v7h5" stroke="#648d89" stroke-width="2" />
      </g>
    </template>
    <g v-if="newPlot || level >= 2" fill="#92aa78">
      <circle v-for="n in level + 1" :key="n" :cx="90 - n * 16" cy="14" r="9" />
    </g>
  </g>
</template>
<script setup>
import TownCityBuilding from './TownCityBuilding.vue';
import { computed } from 'vue';
import TownIndustrialBuilding from './TownIndustrialBuilding.vue';
const props = defineProps({ kind: String, level: { type: Number, default: 1 } });
const newPlot = computed(() => ['garage', 'busDepot', 'gardenCourt', 'diner'].includes(props.kind));
</script>

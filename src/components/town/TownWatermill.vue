<template>
  <g stroke="#78664d" stroke-width="3" stroke-linejoin="round">
    <path
      d="M110-21C80-18 48-10 46 9S77 34 120 36"
      fill="none"
      stroke="#a79878"
      stroke-width="27"
    />
    <path
      d="M110-21C80-18 48-10 46 9S77 34 120 36"
      fill="none"
      stroke="#598f8c"
      stroke-width="16"
    />
    <path d="M-65 0V-90L-6-117 37-78V12Z" :fill="style.wall" />
    <path d="m-75-87 69-44 57 50-17 7-42-33-56 35Z" :fill="style.roof" />
    <path d="M-48-6v-46h22v52" fill="#685139" />
    <path d="M-57-72h23v19h-23Zm46 10h22v21h-22Z" fill="#8baead" />
    <path v-if="level >= 2" d="m-69-42 108 17 6 12-118-18Zm4 13v33m100-13v33" :fill="style.roof" />
    <path v-if="level >= 3" d="m-88-28 25 4v30l-25-5Zm-5-5 30 3v9l-30-3Z" :fill="style.wall" />
    <g transform="translate(52 -14)">
      <ellipse rx="22" ry="36" :fill="style.roof" stroke-width="6" />
      <ellipse rx="16" ry="28" fill="#4e5e54" />
      <path
        v-for="n in 8"
        :key="n"
        :d="`M0 0 ${Math.cos((n * Math.PI) / 4) * 20} ${Math.sin((n * Math.PI) / 4) * 33}`"
        stroke="#bfa275"
        stroke-width="4"
      />
      <ellipse rx="4" ry="6" fill="#cbb489" />
    </g>
    <path v-if="style.electric" d="M4 0v-26h15V3Z" fill="#81988d" />
    <path v-if="style.aerial" d="M-8-124v-25m-9 6h18" fill="none" />
    <path v-if="style.tall" d="M-38-103v-21l22 4v9" :fill="style.wall" />
    <path v-if="style.solar" d="m-2-111 32 28-9 6-32-28Z" fill="#3f6475" />
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { watermillAppearance } from '../../data/watermill';
const props = defineProps({ era: String, level: Number });
const style = computed(() => watermillAppearance(props.era));
</script>

<template>
  <svg viewBox="0 0 120 90" aria-hidden="true" class="personal-design-art">
    <ellipse cx="60" cy="78" rx="55" ry="9" fill="#dedbc3" />
    <template v-if="['pavilion', 'gallery'].includes(choice)">
      <path d="M28 40v35M92 40v35" stroke="#91785e" stroke-width="5" />
      <path d="M17 42 60 14 103 42Z" :fill="roof" />
      <rect
        v-if="choice === 'gallery'"
        x="45"
        y="45"
        width="30"
        height="25"
        fill="#f4ead5"
        stroke="#91785e"
      />
      <path v-if="choice === 'gallery'" d="m50 64 9-13 12 13Z" fill="#9b91c4" />
    </template>
    <template v-else>
      <rect
        x="28"
        y="38"
        width="64"
        height="39"
        rx="3"
        :fill="choice === 'glasshouse' ? '#a0ccc4' : paint.walls || '#f4ead5'"
      />
      <path v-if="choice === 'observatory'" d="M25 40a35 29 0 0 1 70 0Z" :fill="roof" />
      <path v-else d="M18 41 60 11 102 41Z" :fill="roof" />
      <path v-if="choice === 'observatory'" d="m68 23 15-13" stroke="#91785e" stroke-width="7" />
      <path d="M53 77V54h14v23" :fill="paint.accent || '#655343'" />
      <path
        d="M35 49h11v14H35ZM74 49h11v14H74Z"
        fill="#a0ccc4"
        :stroke="paint.trim || '#91785e'"
        stroke-width="3"
      />
    </template>
    <template v-if="['garden', 'orchard', 'teahouse', 'glasshouse'].includes(choice)">
      <path d="M9 77h15l-2-12H11ZM97 77h15l-2-12H99Z" fill="#c58f73" />
      <path
        d="M7 61a10 10 0 1 0 20 0a10 10 0 1 0-20 0M94 61a10 10 0 1 0 20 0a10 10 0 1 0-20 0"
        fill="#8caf80"
      />
      <path d="M13 57h7v7h-7ZM100 56h7v7h-7Z" fill="#eddaeb" />
    </template>
    <path
      v-if="choice === 'orchard'"
      d="M10 70V37M3 38a10 13 0 1 0 20 0a10 13 0 1 0-20 0"
      fill="#8caf80"
      stroke="#91785e"
      stroke-width="2"
    />
    <template v-if="['veranda', 'market'].includes(choice)">
      <path d="M17 51H103V59H17Z" :fill="choice === 'market' ? '#bd705f' : '#658c68'" />
      <path d="M21 59v18M99 59v18" stroke="#91785e" stroke-width="3" />
    </template>
    <path
      v-if="choice === 'crystal'"
      d="M5 70 11 46 19 42 24 66 16 78ZM97 72 101 50 110 47 116 70 107 79Z"
      fill="#9b91c4"
      stroke="#7b6caa"
    />
    <path
      v-if="choice === 'sculpture'"
      d="M8 76h17v-6H8ZM10 68l7-25 7 25ZM96 76h17v-6H96ZM97 68l7-25 7 25Z"
      fill="#cc954f"
    />
    <template v-if="['artisan', 'workshop'].includes(choice)">
      <path d="M5 64h28v5H5ZM8 69v9M30 69v9" fill="#91785e" stroke="#91785e" stroke-width="2" />
      <path d="M11 62v-9h7v9ZM22 62V50h6v12Z" fill="#76b0a6" />
    </template>
  </svg>
</template>
<script setup>
import { computed } from 'vue';
const props = defineProps({
  choice: { type: String, default: 'original' },
  paint: { type: Object, default: () => ({}) },
});
const roof = computed(() => props.paint.roof || '#658c68');
</script>

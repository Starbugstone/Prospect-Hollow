<template>
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path :d="paths[name] || paths.spark" />
  </svg>
</template>
<script setup>
defineProps({ name: { type: String, default: 'spark' } });
const paths = {
  wall: 'M3 4h18v16H3ZM3 9h18M3 14h18M9 4v5m7 0v5M9 14v6',
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  'eye-off':
    'm3 3 18 18M9 5.4A12 12 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-3 3.8M6 6.5A20 20 0 0 0 2 12s3.5 7 10 7a13 13 0 0 0 5-1M10 10a3 3 0 0 0 4 4',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z',
  chest: 'M4 11h16v9H4ZM4 11a4 4 0 0 1 4-5h8a4 4 0 0 1 4 5M4 14h16M11 13h2v3h-2Z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4v5l3 2',
  clipboard: 'M9 3h6v3H9ZM9 4.5H5V21h14V4.5h-4M8 12l2 2 4-4M8 17h8',
  book: 'M12 6v15M12 6C9 3 5 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-3-1-7-1-10 2Z',
  pickaxe: 'm13 10-8 11-2-2 9-10M5 3c7-1 13 5 15 12-4-5-8-9-15-12Zm7 1 3-2 3 3-3 3',
  home: 'm3 11 9-8 9 8M5 9v12h5v-7h4v7h5V9',
  info: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 8v6m0-10v.5',
  hint: 'M9 18h6m-5 3h4M9 15c0-2-3-3-3-6a6 6 0 1 1 12 0c0 3-3 4-3 6ZM12 1v1M2 9H1m22 0h-1',
  spark: 'M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  arrow: 'M5 12h14m-5-5 5 5-5 5',
  back: 'M19 12H5m5-5-5 5 5 5',
  chevron: 'm6 9 6 6 6-6',
  settings:
    'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM10 3h4l.7 2.2 2 .9 2.2-.5 2 3.4-1.5 1.7v2.6l1.5 1.7-2 3.4-2.2-.5-2 .9L14 21h-4l-.7-2.2-2-.9-2.2.5-2-3.4 1.5-1.7v-2.6L3.1 9l2-3.4 2.2.5 2-.9Z',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  'clear-row': 'M3 12h18M7 8l-4 4 4 4m10-8 4 4-4 4M10 4h4m-4 16h4',
  tnt: 'M4 9h16v12H4ZM8 9V6h8v3M12 6V3l4-2M8 13v5m4-5v5m4-5v5',
  'color-wand': 'm4 21 11-11M15 2l1.5 4.5L21 8l-4.5 1.5L15 14l-1.5-4.5L9 8l4.5-1.5ZM5 4v4M3 6h4',
  shuffle: 'M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4',
  'tile-breaker': 'M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z',
  sound: 'M11 4 5 9H2v6h3l6 5ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
  muted: 'M11 4 5 9H2v6h3l6 5Zm5 5 6 6m0-6-6 6',
  close: 'm6 6 12 12M6 18 18 6',
  sync: 'M20 11a8 8 0 0 0-14.3-4.9L4 8m0-4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16m0 4v-4h-4',
  external: 'M14 4h6v6m0-6-9 9m7 1v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
  cloud: 'M7 19h10a4 4 0 0 0 .6-8A6 6 0 0 0 6 10a4.5 4.5 0 0 0 1 9Z',
  mail: 'M3 5h18v14H3Zm0 2 9 6 9-6',
  user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM4 21a8 8 0 0 1 16 0',
  devices: 'M2 4h14v10H2Zm4 14h6m5-10h5v12h-5Z',
  layers: 'm12 3 9 5-9 5-9-5Zm-9 10 9 5 9-5',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5m4-1v5l3 2',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  copy: 'M8 8h12v12H8Zm8 0V4H4v12h4',
  share:
    'M18 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM6 9.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM18 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5Zm-9.8-5.2 7.6-4.4m-7.6 7.2 7.6 4.4',
  check: 'm5 12 5 5 9-10',
  download: 'M12 4v11m-5-5 5 5 5-5M5 20h14',
  phone: 'M7 2h10v20H7Zm4 16h2',
  plus: 'M12 5v14M5 12h14',
};
</script>
<style scoped>
svg {
  width: 22px;
  height: 22px;
  flex-shrink: 0;
}
</style>

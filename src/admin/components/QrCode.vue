<template>
  <svg
    class="admin-qr"
    :viewBox="`0 0 ${qr.size} ${qr.size}`"
    role="img"
    :aria-label="label"
    shape-rendering="crispEdges"
  >
    <rect :width="qr.size" :height="qr.size" fill="#fff" />
    <path :d="path" fill="#000" />
  </svg>
</template>
<script setup>
import { computed } from 'vue';
import { encode } from 'uqr';
const props = defineProps({ text: { type: String, required: true }, label: String });
// Drawn from the module grid: the secret never leaves the page for an image service.
const qr = computed(() => encode(props.text, { ecc: 'M', border: 2 }));
const path = computed(() =>
  qr.value.data
    .flatMap((row, y) => row.map((dark, x) => (dark ? `M${x} ${y}h1v1h-1z` : '')))
    .join(''),
);
</script>

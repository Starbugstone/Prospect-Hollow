<template>
  <g v-if="feature" stroke="#dfcba4" stroke-width="3" stroke-linejoin="round">
    <g
      v-if="
        ['veranda', 'classroom', 'clinic', 'office', 'gallery', 'dispatch', 'hayloft'].includes(
          feature,
        )
      "
      transform="translate(-100 -78)"
    >
      <path d="M-21 0v-43l39 8V8Z" fill="#ad725c" />
      <path d="m-27-45 47 9 19-12-46-10Z" fill="#526e79" />
      <path d="M-11-32v20l18 4v-20Z" fill="#9bbbbb" />
      <path
        v-if="feature === 'veranda'"
        d="m-29 2 54 12V-6M-29-9v11m12-8V5m12-8V8m12-8v10M-29 2v78M25 14v75"
        fill="none"
      />
      <path
        v-if="feature === 'clinic'"
        d="M-2-30v17m-8-10 17 4"
        stroke="#538e78"
        stroke-width="5"
      />
      <path v-if="feature === 'office'" d="M-7-31v20M1-29v20" stroke="#53726d" />
      <path v-if="feature === 'gallery'" d="m-19-46 14-12 32 8-11 12Z" fill="#9bbbbb" />
      <path
        v-if="feature === 'dispatch'"
        d="M0-47v-42m-17 12 34 6m-34 7 34 6"
        fill="none"
        stroke="#856b4a"
      />
      <path
        v-if="feature === 'hayloft'"
        d="M0-35v30m0-37 0-10 30 6v59"
        fill="none"
        stroke="#856b4a"
      />
    </g>
    <g v-else-if="['workshop', 'generator'].includes(feature)">
      <path d="M-126-79v-31l38 8v30Z" fill="#ad725c" />
      <path d="m-130-110 0-19 47 9v19m-47-28 18-13 45 10-16 12" fill="#9bbbbb" stroke="#53726d" />
      <path
        v-if="feature === 'generator'"
        d="M-116 0v-37m17 41v-38m-24-1h14m3 4h14"
        stroke="#53726d"
        stroke-width="8"
      />
    </g>
    <g v-else-if="feature === 'portico'">
      <path d="M-56-3v-97M12 12v-97" stroke-width="9" />
      <path d="m-67-103 48-25 47 46Z" fill="#526e79" />
      <path d="m-71-1 96 22 10-12-96-22Z" fill="#dfcba4" />
    </g>
    <g v-else-if="['awning', 'platform'].includes(feature)">
      <path d="m-98-71 128 26 32-19-128-26Z" :fill="feature === 'awning' ? '#d6bf8c' : '#526e79'" />
      <path d="M-97-70V5M31-44v74" fill="none" stroke="#53726d" stroke-width="5" />
      <path
        v-if="feature === 'awning'"
        d="m-80-77 28 6-31 19m71-11 28 6-31 19M-78 1v-24l31 7V8m20 4v-24l31 7v23"
        fill="#748e79"
      />
      <path
        v-else
        d="m-74-8 25 6m21 5 25 6M-72-8v16m23-10v16m23-11v16M-3 9v16"
        fill="none"
        stroke="#856b4a"
        stroke-width="5"
      />
    </g>
    <g v-else transform="translate(-96 0)">
      <path d="m-35-77 50 10 22-13-49-10Z" fill="#526e79" />
      <path d="M-34-77V0M16-67v78" fill="none" stroke="#53726d" stroke-width="5" />
      <path
        v-if="feature === 'freight'"
        d="M-24-8v-26l20 4v26Zm22 5v-26l20 4V1Zm-10-29v-23l20 4v23Z"
        fill="#856b4a"
      />
      <g v-else>
        <path d="M-22-14v-17l34 7v17Z" :fill="feature === 'engineBay' ? '#a64e3e' : '#856b4a'" />
        <circle cx="-16" cy="-8" r="7" fill="#53726d" /><circle
          cx="9"
          cy="-3"
          r="7"
          fill="#53726d"
        />
      </g>
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { heritageUpgrade } from '../../data/heritageUpgrades';
const props = defineProps({ kind: String });
const feature = computed(() => heritageUpgrade(props.kind));
</script>

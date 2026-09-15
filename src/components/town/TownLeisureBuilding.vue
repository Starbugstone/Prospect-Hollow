<template>
  <g stroke-linejoin="round" stroke-linecap="round">
    <path d="M-103-23 0-66 104-23 0 28Z" :fill="kind === 'horseField' ? '#9eae79' : '#92a873'" />
    <template v-if="kind === 'horseField'">
      <path
        d="M-100-24V-62L0-102 100-62V-24M-100-45 0-85 100-45M0-102V-66"
        fill="none"
        stroke="#e1cfab"
        stroke-width="5"
      />
      <g v-if="level >= 2">
        <path d="M-85-54v-47h47v29" stroke="#a37d55" stroke-width="5" fill="none" />
        <path d="M-94-104-53-124-24-104-67-85Z" fill="#648d89" />
      </g>
      <g
        v-for="n in level"
        :key="n"
        :transform="`translate(${-62 + n * 31} ${-35 + (n % 2) * 14}) scale(.65)`"
      >
        <path d="M-19 0V24m24-24v24" stroke="#7e634c" stroke-width="5" fill="none" />
        <path d="M-25-15q10-12 30-3L14-39l13 4 8 19-14 4-9-6L8 0H-22Z" fill="#ad8059" />
        <path
          d="M16-35v-10m8 12 3-11M-25-13q-12 1-9 20"
          stroke="#584e3c"
          stroke-width="4"
          fill="none"
        />
        <circle cx="25" cy="-28" r="2" fill="#363c33" />
      </g>
      <path
        d="M-100-24v-31m0 31 78 32m44 0 78-32V-55M-100-42-22-10m44 0 78-32"
        stroke="#e1cfab"
        stroke-width="5"
        fill="none"
      />
    </template>
    <template v-else>
      <path d="M-73 1 14-35 73-8" stroke="#d8c9a5" stroke-width="14" fill="none" />
      <path
        d="M-71-25-64-90-42-35M-14-49-8-112 12-58M-68-93-8-114"
        stroke="#648d89"
        stroke-width="5"
        fill="none"
      />
      <path d="M-51-95v42m13-48v42M-55-51-34-60" stroke="#a37d55" stroke-width="3" fill="none" />
      <path
        d="M38-32 70-45m-31 4 32-13M41-32v12m25-22v12"
        stroke="#a37d55"
        stroke-width="5"
        fill="none"
      />
      <g v-if="level >= 2">
        <path d="M14-61v-38l18-8v43" stroke="#648d89" stroke-width="4" fill="none" />
        <path d="M32-104 66-63 52-57 19-98Z" fill="#be8171" />
      </g>
      <g transform="translate(0 -4)">
        <circle cy="-30" r="5" fill="#cba17a" />
        <path
          d="M0-24v14m-5 13 5-13 5 10m-5-20 9 9"
          stroke="#648d89"
          stroke-width="4"
          fill="none"
        />
        <path d="M9-11 24-4" stroke="#8f7856" stroke-width="1.5" />
        <path d="M20-2h14l3-7m-15 7v8m10-8v8" stroke="#bd9569" stroke-width="4" fill="none" />
      </g>
    </template>
    <g v-if="level >= 3" transform="translate(77 -35)">
      <path d="M0 0v-42" stroke="#a37d55" stroke-width="6" />
      <path d="M0-20-12-35m12 9 12-14" stroke="#a37d55" stroke-width="4" />
      <circle cx="-12" cy="-43" r="18" fill="#91a66e" />
      <circle cx="10" cy="-51" r="20" fill="#9cb27b" />
    </g>
    <g v-if="heritage" fill="#d7ad77">
      <circle v-for="n in heritageLevel" :key="n" :cx="n * 12 - 24" cy="-68" r="4" />
    </g>
  </g>
</template>
<script setup>
defineProps({ kind: String, level: Number, heritage: Boolean, heritageLevel: Number });
</script>

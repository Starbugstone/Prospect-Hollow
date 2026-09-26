<template>
  <g stroke-linejoin="round" stroke-linecap="round">
    <g v-if="kind === 'bridge'">
      <path d="M-155 8H155" stroke="#b6b6a1" stroke-width="36" />
      <path d="M-155-17H155M-155 28H155" stroke="#536e68" stroke-width="5" />
      <path
        v-for="x in [-145, -75, 0, 75, 145]"
        :key="x"
        :d="`M${x}-20v48`"
        stroke="#536e68"
        stroke-width="4"
      />
      <path d="M-150-35v68M150-35v68" stroke="#a1a798" stroke-width="18" />
    </g>
    <g v-else-if="kind === 'square'">
      <path d="M-132 0 0 42 133-2 0-43Z" fill="#c1c1ac" stroke="#8b9f92" stroke-width="6" />
      <TownSquare :stage="5" :era="era" />
      <g v-for="x in [-105, 105]" :key="x" :transform="`translate(${x} -10)`">
        <path d="M0 0V-90" stroke="#4b6962" stroke-width="5" />
        <circle cy="-96" r="10" fill="#fff0b6" stroke="#a39764" stroke-width="2" />
      </g>
    </g>
    <g v-else>
      <ellipse cy="12" rx="119" ry="25" fill="#705a4333" />
      <path d="M-100-10 24 20 107-20 107-34-100-40Z" fill="#a7a18c" />
      <path
        :d="`M-88 ${-height} 30 ${-height + 25}V8L-88-20Z`"
        :fill="civic ? '#bcaa91' : '#b37e65'"
      />
      <path :d="`M30 ${-height + 25} 99 ${-height - 4}V-24L30 8Z`" fill="#8e7766" />
      <path
        v-for="n in Math.floor(height / 15) - 1"
        :key="n"
        :d="`M-87 ${-height + n * 15} 29 ${-height + n * 15 + 25}`"
        stroke="#dcc0a0"
        stroke-width="2"
        opacity=".6"
      />
      <path
        :d="`M-99 ${-height - 9} 32 ${-height + 19} 111 ${-height - 15} 98 ${-height - 24}-88 ${-height - 21}Z`"
        fill="#56786e"
      />
      <path
        v-for="x in [-67, 4]"
        :key="x"
        :d="`M${x} ${-height + 29}v29l19 4v-29Z`"
        fill="#b5d1bd"
        stroke="#ede0bc"
        stroke-width="4"
      />
      <path
        v-if="height > 135"
        d="M-67-76v29l19 4v-29ZM4-61v29l19 4v-29Z"
        fill="#b5d1bd"
        stroke="#ede0bc"
        stroke-width="4"
      />
      <path d="M-39-60-11-53V0L-39-7Z" fill="#506e67" stroke="#dbc5a0" stroke-width="3" />
      <path d="m-100-68 139 30 43-17-138-30Z" fill="#527b70" />
      <g v-if="['home', 'rowHouses'].includes(kind)">
        <path
          :d="`M-101 ${-height - 8}-37 ${-height - 51} 111 ${-height - 15} 33 ${-height + 19}Z`"
          fill="#66877b"
        />
        <path :d="`M62 ${-height - 30}v-30l15 4v31Z`" fill="#aa735c" />
        <path
          v-if="kind === 'rowHouses'"
          d="M55-88 75-97v63L55-24Z"
          fill="#506e67"
          stroke="#dbc5a0"
          stroke-width="3"
        />
      </g>
      <g v-if="['powerHouse', 'mill', 'blacksmith'].includes(kind)">
        <path d="M-91-48v-136l23 5v137" fill="#956b55" stroke="#d0a084" stroke-width="3" />
        <path d="m65-14 41-17 10 11-42 18Z" fill="#d0b385" />
        <path
          v-if="kind === 'powerHouse'"
          d="M74-40v-34m20 26v-36M68-67l31-12"
          stroke="#6a897e"
          stroke-width="8"
        />
        <path
          v-else
          d="m64-18 2-26 20-8 1 24m6-7v-27l18-7 1 24"
          fill="#af936c"
          stroke="#746b50"
          stroke-width="2"
        />
      </g>
      <g v-if="kind === 'well' || kind === 'farm'">
        <path d="M66-14v-93m34 78v-95" stroke="#627a6b" stroke-width="7" />
        <path d="M54-145v56q28 18 58-2v-56" fill="#8da99c" stroke="#547a6f" stroke-width="3" />
        <ellipse cx="83" cy="-145" rx="29" ry="12" fill="#c0d0b5" />
        <path v-if="kind === 'farm'" d="m50-145 32-31 35 30Z" fill="#5c8072" />
      </g>
      <g v-if="kind === 'railDepot'">
        <path d="m-120 7 154 30 102-44-18-8-85 35-151-27Z" fill="#b5b39a" />
        <path d="m-105-35 150 31 97-41-153-32Z" fill="#51776c" />
        <path d="M-95-32V9M41-5v35M125-41v34" stroke="#d5c49d" stroke-width="5" />
        <path d="M105-75v-69m-1 7 30-8" stroke="#646f60" stroke-width="6" />
      </g>
      <g v-if="['fireStation', 'school'].includes(kind)">
        <path :d="`M-8 ${-height}v-35l27 6v35`" fill="#c5af8b" stroke="#947b5f" stroke-width="3" />
        <path
          v-if="kind === 'fireStation'"
          :d="`M-3 ${-height - 25}l16 3m-16 5 16 3m-16 5 16 3`"
          stroke="#53726d"
          stroke-width="3"
        />
        <path v-else :d="`M-4 ${-height - 10}l3-14 10 2 4 16Z`" fill="#c6a562" />
      </g>
      <g v-if="kind === 'fireStation'">
        <path d="M-64-78 9-61V-5L-64-22Z" fill="#6f4f3f" stroke="#d0b68d" stroke-width="4" />
        <path d="m-44-18 55 11v-20l-55-11Z" fill="#b95847" />
        <circle cx="-34" cy="-15" r="8" fill="#526a61" /><circle
          cx="3"
          cy="-7"
          r="8"
          fill="#526a61"
        />
      </g>
      <path
        v-if="kind === 'doctor'"
        d="M-25-139v30m-15-18 30 6"
        stroke="#568875"
        stroke-width="8"
      />
      <g v-if="['bank', 'museum', 'sheriff'].includes(kind)">
        <path d="M-53-90v72M-3-80v74" stroke="#e0d0aa" stroke-width="9" />
        <path d="m-62-94 68 15-35-28Z" fill="#e0d0aa" />
      </g>
      <g
        v-if="['fisherman', 'riverPort', 'market', 'warehouse', 'stable', 'armory'].includes(kind)"
      >
        <path d="m42-18 86-37 21 14-88 39Z" fill="#b1af98" />
        <path d="m41-72 85-37 26 16-86 36Z" fill="#5a7d6e" />
        <path d="M51-70v52m82-90v57" stroke="#d2c2a0" stroke-width="5" />
        <path
          d="m68-15v-23l20-9v23m9-14v-23l20-9v23"
          fill="#bd9c6e"
          stroke="#8e795a"
          stroke-width="2"
        />
      </g>
      <path
        v-if="['saloon', 'hotel'].includes(kind)"
        d="M-93-100v36L30-37v-37m-121-7 122 25"
        fill="none"
        stroke="#ddcaa3"
        stroke-width="5"
      />
    </g>
    <g v-if="level >= 2 && kind !== 'bridge'" transform="translate(-88 0)">
      <path d="M-37-72 5-64 5 12-37 3Z" fill="#bb997c" stroke="#dec5a1" stroke-width="2" />
      <path d="M5-64 28-77V0L5 12Z" fill="#917d69" />
      <path d="M-42-76 4-66 31-80-17-92Z" fill="#527b70" />
      <path d="M-27-54v22l18 4v-22Z" fill="#bfd5b9" stroke="#e2d0a7" stroke-width="3" />
    </g>
    <TownHeritageUpgrade v-if="level >= 3" :kind="kind" />
    <g v-if="kind === 'stable'"
      ><path d="M-69-77-3-60V0L-69-17Z" fill="#607c75" /><path
        v-for="n in 5"
        :key="n"
        :d="`M-65 ${-65 + n * 9}l58 15`"
        stroke="#bbc6b6"
        stroke-width="2" /><path d="M74-15V-57H86V-15" stroke="#bc9273" stroke-width="8"
    /></g>
    <path
      v-if="kind === 'bridge' && level >= 2"
      :d="
        level === 3 ? 'M-145-18 0-84 145-18M-75-18v-34M0-18v-66M75-18v-34' : 'M-145-18 0-49 145-18'
      "
      fill="none"
      stroke="#54796c"
      stroke-width="7"
    />
    <g
      v-if="level >= 3 && ['square', 'well', 'farm', 'fisherman', 'riverPort'].includes(kind)"
      transform="translate(-100 -30)"
    >
      <path d="M0 0V-105" stroke="#53786a" stroke-width="6" /><circle
        cy="-112"
        r="12"
        fill="#ffe6a2"
      />
    </g>
  </g>
</template>
<script setup>
import TownHeritageUpgrade from './TownHeritageUpgrade.vue';
import { computed } from 'vue';
import TownSquare from './TownSquare.vue';
const props = defineProps({
  kind: String,
  era: { type: String, default: 'industrial' },
  level: { type: Number, default: 1 },
});
const civic = computed(() =>
  ['well', 'school', 'doctor', 'museum', 'bank', 'sheriff'].includes(props.kind),
);
const height = computed(() =>
  [
    'home',
    'rowHouses',
    'saloon',
    'hotel',
    'school',
    'doctor',
    'museum',
    'bank',
    'post',
    'sheriff',
  ].includes(props.kind)
    ? 151
    : 115,
);
</script>

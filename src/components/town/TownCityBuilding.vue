<template>
  <g stroke-linejoin="round" stroke-linecap="round">
    <g v-if="family === 'airport'">
      <path d="M-255-115-90-175 125-100 125 95-140 165Z" fill="#91a66e" />
      <path d="M-245-110-95-165 10 100-140 155Z" fill="#657777" />
      <path d="M-172-122-65 118" stroke="#e1cfab" stroke-width="5" stroke-dasharray="15 12" />
      <path d="M-62-106 81-67 81 19-62-20Z" :fill="airport.wall" />
      <path d="M-52-90 71-57v45L-52-43Z" fill="#85b8c8" />
      <path d="M-70-110-29-135 90-99 81-62Z" :fill="airport.roof" />
      <path d="M-31-82v45M9-71v45M49-61v45" :stroke="airport.frame" stroke-width="4" />
      <g v-if="airport.clerestory">
        <path d="M-44-122v-32l107 30v34Z" :fill="airport.wall" />
        <path d="M-37-142 55-116v15l-92-26Z" fill="#85b8c8" />
        <path d="M-50-157-19-174 72-147 64-120Z" :fill="airport.roof" />
        <path d="M-46-130 63-99" :stroke="airport.frame" stroke-width="5" />
      </g>
      <g v-if="airport.curtainWall" stroke="#e1cfab" stroke-width="3">
        <path d="M-51-45V-91m20 51v-46m20 52v-46m20 52v-46m20 52v-46m20 52v-46" />
        <path d="M-44-115-24-126 55-102 39-89Z" fill="#85b8c8" />
      </g>
      <path
        d="M32-74v-112h27v120M14-177v-30h64v30Z"
        :fill="airport.roof"
        stroke="#e1cfab"
        stroke-width="3"
      />
      <path d="M17-182h58M35-202v24m21-24v24" stroke="#e1cfab" stroke-width="3" />
      <path d="M-24 42V12q41-43 88 15v34Z" :fill="airport.roof" stroke="#e1cfab" stroke-width="3" />
      <path d="M-17 39V14l74 21v23Z" fill="#648d89" stroke="#e1cfab" stroke-width="3" />
      <path d="M3 20v23m24-17v24" stroke="#e1cfab" stroke-width="3" />
      <g v-if="level >= 2">
        <path d="M-62-20-62 5 16 27 16 1Z" fill="#85b8c8" stroke="#e1cfab" stroke-width="3" />
        <path d="M-67-24-45-37 29-15 17 4Z" :fill="airport.roof" />
      </g>
      <g v-if="level >= 3" stroke="#e1cfab" stroke-width="3">
        <path d="M92 68V9" />
        <path d="m92 9 32 10-5 7-27-5Z" fill="#c97868" />
      </g>
      <path
        d="M-147-60-144-32-102-9-108-2-143-13-137 12-149 14-160-11-185-4-189-11-162-31-166-56Z"
        fill="#e1cfab"
      />
    </g>
    <g v-else-if="family === 'radio'" stroke="#c97868" stroke-width="5" fill="none">
      <path d="M-45 12 0-220 45 12M-33-45 26-84-21-113 15-144M-25-88 32-47M0-220v-40m-25 20h50" />
      <path d="M-59 12v-58h118v58Z" fill="#e1cfab" stroke="#648d89" />
    </g>
    <g v-else-if="family === 'concert' || family === 'television'">
      <path d="M-104-15v-108l125 31V18Z" fill="#c97868" />
      <path d="M21 18V-92l76-30v110Z" fill="#648d89" />
      <path d="M-113-125-64-157-28-143 9-162 54-144 109-123 20-86Z" fill="#435764" />
      <path d="M-87-111 9-88v58l-96-23Z" fill="#435764" />
      <path d="M-71-84-4-65m-58-1 49 14" stroke="#e5bc77" stroke-width="6" />
      <g v-if="family === 'television'" stroke="#e1cfab" stroke-width="4">
        <path d="M41-141v-38m-23-5q28 23 50-10" fill="#85b8c8" />
      </g>
    </g>
    <g
      v-else-if="
        family === 'skyline' ||
        (eraEvolution(era).digitalCity &&
          ['apartments', 'cityHomes', 'hotel', 'crystalLab'].includes(kind))
      "
    >
      <path d="M-70 0v-240l89 22V22Z" fill="#435764" />
      <path d="M19 22v-240l55-23V0Z" fill="#648d89" />
      <path
        v-for="n in 9"
        :key="n"
        :d="`M-60 ${-225 + n * 23} 8 ${-207 + n * 23}`"
        stroke="#85b8c8"
        stroke-width="13"
      />
    </g>
    <TownLeisureBuilding
      v-else-if="['horseField', 'park'].includes(kind)"
      :kind="kind"
      :level="serviceLevel"
    />
    <TownSquare v-else-if="kind === 'square'" :stage="serviceLevel" />
    <g v-else-if="kind === 'bridge'" fill="none" stroke="#638b88" stroke-width="5">
      <path d="M-155 8H155" stroke="#d9cbae" stroke-width="30" />
      <path d="M-155-12H155M-155 27H155" />
      <path v-for="x in [-140, 140]" :key="x" :d="`M${x}-12v-72m-14 0h28`" />
    </g>
    <g v-else-if="family === 'park'">
      <path d="M-116-28 0-64 117-25 0 24Z" fill="#8fa773" />
      <path d="M-105-6 5-43 104-10" stroke="#ddd1ae" stroke-width="16" fill="none" />
      <circle cx="84" cy="-85" r="25" fill="#8fa773" />
      <path d="M84-70v48" stroke="#a3825f" stroke-width="6" />
    </g>
    <g v-else>
      <path d="M-103-16 18 18 105-16 105-28-103-44Z" fill="#ddd1ae" />
      <path
        :d="`M-88-20v${-height}l116 29V9Z`"
        :fill="family === 'residence' ? city.brick : city.wall"
      />
      <path :d="`M28 9V${-height + 9}l69-27v${height}Z`" fill="#a69278" />
      <path
        :d="`M-98 ${-height - 28} 29 ${-height + 2} 108 ${-height - 29} -18 ${-height - 58}Z`"
        :fill="city.roof"
      />
      <g v-for="row in family === 'residence' ? 2 : 1" :key="row">
        <path
          v-for="x in [-71, -35, 1]"
          :key="x"
          :d="`M${x} ${-height + row * 38 - 28}v28l21 5v-28Z`"
          fill="#9cbbb5"
          stroke="#eee0c0"
          stroke-width="3"
        />
      </g>
      <path d="M-19-3v-47l24 6V3Z" fill="#638b88" />
      <path
        v-if="city.timberFins"
        :d="`M-80-20V${-height - 15}m6 1V-18M15 4V${-height + 7}`"
        stroke="#a3825f"
        stroke-width="4"
      />
      <path
        v-if="city.roofGarden"
        :d="`M-67 ${-height - 29} 9 ${-height - 9} 66 ${-height - 29} -9 ${-height - 47}Z`"
        fill="#8fa773"
      />
      <g v-if="family === 'residence'" stroke="#ddd1ae" stroke-width="4">
        <path d="M-76-59 17-35v-17L-76-76Z" :fill="modern ? '#9cbbb5' : '#638b88'" />
      </g>
      <g v-if="city.streamlined">
        <path
          :d="`M-99 ${-height - 23} 28 ${-height + 8} 106 ${-height - 21}`"
          :stroke="city.roof"
          stroke-width="9"
          fill="none"
        />
        <path
          :d="`M-77 ${-height + 16} 13 ${-height + 38}v22l-90-22Z`"
          fill="#9cbbb5"
          :stroke="city.wall"
          stroke-width="3"
        />
      </g>
      <path
        v-if="modern && !city.roofGarden"
        :d="`M-83 ${-height - 29} 20 ${-height - 3} 84 ${-height - 28} 0 ${-height - 51}Z`"
        :fill="city.roof"
        :stroke="city.wall"
        stroke-width="5"
      />
      <g v-if="family === 'water'">
        <path
          d="M40-13v-89q29-18 58 0v89q-29 19-58 0Z"
          fill="#a4b3a6"
          stroke="#ddd1ae"
          stroke-width="3"
        />
        <ellipse cx="69" cy="-102" rx="29" ry="10" fill="#638b88" />
      </g>
      <g v-if="family === 'farm'">
        <path
          d="M35-4v-95h30V8m4-10v-109h28V-14"
          :fill="modern ? '#9cbbb5' : '#ddd1ae'"
          stroke="#638b88"
          stroke-width="3"
        />
      </g>
      <path
        v-if="family === 'depot'"
        d="M-73-20v-63l78 20v63M-70-65l71 18m-71 0 71 18"
        fill="#638b88"
        stroke="#9cbbb5"
        stroke-width="3"
      />
      <g v-if="family === 'station'">
        <path d="M65-12v-148h25v142Z" fill="#b79078" />
        <circle cx="77" cy="-138" r="9" fill="#eee0c0" />
        <path d="M77-138v-6m0 6 5 3" stroke="#638b88" stroke-width="2" />
      </g>
      <path
        v-if="family === 'research'"
        d="M-42-147v-42H38v42Zm13-10v-20H25v20Z"
        fill="#84afa9"
        stroke="#c4ddd0"
        stroke-width="3"
      />
      <path v-if="kind === 'doctor'" d="M-53-115v29m-14-15h28" stroke="#b47766" stroke-width="8" />
    </g>
    <g v-if="eraEvolution(era).digitalCity && !garden && family !== 'airport'">
      <path d="M-60-75H15v38H-60Z" fill="#435764" />
      <path d="M-53-68H8v24H-53Z" fill="#85b8c8" />
      <path d="M-46-60h36m-36 8h24" stroke="#e1cfab" stroke-width="3" />
    </g>
    <g v-if="garden || ['civic', 'retail', 'station', 'river'].includes(family)">
      <path d="M-108-47v-66m78 86v-65" stroke="#ddd1ae" stroke-width="4" />
      <path d="M-116-115-48-144 7-121-57-93Z" fill="#638b88" />
      <path v-if="modern" d="m-96-116 59 19m-47-25 59 20" stroke="#9cbbb5" stroke-width="4" />
    </g>
    <g v-if="level >= 2 && family !== 'airport'">
      <path
        v-if="!garden && kind !== 'bridge'"
        d="M-122-2v-89l33 9v90Z"
        fill="#b79078"
        stroke="#ddd1ae"
        stroke-width="3"
      />
      <path d="M-107 8v-11h24v17Z" fill="#ddd1ae" />
      <circle cx="-95" cy="-8" r="11" fill="#8fa773" />
    </g>
    <g v-if="level >= 3 && family !== 'airport'" stroke="#638b88" stroke-width="4">
      <path d="M-108 9v-52m216 49v-52" />
      <path v-if="modern" d="M-118-43h20m196-3h20" stroke="#d5c194" stroke-width="7" />
      <g v-else fill="#eddda9"
        ><circle cx="-108" cy="-47" r="7" /><circle cx="108" cy="-50" r="7"
      /></g>
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { eraEvolution } from '../../data/eras';
import { CITY_FAMILIES } from '../../data/city';
import { airportAppearance } from '../../data/airport';
import { cityAppearance } from '../../data/cityAppearance';
import TownLeisureBuilding from './TownLeisureBuilding.vue';
import TownSquare from './TownSquare.vue';
const props = defineProps({
  kind: String,
  era: String,
  level: Number,
  serviceLevel: { type: Number, default: 3 },
});
const family = computed(() => CITY_FAMILIES[props.kind]);
const airport = computed(() => airportAppearance(props.era));
const city = computed(() => cityAppearance(props.era));
const modern = computed(() => city.value.modern);
const garden = computed(() => ['park', 'field', 'square'].includes(family.value));
const height = computed(() => (family.value === 'residence' ? 135 : 110));
</script>

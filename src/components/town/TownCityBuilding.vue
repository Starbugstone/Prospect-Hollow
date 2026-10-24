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
      <!-- The broad open end faces left toward the runway, clear of the lounge. -->
      <path d="M-109 74-47 50 16 68-48 95Z" fill="#788b87" />
      <path d="M-91 77-25 57" stroke="#e5bc77" stroke-width="3" />
      <path d="M-24 79V31Q0-6 27 11L96 32V90L27 111Z" :fill="airport.wall" />
      <path
        d="M-29 32Q-4-17 30 9L100 29Q64 5 29 63Z"
        :fill="airport.roof"
        stroke="#e1cfab"
        stroke-width="3"
      />
      <path d="M-24 78V33L29 63V109Z" fill="#435764" stroke="#e1cfab" stroke-width="4" />
      <path d="M-24 33v45m5-42v45M24 62v43m5-42v46" stroke="#648d89" stroke-width="4" />
      <path d="M-24 78 29 109 39 104-14 74Z" fill="#9baba2" />
      <g v-if="structureLevel >= 2">
        <path d="M-62-20-62 5 16 27 16 1Z" fill="#85b8c8" stroke="#e1cfab" stroke-width="3" />
        <path d="M-67-24-45-37 29-15 17 4Z" :fill="airport.roof" />
      </g>
      <g
        v-if="moduleLevel >= 2"
        stroke="#e1cfab"
        stroke-width="3"
        data-airport-observation-finish="true"
      >
        <path d="M-44-119-23-131 43-112 24-99Z" :fill="airport.roof" />
        <path d="M-35-126v-25l62 18v25Z" :fill="level >= 2 ? '#85b8c8' : airport.wall" />
        <path d="M-41-154-22-165 35-148 27-132Z" :fill="airport.roof" />
        <g :transform="level >= 3 ? 'translate(0 -24)' : undefined">
          <path
            :d="level >= 3 ? 'M-13-153v-18l23 7v18Z' : 'M-10-153v-9l17 5v9Z'"
            :fill="airport.roof"
          />
          <path
            v-if="level >= 3"
            d="M0-168v-24m-11 7h22"
            :stroke="airport.frame"
            stroke-width="3"
          />
        </g>
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
      <path
        v-if="family === 'concert'"
        d="M-99-124-64-145-29-131 8-150 53-132 96-120v11L20-76-99-111Z"
        fill="#85b8c8"
      />
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
    <TownSquare v-else-if="kind === 'square'" :stage="serviceLevel" :era="era" />
    <g v-else-if="kind === 'bridge'" fill="none" stroke="#638b88" stroke-width="5">
      <path d="M-155 8H155" stroke="#d9cbae" stroke-width="30" />
      <path d="M-155-12H155M-155 27H155" />
      <path v-for="x in [-140, 140]" :key="x" :d="`M${x}-12v-72m-14 0h28`" />
      <path d="M-122 24V-8m-17 0h34v-25h-34Z" fill="#85b8c8" stroke-width="3" />
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
      <g v-if="city.detail === 'billboard' && modern" :stroke="city.roof" stroke-width="4">
        <path :d="`M-27 ${-height - 29}v-16m45 28v-16`" />
        <path :d="`M-39 ${-height - 48}v-28l77 19v28Z`" :fill="city.brick" />
        <path
          :d="`M-29 ${-height - 65} 24 ${-height - 52}m-53-2 38 10`"
          stroke="#ddd1ae"
          stroke-width="3"
        />
      </g>
      <g v-if="modern && ['computers', 'research'].includes(feature)" data-connected-purpose="true">
        <path
          v-for="x in [-66, -15]"
          :key="x"
          :d="`M${x}-68v-32l33 8v32Z`"
          fill="#435764"
          stroke="#9cbbb5"
          stroke-width="3"
        />
        <path
          d="M-59-91-39-86m-20 9 20 5M-8-77 12-72m-20 9 20 5"
          stroke="#85b8c8"
          stroke-width="3"
        />
      </g>
    </g>
    <g v-if="eraEvolution(era).digitalCity && !garden && family !== 'airport'">
      <path d="M-60-75H15v38H-60Z" fill="#435764" />
      <path d="M-53-68H8v24H-53Z" fill="#85b8c8" />
      <path d="M-46-60h36m-36 8h24" stroke="#e1cfab" stroke-width="3" />
    </g>
    <g
      v-if="
        (garden || ['civic', 'retail', 'station', 'river'].includes(family)) &&
        !(moduleLevel >= 2 && feature === 'awning')
      "
    >
      <path d="M-108-47v-66m78 86v-65" stroke="#ddd1ae" stroke-width="4" />
      <path d="M-116-115-48-144 7-121-57-93Z" fill="#638b88" />
      <path v-if="modern" d="m-96-116 59 19m-47-25 59 20" stroke="#9cbbb5" stroke-width="4" />
    </g>
    <g v-if="structureLevel >= 2 && family !== 'airport'">
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
    <g
      v-if="
        moduleLevel >= 2 &&
        feature &&
        !garden &&
        !['airport', 'radio', 'concert', 'television', 'skyline'].includes(family)
      "
      :data-upgrade-feature="feature"
    >
      <g v-if="['awning', 'freight', 'carriage', 'portico'].includes(feature)">
        <path
          :d="feature === 'carriage' ? 'M-94-60-73-85m157 40-21-29' : 'M-94 0v-80m178 94v-80'"
          :stroke="city.wall"
          stroke-width="5"
        />
        <path d="M-103-83-27-110 95-77 19-51Z" :fill="city.roof" />
        <path
          v-if="feature === 'carriage'"
          :d="
            level >= 2
              ? 'M-91-75v17l17 6v-17ZM69-79l15-8v17l-15 8Z'
              : 'M-91-75v11l17 6v-11ZM69-79l15-8v11l-15 8Z'
          "
          :fill="level >= 2 ? '#9cbbb5' : city.roof"
          data-carriage-upper-glazing="true"
        />
        <path
          v-else
          d="M-91-75v47l17 6v-47m143 37v-47l15-8v47"
          :fill="level >= 2 ? '#9cbbb5' : city.roof"
        />
      </g>
      <g v-else-if="['engineBay', 'platform'].includes(feature)">
        <path d="M-126 7v-92l37 10v92Z" :fill="city.wall" />
        <path d="M-130-87-112-99-84-89-91-77Z" :fill="city.roof" />
        <path d="M-120-66v45l23 6v-45Z" :fill="level >= 2 ? '#9cbbb5' : city.roof" />
      </g>
      <g v-else>
        <path d="M-122-87v-36l33 9v36Z" :fill="city.wall" :stroke="city.roof" stroke-width="3" />
        <path d="M-126-125-110-134-84-126-90-114Z" :fill="city.roof" />
        <path
          :d="level >= 2 ? 'M-115-114v16l17 4v-16Z' : 'M-112-110v10l11 3v-10Z'"
          :fill="level >= 2 ? '#9cbbb5' : city.roof"
        />
      </g>
      <g
        v-if="!['veranda', 'terrace'].includes(feature)"
        :transform="
          ['awning', 'freight', 'carriage', 'portico'].includes(feature)
            ? 'translate(17 -84)'
            : ['engineBay', 'platform'].includes(feature)
              ? 'translate(-105 -96)'
              : 'translate(-105 -133)'
        "
      >
        <path d="M-17 0v-17m34 17v-17M-22-19h44" :stroke="city.wall" stroke-width="4" />
        <g v-if="['engineBay', 'platform'].includes(feature)">
          <path d="M-15-16v14h30v-14Z" fill="#9cbbb5" :stroke="city.wall" stroke-width="2" />
          <path d="M-16 0h32M-9-16v14m18-14v14" :stroke="city.roof" stroke-width="2" />
          <path d="M0-19v-16" :stroke="city.wall" stroke-width="4" />
          <circle
            cy="-39"
            :r="level >= 3 ? 11 : 7"
            fill="#e5bc77"
            :stroke="city.roof"
            stroke-width="3"
          />
          <path d="M0-46v7l6 3" :stroke="city.roof" stroke-width="2" fill="none" />
        </g>
        <g v-else :transform="level >= 3 ? 'translate(0 -30)' : undefined">
          <path :d="level >= 3 ? 'M-16 0v-18h32V0Z' : 'M-10-2v-8h20v8Z'" :fill="city.roof" />
          <path d="M-10-10H10" stroke="#85b8c8" stroke-width="4" />
          <path
            v-if="
              level >= 3 &&
              ['dispatch', 'studio', 'auditorium', 'computers', 'research'].includes(feature)
            "
            d="M0-18v-22m-12 7h24"
            :stroke="city.wall"
            stroke-width="3"
          />
        </g>
      </g>
    </g>
    <g
      v-if="moduleLevel >= 2 && ['radio', 'concert', 'television', 'skyline'].includes(family)"
      :data-landmark-completion="feature"
    >
      <path
        d="M-122-90v-40l33 9v40Z"
        :fill="level >= 2 ? '#85b8c8' : city.wall"
        :stroke="city.wall"
        stroke-width="3"
      />
      <path d="M-126-132-110-141-84-133-90-121Z" :fill="city.roof" />
      <path d="M-117-140v-16m24 23v-16m-28-8 32 9" :stroke="city.wall" stroke-width="4" />
      <g
        v-if="!['veranda', 'terrace'].includes(feature)"
        :transform="level >= 3 ? 'translate(0 -30)' : undefined"
      >
        <path
          :d="level >= 3 ? 'M-114-140v-18l18 5v18Z' : 'M-111-140v-7l12 3v7Z'"
          :fill="city.roof"
        />
        <path v-if="level >= 3" d="M-104-155v-23m-10 7h20" :stroke="city.wall" stroke-width="3" />
      </g>
    </g>
    <g
      v-if="
        moduleLevel >= 2 &&
        ['veranda', 'terrace'].includes(feature) &&
        !garden &&
        family !== 'airport'
      "
      data-occupied-balcony="true"
    >
      <path d="M-132-88-114-101-78-91-96-78Z" :fill="city.roof" />
      <path d="M-126-87-120-72m35-15-5 15" :stroke="city.wall" stroke-width="4" />
      <g data-terrace-canopy-frame="true" :stroke="city.wall" fill="none">
        <path d="M-128-89v-33m32 9v-33" stroke-width="4" />
        <path d="M-131-123-93-112" stroke-width="6" />
      </g>
      <path
        :d="moduleLevel >= 3 ? 'M-125-107v-15l26 8v15Z' : 'M-123-104v-9l21 6v9Z'"
        :fill="city.wall"
      />
      <path
        v-if="moduleLevel >= 3"
        d="M-125-121v-13l26 8v13M-89-105v13m-7-17 14 4-5 4-14-4Z"
        :fill="city.roof"
        :stroke="city.roof"
        stroke-width="2"
      />
      <path
        d="M-132-88v-20l36 10v20Zm36-10 18-13v20l-18 13Z"
        fill="#9cbbb5"
        :stroke="city.wall"
        stroke-width="2"
      />
      <g
        v-if="moduleLevel >= 3"
        data-working-terrace-shade="true"
        :data-shade-pose="level >= 3 ? 'ventilating' : 'closed'"
        :fill="city.roof"
        :stroke="city.roof"
        stroke-width="2"
      >
        <g data-terrace-shade-bearings="true" :stroke="city.wall" stroke-width="3" fill="none">
          <path d="M-123-121-107-133M-111-117-95-129M-99-114-83-126" />
        </g>
        <path
          data-terrace-shade-louver="true"
          :d="
            level >= 3 ? 'M-128-128-112-140-103-133-119-121Z' : 'M-127-122-111-134-104-132-120-120Z'
          "
        />
        <path
          data-terrace-shade-louver="true"
          :d="level >= 3 ? 'M-116-124-100-136-91-129-107-117Z' : 'M-115-118-99-130-92-128-108-116Z'"
        />
        <path
          data-terrace-shade-louver="true"
          :d="level >= 3 ? 'M-104-121-88-133-79-126-95-114Z' : 'M-103-115-87-127-80-125-96-113Z'"
        />
      </g>
      <path
        data-terrace-weather-fascia="true"
        :d="level >= 2 ? 'M-131-129-93-118v9l-38-11Z' : 'M-131-123-93-112v3l-38-11Z'"
        :fill="city.roof"
      />
    </g>
    <g
      v-if="
        city.solar &&
        structureLevel >= 2 &&
        ['radio', 'concert', 'television', 'skyline'].includes(family)
      "
      data-wing-solar="true"
      :transform="moduleLevel >= 2 ? 'translate(0 -65)' : undefined"
    >
      <path d="M-121-88-104-94-89-90-105-84Z" fill="#526f79" />
    </g>
    <g
      v-if="
        level >= 3 && (garden || ['radio', 'concert', 'television', 'skyline'].includes(family))
      "
      stroke="#638b88"
      stroke-width="4"
    >
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
import { buildingStages } from '../../data/buildingStages';
import { heritageUpgrade } from '../../data/heritageUpgrades';
import TownLeisureBuilding from './TownLeisureBuilding.vue';
import TownSquare from './TownSquare.vue';
const props = defineProps({
  kind: String,
  era: String,
  lifecycleEra: String,
  level: Number,
  serviceLevel: { type: Number, default: 3 },
});
const family = computed(() => CITY_FAMILIES[props.kind]);
const airport = computed(() => airportAppearance(props.era));
const city = computed(() => cityAppearance(props.era, props.kind));
const feature = computed(() => heritageUpgrade(props.kind));
const structureLevel = computed(
  () =>
    buildingStages(props.kind, props.lifecycleEra ?? props.era, props.level, props.serviceLevel)
      .structureLevel,
);
const moduleLevel = computed(
  () =>
    buildingStages(props.kind, props.lifecycleEra ?? props.era, props.level, props.serviceLevel)
      .moduleLevel ?? structureLevel.value,
);
const modern = computed(() => city.value.modern);
const garden = computed(() => ['park', 'field', 'square'].includes(family.value));
const height = computed(() => (family.value === 'residence' ? 135 : 110));
</script>

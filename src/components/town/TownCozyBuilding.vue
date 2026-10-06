<template>
  <g
    stroke-linejoin="round"
    stroke-linecap="round"
    :data-form="form"
    :data-cozy-style="appearance.style"
  >
    <ellipse cy="9" :rx="landmark ? 132 : 100" ry="20" :fill="p.shell" />
    <template v-if="form === 'homes'">
      <g v-for="([x, r, h], n) in homes" :key="n">
        <path :d="drum(x, 0, r, h)" :fill="p.shell" />
        <g v-for="floor in Math.max(1, Math.floor(h / 44))" :key="floor">
          <path
            :d="`M${x - r + 9} ${-floor * 39 + 15}h${r * 2 - 18}`"
            :stroke="p.light"
            stroke-width="10"
          />
          <path
            v-if="h > 100"
            :d="`M${x - r - 4} ${-floor * 39 + 24}h${r * 2 + 8}`"
            :stroke="p.green"
            stroke-width="5"
          />
        </g>
        <TownCozyRoof :x="x" :y="-h" :radius="r * 1.25" v-bind="roof" />
      </g>
    </template>
    <template v-else-if="form === 'hall' || form === 'gallery' || form === 'atrium'">
      <path :d="drum(form === 'gallery' ? -20 : 0, 0, 59, 84)" :fill="p.shell" />
      <path d="M-45-49h90v17h-90Z" :fill="p.glass" />
      <TownCozyRoof :x="form === 'gallery' ? -20 : 0" :y="-84" :radius="74" v-bind="roof" />
      <g v-if="['gallery', 'atrium'].includes(form)">
        <path
          d="M24 0v-20a54 48 0 0 1 108 0V0Z"
          :fill="p.glass"
          :stroke="p.timber"
          stroke-width="4"
        />
        <path d="M52-57v57m28-69v69m27-57v57" :stroke="p.timber" stroke-width="2" />
      </g>
      <g v-if="['cityHall', 'school', 'sheriff', 'post'].includes(kind)">
        <path d="M-12-89v-30h24v30Z" :fill="p.shell" />
        <TownCozyRoof :y="-120" :radius="23" v-bind="roof" />
        <circle cy="-105" r="7" :fill="p.light" />
      </g>
      <path v-if="kind === 'doctor'" d="M-4-64h8v24h-8Zm-8 8h24v8h-24Z" :fill="p.deep" />
    </template>
    <template v-else-if="['arcade', 'workshop', 'concourse', 'auditorium'].includes(form)">
      <path d="M-81 0v-60q81-22 162 0v60Z" :fill="kind === 'fireStation' ? p.flower : p.shell" />
      <path d="M-62 0v-39q62-12 124 0V0Z" :fill="form === 'workshop' ? p.deep : p.glass" />
      <TownCozyRoof :y="-68" :radius="96" :petals="form === 'auditorium' ? 7 : 6" v-bind="roof" />
      <path d="M-73 0v-61M73 0v-61" :stroke="p.timber" stroke-width="5" />
      <g v-if="kind === 'saloon'">
        <circle cy="-92" r="16" :fill="p.light" :stroke="p.timber" stroke-width="3" />
        <text
          x="0"
          y="-36"
          text-anchor="middle"
          :fill="p.shell"
          font-size="9"
          font-family="Georgia,serif"
          >{{ t('GOLDEN HOUR') }}</text
        >
      </g>
      <path
        v-if="kind === 'blacksmith' || kind === 'mill'"
        d="M-56-65v-68h15v69"
        :fill="p.shell"
        :stroke="p.deep"
        stroke-width="3"
      />
    </template>
    <template v-else-if="form === 'watergarden'">
      <g
        v-for="[x, r] in kind === 'well'
          ? [[0, 43]]
          : [
              [-35, 40],
              [45, 32],
            ]"
        :key="x"
      >
        <path :d="drum(x, 0, r, kind === 'well' ? 25 : 55)" :fill="p.shell" />
        <ellipse :cx="x" cy="-25" :rx="r - 5" ry="9" :fill="p.glass" />
        <path
          v-if="kind === 'well'"
          :d="`M${x - r} 0v-71m${r * 2} 71v-71`"
          :stroke="p.timber"
          stroke-width="4"
        />
        <TownCozyRoof :x="x" :y="kind === 'well' ? -74 : -58" :radius="r + 12" v-bind="roof" />
      </g>
    </template>
    <template v-else-if="form === 'greenhouse'">
      <path
        d="M-90 0v-12a64 60 0 0 1 128 0V0Zm83 0v-10a48 43 0 0 1 96 0V0Z"
        :fill="p.glass"
        :stroke="p.timber"
        stroke-width="4"
      />
      <path d="M-63-59V0m32-73V0m30-59V0m34-34V0m25-21V0" :stroke="p.timber" stroke-width="2" />
      <TownCozyRoof :x="-28" :y="-65" :radius="35" v-bind="roof" />
    </template>
    <template v-else-if="form === 'landing' || form === 'teahouse'">
      <path d="M-88 2h176v-8H-88Z" :fill="p.timber" />
      <path :d="drum(0, 0, 43, 55)" :fill="p.glass" />
      <path d="M-76 0v-74M76 0v-74" :stroke="p.timber" stroke-width="5" />
      <TownCozyRoof :y="-77" :radius="form === 'teahouse' ? 110 : 86" v-bind="roof" />
      <template v-if="form === 'teahouse'">
        <g v-for="x in [-62, 62]" :key="x">
          <ellipse :cx="x" cy="-25" rx="13" ry="5" :fill="p.timber" />
          <path :d="`M${x}-25v24`" :stroke="p.timber" stroke-width="3" />
          <circle :cx="x" cy="-45" r="5" :fill="p.light" />
        </g>
      </template>
      <path v-else d="M40 0h105v16H40Z" :fill="p.timber" />
    </template>
    <template v-else-if="form === 'garden'">
      <TownLeisureBuilding :kind="kind === 'horseField' ? 'horseField' : 'park'" :level="3" />
      <path d="M-72-3v-74" :stroke="p.timber" stroke-width="5" />
      <TownCozyRoof :x="-72" :y="-80" :radius="40" v-bind="roof" />
    </template>
    <template v-else-if="form === 'mast' || form === 'studio' || form === 'skyterraces'">
      <path v-if="form !== 'skyterraces'" :d="drum(0, 0, 52, 52)" :fill="p.shell" />
      <TownCozyRoof v-if="form !== 'skyterraces'" :y="-55" :radius="67" v-bind="roof" />
      <template v-if="form === 'skyterraces'">
        <g
          v-for="([r, y, h], n) in [
            [53, 0, 98],
            [42, 98, 81],
            [28, 179, 71],
          ]"
          :key="n"
        >
          <path :d="drum(0, -y, r, h)" :fill="p.glass" :stroke="p.shell" stroke-width="2" />
          <ellipse :cy="-y - h" :rx="r + 8" ry="8" :fill="p.green" />
        </g>
      </template>
      <TownCozyRoof v-if="form === 'skyterraces'" :y="-255" :radius="38" v-bind="roof" />
      <path v-else d="M0-54v-151" :stroke="p.deep" :stroke-width="form === 'studio' ? 12 : 5" />
      <g v-if="form === 'studio'">
        <circle cy="-189" r="31" :fill="p.glass" />
        <TownCozyRoof :y="-214" :radius="40" v-bind="roof" />
      </g>
      <path
        v-if="form === 'mast'"
        d="M-13-122h26m-22-39h18m-15-29h12"
        :stroke="p.roof"
        stroke-width="5"
      />
    </template>
    <template v-else-if="form === 'atelier'">
      <path
        d="M-132 0a71 78 0 0 1 142 0Zm118 0a71 78 0 0 1 142 0Z"
        :fill="p.glass"
        :stroke="p.timber"
        stroke-width="4"
      />
      <path d="M-108-58v58m31-76v76m155-76v76m31-58v58" :stroke="p.timber" stroke-width="2" />
      <path :d="drum(0, 0, 49, 107)" :fill="p.shell" />
      <path
        d="M-66-69Q-73-111-34-150L-8-177H8l26 27q39 39 32 81Z"
        :fill="p.roof"
        :stroke="p.timber"
        stroke-width="2"
      />
      <path
        d="M0-174-24-142-36-71M0-174 24-142 36-71"
        :stroke="p.green"
        stroke-width="3"
        fill="none"
      />
      <ellipse cy="-179" rx="13" ry="5" :fill="p.shell" />
      <path d="M0-179v-14" :stroke="p.timber" stroke-width="3" />
      <ellipse
        cx="-108"
        cy="-10"
        rx="16"
        ry="11"
        :fill="p.glass"
        :stroke="p.shell"
        stroke-width="4"
      />
    </template>
    <template v-else-if="form === 'orchard'">
      <g
        v-for="([x, y], n) in [
          [0, -40],
          [-86, 0],
          [86, 0],
        ].slice(0, level >= 2 ? 3 : 2)"
        :key="n"
      >
        <path :d="drum(x, y, 36, 53)" :fill="p.shell" />
        <TownCozyRoof :x="x" :y="y - 55" :radius="47" v-bind="roof" />
        <path :d="`M${x - 8} ${y}v-29q8-11 16 0v29Z`" :fill="p.flower" />
      </g>
      <g v-if="level >= 3">
        <path d="M0 9v-46" :stroke="p.timber" stroke-width="7" />
        <circle cy="-47" r="24" :fill="p.green" />
        <circle v-for="x in [-14, 14]" :key="x" :cx="x" cy="-47" r="6" :fill="p.flower" />
      </g>
    </template>
    <template v-else-if="form === 'glassworks'">
      <path d="M-93 0v-68h156V0Z" :fill="p.shell" />
      <TownCozyRoof :x="-15" :y="-73" :radius="93" v-bind="roof" />
      <path d="M-68-67v-62h20v61" :fill="p.shell" :stroke="p.timber" stroke-width="3" />
      <path
        v-if="level >= 2"
        d="M58 0v-12a36 40 0 0 1 72 0V0Z"
        :fill="p.glass"
        :stroke="p.timber"
        stroke-width="3"
      />
      <path
        v-for="x in [-81, 77]"
        :key="x"
        :d="`M${x} -43l12 20-5 28h-14l-5-28Z`"
        :fill="p.light"
        :stroke="p.shell"
        stroke-width="2"
      />
    </template>
    <template v-else-if="form === 'springs'">
      <path d="M-105 0v-42q105-51 210 0V0Z" :fill="p.shell" />
      <ellipse cy="-42" rx="92" ry="31" :fill="p.glass" :stroke="p.shell" stroke-width="7" />
      <g v-if="level >= 2">
        <path d="M-77-46v-48q58-40 116 0v48Z" :fill="p.shell" />
        <ellipse
          cx="-19"
          cy="-94"
          rx="57"
          ry="20"
          :fill="p.glass"
          :stroke="p.shell"
          stroke-width="6"
        />
        <path d="M-29-89v61" :stroke="p.glass" stroke-width="18" />
      </g>
      <path :d="drum(78, -24, 34, 91)" :fill="p.shell" />
      <TownCozyRoof :x="78" :y="-119" :radius="45" v-bind="roof" />
      <ellipse
        v-if="level >= 3"
        cy="7"
        rx="66"
        ry="20"
        :fill="p.glass"
        :stroke="p.shell"
        stroke-width="6"
      />
    </template>
    <template v-else-if="form === 'pavilion'">
      <ellipse cy="-2" rx="128" ry="27" :fill="p.shell" />
      <path
        v-for="x in [-96, -58, 58, 96]"
        :key="x"
        :d="`M${x} 0v-98`"
        :stroke="p.deep"
        stroke-width="8"
      />
      <TownCozyRoof :y="-103" :radius="138" :petals="10" v-bind="roof" />
      <path d="M0-164 14-141 9-114H-9l-5-27Z" :fill="p.light" :stroke="p.timber" stroke-width="2" />
      <circle v-for="x in [-95, -58, 58, 95]" :key="x" :cx="x" cy="-75" r="8" :fill="p.light" />
    </template>
    <template v-else-if="form === 'square'">
      <TownSquare :stage="3" :era="era" />
    </template>
    <template v-else-if="form === 'bridge'">
      <path d="M-155 8H155" :stroke="p.shell" stroke-width="30" />
      <path d="M-155-15H155M-155 28H155" :stroke="p.deep" stroke-width="4" />
      <g v-for="x in [-113, 113]" :key="x">
        <path :d="`M${x}-19v-53`" :stroke="p.deep" stroke-width="3" />
        <circle :cx="x" cy="-76" r="6" :fill="p.light" />
        <ellipse
          v-if="level >= 2"
          :cx="x + Math.sign(x) * 15"
          cy="-11"
          rx="8"
          ry="6"
          :fill="p.green"
        />
        <TownCozyRoof v-if="level >= 3" :x="x" :y="-102" :radius="26" v-bind="roof" />
      </g>
    </template>
    <template v-else-if="form === 'airport'">
      <TownCityBuilding :kind="kind" :era="era" :level="level" :service-level="3" />
      <TownCozyRoof :x="28" :y="-129" :radius="61" v-bind="roof" />
    </template>
    <path
      v-if="
        !['garden', 'square', 'bridge', 'airport', 'pavilion', 'springs', 'orchard'].includes(form)
      "
      d="M-11 0v-34q11-15 22 0V0Z"
      :fill="p.deep"
      :stroke="p.timber"
      stroke-width="3"
    />
    <g v-if="level >= 2 && !['bridge', 'orchard', 'springs'].includes(form)">
      <path
        d="M-114 0v-12a26 28 0 0 1 52 0V0Z"
        :fill="p.glass"
        :stroke="p.timber"
        stroke-width="2"
      />
    </g>
    <g v-if="level >= 3 && !['bridge'].includes(form)">
      <g v-for="x in [-92, 92]" :key="x">
        <ellipse :cx="x" cy="2" rx="14" ry="8" :fill="p.shell" />
        <circle :cx="x" cy="-6" r="12" :fill="p.green" />
        <circle :cx="x - 6" cy="-13" r="5" :fill="p.flower" />
        <g v-if="appearance.style === 'riverlight'">
          <path :d="`M${x} 4v-40`" :stroke="p.deep" stroke-width="3" />
          <circle :cx="x" cy="-41" r="5" :fill="p.light" />
        </g>
      </g>
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { cozyAppearance, cozyForm, COZY_LANDMARKS } from '../../data/cozyArchitecture';
import { cityAppearance } from '../../data/cityAppearance';
import TownCozyRoof from './TownCozyRoof.vue';
import TownCityBuilding from './TownCityBuilding.vue';
import TownLeisureBuilding from './TownLeisureBuilding.vue';
import TownSquare from './TownSquare.vue';
import { t } from '../../i18n';
const props = defineProps({ kind: String, era: String, level: Number });
const appearance = computed(() => cozyAppearance(props.era));
const p = computed(() => appearance.value.palette);
const roof = computed(() => ({ palette: p.value, cozyStyle: appearance.value.style }));
const form = computed(() => cozyForm(props.kind) ?? props.kind);
const landmark = computed(() => !!COZY_LANDMARKS[props.kind]);
const drum = (x, base, r, h) =>
  `M${x - r} ${base}v${-h}a${r} ${r * 0.25} 0 0 1 ${r * 2} 0v${h}a${r} ${r * 0.25} 0 0 1 ${-r * 2} 0Z`;
const homes = computed(() => {
  const { identity, height = 3 } = cityAppearance(props.era, props.kind);
  if (['row', 'court'].includes(identity))
    return [
      [-62, 27, 53],
      [0, 29, 63],
      [62, 27, 53],
    ];
  if (identity === 'twin')
    return [
      [-43, 32, height * 29],
      [43, 32, height * 29 - 36],
    ];
  return [[0, identity === 'porch' ? 48 : 55, identity === 'porch' ? 93 : height * 29]];
});
</script>

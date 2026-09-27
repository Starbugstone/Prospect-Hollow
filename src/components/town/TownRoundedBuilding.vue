<template>
  <g stroke-linejoin="round" stroke-linecap="round" :data-form="form">
    <ellipse cx="0" cy="4" rx="104" ry="22" :fill="p.shell" />
    <template v-if="form === 'tower'">
      <g v-for="(t, n) in towers" :key="n">
        <path :d="drum(t.x, 0, t.r, t.h)" :fill="p.glass" :stroke="p.shell" stroke-width="3" />
        <path
          v-for="f in t.floors"
          :key="f"
          :d="`M${t.x - t.r - 7} ${-f * t.step}h${t.r * 2 + 14}`"
          :stroke="f === t.floors ? p.accent : p.shell"
          stroke-width="7"
        />
        <path :d="dome(t.x, -t.h, t.r, t.r * 0.5)" :fill="t.pods ? p.accent : p.shell" />
        <template v-if="t.pods">
          <ellipse
            v-for="k in 6"
            :key="k"
            :cx="t.x + (k % 2 ? 34 : -34)"
            :cy="-k * 30"
            rx="26"
            ry="15"
            :fill="k % 3 ? p.shell : p.warm"
            :stroke="p.glass"
            stroke-width="3"
          />
        </template>
      </g>
    </template>
    <template v-else-if="form === 'rotunda'">
      <path :d="drum(0, 0, 64, 70)" :fill="p.shell" />
      <path d="M-64-46h128v24h-128Z" :fill="p.glass" />
      <path :d="dome(0, -70, 60, 42)" :fill="kind === 'bank' ? p.light : p.accent" />
      <path d="M-26 0v-38q26-20 52 0V0Z" :fill="p.glass" :stroke="p.shell" stroke-width="4" />
      <path v-if="spire" d="M0-110v-40" :stroke="p.accent" stroke-width="5" />
      <circle v-if="spire" cy="-154" r="9" :fill="kind === 'sheriff' ? p.warm : p.light" />
    </template>
    <template v-else-if="form === 'vault' || form === 'hangar'">
      <path
        d="M-92 0v-10a92 72 0 0 1 184 0v10Z"
        :fill="kind === 'fireStation' ? p.warm : p.shell"
      />
      <path
        v-for="x in form === 'vault' ? [-60, 0, 60] : [-80, 80]"
        :key="x"
        :d="`M${x} 0V${-Math.sqrt(1 - (x / 92) ** 2) * 72}`"
        :stroke="p.accent"
        stroke-width="6"
      />
      <path
        :d="form === 'vault' ? 'M-58 0v-30h116v30Z' : 'M-34 0v-40q34-24 68 0V0Z'"
        :fill="form === 'vault' ? p.glass : p.deep"
      />
      <ellipse v-if="form === 'vault'" cy="-36" rx="66" ry="9" :fill="p.accent" />
    </template>
    <template v-else-if="form === 'tanks'">
      <path d="M-70 0v-26h140V0Z" :fill="p.shell" />
      <circle cx="-30" cy="-70" r="44" :fill="p.glass" :stroke="p.shell" stroke-width="5" />
      <circle v-if="kind !== 'well'" cx="46" cy="-58" r="32" :fill="p.shell" />
      <ellipse
        v-if="kind === 'powerHouse'"
        cx="-30"
        cy="-70"
        rx="64"
        ry="14"
        fill="none"
        :stroke="p.light"
        stroke-width="6"
      />
    </template>
    <template v-else-if="form === 'tube'">
      <path :d="drum(-30, 0, 48, 60)" :fill="p.shell" />
      <path :d="dome(-30, -60, 46, 30)" :fill="p.accent" />
      <path d="M-96-96h192" :stroke="p.glass" stroke-width="30" />
      <path d="M-86-80V0m172-80V0" :stroke="p.shell" stroke-width="7" />
      <ellipse cx="30" cy="-96" rx="44" ry="12" :fill="p.shell" />
    </template>
    <template v-else-if="form === 'shell'">
      <path d="M-96 0q20-150 120-110Q60-90 64 0Z" :fill="p.shell" />
      <path d="M-10 0q30-110 100-70Q104-40 98 0Z" :fill="p.accent" />
      <path d="M-50 0v-30h90V0Z" :fill="p.glass" />
    </template>
    <template v-else-if="form === 'geodesic'">
      <path d="M-78 0-70-46-38-82 0-94 38-82 70-46 78 0Z" :fill="p.glass" />
      <path
        d="M-70-46 0-30 70-46M-38-82 0-30 38-82M0-94v64"
        :stroke="p.shell"
        stroke-width="3"
        fill="none"
      />
      <path d="M-8-94 0-126 8-94Z" :fill="p.light" />
    </template>
    <template v-else-if="form === 'greenhouse'">
      <path
        v-for="([x, r], n) in kind === 'biodome' ? domes.big : domes.small"
        :key="n"
        :d="dome(x, 0, r, r * 0.85)"
        :fill="p.glass"
        :stroke="p.shell"
        stroke-width="4"
      />
      <circle v-for="x in [-88, 90]" :key="x" :cx="x" cy="-10" r="12" :fill="p.green" />
    </template>
    <template v-else-if="form === 'pavilion'">
      <path d="M-60 0v-70M60 0v-70" :stroke="p.shell" stroke-width="6" />
      <path :d="drum(0, 0, 40, 50)" :fill="p.glass" />
      <ellipse cy="-74" rx="84" ry="14" :fill="p.shell" />
      <path :d="dome(0, -80, 38, 22)" :fill="p.accent" />
    </template>
    <template v-else-if="form === 'garden'">
      <TownLeisureBuilding :kind="kind === 'horseField' ? 'horseField' : 'park'" :level="3" />
      <g v-for="x in [-80, 80]" :key="x">
        <path :d="`M${x} 0v-80`" :stroke="p.accent" stroke-width="5" />
        <ellipse :cx="x" cy="-82" rx="34" ry="10" :fill="x < 0 ? p.shell : p.glass" />
      </g>
    </template>
    <template v-else-if="form === 'mast'">
      <path :d="drum(0, 0, 50, 40)" :fill="p.shell" />
      <path :d="dome(0, -40, 50, 30)" :fill="p.accent" />
      <path d="M0-60v-190" :stroke="p.shell" stroke-width="6" />
      <ellipse
        v-for="(r, n) in [34, 24, 16]"
        :key="n"
        :cy="-120 - n * 40"
        :rx="r"
        ry="6"
        :fill="n % 2 ? p.accent : p.shell"
      />
      <circle cy="-254" r="8" :fill="p.warm" />
    </template>
    <template v-else-if="form === 'orb'">
      <path :d="drum(0, 0, 80, 40)" :fill="p.shell" />
      <path :d="dome(0, -40, 80, 44)" :fill="p.accent" />
      <path d="M-9-70h18v-130h-18Z" :fill="p.shell" />
      <circle cy="-216" r="40" :fill="p.glass" />
      <ellipse cy="-216" rx="48" ry="9" :fill="p.accent" />
      <path d="M0-256v-30" :stroke="p.shell" stroke-width="4" />
    </template>
    <template v-else-if="form === 'spire'">
      <path
        v-for="([r, y0, h], n) in spire"
        :key="n"
        :d="drum(0, -y0, r, h)"
        :fill="p.glass"
        :stroke="p.shell"
        stroke-width="3"
      />
      <ellipse
        v-for="([r, y0, h], n) in spire"
        :key="`g${n}`"
        :cy="-y0 - h"
        :rx="r + 10"
        ry="7"
        :fill="p.green"
      />
      <path :d="dome(0, -300, 26, 20)" :fill="p.accent" />
      <path d="M0-320v-40" :stroke="p.shell" stroke-width="4" />
    </template>
    <g v-if="level >= 2 && !['garden'].includes(form)">
      <ellipse cx="-104" cy="-20" rx="24" ry="20" :fill="p.shell" />
      <ellipse cx="-104" cy="-28" rx="18" ry="7" :fill="p.glass" />
    </g>
    <g v-if="level >= 3 && !['garden'].includes(form)">
      <g v-for="x in [-92, 92]" :key="x">
        <path :d="`M${x} 12v-52`" :stroke="p.accent" stroke-width="4" />
        <ellipse :cx="x" cy="-44" rx="9" ry="6" :fill="p.light" />
      </g>
      <circle cx="84" cy="-4" r="11" :fill="p.green" />
    </g>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { cityAppearance } from '../../data/cityAppearance';
import { ROUNDED_PALETTE as p, roundedForm } from '../../data/roundedArchitecture';
import TownLeisureBuilding from './TownLeisureBuilding.vue';
const props = defineProps({
  kind: String,
  era: String,
  level: Number,
});
const form = computed(() => roundedForm(props.kind));
const style = computed(() => cityAppearance(props.era, props.kind));
// A vertical drum and a dome in the map's front-on projection.
const drum = (x, base, r, h) =>
  `M${x - r} ${base}v${-h}a${r} ${r * 0.25} 0 0 1 ${r * 2} 0v${h}a${r} ${r * 0.25} 0 0 1 ${-r * 2} 0Z`;
const dome = (x, base, r, h) => `M${x - r} ${base}a${r} ${h} 0 0 1 ${r * 2} 0Z`;
const towers = computed(() => {
  const { identity, height = 3 } = style.value;
  const tall = Math.max(60, height * 32);
  const layout =
    identity === 'twin'
      ? [
          [-44, 36, tall],
          [44, 36, tall - 40],
        ]
      : identity === 'row' || identity === 'court'
        ? [
            [-62, 30, 56],
            [0, 34, 64],
            [62, 30, 56],
          ]
        : identity === 'pods'
          ? [[0, 18, 210]]
          : [[0, identity === 'porch' ? 52 : 58, identity === 'porch' ? 58 : tall]];
  return layout.map(([x, r, h]) => {
    const floors = Math.max(1, Math.round(h / 42));
    return { x, r, h, floors, step: h / floors, pods: identity === 'pods' };
  });
});
const spire = computed(() =>
  props.kind === 'skyline'
    ? [
        [52, 0, 120],
        [40, 120, 100],
        [28, 220, 80],
      ]
    : ['cityHall', 'school', 'sheriff', 'post'].includes(props.kind),
);
const domes = {
  big: [
    [-10, 70],
    [70, 30],
    [-86, 26],
  ],
  small: [
    [-36, 44],
    [44, 34],
  ],
};
</script>

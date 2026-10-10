<template>
  <g stroke-linejoin="round" stroke-linecap="round" :data-moon-form="kind">
    <ellipse cy="6" rx="122" ry="18" :fill="p.deep" />
    <ellipse cy="2" rx="112" ry="14" :fill="p.shell" />
    <template v-if="!level">
      <path v-for="x in [-80, 80]" :key="x" :d="`M${x} 0v-26`" :stroke="p.deep" stroke-width="3" />
      <circle v-for="x in [-80, 80]" :key="`l${x}`" :cx="x" cy="-28" r="4" :fill="p.light" />
    </template>
    <template v-else>
      <!-- Ribbon, tripod or deck stand behind the buildings. -->
      <path v-if="kind === 'ribbonLanding'" d="M0-110V-330" :stroke="p.glass" stroke-width="4" />
      <ellipse
        v-if="kind === 'ribbonLanding' && level >= 3"
        cy="-250"
        rx="52"
        ry="10"
        fill="none"
        :stroke="p.shell"
        stroke-width="6"
      />
      <path
        v-if="kind === 'craterIceWell'"
        d="M-60 0-20-110 20 0M-20-110 6 0"
        :stroke="p.deep"
        stroke-width="5"
        fill="none"
      />
      <g v-if="kind === 'earthriseLookout'">
        <path d="M-50 0v-48M50 0v-48" :stroke="p.deep" stroke-width="5" />
        <path d="M-64-48h128v-7H-64Z" :fill="p.timber" />
        <path d="M20-56 44-86" :stroke="p.light" stroke-width="8" />
        <path
          v-if="level >= 2"
          d="M-64-70h128M-56-48v-22M56-48v-22"
          :stroke="p.deep"
          stroke-width="2"
        />
      </g>
      <path
        v-if="kind === 'moonstoneWorkshop' && level >= 3"
        d="M-24-52V-84"
        :stroke="p.deep"
        stroke-width="4"
      />
      <g v-for="(part, n) in parts" :key="n">
        <template v-if="part.type === 'dome'">
          <path :d="drum(part.x, part.r, part.h)" :fill="p.shell" />
          <path
            :d="`M${part.x - part.r} ${-part.h}a${part.r} ${part.r * 0.85} 0 0 1 ${part.r * 2} 0Z`"
            :fill="part.solid ? p.shell : p.glass"
            :stroke="p.roof"
            stroke-width="3"
          />
          <path
            :d="`M${part.x} ${-part.h}v${-part.r * 0.85}M${part.x - part.r * 0.7} ${-part.h - part.r * 0.6}q${part.r * 0.7} ${-part.r * 0.4} ${part.r * 1.4} 0`"
            :stroke="p.roof"
            stroke-width="2"
            fill="none"
          />
          <circle :cx="part.x" cy="-16" r="8" :fill="p.deep" :stroke="p.light" stroke-width="2" />
        </template>
        <template v-else-if="part.type === 'module'">
          <rect
            :x="part.x - part.w / 2"
            :y="-part.h"
            :width="part.w"
            :height="part.h"
            rx="6"
            :fill="p.shell"
          />
          <path :d="`M${part.x - part.w / 2} -10h${part.w}`" :stroke="p.light" stroke-width="4" />
          <rect
            :x="part.x - part.w * 0.35"
            :y="-part.h * 0.7"
            :width="part.w * 0.7"
            height="9"
            :fill="p.glass"
          />
        </template>
        <template v-else-if="part.type === 'gable'">
          <rect
            :x="part.x - part.w / 2"
            :y="-part.h"
            :width="part.w"
            :height="part.h"
            :fill="p.shell"
          />
          <path
            :d="`M${part.x - part.w / 2 - 6} ${-part.h}L${part.x} ${-part.h - part.w * 0.32}L${part.x + part.w / 2 + 6} ${-part.h}Z`"
            :fill="part.red ? p.flower : p.roof"
          />
          <circle :cx="part.x" cy="-16" r="8" :fill="p.deep" :stroke="p.light" stroke-width="2" />
        </template>
        <template v-else-if="part.type === 'tank'">
          <path :d="drum(part.x, part.r, part.h)" :fill="p.shell" />
          <path
            :d="`M${part.x - part.r} ${-part.h + 4}h${part.r * 2}`"
            :stroke="p.light"
            stroke-width="4"
          />
        </template>
        <template v-else-if="part.type === 'rover'">
          <rect :x="part.x - 22" y="-26" width="44" height="14" rx="5" :fill="p.shell" />
          <rect :x="part.x - 4" y="-36" width="18" height="10" :fill="p.glass" />
          <circle
            v-for="dx in [-14, 14]"
            :key="dx"
            :cx="part.x + dx"
            cy="-8"
            r="7"
            :fill="p.deep"
          />
        </template>
        <template v-else-if="part.type === 'tree'">
          <path :d="`M${part.x} ${part.y}v-30`" :stroke="p.timber" stroke-width="5" />
          <circle :cx="part.x" :cy="part.y - 40" :r="part.r" :fill="p.green" />
          <circle :cx="part.x + 6" :cy="part.y - 44" r="3" :fill="p.flower" />
        </template>
        <template v-else-if="part.type === 'gem'">
          <path
            :d="`M${part.x} ${part.y - 10}l7 9-7 9-7-9Z`"
            :fill="p.glass"
            :stroke="p.shell"
            stroke-width="1.5"
          />
        </template>
        <template v-else-if="part.type === 'lamp'">
          <path :d="`M${part.x} 4v-40`" :stroke="p.deep" stroke-width="3" />
          <circle :cx="part.x" cy="-40" r="5" :fill="p.light" />
        </template>
        <template v-else-if="part.type === 'pennant'">
          <path :d="`M${part.x} 0v-86`" :stroke="p.deep" stroke-width="3" />
          <path :d="`M${part.x}-86l26 8-26 8Z`" :fill="p.flower" />
        </template>
      </g>
    </template>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { MOON_PALETTE as p } from '../../data/futureArchitecture';

// Front-view drawings of New Hollow's buildings, for building cards and the
// accessible Moon map. They follow the 3D lunar kit: glass domes, ceramic
// modules, gables, tanks and rovers, in the shared Moon palette.
const props = defineProps({ kind: String, level: { type: Number, default: 3 } });
const drum = (x, r, h) =>
  `M${x - r} 0v${-h}a${r} ${r * 0.22} 0 0 1 ${r * 2} 0v${h}a${r} ${r * 0.22} 0 0 1 ${-r * 2} 0Z`;
const dome = (x, r, h = 40, solid = false) => ({ type: 'dome', x, r, h, solid });
const module = (x, w, h) => ({ type: 'module', x, w, h });
const gable = (x, w, h, red = false) => ({ type: 'gable', x, w, h, red });
const parts = computed(() => {
  const level = props.level;
  const at = (min, ...items) => (level >= min ? items : []);
  switch (props.kind) {
    case 'ribbonLanding':
      return [
        { type: 'tank', x: 0, r: 26, h: 110 },
        module(-80, 60, 46),
        ...at(2, module(80, 60, 46)),
        ...at(3, { type: 'lamp', x: -112 }, { type: 'lamp', x: 112 }),
      ];
    case 'settlerDomes':
      return [
        dome(-46, 44),
        dome(46, 36, 32),
        ...at(2, dome(0, 34, 50)),
        ...at(3, { type: 'lamp', x: 100 }),
      ];
    case 'craterIceWell':
      return [
        { type: 'tank', x: 66, r: 28, h: 64 },
        ...at(2, { type: 'tank', x: -78, r: 22, h: 52 }),
        ...at(3, { type: 'gem', x: -20, y: -6 }, { type: 'gem', x: 10, y: -4 }),
      ];
    case 'earthlightGreenhouse':
      return [dome(-20, 70, 16), ...at(2, dome(70, 40, 16)), ...at(3, { type: 'lamp', x: -104 })];
    case 'willowkinDome':
      return [
        dome(0, 84, 20),
        { type: 'tree', x: 0, y: -24, r: 28 },
        ...at(2, { type: 'lamp', x: -108 }, { type: 'lamp', x: 108 }),
        ...at(3, { type: 'tree', x: 92, y: 0, r: 12 }),
      ];
    case 'newHollowCommons':
      return [
        module(0, 140, 56),
        dome(0, 34, 56, true),
        { type: 'pennant', x: -92 },
        ...at(2, module(96, 44, 40)),
        ...at(3, { type: 'tank', x: -108, r: 10, h: 110 }),
      ];
    case 'craterHomesteads':
      return [
        gable(-50, 64, 54),
        gable(52, 58, 46, true),
        ...at(2, gable(0, 52, 40)),
        ...at(3, { type: 'rover', x: 96 }),
      ];
    case 'moonstoneWorkshop':
      return [
        module(-24, 110, 52),
        { type: 'tank', x: -60, r: 9, h: 96 },
        { type: 'gem', x: 60, y: -18 },
        { type: 'gem', x: 76, y: -16 },
        ...at(2, dome(84, 28, 22)),
        ...at(3, { type: 'gem', x: -24, y: -84 }),
      ];
    case 'roverBarn':
      return [
        gable(-26, 110, 58, true),
        { type: 'rover', x: 76 },
        ...at(2, { type: 'rover', x: -96 }),
        ...at(3, { type: 'lamp', x: 112 }),
      ];
    case 'earthriseLookout':
      return [...at(3, dome(-86, 28, 18)), ...at(2, { type: 'lamp', x: 96 })];
    default:
      return [dome(0, 50)];
  }
});
</script>

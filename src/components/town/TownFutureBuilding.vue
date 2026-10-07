<template>
  <g stroke-linejoin="round" stroke-linecap="round" :data-form="form" :data-future-style="style">
    <ellipse
      cy="9"
      :rx="landmark ? 132 : 100"
      ry="20"
      :fill="style === 'observatory' ? p.shell : p.timber"
      opacity="0.55"
    />
    <template v-if="form === 'square'">
      <TownSquare :stage="3" :era="era" />
    </template>
    <template v-else-if="form === 'garden'">
      <TownLeisureBuilding :kind="kind === 'horseField' ? 'horseField' : 'park'" :level="3" />
    </template>
    <template v-else-if="form === 'bridge'">
      <path d="M-155 8H155" :stroke="p.shell" stroke-width="30" />
      <path d="M-155-15H155M-155 28H155" :stroke="p.deep" stroke-width="4" />
    </template>
    <template v-else-if="form === 'airport'">
      <TownCityBuilding :kind="kind" :era="era" :level="level" :service-level="3" />
    </template>

    <!-- Landmark extras drawn behind the buildings. -->
    <template v-if="form === 'spaceElevator'">
      <path d="M0-60V-330" :stroke="p.glass" stroke-width="4" />
      <ellipse
        v-if="level >= 3"
        cy="-250"
        rx="62"
        ry="12"
        fill="none"
        :stroke="p.shell"
        stroke-width="7"
      />
      <rect
        v-for="y in climbers"
        :key="y"
        x="-9"
        :y="y"
        width="18"
        height="22"
        rx="4"
        :fill="p.shell"
        :stroke="p.flower"
        stroke-width="3"
      />
      <path d="M-135 4h270l-18-14h-234Z" :fill="p.deep" />
      <ellipse cy="-8" rx="122" ry="12" :fill="p.shell" :stroke="p.light" stroke-width="4" />
      <path d="M-26-10v-104h52v104Z" :fill="p.shell" :stroke="p.light" stroke-width="3" />
      <path d="M-70-10-26-96M70-10 26-96" :stroke="p.roof" stroke-width="9" />
      <path d="M-30-114h60" :stroke="p.light" stroke-width="7" />
    </template>
    <template v-if="form === 'skyHarbour'">
      <path d="M-78-40v-150" :stroke="p.timber" stroke-width="10" />
      <g :transform="`translate(20 ${-170})`"><Airship :p="p" /></g>
      <g v-if="level >= 2" transform="translate(-10 -230) scale(0.6)"><Airship :p="p" /></g>
    </template>
    <template v-if="form === 'cloudOrchard'">
      <g v-for="([x, y], n) in islands" :key="n">
        <path :d="`M${x} 0V${y + 20}`" :stroke="p.deep" stroke-width="1.5" />
        <Island :p="p" :x="x" :y="y" />
      </g>
    </template>
    <template v-if="form === 'greatTelescope'">
      <path d="M0-90 36-200" :stroke="p.timber" stroke-width="26" />
      <ellipse
        v-if="level >= 3"
        cy="-96"
        rx="128"
        ry="22"
        fill="none"
        :stroke="p.flower"
        stroke-width="7"
      />
    </template>
    <template v-if="form === 'dewlightGardens'">
      <g v-if="level >= 2">
        <circle v-for="x in [-50, 0, 50]" :key="x" :cx="x" cy="-6" r="6" :fill="p.light" />
      </g>
      <g v-for="x in level >= 3 ? [-80, 80, 0] : [-80, 80]" :key="x">
        <rect :x="x - 11" y="-150" width="22" height="150" :fill="p.glass" />
        <Cap :style-id="style" :p="p" :x="x" :y="-150" :r="16" />
      </g>
    </template>
    <template v-if="form === 'moonpost'">
      <path d="M78 0 112-110" :stroke="p.deep" stroke-width="5" />
      <rect
        x="96"
        y="-104"
        width="14"
        height="26"
        rx="4"
        :fill="p.light"
        transform="rotate(18 103 -91)"
      />
    </template>

    <!-- Bodies, roofs and doors in the era's own style. -->
    <g v-for="(b, n) in parts.blocks" :key="`b${n}`">
      <Block :style-id="style" :p="p" v-bind="b" />
      <Roof
        :style-id="style"
        :p="p"
        :x="b.x"
        :w="b.w"
        :top="-b.h"
        :accent="b.accent"
        :tone="tone"
      />
      <Door v-if="b.door" :style-id="style" :p="p" :x="b.x" />
    </g>
    <g v-for="(tw, n) in parts.towers" :key="`t${n}`">
      <Tower :style-id="style" :p="p" v-bind="tw" />
      <Cap
        :style-id="style"
        :p="p"
        :x="tw.x"
        :y="-tw.h"
        :r="tw.r"
        :accent="tw.accent"
        :tone="tone"
      />
      <Door v-if="tw.door" :style-id="style" :p="p" :x="tw.x" />
    </g>
    <template v-if="form === 'missionHomesteads' && level >= 3">
      <path d="M-30 4v-120" :stroke="p.deep" stroke-width="3" />
      <path d="M-30-116 6-106-30-96Z" :fill="p.light" />
    </template>
    <Crown v-if="parts.crown" :style-id="style" :p="p" v-bind="parts.crown" :variant="tone" />
    <Prop v-for="x in parts.props" :key="`p${x}`" :style-id="style" :p="p" :x="x" />
    <path
      v-if="form === 'spaceElevator'"
      d="M-120 4h-14m268 0h-14"
      :stroke="p.light"
      stroke-width="4"
    />
  </g>
</template>
<script setup>
import { computed, h } from 'vue';
import { futureAppearance, futureForm, FUTURE_LANDMARKS } from '../../data/futureArchitecture';
import { cityAppearance } from '../../data/cityAppearance';
import TownCityBuilding from './TownCityBuilding.vue';
import TownLeisureBuilding from './TownLeisureBuilding.vue';
import TownSquare from './TownSquare.vue';

const props = defineProps({ kind: String, era: String, level: Number });
const appearance = computed(() => futureAppearance(props.era));
const style = computed(() => appearance.value.style);
const p = computed(() => appearance.value.palette);
const form = computed(() => futureForm(props.kind) ?? props.kind);
const landmark = computed(() => !!FUTURE_LANDMARKS[props.kind]);
// The same stable choice the 3D sail kit makes for its cloth and crown.
const tone = computed(() =>
  [...(props.kind ?? '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7),
);
const islands = computed(() =>
  [
    [40, -130],
    [-40, -165],
    [86, -180],
  ].slice(0, props.level >= 3 ? 3 : props.level >= 2 ? 2 : 1),
);
const climbers = computed(() => [-170, -230, -290].slice(0, Math.max(1, props.level)));

// Front-view massing for each archetype: rectangular blocks, round towers, the
// level-three crown and the street props. Units follow the cozy drawings.
const block = (x, w, h, extra = {}) => ({ x, w, h, door: true, ...extra });
const tower = (x, r, h, extra = {}) => ({ x, r, h, door: false, ...extra });
const parts = computed(() => {
  const { identity, height = 3 } = cityAppearance(props.era, props.kind);
  const level = props.level;
  const result = { blocks: [], towers: [], crown: null, props: [] };
  switch (form.value) {
    case 'homes':
      if (['row', 'court'].includes(identity))
        result.blocks.push(
          block(-62, 52, 70),
          block(0, 54, 86, { accent: true }),
          block(62, 52, 70),
        );
      else if (['twin', 'pods', 'balconies', 'hotel'].includes(identity))
        result.towers.push(
          tower(-36, 32, height * 29, { door: true }),
          tower(40, 30, height * 29 - 36),
        );
      else result.blocks.push(block(0, 104, 92));
      break;
    case 'hall':
      result.blocks.push(block(0, 128, 86));
      if (['clock', 'bell', 'patrol', 'post'].includes(identity))
        result.towers.push(tower(0, 16, 128, { accent: true }));
      break;
    case 'shop':
    case 'workshop':
    case 'station':
      result.blocks.push(
        block(0, 138, form.value === 'shop' ? 74 : 84, { accent: form.value === 'shop' }),
      );
      if (form.value === 'workshop') result.towers.push(tower(-48, 12, 120, { accent: true }));
      break;
    case 'water':
      result.towers.push(
        tower(-30, 32, kind() === 'well' ? 46 : 78),
        ...(kind() === 'well' ? [] : [tower(42, 24, 60, { accent: true })]),
      );
      break;
    case 'culture':
    case 'farm':
    case 'landing':
      result.blocks.push(block(-20, 92, form.value === 'culture' ? 90 : 66));
      result.towers.push(tower(56, 24, form.value === 'farm' ? 88 : 60, { accent: true }));
      break;
    case 'research':
    case 'concert':
      result.towers.push(
        tower(0, form.value === 'concert' ? 66 : 40, form.value === 'concert' ? 62 : 96, {
          door: true,
        }),
      );
      if (form.value === 'research')
        result.blocks.push(block(-56, 40, 58, { door: false }), block(56, 40, 58, { door: false }));
      break;
    case 'mast':
    case 'studio':
      result.blocks.push(block(-10, 84, 70));
      result.towers.push(
        tower(36, form.value === 'mast' ? 4 : 16, form.value === 'mast' ? 300 : 170, {
          accent: true,
        }),
      );
      break;
    case 'tower':
      result.towers.push(tower(0, 50, 250, { door: true }));
      break;
    case 'skyHarbour':
      result.towers.push(tower(-78, 20, 150, { accent: true }));
      result.blocks.push(block(50, 64, 56));
      break;
    case 'cloudOrchard':
      result.blocks.push(block(-70, 56, 56));
      break;
    case 'windsongLofts':
      result.blocks.push(block(-66, 56, 110), block(4, 56, 140, { accent: true }));
      if (level >= 2) result.blocks.push(block(72, 56, 90));
      break;
    case 'greatTelescope':
      result.towers.push(tower(0, 80, 90, { door: true }));
      if (level >= 2) result.blocks.push(block(-104, 56, 62, { door: false }));
      break;
    case 'dewlightGardens':
      result.blocks.push(block(96, 44, 52));
      break;
    case 'starlightTerraces':
      result.blocks.push(block(-66, 58, 82), block(0, 58, 118));
      if (level >= 2) result.blocks.push(block(66, 58, 82));
      break;
    case 'moonpost':
      result.blocks.push(block(0, 122, 90));
      if (level >= 2) result.blocks.push(block(-88, 48, 52, { door: false }));
      if (level >= 3) result.towers.push(tower(-50, 15, 150));
      break;
    case 'missionHomesteads':
      result.blocks.push(block(-66, 60, 78), block(10, 60, 90));
      if (level >= 2) result.blocks.push(block(82, 60, 74));
      break;
    case 'spaceElevator':
      result.blocks.push(block(-92, 60, 62, { door: true }), block(92, 60, 62, { door: false }));
      break;
  }
  if (!landmark.value && !['square', 'garden', 'bridge', 'airport'].includes(form.value)) {
    if (level >= 2) result.blocks.unshift(block(-104, 40, 52, { door: false, accent: true }));
    if (level >= 3) {
      const main = result.blocks.at(-1) ?? result.towers[0];
      const top = main ? (main.h ?? 0) + (main.w ? main.w * 0.32 : main.r) : 90;
      result.crown = { x: main?.x ?? 0, y: -top };
      result.props = [-92, 92];
    }
  } else if (landmark.value && level >= 3) result.props = [-118, 118];
  return result;
});
const kind = () => props.kind;

// ---------- Style-aware pieces ----------
const PORT = (x, y, p, r = 5) => [
  h('circle', { cx: x, cy: y, r: r + 1.6, fill: p.deep }),
  h('circle', { cx: x, cy: y, r, fill: p.glass }),
];
const cloth = (p, accent, tone) =>
  accent ? p.flower : [p.roof, p.glass, p.roof, p.flower][tone % 4];
const Block = (b) => {
  const { styleId: s, p, x, w, h: height } = b;
  const left = x - w / 2;
  if (s === 'sail')
    return h('g', [
      h('path', {
        d: `M${left + 4} 0v-14M${left + w - 4} 0v-14`,
        stroke: p.deep,
        'stroke-width': 3,
      }),
      h('rect', { x: left - 8, y: -18, width: w + 16, height: 6, fill: p.timber }),
      h('rect', {
        x: left,
        y: -height,
        width: w,
        height: height - 18,
        rx: 4,
        fill: p.shell,
        stroke: p.timber,
        'stroke-width': 1.5,
      }),
      h('rect', {
        x: left + w * 0.08,
        y: -height * 0.62,
        width: w * 0.84,
        height: 9,
        fill: p.glass,
      }),
      ...PORT(x - w * 0.28, -height * 0.32, p),
      ...PORT(x + w * 0.28, -height * 0.32, p),
    ]);
  if (s === 'observatory')
    return h('g', [
      h('rect', { x: left - 5, y: -8, width: w + 10, height: 8, fill: p.shell }),
      h('rect', { x: left, y: -height, width: w, height: height - 8, fill: p.roof }),
      h('rect', { x: left - 3, y: -height - 4, width: w + 6, height: 6, fill: p.timber }),
      ...[-0.3, 0.3].map((f) =>
        h('path', {
          d: `M${x + f * w - 6} ${-height * 0.25}v${-height * 0.38}a6 6 0 0 1 12 0v${height * 0.38}Z`,
          fill: p.glass,
          stroke: p.timber,
          'stroke-width': 1.5,
        }),
      ),
      ...[0.1, 0.42, 0.75].map((f, n) =>
        h('circle', { cx: left + w * f + 6, cy: -height * (0.75 - n * 0.12), r: 2, fill: p.light }),
      ),
    ]);
  return h('g', [
    h('rect', { x: left - 4, y: -8, width: w + 8, height: 8, fill: p.deep }),
    h('rect', { x: left, y: -height, width: w, height: height - 8, fill: p.shell }),
    h('path', {
      d: `M${left} -10h${w}M${left} ${-height + 2}h${w}`,
      stroke: p.light,
      'stroke-width': 3,
    }),
    ...[-0.3, 0.3].map((f) =>
      h('rect', {
        x: x + f * w - 7,
        y: -height * 0.62,
        width: 14,
        height: 16,
        fill: p.glass,
        stroke: p.timber,
        'stroke-width': 2,
      }),
    ),
    b.door
      ? h('path', {
          d: `M${left + w * 0.1} -40l${w * 0.8} 0 6 10h${-w * 0.8 - 12}Z`,
          fill: p.flower,
        })
      : null,
  ]);
};
const Roof = ({ styleId: s, p, x, w, top, accent, tone }) => {
  if (s === 'sail')
    return h('g', [
      h('path', {
        d: `M${x - w / 2 - 12} ${top - 44}Q${x} ${top - 12} ${x + w / 2 + 12} ${top - 26}L${x + w / 2 + 8} ${top - 4}Q${x} ${top - 20} ${x - w / 2 - 8} ${top - 6}Z`,
        fill: cloth(p, accent, tone),
        stroke: p.timber,
        'stroke-width': 1.5,
      }),
      h('path', {
        d: `M${x - w / 2 - 12} ${top}v-62M${x + w / 2 + 12} ${top}v-44`,
        stroke: p.timber,
        'stroke-width': 3,
      }),
      h('path', { d: `M${x - w / 2 - 12} ${top - 62}l16 5-16 5Z`, fill: p.flower }),
    ]);
  if (s === 'observatory') {
    const r = Math.min(w * 0.3, 34);
    return h('g', [
      h('rect', { x: x - w / 2 - 4, y: top - 6, width: w + 8, height: 7, fill: p.shell }),
      h('path', {
        d: `M${x - r} ${top - 6}a${r} ${r} 0 0 1 ${r * 2} 0Z`,
        fill: p.shell,
        stroke: p.timber,
        'stroke-width': 3,
      }),
      h('path', {
        d: `M${x} ${top - 6}v${-r}`,
        stroke: p.deep,
        'stroke-width': Math.max(4, r * 0.22),
      }),
    ]);
  }
  const rise = Math.min(34, w * 0.32);
  return h('g', [
    h('path', {
      d: `M${x - w / 2 - 8} ${top}L${x} ${top - rise}L${x + w / 2 + 8} ${top}Z`,
      fill: p.roof,
    }),
    h('path', {
      d: `M${x - w / 2 - 8} ${top}L${x} ${top - rise}L${x + w / 2 + 8} ${top}`,
      stroke: p.light,
      'stroke-width': 3,
      fill: 'none',
    }),
    h('circle', { cx: x, cy: top - rise * 0.4, r: 4, fill: p.light }),
  ]);
};
const Tower = ({ styleId: s, p, x, r, h: height }) => {
  const body = s === 'observatory' ? p.roof : p.shell;
  const band = s === 'sail' ? p.timber : s === 'observatory' ? p.timber : p.light;
  return h('g', [
    h('rect', {
      x: x - r,
      y: -height,
      width: r * 2,
      height,
      fill: body,
      stroke: s === 'sail' ? p.timber : 'none',
      'stroke-width': 1.5,
    }),
    ...Array.from({ length: Math.max(0, Math.floor(height / 36)) }, (_, n) =>
      h('path', {
        d: `M${x - r - 2} ${-(n + 1) * 34}h${r * 2 + 4}`,
        stroke: band,
        'stroke-width': 3,
      }),
    ),
  ]);
};
const Cap = ({ styleId: s, p, x, y, r, accent, tone = 0 }) => {
  if (s === 'sail')
    return h('g', [
      h('path', {
        d: `M${x - r * 1.35} ${y}L${x} ${y - r * 1.3 - 10}L${x + r * 1.35} ${y}Z`,
        fill: cloth(p, accent, tone),
        stroke: p.timber,
        'stroke-width': 1.5,
      }),
      h('path', { d: `M${x} ${y - r * 1.3 - 10}v-20`, stroke: p.timber, 'stroke-width': 2.5 }),
      h('path', { d: `M${x} ${y - r * 1.3 - 30}l14 4-14 4Z`, fill: p.flower }),
    ]);
  if (s === 'observatory')
    return h('g', [
      h('path', {
        d: `M${x - r} ${y}a${r} ${r} 0 0 1 ${r * 2} 0Z`,
        fill: p.shell,
        stroke: p.timber,
        'stroke-width': 3,
      }),
      h('path', { d: `M${x} ${y}v${-r}`, stroke: p.deep, 'stroke-width': Math.max(3, r * 0.22) }),
      h('circle', { cx: x, cy: y - r - 8, r: 3.5, fill: p.light }),
    ]);
  return h('g', [
    h('path', {
      d: `M${x - r * 1.15} ${y}L${x} ${y - r * 0.9 - 8}L${x + r * 1.15} ${y}Z`,
      fill: p.roof,
    }),
    h('circle', { cx: x, cy: y - r * 0.9 - 10, r: 3.5, fill: p.light }),
  ]);
};
const Door = ({ styleId: s, p, x }) => {
  if (s === 'sail')
    return h('g', [
      h('rect', {
        x: x - 9,
        y: -44,
        width: 18,
        height: 26,
        fill: p.deep,
        stroke: p.timber,
        'stroke-width': 2,
      }),
      ...PORT(x, -54, p, 3.5),
    ]);
  if (s === 'observatory')
    return h('path', {
      d: `M${x - 10} -8v-26a10 10 0 0 1 20 0v26Z`,
      fill: p.deep,
      stroke: p.timber,
      'stroke-width': 2,
    });
  return h('g', [
    h('circle', { cx: x, cy: -24, r: 12, fill: p.deep, stroke: p.light, 'stroke-width': 3 }),
    h('circle', { cx: x + 6, cy: -24, r: 1.8, fill: p.light }),
  ]);
};
const Island = ({ p, x, y }) =>
  h('g', [
    h('path', { d: `M${x - 26} ${y}L${x} ${y + 26}L${x + 26} ${y}Z`, fill: p.timber }),
    h('ellipse', { cx: x, cy: y, rx: 28, ry: 7, fill: p.green }),
    h('path', { d: `M${x} ${y}v-14`, stroke: p.timber, 'stroke-width': 3 }),
    h('circle', { cx: x, cy: y - 22, r: 12, fill: p.green }),
    h('circle', { cx: x - 5, cy: y - 22, r: 2.5, fill: p.flower }),
    h('circle', { cx: x + 6, cy: y - 18, r: 2.5, fill: p.flower }),
  ]);
const Airship = ({ p }) =>
  h('g', [
    h('ellipse', { rx: 62, ry: 22, fill: p.shell, stroke: p.timber, 'stroke-width': 2 }),
    h('path', { d: 'M-6-22v44', stroke: p.flower, 'stroke-width': 10 }),
    h('path', { d: 'M-62 0l-14-14v28Z', fill: p.deep }),
    h('rect', { x: -14, y: 24, width: 30, height: 10, rx: 3, fill: p.timber }),
  ]);
const Crown = ({ styleId: s, p, x, y, variant }) => {
  if (s === 'sail')
    return variant % 5 > 1
      ? h('g', [
          h('path', {
            d: `M${x} ${y}v-40l26-34`,
            stroke: p.deep,
            'stroke-width': 1.5,
            fill: 'none',
          }),
          h('rect', {
            x: x + 20,
            y: y - 86,
            width: 14,
            height: 14,
            fill: p.flower,
            transform: `rotate(45 ${x + 27} ${y - 79})`,
          }),
        ])
      : h('g', [
          h('path', { d: `M${x} ${y}v-30`, stroke: p.deep, 'stroke-width': 1.5 }),
          Island({ p, x: x + 8, y: y - 44 }),
        ]);
  if (s === 'observatory')
    return h('g', [
      h('path', { d: `M${x} ${y + 6}l18-40`, stroke: p.timber, 'stroke-width': 9 }),
      h('ellipse', {
        cx: x,
        cy: y + 4,
        rx: 46,
        ry: 9,
        fill: 'none',
        stroke: p.flower,
        'stroke-width': 3.5,
      }),
      h('circle', { cx: x + 44, cy: y + 2, r: 4, fill: p.light }),
    ]);
  return h('g', [
    h('path', { d: `M${x + 20} ${y + 6}v-40`, stroke: p.deep, 'stroke-width': 2.5 }),
    h('circle', { cx: x + 20, cy: y - 36, r: 5, fill: p.light }),
    h('path', {
      d: `M${x - 26} ${y - 6}a12 6 0 0 0 24 0`,
      fill: p.shell,
      stroke: p.deep,
      'stroke-width': 1.5,
    }),
  ]);
};
const Prop = ({ styleId: s, p, x }) => {
  if (s === 'sail')
    return h('g', [
      h('path', { d: `M${x} 6v-44l14-18`, stroke: p.deep, 'stroke-width': 2, fill: 'none' }),
      h('rect', {
        x: x + 9,
        y: -70,
        width: 11,
        height: 11,
        fill: p.flower,
        transform: `rotate(45 ${x + 14} ${-64})`,
      }),
    ]);
  if (s === 'observatory')
    return h('g', [
      h('path', { d: `M${x} 6v-46`, stroke: p.deep, 'stroke-width': 3 }),
      h('circle', { cx: x, cy: -44, r: 6, fill: p.light, stroke: p.timber, 'stroke-width': 2 }),
    ]);
  return h('g', [
    h('path', { d: `M${x} 6v-42`, stroke: p.deep, 'stroke-width': 3 }),
    h('circle', { cx: x, cy: -40, r: 5, fill: p.light }),
    h('rect', { x: x + 4, y: -6, width: 12, height: 12, fill: p.timber }),
  ]);
};
// Declared props let the template use kebab-case attributes.
Block.props = ['styleId', 'p', 'x', 'w', 'h', 'door', 'accent'];
Roof.props = ['styleId', 'p', 'x', 'w', 'top', 'accent', 'tone'];
Tower.props = ['styleId', 'p', 'x', 'r', 'h', 'door', 'accent'];
Cap.props = ['styleId', 'p', 'x', 'y', 'r', 'accent', 'tone'];
Door.props = ['styleId', 'p', 'x'];
Island.props = ['p', 'x', 'y'];
Airship.props = ['p'];
Crown.props = ['styleId', 'p', 'x', 'y', 'variant'];
Prop.props = ['styleId', 'p', 'x'];
</script>

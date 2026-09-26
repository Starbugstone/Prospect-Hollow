<template>
  <g class="town-fountain" :data-design="design" stroke-linejoin="round" stroke-linecap="round">
    <template v-if="design === 'victorian-iron'">
      <polygon :points="ring(38, 16, -24, 8)" fill="#8f8c82" />
      <polygon :points="ring(38, 16, -32, 8)" fill="#c4c0b3" />
      <ellipse cy="-33" rx="30" ry="11" :fill="water" />
      <path
        v-for="x in [-1, 1]"
        :key="x"
        :d="`M${x * 8}-40q${x * 12}-10 ${x * 22} 6`"
        v-bind="jet"
      />
      <path d="M-9-34-5-70h10l4 36Z" :fill="iron" />
      <path d="M-31-72-34-35h68l-3-37Z" v-bind="veil" />
      <path d="M-31-72q31 20 62 0Z" :fill="iron" />
      <ellipse cy="-72" rx="30" ry="7" :fill="water" :stroke="iron" stroke-width="2.5" />
      <template v-if="grand">
        <path d="M-3-74v-26h6v26Z" :fill="iron" />
        <path d="M-18-100-19-73h38l-1-27Z" v-bind="veil" />
        <path d="M-18-100q18 13 36 0Z" :fill="iron" />
        <ellipse cy="-100" rx="18" ry="4.5" :fill="water" :stroke="iron" stroke-width="2" />
      </template>
      <circle :cy="top - 8" r="4.5" :fill="iron" />
      <path :d="`M-2.5 ${top - 12}h5l-2.5-8Z`" fill="#c9a44c" />
      <path :d="`M0 ${top - 22}v-14`" v-bind="jet" />
    </template>

    <template v-else-if="design === 'civic-monument'">
      <ellipse cy="-24" rx="40" ry="17" fill="#d9d0bb" />
      <ellipse cy="-32" rx="40" ry="16" fill="#ebe4d2" />
      <ellipse cy="-32" rx="34" ry="12" :fill="water" />
      <path
        d="M-15-40h30v8h-30ZM-11-80h22v40h-22Z"
        fill="#d9d0bb"
        stroke="#a7a59b"
        stroke-width="2"
      />
      <path d="M-14-85h28v6h-28Z" fill="#ebe4d2" />
      <path
        v-for="x in [-1, 1]"
        :key="x"
        :d="`M${x * 11}-62q${x * 14}-4 ${x * 22} 28`"
        v-bind="jet"
      />
      <g fill="#6b5637" stroke="#6b5637">
        <path d="M-6-85v-16h12v16Z" />
        <path d="M-8-100v-17h16v17Z" />
        <circle cy="-122" r="5" />
        <path d="M-8-126h16M-4-126v-5h8v5" stroke-width="2.5" fill="none" />
        <path d="m6-113 5-17M-6-113l-6-11" stroke-width="4" />
        <path d="m-16-128 8 12" stroke-width="2" />
      </g>
      <circle cx="11" cy="-133" r="3.5" fill="#e0b64f" />
      <g v-if="grand">
        <g
          v-for="[x, y] in [
            [-24, -44],
            [24, -44],
            [-34, -26],
            [34, -26],
          ]"
          :key="`${x}${y}`"
        >
          <path :d="`M${x} ${y}v-44`" stroke="#39413f" stroke-width="2.5" />
          <circle :cx="x" :cy="y - 48" r="5" fill="#fff0b6" stroke="#39413f" stroke-width="1.5" />
        </g>
      </g>
    </template>

    <template v-else-if="design === 'memorial-obelisk'">
      <path d="M-46-31 0-50l46 19v8L0-4l-46-19Z" fill="#a8a69d" />
      <path d="M-46-31 0-50l46 19L0-12Z" fill="#d0cbbe" />
      <path d="M-37-31 0-45l37 14L0-17Z" :fill="water" />
      <path
        v-for="x in [-1, 1]"
        :key="x"
        :d="`M${x * 12}-38q${x * 10}-4 ${x * 16} 8`"
        v-bind="jet"
      />
      <path d="M-15-46h30v12h-30Z" fill="#a8a69d" />
      <path d="M-10-64h20v18h-20Z" fill="#a8a69d" />
      <circle cy="-55" r="5" fill="none" stroke="#5d8a74" stroke-width="2.5" />
      <path :d="`M-7-64-5.5 ${top}h11L7-64Z`" fill="#d0cbbe" stroke="#a8a69d" stroke-width="1.5" />
      <path
        :d="`M-5.5 ${top} 0 ${top - 9}l5.5 9Z`"
        fill="#d0cbbe"
        stroke="#a8a69d"
        stroke-width="1.5"
      />
      <g v-for="[x, y] in piers" :key="`${x}${y}`">
        <path :d="`M${x - 5} ${y}v-10h10v10Z`" fill="#d0cbbe" />
        <g v-if="grand" fill="#c0453a">
          <circle :cx="x - 2" :cy="y - 13" r="2.5" />
          <circle :cx="x + 2" :cy="y - 14" r="2.5" />
        </g>
      </g>
    </template>

    <template v-else-if="design === 'art-deco'">
      <ellipse cy="-24" rx="40" ry="17" fill="#3f8580" />
      <ellipse cy="-31" rx="38" ry="15" fill="#ecdcb4" />
      <ellipse cy="-33" rx="36" ry="13" fill="#3f8580" />
      <ellipse cy="-33" rx="32" ry="11" :fill="water" />
      <path d="M-18-35v-9h36v9ZM-9-53v-9h18v9Z" fill="#ecdcb4" />
      <path d="M-13-44v-9h26v9Z" fill="#3f8580" />
      <path :d="`M-4-62V${top}h8v${-62 - top}Z`" fill="#ecdcb4" />
      <path
        v-for="n in 3"
        :key="n"
        :d="`M-5 ${-62 + ((top + 62) * n) / 4}h10`"
        stroke="#3f8580"
        stroke-width="2"
      />
      <path
        v-for="n in 7"
        :key="`ray${n}`"
        :d="`M0 ${top}l${Math.sin((n - 4) * 0.42) * (n % 2 ? 16 : 11)} ${-Math.cos((n - 4) * 0.42) * (n % 2 ? 16 : 11)}`"
        stroke="#d6ae55"
        stroke-width="2.5"
      />
      <circle :cy="top" r="3.5" fill="#d6ae55" />
      <path
        v-for="[x, y] in [
          [-24, -38],
          [24, -38],
          [-16, -26],
          [16, -26],
        ]"
        :key="`${x}${y}`"
        :d="`M${x} ${y}v${grand ? -24 : -15}`"
        v-bind="jet"
      />
    </template>

    <template v-else-if="design === 'mid-century'">
      <ellipse cy="-26" rx="40" ry="16" fill="#e2805e" />
      <ellipse cy="-29" rx="37" ry="14" fill="#e8e2d4" />
      <ellipse cy="-30" rx="33" ry="11" :fill="water" />
      <template v-for="([rx, y, x], n) in saucers" :key="y">
        <path :d="`M${x} -30V${y}`" stroke="#8b979a" stroke-width="2.5" />
        <path
          :d="`M${x - rx} ${y}v${(n ? saucers[n - 1][1] : -30) - y}h${rx * 2}v${y - (n ? saucers[n - 1][1] : -30)}Z`"
          v-bind="veil"
        />
        <ellipse :cx="x" :cy="y" :rx="rx" :ry="rx * 0.3" fill="#f5f2ea" stroke="#d8d2c4" />
        <ellipse :cx="x" :cy="y - 0.5" :rx="rx * 0.8" :ry="rx * 0.2" :fill="water" />
      </template>
      <path :d="`M${star[0]} ${saucers.at(-1)[1]}V${star[1]}`" stroke="#8b979a" stroke-width="2" />
      <path
        v-for="[dx, dy] in [
          [11, -4],
          [-10, -6],
          [4, -12],
          [-6, 7],
          [9, 7],
        ]"
        :key="`${dx}${dy}`"
        :d="`M${star[0]} ${star[1]}l${dx} ${dy}`"
        stroke="#d9b24c"
        stroke-width="1.5"
      />
      <circle :cx="star[0]" :cy="star[1]" r="4.5" fill="#d9b24c" />
    </template>

    <template v-else-if="design === 'postmodern'">
      <path d="M-46-31 0-50l46 19v8L0-4l-46-19Z" fill="#77737c" />
      <path d="M-46-31 0-50l46 19L0-12Z" fill="#d6cfc4" />
      <path d="M-37-31 0-45l37 14L0-17Z" :fill="water" />
      <g v-if="grand" stroke="#7cc2b4" stroke-width="3">
        <path d="M0-45v-36M-33-31v-36M33-31v-36" />
      </g>
      <g v-for="[w, y, fill] in cascade" :key="y">
        <path
          :d="`M${-w} ${y}l${w} ${w / 2}l${w} ${-w / 2}v7l${-w} ${w / 2}l${-w} ${-w / 2}Z`"
          :fill="fill"
        />
        <path :d="`M${-w} ${y}l${w} ${-w / 2}l${w} ${w / 2}l${-w} ${w / 2}Z`" :fill="water" />
      </g>
      <path d="M-3-51v-24h6v24Z" fill="#7cc2b4" />
      <circle cy="-82" r="8" fill="#ecc45a" />
      <g v-if="grand">
        <path d="M0-17v-36" stroke="#7cc2b4" stroke-width="3" />
        <path d="M-33-67 0-81l33 14L0-53Z" fill="none" stroke="#e0a39b" stroke-width="4" />
      </g>
    </template>

    <template v-else-if="design === 'splash-plaza'">
      <ellipse cy="-24" rx="41" ry="16" fill="#555a5f" />
      <ellipse cy="-26" rx="37" ry="14" :fill="water" />
      <path
        v-for="n in grand ? 10 : 6"
        :key="n"
        :d="`M${Math.cos((n / (grand ? 10 : 6)) * 6.283) * 31} ${-26 + Math.sin((n / (grand ? 10 : 6)) * 6.283) * 11}v${-8 - (n % 3) * 4}`"
        v-bind="jet"
      />
      <g v-for="x in [-1, 1]" :key="x">
        <path :d="`M${x * 22 - 6} -24v${-tower}h12v${tower}Z`" fill="#b8dbe6" stroke="#8fb5c2" />
        <path :d="`M${x * 22 - x * 5} -30v${-tower * 0.6}`" stroke="#7cc3e4" stroke-width="4" />
        <path
          :d="`M${x * 16} ${-26 - tower * 0.4}q${-x * 8}-4 ${-x * 13} ${tower * 0.4 - 2}`"
          v-bind="jet"
        />
      </g>
      <circle cy="-29" r="5" fill="#c7cfd3" />
    </template>

    <template v-else>
      <ellipse cy="-24" rx="40" ry="18" fill="#8d8470" />
      <circle
        v-for="([x, y], n) in stones"
        :key="n"
        :cx="x"
        :cy="y"
        r="7"
        :fill="n % 2 ? '#8b8573' : '#a39a82'"
      />
      <ellipse cy="-31" rx="28" ry="10" :fill="water" />
      <ellipse cy="-36" rx="11" ry="7" fill="#8b8573" />
      <ellipse cy="-44" rx="9" ry="6" fill="#a39a82" />
      <ellipse cy="-51" rx="7" ry="5" fill="#b3a98f" />
      <template v-if="grand">
        <path d="M-15-58v20c0 6 30 6 30 0v-20" v-bind="veil" />
        <ellipse cy="-58" rx="16" ry="6" fill="#8b8573" />
        <ellipse cy="-59" rx="12" ry="4" :fill="water" />
        <path d="M-44-30v-38m12 38v-38" stroke="#7a5a3a" stroke-width="3" />
        <path d="M-48-92h20v24h-20Z" fill="#8e6a44" stroke="#4a4c49" stroke-width="1.5" />
        <path d="M-48-84h20m-20 8h20" stroke="#4a4c49" stroke-width="1.5" />
        <path d="m-28-82 20 10" stroke="#7a5a3a" stroke-width="4" />
      </template>
      <path :d="`M-5 ${pump}v-26h8v26Z`" fill="#4a4c49" />
      <path
        :d="`M3 ${pump - 20}h9v5M-3 ${pump - 24}l-15-9`"
        fill="none"
        stroke="#4a4c49"
        stroke-width="3"
      />
      <path :d="`M12 ${pump - 14}V${grand ? -58 : -31}`" v-bind="jet" stroke-width="3" />
    </template>
  </g>
</template>
<script setup>
import { computed } from 'vue';
import { fountainDesign } from '../../data/fountains';

// Flat counterparts of TownFountains.js for the SVG fallback, drawn around the
// same center point used by the square.
const props = defineProps({ stage: Number, era: { type: String, default: 'frontier' } });
const design = computed(() => fountainDesign(props.era));
const grand = computed(() => props.stage >= 3);
const water = '#5fa6b4',
  iron = '#3d5c4f';
const jet = { fill: 'none', stroke: '#cdeeee', 'stroke-width': 2.5 };
const veil = { fill: '#cdeeee', 'fill-opacity': 0.45 };
const top = computed(() => {
  if (design.value === 'memorial-obelisk') return grand.value ? -120 : -95;
  if (design.value === 'art-deco') return grand.value ? -100 : -86;
  return grand.value ? -101 : -73;
});
const pump = computed(() => (grand.value ? -60 : -54));
const tower = computed(() => (grand.value ? 58 : 40));
const saucers = computed(() =>
  [
    [24, -52, 3],
    [16, -72, -3],
    [10, -88, 1],
  ].slice(0, grand.value ? 3 : 2),
);
const star = computed(() => [saucers.value.at(-1)[2], saucers.value.at(-1)[1] - 14]);
const cascade = [
  [22, -38, '#e0a39b'],
  [15, -46, '#d6cfc4'],
  [9, -53, '#e0a39b'],
];
const piers = [
  [-46, -27],
  [46, -27],
  [0, -46],
  [0, -8],
];
const stones = Array.from({ length: 12 }, (_, n) => {
  const a = (n / 12) * Math.PI * 2;
  return [Math.cos(a) * 34, -29 + Math.sin(a) * 14];
});
function ring(rx, ry, cy, sides) {
  return Array.from({ length: sides }, (_, n) => {
    const a = Math.PI / sides + (n / sides) * Math.PI * 2;
    return `${(Math.cos(a) * rx).toFixed(1)},${(cy + Math.sin(a) * ry).toFixed(1)}`;
  }).join(' ');
}
</script>

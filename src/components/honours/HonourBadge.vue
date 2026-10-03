<template>
  <span
    class="honour-badge"
    :class="{ 'honour-badge-locked': locked }"
    :style="{ '--honour-badge-size': `${size}px` }"
  >
    <svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient :id="`${uid}-fill`" x1="0" y1="0" x2="1" y2="1">
          <stop
            v-for="stop in palette.stops"
            :key="stop[0]"
            :offset="stop[0]"
            :stop-color="stop[1]"
          />
        </linearGradient>
      </defs>
      <!-- Shape and engraving carry the difficulty, never colour alone. -->
      <template v-if="frame === 'easy'">
        <circle
          cx="50"
          cy="50"
          r="46"
          :fill="`url(#${uid}-fill)`"
          stroke="#6b4626"
          stroke-width="2.5"
        />
        <circle
          cx="50"
          cy="50"
          r="40.5"
          fill="none"
          stroke="#fbe3bd"
          stroke-opacity=".7"
          stroke-width="1.4"
          stroke-dasharray="1.5 3.2"
        />
        <circle cx="50" cy="50" r="35" fill="#f9f0de" stroke="#9c6a3c" stroke-width="2" />
      </template>
      <template v-else-if="frame === 'hard'">
        <polygon
          :points="rosette"
          :fill="`url(#${uid}-fill)`"
          stroke="#7a561c"
          stroke-width="2"
          stroke-linejoin="round"
        />
        <circle
          cx="50"
          cy="50"
          r="38"
          fill="none"
          stroke="#fff1c9"
          stroke-opacity=".8"
          stroke-width="1.3"
          stroke-dasharray="1.5 2.6"
        />
        <circle cx="50" cy="50" r="33.5" fill="#fff8e4" stroke="#b48a3c" stroke-width="2.2" />
      </template>
      <template v-else-if="frame === 'medal'">
        <path
          d="M50 4 88 15v33c0 24-17 40-38 48C29 88 12 72 12 48V15Z"
          :fill="medalColor"
          stroke="#2f3a2f"
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <path
          d="M50 12 80 21v27c0 19-13 32-30 39C33 80 20 67 20 48V21Z"
          fill="#f8f2e2"
          stroke="#e9c893"
          stroke-width="1.6"
        />
      </template>
      <template v-else>
        <polygon
          :points="hexagon(47)"
          :fill="`url(#${uid}-fill)`"
          stroke="#45604f"
          stroke-width="2.5"
          stroke-linejoin="round"
        />
        <polygon
          :points="hexagon(41)"
          fill="none"
          stroke="#f4f7f1"
          stroke-opacity=".75"
          stroke-width="1.3"
          stroke-dasharray="1.5 3"
        />
        <polygon
          :points="hexagon(36)"
          fill="#f6f4ea"
          stroke="#6f8a78"
          stroke-width="2"
          stroke-linejoin="round"
        />
      </template>
      <g v-if="art.glyph === 'stars'" fill="#d8a73f" stroke="#7a561c" stroke-width="1.2">
        <path :d="STAR" transform="translate(24 30) scale(1.05)" />
        <path :d="STAR" transform="translate(50 30) scale(1.05)" />
        <path :d="STAR" transform="translate(37 42) scale(1.25)" />
      </g>
      <g v-else-if="art.glyph === 'score'">
        <path
          :d="STAR"
          transform="translate(38 22)"
          fill="#d8a73f"
          stroke="#7a561c"
          stroke-width="1"
        />
        <text
          x="50"
          y="67"
          text-anchor="middle"
          font-family="Georgia, serif"
          font-size="25"
          fill="#5b4416"
        >
          {{ art.ribbon }}
        </text>
      </g>
      <g v-else-if="art.glyph === 'supplies'">
        <image href="/art/powers/clear-row.svg" x="17" y="30" width="36" height="36" />
        <image href="/art/powers/color-wand.svg" x="47" y="30" width="36" height="36" />
        <image href="/art/powers/tnt.svg" x="29" y="27" width="44" height="44" />
      </g>
      <g v-else-if="art.glyph === 'prospector'" fill="#d8a73f" stroke="#7a561c" stroke-width="1">
        <path
          v-for="(point, i) in ring"
          :key="i"
          :d="STAR"
          :transform="`translate(${point}) scale(.5)`"
        />
        <path :d="STAR" transform="translate(38 38)" />
      </g>
      <template v-else-if="art.image">
        <image v-if="art.second" :href="art.image" x="17" y="27" width="42" height="42" />
        <image v-if="art.second" :href="art.second" x="41" y="31" width="42" height="42" />
        <image
          v-else
          :href="art.image"
          :x="imageBox[0]"
          :y="imageBox[0]"
          :width="imageBox[1]"
          :height="imageBox[1]"
        />
      </template>
      <g v-if="art.ribbon && frame !== 'medal'">
        <path d="M26 78h48l-4 11H30z" fill="#6c4f1b" stroke="#3d2c0d" stroke-width="1" />
        <text
          x="50"
          y="86.6"
          text-anchor="middle"
          font-size="8"
          font-weight="700"
          letter-spacing=".6"
          fill="#fff4d8"
          font-family="Segoe UI, sans-serif"
        >
          {{ art.ribbon }}
        </text>
      </g>
    </svg>
    <span v-if="locked" class="honour-badge-lock">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    </span>
  </span>
</template>
<script setup>
import { computed, useId } from 'vue';
import { ERAS } from '../../data/eras';

// One badge frame system for the collection, showcase, museum and popup. The shape
// follows difficulty (round, hexagon, rosette); era medals are shields.
const props = defineProps({
  definition: { type: Object, required: true },
  size: { type: Number, default: 64 },
  locked: Boolean,
});
const uid = `honour-${useId()}`;
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z';
const PALETTES = {
  easy: [
    [0, '#f0c48e'],
    [0.55, '#c48a52'],
    [1, '#8d5a2f'],
  ],
  medium: [
    [0, '#eef3ec'],
    [0.5, '#b6c8ba'],
    [1, '#7e9887'],
  ],
  hard: [
    [0, '#fbe6a8'],
    [0.5, '#e2b75c'],
    [1, '#a87b2c'],
  ],
};
const MEDAL_COLORS = ['#b5773d', '#4f7f8f', '#8a5a44', '#7b6d5a', '#a4553d', '#5d7fa6'];
const art = computed(() => props.definition.art ?? {});
const frame = computed(() => art.value.frame ?? props.definition.difficulty ?? 'medium');
const palette = computed(() => ({ stops: PALETTES[frame.value] ?? PALETTES.medium }));
const medalColor = computed(() => {
  const index = Math.max(
    0,
    ERAS.findIndex((era) => era.id === props.definition.era),
  );
  return MEDAL_COLORS[index % MEDAL_COLORS.length];
});
const imageBox = computed(() => (frame.value === 'medal' ? [31, 38] : [27, 46]));
const hexagon = (r) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = ((-90 + i * 60) * Math.PI) / 180;
    return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
const rosette = Array.from({ length: 32 }, (_, i) => {
  const r = i % 2 ? 41.5 : 48;
  const a = ((-90 + (i * 180) / 16) * Math.PI) / 180;
  return `${(50 + r * Math.cos(a)).toFixed(1)},${(50 + r * Math.sin(a)).toFixed(1)}`;
}).join(' ');
const ring = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4;
  return `${(50 + 19 * Math.cos(a) - 6).toFixed(1)} ${(50 + 19 * Math.sin(a) - 6).toFixed(1)}`;
});
</script>
<style>
.honour-badge {
  position: relative;
  display: inline-grid;
  place-items: center;
  flex: 0 0 var(--honour-badge-size);
  width: var(--honour-badge-size);
  height: var(--honour-badge-size);
}
.honour-badge > svg {
  width: 100%;
  height: 100%;
  filter: drop-shadow(0 2px 3px #2d281a40);
}
.honour-badge-locked > svg {
  filter: grayscale(1) contrast(0.85) opacity(0.5);
}
.honour-badge-lock {
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: max(18px, calc(var(--honour-badge-size) * 0.3));
  height: max(18px, calc(var(--honour-badge-size) * 0.3));
  border-radius: 50%;
  border: 1px solid #cfccbc;
  background: #f3f1e6;
  display: grid;
  place-items: center;
}
.honour-badge-lock svg {
  width: 60%;
  height: 60%;
}
.honour-badge-lock rect {
  fill: #6f7464;
}
.honour-badge-lock path {
  fill: none;
  stroke: #6f7464;
  stroke-width: 2.4;
}
@media (forced-colors: active) {
  .honour-badge-locked > svg {
    filter: none;
    opacity: 0.6;
  }
}
</style>

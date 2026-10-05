<template>
  <span
    class="honour-badge"
    :class="{ 'honour-badge-locked': locked, 'honour-badge-player': player }"
    :style="{ '--honour-badge-size': `${size}px`, '--player-glow': palette.glow }"
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
      <!-- Shape and engraving carry the metal, never colour alone. -->
      <!-- A player distinction is a shield with sparkles, unlike every town medal. -->
      <template v-if="player">
        <path
          :d="SHIELD"
          :fill="`url(#${uid}-fill)`"
          :stroke="palette.edge"
          stroke-width="2.4"
          stroke-linejoin="round"
        />
        <path
          :d="SHIELD"
          transform="translate(50 50) scale(.86) translate(-50 -50)"
          fill="none"
          stroke="#fffaf0"
          stroke-opacity=".8"
          stroke-width="1.3"
          stroke-dasharray="1.5 2.8"
          vector-effect="non-scaling-stroke"
        />
        <path
          :d="SHIELD"
          transform="translate(50 50) scale(.74) translate(-50 -50)"
          :fill="palette.field"
          :stroke="palette.rim"
          stroke-width="2"
          vector-effect="non-scaling-stroke"
        />
        <path :d="SPARKLE" transform="translate(12 4) scale(.75)" fill="#fffbe8" />
        <path :d="SPARKLE" transform="translate(77 7) scale(.55)" fill="#fffbe8" />
      </template>
      <template v-else-if="frame === 'bronze'">
        <circle
          cx="50"
          cy="50"
          r="46"
          :fill="`url(#${uid}-fill)`"
          :stroke="palette.edge"
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
        <circle
          cx="50"
          cy="50"
          r="35"
          :fill="palette.field"
          :stroke="palette.rim"
          stroke-width="2"
        />
      </template>
      <template v-else>
        <polygon
          :points="palette.shape[0]"
          :fill="`url(#${uid}-fill)`"
          :stroke="palette.edge"
          stroke-width="2.2"
          stroke-linejoin="round"
        />
        <polygon
          :points="palette.shape[1]"
          fill="none"
          stroke="#fffaf0"
          stroke-opacity=".8"
          stroke-width="1.3"
          stroke-dasharray="1.5 2.8"
          stroke-linejoin="round"
        />
        <polygon
          :points="palette.shape[2]"
          :fill="palette.field"
          :stroke="palette.rim"
          stroke-width="2.1"
          stroke-linejoin="round"
        />
        <!-- Diamond is cut: facets join its outer and inner edges. -->
        <path
          v-if="frame === 'diamond'"
          :d="FACETS"
          fill="none"
          :stroke="palette.edge"
          stroke-opacity=".55"
          stroke-width="1.2"
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
          {{ engraving }}
        </text>
      </g>
      <g v-else-if="art.glyph === 'supplies'">
        <image href="/art/powers/clear-row.svg" x="17" y="30" width="36" height="36" />
        <image href="/art/powers/color-wand.svg" x="47" y="30" width="36" height="36" />
        <image href="/art/powers/tnt.svg" x="29" y="27" width="44" height="44" />
      </g>
      <g v-else-if="art.glyph === 'guests'" stroke-width="1.4">
        <circle cx="39" cy="42" r="7" fill="#7f9f83" stroke="#45604f" />
        <path d="M27 70v-8a12 12 0 0 1 24 0v8Z" fill="#7f9f83" stroke="#45604f" />
        <circle cx="61" cy="39" r="8" fill="#d8a73f" stroke="#7a561c" />
        <path d="M48 70v-9a13 13 0 0 1 26 0v9Z" fill="#d8a73f" stroke="#7a561c" />
      </g>
      <g v-else-if="art.glyph === 'travels'" stroke-width="1.4" stroke-linejoin="round">
        <path d="M47.5 27h5v47h-5Z" fill="#8a6a3e" stroke="#5a4222" />
        <path d="M29 32h27l7 6.5-7 6.5H29Z" fill="#d8a73f" stroke="#7a561c" />
        <path d="M71 49H44l-7 6.5 7 6.5h27Z" fill="#7f9f83" stroke="#45604f" />
        <path d="M38 74h24" stroke="#5a4222" stroke-width="3" stroke-linecap="round" />
      </g>
      <text
        v-else-if="art.letter"
        x="50"
        y="63"
        text-anchor="middle"
        font-family="Georgia, serif"
        font-size="40"
        :fill="palette.ink"
      >
        {{ art.letter }}
      </text>
      <g v-else-if="art.glyph === 'hourglass'" :fill="palette.ink" :stroke="palette.ink">
        <!-- The time step reads first: a large count and its unit in capitals. -->
        <template v-if="tenure">
          <path d="M45.5 17h9M45.5 27h9" stroke-width="1.6" stroke-linecap="round" />
          <path d="M46.7 17.7h6.6L50 22ZM46.7 26.3h6.6L50 22Z" fill="#e3b958" stroke-width=".7" />
          <text
            x="50"
            y="55"
            text-anchor="middle"
            font-family="Georgia, serif"
            font-weight="700"
            font-size="31"
            stroke="none"
          >
            {{ number(tenure.count) }}
          </text>
          <text
            x="50"
            y="71"
            text-anchor="middle"
            font-family="'Segoe UI', sans-serif"
            font-weight="700"
            font-size="13.5"
            letter-spacing=".3"
            stroke="none"
            :textLength="unit.length > 5 ? 44 : undefined"
            lengthAdjust="spacingAndGlyphs"
          >
            {{ unit }}
          </text>
        </template>
        <template v-else>
          <path d="M39 27h22M39 69h22" stroke-width="3" stroke-linecap="round" />
          <path d="M41 28h18L50 48ZM41 68h18L50 48Z" fill="#e3b958" stroke-width="1.4" />
        </template>
      </g>
      <image v-else-if="art.image" :href="art.image" x="27" y="27" width="46" height="46" />
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
import { locale, number } from '../../i18n';
import { outline, tenureUnit } from './honourDisplay';

// One badge frame system for the collection, showcase, museum and popup. The frame is
// the rank's metal: round bronze, hexagon silver, rosette gold and cut octagon diamond.
// A player distinction (definition.player) is a glowing shield in its own colours, and
// the time distinction engraves its current step ("2 years").
const props = defineProps({
  definition: { type: Object, required: true },
  size: { type: Number, default: 64 },
  locked: Boolean,
});
const uid = `honour-${useId()}`;
const STAR = 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9Z';
const SHIELD = 'M50 4 89 15v31c0 24-16 41-39 50C27 87 11 70 11 46V15Z';
const SPARKLE = 'M12 0c1 7 5 11 12 12-7 1-11 5-12 12-1-7-5-11-12-12 7-1 11-5 12-12Z';
// Player distinction colours: gradient stops, edge, rim, field, engraving and glow.
const PLAYER_PALETTES = {
  amethyst: {
    stops: [
      [0, '#efe2ff'],
      [0.5, '#a97de4'],
      [1, '#5d3995'],
    ],
    edge: '#3e2466',
    rim: '#7b54b6',
    field: '#fbf7ff',
    ink: '#4a2d78',
    glow: '#b98cff',
  },
  midnight: {
    stops: [
      [0, '#dbe7ff'],
      [0.5, '#6585c8'],
      [1, '#2b3f7a'],
    ],
    edge: '#1c2a56',
    rim: '#4a66a6',
    field: '#f5f8ff',
    ink: '#22325f',
    glow: '#82b2ff',
  },
};
const octagon = (radius) => outline(8, radius, radius, -67.5);
const FACETS = Array.from({ length: 8 }, (_, i) => {
  const [outer, inner] = [octagon(47), octagon(36)].map((points) => points.split(' ')[i]);
  return `M${outer}L${inner}`;
}).join('');
// Gradient stops, outer edge, inner rim, field and outlines (outer, dashed, inner).
const PALETTES = {
  bronze: {
    stops: [
      [0, '#f0c48e'],
      [0.55, '#c48a52'],
      [1, '#8d5a2f'],
    ],
    edge: '#6b4626',
    rim: '#9c6a3c',
    field: '#f9f0de',
  },
  silver: {
    stops: [
      [0, '#f6f8f9'],
      [0.5, '#c5ced3'],
      [1, '#8b9aa3'],
    ],
    edge: '#56656e',
    rim: '#7f8f98',
    field: '#f5f6f4',
    shape: [outline(6, 47), outline(6, 41), outline(6, 36)],
  },
  gold: {
    stops: [
      [0, '#fbe6a8'],
      [0.5, '#e2b75c'],
      [1, '#a87b2c'],
    ],
    edge: '#7a561c',
    rim: '#b48a3c',
    field: '#fff8e4',
    shape: [outline(32, 48, 41.5), outline(32, 38, 38), outline(32, 33.5, 33.5)],
  },
  diamond: {
    stops: [
      [0, '#f4fcff'],
      [0.5, '#bfe4f1'],
      [1, '#79b1c6'],
    ],
    edge: '#3a6f83',
    rim: '#6aa3b8',
    field: '#f6fbfc',
    shape: [octagon(47), octagon(41), octagon(36)],
  },
};
const art = computed(() => props.definition.art ?? {});
const player = computed(() => props.definition.player === true);
const tenure = computed(() => (player.value ? props.definition.tenure : null));
const unit = computed(() =>
  tenure.value ? tenureUnit(tenure.value).toLocaleUpperCase(locale.value) : '',
);
// A metal added before its frame is drawn shows the bronze round frame.
const frame = computed(() =>
  PALETTES[props.definition.metal] ? props.definition.metal : 'bronze',
);
const palette = computed(() =>
  player.value
    ? (PLAYER_PALETTES[props.definition.palette] ?? PLAYER_PALETTES.amethyst)
    : PALETTES[frame.value],
);
// Score ranks engrave their multiple of the star target.
const engraving = computed(() =>
  props.definition.measure?.kind === 'score' ? `${number(props.definition.goal)}×` : '',
);
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
/* Player distinctions glow softly; the glow holds still with reduced motion. */
.honour-badge-player > svg {
  filter: drop-shadow(0 0 calc(var(--honour-badge-size) * 0.08) var(--player-glow))
    drop-shadow(0 2px 3px #2d281a40);
  animation: player-distinction-glow 2.6s ease-in-out infinite alternate;
}
@keyframes player-distinction-glow {
  from {
    filter: drop-shadow(0 0 calc(var(--honour-badge-size) * 0.04) var(--player-glow))
      drop-shadow(0 2px 3px #2d281a40);
  }
  to {
    filter: drop-shadow(0 0 calc(var(--honour-badge-size) * 0.13) var(--player-glow))
      drop-shadow(0 2px 3px #2d281a40);
  }
}
@media (prefers-reduced-motion: reduce) {
  .honour-badge-player > svg {
    animation: none;
  }
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

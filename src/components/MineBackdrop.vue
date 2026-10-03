<template>
  <div class="mine-backdrop" :data-era="era" aria-hidden="true">
    <svg viewBox="0 0 1440 1000" preserveAspectRatio="none" focusable="false">
      <defs>
        <radialGradient id="mine-depth">
          <stop stop-color="var(--mine-haze)" />
          <stop offset="1" stop-color="var(--mine-dark)" />
        </radialGradient>
        <radialGradient id="lantern-glow">
          <stop stop-color="#ffd28b" stop-opacity=".32" />
          <stop offset="1" stop-color="#ffd28b" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="mine-crystal" x2="1" y2="1">
          <stop stop-color="var(--mine-accent)" stop-opacity=".65" />
          <stop offset="1" stop-color="var(--mine-rock)" />
        </linearGradient>
      </defs>
      <path fill="url(#mine-depth)" d="M0 0H1440V1000H0Z" />
      <g fill="var(--mine-rock)">
        <path
          d="M0 0H1440V115L1310 154 1215 93 1100 146 976 94 805 127 643 86 471 129 310 89 183 164 0 117Z"
        />
        <path d="M0 80 174 115 230 238 174 364 207 490 149 626 178 798 92 1000H0Z" />
        <path d="M1440 60 1268 134 1214 267 1270 389 1238 538 1292 699 1256 848 1340 1000H1440Z" />
      </g>
      <g fill="none" stroke="var(--mine-edge)" stroke-width="2" opacity=".55">
        <path
          d="M0 202 125 183 174 364 57 409 0 376M0 551 149 626 81 725 0 712M1440 246 1320 202 1270 389 1401 424M1440 607 1292 699 1376 757 1440 718"
        />
        <path d="M163 116 220 68 310 89 349 0M1090 0 1100 146 1195 177 1214 267" />
      </g>
      <g class="mine-timbers" fill="none" stroke="var(--mine-timber)">
        <path d="M173 928 204 163 1228 163 1265 940" stroke-width="25" />
        <path d="M202 274 324 164M1110 164 1234 281" stroke-width="17" />
        <path
          d="M187 194 207 180 1226 180 1245 200M180 696H200M1240 696H1264"
          stroke="var(--mine-edge)"
          stroke-width="4"
        />
      </g>
      <g v-if="era === 'river-rail'" fill="none" stroke="#a48c70" stroke-width="8" opacity=".7">
        <path d="M112 950V220Q112 195 143 195H175M1328 950V220Q1328 195 1297 195H1265" />
        <circle cx="112" cy="680" r="20" stroke-width="5" />
      </g>
      <g
        v-else-if="['industrial', 'motor-age'].includes(era)"
        fill="none"
        stroke="#8aa39e"
        stroke-width="10"
        opacity=".65"
      >
        <path d="M183 940V153H1256V940" />
        <path d="M188 460h28m1010 0h28M188 720h28m1010 0h28" stroke="#d3ddcd" stroke-width="6" />
        <path d="M208 190Q720 250 1230 190" stroke="#bbc3a4" stroke-width="3" />
        <path
          v-for="x in [305, 720, 1125]"
          :key="x"
          :d="`M${x - 25} 210h50`"
          stroke="#fff0b6"
          stroke-width="9"
        />
        <path
          v-if="era === 'motor-age'"
          d="M165 940V133H1275V940M460 133V112H970V133"
          stroke="#d8c4a3"
          stroke-width="14"
        />
      </g>
      <g
        v-for="(position, index) in crystals"
        :key="index"
        :transform="`translate(${position[0]} ${position[1]}) rotate(${position[2]})`"
      >
        <path
          d="M0 66-19 10 0-38 20 10Z"
          fill="url(#mine-crystal)"
          stroke="var(--mine-accent)"
          stroke-opacity=".28"
        />
        <path d="M0-38 0 66 20 10Z" fill="var(--mine-accent)" opacity=".14" />
        <path d="M-8 63-40 31-36 1-16 19Z" fill="url(#mine-crystal)" />
      </g>
      <g
        v-if="['moss', 'garden'].includes(theme)"
        fill="none"
        stroke="#588b72"
        opacity=".45"
        stroke-width="5"
      >
        <path d="M153 131Q248 264 157 413T139 740M1299 116Q1196 337 1304 448T1291 728" />
        <path d="M180 281l-35-23m23 84 39-26m-44 216-37-20m1161-194 39-28m-41 243-30-36" />
      </g>
      <g v-if="['frost', 'moonlit', 'depths', 'river'].includes(theme)" fill="url(#mine-crystal)">
        <path
          d="M288 89 311 209 333 99M399 104 425 173 438 109M1017 103 1037 220 1066 121M1144 119 1170 192 1183 101"
        />
      </g>
      <g
        v-if="['amber', 'prism', 'opal', 'copper', 'waterworks', 'sunrise'].includes(theme)"
        fill="none"
        stroke="var(--mine-accent)"
        stroke-width="3"
        opacity=".4"
      >
        <path
          d="M23 517 98 461 146 476 163 403M74 479 52 444M1339 566 1292 535 1271 461 1305 390M1292 535 1382 499M260 64 382 81 442 53"
        />
      </g>
      <g
        v-if="theme === 'forge'"
        fill="none"
        stroke="var(--mine-edge)"
        stroke-width="4"
        opacity=".65"
      >
        <ellipse v-for="n in 8" :key="n" cx="1287" :cy="177 + n * 30" rx="10" ry="20" />
        <path d="M119 181V700L153 737 182 700" />
      </g>
      <g
        v-if="theme === 'relic'"
        fill="none"
        stroke="var(--mine-accent)"
        opacity=".3"
        stroke-width="4"
      >
        <path d="M101 763V321L148 274 194 321V763M1246 763V321L1292 274 1339 321V763" />
        <path d="m148 357 18 28-18 28-18-28Zm1144 0 18 28-18 28-18-28Z" />
      </g>
      <g v-for="x in [218, 1214]" :key="x" :transform="`translate(${x} 280)`">
        <circle r="126" fill="url(#lantern-glow)" />
        <path d="M0-101V-25M-11-14V-25H11V-14" fill="none" stroke="#766452" stroke-width="4" />
        <rect
          x="-17"
          y="-15"
          width="34"
          height="47"
          rx="5"
          fill="#241e21"
          stroke="#957956"
          stroke-width="3"
        />
        <rect x="-10" y="-8" width="20" height="31" rx="3" fill="#f4c77b" opacity=".8" />
        <path d="M0-8V23" stroke="#9f794a" stroke-width="3" />
      </g>
      <g
        v-if="
          [
            'workshop',
            'electric',
            'signals',
            'brickworks',
            'dynamo',
            'illuminated',
            'chrome',
          ].includes(theme)
        "
        fill="none"
        stroke="var(--mine-accent)"
      >
        <path
          d="M95 900V230Q95 190 135 190H200M1345 900V230Q1345 190 1305 190H1240"
          stroke-width="7"
          opacity=".35"
        />
        <g v-for="x in [100, 1340]" :key="x">
          <circle :cx="x" cy="475" r="40" fill="url(#lantern-glow)" stroke="none" />
          <circle :cx="x" cy="475" r="11" fill="#ffdfa0" stroke-width="4" />
          <path :d="`M${x - 16} 458h32m-32 34h32`" stroke-width="4" />
        </g>
      </g>
      <g v-if="theme === 'road'" fill="none" stroke="var(--mine-accent)" opacity=".3">
        <path d="M100 850V460q0-45 70-45M1340 850V460q0-45-70-45" stroke-width="8" />
        <path d="M100 510v300m1240-300v300" stroke-width="3" stroke-dasharray="12 20" />
      </g>
      <g v-if="theme === 'garden'" fill="var(--mine-accent)" opacity=".3">
        <ellipse v-for="n in 5" :key="n" cx="150" :cy="400 + n * 52" rx="20" ry="9" />
        <ellipse v-for="n in 5" :key="n" cx="1290" :cy="420 + n * 52" rx="20" ry="9" />
      </g>
      <g v-if="futuristic" class="mine-tomorrow" fill="none" stroke="var(--mine-accent)">
        <path
          d="M40 930V720a130 130 0 0 1 260 0V930M1140 930V720a130 130 0 0 1 260 0V930"
          stroke-width="6"
          opacity=".38"
        />
        <path
          d="M83 930V720m87-116V930m87-210V930M1183 930V720m87-116V930m87-210V930"
          stroke-width="2"
          opacity=".22"
        />
        <path
          d="M230 118Q720 238 1210 118M260 150Q720 262 1180 150"
          stroke-width="4"
          stroke-dasharray="26 18"
          opacity=".3"
        />
        <ellipse cx="1296" cy="330" rx="64" ry="20" stroke-width="4" opacity=".4" />
        <circle cx="1296" cy="330" r="22" fill="var(--mine-accent)" stroke="none" opacity=".22" />
        <circle cx="140" cy="360" r="9" fill="var(--mine-accent)" stroke="none" opacity=".35" />
        <path d="M112 396h56M124 412h32" stroke-width="3" opacity=".3" />
      </g>
      <g fill="none" stroke="var(--mine-edge)" opacity=".18">
        <path d="M360 1000 630 785M1090 1000 810 785" stroke-width="9" />
        <path d="M394 971H1052M450 925H993M508 881H935M564 837H876" stroke-width="12" />
      </g>
      <g class="mine-discoveries" stroke="var(--mine-accent)">
        <path
          v-for="(piece, index) in appearance.decorations"
          :key="index"
          :d="piece.d"
          :fill="piece.fill"
          :opacity="piece.opacity"
          :stroke-width="piece.width"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </g>
    </svg>
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { TOMORROW_CHAPTERS } from '../data/tomorrowLevels';
import { mineThemeAppearance } from '../data/mineThemes';
const props = defineProps({ theme: String, era: { type: String, default: 'frontier' } });
const appearance = computed(() => mineThemeAppearance(props.theme));
// Tomorrow City chambers share one lightweight vector layer: domes, a hover lane and an orbit.
const futuristic = computed(() =>
  TOMORROW_CHAPTERS.some((chapter) => chapter.theme === props.theme),
);
const crystals = computed(() => {
  const offset = [
    'lantern',
    'moss',
    'frost',
    'amber',
    'prism',
    'moonlit',
    'depths',
    'forge',
    'opal',
    'relic',
    'river',
    'rail',
    'workshop',
    'copper',
    'electric',
    'signals',
    'brickworks',
    'waterworks',
    'dynamo',
    'illuminated',
    'road',
    'garden',
    'chrome',
    'sunrise',
    ...TOMORROW_CHAPTERS.map((chapter) => chapter.theme),
  ].indexOf(props.theme);
  return [
    [90, 550 + offset * 14, -22],
    [1334, 620 - offset * 18, 25],
    [134, 855, -10],
    [1301, 895, 18],
  ];
});
</script>

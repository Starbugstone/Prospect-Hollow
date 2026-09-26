<template>
  <div
    ref="scene"
    class="town-map"
    :class="{ 'town-map-paused': paused, 'town-map-still': reducedMotion }"
    @pointermove="lookAround"
    @pointerleave="resetView"
  >
    <svg
      class="town-diorama"
      :viewBox="`${mapLeft} -45 ${mapWidth - mapLeft} 795`"
      role="group"
      :aria-label="
        t('Prospect Hollow town map. Choose any building to restore, or enter the mine to play.')
      "
    >
      <defs>
        <radialGradient :id="`${uid}-upgrade-glow`">
          <stop stop-color="#b5ffc2" stop-opacity=".95" />
          <stop offset=".65" stop-color="#84f69a" stop-opacity=".85" />
          <stop offset="1" stop-color="#84f69a" stop-opacity="0" />
        </radialGradient>
        <clipPath :id="`${uid}-land`"><path :d="land" /></clipPath>
        <linearGradient :id="`${uid}-sky`" x2="0" y2="1">
          <stop stop-color="#e9ece0" />
          <stop offset="1" stop-color="#f6ecd2" />
        </linearGradient>
        <linearGradient :id="`${uid}-ground`" x2=".3" y2="1">
          <stop stop-color="#ead9ae" />
          <stop offset="1" stop-color="#d6c293" />
        </linearGradient>
        <pattern :id="`${uid}-grain`" width="37" height="31" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="12" r=".7" fill="#8f865e" opacity=".16" />
          <path d="m20 25 3-1" stroke="#a79b70" opacity=".18" />
        </pattern>
        <g :id="`${uid}-tree`">
          <ellipse cy="3" rx="22" ry="9" fill="#6b7550" opacity=".15" />
          <path d="M0 1v-42" stroke="#8d8057" stroke-width="5" />
          <path d="m0-25-11-9m11 14 9-12" stroke="#8d8057" stroke-width="3" />
          <ellipse cy="-42" rx="24" ry="28" fill="#93a278" />
          <ellipse cx="-9" cy="-47" rx="18" ry="23" fill="#a7b18b" />
          <ellipse cx="11" cy="-32" rx="14" ry="16" fill="#7c926a" />
        </g>
        <g
          :id="`${uid}-cactus`"
          fill="none"
          stroke="#97a077"
          stroke-width="7"
          stroke-linecap="round"
        >
          <path d="M0 0v-36m0 23h-11v-12m11 5h11v-14" />
        </g>
        <g :id="`${uid}-person`" transform="scale(.65)">
          <ellipse cy="4" rx="7" ry="3" fill="#596242" opacity=".23" />
          <path class="walker-leg leg-left" d="m-3-6-1 9" stroke="#6e6552" stroke-width="3" />
          <path class="walker-leg leg-right" d="m3-6 2 9" stroke="#6e6552" stroke-width="3" />
          <path d="M0-18v13" stroke="currentColor" stroke-width="9" />
          <circle cy="-24" r="5" fill="#d7a577" />
          <path
            :d="isCityEra(town.era) ? 'M-5-28H8M-4-28q0-7 8-2' : 'M-8-28H8M-4-29v-4h8v4'"
            stroke="#9c7b4f"
            stroke-width="3"
          />
        </g>
        <g :id="`${uid}-horse`">
          <ellipse cx="2" cy="4" rx="25" ry="6" fill="#685a3d" opacity=".2" />
          <path d="M-13-14-15 3m8-15 1 15M14-12 16 3m-7-16L8 3" stroke="#72553b" stroke-width="4" />
          <ellipse cy="-19" rx="20" ry="10" fill="#a57850" />
          <path d="M12-21 16-42 28-43 30-30 23-27 19-15" fill="#a57850" />
          <path d="m17-41-2-7 7 5m3 0 2-6 4 8" fill="#715337" />
          <path d="M-19-23q-13 6-9 18M15-40l-4 18" stroke="#715337" stroke-width="4" fill="none" />
          <path d="m-4-26 12 2-2 13-12-2Z" fill="#738d8d" />
          <circle cx="26" cy="-37" r="1.5" fill="#403e2e" />
        </g>
        <g :id="`${uid}-car`">
          <path d="M-26-12H26V0H-26Z" fill="#819faa" />
          <path d="M-15-12-9-28H10L19-12Z" fill="#e1cfab" />
          <path d="M-8-24H8L12-14H-12Z" fill="#9cbbb5" />
          <circle cx="-16" r="7" fill="#4c554f" />
          <circle cx="17" r="7" fill="#4c554f" />
        </g>
      </defs>
      <g aria-hidden="true" class="town-backdrop">
        <rect
          :x="mapLeft"
          y="-45"
          :width="mapWidth - mapLeft"
          height="795"
          :fill="`url(#${uid}-sky)`"
        />
        <circle cx="781" cy="84" r="43" fill="#f6e6b5" opacity=".9" />
        <g fill="#fff9e7" opacity=".55">
          <path
            class="town-cloud cloud-one"
            d="M90 67q-18-24 12-32 10-25 35-9 26-8 33 14 30-2 27 23Z"
          />
          <path
            class="town-cloud cloud-two"
            d="M618 43q-15-17 10-22 9-24 28-11 28-6 31 16 24-3 22 17Z"
          />
        </g>
        <path
          d="M0 158 81 89 170 138 261 45 326 111 416 74 516 149 612 91 692 133 791 83 879 132 947 83 1000 131V340H0Z"
          fill="#cdd2b7"
        />
        <path d="m261 45 22 70-40-11-14 8ZM612 91l28 62-24-10-25 4Z" fill="#e1e0c7" />
        <path
          d="M0 204 80 143 191 184 318 125 451 191 551 148 634 201 770 158 864 177 940 154 1000 182V440H0Z"
          fill="#b9c3a0"
        />
      </g>
      <g aria-hidden="true">
        <ellipse cx="505" cy="698" rx="449" ry="39" fill="#59604c" opacity=".15" />
        <path d="M0 620 550 700 1000 590v30L550 735 0 653Z" fill="#ac8c5e" />
        <path d="m550 700 450-110v30L550 735Z" fill="#8e7955" />
        <path
          d="m0 633 550 81 450-111M0 646l550 79 450-114"
          fill="none"
          stroke="#d6b983"
          stroke-width="3"
          opacity=".55"
        />
        <path :d="land" :fill="`url(#${uid}-ground)`" />
      </g>
      <g aria-hidden="true" :clip-path="`url(#${uid}-land)`">
        <path :d="land" :fill="`url(#${uid}-grain)`" />
        <path :d="riverOutline(mapPoint, RIVER.bankWidth)" fill="#ab9b78" />
        <path :d="riverOutline(mapPoint)" fill="#6e9d9a" />
        <path :d="riverOutline(mapPoint, 0.35)" fill="#89b3ac" opacity=".5" />
        <g
          v-if="town.era !== 'frontier' && town.buildings.riverPort"
          :transform="`translate(${mapPoint([riverCenterX(-8), -8])})`"
        >
          <path d="M-15-31Q0-44 15-31L15 28Q0 41-15 28Z" fill="#725d45" />
          <rect x="-13" y="-25" width="26" height="49" rx="4" fill="#e3d3af" />
          <rect x="-9" y="-17" width="18" height="29" fill="#8c9f91" />
          <rect
            v-if="!modernTransport(town, 'riverPort')"
            x="-12"
            y="24"
            width="24"
            height="8"
            fill="#9b6e51"
          />
          <circle v-if="!modernTransport(town, 'riverPort')" cy="-13" r="4" fill="#565f56" />
          <g v-else>
            <rect x="-10" y="-24" width="20" height="18" fill="#d9ddce" />
            <path d="M-8-20H8" stroke="#729d9d" stroke-width="6" />
            <circle v-for="n in 3" :key="n" :cy="n * 7 - 7" r="2" fill="#8bb8bd" />
          </g>
        </g>
        <g v-if="railEdges(town).length" :transform="`translate(${mapPoint(PLOTS.railDepot)})`">
          <rect x="-50" y="-35" width="115" height="22" rx="2" fill="#b6a181" />
        </g>
        <g v-for="edge in railEdges(town)" :key="edge.id" stroke="#6b7265" fill="none">
          <path
            :d="`M${mapPoint(edge.from)} L${mapPoint(edge.to)}`"
            stroke-width="24"
            stroke-dasharray="3 8"
          />
          <path
            v-for="offset in [-0.5, 0.5]"
            :key="offset"
            :d="`M${mapPoint([edge.from[0], edge.from[1] + offset])} L${mapPoint([edge.to[0], edge.to[1] + offset])}`"
            stroke-width="3"
          />
        </g>
        <g v-if="railEdges(town).length" :transform="`translate(${mapPoint([-18, -23])})`">
          <path d="M-36 2H22" stroke="#50584f" stroke-width="9" stroke-dasharray="8 7" />
          <path d="M-38-16H-14V0H-38ZM-8-13H24V0H-8Z" fill="#a1825c" />
          <path
            v-if="!modernTransport(town, 'railDepot')"
            d="M-9-20H4V0H-9ZM16-23H22V-11H16Z"
            fill="#5d7470"
          />
          <g v-else>
            <rect x="-8" y="-20" width="36" height="20" rx="4" fill="#d6c9a1" />
            <path d="M-34-10H24" stroke="#9ec0bd" stroke-width="5" stroke-dasharray="7 3" />
          </g>
        </g>
        <path
          v-for="(track, index) in townTracks(town)"
          :key="`track-${index}`"
          :d="`M${mapPoint(track.from).join(' ')} L${mapPoint(track.to).join(' ')}`"
          :stroke-width="track.width * (pavedTown(town) ? 20 : 14)"
          :stroke="roadSurface(town)"
          stroke-linecap="round"
          fill="none"
        />
        <g class="mine-forecourt">
          <path
            :d="`M${mapPoint([-2.25, -20.1])}L${mapPoint([2.25, -20.1])}L${mapPoint([2.25, -18.6])}L${mapPoint([4.6, -18.6])}L${mapPoint([4.6, -8.7])}L${mapPoint([-4.6, -8.7])}L${mapPoint([-4.6, -18.6])}L${mapPoint([-2.25, -18.6])}Z`"
            :fill="pavedTown(town) ? '#b8b8a2' : '#c1ad85'"
          />
          <path
            v-for="side in [-1, 1]"
            :key="side"
            :d="`M${mapPoint([side * 4.6, -18.4])}L${mapPoint([side * 4.6, -9])}`"
            stroke="#9b8059"
            stroke-width="2"
            stroke-dasharray="8 3"
          />
          <g
            v-for="side in [-1, 1]"
            :key="`supplies-${side}`"
            :transform="`translate(${mapPoint([side * 4.95, -18.5])})`"
          >
            <rect
              x="-8"
              y="-10"
              width="16"
              height="14"
              fill="#a48b61"
              stroke="#d2b987"
              stroke-width="2"
            />
            <path d="m10 3 6-9 8 10Z" fill="#ad91bd" />
          </g>
        </g>
        <path
          d="M0 610q107-31 172 26t138 35m449 12q110-88 241-39"
          fill="none"
          stroke="#b6b381"
          stroke-width="45"
          opacity=".35"
        />
        <use
          v-for="(tree, i) in trees"
          :key="i"
          :href="`#${uid}-tree`"
          :transform="`translate(${tree[0]} ${tree[1]}) scale(${tree[2]})`"
        />
        <use
          v-for="(point, i) in cacti"
          :key="`c-${i}`"
          :href="`#${uid}-cactus`"
          :transform="`translate(${point[0]} ${point[1]})`"
        />
        <g stroke="#c1ac83" stroke-width="4" fill="none">
          <path
            d="m114 217 59 11m-53 6v-28m19 31v-28m20 31v-28M786 289l81-40m-77 49v-25m22 15v-28m23 16v-27m24 16v-26"
          />
        </g>
        <g fill="#bca783" opacity=".7">
          <ellipse
            v-for="n in 22"
            :key="n"
            :cx="65 + ((n * 137) % 860)"
            :cy="265 + ((n * 61) % 390)"
            :rx="2 + (n % 4)"
            ry="2"
          />
        </g>
      </g>
      <g :transform="`translate(${mapPoint(PLOTS.mine).join(' ')}) scale(.68)`">
        <TownMine :level="nextLevel" :era="town.era" @enter="$emit('mine')" />
      </g>
      <g
        v-for="building in orderedBuildings"
        :key="building.id"
        role="button"
        tabindex="0"
        :aria-label="
          indicators[building.id] === 'era'
            ? t('Advance to the next era')
            : t('Inspect {value0}: {value1}', {
                value0: t(building.name),
                value1: t(building.stages[town.buildings[building.id]]),
              })
        "
        :aria-pressed="selected === building.id"
        :transform="`translate(${building.x} ${building.y}) scale(.48)`"
        class="map-building"
        :data-town-plot="building.id"
        :class="{
          selected: selected === building.id,
          'is-repaired': town.buildings[building.id] > 0,
          'suggested-plot': building.id === suggestedId,
        }"
        @click="$emit('select', building.id)"
        @keydown.enter.prevent="$emit('select', building.id)"
        @keydown.space.prevent="$emit('select', building.id)"
      >
        <ellipse
          class="plot-ring"
          cy="3"
          rx="117"
          ry="45"
          fill="none"
          stroke="#ad8950"
          stroke-width="2"
          stroke-dasharray="5 6"
        />
        <ellipse
          v-if="indicators[building.id] === 'upgrade'"
          class="map-upgrade-glow"
          cy="-8"
          rx="130"
          ry="48"
          :fill="`url(#${uid}-upgrade-glow)`"
          aria-hidden="true"
        />
        <g
          :key="`${town.buildings[building.id]}-${construction?.id === building.id ? construction.serial : 0}`"
          aria-hidden="true"
          transform="scale(.88)"
        >
          <g :class="{ 'town-site-assembling': animatedConstruction?.id === building.id }">
            <TownSite
              :id="building.id"
              :stage="town.buildings[building.id]"
              :era="town.buildingEras[building.id]"
              :era-level="town.buildingEraLevels[building.id] || town.buildings[building.id]"
              :wins="constructionVisual(town.projects[building.id])"
            />
          </g>
          <g v-if="animatedConstruction?.id === building.id" class="town-build-hammer">
            <image href="/art/rewards/builder-hammer.svg" x="65" y="-165" width="80" height="80" />
          </g>
        </g>
        <image
          v-if="['ready', 'coins', 'tnt', 'bell', 'era'].includes(indicators[building.id])"
          class="map-action-icon"
          :transform="`translate(0 -32) scale(${townIndicatorScale(indicators[building.id])}) translate(0 32)`"
          :x="indicators[building.id] === 'ready' ? -36 : -28"
          :y="indicators[building.id] === 'ready' ? -68 : -60"
          :width="indicators[building.id] === 'ready' ? 72 : 56"
          :height="indicators[building.id] === 'ready' ? 72 : 56"
          :href="
            indicators[building.id] === 'ready'
              ? '/art/rewards/builder-hammer.svg'
              : building.id === 'saloon'
                ? '/art/rewards/coins.svg'
                : indicators[building.id] === 'bell'
                  ? '/art/rewards/town-bell.svg'
                  : indicators[building.id] === 'era'
                    ? '/art/rewards/era-compass.svg'
                    : '/art/powers/tnt.svg'
          "
          aria-hidden="true"
        />
        <g
          v-if="
            town.buildings[building.id] || town.projects[building.id] || building.id === suggestedId
          "
          class="map-label"
          transform="translate(0 35)"
          aria-hidden="true"
        >
          <rect
            x="-67"
            y="-18"
            width="134"
            height="34"
            rx="17"
            :fill="
              constructionReady(town.projects[building.id]) || hasIncome(building.id)
                ? '#e1f0c0'
                : building.id === suggestedId
                  ? '#f7dfa1'
                  : '#ffffff'
            "
          />
          <text
            y="5"
            text-anchor="middle"
            fill="#405b4c"
            font-size="19"
            font-family="Georgia, serif"
          >
            {{
              t(
                constructionReady(town.projects[building.id])
                  ? 'Tap to finish'
                  : hasIncome(building.id)
                    ? t('Collect {coins} coins', { coins: town.income.stored })
                    : building.id === 'blacksmith' && forgeCollectible
                      ? 'Collect 1 TNT'
                      : building.shortName,
              )
            }}
            <tspan v-if="town.buildings[building.id]" font-size="13">✓</tspan>
          </text>
        </g>
        <g v-else class="quiet-map-marker" transform="translate(0 35)" aria-hidden="true">
          <circle r="22" fill="#f7f1dc" stroke="#a9a88c" />
          <text y="7" text-anchor="middle" fill="#405b4c" font-size="25">+</text>
        </g>
      </g>
      <g v-if="hasElectricity(town)" aria-hidden="true">
        <g v-if="eraEvolution(town.era).overheadPower" class="town-power-grid">
          <path
            v-for="(pole, index) in grid.poles"
            :key="`pole-${index}`"
            :d="`M${mapPoint([pole[0], pole[2]])}L${powerPoint(pole)}`"
            stroke="#897255"
            stroke-width="1.5"
          />
          <path
            v-for="(wire, index) in [...grid.wires, ...grid.connections]"
            :key="`wire-${index}`"
            :d="powerWire(wire)"
            fill="none"
            stroke="#58645d"
            stroke-width=".85"
          />
        </g>
        <g
          v-for="(lamp, index) in ELECTRIC_LAMPS"
          :key="index"
          :transform="`translate(${mapPoint(lamp)})`"
        >
          <path d="M0 0V-42" stroke="#4d7065" stroke-width="3" />
          <circle cy="-45" r="8" fill="#fff0b6" stroke="#a89965" stroke-width="2" />
        </g>
      </g>
      <g aria-hidden="true">
        <g class="tumbleweed-trail">
          <ellipse cy="5" rx="15" ry="5" fill="#77623b" opacity=".17" />
          <g class="tumbleweed-spin" fill="none" stroke="#aa8c50" stroke-width="2">
            <circle cy="-6" r="13" />
            <ellipse cy="-6" rx="7" ry="13" />
            <ellipse cy="-6" rx="13" ry="5" />
            <path d="m-10-15 20 18m-20-1 19-18M0-21V9" />
          </g>
        </g>
        <g
          v-if="town.buildings.farm"
          aria-hidden="true"
          :transform="`translate(${mapPoint(atPlot('farm', -0.5, 2.2)).join(' ')})`"
        >
          <g v-for="n in 3" :key="n" :transform="`translate(${n * 10} ${(n % 2) * 5})`">
            <g class="daily-hen" :style="{ animationDelay: `${-n * 2}s` }">
              <ellipse cy="-4" rx="5" ry="4" fill="#efe2c3" />
              <circle cx="4" cy="-8" r="3" fill="#efe2c3" />
              <path d="m6-8 4 1-4 1M-2 0v3M2 0v3" stroke="#bf9256" fill="#bf9256" />
              <path d="m2-10 2-3 2 3" fill="#b76b51" />
              <circle cx="5" cy="-9" r=".7" fill="#484637" />
            </g>
          </g>
        </g>
        <g
          v-if="population > 0"
          aria-hidden="true"
          :transform="`translate(${mapPoint(atPlot('home', 1.5, 2.5)).join(' ')})`"
        >
          <g class="daily-dog" fill="#c69b6b">
            <ellipse cy="-7" rx="9" ry="5" />
            <ellipse cx="8" cy="-12" rx="5" ry="5" />
            <ellipse cx="12" cy="-10" rx="4" ry="2.5" fill="#e4c99e" />
            <path d="M-5-4v7M5-4v7" stroke="#b5895e" stroke-width="3" />
            <path
              d="M-7-8q-9-7-8-12"
              stroke="#c69b6b"
              stroke-width="3"
              fill="none"
              class="daily-tail"
            />
            <ellipse cx="5" cy="-12" rx="2" ry="5" fill="#96724f" />
            <circle cx="10" cy="-14" r="1" fill="#484637" />
            <circle cx="15" cy="-10" r="1.5" fill="#484637" />
          </g>
        </g>
        <g v-if="population > 0" class="resident-walk resident-one" color="#ac7259">
          <use :href="`#${uid}-person`" />
        </g>
        <g v-if="population > 0" class="resident-walk resident-two" color="#718c87">
          <use :href="`#${uid}-person`" />
        </g>
        <g v-if="population > 2" class="resident-walk resident-three" color="#9a8b58">
          <use :href="`#${uid}-person`" />
        </g>
        <g
          v-if="population > 2"
          :transform="`translate(${mapPoint(atPlot('home', 1, 2)).join(' ')})`"
          color="#a97777"
        >
          <use :href="`#${uid}-person`" />
        </g>
        <g
          v-if="town.buildings.farm"
          :transform="`translate(${mapPoint(atPlot('farm', 1.4, 2)).join(' ')})`"
          color="#87945b"
        >
          <use :href="`#${uid}-person`" />
        </g>
        <g
          v-if="town.buildings.saloon"
          :transform="`translate(${mapPoint(atPlot('saloon', 0.8, 2)).join(' ')})`"
          color="#8c7891"
        >
          <use :href="`#${uid}-person`" />
        </g>
        <g
          v-if="town.buildings.sheriff"
          class="resident-walk sheriff-walk"
          :style="{ offsetPath: sheriffPath }"
          color="#315d83"
        >
          <g transform="scale(1.3)">
            <use :href="`#${uid}-person`" />
            <path d="m-2-15 1 2 2 .3-1.5 1.5.4 2-1.9-1-1.9 1 .4-2L-5-12.7l2-.3Z" fill="#ffd15b" />
          </g>
        </g>
        <g
          v-if="town.buildings.stable && !motorTraffic(town)"
          :transform="`translate(${mapPoint(PLOTS.stable).join(' ')}) scale(.48) translate(-735 -455)`"
        >
          <g transform="translate(802 461)">
            <g :class="{ 'horse-idle': !motorTraffic(town) }">
              <use :href="`#${uid}-${motorTraffic(town) ? 'car' : 'horse'}`" />
            </g>
          </g>
          <g transform="translate(852 487) scale(.8)">
            <use :href="`#${uid}-${motorTraffic(town) ? 'car' : 'horse'}`" />
          </g>
          <g v-if="!motorTraffic(town)" transform="translate(887 446)">
            <path d="m-16-23 40 7v20l-40-7Z" fill="#a48556" />
            <path d="m24-16 12-8v20L24 4Z" fill="#7d704c" />
            <path d="m-16-23 12-8 40 7-12 8Z" fill="#d1bc8b" />
            <circle cx="-7" cy="0" r="10" fill="#625842" />
            <circle cx="21" cy="7" r="10" fill="#625842" />
            <path d="M-7-7V7m-7-7H0m21 0v14m-7-7h14" stroke="#c5ac78" stroke-width="2" />
          </g>
        </g>
        <g transform="translate(68 600)" fill="none" stroke="#9b9e77" opacity=".75">
          <circle r="24" />
          <path d="M0-32V32M-32 0H32" />
          <path d="M0-20-5 8 0 4 5 8Z" fill="#89936f" />
          <text
            y="-40"
            text-anchor="middle"
            stroke="none"
            fill="#7e8766"
            font-family="Georgia"
            font-size="13"
          >
            N
          </text>
        </g>
      </g>
    </svg>
  </div>
</template>
<script setup>
import { eraEvolution } from '../../data/eras';
import { isCityEra } from '../../data/city';

import { t } from '../../i18n';
import { hasElectricity, ELECTRIC_LAMPS } from '../../data/industrial';
import {
  pavedTown,
  modernTransport,
  motorTraffic,
  powerGrid,
  roadSurface,
} from '../../game/town/TownEvolution';
import { computed, nextTick, ref, useId, watch } from 'vue';
import {
  nextGoal,
  constructionVisual,
  constructionReady,
  availablePurchases,
  buildingIndicators,
  plotUnlocked,
} from '../../game/town/TownRules';
import { BUILDINGS } from '../../data/town';
import {
  PLOTS,
  townTracks,
  railEdges,
  visiblePlots,
  mapPoint,
  atPlot,
  SHERIFF_PATROL,
} from '../../game/town/TownLayout';
import TownSite from './TownSite.vue';
import { RIVER, riverOutline, riverCenterX } from '../../game/town/TownRiver';
import TownMine from './TownMine.vue';
import { townIndicatorScale } from '../../data/townIndicators';
const props = defineProps({
  town: { type: Object, required: true },
  builderHammers: { type: Number, default: 0 },
  forgeCollectible: Boolean,
  now: { type: Number, default: Date.now },
  selected: String,
  population: Number,
  fullscreen: Boolean,
  reducedMotion: Boolean,
  paused: Boolean,
  nextLevel: { type: Number, required: true },
  construction: Object,
});
defineEmits(['select', 'mine']);
const scene = ref(null);
const grid = computed(() => powerGrid(props.town));
const powerPoint = ([x, y, z]) => {
  const point = mapPoint([x, z]);
  return [point[0], point[1] - y * 13];
};
const powerWire = ({ from, to }) => {
  const a = powerPoint(from),
    b = powerPoint(to);
  return `M${a}Q${(a[0] + b[0]) / 2} ${(a[1] + b[1]) / 2 + 8} ${b}`;
};
const animatedConstruction = ref(null);
watch(
  () => props.construction,
  (construction) => {
    animatedConstruction.value = props.reducedMotion ? null : construction;
  },
  { immediate: true },
);
watch(
  () => props.reducedMotion,
  (reduced) => {
    if (reduced) animatedConstruction.value = null;
  },
);
const sheriffPath = `path("M${SHERIFF_PATROL.map((point) => mapPoint(point).join(' ')).join(' L')} Z")`;
const mapWidth = computed(() =>
  Math.max(1370, ...visiblePlots(props.town).map(({ position }) => mapPoint(position)[0] + 120)),
);
const mapLeft = computed(() =>
  Math.min(0, ...visiblePlots(props.town).map(({ position }) => mapPoint(position)[0] - 120)),
);
const land = computed(() => {
  const north = Math.min(
    95,
    ...visiblePlots(props.town).map(({ position }) => mapPoint(position)[1] - 60),
  );
  return `M${mapLeft.value} ${north}Q197 ${north - 20} 401 ${north + 5}T${mapWidth.value} ${north - 10}V650L550 730 ${mapLeft.value} 650Z`;
});
function resetView() {
  scene.value?.style.removeProperty('--look-x');
  scene.value?.style.removeProperty('--look-y');
}
function lookAround(event) {
  if (event.pointerType !== 'mouse' || props.paused || props.reducedMotion || props.fullscreen)
    return;
  const bounds = event.currentTarget.getBoundingClientRect();
  scene.value.style.setProperty(
    '--look-x',
    ((event.clientX - bounds.left) / bounds.width - 0.5).toFixed(3),
  );
  scene.value.style.setProperty(
    '--look-y',
    ((event.clientY - bounds.top) / bounds.height - 0.5).toFixed(3),
  );
}
watch(() => props.paused || props.reducedMotion, resetView);
watch(
  () => props.fullscreen,
  async (open) => {
    resetView();
    await nextTick();
    if (scene.value)
      scene.value.scrollLeft = open ? (scene.value.scrollWidth - scene.value.clientWidth) / 2 : 0;
  },
);
const hasIncome = (id) => indicators.value[id] === 'coins';
const suggestedId = computed(() => nextGoal(props.town)?.id);
const indicators = computed(() =>
  buildingIndicators(props.town, props.forgeCollectible, props.now),
);
const availableIds = computed(() =>
  availablePurchases(props.town, props.builderHammers).map(({ id }) => id),
);
const uid = `town-${useId().replaceAll(':', '')}`;
const orderedBuildings = computed(() =>
  BUILDINGS.filter((b) => plotUnlocked(props.town, b.id))
    .map((b) => {
      const [x, y] = mapPoint(PLOTS[b.id]);
      return { ...b, x, y };
    })
    .sort((a, b) => a.y - b.y),
);
const trees = [
  [45, 230, 0.85],
  [85, 180, 0.65],
  [944, 175, 0.9],
  [971, 260, 0.7],
  [38, 420, 0.75],
  [55, 535, 0.9],
  [850, 627, 0.8],
  [926, 585, 0.95],
  [220, 660, 0.65],
  [785, 685, 0.7],
];
const cacti = [
  [40, 330],
  [960, 380],
  [315, 670],
  [690, 681],
];
</script>
<style scoped>
/* Scenery can overlap buildings visually without intercepting their clicks. */
.town-diorama > g[aria-hidden='true'] {
  pointer-events: none;
}
.daily-hen {
  animation: daily-peck 8s ease-in-out infinite;
}
.daily-dog {
  animation: daily-stroll 22s ease-in-out infinite;
}
.daily-tail {
  transform-box: fill-box;
  transform-origin: bottom right;
  animation: daily-wag 0.6s ease-in-out infinite alternate;
}
@keyframes daily-peck {
  0%,
  100% {
    transform: translate(0, 0);
  }
  35%,
  65% {
    transform: translate(12px, 2px);
  }
  45%,
  55% {
    transform: translate(12px, 3px) rotate(12deg);
  }
}
@keyframes daily-stroll {
  0%,
  100% {
    transform: translate(0, 0);
  }
  35%,
  55% {
    transform: translate(28px, 4px);
  }
  75% {
    transform: translate(12px, 8px);
  }
}
@keyframes daily-wag {
  to {
    transform: rotate(25deg);
  }
}
.town-site-assembling {
  animation: town-assemble 1s ease-out both;
}
.town-build-hammer {
  transform-box: fill-box;
  transform-origin: bottom right;
  animation: town-hammer-tap 1s ease-in-out both;
}
@keyframes town-assemble {
  0% {
    clip-path: inset(100% 0 0);
    transform: translateY(-12px);
  }
  75%,
  100% {
    clip-path: inset(0);
    transform: translateY(0);
  }
}
@keyframes town-hammer-tap {
  0%,
  22%,
  44% {
    opacity: 1;
    transform: rotate(-35deg);
  }
  11%,
  33%,
  55% {
    opacity: 1;
    transform: rotate(15deg);
  }
  75%,
  100% {
    opacity: 0;
    transform: rotate(-35deg);
  }
}
.town-map-paused .town-site-assembling,
.town-map-paused .town-build-hammer {
  animation-play-state: paused;
}
</style>

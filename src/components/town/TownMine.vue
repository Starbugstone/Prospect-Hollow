<template>
  <g
    class="town-mine-entrance"
    :data-era="era"
    :role="decorative ? undefined : 'button'"
    :tabindex="decorative ? undefined : 0"
    :aria-label="t('Enter the mine: play level {value0}', { value0: level })"
    @click="$emit('enter')"
    @keydown.enter.prevent="$emit('enter')"
    @keydown.space.prevent="$emit('enter')"
  >
    <rect
      class="mine-hit-area"
      x="-96"
      y="-54"
      width="192"
      height="172"
      rx="25"
      fill="transparent"
    />
    <g aria-hidden="true">
      <g :stroke="appearance.frame" stroke-width="5" fill="none" transform="translate(-114 5)">
        <path
          :d="`M-21 42V${-appearance.height * 13}H21V42M-21 38 21 ${-appearance.height * 13 + 8}M21 38-21 ${-appearance.height * 13 + 8}`"
        />
        <circle :cy="-appearance.height * 13" r="10" :fill="appearance.roof" />
        <path
          v-if="appearance.height >= 4.8"
          :d="`M-27 ${-appearance.height * 13 - 13}H27`"
          :stroke="appearance.roof"
          stroke-width="8"
        />
        <path v-if="appearance.machine !== 'hand'" d="M-40 43V8H-10v35Z" :fill="appearance.wall" />
        <path v-if="appearance.machine === 'digital'" d="M-44 4-35-5-6-1-12 8Z" fill="#526f79" />
      </g>
      <g v-if="stage >= 6" stroke="#91714f" stroke-width="6" fill="none"
        ><path d="M-80 40V-90M80 40V-90" /><path v-if="stage >= 7" d="M-85-90H85" /><path
          v-if="stage >= 9"
          d="M-92-96H92"
          stroke="#6c8b7b"
          stroke-width="13"
      /></g>
      <ellipse cy="68" rx="101" ry="20" fill="#625037" opacity=".22" />
      <path d="M-105 57-87 1-56-38-7-53 49-32 78 8 106 58 27 78Z" fill="#aa9c77" />
      <path d="m-105 57 49-95 16 44-15 51Zm98-110 33 55 52 6-29-40Z" fill="#c7b58c" />
      <path d="m27 78 21-77 30 7 28 50Z" fill="#807d5e" />
      <path d="M-43 61V-6l42-20 48 24v68Z" fill="#4b4939" />
      <path d="M-30 60V1L1-13 34 4v59Z" fill="#262e2a" />
      <path
        d="M-47 61V-9M46 64V-5M-50-9 1-31 50-6"
        fill="none"
        stroke="#735137"
        stroke-width="12"
      />
      <path
        d="M-50 58V-10M43 60V-5M-49-13 1-34 48-10"
        fill="none"
        stroke="#b8945f"
        stroke-width="4"
      />
      <path d="m-42 8 18-21M39 11 24-14" stroke="#97774b" stroke-width="6" />
      <path d="M-13 29-28 86M13 31 33 90" stroke="#6b6655" stroke-width="4" />
      <path d="m-19 48 40 3m-43 11 47 3m-51 11 56 4" stroke="#9b7d50" stroke-width="5" />
      <g class="mine-cart">
        <path d="m-16 36 30 3 8-5-29-4Z" fill="#b0a686" />
        <path d="m-16 36 30 3-2 21-26-3Z" fill="#65777a" />
        <path d="m14 39 8-5-2 20-8 6Z" fill="#42585a" />
        <path d="m-9 34 4-9 8 4 6-7 9 9-5 6Z" fill="#ae83b4" />
        <path d="m-5 25 3 10 5-6m6-7 1 13 7-4" fill="#dabbe2" />
        <circle cx="-8" cy="59" r="5" fill="#3d4339" /><circle
          cx="9"
          cy="62"
          r="5"
          fill="#3d4339"
        />
      </g>
      <g transform="translate(-58 12)">
        <ellipse class="mine-lantern-glow" cy="5" rx="22" ry="25" fill="#ffcf70" opacity=".22" />
        <path d="M-6-4H6V12H-6Z" fill="#efc575" stroke="#69593b" stroke-width="3" />
        <path d="M-4-5v-6h8v6" fill="none" stroke="#69593b" stroke-width="2" />
      </g>
      <g
        v-for="n in stage"
        :key="n"
        :transform="`translate(${(n % 2 ? -1 : 1) * (68 + Math.floor((n - 1) / 12) * 20)} ${48 - Math.floor(((n - 1) % 12) / 2) * 19})`"
      >
        <path
          d="M0-12 8-3 5 9-5 9-8-3Z"
          :fill="['#d4a3de', '#7abcea', '#8ad9b7', '#eacf80', '#e8a7c3'][(n - 1) % 5]"
          stroke="#f6e9c6"
          stroke-width="1.5"
        />
      </g>
      <path
        v-if="stage >= 2"
        d="M-48 20h13m69 0h14M-48 49h13m69 0h14"
        stroke="#b9c8c0"
        stroke-width="7"
      />
      <path v-if="stage >= 5" d="M-67-38H65" stroke="#6c8b7b" stroke-width="12" />
      <g v-if="eraEvolution(era).style === 'river-rail'">
        <rect x="-85" y="4" width="24" height="48" rx="8" fill="#8e7860" />
        <path d="M-73 8V-53M-52 57V-27H52V57" fill="none" stroke="#68887c" stroke-width="10" />
      </g>
      <g v-else-if="eraEvolution(era).modernTransport">
        <path
          d="M-51 60V-41H51V60"
          fill="none"
          :stroke="eraEvolution(era).motorMine ? '#ddcca8' : '#9ba89a'"
          stroke-width="15"
        />
        <path d="M-51 3V-14M51 3V-14" stroke="#ffebad" stroke-width="8" />
        <path
          v-if="eraEvolution(era).motorMine"
          d="M-65-27H65M-28-53H28"
          stroke="#648e8b"
          stroke-width="10"
        />
        <g v-else
          ><rect x="-84" y="4" width="23" height="39" fill="#859990" /><path
            d="m-73 12-5 11h9l-6 12"
            stroke="#edcf79"
            fill="none"
            stroke-width="3"
        /></g>
      </g>
      <g v-if="eraEvolution(era).digitalCity" stroke="#638b88" stroke-width="4">
        <path d="M-68-98-39-111 73-84 47-69Z" fill="#8cb1ae" />
        <path d="M-53-99 57-75m-82-33 84 22" stroke="#526f79" />
      </g>
      <path
        v-if="stage >= 10"
        d="M0-128 15-112 0-96-15-112Z"
        fill="#f1d178"
        stroke="#fff3bb"
        stroke-width="3"
      />
      <g v-if="!decorative" class="mine-label" transform="translate(0 103)">
        <rect
          x="-93"
          y="-17"
          width="186"
          height="35"
          rx="17"
          fill="#e1f0c0"
          stroke="#e7d1a0"
          stroke-width="2"
        />
        <text y="6" text-anchor="middle" fill="#405b35" font-family="Georgia, serif" font-size="18">
          {{ t('Mine · Level') }} {{ level }} →</text
        >
      </g>
    </g>
  </g>
</template>
<script setup>
import { eraEvolution } from '../../data/eras';
import { computed } from 'vue';
import { mineAppearance } from '../../data/mineEvolution';
import { t } from '../../i18n';
const props = defineProps({
  level: { type: Number, default: 1 },
  decorative: Boolean,
  stage: { type: Number, default: 0 },
  era: { type: String, default: 'frontier' },
});
const appearance = computed(() => mineAppearance(props.era));
defineEmits(['enter']);
</script>

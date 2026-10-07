<template>
  <svg viewBox="0 0 160 130" aria-hidden="true" class="personal-design-art">
    <defs>
      <linearGradient :id="gradient" x2="0" y2="1">
        <stop stop-color="#f7f0dc" />
        <stop offset="1" stop-color="#dbe6d1" />
      </linearGradient>
    </defs>
    <rect width="160" height="130" rx="12" :fill="`url(#${gradient})`" />
    <ellipse cx="80" cy="114" rx="69" ry="10" fill="#bac7af" />
    <path d="M19 108 80 95 142 108 80 125Z" :fill="paint.walls || '#ddd1b5'" stroke="#91785e" />
    <g
      :fill="option.colour"
      :stroke="paint.trim || '#655343'"
      stroke-width="1.5"
      stroke-linejoin="round"
    >
      <template v-if="form === 'arch'">
        <path d="M35 109V48h20v61ZM105 109V48h20v61Z" />
        <path d="M47 50a33 33 0 0 1 66 0H99a19 19 0 0 0-38 0Z" />
        <circle cx="80" cy="17" r="8" :fill="paint.accent || '#cc954f'" />
      </template>
      <template v-else-if="form === 'crystal'">
        <path
          d="m70 109-7-72 17-27 17 27-7 72ZM39 109 27 65 40 48 53 69 58 114ZM103 111l-2-57 16-17 15 24-10 48Z"
        />
        <path d="M80 10v101M40 48l8 64M117 37l-5 73" fill="none" stroke="#ded4f0" />
      </template>
      <template v-else-if="form === 'guardian'">
        <path d="M59 100 25 47l10-13 30 21M101 100l34-53-10-13-30 21" />
        <path d="M58 95 51 46 54 22l20 15h12l20-15 3 24-7 49Z" />
        <circle cx="66" cy="53" r="12" fill="#f4ead5" />
        <circle cx="94" cy="53" r="12" fill="#f4ead5" />
        <circle cx="66" cy="53" r="5" fill="#655343" />
        <circle cx="94" cy="53" r="5" fill="#655343" />
        <path d="m74 65 6 12 6-12Z" fill="#655343" />
        <path d="M55 113V96h50v17" fill="#91785e" />
      </template>
      <template v-else-if="form === 'tree'">
        <path
          d="M74 113V61L42 40m38 41 36-31M80 62V24"
          fill="none"
          stroke="#b77839"
          stroke-width="9"
        />
        <ellipse cx="45" cy="41" rx="30" ry="20" />
        <ellipse cx="111" cy="44" rx="29" ry="23" />
        <ellipse cx="80" cy="25" rx="30" ry="21" />
        <path d="M39 115h82" stroke="#cc954f" stroke-width="5" />
      </template>
      <template v-else-if="form === 'orrery'">
        <path d="M54 112V86h52v26" :fill="paint.walls || '#ddd1b5'" />
        <circle cx="80" cy="54" r="18" />
        <g fill="none" stroke="#cc954f" stroke-width="4">
          <ellipse cx="80" cy="54" rx="51" ry="19" transform="rotate(-28 80 54)" />
          <ellipse cx="80" cy="54" rx="21" ry="49" transform="rotate(-25 80 54)" />
          <ellipse cx="80" cy="54" rx="48" ry="30" transform="rotate(33 80 54)" />
        </g>
        <circle cx="127" cy="36" r="6" :fill="paint.accent || '#cc954f'" />
      </template>
      <template v-else-if="['rotunda', 'dome'].includes(form)">
        <path d="M35 109V61h90v48Z" :fill="paint.walls || '#ddd1b5'" />
        <path v-if="form === 'rotunda'" d="m24 62 56-39 56 39Z" />
        <path v-else d="M27 62a53 42 0 0 1 106 0Z" />
        <path
          d="M39 64v45M56 64v49M80 64v51M104 64v49M121 64v45"
          stroke="#91785e"
          stroke-width="5"
        />
        <path
          v-if="form === 'dome'"
          d="m89 33 21-18"
          :stroke="paint.trim || '#655343'"
          stroke-width="8"
        />
      </template>
      <template v-else-if="['hall', 'arcade'].includes(form)">
        <path d="M19 108V56h47v49M94 105V56h47v52" :fill="paint.walls || '#ddd1b5'" />
        <path d="m13 58 29-29 30 29ZM88 58l30-29 30 29Z" />
        <path d="M14 85h132v10H14Z" />
        <path d="M23 96v16M49 96v16M80 96v16M112 96v16M138 96v16" stroke-width="5" />
        <path
          d="M27 62h11v16H27ZM47 62h11v16H47ZM102 62h11v16h-11ZM122 62h11v16h-11Z"
          fill="#a0ccc4"
        />
      </template>
      <template v-else-if="form === 'glass'">
        <path d="M18 109V69h34v40M108 109V69h34v40M50 111V52h60v59" fill="#a0ccc4" />
        <path d="M13 69a22 23 0 0 1 44 0ZM103 69a22 23 0 0 1 44 0ZM46 52a34 35 0 0 1 68 0Z" />
        <path
          d="M24 72v36M46 72v36M61 57v55M80 54v61M99 57v55M117 72v36M136 72v36"
          stroke-width="3"
        />
      </template>
      <template v-else-if="form === 'theatre'">
        <path d="m30 75-7-44 17-9 19 25 9-33h24l9 33 19-25 17 9-7 44Z" />
        <path
          d="M25 92q55 24 110 0v14q-55 24-110 0ZM35 82q45 19 90 0v10q-45 23-90 0Z"
          :fill="paint.walls || '#ddd1b5'"
        />
        <path d="M48 74h64v10H48Z" fill="#91785e" />
      </template>
      <template v-else-if="form === 'wing'">
        <path d="M29 111V60h102v51Z" fill="#a0ccc4" />
        <path d="m14 41 42 18V46l48 7 42-24-11 38-36 7-47-10-30 4Z" />
        <path d="M32 67v44M80 69v45M128 70v41" stroke-width="4" />
      </template>
      <template v-else-if="form === 'terraces'">
        <path
          d="M22 110V85h116v25ZM35 84V61h90v23ZM48 60V39h64v21ZM60 38V18h40v20Z"
          :fill="paint.walls || '#ddd1b5'"
        />
        <path d="M18 85h124M31 61h98M44 39h72M56 18h48" stroke-width="6" :stroke="option.colour" />
        <path d="M23 78h15v7H23ZM116 78h15v7h-15ZM38 54h13v7H38ZM109 54h13v7h-13Z" fill="#8caf80" />
      </template>
      <template v-else-if="form === 'kites'">
        <path d="m66 110 10-78h8l10 78M70 80h20M73 56h14" fill="none" stroke-width="4" />
        <path d="M80 32 46 16M80 32l40-14M80 32l-6-26" fill="none" stroke-width="1" />
        <path d="m46 6 9 10-9 10-9-10Z" />
        <path d="m120 8 9 10-9 10-9-10Z" fill="#4fa3a5" />
        <path d="m74 -4 9 10-9 10-9-10Z" fill="#e57f62" transform="translate(0 6)" />
      </template>
      <template v-else-if="form === 'lanterns'">
        <path d="M44 110V68M64 110V68M96 110V68M116 110V68" stroke-width="5" />
        <path d="m36 70 44-26 44 26Z" />
        <rect
          v-for="[x, y] in [
            [52, 30],
            [78, 18],
            [104, 28],
            [66, 8],
          ]"
          :key="x"
          :x="x"
          :y="y"
          width="10"
          height="12"
          rx="3"
          fill="#f5ddb0"
        />
      </template>
      <template v-else-if="form === 'organ'">
        <path d="M28 110V94h104v16Z" :fill="paint.walls || '#ddd1b5'" />
        <rect
          v-for="(h, n) in [26, 40, 52, 62, 66, 62, 52, 40, 26]"
          :key="n"
          :x="36 + n * 10"
          :y="94 - h"
          width="7"
          :height="h"
          :fill="n % 2 ? option.colour : paint.walls || '#ddd1b5'"
        />
        <path d="m20 56 20-6 4 26-20 4ZM140 56l-20-6-4 26 20 4Z" fill="#f7efe0" />
      </template>
      <template v-else-if="form === 'orbits'">
        <ellipse cx="80" cy="102" rx="56" ry="10" fill="#8caf80" />
        <path d="M80 102V40" stroke-width="4" />
        <circle cx="80" cy="34" r="12" fill="#cc954f" />
        <ellipse cx="80" cy="46" rx="44" ry="10" fill="none" stroke-width="2" />
        <circle cx="122" cy="48" r="6" fill="#9c86d0" />
        <circle cx="44" cy="44" r="5" fill="#5fb8a8" />
      </template>
      <template v-else-if="form === 'comet'">
        <path d="M40 110V64a40 40 0 0 1 80 0v46h-12V64a28 28 0 0 0-56 0v46Z" />
        <circle cx="116" cy="20" r="9" fill="#fff3c8" />
        <circle
          v-for="n in 5"
          :key="n"
          :cx="116 - n * 11"
          :cy="20 + n * 4"
          :r="7 - n"
          fill="#cc954f"
        />
      </template>
      <template v-else-if="form === 'aurora'">
        <path d="M34 110V92h92v18Z" :fill="paint.walls || '#ddd1b5'" />
        <path d="M38 92a42 40 0 0 1 84 0Z" fill="#a0ccc4" />
        <path
          d="M44 40q16-30 30 0M70 30q16-30 30 0M96 40q16-30 30 0"
          fill="none"
          stroke-width="7"
        />
      </template>
      <template v-else-if="form === 'rocket'">
        <path d="M70 108V40h20v68Z" fill="#f4efe4" />
        <path d="m70 40 10-26 10 26Z" />
        <path d="m70 108-10 4v-20l10-6ZM90 108l10 4v-20l-10-6Z" />
        <path d="M112 110V20M112 40 92 52M112 64 92 76M112 88 92 98" fill="none" stroke-width="3" />
      </template>
      <template v-else-if="form === 'chapel'">
        <path d="M46 110V58h68v52Z" :fill="paint.walls || '#ddd1b5'" />
        <path d="m40 60 40-30 40 30Z" />
        <circle cx="80" cy="54" r="9" fill="#f4efe4" />
        <circle cx="84" cy="52" r="7" :fill="paint.walls || '#ddd1b5'" />
        <path d="M72 110V84h16v26Z" fill="#655343" />
        <path d="M72 30V16h16v14Zm-2-14 10-12 10 12Z" />
      </template>
      <template v-else-if="form === 'sundial'">
        <ellipse cx="80" cy="96" rx="50" ry="14" :fill="paint.walls || '#ddd1b5'" />
        <ellipse cx="80" cy="92" rx="44" ry="11" />
        <path d="M80 92 80 46 104 92Z" fill="#cc954f" />
        <circle
          v-for="(x, n) in [26, 54, 106, 134]"
          :key="x"
          :cx="x"
          cy="72"
          :r="4 + n"
          fill="#f4efe4"
        />
      </template>
      <template v-else-if="form === 'lantern-walk'">
        <g v-for="x in [42, 66, 94, 118]" :key="x">
          <path :d="`M${x} 110V54`" stroke-width="3" />
          <circle :cx="x - 5" cy="52" r="5" />
          <circle :cx="x + 5" cy="52" r="5" fill="#f0c45a" />
        </g>
        <path d="M40 44q40-34 80 0" fill="none" stroke-width="5" />
      </template>
      <template v-else-if="form === 'globes'">
        <ellipse cx="80" cy="100" rx="50" ry="12" :fill="paint.walls || '#ddd1b5'" />
        <ellipse cx="80" cy="96" rx="44" ry="9" fill="#7fc0d0" />
        <path d="M62 96V56M104 96V66" stroke-width="4" />
        <circle cx="62" cy="40" r="16" />
        <path d="M54 34q8-6 14 2" fill="none" stroke="#8caf80" stroke-width="5" />
        <circle cx="104" cy="56" r="11" fill="#f1eee6" />
      </template>
      <template v-else-if="form === 'welcome-arch'">
        <path d="M34 110V28h14v82ZM112 110V28h14v82Z" :fill="paint.walls || '#ddd1b5'" />
        <path d="M28 20h104v14H28Z" />
        <path d="M50 54h4v26h-4ZM106 54h4v26h-4Z" />
        <circle cx="72" cy="12" r="7" fill="#4f8fc7" />
        <circle cx="88" cy="12" r="5" fill="#f1eee6" />
        <path d="M60 106h40v-8H60Z" fill="#b88757" />
      </template>
      <template v-else>
        <path
          v-if="form === 'spire'"
          d="m48 113 26-95h12l26 95M59 80h42M67 51h26"
          fill="none"
          stroke-width="5"
        />
        <path
          v-else
          d="M54 112V77h52v35ZM59 77V48h42v29ZM64 48V22h32v26Z"
          :fill="paint.walls || '#ddd1b5'"
        />
        <template v-if="form === 'clock'">
          <circle cx="80" cy="36" r="12" fill="#fff8e8" />
          <path d="M80 27v10l7 4" fill="none" />
        </template>
        <path
          v-else-if="form === 'windmill'"
          d="m53 14 54 54M53 68l54-54"
          stroke="#91785e"
          stroke-width="8"
        />
        <template v-else>
          <ellipse cx="80" cy="27" rx="25" ry="8" />
          <ellipse cx="80" cy="64" rx="27" ry="8" fill="none" stroke-width="4" />
        </template>
        <path d="m57 22 23-15 23 15Z" />
      </template>
    </g>
  </svg>
</template>
<script setup>
import { computed, useId } from 'vue';
import { LANDMARK_BY_ID } from '../../data/townLandmarks';
const props = defineProps({
  choice: { type: String, required: true },
  paint: { type: Object, default: () => ({}) },
});
const option = computed(() => ({
  ...LANDMARK_BY_ID[props.choice],
  colour: props.paint?.roof || LANDMARK_BY_ID[props.choice].colour,
}));
const form = computed(() => option.value.form);
const gradient = useId();
</script>

<template>
  <svg viewBox="0 0 100 120" role="img" :aria-label="t('Town crest')">
    <defs>
      <clipPath :id="clip"><path :d="crestOutline(crest.shape)" /></clipPath>
    </defs>
    <g :clip-path="`url(#${clip})`">
      <path :d="crestOutline(crest.shape)" :fill="crest.primary" />
      <path :d="crestPattern(crest.pattern)" :fill="crest.secondary" />
      <circle cx="50" cy="53" r="32" fill="#fff8e8" />
      <path
        :d="CREST_BY_ID[crest.emblem]?.path"
        transform="translate(22 25) scale(2.3333)"
        fill="none"
        :stroke="crest.emblemColour || DEFAULT_EMBLEM_COLOUR"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </g>
    <path :d="crestOutline(crest.shape)" fill="none" stroke="#655343" stroke-width="2" />
  </svg>
</template>
<script setup>
import { useId } from 'vue';
import { DEFAULT_EMBLEM_COLOUR } from '../../data/townPersonalisation';
import { t } from '../../i18n';
import { CREST_BY_ID, crestOutline, crestPattern } from '../../data/townCrests';
defineProps({ crest: { type: Object, required: true } });
const clip = `town-crest-${useId()}`;
</script>

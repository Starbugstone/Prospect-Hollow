<template>
  <main class="frontier-landing">
    <section class="landing-hero" aria-labelledby="landing-title">
      <div class="landing-copy">
        <h1 id="landing-title">Prospect Hollow</h1>
        <p class="landing-intro">
          {{ t('Match gems in the mine and build your village with the coins you earn.') }}
        </p>
        <button class="town-primary landing-enter" @click="$emit('enter')">
          {{ t('Play') }}
          <TownIcon name="arrow" />
        </button>
      </div>
      <div class="landing-vista" aria-hidden="true" inert>
        <svg viewBox="0 0 700 590" fill="none">
          <defs>
            <linearGradient id="frontier-sky" x2="0" y2="1">
              <stop stop-color="#e9ebdc" />
              <stop offset="1" stop-color="#f2ddae" />
            </linearGradient>
            <linearGradient id="frontier-ground" x2="0" y2="1">
              <stop stop-color="#c4c394" />
              <stop offset="1" stop-color="#e4cf9d" />
            </linearGradient>
          </defs>
          <rect width="700" height="590" rx="220" fill="url(#frontier-sky)" />
          <circle cx="485" cy="103" r="49" fill="#faf0c9" />
          <path d="M0 241Q113 109 259 192T508 184 700 200V590H0Z" fill="#bbc5a4" />
          <path d="M0 308Q122 181 274 256T553 235 700 269V590H0Z" fill="#aab99a" />
          <path d="M0 348Q169 245 320 310T700 296V590H0Z" fill="url(#frontier-ground)" />
          <path d="M295 278Q386 330 328 373T443 590" stroke="#f1dfb3" stroke-width="33" />
          <path d="M91 426Q248 377 524 420" stroke="#f1dfb3" stroke-width="20" />
          <g transform="translate(344 294) scale(.48)"><TownMine decorative /></g>
          <g transform="translate(192 410) scale(.87)"><TownBuilding id="home" :stage="1" /></g>
          <g transform="translate(485 396) scale(.8)"><TownBuilding id="farm" :stage="1" /></g>
          <g transform="translate(335 457) scale(.62)"><TownBuilding id="well" :stage="1" /></g>
          <g
            v-for="tree in trees"
            :key="tree[0]"
            :transform="`translate(${tree[0]} ${tree[1]}) scale(${tree[2]})`"
          >
            <ellipse cy="10" rx="35" ry="10" fill="#718161" opacity=".18" />
            <path
              d="M0 7 2-76M1-29-20-56M1-45 22-70"
              stroke="#97805b"
              stroke-width="7"
              stroke-linecap="round"
            />
            <path
              d="M-36-50Q-51-83-22-96-23-117 5-120 33-120 39-100 61-90 42-60 20-42 8-58-17-34-36-50Z"
              fill="#869d74"
            />
            <path d="M-30-94Q-16-119 5-120 36-120 39-100 19-107 11-82-9-72-30-94Z" fill="#b3c294" />
            <path d="M-36-50Q-51-76-36-89-37-61-11-63 0-47 8-58-17-34-36-50Z" fill="#728c65" />
          </g>
          <g fill="#a4aa77">
            <path
              v-for="i in 16"
              :key="i"
              :transform="`translate(${45 + ((i * 89) % 620)} ${472 + ((i * 31) % 92)})`"
              d="M0 0-4-11 2-3 6-14 4 1Z"
            />
          </g>
        </svg>
        <span class="vista-caption"
          >PROSPECT HOLLOW <small>{{ t('Your story starts here') }}</small></span
        >
        <img class="landing-crystal" src="/art/amethyst.svg" alt="" />
      </div>
    </section>
    <footer class="landing-footer">
      <span>PROSPECT HOLLOW</span
      ><span>{{ t(campaign.saveWarning || 'Your adventure is saved on this device.') }}</span>
    </footer>
  </main>
</template>
<script setup>
import { t } from '../i18n';
import { useCampaignStore } from '../stores/campaignStore';
import TownBuilding from './town/TownBuilding.vue';
import TownMine from './town/TownMine.vue';
import TownIcon from './town/TownIcon.vue';
import '../styles/landing.css';
defineEmits(['enter']);
const campaign = useCampaignStore();
const trees = [
  [83, 337, 0.8],
  [598, 311, 0.75],
  [604, 479, 1.05],
  [107, 527, 0.65],
  [442, 283, 0.45],
];
</script>

<template>
  <TownDialog
    :title="t('Welcome to Prospect Hollow')"
    close-label="Close guide"
    @close="$emit('close')"
  >
    <section class="town-tour" aria-live="polite">
      <p class="town-kicker">
        {{ t('Village tour · {step}/{total}', { step: index + 1, total: steps.length }) }}
      </p>
      <div class="town-tour-art">
        <svg viewBox="-165 -210 330 270" aria-hidden="true">
          <TownMine v-if="step.id === 'mine'" decorative :level="level" :era="era" />
          <TownBuilding v-else :id="step.id" :stage="step.stage || 1" />
        </svg>
      </div>
      <h2>{{ t(step.title) }}</h2>
      <p>{{ t(step.text) }}</p>
      <div class="town-tour-progress" aria-hidden="true">
        <i v-for="(_, n) in steps" :key="n" :class="{ active: n === index }"></i>
      </div>
      <div class="town-tour-actions">
        <button v-if="index" class="town-secondary" @click="index--">{{ t('Back') }}</button>
        <button class="town-primary" @click="index < steps.length - 1 ? index++ : $emit('build')">
          {{ t(index < steps.length - 1 ? 'Next' : 'Choose my first building') }} →
        </button>
      </div>
    </section>
  </TownDialog>
</template>
<script setup>
import { computed, ref } from 'vue';
import { t } from '../../i18n';
import TownDialog from './TownDialog.vue';
import TownBuilding from './TownBuilding.vue';
import TownMine from './TownMine.vue';
defineProps({ level: { type: Number, default: 1 }, era: { type: String, default: 'frontier' } });
defineEmits(['close', 'build']);
const index = ref(0);
const steps = [
  {
    id: 'well',
    title: 'Tap a plot to begin',
    text: 'Tap a building, or open Build to see every available plot with its cost and benefits. Your first building is free. A basic well, farm, or home opens immediately.',
  },
  {
    id: 'mine',
    title: 'The mine funds your village',
    text: 'Tap Mine at the bottom to play the next puzzle. Each completed puzzle earns coins and prepares every construction in progress; then tap each scaffolded building in the village to finish it. Each completed chapter gives the mine a free visual upgrade.',
  },
  {
    id: 'home',
    stage: 2,
    title: 'Care for your neighbors',
    text: 'Families need water, food, and room. The water, food and happiness readings at the top show what runs short; tap one to open the building that helps. Existing services stay open during upgrades; level 2 unlocks extra plots.',
  },
  {
    id: 'square',
    title: 'A happier village',
    text: 'The town square adds comfort and gains a raid warning bell at level 3. Happiness grows with comfort for the size of the town and falls when water or food run short; a happy town welcomes more visitors and earns more at the saloon.',
  },
  {
    id: 'saloon',
    title: 'Keep the village growing',
    text: 'The saloon stores up to five hours of earnings. Tap it to collect your coins. Open More to visit the museum and replay old puzzles. Rare builder hammers come from mine bonus chests and Frontier’s two starter projects, and build or improve an unlocked building instantly for free.',
  },
  {
    id: 'bank',
    title: 'Protect your savings',
    text: 'The bank and sheriff each protect up to half the coins at risk. Upgrade both as gangs grow for full protection. Your last 50 coins are always safe.',
  },
  {
    id: 'shop',
    title: 'Stock up for the next run',
    text: 'The shop sells a small random selection after each completed mine run. Upgrade it for more choice, and build the armory to raise storage from 3 to 5, 8, 12, 16, then 20 of each bonus. Tap a roulette to stop on the prize you want.',
  },
];
const step = computed(() => steps[index.value]);
</script>
<style scoped>
.town-tour {
  text-align: center;
}
.town-tour-art {
  height: 200px;
  background: radial-gradient(ellipse at bottom, #d7ddbc, #f1edde 70%);
  border-radius: 16px;
}
.town-tour-art svg {
  width: 100%;
  height: 100%;
}
h2 {
  font-family: Georgia, serif;
  font-size: 26px;
  margin: 22px 0 12px;
}
p {
  line-height: 1.65;
  font-size: 14px;
}
.town-tour-progress {
  display: flex;
  justify-content: center;
  gap: 7px;
  margin: 22px 0;
}
.town-tour-progress i {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #c8cbbb;
}
.town-tour-progress i.active {
  background: #506d5d;
  width: 24px;
  border-radius: 4px;
}
.town-tour-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
}
</style>

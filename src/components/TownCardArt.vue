<template>
  <div class="town-card-art" :style="hue === null ? null : { '--slot-hue': hue }">
    <img src="/art/amethyst.svg" alt="" />
    <span v-if="label" class="town-card-era">{{ label }}</span>
    <slot />
  </div>
</template>
<script setup>
import { computed } from 'vue';
import { eraHue, eraName } from './account/accountContext';

// The era landscape shared by the player's own town cards and shared-town cards: a
// header on wide screens, a square tile beside the details on phones.
const props = defineProps({ era: { type: String, default: '' } });
const hue = computed(() => eraHue(props.era));
const label = computed(() => eraName(props.era));
</script>
<style>
.town-card-art {
  --slot-hue: 90;
  position: relative;
  display: grid;
  place-items: center;
  height: 84px;
  border-radius: 15px 15px 0 0;
  background:
    radial-gradient(ellipse 70% 45% at 25% 100%, hsl(var(--slot-hue) 28% 58%) 98%, transparent),
    radial-gradient(ellipse 80% 50% at 85% 105%, hsl(var(--slot-hue) 32% 50%) 98%, transparent),
    linear-gradient(170deg, hsl(calc(var(--slot-hue) + 10) 45% 90%), hsl(var(--slot-hue) 35% 76%));
  overflow: hidden;
}
.town-card-art img {
  width: 2.4rem;
  height: 2.4rem;
  filter: drop-shadow(0 4px 6px #18383240);
}
.town-card-era {
  position: absolute;
  left: 0.5rem;
  bottom: 0.45rem;
  max-width: calc(100% - 1rem);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: #183832d9;
  color: #fff7df;
  font-size: 0.7rem;
  font-weight: 600;
}
.town-card-era-mobile {
  display: none;
}
@media (max-width: 560px) {
  .town-card-era-mobile {
    display: block;
  }
  .town-card-art {
    height: 100%;
    min-height: 4.5rem;
    border-radius: 15px 0 0 15px;
  }
  .town-card-art img {
    width: 1.8rem;
    height: 1.8rem;
  }
  .town-card-era {
    display: none;
  }
}
</style>

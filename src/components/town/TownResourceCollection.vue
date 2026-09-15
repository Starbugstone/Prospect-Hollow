<template>
  <aside
    class="town-resource-collection"
    :class="{ still: reducedMotion, 'resource-tnt': resource === 'tnt' }"
    :style="{ left: `clamp(72px, ${origin.x}%, calc(100% - 72px))`, top: `${origin.y}%` }"
    role="status"
    aria-live="polite"
  >
    <div class="collection-particles" aria-hidden="true">
      <component
        :is="appearance.image ? 'img' : TownIcon"
        v-for="i in appearance.particles"
        :key="i"
        :name="appearance.icon"
        :src="appearance.image"
        alt=""
        :style="{
          '--drift': `${(i - (appearance.particles + 1) / 2) * 9}px`,
          '--delay': `${(i % 5) * 45}ms`,
        }"
      />
    </div>
    <strong aria-hidden="true"
      ><component
        :is="appearance.image ? 'img' : TownIcon"
        :name="appearance.icon"
        :src="appearance.image"
        alt=""
      />+{{ number(amount) }}{{ appearance.suffix }}</strong
    >
    <span class="town-sr-only">{{ t(appearance.message, { coins: number(amount) }) }}</span>
  </aside>
</template>
<script setup>
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { t, number } from '../../i18n';
import TownIcon from './TownIcon.vue';
const props = defineProps({
  amount: { type: Number, required: true },
  resource: { type: String, default: 'coins' },
  reducedMotion: Boolean,
  origin: { type: Object, default: () => ({ x: 50, y: 50 }) },
});
const resources = {
  coins: {
    icon: 'coin',
    particles: 10,
    cue: 'coin',
    message: 'Collected {coins} coins from the saloon!',
    suffix: '',
  },
  tnt: {
    image: '/art/powers/tnt.svg',
    particles: 5,
    cue: 'jackpot',
    message: 'Collected 1 TNT · added to your armory',
    suffix: ' TNT',
  },
};
const appearance = computed(() => resources[props.resource] ?? resources.coins);
const emit = defineEmits(['cue', 'close']);
const playCue = (index) => emit('cue', { name: appearance.value.cue, index });
const timers = [];
onMounted(() => {
  playCue(0);
  for (let i = 1; i < Math.min(5, props.amount); i++)
    timers.push(setTimeout(() => playCue(i), i * 110));
  timers.push(setTimeout(() => emit('close'), 1100));
});
onBeforeUnmount(() => timers.forEach(clearTimeout));
</script>
<style scoped>
.town-resource-collection {
  position: absolute;
  z-index: 7;
  transform: translate(-50%, -100%);
  color: #ffe28a;
  pointer-events: none;
}
strong {
  display: flex;
  align-items: center;
  gap: 4px;
  font:
    900 24px/1.2 'Outfit',
    sans-serif;
  text-shadow:
    0 2px 3px #533812,
    0 0 5px #533812;
  animation: collection-pop 1100ms ease-out both;
}
strong :is(svg, img) {
  width: 22px;
  height: 22px;
}
.collection-particles {
  position: absolute;
  inset: 0;
}
.collection-particles > * {
  position: absolute;
  left: calc(50% - 9px);
  bottom: 0;
  width: 18px;
  height: 18px;
  color: #ffd04e;
  filter: drop-shadow(0 1px 1px #735019);
  opacity: 0;
  animation: collection-rise 850ms var(--delay) ease-out both;
}
.resource-tnt .collection-particles img {
  width: 24px;
  height: 24px;
}
.still strong {
  animation: none;
}
.still .collection-particles {
  display: none;
}
@keyframes collection-pop {
  from {
    opacity: 0;
    transform: translateY(0) scale(0.8);
  }
  20% {
    opacity: 1;
  }
  70% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translateY(-55px);
  }
}
@keyframes collection-rise {
  20% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--drift), -100px) rotate(140deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  strong {
    animation: none;
  }
  .collection-particles {
    display: none;
  }
}
</style>

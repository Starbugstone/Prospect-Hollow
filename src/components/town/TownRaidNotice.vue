<template>
  <aside
    class="town-raid-notice"
    :class="{ 'town-raid-defense': defended, 'town-raid-loss': !defended, still: reducedMotion }"
    role="status"
    aria-live="polite"
    aria-atomic="true"
  >
    <button
      class="raid-notice-close"
      :aria-label="t(defended ? 'Close village defense notice' : 'Close coin loss notice')"
      @click="$emit('close')"
    >
      ×
    </button>
    <div class="raid-notice-particles" aria-hidden="true">
      <TownIcon
        v-for="i in 10"
        :key="i"
        :name="defended ? 'sheriff' : 'coin'"
        :style="{
          '--drift': `${(i - 5.5) * 25}px`,
          '--rise': `${-95 - (i % 3) * 25}px`,
          '--delay': `${(i % 4) * 70}ms`,
        }"
      />
    </div>
    <strong class="raid-notice-emblem" aria-hidden="true">
      <TownIcon
        v-if="defended"
        class="raid-defense-badge"
        :name="civicIncident(kind) ? 'fireStation' : 'sheriff'"
      />
      <template v-else><TownIcon name="coin" />−{{ number(coins) }}</template>
    </strong>
    <h2>
      {{
        t(
          defended
            ? 'VILLAGE DEFENDED!'
            : civicIncident(kind)
              ? 'Cleanup: {coins} coins'
              : 'A few coins lost',
          { coins: number(coins) },
        )
      }}
    </h2>
    <p v-if="bounty" class="raid-bounty">
      {{ t('Capture bounty: +{coins} coins', { coins: number(bounty) }) }}
    </p>
    <button v-if="!defended" class="raid-protect-action" @click="$emit('protect')">
      <TownIcon name="sheriff" /><TownIcon name="bank" />{{ t('Protect the village') }} →
    </button>
    <p>
      {{
        t(
          civicIncident(kind)
            ? defended
              ? 'The response crew kept every coin safe. All buildings remain open.'
              : 'Upgrade the fire station to reduce cleanup costs. Every building is intact.'
            : defended
              ? 'Your sheriff and bank kept every coin safe.'
              : 'Build and upgrade the sheriff’s department and bank to protect your savings.',
        )
      }}
    </p>
  </aside>
</template>
<script setup>
import { civicIncident } from '../../data/townEvents';
import { onMounted, onBeforeUnmount } from 'vue';
import { t, number } from '../../i18n';
import TownIcon from './TownIcon.vue';
defineProps({
  kind: { type: String, default: 'bandits' },
  bounty: { type: Number, default: 0 },
  coins: { type: Number, default: 0 },
  defended: Boolean,
  reducedMotion: Boolean,
});
const emit = defineEmits(['close', 'protect']);
let timeout;
onMounted(() => {
  timeout = setTimeout(() => emit('close'), 7000);
});
onBeforeUnmount(() => clearTimeout(timeout));
</script>
<style scoped>
.town-raid-notice {
  position: absolute;
  z-index: 7;
  left: 50%;
  top: 42%;
  transform: translate(-50%, -50%);
  width: min(360px, calc(100% - 32px));
  padding: 20px 24px;
  border: 2px solid #edb965;
  border-radius: 18px;
  background: #605039f5;
  color: #fff0cf;
  text-align: center;
  box-shadow: 0 8px 30px #382b3544;
}
.raid-protect-action {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  padding: 8px;
  border: 1px solid #d9c389;
  border-radius: 8px;
  background: #f7e8bd;
  color: #49563c;
  font-size: 13px;
  font-weight: 700;
}
.raid-protect-action svg {
  width: 24px;
  height: 24px;
}
.raid-notice-close {
  position: absolute;
  right: 2px;
  top: 2px;
  width: 40px;
  height: 40px;
  border: 0;
  background: transparent;
  color: #fff0cf;
  font-size: 24px;
}
.raid-notice-emblem {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
  color: #ffce74;
  font:
    900 52px/1.15 'Outfit',
    sans-serif;
  text-shadow: 0 3px #8a392b;
  animation: loss-impact 500ms ease-out both;
}
.raid-notice-emblem svg {
  width: 34px;
  height: 34px;
}
.town-raid-notice h2 {
  margin: 10px 0 8px;
  font-size: 18px;
  color: #ffe7c0;
}
.town-raid-notice .raid-bounty {
  color: #ffdc7d;
  font-size: 20px;
  font-weight: 800;
  margin-bottom: 8px;
}
.town-raid-notice p {
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}
.raid-notice-particles {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.raid-notice-particles svg {
  position: absolute;
  top: 30px;
  left: calc(50% - 10px);
  width: 20px;
  height: 20px;
  color: #ffd05c;
  opacity: 0;
  animation: loss-coins 1100ms var(--delay) ease-in both;
}
.town-raid-defense {
  border-color: #ffdc7d;
  background: #284e3bf5;
  box-shadow:
    0 8px 30px #203d3544,
    0 0 32px #ffdf8026;
}
.town-raid-defense h2 {
  font:
    900 28px/1.15 'Outfit',
    sans-serif;
  color: #ffe28b;
  text-shadow: 0 3px #1e3c2b;
}
.town-raid-defense .raid-defense-badge {
  width: 70px;
  height: 70px;
  padding: 10px;
  border: 3px double #ffe28b;
  border-radius: 50%;
  background: #427858;
  fill: #ffdc7d;
}
.town-raid-defense .raid-notice-particles svg {
  top: 55%;
  animation: defense-stars 1500ms var(--delay) ease-out 2 both;
}
.town-raid-defense .raid-notice-particles svg:nth-child(3n) {
  color: #b9eea1;
}
.town-raid-defense .raid-notice-particles svg:nth-child(3n + 1) {
  color: #b0e9f2;
}
@keyframes defense-stars {
  from {
    opacity: 0;
    transform: scale(0.4);
  }
  20%,
  65% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--drift), var(--rise)) rotate(240deg) scale(0.6);
  }
}
.still .raid-notice-particles {
  display: none;
}
.still .raid-notice-emblem {
  animation: none;
}
@keyframes loss-impact {
  from {
    transform: scale(1.4);
    opacity: 0;
  }
  45% {
    transform: scale(0.94);
    opacity: 1;
  }
  to {
    transform: scale(1);
  }
}
@keyframes loss-coins {
  15% {
    opacity: 1;
  }
  to {
    opacity: 0;
    transform: translate(var(--drift), 150px) rotate(160deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .raid-notice-particles {
    display: none;
  }
  .raid-notice-emblem {
    animation: none;
  }
}
</style>

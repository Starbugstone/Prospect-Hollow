<template>
  <section v-if="visiblePowers.length" class="powerup-section" :aria-label="t('Power-ups')">
    <div class="powerup-bar">
      <button
        v-for="item in visiblePowers"
        :key="item.id"
        :data-power-id="item.id"
        class="powerup-button"
        :class="{ active: activeId === item.id, draggable: TARGETED_POWERS.has(item.id) }"
        :disabled="
          !inventory.availableQuantity(item.id) ||
          !game.sessionActive ||
          game.levelCleared ||
          game.inputPaused ||
          (game.animationInProgress && ['shuffle', 'clear-row'].includes(item.id))
        "
        :aria-pressed="activeId === item.id"
        :aria-label="
          t('{power}, {count} remaining. {description}', {
            power: t(item.label),
            count: inventory.availableQuantity(item.id),
            description: t(descriptions[item.id]),
          })
        "
        :title="
          t('{power}: {description}', {
            power: t(item.label),
            description: t(descriptions[item.id]),
          })
        "
        @pointerdown="drag.start($event, item.id)"
        @click="drag.click(item.id)"
      >
        <span class="powerup-art"
          ><img :src="`/art/powers/${item.id}.svg`" alt="" draggable="false" /><span
            class="powerup-qty"
            >{{ inventory.availableQuantity(item.id) }}</span
          ></span
        ><span class="powerup-name">{{ t(item.label) }}</span>
      </button>
    </div>
    <Teleport to="body">
      <img
        v-if="drag.ghost.id"
        class="powerup-drag-ghost"
        :class="{ touch: drag.ghost.touch }"
        :src="`/art/powers/${drag.ghost.id}.svg`"
        :style="{ left: `${drag.ghost.x}px`, top: `${drag.ghost.y}px` }"
        alt=""
        aria-hidden="true"
      />
    </Teleport>
  </section>
</template>
<script setup>
import { t } from '../i18n';
import { computed } from 'vue';
import { useGameStore } from '../stores/gameStore';
import { TARGETED_POWERS, useInventoryStore } from '../stores/inventoryStore';
import { usePowerDrag } from '../composables/usePowerDrag';
const inventory = useInventoryStore();
const game = useGameStore();
const drag = usePowerDrag();
const activeId = computed(() => game.activeBonusMode);
const visiblePowers = computed(() =>
  inventory.quickAccessSlots.filter((item) => item.quantity > 0 || activeId.value === item.id),
);
const descriptions = {
  'clear-row': 'Clear a random row.',
  tnt: 'Shatter a 3 by 3 area around the chosen gem.',
  'color-wand': 'Clear every gem of the chosen color.',
  shuffle: 'Mix the board for new possibilities.',
  'tile-breaker': 'Clear a row and column through your chosen gem.',
};
</script>

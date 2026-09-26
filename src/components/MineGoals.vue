<template>
  <span class="mine-visual-goals" :aria-label="t('Clear these to finish')">
    <span
      v-for="goal in goals"
      :key="goal.id"
      :class="{ complete: goal.count === 0 }"
      :aria-label="`${t(goal.label)}: ${goal.total - goal.count} / ${goal.total}`"
      :title="`${t(goal.label)}: ${goal.total - goal.count} / ${goal.total}`"
    >
      <img :src="goal.art" alt="" /><span class="mine-goal-label">{{ t(goal.label) }}</span
      ><b class="mine-goal-progress">{{ goal.total - goal.count }} / {{ goal.total }}</b
      ><b class="mine-goal-remaining" aria-hidden="true">{{ goal.count || '✓' }}</b>
    </span>
  </span>
</template>
<script setup>
import { computed } from 'vue';
import { t } from '../i18n';
import { useGameStore } from '../stores/gameStore';
const game = useGameStore();
const props = defineProps({ initialTiles: Array });
const groups = [
  {
    id: 'lantern',
    label: 'Lanterns',
    art: '/art/obstacles/lantern.svg',
    value: (tile) => (tile.signal === 'lantern' ? tile.signalHealth : 0),
  },
  {
    id: 'survey',
    label: 'Survey trail',
    art: '/art/obstacles/survey.svg',
    value: (tile) => (tile.signal === 'survey' ? tile.signalHealth : 0),
  },
  {
    id: 'ice',
    label: 'Ice',
    art: '/art/ice/frost.svg',
    value: (tile) => (tile.type !== 'blocker' && !tile.sealColor ? (tile.health ?? 0) : 0),
  },
  {
    id: 'stone',
    label: 'Stone',
    art: '/art/blocks/stone.svg',
    value: (tile) => (tile.type === 'blocker' ? tile.health : 0),
  },
  {
    id: 'chain',
    label: 'Chained gem',
    art: '/art/obstacles/chain.svg',
    value: (tile) => tile.chainHealth ?? 0,
  },
  {
    id: 'seal',
    label: 'Seals',
    art: '/art/obstacles/seal.svg',
    value: (tile) => (tile.sealColor ? tile.health : 0),
  },
];
const goals = computed(() => [
  ...game.oreOrders.map((order) => ({
    id: `ore-${order.color}`,
    label: t('Collect {color} ore', { color: t(order.color) }),
    art: `/art/${order.color}.svg`,
    count: order.target - order.progress,
    total: order.target,
  })),
  ...groups
    .filter((g) => props.initialTiles?.some((tile) => g.value(tile) > 0))
    .map((g) => ({
      ...g,
      total: props.initialTiles.reduce((sum, tile) => sum + g.value(tile), 0),
      count: game.tiles.reduce((sum, tile) => sum + g.value(tile), 0),
    })),
  ...(game.totalRelics
    ? [
        {
          id: 'relic',
          label: 'Relics to deliver',
          art: '/art/relic.svg',
          count: game.remainingRelics,
          total: game.totalRelics,
        },
      ]
    : []),
]);
</script>
<style scoped>
.mine-visual-goals {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}
.mine-visual-goals > span {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: #fff0ce;
  font:
    800 14px/1 'Trebuchet MS',
    sans-serif;
}
.mine-visual-goals img {
  width: 26px;
  height: 26px;
  object-fit: contain;
  border-radius: 4px;
  background: #529ac43b;
  border: 1px solid #91c6dd66;
}
.mine-visual-goals .complete {
  color: #b8eaae;
  opacity: 0.75;
}
@media (max-width: 600px) {
  .mine-visual-goals {
    gap: 5px;
  }
  .mine-visual-goals img {
    width: 20px;
    height: 20px;
  }
  .mine-visual-goals > span {
    font-size: 11px;
  }
}
</style>

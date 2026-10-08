<template>
  <span class="mine-visual-goals" :aria-label="t('Clear these to finish')">
    <span
      v-for="goal in goals"
      :key="goal.id"
      :class="{ complete: goal.count === 0, 'last-goal': ordersLeft && goal.count > 0 }"
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
import { deepMineProgress } from '../game/engine/DeepMineMechanics';
import { mineSignalAppearance, mineRelicAppearance } from '../data/mineThemes';
const game = useGameStore();
const props = defineProps({ initialTiles: Array });
const groups = [
  {
    id: 'spore',
    label: 'Spore relays',
    art: '/art/obstacles/mushroom.svg',
    value: (tile) => (tile.signal === 'spore' ? tile.signalHealth : 0),
  },
  {
    id: 'blast-gate',
    label: 'Blast gates',
    art: '/art/obstacles/blast-gate.svg',
    value: (tile) =>
      tile.bonusOnly && tile.fossilGroup == null && !tile.lensOnly && tile.waist == null
        ? tile.health
        : 0,
  },
  {
    id: 'cracked-wall',
    label: 'Cracked walls',
    art: '/art/obstacles/cracked-wall.svg',
    value: (tile) => (tile.waist != null ? tile.health : 0),
  },
  {
    id: 'starglass',
    label: 'Starglass',
    art: '/art/obstacles/starglass.svg',
    value: (tile) => (tile.lensOnly ? tile.health : 0),
  },
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
    id: 'core',
    label: 'Core charges',
    art: '/art/obstacles/core.svg',
    value: (tile) => (tile.signal === 'core' ? tile.signalHealth : 0),
  },
  {
    id: 'ice',
    label: 'Ice',
    art: '/art/ice/frost.svg',
    value: (tile) =>
      tile.type !== 'blocker' && !tile.sealColor && !tile.phaseSeal && tile.fossilGroup == null
        ? (tile.health ?? 0)
        : 0,
  },
  {
    id: 'phase-seal',
    label: 'Phase seals',
    art: '/art/obstacles/phase-seal.svg',
    value: (tile) => (tile.phaseSeal ? (tile.health ?? 0) : 0),
  },
  {
    id: 'stone',
    label: 'Stone',
    art: '/art/blocks/stone.svg',
    value: (tile) =>
      tile.type === 'blocker' && !tile.rootKnot && !tile.bonusOnly ? tile.health : 0,
  },
  {
    id: 'chain',
    label: 'Chained gem',
    art: '/art/obstacles/chain.svg',
    value: (tile) => (tile.rootGroup == null ? (tile.chainHealth ?? 0) : 0),
  },
  {
    id: 'seal',
    label: 'Seals',
    art: '/art/obstacles/seal.svg',
    value: (tile) => (tile.sealColor ? tile.health : 0),
  },
];
const cargo = (board, float) =>
  (board ?? []).filter((gem) => gem?.type === 'relic' && !!gem.float === float).length;
const goals = computed(() => {
  const theme = game.currentLevel?.config.theme;
  const initial = deepMineProgress(props.initialTiles);
  const progress = deepMineProgress(game.tiles);
  const delivery = mineRelicAppearance(theme);
  const floats = cargo(game.currentLevel?.config.board, true);
  return [
    ...[
      { id: 'fossils', label: 'Fossils', art: '/art/obstacles/fossil.svg' },
      { id: 'roots', label: 'Root knots', art: '/art/obstacles/root-knot.svg' },
    ]
      .filter((goal) => initial[goal.id].total > 0)
      .map((goal) => ({
        ...goal,
        total: initial[goal.id].total,
        count: Math.max(0, initial[goal.id].total - progress[goal.id].completed),
      })),
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
        ...(mineSignalAppearance(theme, g.id)
          ? {
              label: mineSignalAppearance(theme, g.id).goalLabel,
              art: mineSignalAppearance(theme, g.id).art,
            }
          : {}),
        total: props.initialTiles.reduce((sum, tile) => sum + g.value(tile), 0),
        count: game.tiles.reduce((sum, tile) => sum + g.value(tile), 0),
      })),
    // Floatstones rise to sky hatches; other relics travel to their baskets.
    ...[
      {
        id: 'relic',
        label: delivery.goalLabel,
        art: delivery.art,
        float: false,
      },
      {
        id: 'floatstone',
        label: 'Floatstones',
        art: '/art/obstacles/floatstone.svg',
        float: true,
      },
    ]
      .map(({ float, ...goal }) => ({
        ...goal,
        total: float ? floats : game.totalRelics - floats,
        count: cargo(game.board, float),
      }))
      .filter((goal) => goal.total > 0),
  ];
});
// Once the board's own goals are done, the ore orders still due stand out: the level
// finishes only when they are full.
const ordersLeft = computed(() => {
  const open = goals.value.filter((goal) => goal.count > 0);
  const ore = (goal) => goal.id.startsWith('ore-');
  return open.length > 0 && open.every(ore) && goals.value.some((goal) => !ore(goal));
});
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
.mine-visual-goals .last-goal img {
  border-color: #ffd36a;
  box-shadow: 0 0 0 2px #ffd36a80;
  animation: last-goal 1.4s ease-in-out infinite alternate;
}
@keyframes last-goal {
  to {
    transform: scale(1.14);
  }
}
@media (prefers-reduced-motion: reduce) {
  .mine-visual-goals .last-goal img {
    animation: none;
  }
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

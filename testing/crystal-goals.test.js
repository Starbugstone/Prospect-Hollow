import { beforeEach, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import MineGoals from '../src/components/MineGoals.vue';
import { PROTOTYPE_BOARDS, prototypeConfig } from '../src/data/prototypeBoards';
import { OBSTACLES } from '../src/data/obstacles';
import { isCrystalSignal } from '../src/game/engine/CrystalMechanics';
import { useGameStore } from '../src/stores/gameStore';
let pinia;
beforeEach(() => {
  pinia = createPinia();
  setActivePinia(pinia);
});
it.each(
  PROTOTYPE_BOARDS.filter((board) => prototypeConfig(board.key).tiles.some(isCrystalSignal)).map(
    (board) => board.key,
  ),
)('shows every crystal objective and its completion: %s', async (key) => {
  const game = useGameStore(),
    level = prototypeConfig(key);
  game.startLevel(key, 'prototype');
  const render = () =>
    renderToString(createSSRApp(MineGoals, { initialTiles: level.tiles }).use(pinia));
  const active = await render();
  for (const obstacle of OBSTACLES.filter((obstacle) =>
    level.tiles.some((tile) => isCrystalSignal(tile) && obstacle.present(tile)),
  )) {
    expect(active).toContain(obstacle.name);
    expect(active).toContain(obstacle.art);
  }
  game.tiles = game.tiles.map((tile) => ({ ...tile, signalHealth: 0 }));
  expect(await render()).toContain('complete');
  game.exitLevel();
});

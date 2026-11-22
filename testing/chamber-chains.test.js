import { readFileSync } from 'node:fs';
import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, expect, it } from 'vitest';
import { OBSTACLES } from '../src/data/obstacles';
import { GEM_TYPES } from '../src/game/engine/GemFactory';
import { useSeed } from '../src/game/engine/gameRandom';
import { runFingerprint } from '../src/stores/game/runLog';
import { useCampaignStore } from '../src/stores/campaignStore';
import { useGameStore } from '../src/stores/gameStore';

// Levels 595–598 and 600 chain cells inside a sealed cellar. When the cellar opens,
// each of those chains holds one ordinary gem, so a normal match beside it frees it,
// as the chained gem's goal text promises.
//
// The kept run log (AGENTS.md): level 595 on seed 595, a hint-led player opening the
// cellar, then one plain match that frees a chained cell. It is replayed move by move.
const RUN = JSON.parse(
  readFileSync(new URL('./fixtures/runs/level-595-chamber-chains.json', import.meta.url), 'utf8'),
);

function fresh(level) {
  setActivePinia(createPinia());
  useCampaignStore().records = Object.fromEntries(
    Array.from({ length: level - 1 }, (_, i) => [i + 1, { score: 1, stars: 1 }]),
  );
  const game = useGameStore();
  game.bootstrap();
  return game;
}

const chainedCellar = (game) =>
  game.tiles.flatMap((tile, index) => (tile?.chamber && tile.chainHealth > 0 ? [index] : []));
const sealed = (game) => game.tiles.some((tile) => tile?.sealed);

beforeEach(() => useSeed(null));

it('fills the chains of an opened cellar with gems a normal match frees (level 595)', async () => {
  const live = fresh(595);
  expect(live.startLevel(RUN.level, RUN.mode, { seed: RUN.seed })).toBe(true);
  expect(chainedCellar(live)).toHaveLength(3);

  const [last] = RUN.actions.slice(-1);
  let opened = false;
  for (const action of RUN.actions) {
    const before = chainedCellar(live);
    expect(action.type).toBe('swap');
    expect(await live.resolveSwap(action.a, action.b, { activateInPlace: action.inPlace })).toBe(
      true,
    );
    if (!opened && !sealed(live)) {
      opened = true;
      // Every chain still standing in the opened cellar holds an ordinary gem.
      const standing = chainedCellar(live);
      expect(standing.length).toBeGreaterThan(0);
      for (const index of standing) expect(GEM_TYPES).toContain(live.board[index]?.type);
    }
    if (action !== last) continue;
    // The last move is a plain match taking in a chained cell, which it releases.
    expect(opened).toBe(true);
    const freed = before.filter((index) => !chainedCellar(live).includes(index));
    expect(freed.length).toBeGreaterThan(0);
    for (const index of freed) {
      const tile = live.tiles[index];
      expect(tile.chainHealth).toBe(0);
      expect(OBSTACLES.filter(({ present }) => present(tile)).map(({ id }) => id)).toEqual([]);
    }
  }
  expect(runFingerprint(live)).toBe(RUN.fingerprint);
});

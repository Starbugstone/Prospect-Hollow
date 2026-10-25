import { existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import frames from '../src/assets/board/frames.json';
import { BONUS_ATLAS_ROWS, OBSTACLE_SPRITES, POWER_SPRITES } from '../src/data/boardSprites';
import { POWERS, powerRecord } from '../src/data/campaign';
import { DEEP_MINE_SPRITES } from '../src/data/mineThemes';
import { OBSTACLES } from '../src/data/obstacles';
import { CHEST_DROPS } from '../src/data/rewards';
import { BonusActivator } from '../src/game/engine/BonusActivator';
import { BOARD_BONUSES } from '../src/game/engine/TileRules';
import { TARGETED_POWERS } from '../src/stores/inventoryStore';
import { freshProfile } from '../src/stores/campaignStore';

// Power and obstacle behaviour lives on their definitions (POWERS, OBSTACLES); the board's
// sprite list, targeted powers and activatable bonuses are derived from them.

it('loads exactly the board sprites the game always drew, from their definitions', () => {
  expect(OBSTACLE_SPRITES.map(([id]) => id).sort()).toEqual(
    [
      'gem-relic',
      ...['chain', 'seal', 'exit', 'seal-ruby', 'seal-sapphire', 'seal-emerald'].map(
        (type) => `tile-${type}`,
      ),
      ...['lantern', 'survey', 'core'].map((type) => `tile-${type}`),
      ...['stone', 'reinforced', 'cracked'].map((type) => `block-${type}`),
      ...['frost', 'cracked'].map((type) => `ice-${type}`),
    ].sort(),
  );
  expect(POWER_SPRITES).toEqual(POWERS.map(({ id }) => [`power-${id}`, `powers/${id}.svg`]));
  const keys = [...OBSTACLE_SPRITES, ...POWER_SPRITES, ...DEEP_MINE_SPRITES].map(([id]) => id);
  expect(new Set(keys).size).toBe(keys.length);
  for (const [id, file] of [...OBSTACLE_SPRITES, ...POWER_SPRITES]) {
    expect(existsSync(`public/art/${file}`), file).toBe(true);
    // The built atlas holds every sprite; the SVG is only its fallback.
    expect(frames['board-core'].frames[id], id).toBeDefined();
  }
  for (const obstacle of OBSTACLES.filter(({ texture }) => texture))
    expect(OBSTACLE_SPRITES).toContainEqual([obstacle.texture, obstacle.art.slice(5)]);
});

it('derives targeted and activatable powers from POWERS without changing them', () => {
  expect([...TARGETED_POWERS].sort()).toEqual(['color-wand', 'tile-breaker', 'tnt']);
  const activator = new BonusActivator();
  const activatable = [...BOARD_BONUSES, ...POWERS.map(({ id }) => id), 'relic', 'ruby'].filter(
    (type) => activator.isBonus(type),
  );
  expect(activatable.sort()).toEqual(
    ['bomb', 'rainbow', 'cross', 'clear-row', 'tnt', 'color-wand', 'tile-breaker'].sort(),
  );
  // Every targeted power fires through the bonus rules; the shuffle does neither.
  for (const id of TARGETED_POWERS) expect(activator.isBonus(id)).toBe(true);
  expect(TARGETED_POWERS.has('shuffle') || activator.isBonus('shuffle')).toBe(false);
  expect([...BONUS_ATLAS_ROWS].sort()).toEqual([...BOARD_BONUSES].sort());
});

it('keeps behaviour fields out of saves and chest drops', () => {
  const record = ['id', 'label', 'dropWeight'];
  for (const power of POWERS) expect(Object.keys(powerRecord(power))).toEqual(record);
  for (const power of freshProfile().powers)
    expect(Object.keys(power)).toEqual([...record, 'quantity']);
  for (const drop of CHEST_DROPS.filter(({ kind }) => kind === 'power')) {
    expect(drop).not.toHaveProperty('blast');
    expect(drop).not.toHaveProperty('targeted');
  }
});
